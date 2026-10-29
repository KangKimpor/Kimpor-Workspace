import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { authStorageKey } from './workspace-test'
// Auth responses are mocked; service workers must not fetch around those routes.
test.use({ serviceWorkers: 'block' })
const cors = {
  'access-control-allow-origin': 'http://localhost:4173',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
}

test('successful sign-in opens the workspace, survives reload, and sign-out restores the gate', async ({ page }) => {
  const user = { id: 'f0000000-0000-4000-8000-000000000001', aud: 'authenticated', email: 'account-test@example.invalid', user_metadata: {} }
  await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers: cors, json: { access_token: 'test-session', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ headers: cors, json: [] }))
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, headers: cors }))
  await page.goto('/settings/account')
  await page.getByLabel('Email address', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('existing-password')
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
})

test('password reset sends the existing callback and shows confirmation', async ({ page }) => {
  await page.route('**/auth/v1/recover*', (route) => route.fulfill({ headers: cors, json: {} }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill('account-test@example.invalid')
  const request = page.waitForRequest((request) => request.url().includes('/auth/v1/recover') && request.method() === 'POST')
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  expect(new URL((await request).url()).searchParams.get('redirect_to')).toBe('http://localhost:4173/settings/account')
  await expect(page.getByRole('status')).toHaveText('Check your inbox for a password reset link.')
})

test('a recovery callback keeps the workspace gated until the new password is saved', async ({ page }) => {
  const key = `${authStorageKey}-code-verifier`
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify('test-verifier/recovery')), key)
  const user = { id: 'f0000000-0000-4000-8000-000000000001', aud: 'authenticated', email: 'account-test@example.invalid', user_metadata: {} }
  await page.route('**/auth/v1/token?grant_type=pkce', (route) => route.fulfill({ headers: cors, json: { access_token: 'test-session', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } }))
  await page.route('**/auth/v1/user', (route) => route.fulfill({ headers: cors, json: user }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ headers: cors, json: [] }))
  await page.goto('/settings/account?code=test-recovery-code')
  await expect(page.getByRole('heading', { name: 'Choose a new password', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
  await page.getByLabel('New password', { exact: true }).fill('replacement-password-1234')
  const request = page.waitForRequest((request) => request.url().endsWith('/auth/v1/user') && request.method() === 'PUT')
  await page.getByRole('button', { name: 'Update password', exact: true }).click()
  expect((await request).postDataJSON().password).toBe('replacement-password-1234')
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
})

test('email sign-in accepts existing passwords and shows server errors', async ({
  page,
}) => {
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      status: route.request().method() === 'OPTIONS' ? 204 : 400,
      headers: cors,
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
      status: route.request().method() === 'OPTIONS' ? 204 : 200,
      headers: cors,
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
      headers: cors,
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
for (const width of [320, 393, 820, 1180, 1920]) {
  test(`account forms fit at ${width}px`, async ({ page }) => {
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
  })
}
for (const scheme of ['light', 'dark'] as const) {
  test(`account form accessibility in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/settings/account')
    await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible()
    const result = await new AxeBuilder({ page }).analyze()
    expect(
      result.violations
        .filter((v) => ['serious', 'critical'].includes(v.impact || ''))
        .map((v) => `${scheme} ${v.id}: ${v.nodes[0]?.target}`),
    ).toEqual([])
  })
}
