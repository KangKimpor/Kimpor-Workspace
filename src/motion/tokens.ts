/** Motion tokens: SPEC.md §11. Mirrors the CSS custom properties in tokens.css. */

export const DURATION = {
  instant: 0.08,
  fast: 0.14,
  base: 0.22,
  slow: 0.34,
  page: 0.42,
} as const

/** Exits run at 70% of the enter duration. */
export const exitDuration = (enter: number) => enter * 0.7

export const EASE = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
} as const

export const EASE_CSS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const

export const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 34 },
  smooth: { type: 'spring', stiffness: 300, damping: 30 },
  bouncy: { type: 'spring', stiffness: 420, damping: 22 },
} as const

/** Loading lists stagger 30 ms per item, maximum 8 items (§11). */
export const STAGGER = { step: 0.03, max: 8 } as const

/** Reduced motion swaps movement for opacity and removes overshoot. */
export const REDUCED = { type: 'tween', duration: DURATION.fast, ease: EASE.standard } as const
