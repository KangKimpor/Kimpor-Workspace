import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { MoreMenu } from '../ui/MoreMenu'
import { StatusPill } from '../ui/StatusPill'
import { reopenUpdate } from '../actions'
import { summarize } from '../progress'
import { addDays, changedEntries, submissionStatus, weekLabel, weekStart } from '../submissions'
import { delta, exportSubmission, percent } from '../format'
import { handlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { SubmissionPeek } from './SubmissionPeek'

export function HandlerTable({ projectId, activities, submissions, now }: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; now: number }) {
  const navigate = useNavigate(), current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' })), last = addDays(current, -7)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set()), [older, setOlder] = useState<ReadonlySet<string>>(new Set())
  const [peek, setPeek] = useState<NbcSubmission | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const flip = (set: ReadonlySet<string>, key: string) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next }
  const find = (handler: Handler, week: string) => submissions.find((s) => s.handler === handler && s.weekStart === week)
  const weighted = (s: NbcSubmission) => s.entries.reduce((sum, e) => sum + (e.progress - e.previous) * (activities.find((a) => a.id === e.activityId)?.globalWeight ?? 0), 0)

  async function edit(s: NbcSubmission) {
    setBusy(true)
    try {
      if (s.status === 'confirmed') await reopenUpdate(s.weekStart, s.handler)
      navigate(`/projects-progress/${projectId}/update?handler=${s.handler}${s.weekStart === last ? `&week=${s.weekStart}` : ''}`)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  function weekRow(handler: Handler, week: string, label: string) {
    const s = find(handler, week), editable = week === current || week === last
    return <li className="nbc-week-row" key={week}>
      <strong>{label}</strong><span className="small muted">{weekLabel(week)}</span>
      {s || week === current ? <StatusPill status={submissionStatus(s, week, activities, now)} time={s?.confirmedAt}/> : <span className="small muted">Missing</span>}
      <span className="small">{s ? `${changedEntries(s.entries).length} changed · ${delta(weighted(s))}%` : ''}</span>
      {s && <MoreMenu label={`Actions for ${handler} ${label}`}>
        <button onClick={() => setPeek(s)}>Open</button>
        {editable && <button disabled={busy} onClick={() => void edit(s)}>Edit</button>}
        <button onClick={() => exportSubmission(s, activities)}>Export CSV</button>
      </MoreMenu>}
    </li>
  }
  return <section className="nbc-handler-panel" aria-label="Handler updates">
    <header className="nbc-section-heading"><h2><Users size={17} aria-hidden="true"/>Handlers Overview</h2><span className="small muted">{handlers.length} Assignees</span></header>
    <div className="table-scroll">
    <table className="nbc-handlers"><caption className="sr-only">Handler updates · due Sunday, end of day · Phnom Penh</caption>
      <thead><tr><th scope="col">Handler</th><th scope="col">This week</th><th scope="col">Last week</th><th scope="col" className="nbc-num">Changed</th><th scope="col" className="nbc-num">Contribution</th></tr></thead>
      <tbody>{handlers.flatMap((handler) => {
        const now_ = find(handler, current), prev = find(handler, last), expanded = open.has(handler)
        const contribution = summarize(activities.filter((a) => a.handler === handler)).contribution
        const cell = (s: NbcSubmission | undefined, week: string, missing: string) => s || week === current
          ? <StatusPill status={submissionStatus(s, week, activities, now)} time={s?.confirmedAt}/> : <span className="small muted">{missing}</span>
        const rows = [<tr key={handler}>
          <td><div className="nbc-handler-name"><button className="nbc-toggle" aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${handler}`} onClick={() => setOpen(flip(open, handler))}>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button><span className="nbc-handler-avatar" data-handler={handler} aria-hidden="true">{handler[0]}</span><span>{handler}</span></div></td>
          <td><Link to={`/projects-progress/${projectId}/update?handler=${handler}`}><span className="sr-only">{handler} this week update · </span>{cell(now_, current, 'Missing')}</Link></td>
          <td>{prev ? <button className="nbc-linkish" onClick={() => setPeek(prev)}><span className="sr-only">{handler} last week update · </span>{cell(prev, last, 'Missing')}</button> : <span className="small muted">Missing</span>}</td>
          <td className="nbc-num">{now_ ? changedEntries(now_.entries).length : '—'}</td>
          <td className="nbc-num"><div className="nbc-contribution"><span>{percent(contribution)}</span><progress max={1} value={contribution} aria-label={`${handler} contribution`}/></div></td></tr>]
        if (expanded) rows.push(<tr key={`${handler}-weeks`} className="nbc-weeks"><td colSpan={5}><ul>
          {weekRow(handler, current, 'This week')}{weekRow(handler, last, 'Last week')}
          <li><button className="nbc-linkish" aria-expanded={older.has(handler)} onClick={() => setOlder(flip(older, handler))}>Older weeks</button>
            {older.has(handler) && <ul>{submissions.filter((s) => s.handler === handler && s.weekStart < last).sort((a, b) => b.weekStart.localeCompare(a.weekStart)).map((s) => weekRow(handler, s.weekStart, weekLabel(s.weekStart)))}</ul>}</li>
        </ul></td></tr>)
        return rows
      })}</tbody></table></div>
    <footer className="nbc-handler-footer"><span>Weighted contribution from assigned activities</span><span>Sum total: <strong>{percent(summarize(activities).contribution)}</strong></span></footer>
    {error && <p className="form-error" role="alert">{error}</p>}
    <SubmissionPeek submission={peek} activities={activities} now={now} onClose={() => setPeek(null)}/>
  </section>
}
