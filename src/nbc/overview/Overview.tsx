import './overview.css'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Clock3 } from 'lucide-react'
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
  const [now, setNow] = useState(Date.now), [breakdown, setBreakdown] = useState(true)
  const [field, setField] = useState<'location' | 'area' | 'trade'>('location')
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const overall = useMemo(() => { try { return calculate(activities).overall } catch { return 0 } }, [activities])
  const current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }))
  const updated = handlers.filter((h) => submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed')).length
  const previous = summaries.find((s) => s.weekStart === addDays(current, -7))
  return <div className="nbc-overview">
    <section className="nbc-snapshot" aria-label="Current target snapshot">
      <span className="nbc-eyebrow">Current target snapshot</span>
      <div className="nbc-summary"><strong>{percent(overall)}</strong><span>overall</span></div>
      <div className="row-between nbc-snapshot-meta"><p><span>{updated} of 6 handlers updated this week</span> · {weekLabel(current)}{previous && <span className="muted"> · last week {percent(previous.overall)}</span>}</p><span className="nbc-pill"><Clock3 size={13} aria-hidden="true"/>{updated === handlers.length ? 'Weekly log complete' : 'Awaiting weekly log'}</span></div>
      <progress className="nbc-overall-progress" max={1} value={overall} aria-label="Overall project progress"/>
      <div className="nbc-progress-scale"><span>0.00% Baseline</span><strong>{percent(overall)} Current</strong><span>100.00% Completion</span></div>
    </section>
    <Suspense fallback={<p className="small muted">Loading trend…</p>}><Trend summaries={summaries}/></Suspense>
    <HandlerTable projectId={project.id} activities={activities} submissions={submissions} now={now}/>
    <section className="nbc-execution"><div className="row-between"><div><h2>Execution Breakdown</h2><p className="small muted">Inspect progress by work area, floor and trade.</p></div><div className="nbc-seg" role="group" aria-label="Breakdown grouping">{([['location', 'Floor Breakdown'], ['area', 'Work Area'], ['trade', 'Trade']] as const).map(([key, label]) => <button key={key} aria-pressed={field === key} onClick={() => { setField(key); setBreakdown(true) }}>{label}</button>)}</div></div>
      {breakdown && <div className="nbc-breakdowns"><Breakdown field={field} activities={activities} previous={baseline}/></div>}
      <button className="nbc-linkish nbc-breakdown-toggle" aria-expanded={breakdown} onClick={() => setBreakdown(!breakdown)}>{breakdown ? 'Hide breakdown' : 'Show breakdown'}</button>
    </section>
  </div>
}
