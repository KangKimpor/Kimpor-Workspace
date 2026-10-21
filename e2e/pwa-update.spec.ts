import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

test('first install is offline-ready and later updates reload only on request', async ({ page }) => {
  let revision = 1
  const root = path.resolve('dist')
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png' }
  const server = createServer(async (request, response) => {
    try {
      let file = new URL(request.url!, 'http://localhost').pathname
      if (!path.extname(file)) file = '/index.html'
      const resolved = path.resolve(root, `.${file}`)
      if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Outside fixture')
      let content = await readFile(resolved)
      if (file === '/sw.js') content = Buffer.concat([content, Buffer.from(`\n// QA worker ${revision}`)])
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      response.end(content)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    await page.goto(`http://127.0.0.1:${address.port}`)
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    let loads = 0
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.resourceType() === 'document') loads++
    })
    // Exercise both the first-install session and a returning, already controlled tab.
    for (let attempt = 0; attempt < 2; attempt++) {
      revision++
      // Returning to an open desktop app or reconnecting must discover deployments.
      await page.evaluate((event) => window.dispatchEvent(new Event(event)), attempt === 0 ? 'focus' : 'online')
      await expect(page.getByText('New version available', { exact: true })).toBeVisible()
      expect(loads).toBe(attempt)
      await Promise.all([
        page.waitForEvent('domcontentloaded'),
        page.getByRole('button', { name: 'Reload', exact: true }).click(),
      ])
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(loads).toBe(attempt + 1)
    }
  } finally {
    await page.goto('about:blank')
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
