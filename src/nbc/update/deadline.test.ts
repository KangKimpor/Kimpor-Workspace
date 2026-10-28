import { expect, test } from 'vitest'
import { deadlineNote } from './deadline'

const week = '2026-10-26'
test('counts days, then hours, then flips to late exactly at Saturday noon in Phnom Penh', () => {
  expect(deadlineNote(week, Date.parse('2026-10-27T07:05:00Z'))).toMatchObject({ text: 'Due Saturday 12:00 PM · 3 days left', tone: 'calm', late: false })
  expect(deadlineNote(week, Date.parse('2026-10-30T09:00:00Z'))).toMatchObject({ text: 'Due Saturday 12:00 PM · 20 hours left', tone: 'soon' })
  expect(deadlineNote(week, Date.parse('2026-10-31T04:30:00Z')).text).toBe('Due Saturday 12:00 PM · under an hour left')
  expect(deadlineNote(week, Date.parse('2026-10-31T05:00:00Z'))).toMatchObject({ tone: 'late', late: true })
  expect(deadlineNote(week, Date.parse('2026-11-01T12:00:00Z')).late).toBe(true)
})
