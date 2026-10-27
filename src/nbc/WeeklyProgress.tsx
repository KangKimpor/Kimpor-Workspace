import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, MoreHorizontal, Plus, Minus } from 'lucide-react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { useWorkspace } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { confirmUpdate, deleteUpdate, reopenUpdate, saveDraft } from './actions'
import { draftEntries } from './submission-actions'
import { clearHandlerDraft, readHandlerDraft, rememberedHandler, rememberHandler, writeHandlerDraft } from './drafts'
import type { HandlerDraft } from './drafts'
import { addDays, changedEntries, submissionId, weekLabel, weekStart } from './submissions'
import { parseProgress } from './progress'
import { delta, percent } from './format'
import { handlers } from './types'
import type { Handler, NbcActivity, NbcSubmission, SubmissionEntry } from './types'

export const confirmationTime = (date: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date))

export function DeleteUpdate({ submission, onDeleted }: { submission: NbcSubmission; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  return <GlassPopover label="Delete this update?" open={open} onOpenChange={setOpen} trigger={<button className="text-link danger-text">Delete update</button>}><div className="nbc-delete-popover"><strong>Delete this update?</strong><p className="small muted">Your activities go back to last week’s values. Newer confirmed updates stay applied.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="inline"><button className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="btn-accent" disabled={busy} onClick={async () => { setBusy(true); try { await deleteUpdate(submission.weekStart, submission.handler); clearHandlerDraft(useWorkspace.getState().scope, submission.projectId, submission.weekStart, submission.handler); setOpen(false); onDeleted?.(); useWorkspaceUI.getState().notify('Update deleted. Activity values restored.') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }}>Delete</button></div></div></GlassPopover>
}

export default function WeeklyProgress({ projectId, activities, submissions, editingWeek }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; editingWeek?: string }) {
  const [params, setParams] = useSearchParams(), scope = useWorkspace((s) => s.scope)
  const [handler, setHandler] = useState<Handler>(() => handlers.find((h) => h === params.get('handler')) ?? rememberedHandler(projectId))
  const week = editingWeek ?? weekStart()
  const selected = submissions.find((s) => s.id === submissionId(projectId, week, handler))
  function choose(value: Handler) { rememberHandler(projectId, value); setHandler(value); const next = new URLSearchParams(params); next.set('handler', value); setParams(next, { replace: true }) }
  return <section className="nbc-submission-page" aria-label="Weekly progress update"><header className="nbc-submission-heading"><div><h2>Update Progress</h2><div className="inline"><strong>{weekLabel(week)}</strong><span className="pill">{week === weekStart() ? 'This week' : 'Last week'}</span><span className="small muted">Due Sunday, end of day · Phnom Penh</span></div></div><label className="nbc-field">Handler<GlassSelect aria-label="Your handler" value={handler} onChange={(e) => choose(e.target.value as Handler)}>{handlers.map((h) => <option key={h}>{h}</option>)}</GlassSelect></label></header><UpdateEditor key={`${scope}:${week}:${handler}:${selected?.status ?? 'new'}`} projectId={projectId} week={week} handler={handler} activities={activities} submission={selected}/></section>
}

function UpdateEditor({ projectId, week, handler, activities, submission }: { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission }) {
  const scope = useWorkspace((s) => s.scope), sync = useWorkspace((s) => s.sync)
  const [initial] = useState(() => draftEntries(week, handler))
  const [form, setForm] = useState<HandlerDraft>(() => (submission?.status !== 'confirmed' && readHandlerDraft(scope, projectId, week, handler)) || { values: Object.fromEntries(initial.map((e) => [e.activityId, { text: String(Number((e.progress * 100).toFixed(8))), remark: e.remark, baseRevision: e.baseRevision }])), note: submission?.note ?? '' })
  const [dirty, setDirty] = useState(() => !!readHandlerDraft(scope, projectId, week, handler)), [error, setError] = useState(''), [busy, setBusy] = useState(false), [noteOpen, setNoteOpen] = useState(false), [menu, setMenu] = useState(false), [collapsed, setCollapsed] = useState(new Set<string>())
  const beforeFocus = useRef(''), confirmed = submission?.status === 'confirmed'
  const rows = draftEntries(week, handler), byId = new Map(activities.map((a) => [a.id, a]))
  function parse(formValue = form): SubmissionEntry[] {
    return rows.map((entry) => {
      const value = formValue.values[entry.activityId], parsed = parseProgress(value?.text ?? String(entry.progress * 100))
      if (parsed.message) throw new Error(parsed.message)
      return { ...entry, progress: parsed.progress, remark: value?.remark ?? entry.remark, baseRevision: value?.baseRevision ?? entry.baseRevision }
    })
  }
  const parsed = (() => { try { return parse() } catch { return rows } })()
  const shown = confirmed ? submission.entries : parsed, changed = changedEntries(shown)
  const shownById = new Map(shown.map((e) => [e.activityId, e]))
  const contribution = shown.reduce((sum, e) => sum + (e.progress - e.previous) * (byId.get(e.activityId)?.globalWeight ?? 0), 0)
  function change(next: HandlerDraft) {
    setForm(next); setDirty(true)
    try { writeHandlerDraft(scope, projectId, week, handler, next); setError('') } catch { setError('Could not autosave on this device. Keep this page open.') }
  }
  function field(id: string, patch: Partial<HandlerDraft['values'][string]>) {
    const entry = rows.find((e) => e.activityId === id)!
    change({ ...form, values: { ...form.values, [id]: { text: String(entry.progress * 100), remark: entry.remark, baseRevision: entry.baseRevision, ...form.values[id], ...patch } } })
  }
  function persist() { saveDraft(week, handler, parse(), form.note); setDirty(false) }
  useEffect(() => {
    if (!dirty || confirmed || busy) return
    const timer = setTimeout(() => { try { persist(); setError('') } catch (e) { setError((e as Error).message) } }, 400)
    return () => clearTimeout(timer)
    // Raw keystrokes are journaled synchronously. Server acknowledgements do not restart the timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, confirmed, busy])
  async function confirm() {
    setBusy(true)
    try {
      persist(); const result = await confirmUpdate(week, handler)
      clearHandlerDraft(scope, projectId, week, handler); setError('')
      useWorkspaceUI.getState().notify('Update confirmed', () => { void result.undo().catch((e) => useWorkspaceUI.getState().notify((e as Error).message)) })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function edit() { setBusy(true); try { await reopenUpdate(week, handler); setError('') } catch (e) { setError((e as Error).message) } finally { setBusy(false); setMenu(false) } }
  const groups = new Map<string, SubmissionEntry[]>()
  for (const e of (confirmed ? submission.entries : rows)) {
    const a = byId.get(e.activityId); if (!a) continue
    let root = a; while (root.parentId && byId.has(root.parentId)) root = byId.get(root.parentId)!
    const key = root.name, list = groups.get(key) ?? []; list.push(e); groups.set(key, list)
  }
  return <>
    {confirmed && <div className="nbc-banner nbc-confirmed-banner" role="status"><Check size={16}/><strong>Confirmed {confirmationTime(submission.confirmedAt!)} · {changed.length} activities changed</strong>{submission.late && <span className="pill">Late</span>}</div>}
    {!confirmed && week === addDays(weekStart(), -7) && <p className="nbc-banner nbc-warning">Last week wasn’t updated. You can still confirm it.</p>}
    <div className="nbc-submission-scroll"><table className="nbc-submission-table"><caption className="sr-only">{handler} activities · {weekLabel(week)}. GR&amp;P is shared by all handlers.</caption><thead><tr><th>Activity</th><th>Previous %</th><th>This week %</th><th>Change</th><th>Remark</th></tr></thead><tbody>{[...groups].flatMap(([group, list]) => {
      const average = list.reduce((sum, e) => sum + (shownById.get(e.activityId)?.progress ?? e.progress), 0) / list.length
      return [<tr key={group} className="nbc-submission-group"><th colSpan={5}><button aria-expanded={!collapsed.has(group)} onClick={() => setCollapsed((old) => { const next = new Set(old); if (next.has(group)) next.delete(group); else next.add(group); return next })}>{collapsed.has(group) ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}<span>{group}</span><span className="small muted">Average {percent(average)}</span></button></th></tr>, ...(!collapsed.has(group) ? list.map((entry) => {
        const a = byId.get(entry.activityId)!, e = shownById.get(a.id) ?? entry, value = form.values[a.id]
        return <tr key={a.id} data-activity-id={a.id} data-changed={Math.abs(e.progress - e.previous) > 1e-12}><td><span className="nbc-wbs">{a.wbs}</span><span>{a.name}</span>{a.wbs === 'GR&P' && <span className="pill">Shared</span>}</td><td className="nbc-numeric">{percent(e.previous)}</td><td>{confirmed ? <span className="nbc-numeric">{percent(e.progress)}</span> : <div className="nbc-submission-number"><button className="ibtn" aria-label={`Decrease ${a.wbs}`} disabled={busy} onClick={() => field(a.id, { text: String(Math.max(0, e.progress * 100 - 1)) })}><Minus size={12}/></button><input disabled={busy} aria-label={`This week % for ${a.wbs}`} inputMode="decimal" value={value?.text ?? String(entry.progress * 100)} onFocus={(event) => { beforeFocus.current = event.target.value }} onChange={(event) => field(a.id, { text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') field(a.id, { text: beforeFocus.current }); if (event.key === 'Enter') event.currentTarget.blur() }}/><button className="ibtn" aria-label={`Increase ${a.wbs}`} disabled={busy} onClick={() => field(a.id, { text: String(Math.min(100, e.progress * 100 + 1)) })}><Plus size={12}/></button><select aria-label={`Quick set ${a.wbs}`} value="" disabled={busy} onChange={(event) => field(a.id, { text: event.target.value })}><option value="">%</option>{[0,25,50,75,100].map((n) => <option key={n} value={n}>{n}%</option>)}</select></div>}</td><td className="nbc-numeric nbc-delta" data-sign={Math.sign(e.progress - e.previous)}>{delta(e.progress - e.previous)}%</td><td>{confirmed ? e.remark || '—' : <input disabled={busy} aria-label={`Remark for ${a.wbs}`} placeholder="Add remark…" maxLength={4000} value={value?.remark ?? entry.remark} onChange={(event) => field(a.id, { remark: event.target.value })}/>}</td></tr>
      }) : [])]
    })}</tbody></table></div>
    {noteOpen && !confirmed && <label className="nbc-inline-note">Weekly note<textarea autoFocus maxLength={4000} rows={2} value={form.note} onChange={(event) => change({ ...form, note: event.target.value })}/></label>}
    {confirmed && submission.note && <p className="nbc-submission-note small">{submission.note}</p>}
    {error && <p className="form-error" role="alert">{error}{error.includes('GR&P changed') && <button className="text-link" onClick={() => { const shared = activities.find((a) => a.wbs === 'GR&P')!; field(shared.id, { text: String(shared.progress * 100), remark: shared.remark, baseRevision: shared.updatedAt }); setError('') }}>Reload shared GR&amp;P</button>}</p>}
    <footer className="nbc-submission-bar">{confirmed ? <><span className="small muted">{handler} · {weekLabel(week)}</span><div className="inline"><button className="btn-accent" disabled={busy} onClick={() => void edit()}>Edit</button><GlassPopover label="Update actions" open={menu} onOpenChange={setMenu} trigger={<button className="ibtn" aria-label="Update actions"><MoreHorizontal size={18}/></button>}><DeleteUpdate submission={submission}/></GlassPopover></div></> : <><div className="nbc-submission-summary"><strong>{changed.length} changed · {delta(contribution)}%</strong><span className="small muted" role="status">{dirty ? 'Saving draft…' : sync.kind === 'error' ? 'Draft kept on this device · cloud save failed' : scope !== 'guest' && sync.kind !== 'saved' ? 'Draft saved on this device · pending sync' : 'Draft saved'}</span></div><div className="inline"><button className="btn-secondary" aria-expanded={noteOpen} onClick={() => setNoteOpen(!noteOpen)}>{form.note ? 'Edit note' : 'Add note'}</button><button className="btn-accent" disabled={busy} onClick={() => void confirm()}>{busy ? 'Confirming…' : changed.length ? 'Confirm update' : 'Confirm, no changes'}</button></div></>}</footer>
  </>
}
