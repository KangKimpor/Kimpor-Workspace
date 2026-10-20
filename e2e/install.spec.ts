import { expect, test } from '@playwright/test'

test('appearance provides platform install guidance and a deferred Chromium install action', async ({
  page,
}) => {
  await page.goto('/settings/appearance')
  await expect(page.getByText(/On iPhone or iPad, open Safari/)).toBeVisible()
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt: async () => window.dispatchEvent(new Event('appinstalled')),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install app', exact: true }).click()
  await expect(page.getByText(/Installed on this device/)).toBeVisible()
})

test('calendar display preferences persist and change week order and clocks', async ({
  page,
}) => {
  await page.goto('/settings/appearance')
  await page.getByLabel('Week starts on').selectOption('0')
  await page.getByLabel('Clock format').selectOption('12')
  await page.reload()
  await expect(page.getByLabel('Week starts on')).toHaveValue('0')
  await expect(page.getByLabel('Clock format')).toHaveValue('12')
  await page.goto('/calendar/week/2026-10-19')
  await expect(page.locator('.week-day').first()).toHaveAttribute(
    'data-date',
    '2026-10-18',
  )
  await expect(
    page.locator('.time-gutter').getByText('1:00 PM', { exact: true }),
  ).toBeVisible()
})
