import { describe, expect, it } from 'vitest'
import { clock, expandEvents, layoutEvents, zonedDate } from '@/calendar/layout'
import { parseQuickAdd } from '@/components/QuickAdd'
import type { CalendarEvent } from '@/data'
const event = (id: string, start: string, end: string): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  date: '2026-10-19',
  calendar: 'Personal',
  color: 'blue',
  location: '',
})
describe('calendar and quick add', () => {
  it('packs 20 simultaneous events and reuses columns after a cluster ends', () => {
    const packed = layoutEvents([
      ...Array.from({ length: 20 }, (_, i) =>
        event(String(i), '10:00', '11:00'),
      ),
      event('later', '11:00', '12:00'),
    ])
    expect(packed.slice(0, 20).every((e) => e.columns === 20)).toBe(true)
    expect(new Set(packed.slice(0, 20).map((e) => e.column)).size).toBe(20)
    expect(packed[20]?.columns).toBe(1)
  })
  it('treats touching event edges as non-overlapping', () =>
    expect(
      layoutEvents([
        event('a', '10:00', '10:30'),
        event('b', '10:30', '11:00'),
      ]).map((e) => e.columns),
    ).toEqual([1, 1]))
  it('expands recurrence only inside the visible date window', () =>
    expect(
      expandEvents(
        [{ ...event('a', '10:00', '11:00'), recurrence: 'FREQ=DAILY;COUNT=3' }],
        new Date('2026-10-19T00:00:00'),
        new Date('2026-10-22T23:59:00'),
      ),
    ).toHaveLength(3))
  it('keeps wall-clock event times correct across DST', () => {
    expect(
      new Date(
        zonedDate('2026-11-01', '09:00', 'America/New_York'),
      ).toISOString(),
    ).toBe('2026-11-01T14:00:00.000Z')
    expect(
      new Date(
        zonedDate('2026-10-31', '09:00', 'America/New_York'),
      ).toISOString(),
    ).toBe('2026-10-31T13:00:00.000Z')
  })
  it('parses project, priority, and a natural date without model calls', () =>
    expect(
      parseQuickAdd(
        'Review plan tomorrow 3pm #Website !high',
        new Date(2026, 9, 19, 9),
      ),
    ).toMatchObject({
      title: 'Review plan',
      project: 'Website',
      priority: 'High',
      due: '2026-10-20',
      time: '15:00',
    }))
  it('clamps snapped times to the day', () => {
    expect(clock(-15)).toBe('00:00')
    expect(clock(1440)).toBe('23:59')
  })
})

it('uses Google instances once and retains their original occurrence identity', () => {
  const instance = {...event('instance','10:00','11:00'), providerEventId:'instance', recurringEventId:'series',originalStartTime:'2026-10-19T10:00:00+07:00'}
  const result = expandEvents([
    {...event('master','10:00','11:00'), isSeriesMaster:true, recurrence:'FREQ=DAILY'},
    instance,
  ],new Date('2026-10-19T00:00:00'),new Date('2026-10-19T23:59:59'))
  expect(result).toHaveLength(1)
  expect(result[0]?.originalStartTime).toBe(instance.originalStartTime)
})

it('converts a foreign-zone local recurrence to the viewer clock without losing its source date',()=>{
  const result=expandEvents([{...event('foreign','23:00','23:30'),timeZone:'America/New_York',recurrence:'FREQ=DAILY;COUNT=2'}],new Date('2026-10-18T00:00:00'),new Date('2026-10-23T23:59:59'))
  expect(result).toHaveLength(2)
  expect(result[0]?.sourceTimeZone).toBe('America/New_York')
  expect(result[0]?.startInstant).toBe('2026-10-20T03:00:00.000Z')
  expect(result[0]?.originalStartTime).toBe('2026-10-19')
  expect(result[1]?.startInstant).toBe('2026-10-21T03:00:00.000Z')
})
