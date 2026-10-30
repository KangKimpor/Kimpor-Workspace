import { useWorkspace } from '@/data'
import { pendingCollectionIds, syncWorkspace } from '@/data/sync'
import { supabase } from '@/lib/supabase'
import { appliedEntries, assertEditableWeek, canUpdate, submissionId, transitionSubmission, validateEntries } from './submissions'
import type { SubmissionOperation } from './submissions'
import type { Handler, NbcSubmission, SubmissionEntry } from './types'

function context(week: string, handler: Handler, projectId: string) {
  assertEditableWeek(week)
  const state = useWorkspace.getState(), project = state.projects.find((p) => p.id === projectId && p.nbcBp03)
  if (!project) throw new Error('This NBC project is not initialized.')
  const id = submissionId(project.id, week, handler)
  return { state, project, id, submission: state.nbc_submissions?.find((s) => s.id === id) }
}
export function draftEntries(week: string, handler: Handler, projectId = 'nbc-bp03'): SubmissionEntry[] {
  const { state, project, submission } = context(week, handler, projectId)
  const existing = new Map(submission?.entries.map((e) => [e.activityId, e]))
  return (state.nbc_activities ?? []).filter((a) => a.projectId === project.id && canUpdate(a, handler)).map((a) => {
    if (existing.has(a.id)) return existing.get(a.id)!
    let previous = a.progress, remark = a.remark
    for (const s of [...(state.nbc_submissions ?? [])].filter((s) => s.projectId === project.id && s.weekStart > week).sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))) {
      const e = appliedEntries(s).find((e) => e.activityId === a.id)
      if (e) { previous = e.previous; remark = e.previousRemark ?? '' }
    }
    return { activityId: a.id, previous, progress: previous, remark, baseRevision: a.updatedAt }
  })
}
/** Synchronous store commit journals autosaves through the existing cloud/offline queue. */
function buildDraft(week: string, handler: Handler, entries: SubmissionEntry[], note: string, projectId: string) {
  const { state, project, id, submission } = context(week, handler, projectId)
  if (submission?.status === 'confirmed') throw new Error('Choose Edit before changing a confirmed update.')
  if (note.length > 4000) throw new Error('Keep the note under 4,000 characters.')
  const activities = (state.nbc_activities ?? []).filter((a) => a.projectId === project.id)
  validateEntries(entries, activities, handler)
  // Untouched shared GR&P never competes with another handler's update.
  const savedEntries = entries.filter((e) => activities.find((a) => a.id === e.activityId)?.wbs !== 'GR&P' || e.progress !== e.previous || e.remark !== activities.find((a) => a.id === e.activityId)?.remark || submission?.appliedEntries?.some((p) => p.activityId === e.activityId))
  const draft: NbcSubmission = { id, projectId: project.id, weekStart: week, handler, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note, entries: savedEntries, ...submission, updatedAt: new Date().toISOString() }
  draft.entries = savedEntries; draft.note = note
  return draft
}
export function saveDraft(week: string, handler: Handler, entries: SubmissionEntry[], note = '', projectId = 'nbc-bp03') {
  saveDraftBatch(week, [{ handler, entries, note }], projectId)
}
/** Validate every handler before one local/offline-queue commit. */
export function saveDraftBatch(week: string, updates: { handler: Handler; entries: SubmissionEntry[]; note: string }[], projectId: string) {
  if (new Set(updates.map(u => u.handler)).size !== updates.length) throw new Error('Duplicate handler draft.')
  const drafts = updates.map(u => buildDraft(week, u.handler, u.entries, u.note, projectId))
  const ids = new Set(drafts.map(d => d.id)), state = useWorkspace.getState()
  state.commitNbc({ nbc_submissions: [...(state.nbc_submissions ?? []).filter(s => !ids.has(s.id)), ...drafts] })
  if (useWorkspace.getState().storageError) throw new Error('Could not autosave on this device. Keep this page open.')
}

async function operate(week: string, handler: Handler, operation: SubmissionOperation, projectId: string) {
  let { state, id, submission } = context(week, handler, projectId)
  if (!submission) throw new Error('Update not found.')
  if (state.scope === 'guest') {
    const result = transitionSubmission({ activities: state.nbc_activities ?? [], submissions: state.nbc_submissions ?? [], summaries: state.nbc_summaries ?? [] }, id, operation, state.scope)
    state.commitNbc({ nbc_activities: result.activities, nbc_submissions: result.submissions, nbc_summaries: result.summaries })
  } else {
    const scope = state.scope
    await syncWorkspace()
    if (pendingCollectionIds('nbc_submissions').has(id) || pendingCollectionIds('nbc_activities').size || !navigator.onLine || !supabase) throw new Error('Your draft is kept. Connect and wait for autosave before confirming.')
    if (useWorkspace.getState().scope !== scope) throw new Error('Account changed. Reopen this update.')
    ;({ state, submission } = context(week, handler, projectId))
    if (!submission) throw new Error('This update changed. Reload before continuing.')
    const { data, error } = await supabase.rpc('kw_nbc_submission_write', { operation, payload: { projectId: submission.projectId, weekStart: week, handler }, expected: submission.updatedAt })
    if (error) { await syncWorkspace(); throw new Error(error.message) }
    await syncWorkspace()
    if (useWorkspace.getState().scope !== scope) throw new Error('Account changed.')
    if (data.conflict) throw new Error('This update changed in another session. Review it and try again.')
  }
  return { weekStart: week, handler, undo: () => undoConfirm(week, handler, projectId) }
}
export const confirmUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'confirm', projectId)
export const reopenUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'reopen', projectId)
export const deleteUpdate = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'delete', projectId)
export const undoConfirm = (week: string, handler: Handler, projectId = 'nbc-bp03') => operate(week, handler, 'undo', projectId)
