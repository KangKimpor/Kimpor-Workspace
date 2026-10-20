import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 4,
  timeout: 60000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'corepack pnpm build && corepack pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
