import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const files = new Set()
function collect(key) {
  const entry = manifest[key]
  if (!entry || files.has(entry.file)) return
  files.add(entry.file)
  for (const stylesheet of entry.css || []) files.add(stylesheet)
  for (const dependency of entry.imports || []) collect(dependency)
}
for (const [key, entry] of Object.entries(manifest))
  if (entry.isEntry) collect(key)
let bytes = 0
for (const file of files)
  if (file.endsWith('.js'))
    bytes += gzipSync(await readFile(`dist/${file}`)).length
console.log(
  `Initial app JavaScript: ${(bytes / 1024).toFixed(1)} KiB gzip (limit 200 KiB).`,
)
assert(bytes < 200 * 1024, 'The app shell exceeds its JavaScript budget')
let cssBytes = 0
for (const file of files)
  if (file.endsWith('.css'))
    cssBytes += gzipSync(await readFile(`dist/${file}`)).length
console.log(`Initial app CSS: ${(cssBytes / 1024).toFixed(1)} KiB gzip (limit 15 KiB).`)
assert(cssBytes < 15 * 1024, 'Load view-specific styles with their routes instead of the app shell')
const html = await readFile('dist/index.html', 'utf8')
const bootstrap = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)?.[1]
assert(bootstrap, 'Missing pre-paint theme bootstrap')
const hash = createHash('sha256').update(bootstrap).digest('base64')
const config = await readFile('vercel.json', 'utf8')
assert(config.includes(`sha256-${hash}`), 'Theme bootstrap does not match its CSP hash')
