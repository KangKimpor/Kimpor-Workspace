import { expect, test } from './workspace-test'

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
  await page.getByRole('combobox', { name: 'Week starts on' }).click()
  await page.getByRole('option', { name: 'Sunday', exact: true }).click()
  await page.getByRole('combobox', { name: 'Clock format' }).click()
  await page.getByRole('option', { name: '12 hour', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Week starts on' })).toHaveText('Sunday')
  await expect(page.getByRole('combobox', { name: 'Clock format' })).toHaveText('12 hour')
  await page.goto('/calendar/week/2026-10-19')
  await expect(page.locator('.week-day').first()).toHaveAttribute(
    'data-date',
    '2026-10-18',
  )
  await expect(
    page.locator('.time-gutter').getByText('1:00 PM', { exact: true }),
  ).toBeVisible()
})
