import { useWorkspace } from '@/data'
import { clearHandlerDraft, readHandlerDraft } from '../drafts'
import { draftEntries, saveDraftBatch } from '../submission-actions'
import { handlers } from '../types'
import { assertEditableWeek } from '../submissions'
import type { Handler } from '../types'

export function importDrafts(projectId: string, week: string, values: Map<string, number>, sharedHandler: Handler | '', reason: string, replaceDrafts = false) {
  assertEditableWeek(week)
  const state = useWorkspace.getState(), activities = (state.nbc_activities ?? []).filter(a => a.projectId === projectId)
  const changed = activities.filter(a => a.editable && values.get(a.id) !== a.progress)
  if (values.size !== activities.filter(a => a.editable).length || activities.some(a => a.editable && (!values.has(a.id) || !Number.isFinite(values.get(a.id)) || values.get(a.id)! < 0 || values.get(a.id)! > 1))) throw new Error('Workbook activities changed. Choose the workbook again.')
  if (changed.some(a => values.get(a.id)! < a.progress) && !reason.trim()) throw new Error('Add a reason for lowered progress.')
  if (changed.some(a => a.wbs === 'GR&P') && !handlers.includes(sharedHandler as Handler)) throw new Error('Choose the handler responsible for the shared GR&P update.')
  const updates = handlers.flatMap(handler => {
    const selected = changed.filter(a => a.wbs === 'GR&P' ? handler === sharedHandler : a.handler === handler)
    if (!selected.length) return []
    const existing = state.nbc_submissions?.find(s => s.projectId === projectId && s.weekStart === week && s.handler === handler)
    if (existing?.status === 'confirmed') throw new Error(`${handler} already has a confirmed update. Choose Edit in Update Progress first, then import with Replace affected drafts.`)
    if (!replaceDrafts && (existing || readHandlerDraft(state.scope, projectId, week, handler))) throw new Error(`${handler} already has a draft for this week. Review it or choose Replace affected drafts.`)
    const entries = draftEntries(week, handler, projectId).map(e => {
      const a = activities.find(a => a.id === e.activityId && (a.wbs !== 'GR&P' || handler === sharedHandler))
      return a ? { ...e, progress: values.get(a.id)!, remark: values.get(a.id)! < a.progress ? reason.trim() : e.remark } : e
    })
    return [{ handler, entries, note: 'Imported from Excel workbook.' }]
  })
  if (!updates.length) throw new Error('No progress percentages changed.')
  saveDraftBatch(week, updates, projectId)
  for (const update of updates) clearHandlerDraft(state.scope, projectId, week, update.handler)
  return updates.map(u => u.handler)
}
