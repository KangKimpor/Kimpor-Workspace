import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronsDown, ChevronsUp, CircleAlert, CloudUpload, LoaderCircle, Search } from 'lucide-react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { MoreMenu } from '../ui/MoreMenu'
import { WbsTable } from '../ui/WbsTable'
import { buildWbsRows } from '../wbs-table'
import { calculate } from '../progress'
import { canUpdate, weekLabel } from '../submissions'
import { confirmationTime, percent } from '../format'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { ConfirmSheet } from './ConfirmSheet'
import { useUpdateDraft } from './useUpdateDraft'

type Filter = 'need' | 'chg' | 'all'
const FILTERS: [Filter, string][] = [['need', 'Needs update'], ['chg', 'Changed'], ['all', 'All']]
const STATUS_TEXT = { saving: 'Saving draft…', error: 'Draft kept on this device · sync failed', local: 'Draft saved on this device · will sync', saved: 'Draft saved' } as const
const points = (n: number) => `${n > 0 ? '+' : '−'}${Number((Math.abs(n) * 100).toFixed(2))}`
const brief = (text: string) => text.length > 22 ? `${text.slice(0, 22)}…` : text

function DeleteUpdate({ onDelete, busy }: { onDelete: () => void; busy: boolean }) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <button className="danger-text" onClick={() => setArmed(true)}>Delete update</button>
  return <div className="nbc-delete"><strong>Delete this update?</strong><p className="small muted">Your activities go back to last week’s values. Newer confirmed updates stay applied.</p><div className="inline"><button className="btn-secondary" disabled={busy} onClick={() => setArmed(false)}>Cancel</button><button className="btn-accent" disabled={busy} onClick={onDelete}>Delete</button></div></div>
}

interface Props { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission; pastDeadline: boolean }

