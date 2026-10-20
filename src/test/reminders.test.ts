import { expect, test } from 'vitest'
import { dueReminders } from '@/calendar/reminders'
import { nextTaskReminder } from '@/data/task-rules'
import type { Task, CalendarEvent } from '@/data'
test('recent reminders fire once per occurrence key and omit completed or old tasks', () => {
  const now = new Date('2026-10-20T09:00:00Z').getTime()
  const task: Task = {
    id: 'task',
    title: 'Review',
    status: 'Not started',
    priority: 'Low',
    projectId: 'project',
    due: '2026-10-20',
    notes: '',
    subtasks: [],
    reminder: '2026-10-20T08:59:00Z',
  }
  const event: CalendarEvent = {
    id: 'event',
    title: 'Call',
    date: '2026-10-20',
    start: '09:09',
    end: '10:00',
    calendar: 'Personal',
    color: 'blue',
    location: '',
    timeZone: 'UTC',
    reminders: [10],
  }
  expect(dueReminders([task], [event], now)).toHaveLength(2)
  expect(dueReminders([{ ...task, status: 'Done' }], [], now)).toEqual([])
  expect(dueReminders([task], [], now + 600000)).toEqual([])
})
test('task recurrence shifts a reminder by date while preserving its local clock', () => {
  expect(
    nextTaskReminder(
      { due: '2026-10-20', reminder: '2026-10-20T08:00' } as Task,
      '2026-10-22',
    ),
  ).toBe('2026-10-22T08:00')
})
