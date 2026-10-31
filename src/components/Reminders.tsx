import { useEffect } from 'react'
import { useWorkspace } from '@/data'
import { useShallow } from 'zustand/react/shallow'
import { useWorkspaceUI } from '@/shell/workspace'
import { dueReminders } from '@/calendar/reminders'
export default function Reminders() {
  const { scope, tasks, events } = useWorkspace(
    useShallow((s) => ({ scope: s.scope, tasks: s.tasks, events: s.events })),
  )
  useEffect(() => {
    const key = `kw-reminded:${scope}`
    let seen: string[] = []
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(cached))
        seen = cached.filter((item): item is string => typeof item === 'string')
    } catch {
      /* A damaged reminder cache must not block the workspace. */
    }
    const check = () => {
      const due = dueReminders(tasks, events, Date.now()).filter(
        (item) => !seen.includes(item.key),
      )
      if (!due.length) return
      seen = [...seen, ...due.map((item) => item.key)].slice(-1000)
      try {
        localStorage.setItem(key, JSON.stringify(seen))
      } catch {
        /* Reminders remain available when storage is full. */
      }
      useWorkspaceUI
        .getState()
        .notify(
          due.length === 1
            ? `Reminder: ${due[0]!.title}`
            : `${due.length} reminders: ${due.map((item) => item.title).join(', ')}`,
        )
    }
    check()
    const timer = setInterval(check, 30000)
    return () => clearInterval(timer)
  }, [scope, tasks, events])
  return null
}
