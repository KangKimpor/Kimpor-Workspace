import { useWorkspace } from '@/data'
import { calculate, latestReport, percentage, reportEntries } from './progress'
import type { NbcActivity, NbcReport } from './types'
import { confirmationKey, isHandler } from './reporting-week'

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
export function startWeek(projectId: string, date: string, correctionOf: string | null = null, reason = '', handler?: string) {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? []
  if (handler !== undefined && !isHandler(handler)) throw new Error('Choose which handler you are.')
  if (!state.projects.some((p) => p.id === projectId && p.nbcBp03 && p.workspace === 'team')) throw new Error('NBC BP03 must belong to Team Workspace.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid week-ending date.')
  if (reports.some((r) => r.projectId === projectId && (r.status === 'draft' || r.date === date))) throw new Error('An open period or this reporting date already exists.')
  const previous = latestReport(reports, projectId)
  if (previous && date <= previous.date) throw new Error('Choose a date after the latest finalized report.')
  if (correctionOf && (!reason.trim() || !reports.some((r) => r.id === correctionOf && r.projectId === projectId && r.status === 'final'))) throw new Error('A correction needs a finalized report and a reason.')
  const now = new Date().toISOString()
  const report: NbcReport = { id: crypto.randomUUID(), projectId, date, status: 'draft', previousReportId: previous?.id ?? null,
    correctionOf, reason: reason.trim(), entries: [], overall: 0, previous: previous?.overall ?? calculate((state.nbc_activities ?? []).filter((a) => a.projectId === projectId), new Map((state.nbc_activities ?? []).map((a) => [a.id, a.baseline]))).overall,
    createdAt: now, updatedAt: now, finalizedAt: null, editor: state.scope, ...(handler && isHandler(handler) ? { startedBy: handler } : {}) }
  state.commitNbc({ nbc_reports: [...reports, report] })
}
export function confirmHandlerUpdate(reportId: string, handler: string) {
  if (!isHandler(handler)) throw new Error('Choose which handler you are.')
  const state = useWorkspace.getState(), report = state.nbc_reports?.find((r) => r.id === reportId)
  if (!report || report.status !== 'draft') throw new Error('Choose an open update to confirm your weekly progress.')
  if (state.scope !== 'guest' && state.sync.kind !== 'saved') throw new Error('Wait for activity changes to save before confirming your update.')
  const assigned = (state.nbc_activities ?? []).filter((a) => a.projectId === report.projectId && a.editable && a.handler === handler)
  const prior = latestReport(state.nbc_reports ?? [], report.projectId), previous = new Map(prior?.entries.map((e) => [e.id, e.progress]))
  const at = new Date().toISOString(), confirmation = { at, editor: state.scope, assignedCount: assigned.length, changedCount: assigned.filter((a) => a.progress !== (previous.get(a.id) ?? a.baseline)).length }
  state.commitNbc({ nbc_reports: (state.nbc_reports ?? []).map((r) => r.id === report.id ? { ...r, [confirmationKey(handler)]: confirmation, updatedAt: at } : r) })
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
function assertSaved(message: string) {
  const state = useWorkspace.getState()
  if (state.scope !== 'guest' && state.sync.kind !== 'saved') throw new Error(message)
}

/** Edit the reporting date or note of a finalized update. Its progress snapshot is left untouched. */
export function editFinalReport(id: string, patch: { date: string; note: string }) {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? [], report = reports.find((r) => r.id === id)
  if (!report || report.status !== 'final') throw new Error('Only a finalized update can be edited.')
  assertSaved('Wait for changes to save before editing this update.')
  if (patch.note.length > 4000) throw new Error('Keep the note under 4,000 characters.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date) || new Date(patch.date).toISOString().slice(0, 10) !== patch.date) throw new Error('Choose a valid week-ending date.')
  const others = reports.filter((r) => r.projectId === report.projectId && r.id !== id)
  if (others.some((r) => r.date === patch.date)) throw new Error('A report for this date already exists.')
  const finals = others.filter((r) => r.status === 'final')
  const before = finals.filter((r) => r.date < report.date).sort((a, b) => b.date.localeCompare(a.date))[0]
  const after = finals.filter((r) => r.date > report.date).sort((a, b) => a.date.localeCompare(b.date))[0]
  if ((before && patch.date <= before.date) || (after && patch.date >= after.date)) throw new Error('The date must stay between the neighbouring updates.')
  const now = new Date().toISOString()
  state.commitNbc({ nbc_reports: reports.map((r) => r.id === id ? { ...r, date: patch.date, note: patch.note, updatedAt: now } : r) })
}

/** Delete a finalized update. Deleting the newest one also rolls activity percentages back to the one before it. */
export function deleteFinalReport(id: string) {
  const state = useWorkspace.getState(), reports = state.nbc_reports ?? [], report = reports.find((r) => r.id === id)
  if (!report || report.status !== 'final') throw new Error('Only a finalized update can be deleted here.')
  if (reports.some((r) => r.projectId === report.projectId && r.status === 'draft')) throw new Error('Finish or delete the open update before deleting a past update.')
  assertSaved('Wait for changes to save before deleting this update.')
  const wasLatest = latestReport(reports, report.projectId)?.id === id
  const rest = reports.filter((r) => r.id !== id).map((r) => ({
    ...r,
    ...(r.previousReportId === id ? { previousReportId: report.previousReportId } : {}),
    ...(r.correctionOf === id ? { correctionOf: null } : {}),
  }))
  if (!wasLatest) { state.commitNbc({ nbc_reports: rest }); return }
  const previous = latestReport(rest, report.projectId), values = new Map(previous?.entries.map((e) => [e.id, e.progress]))
  const at = new Date().toISOString()
  state.commitNbc({ nbc_reports: rest, nbc_activities: (state.nbc_activities ?? []).map((a) => {
    if (a.projectId !== report.projectId || !a.editable) return a
    const progress = values.get(a.id) ?? a.baseline
    return progress === a.progress ? a : { ...a, progress, updatedAt: at, history: [...a.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: a.progress, progress, remark: a.remark, handler: a.handler }] }
  }) })
}
