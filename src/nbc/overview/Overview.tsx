import './overview.css'
import { useEffect, useMemo, useState } from 'react'
import type { ProjectSummary } from '@/data'
import { calculate } from '../progress'
import { addDays, weekLabel, weekStart } from '../submissions'
import { percent } from '../format'
import { daysBetween, daysToCompletion, projectPlan, planDate, plannedProgress } from '../plan'
import { handlers } from '../types'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from '../types'
import { deadlineNote } from '../update/deadline'
import Trend from '../Trend'
import { Attention } from './Attention'
import { Breakdown, Heatmap } from './Breakdown'
import type { BreakdownField } from './Breakdown'
import { Digest } from './Digest'
import { HandlerTable } from './HandlerTable'
import { attentionItems, forecastDate, weeklyPace } from './insights'

const GROUPS = [['location', 'Floor'], ['area', 'Work area'], ['trade', 'Trade'], ['heatmap', 'Heatmap']] as const
const pts = (n: number) => `${Math.abs(n * 100).toFixed(1)} pts`

export default function Overview({ project, activities, submissions, summaries, baseline }: { project: ProjectSummary; activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[]; baseline: Map<string, number> }) {
  const [now, setNow] = useState(Date.now), [breakdown, setBreakdown] = useState(true), [digest, setDigest] = useState(false)
  const [group, setGroup] = useState<BreakdownField | 'heatmap'>('location')
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const overall = useMemo(() => { try { return calculate(activities).overall } catch { return 0 } }, [activities])
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }), current = weekStart(today)
  const owners = handlers
  const updated = owners.filter((h) => submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed'))
  const thisWeek = summaries.find((s) => s.weekStart === current), lastWeek = summaries.find((s) => s.weekStart === addDays(current, -7))
  const plan = projectPlan(project.id)
  const planned = plan ? plannedProgress(today, plan.points) : null, gap = planned === null ? null : overall - planned, days = plan ? daysToCompletion(today, plan.completion) : null
  const pace = weeklyPace(summaries), finish = forecastDate(overall, pace, today), deadline = deadlineNote(current, now)
  const attention = attentionItems({ projectId: project.id, activities, submissions, today, now })
  const forecast = !plan ? 'No contract completion date is loaded for this project, so there is no deadline forecast.' : finish
    ? `At the current pace of ${(pace! * 100).toFixed(1)}% a week, progress reaches 100% around ${planDate(finish)}, ${Math.abs(Math.round(daysBetween(plan.completion, finish) / 7))} weeks ${finish > plan.completion ? 'after' : 'before'} the deadline.`
    : pace === null ? 'The forecast appears after the first confirmed week.' : 'There was no forward progress in the recent weeks, so there is no forecast yet.'
  const digestLines = [
    planned === null || gap === null ? `Overall progress ${percent(overall, 1)}. No planned curve is loaded for this project.` : `Overall progress ${percent(overall, 1)}, ${percent(Math.abs(gap), 1)} ${gap < 0 ? 'behind' : 'ahead of'} the plan (${percent(planned, 1)} planned by now).`,
    plan && days !== null ? `Completion deadline ${planDate(plan.completion)}: ${days < 0 ? `${-days} days overdue` : `${days} days left`}.` : 'Completion deadline: not provided.',
    forecast,
    `${updated.length} of ${owners.length} handlers updated this week${updated.length < owners.length ? `. Outstanding: ${owners.filter((h) => !updated.includes(h)).join(', ')}` : ''}.`,
    ...attention.map((i) => `Attention: ${i.title} (${i.detail}).`),
  ]

  return <div className="nbc-overview">
    <header className="nbc-ov-head"><div><h2>Overview</h2><p className="small muted">{weekLabel(current)}</p></div><button className="btn-secondary" onClick={() => setDigest(true)}>Weekly digest</button></header>
    <section className="nbc-kpis" aria-label="Project snapshot">
      <div className="nbc-kpi"><span className="nbc-kpi-label">Overall progress</span><strong className="nbc-kpi-value">{percent(overall, 1)}</strong><span className="small muted">{thisWeek ? `${thisWeek.overall >= thisWeek.previous ? '+' : '−'}${pts(thisWeek.overall - thisWeek.previous)} this week` : lastWeek ? `Last week ${percent(lastWeek.overall, 1)}` : 'No confirmed week yet'}</span></div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Versus plan</span>{gap === null || planned === null ? <><strong className="nbc-kpi-value">No plan</strong><span className="small muted">No planned curve supplied</span></> : <><strong className="nbc-kpi-value" data-tone={gap < -0.04 ? 'bad' : gap < -0.01 ? 'warn' : 'ok'}>{percent(Math.abs(gap), 1)} {gap < 0 ? 'behind' : 'ahead'}</strong><span className="small muted">Plan: {percent(planned, 1)} by now</span></>}</div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Completion deadline</span>{plan && days !== null ? <><strong className="nbc-kpi-value">{planDate(plan.completion)}</strong><span className="small" data-tone={days < 0 ? 'bad' : undefined}>{days < 0 ? `${-days} days overdue` : days === 0 ? 'Due today' : `${days} days left`}</span></> : <><strong className="nbc-kpi-value">Not set</strong><span className="small muted">No contract dates supplied</span></>}</div>
      <div className="nbc-kpi"><span className="nbc-kpi-label">Weekly reporting</span><strong className="nbc-kpi-value" data-tone={deadline.late && updated.length < owners.length ? 'bad' : undefined}>{deadline.late ? 'Deadline passed' : deadline.text.split(' · ')[1]}</strong><span className="small muted">{updated.length} of {owners.length} handlers updated this week</span></div>
    </section>
    <p className="nbc-forecast small" role="status"><span className="nbc-pill">Forecast</span>{forecast}</p>
    <Attention items={attention}/>
    <Trend summaries={summaries} today={today} plan={plan}/>
    <div className="nbc-progress-panels"><HandlerTable projectId={project.id} activities={activities} submissions={submissions} now={now}/>
    <section className="nbc-execution"><div className="row-between"><div><h2>Completion breakdown</h2><p className="small muted">Furthest behind first. Select a row to open its activities.</p></div><div className="nbc-seg" role="group" aria-label="Breakdown grouping">{GROUPS.map(([key, label]) => <button key={key} aria-pressed={group === key} onClick={() => { setGroup(key); setBreakdown(true) }}>{label}</button>)}</div></div>
      {breakdown && <div className="nbc-breakdowns">{group === 'heatmap' ? <Heatmap activities={activities}/> : <Breakdown field={group} activities={activities} previous={baseline}/>}</div>}
      <button className="nbc-linkish nbc-breakdown-toggle" aria-expanded={breakdown} onClick={() => setBreakdown(!breakdown)}>{breakdown ? 'Hide breakdown' : 'Show breakdown'}</button>
    </section></div>
    {digest && <Digest title={`${project.name} · ${weekLabel(current)}`} lines={digestLines} onClose={() => setDigest(false)}/>}
  </div>
}
