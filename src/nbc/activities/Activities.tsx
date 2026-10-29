import './activities.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { ChevronsDown, ChevronsUp, Columns3, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { pendingCollectionIds, syncWorkspace } from '@/data/sync'
import { MoreMenu } from '../ui/MoreMenu'
import { SidePeek } from '../ui/SidePeek'
import { WbsTable } from '../ui/WbsTable'
import { buildWbsRows } from '../wbs-table'
import { calculate, summarize } from '../progress'
import { updateActivity } from '../actions'
import { money, percent } from '../format'
import { handlers } from '../types'
import { activityHandlers } from '../handlers'
import type { NbcActivity } from '../types'
import { ActivityDetail } from './ActivityDetail'
import { Issues } from './Issues'
import { ReassignSheet } from './ReassignSheet'

const optionalColumns = ['Area', 'Trade', 'BOQ value', 'Schedule %', 'Status'] as const
const optionalValue = (a: NbcActivity, c: string) => c === 'Area' ? a.area : c === 'Trade' ? a.trade : c === 'BOQ value' ? a.boqValue === null ? '—' : money(a.boqValue) : c === 'Schedule %' ? a.schedule === null ? '—' : percent(a.schedule) : a.progress === 1 ? 'Done' : a.progress === 0 ? 'Not started' : 'In progress'

function HandlerPicker({ a, activities }: { a: NbcActivity; activities: NbcActivity[] }) {
  const label = activityHandlers(a, activities)
  if (!a.editable) return <span className="nbc-group-handlers" title={label}>{label}</span>
  return <GlassPopover label={`Assign ${a.wbs}`} trigger={<button className="nbc-handler-button" aria-label={`Assign handler for ${a.wbs}: ${label}`}>{label}</button>}>
    <GlassSelect aria-label={`Handler for ${a.wbs}`} value={a.handler} onChange={(e) => updateActivity(a.id, { handler: e.target.value })}>{a.wbs === 'GR&P' ? <option value="">Shared</option> : !a.handler && <option value="" disabled>Unassigned</option>}{[...new Set([...handlers, a.handler].filter(Boolean))].map((h) => <option key={h}>{h}</option>)}</GlassSelect>
  </GlassPopover>
}

