import { lazy, Suspense, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flag, Trash2 } from 'lucide-react'
import type { IssueSource } from './ReportIssue'
const ReportIssue = lazy(() => import('./ReportIssue'))

export interface RowActionTarget extends IssueSource { id: string; x: number; y: number }

export function RowActions({ item, onClose, onDelete }: { item: RowActionTarget | null; onClose: () => void; onDelete?: () => void }) {
  const [report, setReport] = useState<IssueSource | null>(null)
  useEffect(() => {
    if (!item) return
    const outside = (event: Event) => { if (!(event.target as Element | null)?.closest?.('.row-context-menu')) onClose() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.row-context-menu button')?.focus({ preventScroll: true }))
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [item, onClose])
  return <>
    {item && createPortal(<div className="row-context-menu" role="menu" aria-label="Task actions" style={{ left: Math.max(8, Math.min(item.x, innerWidth - 188)), top: Math.max(8, Math.min(item.y, innerHeight - (onDelete ? 104 : 60))) }}>
      {onDelete && <button role="menuitem" className="danger-text" aria-label={`Delete task ${item.title}`} onClick={() => { onDelete(); onClose() }}><Trash2 size={15} aria-hidden="true"/>Delete</button>}
      <button role="menuitem" aria-label={`Report issue for ${item.title}`} onClick={() => { setReport(item); onClose() }}><Flag size={15} aria-hidden="true"/>Report issue</button>
    </div>, document.body)}
    {report && <Suspense fallback={<span className="sr-only" role="status">Opening issue report…</span>}><ReportIssue source={report} onClose={() => setReport(null)}/></Suspense>}
  </>
}
