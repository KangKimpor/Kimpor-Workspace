import type { ReactNode } from 'react'

/** Empty state: the glyph floats 6 px over 4 s; the primary action has a soft glow (§11). */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty" role="status">
      <div className="glyph float-glyph" aria-hidden="true">
        {icon}
      </div>
      <h2 className="t-h3" style={{ margin: 0 }}>
        {title}
      </h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}
