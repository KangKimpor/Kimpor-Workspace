import './update.css'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { MoreMenu } from '../ui/MoreMenu'
import { WbsTable } from '../ui/WbsTable'
import { buildWbsRows } from '../wbs-table'
import { calculate } from '../progress'
import { rememberedHandler, rememberHandler } from '../drafts'
import { addDays, canUpdate, submissionId, weekLabel, weekStart } from '../submissions'
import { confirmationTime, delta, percent } from '../format'
import { handlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { formatPercent, useUpdateDraft } from './useUpdateDraft'

const STATUS_TEXT = { saving: 'Saving draft…', error: 'Draft kept on this device · cloud save failed', local: 'Draft saved on this device · pending sync', saved: 'Draft saved' } as const

function DeleteUpdate({ onDelete, busy }: { onDelete: () => void; busy: boolean }) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <button className="danger-text" onClick={() => setArmed(true)}>Delete update</button>
  return <div className="nbc-delete"><strong>Delete this update?</strong><p className="small muted">Your activities go back to last week’s values. Newer confirmed updates stay applied.</p><div className="inline"><button className="btn-secondary" disabled={busy} onClick={() => setArmed(false)}>Cancel</button><button className="btn-accent" disabled={busy} onClick={onDelete}>Delete</button></div></div>
}

