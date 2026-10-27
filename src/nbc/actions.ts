import { useWorkspace } from '@/data'
import { handlers } from './types'
import type { Handler, NbcActivity } from './types'
export { saveDraft, confirmUpdate, undoConfirm, reopenUpdate, deleteUpdate } from './submission-actions'

export function assignActivities(ids: string[], handler: string) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? [], selected = new Set(ids)
  if (!handlers.includes(handler as Handler) || ids.some((id) => !activities.some((a) => a.id === id && a.editable))) throw new Error('Choose editable activities and a valid handler.')
  const at = new Date().toISOString()
  state.commitNbc({ nbc_activities: activities.map((a) => selected.has(a.id) && a.handler !== handler ? {
    ...a, handler, updatedAt: at, history: [...a.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: a.progress, progress: a.progress, remark: a.remark, handler }],
  } : a) })
}

export function updateActivity(id: string, patch: Pick<Partial<NbcActivity>, 'progress' | 'handler' | 'remark'>) {
  const state = useWorkspace.getState(), activities = state.nbc_activities ?? []
  const activity = activities.find((a) => a.id === id)
  if (!activity?.editable) throw new Error('Only leaf activities and GR&P can be edited.')
  if (patch.progress !== undefined || patch.remark !== undefined) throw new Error('Use a handler draft and Confirm update.')
  if (patch.handler !== undefined && !handlers.includes(patch.handler as Handler) && !(activity.wbs === 'GR&P' && patch.handler === '')) throw new Error('Choose one of the six handlers.')
  if (Object.entries(patch).every(([key, value]) => activity[key as keyof NbcActivity] === value)) return
  const at = new Date().toISOString(), next = { ...activity, ...patch, updatedAt: at }
  next.history = [...activity.history, { id: crypto.randomUUID(), at, editor: state.scope, previous: activity.progress, progress: next.progress, remark: next.remark, handler: next.handler }]
  state.commitNbc({ nbc_activities: activities.map((a) => a.id === id ? next : a) })
}
