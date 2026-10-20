import { rrulestr } from 'rrule'
import type { Task } from './types'

export function nextTaskDue(task: Task) {
  if (!task.recurrence || !/^\d{4}-\d{2}-\d{2}$/.test(task.due)) return null
  const start = new Date(`${task.recurrenceStart || task.due}T12:00:00Z`)
  const after = new Date(`${task.due}T12:00:00Z`)
  try {
    return (
      rrulestr(task.recurrence.replace(/^RRULE:/, ''), { dtstart: start })
        .after(after)
        ?.toISOString()
        .slice(0, 10) ?? null
    )
  } catch {
    return null
  }
}

export function nextTaskReminder(task: Task, due: string) {
  if (!task.reminder) return undefined
  const value = new Date(task.reminder)
  if (!Number.isFinite(value.getTime())) return undefined
  const days = Math.round(
    (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${task.due}T12:00:00Z`)) /
      86400000,
  )
  value.setDate(value.getDate() + days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}
