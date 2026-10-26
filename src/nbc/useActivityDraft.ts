import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/data'
import type { NbcActivity } from './types'
import { applyActivityDraft, clearActivityDraft, readActivityDraft, writeActivityDraft } from './drafts'
import type { ActivityDraft } from './drafts'
import { updateActivity } from './actions'

/** Raw text is journaled immediately; valid edits use the existing cloud/offline save queue. */
export function useActivityDraft(activity: NbcActivity, mode: ActivityDraft['mode'], enabled = true) {
  const scope = useWorkspace((s) => s.scope)
  const [initial] = useState(() => { const stored = readActivityDraft(scope, activity.projectId); return stored?.id === activity.id && stored.mode === mode ? stored : null })
  const [active, setActive] = useState(enabled && (mode === 'sheet' || !!initial))
  const [text, setText] = useState(initial?.text ?? String(Number((activity.progress * 100).toFixed(8))))
  const [remark, setRemark] = useState(initial?.remark ?? activity.remark)
  const [error, setError] = useState('')
  const original = useRef({ progress: initial?.originalProgress ?? activity.progress, remark: initial?.originalRemark ?? activity.remark })
  function record(nextText = text, nextRemark = remark): ActivityDraft {
    return { id: activity.id, mode, text: nextText, remark: nextRemark, originalProgress: original.current.progress, originalRemark: original.current.remark }
  }
  function journal(nextText = text, nextRemark = remark) {
    try { writeActivityDraft(scope, activity.projectId, record(nextText, nextRemark)); setError('') }
    catch { setError('Could not save this edit on this device. Keep this window open.') }
  }
  function begin() {
    original.current = { progress: activity.progress, remark: activity.remark }
    const value = String(Number((activity.progress * 100).toFixed(8)))
    setText(value); setRemark(activity.remark); setActive(true); journal(value, activity.remark)
  }
  function changeText(value: string) { setActive(true); setText(value); journal(value, remark) }
  function changeRemark(value: string) { setActive(true); setRemark(value); journal(text, value) }
  function save() {
    try {
      if (useWorkspace.getState().scope !== scope) return false
      const message = applyActivityDraft(activity, record()); setError(message); return true
    } catch (err) { setError((err as Error).message); return false }
  }
  function finish() {
    if (!save()) return false
    clearActivityDraft(scope, activity.projectId, activity.id, mode); setActive(false); return true
  }
  function cancel() {
    try {
      if (useWorkspace.getState().scope === scope) updateActivity(activity.id, mode === 'remark' ? { remark: original.current.remark } : mode === 'inline' ? { progress: original.current.progress } : { progress: original.current.progress, remark: original.current.remark })
      clearActivityDraft(scope, activity.projectId, activity.id, mode); setActive(false); setError(''); return true
    } catch (err) { setError((err as Error).message); return false }
  }
  useEffect(() => {
    if (!active || !enabled) return
    const timer = setTimeout(() => {
      if (useWorkspace.getState().scope !== scope) return
      try { setError(applyActivityDraft(activity, record())) } catch (err) { setError((err as Error).message) }
    }, 400)
    return () => clearTimeout(timer)
    // Changes are journaled synchronously; an acknowledgement must not restart typing timers.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [active, text, remark, scope, activity.id, enabled])
  return { active, text, remark, error, restored: !!initial, begin, changeText, changeRemark, save, finish, cancel }
}
