import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.PREVIEW_URL || 'http://localhost:4173'
const out = new URL('../docs/screenshots/stitch-refresh/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const sizes = [
  [1920, 1080],
  [1440, 900],
  [1280, 720],
  [1180, 820],
  [820, 1180],
  [393, 852],
  [320, 640],
]
const routes = [
  ['home', '/'],
  ['design', '/design'],
  ['page', '/p/weekly-plan'],
  ['project', '/projects/website/overview'],
  ['board', '/projects/website/board'],
  ['tasks', '/tasks'],
  ['calendar', '/calendar/week/today'],
  ['settings', '/settings/appearance'],
]
let captured = 0
try {
  for (const colorScheme of ['light', 'dark']) {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme,
        reducedMotion: 'reduce',
        timezoneId: 'Asia/Bangkok',
      })
      const page = await context.newPage()
      const capture = async (name) => {
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Overflow at ${name} ${width} ${colorScheme}`,
        )
        await page.screenshot({
          path: fileURLToPath(
            new URL(`${name}-${width}-${colorScheme}.png`, out),
          ),
          animations: 'disabled',
        })
        captured++
      }
      for (const [name, route] of routes) {
        if (
          ![1920, 1180, 820, 393].includes(width) &&
          !['home', 'design'].includes(name)
        )
          continue
        await page.goto(`${baseURL}${route}`)
        await page.waitForLoadState('networkidle')
        await page.locator('.shell').waitFor()
        await capture(name)
      }
      if ([1920, 393].includes(width)) {
        await page.goto(`${baseURL}/`)
        await page
          .getByRole('button', { name: 'Open command palette', exact: true })
          .click()
        await page.getByRole('dialog').waitFor()
        await capture('command')
        await page.keyboard.press('Escape')
        await page.goto(`${baseURL}/projects/website/board`)
        await page
          .getByRole('button', { name: /Finalize token contrasts/ })
          .click()
        await page.getByRole('dialog').waitFor()
        await capture('task-detail')
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
}
assert(captured > 0)
console.log(
  `Captured ${captured} screenshots in docs/screenshots/stitch-refresh`,
)
