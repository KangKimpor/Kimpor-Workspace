import { expect, test } from 'vitest'
import {
  localSeriesChange,
  occurrenceDraft,
  splitRule,
  validateRecurrence,
} from '@/calendar/recurrence'
import { expandEvents } from '@/calendar/layout'
import type { CalendarEvent } from '@/data'
const root: CalendarEvent = {
  id: 'series',
  title: 'Review',
  date: '2026-10-19',
  endDate: '2026-10-19',
  start: '09:00',
  end: '10:00',
  calendar: 'Personal',
  color: 'blue',
  location: '',
  recurrence: 'FREQ=DAILY;COUNT=5',
}
const dates = (events: CalendarEvent[]) =>
  expandEvents(
    events,
    new Date('2026-10-19T00:00:00'),
    new Date('2026-10-30T23:59:59'),
  )
    .map((e) => `${e.date}:${e.title}`)
    .sort()
test('editing only one local occurrence keeps the other four and can be edited again', () => {
  const draft = { ...occurrenceDraft(root, '2026-10-21'), title: 'Changed' }
  const result = localSeriesChange([root], draft, 'this')
  expect(dates(result)).toEqual([
    '2026-10-19:Review',
    '2026-10-20:Review',
    '2026-10-21:Changed',
    '2026-10-22:Review',
    '2026-10-23:Review',
  ])
  const exception = result[1]!
  const again = localSeriesChange(
    result,
    { ...exception, title: 'Again' },
    'this',
  )
  expect(again[1]?.id).toBe(exception.id)
})
test('following splits finite rules without restarting the full count', () => {
  const draft = { ...occurrenceDraft(root, '2026-10-21'), title: 'Following' }
  expect(dates(localSeriesChange([root], draft, 'following'))).toEqual([
    '2026-10-19:Review',
    '2026-10-20:Review',
    '2026-10-21:Following',
    '2026-10-22:Following',
    '2026-10-23:Following',
  ])
  expect(dates(localSeriesChange([root], draft, 'following', true))).toEqual([
    '2026-10-19:Review',
    '2026-10-20:Review',
  ])
})
test('all edits preserve the first date and duration even when opened on a later occurrence', () => {
  const initial = occurrenceDraft(root, '2026-10-21')
  const result = localSeriesChange(
    [root],
    { ...initial, title: 'All' },
    'all',
    false,
    initial,
  )
  expect(result[0]).toMatchObject({
    id: 'series',
    date: root.date,
    endDate: root.endDate,
    title: 'All',
  })
  expect(dates(result)).toHaveLength(5)
  const multi = { ...root, endDate: '2026-10-21' }
  expect(occurrenceDraft(multi, '2026-10-23').endDate).toBe('2026-10-25')
})
test('deleting all also deletes local exceptions', () => {
  const items = localSeriesChange(
    [root],
    occurrenceDraft(root, '2026-10-21'),
    'this',
  )
  expect(dates(localSeriesChange(items, items[1]!, 'all', true))).toEqual([])
})
test('splits timezone-aware finite rules across a DST boundary', () => {
  const split = splitRule(
    'FREQ=DAILY;COUNT=4',
    new Date('2026-10-30T09:00:00Z'),
    new Date('2026-11-01T14:00:00Z'),
    'America/New_York',
  )
  expect(split.after).toContain('COUNT=2')
  expect(split.before).toContain('UNTIL=20261101T135959Z')
  expect(() =>
    validateRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10'),
  ).not.toThrow()
  expect(() => validateRecurrence('FREQ=MINUTELY')).toThrow()
})
