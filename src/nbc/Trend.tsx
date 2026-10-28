import { useState } from 'react'
import type { NbcWeekSummary } from './types'
import { delta, percent } from './format'
import { addDays, weekLabel } from './submissions'
import { daysBetween, NBC_PLAN, planDate, plannedProgress } from './plan'

const W = 880, TOP = 14, BASE = 196, H = BASE - TOP
const month = (date: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** Cumulative progress by week against the contract plan. Actual points come only from confirmed app updates. */
export default function Trend({ summaries, today }: { summaries: NbcWeekSummary[]; today?: string }) {
  const [table, setTable] = useState(false), sorted = [...summaries].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const start = NBC_PLAN.commencement, last = sorted.length ? addDays(sorted.at(-1)!.weekStart, 6) : start
  const end = addDays([NBC_PLAN.completion, last, today ?? start].sort().at(-1)!, 14), span = daysBetween(start, end)
  const x = (date: string) => W * daysBetween(start, date) / span, y = (value: number) => BASE - value * H
  const planned = NBC_PLAN.points.map(([d, v]) => `${x(d)},${y(v)}`).join(' ')
  const actual = sorted.map((s) => ({ s, cx: x(addDays(s.weekStart, 6)), cy: y(s.overall) }))
  const ticks: string[] = []
  for (let d = `${start.slice(0, 7)}-01`; d <= end; d = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1)).toISOString().slice(0, 10)) if (d > start) ticks.push(d)
  return <section className="nbc-panel nbc-trend">
    <div className="row-between"><div><h2>Progress curve</h2><p className="small muted">Planned against actual · actual counts confirmed reporting weeks</p></div>
      <div className="nbc-trend-tools"><span className="nbc-legend"><i data-line="actual"/>Actual<i data-line="plan"/>Planned</span><button className="text-link small" onClick={() => setTable(!table)}>{table ? 'View chart' : 'View as table'}</button></div></div>
    {table ? <div className="table-scroll"><table className="task-table"><thead><tr><th>Week</th><th>Planned</th><th>Actual</th><th>Change</th></tr></thead><tbody>{sorted.map((s) => <tr key={s.id}><td>{weekLabel(s.weekStart)}</td><td>{percent(plannedProgress(addDays(s.weekStart, 6)))}</td><td>{percent(s.overall)}</td><td>{delta(s.overall - s.previous)}%</td></tr>)}</tbody></table></div> : <>
      <svg viewBox="0 0 920 220" role="img" aria-label={`Planned progress reaches 100% on ${planDate(NBC_PLAN.completion)}. ${sorted.length ? sorted.map((s) => `${weekLabel(s.weekStart)}: ${percent(s.overall)}`).join('; ') : 'No confirmed reporting weeks'}`}>
        {[0, .25, .5, .75, 1].map((n) => <g key={n}><line x1="0" x2={W} y1={y(n)} y2={y(n)} stroke="var(--border-strong)" strokeOpacity=".5" strokeDasharray="3 4"/><text x="920" y={y(n) + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">{n * 100}%</text></g>)}
        {ticks.map((d) => <text key={d} x={x(d)} y="214" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">{month(d)}</text>)}
        <line x1={x(NBC_PLAN.completion)} x2={x(NBC_PLAN.completion)} y1={TOP} y2={BASE} stroke="var(--danger-text)" strokeOpacity=".5" strokeDasharray="2 4"/>
        <text x={x(NBC_PLAN.completion) + 6} y={TOP + 10} textAnchor="start" fill="var(--danger-text)" fontSize="11">Deadline {planDate(NBC_PLAN.completion)}</text>
        {today && <><line x1={x(today)} x2={x(today)} y1={TOP} y2={BASE} stroke="var(--border-strong)"/><text x={x(today) - 6} y={BASE - 6} textAnchor="end" fill="var(--text-secondary)" fontSize="11">Today</text></>}
        <polyline data-series="plan" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" points={planned}/>
        {actual.length > 1 && <polyline data-series="actual" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={actual.map((p) => `${p.cx},${p.cy}`).join(' ')}/>}
        {actual.map((p, i) => <circle key={p.s.id} cx={p.cx} cy={p.cy} r={i === actual.length - 1 ? 5 : 3.5} fill="var(--bg-canvas)" stroke="var(--accent)" strokeWidth="2.5"><title>{weekLabel(p.s.weekStart)} · actual {percent(p.s.overall)} · planned {percent(plannedProgress(addDays(p.s.weekStart, 6)))} · {delta(p.s.overall - p.s.previous)}%</title></circle>)}
      </svg>
      {sorted.length < 2 && <p className="small muted">The actual line appears after the second confirmed week.</p>}
    </>}
  </section>
}
