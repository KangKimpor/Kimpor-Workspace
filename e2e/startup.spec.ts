import { expect, test } from '@playwright/test'
import { test as workspaceTest, authStorageKey } from './workspace-test'

test.use({ serviceWorkers: 'block', viewport: { width: 393, height: 852 } })

for (const route of ['/', '/projects-progress/nbc-bp03/activities', '/p/private-page']) {
  test(`sign-in is required at ${route} and local work is preserved`, async ({ page }) => {
    const local = JSON.stringify({ pages: [{ id: 'private-page', title: 'Private local note' }] })
    await page.addInitScript((local) => localStorage.setItem('kw-workspace-v1', local), local)
    await page.goto(route)
    await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
    await expect(page.getByText('Private local note', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('kw-workspace-v1'))).toBe(local)
    expect(new URL(page.url()).pathname).toBe(route)
  })
}

workspaceTest('the signed-in workspace heading paints before task controls load', async ({ page }) => {
  let state: { heading: string | null; paints: string[]; paintTiming: boolean } | undefined
  await page.route('**/assets/TaskTable-*.js', async (route) => {
    state = await page.evaluate(() => ({
      heading: document.querySelector('main h1')?.textContent ?? null,
      paints: performance.getEntriesByType('paint').map((entry) => entry.name),
      paintTiming: PerformanceObserver.supportedEntryTypes.includes('paint'),
    }))
    await route.continue()
  })
  await page.goto('/')
  await expect(page.getByRole('table')).toBeVisible()
  expect(state?.heading).toBe('Website Redesign')
  if (state?.paintTiming) expect(state.paints).toContain('first-contentful-paint')
})

test('a stored sign-in never leaves a blank page when the cloud does not answer', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: 1, expires_in: 1, token_type: 'bearer', user: { id: 'u1', email: 'a@b.c' } })), authStorageKey)
  await page.route('**/auth/v1/**', () => {})
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible()
})
