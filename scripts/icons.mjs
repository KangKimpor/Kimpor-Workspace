// Generates favicons and PWA icons from public/brand/logo.svg. Swap the logo, run `pnpm icons`.
import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dir = new URL('../public/brand/', import.meta.url)
const logo = await readFile(new URL('logo.svg', dir), 'utf8')

// Full-bleed variant for maskable icons and iOS: the logo glyph sits inside the 80% safe zone.
const bleed = logo
  .replace(/<rect[^>]*\/>/, '<rect width="512" height="512" fill="#1A73D9"/>')
  .replace('<path', '<g transform="translate(51.2 51.2) scale(0.8)"><path')
  .replace('</svg>', '</g></svg>')

const png = (svg, size, name) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(fileURLToPath(new URL(name, dir)))

await Promise.all([
  png(logo, 192, 'icon-192.png'),
  png(logo, 512, 'icon-512.png'),
  png(bleed, 512, 'icon-maskable-512.png'),
  png(bleed, 180, 'apple-touch-icon.png'),
  copyFile(new URL('logo.svg', dir), new URL('favicon.svg', dir)),
])
console.log('icons generated')
