import { useEffect, useState } from 'react'
import { useWorkspace } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { confirmUpdate, deleteUpdate, reopenUpdate, saveDraft } from '../actions'
import { draftEntries } from '../submission-actions'
import { clearHandlerDraft, readHandlerDraft, writeHandlerDraft } from '../drafts'
import type { HandlerDraft } from '../drafts'
import { changedEntries } from '../submissions'
import { parseProgress } from '../progress'
import type { Handler, NbcActivity, NbcSubmission, SubmissionEntry } from '../types'

export const formatPercent = (progress: number) => String(Number((progress * 100).toFixed(8)))
export type DraftStatus = 'saved' | 'saving' | 'local' | 'error'

interface Args { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission }

/** Draft, autosave and confirmation state for one handler and week. Behaviour is unchanged from the earlier editor. */
export function useUpdateDraft({ projectId, week, handler, activities, submission }: Args) {
  const scope = useWorkspace((s) => s.scope), sync = useWorkspace((s) => s.sync)
  const [initial] = useState(() => draftEntries(week, handler))
  const [form, setForm] = useState<HandlerDraft>(() => (submission?.status !== 'confirmed' && readHandlerDraft(scope, projectId, week, handler)) || { values: Object.fromEntries(initial.map((e) => [e.activityId, { text: formatPercent(e.progress), remark: e.remark, baseRevision: e.baseRevision }])), note: submission?.note ?? '' })
  const [dirty, setDirty] = useState(() => !!readHandlerDraft(scope, projectId, week, handler)), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const confirmed = submission?.status === 'confirmed'
  const rows = draftEntries(week, handler)

  function parseEntry(entry: SubmissionEntry, formValue: HandlerDraft): SubmissionEntry {
    const value = formValue.values[entry.activityId], parsed = parseProgress(value?.text ?? formatPercent(entry.progress))
    if (parsed.message) throw new Error(parsed.message)
    return { ...entry, progress: parsed.progress, remark: value?.remark ?? entry.remark, baseRevision: value?.baseRevision ?? entry.baseRevision }
  }
  const parse = (formValue = form) => rows.map((entry) => parseEntry(entry, formValue))
  // Display copy: an unparseable row keeps its saved value, so one typo never hides the other edits.
  const parsed = rows.map((entry) => { try { return parseEntry(entry, form) } catch { return entry } })
  const shown = confirmed ? submission.entries : parsed, changed = changedEntries(shown)
  const lowered = changed.filter((e) => e.progress < e.previous)
  const needsRemark = new Set(lowered.filter((e) => !e.remark.trim()).map((e) => e.activityId))
  const byId = new Map(activities.map((a) => [a.id, a]))
  const contribution = shown.reduce((sum, e) => sum + (e.progress - e.previous) * (byId.get(e.activityId)?.globalWeight ?? 0), 0)
  const invalid = new Set<string>()
  for (const e of rows) { try { if (parseProgress(form.values[e.activityId]?.text ?? formatPercent(e.progress)).message) invalid.add(e.activityId) } catch { invalid.add(e.activityId) } }

  function change(next: HandlerDraft) {
    setForm(next); setDirty(true)
    try { writeHandlerDraft(scope, projectId, week, handler, next); setError('') } catch { setError('Could not autosave on this device. Keep this page open.') }
  }
  function field(id: string, patch: Partial<HandlerDraft['values'][string]>) {
    const entry = rows.find((e) => e.activityId === id)!
    setTouched((old) => new Set(old).add(id))
    change({ ...form, values: { ...form.values, [id]: { text: formatPercent(entry.progress), remark: entry.remark, baseRevision: entry.baseRevision, ...form.values[id], ...patch } } })
  }
  function persist() { saveDraft(week, handler, parse(), form.note); setDirty(false) }
  useEffect(() => {
    if (!dirty || confirmed || busy) return
    const timer = setTimeout(() => { try { persist(); setError('') } catch (e) { setError((e as Error).message) } }, 400)
    return () => clearTimeout(timer)
    // Raw keystrokes are journaled synchronously. Server acknowledgements do not restart the timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [form, dirty, confirmed, busy])

  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); setError('') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  const confirm = () => run(async () => {
    if (needsRemark.size) throw new Error('Add a remark to every activity you lowered.')
    persist()
    const result = await confirmUpdate(week, handler)
    clearHandlerDraft(scope, projectId, week, handler)
    useWorkspaceUI.getState().notify('Update confirmed', () => { void result.undo().catch((e) => useWorkspaceUI.getState().notify((e as Error).message)) })
  })
  const edit = () => run(async () => { await reopenUpdate(week, handler) })
  const remove = () => run(async () => {
    await deleteUpdate(week, handler)
    clearHandlerDraft(useWorkspace.getState().scope, projectId, week, handler)
    useWorkspaceUI.getState().notify('Update deleted. Activity values restored.')
  })
  function reloadShared() {
    const shared = activities.find((a) => a.wbs === 'GR&P')!
    field(shared.id, { text: formatPercent(shared.progress), remark: shared.remark, baseRevision: shared.updatedAt }); setError('')
  }
  const status: DraftStatus = dirty ? 'saving' : sync.kind === 'error' ? 'error' : scope !== 'guest' && sync.kind !== 'saved' ? 'local' : 'saved'
  return {
    confirmed, rows, shown, changed, lowered, needsRemark, contribution, invalid, touched, status, error, busy,
    text: (id: string) => form.values[id]?.text ?? formatPercent(rows.find((e) => e.activityId === id)?.progress ?? 0),
    remark: (id: string) => form.values[id]?.remark ?? rows.find((e) => e.activityId === id)?.remark ?? '',
    setText: (id: string, text: string) => field(id, { text }),
    setRemark: (id: string, remark: string) => field(id, { remark }),
    note: form.note, setNote: (note: string) => change({ ...form, note }),
    confirm, edit, remove, reloadShared,
  }
}
