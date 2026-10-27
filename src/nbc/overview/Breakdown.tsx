import { Link } from 'react-router-dom'
import { summarize } from '../progress'
import { percent } from '../format'
import type { NbcActivity } from '../types'

type Field = 'area' | 'location' | 'trade'
const TITLES: Record<Field, string> = { area: 'Work area', location: 'Floor / location', trade: 'Trade' }

/** Progress grouped by one activity attribute; each row opens the filtered Activities tab. */
export function Breakdown({ field, activities, previous }: { field: Field; activities: NbcActivity[]; previous: Map<string, number> }) {
  const groups = new Map<string, NbcActivity[]>()
  for (const a of activities) if (a.editable) { const key = a[field] || 'Unassigned'; groups.set(key, [...(groups.get(key) ?? []), a]) }
  const rows = [...groups].map(([name, list]) => ({ name, ...summarize(list, previous) }))
  return <section className="nbc-breakdown" aria-label={TITLES[field]}>
    <h3>{TITLES[field]}</h3>
    <ul>{rows.map((r) => <li key={r.name}><Link to={`/projects-progress/${activities[0]?.projectId}/activities?${field}=${encodeURIComponent(r.name)}`}><span className="nbc-breakdown-name">{r.name}</span><progress max={1} value={r.progress} aria-label={`${r.name} progress`}/><span className="nbc-num">{percent(r.progress)}</span></Link></li>)}</ul>
  </section>
}
