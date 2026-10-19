import { Glass } from './Glass'
import type { GlassProps } from './Glass'

export interface GlassPanelProps extends GlassProps {
  title?: string
  /** Padding token in px: 8, 12, 16, 20 or 24. */
  pad?: 8 | 12 | 16 | 20 | 24
}

/** A glass surface with a title row and consistent padding. Never put glass inside it. */
export function GlassPanel({ title, pad = 16, style, children, ...rest }: GlassPanelProps) {
  return (
    <Glass style={{ padding: `var(--space-${pad})`, ...style }} {...rest}>
      {title ? (
        <div className="t-label" style={{ marginBottom: 'var(--space-8)' }}>
          {title}
        </div>
      ) : null}
      {children}
    </Glass>
  )
}
