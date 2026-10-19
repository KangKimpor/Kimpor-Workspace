import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { useSpringPress } from '@/motion/hooks'
import { useSheen } from './Glass'

export type ButtonStatus = 'idle' | 'success' | 'error'

export interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'default' | 'tinted'
  size?: 'md' | 'icon'
  /** The label cross-fades to a spinner at constant width (§11). */
  loading?: boolean
  /** Success morphs to a check that draws in 240 ms; error shakes (§11). */
  status?: ButtonStatus
  /** Specimen only: render an interaction state without a pointer. */
  force?: 'hover' | 'pressed' | 'focus'
  children?: ReactNode
}

export function GlassButton({
  variant = 'default',
  size = 'md',
  loading = false,
  status = 'idle',
  force,
  disabled,
  className,
  children,
  onClick,
  onPointerMove,
  type = 'button',
  ...rest
}: GlassButtonProps) {
  const press = useSpringPress({ disabled: disabled || loading })
  const sheen = useSheen<HTMLButtonElement>(onPointerMove as never)
  const busy = loading
  const showCheck = status === 'success' && !busy
  const showLabel = !busy && !showCheck

  return (
    <motion.button
      type={type}
      className={className ? `glass gbtn ${className}` : 'glass gbtn'}
      data-material={variant === 'tinted' ? 'tinted' : 'regular'}
      data-size={size}
      data-status={status}
      data-force={force}
      data-interactive=""
      aria-busy={busy || undefined}
      aria-disabled={busy || disabled || undefined}
      disabled={disabled}
      onPointerMove={sheen}
      onClick={busy ? undefined : onClick}
      {...press}
      {...rest}
    >
      <span className="gbtn-layer" data-hidden={!showLabel}>
        {children}
      </span>
      {busy ? (
        <span className="gbtn-layer" role="status" aria-label="Loading">
          <span className="spinner" />
        </span>
      ) : null}
      {showCheck ? (
        <span className="gbtn-layer" role="status" aria-label="Done">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="check-path" d="M4 9.5l3.5 3.5L14 5.5" />
          </svg>
        </span>
      ) : null}
    </motion.button>
  )
}
