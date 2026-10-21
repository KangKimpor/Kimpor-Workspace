import { expect, test } from '@playwright/test'

test.use({ hasTouch: true, isMobile: true })

for (const width of [320, 393, 639]) {
  test(`mobile screens use the available width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 })
    for (const route of ['/', '/projects', '/projects/website/table', '/projects/website/board', '/tasks', '/calendar/day/today', '/settings/appearance', '/p/weekly-plan', '/search', '/trash']) {
      await page.goto(route)
      const surface = page.locator('main > .page, main > .workspace-surface')
      await expect(surface).toBeVisible()
      const layout = await surface.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        const topbar = document.querySelector('.topbar')!.getBoundingClientRect()
        return {
          left: box.left + parseFloat(style.paddingLeft),
          right: innerWidth - box.right + parseFloat(style.paddingRight),
          topGap: box.top - topbar.bottom,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }
      })
      expect(layout, route).toEqual({ left: 16, right: 16, topGap: 12, overflow: false })
      if (route.endsWith('/table')) {
        const heading = await page.locator('.project-heading h1').boundingBox()
        const icon = await page.locator('.project-heading > .icon-tile').boundingBox()
        expect(Math.abs(heading!.y - icon!.y)).toBeLessThan(2)
        await expect(page.locator('tbody tr').first()).toBeInViewport()
        for (const button of await page.locator('.project-table-toolbar > button').all()) {
          const box = await button.boundingBox()
          expect(box!.width).toBeGreaterThanOrEqual(44)
          expect(box!.height).toBeGreaterThanOrEqual(44)
        }
        await page.screenshot({ path: `test-results/mobile-spacing-${width}.png`, animations: 'disabled' })
      }
    }
  })
}
