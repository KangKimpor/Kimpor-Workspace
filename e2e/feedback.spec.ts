import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true })

for (const preference of ['system', 'os-reduced', 'app-reduced']) {
  test(`press and save feedback respects ${preference} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: preference === 'os-reduced' ? 'reduce' : 'no-preference' })
    await page.addInitScript((value) => {
      localStorage.setItem('kw-motion', value === 'app-reduced' ? 'reduced' : 'system')
    }, preference)
    await page.goto('/')
    const button = page.getByRole('button', { name: 'Open sidebar', exact: true })
    await expect(button).toBeVisible()
    await button.hover()
    await page.mouse.down()
    await expect(button).toHaveCSS('scale', preference === 'system' ? '0.97' : 'none')
    await page.mouse.move(390, 300)
    await page.mouse.up()
    await expect(button).toHaveCSS('scale', 'none')

    const status = page.getByTestId('sync-pill')
    await status.evaluate((element) => { element.setAttribute('data-tone', 'busy') })
    await expect(status.locator('.dot')).toHaveCSS('animation-name', preference === 'system' ? 'saving-pulse' : 'none')
    await status.evaluate((element) => { element.removeAttribute('data-tone') })

    await page.goto('/projects/website/board')
    await page.getByRole('button', { name: 'New task', exact: true }).first().click()
    await page.getByText('More fields', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Delete task', exact: true }).first().click()
    const toast = page.locator('.workspace-toast')
    await expect(toast).toContainText(/Task deleted/)
    await expect(toast).toHaveCSS('animation-name', preference === 'system' ? 'toast-in' : 'none')
    await toast.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(toast).not.toBeVisible()
  })
}
