import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = ['/', '/design']
const sizes = [
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 393, height: 852 },
]

for (const route of routes) {
  for (const size of sizes) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe ${route} ${size.width}x${size.height} ${scheme}`, async ({ page }) => {
        await page.setViewportSize(size)
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        const { violations } = await new AxeBuilder({ page }).analyze()
        const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
      })
    }
  }
}