export function UpdateEditor({ projectId, week, handler, activities, submission, pastDeadline }: Props) {
  const draft = useUpdateDraft({ projectId, week, handler, activities, submission })
  const { confirmed, busy } = draft
  const StatusIcon = draft.status === 'saving' ? LoaderCircle : draft.status === 'error' ? CircleAlert : draft.status === 'local' ? CloudUpload : CheckCircle2
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set()), [filter, setFilter] = useState<Filter>(confirmed ? 'chg' : 'need')
  const [focusId, setFocusId] = useState(''), [sheet, setSheet] = useState(false), [tried, setTried] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState<ReadonlySet<string>>(new Set()), [jump, setJump] = useState<{ id: string; kind: 'value' | 'remark' } | null>(null)
  const [query, setQuery] = useState(''), [area, setArea] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const values = useRef(new Map<string, HTMLInputElement>()), remarks = useRef(new Map<string, HTMLInputElement>()), beforeFocus = useRef('')
  const byId = new Map(activities.map((a) => [a.id, a])), shownById = new Map(draft.shown.map((e) => [e.activityId, e]))
  const changedIds = new Set(draft.changed.map((e) => e.activityId))
  const problems = new Set([...draft.invalid, ...draft.needsRemark])
  const q = query.trim().toLowerCase()
  const textMatch = (a: NbcActivity) => { for (let n: NbcActivity | undefined = a; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (`${n.wbs} ${n.name} ${n.description}`.toLowerCase().includes(q)) return true; return false }
  const areas = [...new Set(activities.filter((a) => canUpdate(a, handler)).map((a) => a.area).filter(Boolean))]

  const visible = (a: NbcActivity) => {
    const e = shownById.get(a.id)
    if (!e) return false
    if (q && !textMatch(a)) return false
    if (area && a.area !== area) return false
    if (filter === 'all') return true
    const flagged = problems.has(a.id) || focusId === a.id
    if (filter === 'chg') return changedIds.has(a.id) || flagged
    return !(e.previous === 1 && e.progress === 1) || flagged || draft.touched.has(a.id)
  }
  const forced = new Set<string>()
  for (const id of problems) { let parent = byId.get(id)?.parentId; while (parent) { forced.add(parent); parent = byId.get(parent)?.parentId } }
  const openGroups = new Set([...collapsed].filter((id) => !forced.has(id)))
  const progressOf = new Map(draft.shown.map((e) => [e.activityId, e.progress]))
  const rows = buildWbsRows(activities, { leaf: (a) => canUpdate(a, handler) && visible(a), collapsed: openGroups, values: progressOf })
  const previous = calculate(activities, new Map(draft.shown.map((e) => [e.activityId, e.previous]))).progress
  const leaves = rows.filter((r) => !r.group)
  const counts: Record<Filter, number> = { need: draft.shown.filter((e) => e.previous < 1).length, chg: draft.changed.length, all: draft.shown.length }

  useEffect(() => {
    if (!jump) return
    const el = (jump.kind === 'remark' ? remarks : values).current.get(jump.id)
    if (el) { el.focus(); el.scrollIntoView?.({ block: 'center' }) }
    setJump(null)
  }, [jump])

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,[contenteditable=true]'))) { e.preventDefault(); search.current?.focus() } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key)
  }, [])

  function toggle(id: string) { setCollapsed((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function expandAll() { setCollapsed(new Set()) }
  function collapseAll() { setCollapsed(new Set(activities.filter((a) => !canUpdate(a, handler)).map((a) => a.id))) }
  function toggleRemark(id: string) { setRemarkOpen((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function advance(id: string) { const i = leaves.findIndex((r) => r.activity.id === id); const target = values.current.get(leaves[i + 1]?.activity.id ?? ''); if (target) target.focus(); else values.current.get(id)?.blur() }
  function focusFirstProblem() {
    const id = draft.rows.find((e) => problems.has(e.activityId))?.activityId
    if (id) setJump({ id, kind: draft.invalid.has(id) ? 'value' : 'remark' })
  }
  function start() { setTried(true); if (problems.size) focusFirstProblem(); else setSheet(true) }

  const sheetItems = draft.changed.map((e) => ({ id: e.activityId, wbs: byId.get(e.activityId)?.wbs ?? e.activityId, name: byId.get(e.activityId)?.name ?? '', previous: e.previous, progress: e.progress, remark: e.remark }))
  const emptyText = filter === 'chg' ? confirmed ? 'No changes in this update.' : 'No changes yet. Type a new percentage on a row in Needs update or All.' : filter === 'need' ? 'Nothing needs an update — everything assigned to you is complete.' : 'No activities to update.'

  return <>
    <div className="nbc-filters" role="group" aria-label="Show activities">
      <label className="search-field"><Search size={16}/><input ref={search} aria-label="Search activities" placeholder="Search WBS or activity" value={query} onChange={(e) => { setQuery(e.target.value); setCollapsed(new Set()) }}/><kbd>/</kbd></label>
      {areas.length > 1 && <GlassSelect aria-label="Work area" value={area} onChange={(e) => setArea(e.target.value)}><option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}</GlassSelect>}
      <div className="nbc-seg">{FILTERS.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span className="nbc-count">{counts[key]}</span></button>)}</div>
      <span className="nbc-spacer"/>
      <button className="ibtn" title="Expand all" aria-label="Expand all" onClick={expandAll}><ChevronsDown size={16}/></button>
      <button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={collapseAll}><ChevronsUp size={16}/></button>
    </div>
    {draft.error && !sheet && <p className="form-error" role="alert">{draft.error}{draft.error.includes('GR&P changed') && <button className="text-link" onClick={draft.reloadShared}>Reload shared GR&amp;P</button>}</p>}
    {rows.length === 0
      ? <div className="nbc-update-empty"><p>{emptyText}</p>{filter !== 'all' && <button className="btn-secondary" onClick={() => setFilter('all')}>Show all activities</button>}</div>
      : <WbsTable virtual={false} rows={rows} caption={`${handler} activities · ${weekLabel(week)}. GR&P is shared by all handlers.`} collapsed={openGroups} onToggle={toggle}
          previous={(a) => previous.get(a.id) ?? a.progress}
          rowAttrs={(row) => ({ 'data-activity-id': row.activity.id, 'data-changed': changedIds.has(row.activity.id) ? 'true' : undefined, 'data-problem': problems.has(row.activity.id) ? 'true' : undefined })}
          current={({ activity: a }) => {
            const e = shownById.get(a.id), diff = e ? e.progress - e.previous : 0
            const chip = Math.abs(diff) > 1e-12 ? <span className="nbc-delta" data-dir={diff > 0 ? 'up' : 'down'}>{points(diff)}</span> : null
            if (confirmed) return <span className="nbc-cell">{chip}{percent(e?.progress ?? a.progress)}</span>
            return <div className="nbc-cell">{chip}
              <input ref={(el) => { if (el) values.current.set(a.id, el); else values.current.delete(a.id) }} disabled={busy} aria-label={`This week % for ${a.wbs}`} aria-invalid={draft.invalid.has(a.id) || undefined} inputMode="decimal" value={draft.text(a.id)}
                onFocus={(event) => { beforeFocus.current = event.target.value; setFocusId(a.id) }} onBlur={() => setFocusId((old) => old === a.id ? '' : old)}
                onChange={(event) => draft.setText(a.id, event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') draft.setText(a.id, beforeFocus.current); if (event.key === 'Enter') advance(a.id) }}/><span className="nbc-unit" aria-hidden="true">%</span>
              {tried && draft.invalid.has(a.id) && <span className="nbc-hint">Enter 0 to 100</span>}
            </div>
          }}
          remark={({ activity: a }) => {
            if (confirmed) return <span>{shownById.get(a.id)?.remark || '—'}</span>
            const value = draft.remark(a.id), required = draft.needsRemark.has(a.id), open = remarkOpen.has(a.id) || required
            return <div className="nbc-remark-cell">
              <button className="nbc-remark-btn" data-filled={!!value.trim()} aria-expanded={open} aria-label={`${value.trim() ? 'Edit' : 'Add'} remark for ${a.wbs}`} onClick={() => toggleRemark(a.id)}>{value.trim() ? brief(value) : '+ Remark'}</button>
              {open && <input ref={(el) => { if (el) remarks.current.set(a.id, el); else remarks.current.delete(a.id) }} className="nbc-remark" disabled={busy} aria-label={`Remark for ${a.wbs}`} placeholder="Add remark…" maxLength={4000} value={value} onChange={(event) => draft.setRemark(a.id, event.target.value)}/>}
              {required && <span className="nbc-hint" data-tone="warn">Progress went down. A remark is required.</span>}
            </div>
          }}/>}
    {confirmed && submission?.note && <p className="nbc-note small">{submission.note}</p>}
    <div className="nbc-update-bar" role="group" aria-label="Update actions">{confirmed
      ? <><span role="status" className="nbc-status" data-status="saved"><CheckCircle2 size={18} aria-hidden="true" />Confirmed {confirmationTime(submission!.confirmedAt!)} · {draft.changed.length} changed</span>
          <span className="nbc-spacer"/><button className="btn-accent" disabled={busy} onClick={() => void draft.edit()}>Edit</button><MoreMenu label="Update actions"><DeleteUpdate busy={busy} onDelete={() => void draft.remove()}/></MoreMenu></>
      : <><span role="status" className="nbc-status" data-status={draft.status}><StatusIcon size={18} aria-hidden="true" />{STATUS_TEXT[draft.status]}</span>
          <div className="nbc-update-metrics"><span>{draft.changed.length} changed</span><span className="nbc-contribution" data-dir={draft.contribution < 0 ? 'down' : 'up'}>{draft.contribution > 0 ? '+' : ''}{(draft.contribution * 100).toFixed(2)}% <span>overall</span></span></div>
          {tried && problems.size > 0 && <span className="nbc-problems">{problems.size} to fix · <button className="text-link" onClick={focusFirstProblem}>Jump to first</button></span>}
          <span className="nbc-spacer"/>
          <button className="btn-accent" disabled={busy} aria-haspopup="dialog" onClick={start}><CheckCircle2 size={15} aria-hidden="true"/>{draft.changed.length ? 'Confirm update' : 'Confirm, no changes'}</button></>}</div>
    {sheet && !confirmed && <ConfirmSheet handler={handler} weekText={weekLabel(week)} late={pastDeadline} items={sheetItems} lowered={draft.lowered.length} contribution={draft.contribution}
      note={draft.note} onNote={draft.setNote} error={draft.error} busy={busy} onCancel={() => setSheet(false)} onConfirm={() => void draft.confirm()}/>}
  </>
}