function Editor({ projectId, week, handler, activities, submission }: { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission }) {
  const draft = useUpdateDraft({ projectId, week, handler, activities, submission })
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set()), [hide, setHide] = useState(true), [focusId, setFocusId] = useState(''), [noteOpen, setNoteOpen] = useState(false)
  const inputs = useRef(new Map<string, HTMLInputElement>()), beforeFocus = useRef('')
  const byId = new Map(activities.map((a) => [a.id, a])), shownById = new Map(draft.shown.map((e) => [e.activityId, e]))
  const { confirmed, busy } = draft

  const hidden = (a: NbcActivity) => { const e = shownById.get(a.id); return hide && !!e && e.previous === 1 && e.progress === 1 && !draft.touched.has(a.id) && focusId !== a.id }
  const forced = new Set<string>()
  for (const id of draft.invalid) { let parent = byId.get(id)?.parentId; while (parent) { forced.add(parent); parent = byId.get(parent)?.parentId } }
  const openGroups = new Set([...collapsed].filter((id) => !forced.has(id)))
  const values = new Map(draft.shown.map((e) => [e.activityId, e.progress]))
  const rows = buildWbsRows(activities, { leaf: (a) => canUpdate(a, handler) && !hidden(a), collapsed: openGroups, values })
  const previous = calculate(activities, new Map(draft.shown.map((e) => [e.activityId, e.previous]))).progress
  const leaves = rows.filter((r) => !r.group)

  function toggle(id: string) { setCollapsed((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function advance(id: string) { const i = leaves.findIndex((r) => r.activity.id === id); const target = inputs.current.get(leaves[i + 1]?.activity.id ?? ''); if (target) target.focus(); else inputs.current.get(id)?.blur() }

  return <>
    {rows.length === 0
      ? <div className="nbc-update-empty"><p>No activities to update{hide ? ' — everything assigned to you is complete.' : '.'}</p>{hide && <button className="btn-secondary" onClick={() => setHide(false)}>Show completed activities</button>}</div>
      : <WbsTable virtual={false} rows={rows} caption={`${handler} activities · ${weekLabel(week)}. GR&P is shared by all handlers.`} collapsed={openGroups} onToggle={toggle}
          previous={(a) => previous.get(a.id) ?? a.progress}
          rowAttrs={(row) => { const e = shownById.get(row.activity.id); return { 'data-activity-id': row.activity.id, 'data-changed': e && Math.abs(e.progress - e.previous) > 1e-12 ? 'true' : undefined } }}
          current={({ activity: a }) => confirmed
            ? <span>{percent(shownById.get(a.id)?.progress ?? a.progress)}</span>
            : <div className="nbc-cell">
                <input ref={(el) => { if (el) inputs.current.set(a.id, el); else inputs.current.delete(a.id) }} disabled={busy} aria-label={`This week % for ${a.wbs}`} aria-invalid={draft.invalid.has(a.id) || undefined} inputMode="decimal" value={draft.text(a.id)}
                  onFocus={(event) => { beforeFocus.current = event.target.value; setFocusId(a.id) }} onBlur={() => setFocusId((old) => old === a.id ? '' : old)}
                  onChange={(event) => draft.setText(a.id, event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Escape') draft.setText(a.id, beforeFocus.current); if (event.key === 'Enter') advance(a.id) }}/>
                {focusId === a.id && <span className="nbc-quick">{[25, 50, 75, 100].map((n) => <button key={n} tabIndex={-1} aria-label={`Set ${a.wbs} to ${n}%`} onMouseDown={(event) => event.preventDefault()} onClick={() => draft.setText(a.id, formatPercent(n / 100))}>{n}</button>)}</span>}
              </div>}
          remark={({ activity: a }) => confirmed ? <span>{shownById.get(a.id)?.remark || '—'}</span> : <input className="nbc-remark" disabled={busy} aria-label={`Remark for ${a.wbs}`} placeholder="Add remark…" maxLength={4000} value={draft.remark(a.id)} onChange={(event) => draft.setRemark(a.id, event.target.value)}/>}/>}
    {noteOpen && !confirmed && <label className="nbc-note">Weekly note<textarea autoFocus maxLength={4000} rows={2} value={draft.note} onChange={(event) => draft.setNote(event.target.value)}/></label>}
    {confirmed && submission?.note && <p className="nbc-note small">{submission.note}</p>}
    {draft.error && <p className="form-error" role="alert">{draft.error}{draft.error.includes('GR&P changed') && <button className="text-link" onClick={draft.reloadShared}>Reload shared GR&amp;P</button>}</p>}
    <div className="nbc-update-bar" role="group" aria-label="Update actions">{confirmed
      ? <><span role="status">Confirmed {confirmationTime(submission!.confirmedAt!)} · {draft.changed.length} changed</span>{submission!.late && <span className="nbc-pill" data-status="Updated late">Late</span>}
          <span className="nbc-spacer"/><button className="btn-accent" disabled={busy} onClick={() => void draft.edit()}>Edit</button><MoreMenu label="Update actions"><DeleteUpdate busy={busy} onDelete={() => void draft.remove()}/></MoreMenu></>
      : <><strong>{draft.changed.length} changed · {delta(draft.contribution)}%</strong><span className="small muted" role="status">{STATUS_TEXT[draft.status]}</span>
          <button className="text-link nbc-hide" onClick={() => setHide(!hide)}>{hide ? 'Show completed' : 'Hide completed'}</button>
          <span className="nbc-spacer"/><button className="btn-secondary" aria-expanded={noteOpen} onClick={() => setNoteOpen(!noteOpen)}>{draft.note ? 'Edit note' : 'Add note'}</button>
          <button className="btn-accent" disabled={busy} onClick={() => void draft.confirm()}>{busy ? 'Confirming…' : draft.changed.length ? 'Confirm update' : 'Confirm, no changes'}</button></>}</div>
  </>
}

export default function UpdateProgress({ projectId, activities, submissions }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }) {
  const [params, setParams] = useSearchParams(), scope = useWorkspace((s) => s.scope)
  const [handler, setHandler] = useState<Handler>(() => handlers.find((h) => h === params.get('handler')) ?? rememberedHandler(projectId))
  const current = weekStart(), last = addDays(current, -7), [chosen, setChosen] = useState(() => params.get('week') === last ? last : current)
  const lastUpdate = submissions.find((s) => s.id === submissionId(projectId, last, handler))
  const week = chosen === last && lastUpdate ? last : current
  const selected = submissions.find((s) => s.id === submissionId(projectId, week, handler))
  function choose(value: Handler) { rememberHandler(projectId, value); setHandler(value); const next = new URLSearchParams(params); next.set('handler', value); setParams(next, { replace: true }) }
  return <section className="nbc-update" aria-label="Weekly progress update">
    <header className="nbc-update-head">
      <div><h2>Update Progress</h2><p className="small muted">{weekLabel(week)} · Due Sunday, end of day · Phnom Penh</p></div>
      <div className="nbc-update-controls">
        <GlassSelect aria-label="Your handler" value={handler} onChange={(e) => choose(e.target.value as Handler)}>{handlers.map((h) => <option key={h}>{h}</option>)}</GlassSelect>
        <div className="nbc-seg" role="group" aria-label="Week">
          <button aria-pressed={week === current} onClick={() => setChosen(current)}>This week</button>
          <button aria-pressed={week === last} disabled={!lastUpdate} title={lastUpdate ? undefined : 'No update to edit'} onClick={() => setChosen(last)}>Last week</button>
        </div>
      </div>
    </header>
    <Editor key={`${scope}:${week}:${handler}:${selected?.status ?? 'new'}`} projectId={projectId} week={week} handler={handler} activities={activities} submission={selected}/>
  </section>
}
