// Generate installed app icons from the supplied vector logo.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
const dir = new URL('../public/brand/', import.meta.url)
const symbol = await readFile(new URL('favicon.svg', dir))
const icon = async (size, name, safe = .84) => {
  const inner = Math.round(size * safe)
  const mark = await sharp(symbol, { density: 384 }).resize(inner, inner, { fit: 'contain', background: '#fff' }).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: '#fff' } }).composite([{ input: mark, gravity: 'centre' }]).png().toFile(fileURLToPath(new URL(name, dir)))
}
await Promise.all([
  icon(192, 'icon-192.png'), icon(512, 'icon-512.png'),
  icon(512, 'icon-maskable-512.png', .72), icon(180, 'apple-touch-icon.png', .78),
])
console.log('SingBuild icons generated')
