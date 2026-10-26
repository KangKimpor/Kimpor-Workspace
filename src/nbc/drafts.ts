import type { NbcActivity } from './types'
import { parseProgress } from './progress'
import { updateActivity } from './actions'
import { useWorkspace } from '@/data'
import { isHandler } from './reporting-week'

export interface ActivityDraft {
  id: string
  mode: 'inline' | 'sheet' | 'remark'
  text: string
  remark: string
  originalProgress: number
  originalRemark: string
}
const key = (scope: string, project: string) => `kw-nbc-draft:${scope}:${project}`
export function readActivityDraft(scope: string, project: string): ActivityDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key(scope, project)) || 'null')
    return draft && typeof draft.id === 'string' && typeof draft.text === 'string' && typeof draft.remark === 'string' && Number.isFinite(draft.originalProgress) && typeof draft.originalRemark === 'string' && ['inline','sheet','remark'].includes(draft.mode) ? draft : null
  } catch { return null }
}
export function writeActivityDraft(scope: string, project: string, draft: ActivityDraft) {
  localStorage.setItem(key(scope, project), JSON.stringify(draft))
}
export function clearActivityDraft(scope: string, project: string, id: string, mode?: ActivityDraft['mode']) {
  const current = readActivityDraft(scope, project)
  if (current?.id === id && (!mode || current.mode === mode)) localStorage.removeItem(key(scope, project))
}
export function applyActivityDraft(activity: NbcActivity, draft: ActivityDraft) {
  const parsed = draft.mode === 'remark' ? null : parseProgress(draft.text)
  if (parsed?.message) throw new Error(parsed.message)
  updateActivity(activity.id, { ...(parsed ? { progress: parsed.progress } : {}), ...(draft.mode !== 'inline' ? { remark: draft.remark } : {}) })
  return parsed?.message ?? ''
}
export function flushActivityDraft(projectId: string, keepDraft = false) {
  const state = useWorkspace.getState(), draft = readActivityDraft(state.scope, projectId)
  if (!draft) return
  const activity = state.nbc_activities?.find((a) => a.projectId === projectId && a.id === draft.id)
  if (activity) applyActivityDraft(activity, draft)
  if (!keepDraft) clearActivityDraft(state.scope, projectId, draft.id)
}

export interface UpdateForm { date?: string; note?: string; step?: 'update' | 'review'; handler?: string }
export function readUpdateForm(scope: string, project: string): UpdateForm {
  try { const value = JSON.parse(localStorage.getItem(`kw-nbc-form:${scope}:${project}`) || '{}'); return { ...(typeof value?.handler === 'string' && isHandler(value.handler) ? {handler:value.handler} : {}), ...(typeof value?.date === 'string' ? { date: value.date } : {}), ...(typeof value?.note === 'string' ? { note: value.note } : {}), ...(['update','review'].includes(value?.step) ? { step: value.step } : {}) } } catch { return {} }
}
export function saveUpdateForm(scope: string, project: string, patch: UpdateForm) {
  localStorage.setItem(`kw-nbc-form:${scope}:${project}`, JSON.stringify({ ...readUpdateForm(scope, project), ...patch }))
}
export function clearUpdateForm(scope: string, project: string) { localStorage.removeItem(`kw-nbc-form:${scope}:${project}`) }
