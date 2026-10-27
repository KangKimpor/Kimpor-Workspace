import './overview.css'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ProjectSummary } from '@/data'
import { calculate } from '../progress'
import { addDays, weekLabel, weekStart } from '../submissions'
import { percent } from '../format'
import { handlers } from '../types'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from '../types'
import { Breakdown } from './Breakdown'
import { HandlerTable } from './HandlerTable'
const Trend = lazy(() => import('../Trend'))

export default function Overview({ project, activities, submissions, summaries, baseline }: { project: ProjectSummary; activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[]; baseline: Map<string, number> }) {
  const [now, setNow] = useState(Date.now), [breakdown, setBreakdown] = useState(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const overall = useMemo(() => { try { return calculate(activities).overall } catch { return 0 } }, [activities])
  const current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }))
  const updated = handlers.filter((h) => submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed')).length
  const previous = summaries.find((s) => s.weekStart === addDays(current, -7))
  return <div className="nbc-overview">
    <p className="nbc-summary"><strong>{percent(overall)}</strong> overall · {updated} of 6 handlers updated this week · {weekLabel(current)}{previous && <span className="muted"> · last week {percent(previous.overall)}</span>}</p>
    <Suspense fallback={<p className="small muted">Loading trend…</p>}><Trend summaries={summaries}/></Suspense>
    <HandlerTable projectId={project.id} activities={activities} submissions={submissions} now={now}/>
    <button className="nbc-linkish nbc-breakdown-toggle" aria-expanded={breakdown} onClick={() => setBreakdown(!breakdown)}>Breakdown</button>
    {breakdown && <div className="nbc-breakdowns">{(['area', 'location', 'trade'] as const).map((field) => <Breakdown key={field} field={field} activities={activities} previous={baseline}/>)}</div>}
  </div>
}
