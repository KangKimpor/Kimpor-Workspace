import { useState } from 'react'
import type { NbcReport } from './types'
import { delta, percent, shortDate } from './format'
export default function Trend({ reports }: { reports: NbcReport[] }) {
  const [table,setTable] = useState(false)
  const sorted = reports.filter((r) => r.status === 'final').sort((a,b) => a.date.localeCompare(b.date))
  return <section className="nbc-panel nbc-trend"><div className="row-between"><h2>Weekly trend</h2><button className="text-link small" onClick={()=>setTable(!table)}>{table?'View chart':'View as table'}</button></div>
    {table ? <table className="task-table"><thead><tr><th>Week ending</th><th>Progress</th><th>Change</th></tr></thead><tbody>{sorted.map((r)=><tr key={r.id}><td>{shortDate(r.date)}</td><td>{percent(r.overall)}</td><td>{delta(r.overall-r.previous)} pp</td></tr>)}</tbody></table> : <>
      <svg viewBox="0 0 640 160" role="img" aria-label={sorted.length?sorted.map((r)=>`${r.date}: ${percent(r.overall)}, change ${delta(r.overall-r.previous)} percentage points`).join('; '):'No finalized reporting weeks'}>
        {[0,0.5,1].map((n)=><g key={n}><line x1="40" x2="624" y1={136-n*112} y2={136-n*112} stroke="var(--border-subtle)"/><text x="0" y={140-n*112} fill="var(--text-secondary)" fontSize="12">{n*100}%</text></g>)}
        {sorted.length>1 && <polyline fill="none" stroke="var(--accent-text)" strokeWidth="2" points={sorted.map((r,i)=>`${48+i*560/Math.max(1,sorted.length-1)},${136-r.overall*112}`).join(' ')}/>}
        {(sorted.length?sorted:[null]).map((r,i)=><circle key={r?.id??'empty'} cx={sorted.length>1?48+i*560/(sorted.length-1):328} cy={136-(r?.overall??0)*112} r="4" fill={r?'var(--accent-text)':'var(--text-secondary)'}><title>{r?`${shortDate(r.date)} · ${percent(r.overall)} · ${delta(r.overall-r.previous)} pp`:'No dated snapshots'}</title></circle>)}
      </svg>
      {sorted.length<2?<p className="small muted">Trend appears after the second finalized week.</p>:<div className="row-between small muted"><span>{shortDate(sorted[0]!.date)}</span><span>{shortDate(sorted.at(-1)!.date)}</span></div>}
    </>}
  </section>
}
