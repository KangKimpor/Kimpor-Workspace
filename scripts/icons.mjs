// SingBuild supplied artwork. Keep the full wordmark and use its symbol for app icons.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
const dir = new URL('../public/brand/', import.meta.url)
const artwork = await readFile(new URL('logo.png', dir))
const symbol = await sharp(artwork).extract({ left: 0, top: 0, width: 188, height: 185 }).png().toBuffer()
const svg = (image, width, height) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${image.toString('base64')}"/></svg>`
const icon = async (size, name, safe = .84) => {
  const inner = Math.round(size * safe)
  const mark = await sharp(symbol).resize(inner, inner, { fit: 'contain', background: '#fff' }).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: '#fff' } }).composite([{ input: mark, gravity: 'centre' }]).png().toFile(fileURLToPath(new URL(name, dir)))
}
await Promise.all([
  writeFile(new URL('logo.svg', dir), svg(artwork, 679, 185)),
  writeFile(new URL('favicon.svg', dir), svg(symbol, 188, 185)),
  icon(192, 'icon-192.png'), icon(512, 'icon-512.png'),
  icon(512, 'icon-maskable-512.png', .72), icon(180, 'apple-touch-icon.png', .78),
])
console.log('SingBuild icons generated')
