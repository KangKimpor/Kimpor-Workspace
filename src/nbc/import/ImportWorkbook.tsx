import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useWorkspace } from '@/data'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { MAX_TEMPLATE_BYTES } from '../export/workbook'
import { percent } from '../format'
import { handlers } from '../types'
import type { Handler, NbcActivity } from '../types'
import { weekLabel, weekStart } from '../submissions'
import { importPercentages } from './workbook'
import { importDrafts } from './actions'

export default function ImportWorkbook({ projectId, activities, onClose }: { projectId: string; activities: NbcActivity[]; onClose: () => void }) {
  const scope = useWorkspace(s => s.scope), week = weekStart()
  const [parsed, setParsed] = useState<ReturnType<typeof importPercentages> | null>(null), [name, setName] = useState('')
  const [shared, setShared] = useState<Handler | ''>(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [done, setDone] = useState<Handler[]>([])
  const [replace, setReplace] = useState(false)
  const changed = activities.filter(a => a.editable && parsed && parsed.values.get(a.id) !== a.progress)
  const lowered = changed.filter(a => parsed!.values.get(a.id)! < a.progress)
  async function choose(file: File) {
    setParsed(null); setError(''); setName(file.name); setBusy(true); setShared(''); setReason(''); setReplace(false)
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > MAX_TEMPLATE_BYTES) throw new Error('Choose an XLSX workbook up to 10 MB.')
      setParsed(importPercentages(new Uint8Array(await file.arrayBuffer()), activities))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function save() {
    if (!parsed || useWorkspace.getState().scope !== scope) return
    try { setDone(importDrafts(projectId, week, parsed.values, shared, reason, replace)); setError('') } catch (e) { setError((e as Error).message) }
  }
  return <Dialog.Root open onOpenChange={open => !open && !busy && onClose()}><Dialog.Portal>
    <Dialog.Overlay className="scrim"/>
    <Dialog.Content className="event-editor project-editor glass" data-material="thick">
      <div className="row-between"><Dialog.Title className="t-h3">Import progress from Excel</Dialog.Title><Dialog.Close disabled={busy} className="ibtn" aria-label="Close import"><X size={18}/></Dialog.Close></div>
      <Dialog.Description className="small muted">Import cumulative percentages for {weekLabel(week)}. Review and confirm each handler’s draft in Update Progress to apply changes.</Dialog.Description>
      {done.length ? <><p role="status">Imported {done.length} handler drafts. Live progress is unchanged until confirmation.</p><ul>{done.map(handler => <li key={handler}><Link to={`/projects-progress/${projectId}/update?handler=${handler}`} onClick={onClose}>Review {handler}</Link></li>)}</ul></> : <form onSubmit={e => { e.preventDefault(); save() }}>
        <label>BOQ workbook<input type="file" accept=".xlsx" aria-label="Import progress workbook" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void choose(file); e.target.value = '' }}/></label>
        {busy && <p role="status">Reading workbook…</p>}
        {parsed && <>
          <p className="small">{name} · {changed.length} activities changed · {lowered.length} lowered · Overall after confirmation: {percent(parsed.overall)}</p>
          <p className="small muted">Uses handler-sheet Accumulation % and shared GR&P. WBS, weights, assignments and reporting history stay unchanged. Confirmed handlers must choose Edit in Update Progress before importing.</p>
          {!!changed.length && <label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}/>Replace affected drafts (including unsaved percentages)</label>}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable preview. */}
          {!!changed.length && <div className="table-scroll" role="region" aria-label="Imported percentage changes" tabIndex={0} style={{ maxHeight: '30vh', overflow: 'auto' }}><table className="task-table"><caption>Imported percentage changes</caption><thead><tr><th>WBS</th><th>Handler</th><th>Current</th><th>Workbook</th></tr></thead><tbody>{changed.map(a => <tr key={a.id}><td>{a.wbs}</td><td>{a.handler || 'Shared'}</td><td>{percent(a.progress)}</td><td>{percent(parsed.values.get(a.id)!)}</td></tr>)}</tbody></table></div>}
          {changed.some(a => a.wbs === 'GR&P') && <label>Shared GR&amp;P handler<GlassSelect aria-label="Shared GR&P handler" value={shared} onChange={e => setShared(e.target.value as Handler | '')}><option value="">Choose a handler</option>{handlers.map(h => <option key={h}>{h}</option>)}</GlassSelect></label>}
          {!!lowered.length && <label>Reason for lowered progress<textarea aria-label="Reason for lowered progress" required maxLength={4000} value={reason} onChange={e => setReason(e.target.value)}/></label>}
          {!changed.length && <p role="status">No progress percentages changed.</p>}
        </>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <footer><Dialog.Close type="button" className="btn-secondary" disabled={busy}>Cancel</Dialog.Close><button className="btn-accent" type="submit" disabled={busy || !parsed || !changed.length || !!lowered.length && !reason.trim() || changed.some(a => a.wbs === 'GR&P') && !shared}>Import drafts</button></footer>
      </form>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