function ActivityTable({ projectId, activities, baseline }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number> }) {
  const [params, setParams] = useSearchParams(), [query, setQuery] = useState(''), [range, setRange] = useState('all'), [changed, setChanged] = useState(false)
  const [optional, setOptional] = useState<string[]>([]), [detail, setDetail] = useState<string | null>(null), [reassign, setReassign] = useState(false)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => params.toString() ? new Set() : new Set(activities.filter((a) => !a.editable && a.parentId).map((a) => a.id)))
  const search = useRef<HTMLInputElement>(null)
  const sync = useWorkspace((s) => s.sync), tasks = useWorkspace((s) => s.tasks), pending = pendingCollectionIds('nbc_activities')
  const handler = params.get('handler') ?? '', area = params.get('area') ?? '', location = params.get('location') ?? '', trade = params.get('trade') ?? '', wbs = params.get('wbs') ?? ''
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities])
  const live = useMemo(() => calculate(activities), [activities]), before = useMemo(() => calculate(activities, baseline), [activities, baseline])
  useEffect(() => { if (params.toString()) setCollapsed(new Set()) }, [params])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,[contenteditable=true]'))) { e.preventDefault(); search.current?.focus() } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key)
  }, [])

  const q = query.trim().toLowerCase()
  // A search hit on a group brings its whole subtree.
  const textMatch = (a: NbcActivity) => { for (let n: NbcActivity | undefined = a; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (`${n.wbs} ${n.name} ${n.description}`.toLowerCase().includes(q)) return true; return false }
  const leaf = (a: NbcActivity) => {
    const p = live.progress.get(a.id)!, b = before.progress.get(a.id)!
    return (!q || textMatch(a)) && (!handler || (a.handler || 'Unassigned') === handler) && (!area || a.area === area) && (!location || a.location === location) && (!trade || a.trade === trade)
      && (!wbs || a.wbs === wbs || a.wbs.startsWith(`${wbs}.`)) && (!changed || Math.abs(p - b) > 1e-12) && (range === 'all' || (range === 'zero' ? p === 0 : range === 'done' ? p === 1 : p > 0 && p < 1))
  }
  const rows = buildWbsRows(activities, { leaf, collapsed })
  const distribution = summarize(activities.filter((a) => a.editable && leaf(a)))
  const active = !!(q || handler || area || location || trade || wbs || range !== 'all' || changed)
  function filter(key: string, value: string) { setCollapsed(new Set()); const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  function clear() { setParams({}); setQuery(''); setRange('all'); setChanged(false) }
  function toggle(id: string) { setCollapsed((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selected = activities.find((a) => a.id === detail)
  const chips = (['location', 'trade', 'wbs'] as const).flatMap((key) => params.get(key) ? [{ key, label: params.get(key)! }] : [])

  return <section className="nbc-activities">
    <div className="nbc-filters">
      <label className="search-field"><Search size={16}/><input ref={search} aria-label="Search activities" placeholder="Search WBS or activity" value={query} onChange={(e) => { setQuery(e.target.value); setCollapsed(new Set()) }}/><kbd>/</kbd></label>
      <GlassSelect aria-label="Assigned handler" value={handler} onChange={(e) => filter('handler', e.target.value)}><option value="">All handlers</option>{[...new Set([...handlers, ...activities.filter((a) => a.editable).map((a) => a.handler || 'Unassigned')])].map((h) => <option key={h}>{h}</option>)}</GlassSelect>
      <GlassSelect aria-label="Work area" value={area} onChange={(e) => filter('area', e.target.value)}><option value="">All areas</option>{[...new Set(activities.map((a) => a.area))].map((a) => <option key={a}>{a}</option>)}</GlassSelect>
      <GlassSelect aria-label="Progress range" value={range} onChange={(e) => setRange(e.target.value)}><option value="all">All progress</option><option value="zero">0% · Not started</option><option value="active">1–99% · In progress</option><option value="done">100% · Done</option></GlassSelect>
      <button className="nbc-chip" aria-pressed={changed} onClick={() => setChanged(!changed)}>Changed this week</button>
      {chips.map((c) => <button key={c.key} className="nbc-chip" aria-label={`Remove ${c.label} filter`} onClick={() => filter(c.key, '')}>{c.label}<X size={12}/></button>)}
      {active && <button className="text-link small" onClick={clear}>Clear all</button>}
      <span className="nbc-spacer"/>
      <GlassPopover label="Columns" trigger={<button className="ibtn" aria-label="Columns"><Columns3 size={16}/></button>}><div className="nbc-columns">{optionalColumns.map((c) => <label className="inline" key={c}><input type="checkbox" checked={optional.includes(c)} onChange={(e) => setOptional(e.target.checked ? [...optional, c] : optional.filter((v) => v !== c))}/>{c}</label>)}</div></GlassPopover>
      <button className="ibtn" title="Expand all" aria-label="Expand all" onClick={() => setCollapsed(new Set())}><ChevronsDown size={16}/></button>
      <button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={() => setCollapsed(new Set(activities.filter((a) => !a.editable).map((a) => a.id)))}><ChevronsUp size={16}/></button>
      <MoreMenu label="Activity tools"><button onClick={() => setReassign(true)}>Reassign group…</button></MoreMenu>
    </div>
    {sync.kind !== 'saved' && pending.size > 0 && <p className="small muted" role="status">{sync.kind === 'error' ? <>Save failed · <button className="text-link" onClick={() => void syncWorkspace(false)}>Retry</button></> : `Pending sync · ${pending.size}`}</p>}
    {rows.length === 0
      ? <div className="quiet-empty">No activities match these filters.<button className="text-link" onClick={clear}>Clear filters</button></div>
      : <WbsTable virtual rows={rows} caption="Activities by WBS" collapsed={collapsed} onToggle={toggle}
          previous={(a) => before.progress.get(a.id) ?? 0}
          current={(row) => percent(row.progress)}
          remark={({ activity: a }) => <span className="muted">{a.remark || '—'}</span>}
          onRowClick={({ activity: a }) => setDetail(a.id)}
          rowAttrs={({ activity: a }) => ({ 'data-changed': a.editable && Math.abs((live.progress.get(a.id) ?? 0) - (before.progress.get(a.id) ?? 0)) > 1e-12 ? 'true' : undefined })}
          nameSuffix={({ activity: a }) => { const open = tasks.filter((t) => t.nbcActivityId === a.id && !t.deletedAt && t.status !== 'Done'); return open.length ? <Link className="nbc-pill" data-status="Issue" to={`/projects-progress/${projectId}/issues?wbs=${encodeURIComponent(a.wbs)}`} aria-label={`${open.length} open issues for ${a.wbs}`}>{open.length} issue{open.length > 1 ? 's' : ''}</Link> : null }}
          extra={[{ header: 'Handler', cell: ({ activity: a }) => <><HandlerPicker a={a} activities={activities}/>{pending.has(a.id) && <span className="small muted"> · pending</span>}</> }, ...optional.map((c) => ({ header: c, cell: ({ activity: a }: { activity: NbcActivity }) => <span className="muted">{optionalValue(a, c)}</span> }))]}/>}
    <div className="nbc-table-footer"><span>{distribution.count} matching activities · WBS hierarchical rollup</span><span>Weighted completion: <strong>{percent(distribution.progress)}</strong></span></div>
    <SidePeek open={!!selected} onOpenChange={(open) => { if (!open) setDetail(null) }} title="Activity details">{selected && <ActivityDetail activity={selected} handler={activityHandlers(selected, activities)}/>}</SidePeek>
    <ReassignSheet activities={activities} open={reassign} onOpenChange={setReassign}/>
  </section>
}

export default function Activities({ projectId, activities, baseline, view }: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; view: 'activities' | 'issues' }) {
  const [expanded, setExpanded] = useState(false)
  const base = `/projects-progress/${projectId}`
  const switcher: ReactNode = <nav className="nbc-views" aria-label="Activity views"><NavLink className="nbc-view" end to={`${base}/activities`}>Table</NavLink><NavLink className="nbc-view" to={`${base}/issues`}>Issues</NavLink></nav>
  return <div className="nbc-activities-page" data-expanded={expanded && view === 'activities'}>
    {view === 'activities' ? <><div className="nbc-activity-band">{switcher}<button className="nbc-chip nbc-expand-editor" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}{expanded ? 'Collapse editor' : 'Expand editor'}</button></div><ActivityTable projectId={projectId} activities={activities} baseline={baseline}/></> : <Issues projectId={projectId} activities={activities} switcher={switcher}/>}
  </div>
}
