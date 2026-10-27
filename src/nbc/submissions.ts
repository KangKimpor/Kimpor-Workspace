import { calculate, percentage } from './progress'
import { handlers } from './types'
import type { Handler, NbcActivity, NbcSubmission, NbcWeekSummary, SubmissionEntry } from './types'

export const REPORTING_TIMEZONE = 'Asia/Phnom_Penh'
// Exclusive boundary: all of Sunday is on time; Monday 00:00 is late.
export const WEEK_DEADLINE = 'T00:00:00+07:00'
export const UNDO_SECONDS = 10
export function weekStart(date = new Date().toLocaleDateString('en-CA', { timeZone: REPORTING_TIMEZONE })) {
  const day = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== date) throw new Error('Invalid reporting date.')
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}
export function addDays(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10) }
export const weekDeadline = (week: string) => Date.parse(`${addDays(week, 7)}${WEEK_DEADLINE}`)
export function assertEditableWeek(week: string, now = new Date()) {
  const current = weekStart(now.toLocaleDateString('en-CA', { timeZone: REPORTING_TIMEZONE }))
  if (weekStart(week) !== week || ![current, addDays(current, -7)].includes(week)) throw new Error('Only this week and last week can be changed.')
}
export const submissionId = (project: string, week: string, handler: Handler) => `${project}:${week}:${handler}`
export const canUpdate = (activity: NbcActivity, handler: Handler) => activity.editable && (activity.handler === handler || activity.wbs === 'GR&P')
export const appliedEntries = (s: NbcSubmission) => s.status === 'confirmed' ? s.entries : s.appliedEntries ?? []
export const changedEntries = (entries: SubmissionEntry[]) => entries.filter((e) => Math.abs(e.progress - e.previous) > 1e-12)
export function weekLabel(week: string) {
  const format = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  return `${format(week)} – ${format(addDays(week, 6))}`
}
export function submissionStatus(s: NbcSubmission | undefined, week: string, activities: NbcActivity[], now = Date.now()) {
  if (s?.confirmedAt) {
    const assigned = new Set(activities.filter((a) => a.editable && a.wbs !== 'GR&P' && a.handler === s.handler).map((a) => a.id))
    const recorded = new Set(appliedEntries(s).filter((e) => activities.find((a) => a.id === e.activityId)?.wbs !== 'GR&P').map((e) => e.activityId))
    if (assigned.size !== recorded.size || [...assigned].some((id) => !recorded.has(id))) return 'Needs review'
  }
  return s?.status === 'confirmed' ? s.late ? 'Updated late' : 'Updated' : now >= weekDeadline(week) ? 'Overdue' : 'Not yet'
}

export function validateEntries(entries: SubmissionEntry[], activities: NbcActivity[], handler: Handler) {
  if (!handlers.includes(handler) || new Set(entries.map((e) => e.activityId)).size !== entries.length) throw new Error('Invalid handler or duplicate activities.')
  for (const e of entries) {
    if (!activities.some((a) => a.id === e.activityId && canUpdate(a, handler))) throw new Error('Update only your activities or shared GR&P.')
    percentage(e.previous); percentage(e.progress)
    if (typeof e.remark !== 'string' || e.remark.length > 4000) throw new Error('Remarks must be 4,000 characters or fewer.')
  }
}

