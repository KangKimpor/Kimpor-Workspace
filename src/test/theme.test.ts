import { readFileSync } from 'node:fs'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

test.each([
  [null, 'light', 'light'],
  ['invalid', 'light', 'light'],
  ['dark', 'dark', 'dark'],
  ['system', 'system', 'dark'],
] as const)('theme preference %s on a dark device resolves to %s / %s', async (saved, pref, resolved) => {
  vi.resetModules()
  localStorage.clear()
  if (saved) localStorage.setItem('kw-theme', saved)
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const { useTheme } = await import('@/lib/theme')
  expect(useTheme.getState()).toMatchObject({ pref, resolved })
  const html = readFileSync('index.html', 'utf8')
  const bootstrap = html.match(/<script id="theme-bootstrap">(.*?)<\/script>/)![1]!
  new Function(bootstrap)()
  expect(document.documentElement.dataset.theme).toBe(resolved)
})
