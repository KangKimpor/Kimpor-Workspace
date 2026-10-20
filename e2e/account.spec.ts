import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('email sign-in accepts existing passwords and shows server errors', async ({
  page,
}) => {
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 400,
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      }),
    }),
  )
  await page.goto('/settings/account')
  await page
    .getByLabel('Email address', { exact: true })
    .fill('account-test@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill('oldpass8')
  const request = page.waitForRequest('**/auth/v1/token?grant_type=password')
  await page
    .locator('form')
    .getByRole('button', { name: 'Sign in', exact: true })
    .click()
  await request
  await expect(page.getByRole('alert')).toContainText(
    'Invalid login credentials',
  )
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page
    .getByRole('button', { name: 'Forgot password?', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Reset your password', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(
    'account-test@example.invalid',
  )
})
test('create account has its own form and email-confirmation step', async ({
  page,
}) => {
  await page.route('**/auth/v1/signup*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'f0000000-0000-4000-8000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'account-test@example.invalid',
        created_at: new Date().toISOString(),
        identities: [],
      }),
    }),
  )
  await page.goto('/settings/account')
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await page.getByLabel('Your name', { exact: true }).fill('Test person')
  await page
    .getByLabel('Email address', { exact: true })
    .fill('account-test@example.invalid')
  await page.getByLabel('Password', { exact: true }).fill('test-password-1234')
  await page
    .getByRole('button', { name: 'Create your account', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Check your inbox', exact: true }),
  ).toBeVisible()
})
test('Google sign-in goes to the configured provider and exact app callback', async ({
  page,
}) => {
  await page.route('**/auth/v1/authorize?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<h1>OAuth provider handoff</h1>',
    }),
  )
  await page.goto('/settings/account')
  await page
    .getByRole('button', { name: 'Continue with Google', exact: true })
    .click()
  await expect(page).toHaveURL(/\/auth\/v1\/authorize\?/)
  const destination = new URL(page.url())
  expect(destination.searchParams.get('provider')).toBe('google')
  expect(destination.searchParams.get('redirect_to')).toBe(
    'http://localhost:4173/settings/account',
  )
  expect(destination.searchParams.get('code_challenge')).toBeTruthy()
})
test('account forms fit phone, tablet and desktop with accessible labels and contrast', async ({
  page,
}) => {
  for (const width of [320, 393, 820, 1180, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/settings/account')
    await expect(
      page.getByRole('button', { name: 'Continue with Google', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
  }
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 393, height: 852 })
    const result = await new AxeBuilder({ page }).analyze()
    expect(
      result.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact || ''))
        .map((v) => `${scheme} ${v.id}: ${v.nodes[0]?.target}`),
    ).toEqual([])
  }
})
