import { readFileSync } from 'node:fs'
import { expect, test, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
const path = process.env.KW_QA_FIXTURE
const fixture = path
  ? (JSON.parse(readFileSync(path, 'utf8')) as {
      url: string
      key: string
      users: { id: string; email: string; password: string }[]
    })
  : null
// Live test credentials are ephemeral, supplied outside the repository, and never traced.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.skip(!fixture, 'Requires isolated live QA users via KW_QA_FIXTURE')
test.setTimeout(180000)
async function actor(index: number) {
  const user = fixture!.users[index]!
  const client = createClient(fixture!.url, fixture!.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error || !data.session) throw new Error('QA account sign-in failed')
  return { client, session: data.session, user }
}
async function signedIn(context: BrowserContext, session: unknown) {
  const key = `sb-${new URL(fixture!.url).hostname.split('.')[0]}-auth-token`
  await context.addInitScript(
    ({ key, session }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(session))
    },
    { key, session },
  )
}
test('live isolated accounts enforce ownership and private attachment access', async () => {
  const a = await actor(0),
    b = await actor(1),
    id = crypto.randomUUID()
  const first = await a.client.rpc('kw_workspace_write', {
    collection: 'pages',
    record_id: id,
    payload: { id, title: 'QA owner-only page' },
    expected: null,
  })
  expect(first.error?.message).toBeUndefined()
  const hidden = await b.client.from('kw_pages').select('id').eq('id', id)
  expect(hidden.data).toEqual([])
  const stolen = await b.client
    .from('kw_pages')
    .insert({ id: crypto.randomUUID(), user_id: a.user.id, data: {} })
  expect(stolen.error).toBeTruthy()
  const stale = await a.client.rpc('kw_workspace_write', {
    collection: 'pages',
    record_id: id,
    payload: { id, title: 'Stale edit' },
    expected: null,
  })
  expect(stale.data?.conflict).toBe(true)
  const path = `${a.user.id}/qa-${id}/check.txt`
  const upload = await a.client.storage
    .from('kw-files')
    .upload(
      path,
      new Blob(['Workspace attachment verification'], { type: 'text/plain' }),
    )
  expect(upload.error?.message).toBeUndefined()
  expect(
    (await a.client.storage.from('kw-files').download(path)).data,
  ).toBeTruthy()
  expect(
    (await b.client.storage.from('kw-files').download(path)).error,
  ).toBeTruthy()
  expect(
    (await a.client.from('kw_calendar_tokens').select('account_id')).error,
  ).toBeTruthy()
  expect(
    (await a.client.storage.from('kw-files').remove([path])).error,
  ).toBeNull()
})
test('two real clients recover offline edits after a saved conflict without losing the editor text', async ({
  browser,
}) => {
  const a = await actor(0)
  const first = await browser.newContext(),
    second = await browser.newContext()
  try {
    await signedIn(first, a.session)
    await signedIn(second, a.session)
    const pageA = await first.newPage(),
      pageB = await second.newPage()
    await pageA.goto('/p/new')
    await pageA
      .getByLabel('Page title', { exact: true })
      .fill('QA offline page')
    await pageA.locator('.bn-editor').click()
    await pageA.keyboard.type('Original content')
    const id = pageA.url().split('/').pop()!
    await expect
      .poll(
        async () =>
          JSON.stringify(
            (
              await a.client
                .from('kw_pages')
                .select('data')
                .eq('id', id)
                .maybeSingle()
            ).data,
          ),
        { timeout: 75000 },
      )
      .toContain('Original content')
    await pageB.goto(pageA.url())
    await expect(pageB.locator('.bn-editor')).toContainText('Original content')
    await first.setOffline(true)
    await pageA.locator('.bn-editor').click()
    await pageA.keyboard.press('ControlOrMeta+End')
    await pageA.keyboard.type(' Offline retained')
    await expect
      .poll(async () =>
        pageA.evaluate(
          (scope) =>
            new Promise<boolean>((resolve) => {
              const request = indexedDB.open('kimpor-workspace')
              request.onsuccess = () => {
                const db = request.result
                const row = db
                  .transaction('snapshots')
                  .objectStore('snapshots')
                  .get(scope)
                row.onsuccess = () => {
                  resolve(
                    JSON.stringify(row.result?.content || '').includes(
                      'Offline retained',
                    ),
                  )
                  db.close()
                }
              }
              request.onerror = () => resolve(false)
            }),
          a.user.id,
        ),
      )
      .toBe(true)
    await pageA.reload()
    await expect(pageA.locator('.bn-editor')).toContainText('Offline retained')
    await pageB
      .getByLabel('Page title', { exact: true })
      .fill('QA newer saved page')
    await pageB.locator('.bn-editor').click()
    await pageB.keyboard.press('ControlOrMeta+End')
    await pageB.keyboard.type(' Remote saved')
    await expect
      .poll(
        async () =>
          JSON.stringify(
            (
              await a.client
                .from('kw_pages')
                .select('data')
                .eq('id', id)
                .maybeSingle()
            ).data,
          ),
        { timeout: 75000 },
      )
      .toContain('Remote saved')
    await first.setOffline(false)
    await pageA.bringToFront()
    await expect(pageA.getByLabel('Page title', { exact: true })).toHaveValue(
      'QA newer saved page',
      { timeout: 75000 },
    )
    await expect(pageA.locator('.bn-editor')).toContainText('Remote saved')
    await expect
      .poll(
        async () =>
          JSON.stringify(
            (
              await a.client
                .from('kw_pages')
                .select('data')
                .eq('user_id', a.user.id)
            ).data,
          ),
        { timeout: 75000 },
      )
      .toContain('Recovered edit')
    const recovered = await a.client
      .from('kw_pages')
      .select('data')
      .eq('user_id', a.user.id)
    expect(
      recovered.data?.some(
        (row) =>
          String(row.data.title).startsWith('Recovered edit') &&
          JSON.stringify(row.data.content).includes('Offline retained'),
      ),
    ).toBe(true)
  } finally {
    await first.close()
    await second.close()
  }
})
