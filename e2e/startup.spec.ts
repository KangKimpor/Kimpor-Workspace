import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', viewport: { width: 393, height: 852 } })

test('an existing guest workspace paints before offline restoration', async ({ page }) => {
  test.skip(
    !await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('paint')),
    'This browser does not expose Paint Timing',
  )
  let paintsAtInitialization: string[] = []
  await page.route('**/assets/sync-*.js', async (route) => {
    paintsAtInitialization = await page.evaluate(() =>
      performance.getEntriesByType('paint').map((entry) => entry.name),
    )
    await route.continue()
  })
  await page.goto('/')
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).fill('Restore this guest note')
  await expect(page.getByRole('status').filter({ hasText: 'Demo · local' })).toBeVisible()
  await page.evaluate(() => localStorage.removeItem('kw-workspace-v1'))
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => paintsAtInitialization).toContain('first-contentful-paint')
  await expect(page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true })).toHaveValue('Restore this guest note')
})

test('guest data still initializes without Paint Timing support', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] })
    Object.defineProperty(IDBFactory.prototype, 'databases', { value: undefined })
  })
  const initialization = page.waitForRequest('**/assets/sync-*.js')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await initialization
})

test('a fresh guest initializes data on interaction and keeps the first edit', async ({ page }) => {
  let initialized = false
  page.on('request', (request) => {
    if (/\/assets\/sync-[^/]+\.js$/.test(request.url())) initialized = true
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([])
  expect(initialized).toBe(false)
  await expect(page.getByRole('heading', { name: 'Website Redesign', exact: true })).toBeVisible()
  const initialization = page.waitForRequest('**/assets/sync-*.js')
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await initialization
  await page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true }).fill('My first guest edit')
  await expect(page.getByRole('status').filter({ hasText: 'Demo · local' })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Description for Finalize token contrasts for WCAG AA', { exact: true })).toHaveValue('My first guest edit')
})
