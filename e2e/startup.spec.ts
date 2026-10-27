import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', viewport: { width: 393, height: 852 } })

declare global {
  interface Window { workspaceDatabaseOpens: { paints: string[] }[] }
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.workspaceDatabaseOpens = []
    const open = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (...args) {
      if (args[0] === 'kimpor-workspace') window.workspaceDatabaseOpens.push({
        paints: performance.getEntriesByType('paint').map((entry) => entry.name),
      })
      return Reflect.apply(open, this, args)
    }
  })
})

test('an existing guest workspace paints before offline restoration', async ({ page }) => {
  test.skip(
    !await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('paint')),
    'This browser does not expose Paint Timing',
  )
  await page.goto('/')
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).fill('Restore this guest note')
  await expect(page.getByRole('status').filter({ hasText: 'Demo · local' })).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('kw-workspace-v1'))
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.workspaceDatabaseOpens[0]?.paints ?? [])).toContain('first-contentful-paint')
  await expect(page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true })).toHaveValue('Restore this guest note')
})

test('guest data still initializes without Paint Timing support', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] })
    Object.defineProperty(IDBFactory.prototype, 'databases', { value: undefined })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.workspaceDatabaseOpens.length)).toBeGreaterThan(0)
})

test('a fresh guest initializes data on interaction and keeps the first edit', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([])
  expect(await page.evaluate(() => window.workspaceDatabaseOpens)).toEqual([])
  await expect(page.getByRole('heading', { name: 'Website Redesign', exact: true })).toBeVisible()
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.workspaceDatabaseOpens.length)).toBeGreaterThan(0)
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).fill('My first guest edit')
  await expect(page.getByRole('status').filter({ hasText: 'Demo · local' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true })).toHaveValue('My first guest edit')
})

test('a stored sign-in never leaves a blank page when the cloud does not answer', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-nlcpjdokfvawlpzyfytx-auth-token', JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: 1, expires_in: 1, token_type: 'bearer', user: { id: 'u1', email: 'a@b.c' } })))
  await page.route(/supabase\.co/, () => {})
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
})
