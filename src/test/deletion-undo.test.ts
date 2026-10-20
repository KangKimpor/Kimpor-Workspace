import { expect, test } from 'vitest'
import { eventWriteReady } from '@/data/persistence'
import type { CalendarEvent } from '@/data'

test('Google deletion waits past the Undo window and an undone deletion is ready immediately', () => {
  const now = Date.parse('2026-10-20T07:00:00Z')
  const event = {
    deletedAt: new Date(now).toISOString(),
    deleteAfter: new Date(now + 8000).toISOString(),
  } as CalendarEvent
  expect(eventWriteReady(event, now + 6000)).toBe(false)
  expect(eventWriteReady(event, now + 8000)).toBe(true)
  expect(eventWriteReady({ ...event, deletedAt: null }, now)).toBe(true)
  expect(eventWriteReady({ ...event, deleteAfter: 'damaged' }, now)).toBe(true)
})
