import { useId, useState } from 'react'
import type { NbcWeekSummary } from './types'
import { delta, percent } from './format'
import { weekLabel } from './submissions'
export default function Trend({ summaries }: { summaries: NbcWeekSummary[] }) {
  const [table, setTable] = useState(false), sorted = [...summaries].sort((a,b) => a.weekStart.localeCompare(b.weekStart)), gradient = useId()
  const x = (i: number) => sorted.length > 1 ? i * 880 / (sorted.length - 1) : 440
  const points = sorted.map((s, i) => `${x(i)},${196 - s.overall * 176}`).join(' ')
  return <section className="nbc-panel nbc-trend">
    <div className="row-between"><div><h2>Weekly trend</h2><p className="small muted">Cumulative progress · confirmed reporting weeks</p></div><button className="text-link small" onClick={() => setTable(!table)}>{table ? 'View chart' : 'View as table'}</button></div>
    {table ? <div className="table-scroll"><table className="task-table"><thead><tr><th>Week</th><th>Progress</th><th>Change</th></tr></thead><tbody>{sorted.map((s) => <tr key={s.id}><td>{weekLabel(s.weekStart)}</td><td>{percent(s.overall)}</td><td>{delta(s.overall-s.previous)}%</td></tr>)}</tbody></table></div> : <>
      <svg viewBox="0 0 920 220" role="img" aria-label={sorted.length ? sorted.map((s) => `${weekLabel(s.weekStart)}: ${percent(s.overall)}`).join('; ') : 'No confirmed reporting weeks'}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
        {[0,.25,.5,.75,1].map((n) => <g key={n}><line x1="0" x2="880" y1={196-n*176} y2={196-n*176} stroke="var(--border-strong)" strokeOpacity=".5" strokeDasharray="3 4"/><text x="920" y={200-n*176} textAnchor="end" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">{n*100}%</text></g>)}
        {sorted.length > 1 && <><polygon fill={`url(#${gradient})`} points={`0,196 ${points} 880,196`}/><polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points}/></>}
        {sorted.map((s,i) => <circle key={s.id} cx={x(i)} cy={196-s.overall*176} r={i === sorted.length - 1 ? 5 : 3} fill="var(--bg-canvas)" stroke="var(--accent)" strokeWidth="2.5"><title>{weekLabel(s.weekStart)} · {percent(s.overall)} · {delta(s.overall-s.previous)}%</title></circle>)}
      </svg>
      <div className="nbc-trend-labels">{sorted.filter((_, i) => i === 0 || i === sorted.length - 1).map((s) => <span key={s.id}>{weekLabel(s.weekStart)} · {percent(s.overall)}</span>)}</div>
      {sorted.length < 2 && <p className="small muted">Trend appears after the second confirmed week.</p>}
    </>}
  </section>
}
