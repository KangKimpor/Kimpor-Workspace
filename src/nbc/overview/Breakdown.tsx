import { Link } from 'react-router-dom'
import { summarize } from '../progress'
import { percent } from '../format'
import type { NbcActivity } from '../types'

export type BreakdownField = 'area' | 'location' | 'trade'
const TITLES: Record<BreakdownField, string> = { area: 'Work area', location: 'Floor / location', trade: 'Trade' }
const link = (projectId: string | undefined, params: Record<string, string>) => `/projects-progress/${projectId}/activities?${new URLSearchParams(params)}`

/** Progress grouped by one activity attribute, furthest behind first. Each row opens the filtered Progress tab. */
export function Breakdown({ field, activities, previous }: { field: BreakdownField; activities: NbcActivity[]; previous: Map<string, number> }) {
  const groups = new Map<string, NbcActivity[]>()
  for (const a of activities) if (a.editable) { const key = a[field] || 'Unassigned'; groups.set(key, [...(groups.get(key) ?? []), a]) }
  const rows = [...groups].map(([name, list]) => ({ name, ...summarize(list, previous) })).sort((a, b) => a.progress - b.progress || a.name.localeCompare(b.name))
  return <section className="nbc-breakdown" aria-label={TITLES[field]}>
    <h3>{TITLES[field]}</h3>
    <ul>{rows.map((r) => <li key={r.name}><Link to={link(activities[0]?.projectId, { [field]: r.name })}><span className="nbc-breakdown-name">{r.name}</span><progress max={1} value={r.progress} aria-label={`${r.name} progress`}/><span className="nbc-num">{percent(r.progress)}</span></Link></li>)}</ul>
  </section>
}

/** Floor by trade grid of percent complete, so a lagging trade on one floor stands out. */
export function Heatmap({ activities }: { activities: NbcActivity[] }) {
  const leaves = activities.filter((a) => a.editable && a.wbs !== 'GR&P')
  const floors = [...new Set(leaves.map((a) => a.location || 'Unassigned'))].sort(), trades = [...new Set(leaves.map((a) => a.trade || 'Unassigned'))].sort()
  const cell = (floor: string, trade: string) => { const list = leaves.filter((a) => (a.location || 'Unassigned') === floor && (a.trade || 'Unassigned') === trade); return list.length ? summarize(list).progress : null }
  return <section className="nbc-heatmap" aria-label="Floor by trade heatmap">
    <div className="nbc-heat-grid" style={{ gridTemplateColumns: `minmax(5rem, auto) repeat(${trades.length}, minmax(4.5rem, 1fr))` }}>
      <span/>{trades.map((t) => <span key={t} className="nbc-heat-head">{t}</span>)}
      {floors.flatMap((f) => [<span key={f} className="nbc-heat-head nbc-heat-row">{f}</span>, ...trades.map((t) => {
        const value = cell(f, t)
        return value === null ? <span key={`${f}:${t}`} className="nbc-heat-cell" data-empty="true">–</span>
          : <Link key={`${f}:${t}`} className="nbc-heat-cell" style={{ ['--heat' as string]: `${Math.round(value * 100)}%` }} to={link(leaves[0]?.projectId, { location: f, trade: t })} aria-label={`${f}, ${t}: ${percent(value, 0)}`}>{percent(value, 0)}</Link>
      })])}
    </div>
    <p className="small muted">Percent complete. Darker means further along. Select a cell to open its activities.</p>
  </section>
}
