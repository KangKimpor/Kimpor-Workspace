import { useWorkspace } from '@/data'
import { calculate, latestReport, percentage, reportEntries } from './progress'
import type { NbcActivity, NbcReport } from './types'

export function assignActivities(ids: string[], handler: string) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? [], selected = new Set(ids)
  if (handler.length > 100 || ids.some((id) => !activities.some((a) => a.id === id && a.editable))) throw new Error('Choose editable activities and a valid handler.')
  const at = new Date().toISOString()
  state.commitNbc({ nbc_activities: activities.map((a) => selected.has(a.id) && a.handler !== handler ? {
    ...a, handler, updatedAt: at, history: [...a.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: a.progress, progress: a.progress, remark: a.remark, handler }],
  } : a) })
}

export function updateActivity(id: string, patch: Pick<Partial<NbcActivity>, 'progress' | 'handler' | 'remark'>) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? []
  const activity = activities.find((a) => a.id === id)
  if (!activity?.editable) throw new Error('Only leaf activities and GR&P can be edited.')
  if (patch.progress !== undefined && !(state.nbc_reports ?? []).some((r) => r.projectId === activity.projectId && r.status === 'draft')) throw new Error('Start a reporting week to update progress.')
  if (patch.progress !== undefined) percentage(patch.progress)
  if (patch.remark && patch.remark.length > 4000) throw new Error('Remarks must be 4,000 characters or fewer.')
  if (patch.handler && patch.handler.length > 100) throw new Error('Handler name is too long.')
  if (Object.entries(patch).every(([key, value]) => activity[key as keyof NbcActivity] === value)) return
  const at = new Date().toISOString(), next = { ...activity, ...patch, updatedAt: at }
  next.history = [...activity.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: activity.progress, progress: next.progress, remark: next.remark, handler: next.handler }]
  state.commitNbc({ nbc_activities: activities.map((a) => a.id === id ? next : a) })
}
export function startWeek(projectId: string, date: string, correctionOf: string | null = null, reason = '') {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? []
  if (!state.projects.some((p) => p.id === projectId && p.nbcBp03 && p.workspace === 'team')) throw new Error('NBC BP03 must belong to Team Workspace.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid week-ending date.')
  if (reports.some((r) => r.projectId === projectId && (r.status === 'draft' || r.date === date))) throw new Error('An open period or this reporting date already exists.')
  const previous = latestReport(reports, projectId)
  if (previous && date <= previous.date) throw new Error('Choose a date after the latest finalized report.')
  if (correctionOf && (!reason.trim() || !reports.some((r) => r.id === correctionOf && r.projectId === projectId && r.status === 'final'))) throw new Error('A correction needs a finalized report and a reason.')
  const now = new Date().toISOString()
  const report: NbcReport = { id: crypto.randomUUID(), projectId, date, status: 'draft', previousReportId: previous?.id ?? null,
    correctionOf, reason: reason.trim(), entries: [], overall: 0, previous: previous?.overall ?? calculate((state.nbc_activities ?? []).filter((a) => a.projectId === projectId), new Map((state.nbc_activities ?? []).map((a) => [a.id, a.baseline]))).overall,
    createdAt: now, updatedAt: now, finalizedAt: null, editor: state.scope }
  state.commitNbc({ nbc_reports: [...reports, report] })
}
export function finalizeWeek(id: string, note = '') {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? [], report = reports.find((r) => r.id === id)
  if (!report || report.status !== 'draft') throw new Error('Only an open reporting period can be finalized.')
  if (note.length > 4000) throw new Error('Keep the finalization note under 4,000 characters.')
  const previous = latestReport(reports, report.projectId)
  if ((previous?.id ?? null) !== report.previousReportId) throw new Error('The previous report changed. Reload before finalizing.')
  const activities = (state.nbc_activities ?? []).filter((a) => a.projectId === report.projectId)
  if (!activities.length) throw new Error('The BOQ dataset has not been initialized.')
  const calculation = calculate(activities)
  const now = new Date().toISOString()
  state.commitNbc({ nbc_reports: reports.map((r) => r.id === id ? { ...r, note, status: 'final', entries: reportEntries(activities, previous), overall: calculation.overall, updatedAt: now, finalizedAt: now, editor: state.scope } : r) })
}

/** Discard only the open period; immutable snapshots and remarks remain intact. */
export function discardWeek(id: string) {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? [], report = reports.find((r) => r.id === id)
  if (!report || report.status !== 'draft') throw new Error('Only an open update can be deleted.')
  if (state.scope !== 'guest' && state.sync.kind !== 'saved') throw new Error('Wait for changes to save before deleting this update.')
  const previous = reports.find((r) => r.id === report.previousReportId), values = new Map(previous?.entries.map((e) => [e.id,e.progress]))
  const at = new Date().toISOString()
  state.commitNbc({ nbc_reports: reports.filter((r) => r.id !== id), nbc_activities: (state.nbc_activities ?? []).map((a) => {
    if (a.projectId !== report.projectId || !a.editable) return a
    const progress = values.get(a.id) ?? a.baseline
    return progress === a.progress ? a : { ...a, progress, updatedAt: at, history: [...a.history,{id:crypto.randomUUID(),at,editor:state.scope,previous:a.progress,progress,remark:a.remark,handler:a.handler}] }
  }) })
}
