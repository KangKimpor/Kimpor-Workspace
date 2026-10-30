import './nbc.css'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import type { ProjectSummary } from '@/data'
import { useWorkspace } from '@/data'
import { Tile } from '@/components/WorkspaceUI'
import { supabase } from '@/lib/supabase'
import { syncWorkspace } from '@/data/sync'
import { calculate } from './progress'
import Overview from './overview/Overview'
import Activities from './activities/Activities'
import UpdateProgress from './update/UpdateProgress'
import { appliedEntries, weekLabel, weekStart } from './submissions'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from './types'

const EMPTY_ACTIVITIES: NbcActivity[] = [], EMPTY_SUBMISSIONS: NbcSubmission[] = [], EMPTY_SUMMARIES: NbcWeekSummary[] = []
const views = [['overview', 'Overview'], ['activities', 'Project Progress'], ['update', 'Update Progress']] as const
const ExportWorkbook = lazy(() => import('./export/ExportWorkbook'))
/** Earlier URLs keep working: Past Updates now lives inside Overview. */
const aliases: Record<string, string> = { boq: 'activities', progress: 'activities', weekly: 'update', handlers: 'overview', past: 'overview', board: 'issues' }

export default function NbcProject({ project, view }: { project: ProjectSummary; view: string }) {
  const scope = useWorkspace((s) => s.scope), [now, setNow] = useState(Date.now), [dismissed, setDismissed] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const allActivities = useWorkspace((s) => s.nbc_activities ?? EMPTY_ACTIVITIES), allSubmissions = useWorkspace((s) => s.nbc_submissions ?? EMPTY_SUBMISSIONS), allSummaries = useWorkspace((s) => s.nbc_summaries ?? EMPTY_SUMMARIES)
  const activities = useMemo(() => allActivities.filter((a) => a.projectId === project.id), [allActivities, project.id])
  const submissions = useMemo(() => allSubmissions.filter((s) => s.projectId === project.id), [allSubmissions, project.id])
  const summaries = useMemo(() => allSummaries.filter((s) => s.projectId === project.id), [allSummaries, project.id])
  const current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }))
  const calculation = useMemo(() => { try { return calculate(activities) } catch { return null } }, [activities])
  const baseline = useMemo(() => {
    const values = new Map(activities.map((a) => [a.id, a.progress]))
    for (const s of [...submissions].filter((s) => s.weekStart === current).sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))) for (const e of appliedEntries(s)) values.set(e.activityId, e.previous)
    return values
  }, [activities, submissions, current])
  useEffect(() => {
    if (!supabase || scope === 'guest') return
    const client = supabase, channel = client.channel(`nbc:${scope}:${project.id}`)
    for (const table of ['kw_nbc_activities', 'kw_nbc_submissions', 'kw_nbc_summaries']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void syncWorkspace() })
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') void syncWorkspace() })
    return () => { void client.removeChannel(channel) }
  }, [scope, project.id])

  if (aliases[view]) return <Navigate to={`/projects-progress/${project.id}/${aliases[view]}${location.search}`} replace/>
  if (!views.some(([key]) => key === view) && view !== 'issues') return <Navigate to={`/projects-progress/${project.id}/overview`} replace/>
  const activityView = view === 'issues' ? view : 'activities'
  return <div className="workspace-surface project-page nbc-project" data-view={view}>
    <header className="nbc-project-header"><Tile name={project.icon || 'building'} color={project.color}/><div><h1>{project.name}</h1><p className="small muted">{weekLabel(current)} · This week · Due Saturday 12:00 PM</p></div><div className="nbc-project-actions"><button className="btn-secondary nbc-export-button" aria-label="Export XLSX" title="Export XLSX" disabled={!activities.length || !calculation} onClick={() => setExportOpen(true)}><Download size={15} aria-hidden="true"/><span>Export XLSX</span></button></div></header>
    <nav className="view-tabs nbc-tabs" aria-label="Project views">{views.map(([key, label]) => <Link className="view-tab" key={key} aria-current={key === view || key === 'activities' && view === 'issues' ? 'page' : undefined} to={`/projects-progress/${project.id}/${key}`}>{label}</Link>)}</nav>
    {!activities.length
      ? <section><h2>BOQ data has not been initialized.</h2><p>Complete the private project setup.</p></section>
      : <>
        {!calculation && !dismissed && <div className="nbc-banner nbc-warning" role="status"><span>Calculation needs attention. Progress editing is paused.</span><button className="ibtn" aria-label="Dismiss calculation warning" onClick={() => setDismissed(true)}><X size={16}/></button></div>}
        {view === 'overview' && <Overview project={project} activities={activities} submissions={submissions} summaries={summaries} baseline={baseline}/>}
        {view === 'update' && calculation && <UpdateProgress projectId={project.id} activities={activities} submissions={submissions}/>}
        {(view === 'activities' || view === 'issues') && (calculation || activityView !== 'activities') && <Activities projectId={project.id} activities={activities} baseline={baseline} view={activityView}/>}
      </>}
    {exportOpen && <Suspense fallback={<span className="sr-only" role="status">Opening export…</span>}><ExportWorkbook projectId={project.id} activities={activities} submissions={submissions} onClose={() => setExportOpen(false)}/></Suspense>}
  </div>
}
