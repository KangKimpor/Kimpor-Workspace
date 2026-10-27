import { useState } from 'react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { BottomSheet } from '@/shell/Overlays'
import { assignActivities } from '../actions'
import { handlers } from '../types'
import type { NbcActivity } from '../types'

/** Audited bulk reassignment of every leaf under one parent activity. */
export function ReassignSheet({ activities, open, onOpenChange }: { activities: NbcActivity[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [parent, setParent] = useState(''), [handler, setHandler] = useState<string>(handlers[0]), [error, setError] = useState('')
  const root = activities.find((a) => a.id === parent)
  const leaves = activities.filter((a) => a.editable && root && (a.id === root.id || a.wbs.startsWith(`${root.wbs}.`)))
  return <BottomSheet initial="large" open={open} onOpenChange={onOpenChange} title="Reassign handlers">
    <form className="nbc-sheet-fields" onSubmit={(e) => { e.preventDefault(); try { if (!parent) throw new Error('Select a parent activity.'); assignActivities(leaves.map((a) => a.id), handler); onOpenChange(false) } catch (err) { setError((err as Error).message) } }}>
      <label className="nbc-field">Parent activity<GlassSelect aria-label="Parent activity" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">Choose parent…</option>{activities.filter((a) => !a.editable).map((a) => <option key={a.id} value={a.id}>{a.wbs} · {a.name}</option>)}</GlassSelect></label>
      <label className="nbc-field">Assign to<GlassSelect aria-label="Bulk handler" value={handler} onChange={(e) => setHandler(e.target.value)}>{handlers.map((h) => <option key={h}>{h}</option>)}</GlassSelect></label>
      <p>{leaves.length} leaf activities will be assigned to {handler}. Progress percentages stay the same.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn-accent" type="submit" disabled={!leaves.length}>Confirm assignment · {leaves.length} activities</button>
    </form>
  </BottomSheet>
}