export interface SubmissionState { activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[] }
export type SubmissionOperation = 'confirm' | 'reopen' | 'delete' | 'undo'
/** Pure counterpart of the atomic database operation, also used by the offline demo. */
export function transitionSubmission(input: SubmissionState, id: string, operation: SubmissionOperation, editor: string, now = new Date()): SubmissionState {
  const state = structuredClone(input), submission = state.submissions.find((s) => s.id === id)
  if (!submission) throw new Error('Update not found.')
  assertEditableWeek(submission.weekStart, now)
  const at = now.toISOString(), project = state.activities.filter((a) => a.projectId === submission.projectId)
  const order = (a: NbcSubmission, b: NbcSubmission) => a.weekStart.localeCompare(b.weekStart) || (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? '') || a.id.localeCompare(b.id)
  const before = state.submissions.filter((s) => s.projectId === submission.projectId).sort(order)
  const bases = new Map<string, { progress: number; remark: string }>()
  for (const s of before) for (const e of appliedEntries(s)) if (!bases.has(e.activityId) && s.weekStart >= addDays(weekStart(now.toLocaleDateString('en-CA', { timeZone: REPORTING_TIMEZONE })), -7)) bases.set(e.activityId, { progress: e.previous, remark: e.previousRemark ?? '' })
  if (operation === 'confirm') {
    if (submission.status !== 'draft') throw new Error('This update is already confirmed.')
    validateEntries(submission.entries, project, submission.handler)
    const assigned = project.filter((a) => canUpdate(a, submission.handler) && a.wbs !== 'GR&P')
    if (assigned.some((a) => !submission.entries.some((e) => e.activityId === a.id))) throw new Error('Assignments changed. Reload your activities before confirming.')
    for (const e of submission.entries) {
      const a = project.find((a) => a.id === e.activityId)!
      if (a.wbs === 'GR&P' && (a.updatedAt ?? '') !== (e.baseRevision ?? '')) throw new Error('GR&P changed in another update. Reload it before confirming.')
      if (!bases.has(a.id)) bases.set(a.id, { progress: a.progress, remark: a.remark })
    }
    submission.status = 'confirmed'; submission.confirmedAt = at; submission.confirmedBy = editor
    submission.late = +now >= weekDeadline(submission.weekStart); submission.undoUntil = new Date(+now + UNDO_SECONDS * 1000).toISOString()
    delete submission.appliedEntries
  } else if (operation === 'reopen') {
    if (submission.status !== 'confirmed') throw new Error('Only a confirmed update can be edited.')
    submission.appliedEntries = structuredClone(submission.entries); submission.status = 'draft'; submission.undoUntil = null
    submission.entries = submission.entries.filter((e) => project.some((a) => a.id === e.activityId && canUpdate(a, submission.handler)))
    for (const e of submission.entries) e.baseRevision = project.find((a) => a.id === e.activityId)?.updatedAt
  } else {
    if (operation === 'undo' && (submission.status !== 'confirmed' || submission.confirmedBy !== editor || +now > Date.parse(submission.undoUntil ?? ''))) throw new Error('The undo window has expired.')
    if (operation === 'undo') { submission.status = 'draft'; submission.confirmedAt = null; submission.confirmedBy = null; submission.undoUntil = null; delete submission.appliedEntries }
    else state.submissions = state.submissions.filter((s) => s.id !== id)
  }
  submission.updatedAt = at
  const editableStart = addDays(weekStart(now.toLocaleDateString('en-CA', { timeZone: REPORTING_TIMEZONE })), -7)
  const chain = state.submissions.filter((s) => s.projectId === submission.projectId && s.weekStart >= editableStart).sort(order)
  const running = new Map(bases)
  for (const s of chain) for (const e of appliedEntries(s)) {
    const base = running.get(e.activityId)
    if (!base) continue
    if (e.previous !== base.progress || e.previousRemark !== base.remark) s.updatedAt = at
    e.previous = base.progress; e.previousRemark = base.remark
    running.set(e.activityId, { progress: e.progress, remark: e.remark })
  }
  for (const a of state.activities) {
    const value = a.projectId === submission.projectId ? running.get(a.id) : undefined
    if (value && (a.progress !== value.progress || a.remark !== value.remark)) {
      a.history.push({ id: crypto.randomUUID(), at, editor, previous: a.progress, progress: value.progress, remark: value.remark, handler: a.handler })
      a.progress = value.progress; a.remark = value.remark; a.updatedAt = at
    }
  }
  if (operation === 'undo') for (const e of submission.entries) e.baseRevision = state.activities.find((a) => a.id === e.activityId)?.updatedAt
  // Only two small summaries are recalculated; older summaries are never restated.
  for (const week of [editableStart, addDays(editableStart, 7)]) {
    const values = new Map(project.filter((a) => a.editable).map((a) => [a.id, state.activities.find((v) => v.id === a.id)!.progress]))
    for (const s of [...chain].reverse()) if (s.weekStart > week) for (const e of [...appliedEntries(s)].reverse()) values.set(e.activityId, e.previous)
    const overall = calculate(project, values).overall, contributions: Record<string, number> = {}
    for (const a of project.filter((a) => a.editable)) contributions[a.wbs === 'GR&P' ? 'GR&P' : a.handler] = (contributions[a.wbs === 'GR&P' ? 'GR&P' : a.handler] ?? 0) + a.globalWeight * values.get(a.id)!
    const previousValues = new Map(values)
    for (const s of [...chain].reverse()) if (s.weekStart === week) for (const e of [...appliedEntries(s)].reverse()) previousValues.set(e.activityId, e.previous)
    const summary = { id: `${submission.projectId}:${week}`, projectId: submission.projectId, weekStart: week, overall, previous: calculate(project, previousValues).overall, contributions, updatedAt: at }
    state.summaries = [...state.summaries.filter((s) => s.id !== summary.id), summary]
  }
  return state
}
