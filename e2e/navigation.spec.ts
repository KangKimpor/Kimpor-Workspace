import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 393, height: 852 },
  hasTouch: true,
  isMobile: true,
})
test('phone sidebar opens on the first tap and closes after navigation', async ({
  page,
}) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Open sidebar', exact: true })
  await expect(button).toBeVisible()
  await button.tap()
  const drawer = page.getByRole('dialog', { name: 'Sidebar', exact: true })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('link', { name: 'My tasks', exact: true }).tap()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(drawer).not.toBeVisible()
  await button.tap()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Close sidebar', exact: true }).tap()
  await expect(drawer).not.toBeVisible()
})
