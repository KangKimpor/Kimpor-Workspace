import { animate, useDragControls, useMotionValue, useReducedMotion } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { REDUCED, SPRING, STAGGER, DURATION, EASE } from './tokens'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

/** Reduced motion from the OS or from the in-app setting (html[data-motion='reduced']). */
export function useMotionReduced(): boolean {
  const os = useReducedMotion()
  const [app, setApp] = useState(() => document.documentElement.dataset.motion === 'reduced')
  useEffect(() => {
    const obs = new MutationObserver(() => setApp(document.documentElement.dataset.motion === 'reduced'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    return () => obs.disconnect()
  }, [])
  return Boolean(os) || app
}

/** Press scales to 0.97 and springs back (snappy). Hover lift 1 px on fine pointers only (§11). */
export function useSpringPress(options: { disabled?: boolean } = {}) {
  const reduced = useMotionReduced()
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  if (options.disabled) return { transition: REDUCED }
  return {
    whileTap: reduced ? { opacity: 0.85 } : { scale: 0.97 },
    whileHover: fine && !reduced ? { y: -1 } : undefined,
    transition: reduced ? REDUCED : SPRING.snappy,
  }
}

export type Detent = 'medium' | 'large'
export const DETENTS: Record<Detent, number> = { medium: 0.5, large: 0.92 }

/**
 * Bottom-sheet drag: medium (50%) and large (92%) detents, rubber-banding, velocity-based dismissal (§11, §12).
 * The sheet is laid out at its large height; y translates it down to a detent or off screen.
 */
export function useSheetDrag(options: { onDismiss: () => void; initial?: Detent }) {
  const { onDismiss, initial = 'medium' } = options
  const reduced = useMotionReduced()
  const controls = useDragControls()
  const y = useMotionValue(typeof window === 'undefined' ? 800 : window.innerHeight)
  const opacity = useMotionValue(reduced ? 0 : 1)
  const [detent, setDetent] = useState<Detent>(initial)
  const heightRef = useRef(0)

  const offsetFor = useCallback((d: Detent) => heightRef.current * (1 - DETENTS[d] / DETENTS.large), [])

  const measure = useCallback(() => {
    heightRef.current = window.innerHeight * DETENTS.large
  }, [])

  const snapTo = useCallback(
    (d: Detent) => {
      measure()
      setDetent(d)
      animate(opacity, 1, reduced ? REDUCED : { duration: DURATION.base, ease: EASE.enter })
      if (reduced) y.set(offsetFor(d))
      else animate(y, offsetFor(d), { duration: DURATION.base, ease: EASE.enter })
    },
    [measure, offsetFor, opacity, reduced, y],
  )

  const open = useCallback(
    (d: Detent = initial) => {
      measure()
      opacity.set(0)
      y.set(heightRef.current)
      snapTo(d)
    },
    [initial, measure, opacity, snapTo, y],
  )

  const close = useCallback(() => {
    measure()
    if (reduced) animate(opacity, 0, REDUCED).then(onDismiss)
    else {
      animate(opacity, 0, { duration: DURATION.base * .7, ease: EASE.exit })
      animate(y, heightRef.current, { duration: DURATION.base * .7, ease: EASE.exit }).then(onDismiss)
    }
  }, [measure, onDismiss, opacity, reduced, y])

  const onDragEnd = useCallback(
    (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const vy = info.velocity.y
      const pos = y.get()
      const medium = offsetFor('medium')
      if (vy > 900 || pos > medium + (heightRef.current - medium) * 0.55) return close()
      if (vy < -900) return snapTo('large')
      // otherwise snap to the nearest detent
      snapTo(Math.abs(pos - offsetFor('large')) < Math.abs(pos - medium) ? 'large' : 'medium')
    },
    [close, offsetFor, snapTo, y],
  )

  return {
    y,
    opacity,
    detent,
    open,
    close,
    snapTo,
    sheetProps: {
      drag: 'y' as const,
      dragControls: controls,
      dragListener: false,
      dragMomentum: false,
      onDrag: () => {
        // rubber-band past the large detent
        const v = y.get()
        if (v < 0) y.set(v * 0.6)
      },
      onDragEnd,
      style: { y, opacity },
    },
    handleProps: {
      onPointerDown: (e: React.PointerEvent) => controls.start(e),
      style: { touchAction: 'none' as const },
    },
  }
}

/** 30 ms stagger per item, maximum 8 items (§11). Reduced motion keeps the order but drops movement. */
export function useListStagger() {
  const reduced = useMotionReduced()
  return useCallback(
    (index: number) => ({
      initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
      animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
      transition: {
        delay: Math.min(index, STAGGER.max - 1) * STAGGER.step,
        ...(reduced ? REDUCED : SPRING.smooth),
      },
    }),
    [reduced],
  )
}
