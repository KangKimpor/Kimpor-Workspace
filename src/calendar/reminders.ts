import type { Task, CalendarEvent } from '@/data/types'
import { expandEvents, zonedDate } from './layout'
export function dueReminders(
  tasks: Task[],
  events: CalendarEvent[],
  now: number,
) {
  const recent = (value: number) =>
    Number.isFinite(value) && value <= now && value > now - 300000
  const result: { key: string; title: string }[] = []
  for (const task of tasks) {
    if (task.deletedAt || task.status === 'Done' || !task.reminder) continue
    const due = new Date(task.reminder).getTime()
    if (recent(due))
      result.push({ key: `task:${task.id}:${due}`, title: task.title })
  }
  for (const event of expandEvents(
    events,
    new Date(now - 2 * 86400000),
    new Date(now + 2 * 86400000),
  )) {
    for (const minutes of event.reminders || []) {
      const due =
        (!event.allDay && event.startInstant
          ? Date.parse(event.startInstant)
          : zonedDate(
              event.date,
              event.allDay ? '00:00' : event.start,
              event.timeZone,
            ).getTime()) -
        minutes * 60000
      if (recent(due))
        result.push({ key: `event:${event.id}:${due}`, title: event.title })
    }
  }
  return result
}
