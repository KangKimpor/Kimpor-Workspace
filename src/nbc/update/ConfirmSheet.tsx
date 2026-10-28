import { useEffect, useState } from 'react'
import { percent } from '../format'
import type { Handler } from '../types'

export interface SheetItem { id: string; wbs: string; name: string; previous: number; progress: number; remark: string }
interface Props {
  handler: Handler; weekText: string; late: boolean; items: SheetItem[]; lowered: number; contribution: number
  note: string; onNote: (note: string) => void; error: string; busy: boolean; onCancel: () => void; onConfirm: () => void
}

/** Final check before confirming: a summary, an optional full list of what changed, and the weekly note. */
export function ConfirmSheet({ handler, weekText, late, items, lowered, contribution, note, onNote, error, busy, onCancel, onConfirm }: Props) {
  const [listed, setListed] = useState(false)
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onCancel])
  return <div className="nbc-sheet" role="dialog" aria-label="Confirm update">
    <h3>Confirm this week’s update</h3>
    <p className="small muted">{handler} · {weekText}{late && <> · will be marked <strong className="nbc-late-word">Late</strong></>}</p>
    <dl className="nbc-sheet-stats">
      <div><dt>Changed</dt><dd>{items.length}</dd></div>
      <div><dt>Overall</dt><dd>{Math.abs(contribution) < 1e-10 ? '0.00' : `${contribution > 0 ? '+' : '−'}${Math.abs(contribution * 100).toFixed(2)}`}%</dd></div>
      <div><dt>Lowered</dt><dd>{lowered}</dd></div>
    </dl>
    <label className="nbc-switch"><span>Show all updated tasks and percentages changed</span><input type="checkbox" role="switch" aria-checked={listed} checked={listed} onChange={(event) => setListed(event.target.checked)}/></label>
    {listed && <ul className="nbc-sheet-list" aria-label="Updated tasks">{items.length === 0 ? <li className="muted">No changes this week.</li> : items.map((i) => <li key={i.id}>
      <span><span className="nbc-wbs-no">{i.wbs}</span> {i.name}</span><strong>{percent(i.previous, 1)} → {percent(i.progress, 1)}</strong>{i.remark.trim() && <small>{i.remark}</small>}
    </li>)}</ul>}
    <label className="nbc-sheet-note">Weekly note (optional)<textarea maxLength={4000} rows={2} value={note} onChange={(event) => onNote(event.target.value)}/></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="nbc-sheet-actions"><button className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="btn-accent" autoFocus disabled={busy} onClick={onConfirm}>{busy ? 'Confirming…' : 'Confirm'}</button></div>
  </div>
}
