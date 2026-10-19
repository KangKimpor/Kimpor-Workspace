import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Automated contrast check over tokens.css (SPEC §9: fix any pair that fails). */
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

type RGBA = [number, number, number, number]

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector)
  if (!m) throw new Error(`no block for ${selector}`)
  const out: Record<string, string> = {}
  for (const d of m[1]!.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim()
  return out
}

const light = block(/:root,\s*\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)
const dark = { ...light, ...block(/\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/) }

function parse(v: string, theme: Record<string, string>): RGBA {
  const ref = v.match(/^var\((--[a-z0-9-]+)\)$/)
  if (ref) return parse(theme[ref[1]!]!, theme)
  if (v.startsWith('#')) {
    const h = v.slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA
  }
  const m = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/)
  if (!m) throw new Error(`cannot parse ${v}`)
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
}

const over = (fg: RGBA, bg: RGBA): RGBA => [
  fg[0] * fg[3] + bg[0] * (1 - fg[3]),
  fg[1] * fg[3] + bg[1] * (1 - fg[3]),
  fg[2] * fg[3] + bg[2] * (1 - fg[3]),
  1,
]

const lum = ([r, g, b]: RGBA) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function pair(theme: Record<string, string>, fg: string, bg: string): number {
  const base = over(parse(theme[bg]!, theme), [255, 255, 255, 1])
  const canvas = parse(theme['--bg-canvas']!, theme)
  const back = bg === '--bg-canvas' ? canvas : over(parse(theme[bg]!, theme), canvas)
  void base
  return ratio(over(parse(theme[fg]!, theme), back), back)
}

const palette = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, t) => {
  it.each(['--bg-canvas', '--bg-sidebar', '--bg-raised'])('primary and secondary text on %s is at least 4.5:1', (bg) => {
    expect(pair(t, '--text-primary', bg)).toBeGreaterThanOrEqual(4.5)
    expect(pair(t, '--text-secondary', bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('link, danger and success text pass 4.5:1 on canvas', () => {
    for (const k of ['--accent-text', '--danger-text', '--success-text']) {
      expect(pair(t, k, '--bg-canvas'), k).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('white label on accent-fill passes 4.5:1', () => {
    const fill = parse(t['--accent-fill']!, t)
    expect(ratio([255, 255, 255, 1], fill)).toBeGreaterThanOrEqual(4.5)
  })

  it('focus ring and palette icon colors pass 3:1 on canvas', () => {
    expect(pair(t, '--accent', '--bg-canvas')).toBeGreaterThanOrEqual(3)
    for (const c of palette) expect(pair(t, `--c-${c}`, '--bg-canvas'), c).toBeGreaterThanOrEqual(3)
  })

  it('chip backgrounds carry primary text at 4.5:1', () => {
    for (const c of palette) expect(pair(t, '--text-primary', `--chip-${c}`), c).toBeGreaterThanOrEqual(4.5)
  })

  it('tinted glass keeps the white label at 4.5:1 over the canvas', () => {
    const alpha = Number.parseInt(t['--glass-tint-alpha']!, 10) / 100
    const canvas = parse(t['--bg-canvas']!, t)
    const regular = over(parse(t['--glass-regular-bg']!, t), canvas)
    const accent = parse(t['--accent-fill']!, t)
    const bg = over([accent[0], accent[1], accent[2], alpha], regular)
    expect(ratio([255, 255, 255, 1], bg)).toBeGreaterThanOrEqual(4.5)
  })
})
