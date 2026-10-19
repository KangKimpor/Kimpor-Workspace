import { FileText, LayoutDashboard, Palette } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import type { ScreenMeta } from '@/shell/routes'

export function Home() {
  return (
    <div className="page">
      <h1 className="t-title large-title">Home</h1>
      <EmptyState
        icon={<LayoutDashboard size={28} strokeWidth={1.75} />}
        title="Your workspace is ready"
        action={
          <Link to="/design" className="btn-accent btn-glow">
            <Palette size={16} strokeWidth={1.75} aria-hidden="true" />
            Open the design system
          </Link>
        }
      >
        Pages, tasks and your calendar will gather here as each part of the workspace is built.
      </EmptyState>
    </div>
  )
}

/** Route target for screens delivered in later phases. Shows what is coming and when. */
export function Placeholder() {
  const meta = useOutletContext<ScreenMeta>()
  return (
    <div className="page">
      <h1 className="t-title large-title">{meta.title}</h1>
      <EmptyState icon={<FileText size={28} strokeWidth={1.75} />} title={meta.phase ? `Coming in Phase ${meta.phase}` : meta.title}>
        {meta.blurb}
      </EmptyState>
    </div>
  )
}
