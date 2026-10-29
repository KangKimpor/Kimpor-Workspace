import { test as base, expect } from '@playwright/test'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'http://localhost:4173'
export const authStorageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
// A local-only mock identity keeps the existing workspace interaction fixtures in guest storage.
// Auth and live-cloud suites use Playwright directly and exercise the real gate separately.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify({
        access_token: 'workspace-ui-test', refresh_token: 'workspace-ui-test',
        expires_at: 4102444800, expires_in: 3600, token_type: 'bearer',
        user: { id: 'guest', aud: 'authenticated', email: 'ui@example.invalid', user_metadata: {} },
      }))
    }, { key: authStorageKey })
    await use(page)
  },
})
export { expect }
export type { Page } from '@playwright/test'
