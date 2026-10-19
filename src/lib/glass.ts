import { create } from 'zustand'

export type GlassPref = 'auto' | 'full' | 'reduced' | 'off'
export type GlassLevel = 'full' | 'reduced' | 'off'
export type MotionPref = 'system' | 'reduced'

const GLASS_KEY = 'kw-glass'
const MOTION_KEY = 'kw-motion'

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

interface GlassState {
  pref: GlassPref
  /** What Auto currently resolves to; Auto starts at Full (§10). */
  auto: GlassLevel
  motion: MotionPref
  setPref: (pref: GlassPref) => void
  setAuto: (level: GlassLevel) => void
  setMotion: (motion: MotionPref) => void
}

export const effectiveLevel = (s: Pick<GlassState, 'pref' | 'auto'>): GlassLevel =>
  s.pref === 'auto' ? s.auto : s.pref

function apply(s: GlassState) {
  const root = document.documentElement
  root.dataset.glass = effectiveLevel(s)
  if (s.motion === 'reduced') root.dataset.motion = 'reduced'
  else delete root.dataset.motion
}

export const useGlass = create<GlassState>((set, get) => ({
  pref: read<GlassPref>(GLASS_KEY, ['auto', 'full', 'reduced', 'off'], 'auto'),
  auto: 'full',
  motion: read<MotionPref>(MOTION_KEY, ['system', 'reduced'], 'system'),
  setPref: (pref) => {
    write(GLASS_KEY, pref)
    set({ pref, auto: 'full' })
    apply(get())
  },
  setAuto: (auto) => {
    set({ auto })
    apply(get())
  },
  setMotion: (motion) => {
    write(MOTION_KEY, motion)
    set({ motion })
    apply(get())
  },
}))

/**
 * Auto mode: starts at Full and drops to Reduced when frame time stays above 20 ms for 2 s (§10).
 * Returns a cleanup function. Runs only while the pref is Auto and the page is visible.
 */
export function watchFrameTime(): () => void {
  let raf = 0
  let timer = 0
  let last = 0
  let slowSince = 0
  const tick = (t: number) => {
    const s = useGlass.getState()
    if (s.pref === 'auto' && s.auto === 'full' && !document.hidden) {
      if (last) {
        const dt = t - last
        if (dt > 20 && dt < 500) {
          slowSince ||= t
          if (t - slowSince >= 2000) {
            s.setAuto('reduced')
            slowSince = 0
          }
        } else {
          slowSince = 0
        }
      }
      last = t
      raf = requestAnimationFrame(tick)
    } else {
      last = 0
      slowSince = 0
      timer = window.setTimeout(() => {
        raf = requestAnimationFrame(tick)
      }, 1000)
    }
  }
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    clearTimeout(timer)
  }
}

export function syncGlassToDocument() {
  apply(useGlass.getState())
}
