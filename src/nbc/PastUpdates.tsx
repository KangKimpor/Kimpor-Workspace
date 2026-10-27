import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { reopenUpdate } from './actions'
import WeeklyProgress, { confirmationTime, DeleteUpdate } from './WeeklyProgress'
import { StatusChip } from './WeeklyHandlers'
import { addDays, changedEntries, submissionStatus, weekLabel, weekStart } from './submissions'
import { delta, exportSubmission, percent } from './format'
import { handlers } from './types'
import type { Handler, NbcActivity, NbcSubmission } from './types'

export default function PastUpdates({ projectId, activities, submissions }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }) {
  const [params, setParams] = useSearchParams(), navigate = useNavigate(), current = weekStart(), last = addDays(current, -7)
  const [filter, setFilter] = useState(() => params.get('handler') ?? localStorage.getItem(`kw-nbc-past-filter:${projectId}`) ?? 'All')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const selected = submissions.find((s) => s.handler === params.get('handler') && s.weekStart === params.get('week'))
  if (params.get('edit') === '1' && selected && selected.weekStart >= last) return <><button className="text-link small" onClick={() => setParams({ handler: selected.handler })}>Back to Past Updates</button><WeeklyProgress key={selected.id} projectId={projectId} activities={activities} submissions={submissions} editingWeek={selected.weekStart}/></>
  async function edit(s: NbcSubmission) {
    setBusy(true)
    try {
      if (s.status === 'confirmed') await reopenUpdate(s.weekStart, s.handler)
      if (s.weekStart === current) navigate(`/projects-progress/${projectId}/update?handler=${s.handler}`)
      else setParams({ handler: s.handler, week: s.weekStart, edit: '1' })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function row(handler: Handler, week: string, older = false) {
    const s = submissions.find((s) => s.handler === handler && s.weekStart === week), entries = s?.entries ?? [], changed = changedEntries(entries)
    const contribution = entries.reduce((sum, e) => sum + (e.progress - e.previous) * (activities.find((a) => a.id === e.activityId)?.globalWeight ?? 0), 0)
    return <div className="nbc-past-row" key={week}><div><strong>{week === current ? 'This week' : week === last ? 'Last week' : 'Week'}</strong><span className="small muted">{weekLabel(week)}</span></div><StatusChip status={submissionStatus(s, week, activities)} time={s?.confirmedAt}/><span className="small">{changed.length} changed · {delta(contribution)}%</span><GlassPopover label={`${handler} ${week} actions`} trigger={<button className="ibtn" aria-label={`Actions for ${handler} ${week}`}><MoreHorizontal size={16}/></button>}><div className="nbc-menu"><button onClick={() => setParams({ handler, week, open: '1' })}>Open</button>{s && <button onClick={() => exportSubmission(s, activities)}>Export</button>}{!older && s && <><button disabled={busy} onClick={() => void edit(s)}>Edit</button><DeleteUpdate submission={s} onDeleted={() => setParams({ handler })}/></>}</div></GlassPopover></div>
  }
  return <section className="nbc-past-page"><header><h2>Past Updates</h2><p className="small muted">This week and last week can be edited. Older weeks are read-only.</p></header><div className="nbc-past-filters" aria-label="Filter past updates by handler">{['All', ...handlers].map((h) => <button className="btn-secondary" key={h} aria-pressed={filter === h} onClick={() => { setFilter(h); localStorage.setItem(`kw-nbc-past-filter:${projectId}`, h) }}>{h}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}{params.get('open') === '1' && <section className="nbc-panel nbc-open-submission"><div className="row-between"><h3>{params.get('handler')} · {weekLabel(params.get('week') ?? current)}</h3><button className="btn-secondary" onClick={() => setParams({ handler: params.get('handler') ?? 'All' })}>Close update</button></div>{selected ? <><p className="small muted">{selected.confirmedAt ? `Confirmed ${confirmationTime(selected.confirmedAt)}` : 'Draft'} · Read only</p><div className="table-scroll"><table className="task-table"><thead><tr><th>Activity</th><th>Previous %</th><th>Progress %</th><th>Change</th><th>Remark</th></tr></thead><tbody>{selected.entries.map((e) => <tr key={e.activityId}><td>{activities.find((a) => a.id === e.activityId)?.name ?? e.activityId}</td><td>{percent(e.previous)}</td><td>{percent(e.progress)}</td><td>{delta(e.progress - e.previous)}%</td><td>{e.remark}</td></tr>)}</tbody></table></div>{selected.note && <p>{selected.note}</p>}</> : <p>No update recorded for this handler and week.</p>}</section>}{handlers.filter((h) => filter === 'All' || filter === h).map((h) => <details className="nbc-panel nbc-past-handler" key={h} open><summary><strong>{h}</strong></summary>{row(h, current)}{row(h, last)}<details className="nbc-older-weeks"><summary>Older weeks</summary>{submissions.filter((s) => s.handler === h && s.weekStart < last).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((s) => row(h, s.weekStart, true))}{!submissions.some((s) => s.handler === h && s.weekStart < last) && <p className="small muted">No older updates.</p>}</details></details>)}</section>
}
