import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './workspace-test'

test('appearance choices persist and calendar integration stays hidden', async ({ page }) => {
  await page.goto('/settings/appearance')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('switch', { name: 'Reduce motion' }).check()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('switch', { name: 'Reduce motion' })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'System', exact: true }).click()
  await expect(page.getByRole('button', { name: 'System', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Account & sync', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.getByText('Manage Google calendars')).toHaveCount(0)
  await expect(page.locator('a[href="/settings/accounts"]')).toHaveCount(0)
  await page.goto('/settings/accounts')
  await expect(page).toHaveURL(/\/settings\/appearance$/)
  await expect(page.getByRole('button', { name: 'Add Google account' })).toHaveCount(0)
  await page.goto('/calendar/week/today')
  await page.getByRole('button', { name: /^Calendars/ }).click()
  await expect(page.locator('a[href="/settings/accounts"]')).toHaveCount(0)
})

for (const width of [320, 393, 1440]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`settings fit and remain accessible at ${width}px in ${scheme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ colorScheme: scheme })
      for (const section of ['appearance', 'account']) {
        await page.goto(`/settings/${section}`)
        await expect(page.locator('.settings-content-heading h2')).toHaveText(section === 'account' ? 'Account & sync' : 'Appearance')
        if (section === 'account') await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
        await expect(page.locator('.settings-page')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
        const { violations } = await new AxeBuilder({ page }).include('.settings-page').analyze()
        expect(violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target}`)).toEqual([])
        await page.screenshot({ path: `test-results/settings-${section}-${width}-${scheme}-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' })
      }
    })
  }
}
