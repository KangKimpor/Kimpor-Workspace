import * as Dialog from '@radix-ui/react-dialog'
import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { db } from '@/data/persistence'
import { useWorkspaceUI } from '@/shell/workspace'
import { addDays, weekLabel, weekStart } from '../submissions'
import { handlers } from '../types'
import type { NbcActivity, NbcSubmission } from '../types'
import { confirmedCount, MAX_TEMPLATE_BYTES, weeklyWorkbook, XLSX_TYPE } from './workbook'

export default function ExportWorkbook({ projectId, activities, submissions, onClose }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; onClose: () => void }) {
  const scope = useWorkspace(s => s.scope), current = weekStart()
  const key = `nbc-report-template:${scope}:${projectId}`
  const [week, setWeek] = useState(current), [template, setTemplate] = useState<{ data: ArrayBuffer; name: string } | null>(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const weeks = [...new Set([current, addDays(current, -7), ...submissions.filter(s => s.confirmedAt && s.weekStart <= current).map(s => s.weekStart)])].sort().reverse()
  const confirmed = confirmedCount(activities, submissions, week)
  useEffect(() => {
    let active = true
    void db.reportTemplates.get(key).then(file => { if (active && file) setTemplate(file) }).catch(() => { if (active) setError('Could not read the saved template. Choose the workbook again.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [key])
  async function choose(file: File) {
    setBusy(true); setError('')
    try {
      if (file.size > MAX_TEMPLATE_BYTES) throw new Error('Choose an XLSX template up to 10 MB.')
      const data = await file.arrayBuffer()
      weeklyWorkbook(new Uint8Array(data), activities, submissions, week)
      setTemplate({ data, name: file.name })
      try { await db.reportTemplates.put({ id: key, data, name: file.name }) }
      catch { setError('The template could not be remembered on this device. You can still export; select it again next time.') }
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  function download() {
    if (!template || busy) return
    setBusy(true); setError('')
    try {
      const result = weeklyWorkbook(new Uint8Array(template.data), activities, submissions, week)
      const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: XLSX_TYPE }))
      const link = document.createElement('a'); link.href = url; link.download = `NBC-BP03-${week}${result.confirmed < handlers.length ? '-partial' : ''}.xlsx`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      useWorkspaceUI.getState().notify('Weekly Excel report exported')
      onClose()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <Dialog.Root open onOpenChange={open => !open && !busy && onClose()}><Dialog.Portal>
    <Dialog.Overlay className="scrim"/>
    <Dialog.Content className="event-editor project-editor glass" data-material="thick">
      <div className="row-between"><Dialog.Title className="t-h3">Weekly client report</Dialog.Title><Dialog.Close disabled={busy} className="ibtn" aria-label="Close export"><X size={18}/></Dialog.Close></div>
      <Dialog.Description className="small muted">Export the Progress sheet and all six handler sheets in your workbook’s existing format.</Dialog.Description>
      <form onSubmit={event => { event.preventDefault(); void download() }}>
        <label htmlFor="export-week">Reporting week<GlassSelect id="export-week" aria-label="Reporting week" disabled={busy} value={week} onChange={event => setWeek(event.target.value)}>{weeks.map(value => <option key={value} value={value}>{weekLabel(value)} {value.slice(0, 4)}{value === current ? ' · This week' : ''}</option>)}</GlassSelect></label>
        <p className="small" role="status">{confirmed} of {handlers.length} handlers confirmed. {confirmed < handlers.length ? 'The export will be marked partial.' : 'All handlers have confirmed this week.'} Unconfirmed draft edits are excluded.</p>
        <label>Excel template<input type="file" accept=".xlsx" aria-label="Weekly report template" disabled={busy || loading} onChange={event => { const file = event.target.files?.[0]; if (file) void choose(file); event.target.value = '' }}/></label>
        {template && <p className="small muted">Saved template: {template.name}</p>}
        <p className="small muted">Choose your NBC BOQ workbook once. The template stays on this device for future exports and is not uploaded.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><Dialog.Close type="button" disabled={busy} className="btn-secondary">Cancel</Dialog.Close><button className="btn-accent" type="submit" disabled={!template || busy || loading}><Download size={15} aria-hidden="true"/>{busy ? 'Preparing…' : 'Export XLSX'}</button></footer>
      </form>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}
