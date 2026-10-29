// Run: node docs/prototypes/sign-in.check.mjs (uses the existing browser-test dependency).
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const root = new URL('../../', import.meta.url)
const files = new Map([
  ['/docs/prototypes/sign-in.html', 'text/html'],
  ['/public/brand/favicon.svg', 'image/svg+xml'],
  ['/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'font/woff2'],
])
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    if (!files.has(path)) throw new Error('Unknown asset')
    const content = await readFile(new URL(`.${path}`, root))
    response.writeHead(200, { 'Content-Type': files.get(path) })
    response.end(content)
  } catch { response.writeHead(404); response.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const output = new URL('.private/auth-prototype/', root)
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  await page.goto(`${origin}/docs/prototypes/sign-in.html`)
  await page.getByRole('heading', { name: 'Welcome', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.locator('.story, .preview-note, .eyebrow').count(), 0)
  assert.equal(await page.locator('#intro').isVisible(), false)
  const form = await page.locator('main').boundingBox()
  assert(Math.abs(form.x + form.width / 2 - 720) < 1, 'Form must be centered')
  assert(Math.abs(form.y + form.height / 2 - 500) < 1, 'Form must be vertically centered')
  await page.screenshot({ path: fileURLToPath(new URL('sign-in-desktop.png', output)), fullPage: true, animations: 'disabled' })
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map(v => v.id), [])
  await page.getByRole('button', { name: 'Create an account', exact: true }).click()
  await page.getByLabel('Full name', { exact: true }).fill('Alex Kim')
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('short')
  assert.equal(await page.locator('form').evaluate(form => form.checkValidity()), false)
  await page.getByLabel('Password', { exact: true }).fill('a-long-test-password')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await page.screenshot({ path: fileURLToPath(new URL('sign-up-desktop.png', output)), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  assert.equal(await page.getByRole('heading', { name: 'Check your inbox.' }).isVisible(), true)
  assert.match(await page.locator('#message-copy').innerText(), /alex@example.com/)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  assert.match(await page.locator('#message-copy').innerText(), /password reset link/)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  assert.equal(await page.getByRole('heading', { name: 'You’re ready to go.' }).isVisible(), true)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  assert.equal(await page.getByRole('heading', { name: 'Continue with Google.' }).isVisible(), true)
  await page.getByRole('button', { name: 'Back to sign in', exact: true }).click()
  await page.getByLabel('Email address', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  assert.deepEqual((await new AxeBuilder({ page }).analyze()).violations.map(v => v.id), [])
  await page.screenshot({ path: fileURLToPath(new URL('sign-in-dark.png', output)), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click()
  for (const width of [820, 393, 320]) {
    await page.setViewportSize({ width, height: 852 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const centered = await page.locator('main').boundingBox()
    assert(Math.abs(centered.x + centered.width / 2 - width / 2) < 1)
    if (width === 393) await page.screenshot({ path: fileURLToPath(new URL('sign-in-mobile.png', output)), fullPage: true, animations: 'disabled' })
  }
  assert.deepEqual(errors, [])
  assert(requests.every(url => url.startsWith(origin)), 'Prototype must not contact account services')
  console.log('PASS: sign-in, sign-up, reset, Google preview, theme, responsive layout and accessibility. No account requests sent.')
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
