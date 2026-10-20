import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', viewport: { width: 393, height: 852 } })

test('guest home paints before background data initialization', async ({ page }) => {
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
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => paintsAtInitialization).toContain('first-contentful-paint')
})

test('guest data still initializes without Paint Timing support', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', { value: [] })
  })
  const initialization = page.waitForRequest('**/assets/sync-*.js')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await initialization
})
