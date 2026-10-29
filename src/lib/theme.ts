import { create } from 'zustand'
import { DURATION, EASE_CSS } from '@/motion/tokens'

export type ThemePref = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'kw-theme'
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#ffffff', dark: '#191919' }

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'system' || v === 'dark' ? v : 'light'
  } catch {
    return 'light'
  }
}

function systemTheme(): ResolvedTheme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref
}

function applyToDocument(pref: ThemePref) {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m, i) => {
    if (pref === 'system') {
      m.content = i === 0 ? THEME_COLOR.light : THEME_COLOR.dark
      m.media = i === 0 ? '(prefers-color-scheme: light)' : '(prefers-color-scheme: dark)'
    } else {
      m.content = THEME_COLOR[resolved]
      m.removeAttribute('media')
    }
  })
}

interface ThemeState {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref: (pref: ThemePref, origin?: { x: number; y: number }) => void
}

export const useTheme = create<ThemeState>((set) => ({
  pref: readPref(),
  resolved: typeof document === 'undefined' ? 'light' : resolveTheme(readPref()),
  setPref: (pref, origin) => {
    const commit = () => {
      try {
        localStorage.setItem(KEY, pref)
      } catch {
        /* storage unavailable: keep the in-memory choice */
      }
      applyToDocument(pref)
      set({ pref, resolved: resolveTheme(pref) })
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement
    type VT = { ready: Promise<void> }
    const start = (document as Document & { startViewTransition?: (cb: () => void) => VT }).startViewTransition
    if (start && origin && !reduce) {
      const x = origin.x
      const y = origin.y
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      const vt = start.call(document, commit)
      vt.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: DURATION.page * 1000, easing: EASE_CSS.standard, pseudoElement: '::view-transition-new(root)' },
          )
        })
        .catch(() => undefined)
    } else {
      root.classList.add('theme-fade')
      commit()
      window.setTimeout(() => root.classList.remove('theme-fade'), 220)
    }
  },
}))

/** Keep data-theme in sync when the OS scheme changes while the preference is System. */
export function watchSystemTheme(): () => void {
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    const { pref } = useTheme.getState()
    if (pref === 'system') {
      applyToDocument('system')
      useTheme.setState({ resolved: resolveTheme('system') })
    }
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
