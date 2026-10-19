import { useCallback, useRef } from 'react'
import type { HTMLAttributes, PointerEvent, Ref } from 'react'

export type Material = 'thin' | 'regular' | 'thick' | 'tinted'

/** Cursor sheen: writes --mx / --my, throttled with requestAnimationFrame, fine pointers only (§10). */
export function useSheen<T extends HTMLElement>(onPointerMove?: (e: PointerEvent<T>) => void) {
  const frame = useRef(0)
  return useCallback(
    (e: PointerEvent<T>) => {
      onPointerMove?.(e)
      if (e.pointerType !== 'mouse') return
      const el = e.currentTarget
      const { clientX, clientY } = e
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${clientX - r.left}px`)
        el.style.setProperty('--my', `${clientY - r.top}px`)
      })
    },
    [onPointerMove],
  )
}

export interface GlassProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'nav' | 'aside' | 'header' | 'section' | 'footer'
  material?: Material
  /** Adds the pointer-only rim brightening and sheen. */
  interactive?: boolean
  /** Specimen only: render the hover state without a pointer. */
  force?: 'hover'
  ref?: Ref<HTMLElement>
}

export function Glass({
  as: Tag = 'div',
  material = 'regular',
  interactive,
  force,
  className,
  onPointerMove,
  ref,
  ...rest
}: GlassProps) {
  const sheen = useSheen<HTMLElement>(onPointerMove)
  return (
    <Tag
      ref={ref as Ref<never>}
      className={className ? `glass ${className}` : 'glass'}
      data-material={material}
      data-interactive={interactive ? '' : undefined}
      data-force={force}
      onPointerMove={interactive ? sheen : onPointerMove}
      {...rest}
    />
  )
}
