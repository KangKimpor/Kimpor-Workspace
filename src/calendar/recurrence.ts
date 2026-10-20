import { RRule, rrulestr } from 'rrule'
import type { CalendarEvent } from '@/data/types'
import { dateKey } from '@/data/seed'

export type RecurrenceScope = 'this' | 'following' | 'all'
export function shiftDay(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return dateKey(value)
}
export function dayDifference(a: string, b: string) {
  return Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000,
  )
}
export function occurrenceDraft(
  event: CalendarEvent,
  occurrence?: string | null,
) {
  if (!event.recurrence || !occurrence || event.providerEventId)
    return { ...event }
  const date = occurrence.slice(0, 10)
  return {
    ...event,
    date,
    endDate: shiftDay(
      date,
      dayDifference(event.endDate || event.date, event.date),
    ),
    originalStartTime: date,
  }
}
export function splitRule(
  rule: string,
  start: Date,
  boundary: Date,
  timeZone?: string,
) {
  const options = RRule.parseString(rule.replace(/^RRULE:/, ''))
  const original = new RRule({
    ...options,
    dtstart: start,
    ...(timeZone ? { tzid: timeZone } : {}),
  })
  const preceding = original.between(
    new Date(start.getTime() - 86400000),
    new Date(boundary.getTime() - 1),
    true,
  ).length
  const before = new RRule({
    ...options,
    count: null,
    until: new Date(boundary.getTime() - 1000),
  })
    .toString()
    .split('RRULE:')
    .pop()!
  const after = options.count
    ? new RRule({ ...options, count: Math.max(1, options.count - preceding) })
        .toString()
        .split('RRULE:')
        .pop()!
    : rule.replace(/^RRULE:/, '')
  return { before, after }
}
export function validateRecurrence(rule: string) {
  if (!rule) return
  const parsed = rrulestr(rule.replace(/^RRULE:/, ''))
  if (
    !(parsed instanceof RRule) ||
    parsed.options.freq < RRule.YEARLY ||
    parsed.options.freq > RRule.DAILY
  )
    throw new Error('Use a daily, weekly, monthly or yearly RRULE.')
  if (
    parsed.options.interval < 1 ||
    (parsed.options.count !== null && parsed.options.count < 1)
  )
    throw new Error('Repeat interval and count must be positive.')
}
export function localSeriesChange(
  events: CalendarEvent[],
  draft: CalendarEvent,
  scope: RecurrenceScope,
  remove = false,
  initial?: CalendarEvent,
) {
  const root = events.find((e) => e.id === (draft.localSeriesId || draft.id))
  if (!root?.recurrence)
    return [
      { ...draft, ...(remove ? { deletedAt: new Date().toISOString() } : {}) },
    ]
  const occurrence = draft.originalStartTime?.slice(0, 10) || root.date
  if (scope === 'all') {
    if (remove)
      return events
        .filter((e) => e.id === root.id || e.localSeriesId === root.id)
        .map((e) => ({ ...e, deletedAt: new Date().toISOString() }))
    const delta = dayDifference(draft.date, initial?.date || occurrence)
    const date = shiftDay(root.date, delta)
    const patch = initial
      ? Object.fromEntries(
          Object.keys(draft)
            .filter(
              (field) =>
                JSON.stringify(draft[field as keyof CalendarEvent]) !==
                JSON.stringify(initial[field as keyof CalendarEvent]),
            )
            .map((field) => [field, draft[field as keyof CalendarEvent]]),
        )
      : draft
    return [
      {
        ...root,
        ...patch,
        id: root.id,
        localSeriesId: undefined,
        date,
        endDate: shiftDay(
          root.endDate || root.date,
          dayDifference(
            draft.endDate || draft.date,
            initial?.endDate || initial?.date || occurrence,
          ),
        ),
        recurrence: draft.recurrence ?? root.recurrence,
        originalStartTime: undefined,
      },
    ]
  }
  if (scope === 'this') {
    const exception = events.find(
      (e) => e.localSeriesId === root.id && e.originalStartTime === occurrence,
    )
    return [
      {
        ...root,
        excludedDates: [
          ...new Set([...(root.excludedDates || []), occurrence]),
        ],
      },
      {
        ...draft,
        id: exception?.id || crypto.randomUUID(),
        localSeriesId: root.id,
        originalStartTime: occurrence,
        recurrence: undefined,
        excludedDates: undefined,
        ...(remove ? { deletedAt: new Date().toISOString() } : {}),
      },
    ]
  }
  const split = splitRule(
    root.recurrence,
    new Date(`${root.date}T12:00:00Z`),
    new Date(`${occurrence}T12:00:00Z`),
  )
  const changed: CalendarEvent[] = [{ ...root, recurrence: split.before }]
  if (!remove)
    changed.push({
      ...draft,
      id: crypto.randomUUID(),
      localSeriesId: undefined,
      recurrence:
        draft.recurrence === undefined || draft.recurrence === root.recurrence
          ? split.after
          : draft.recurrence,
      excludedDates: root.excludedDates?.filter((d) => d >= occurrence),
      originalStartTime: undefined,
    })
  for (const exception of events.filter(
    (e) =>
      e.localSeriesId === root.id && (e.originalStartTime || '') >= occurrence,
  ))
    changed.push({ ...exception, deletedAt: new Date().toISOString() })
  return changed
}

export function seriesEditPending(
  events: CalendarEvent[],
  event: CalendarEvent,
) {
  const series =
    event.recurringEventId ||
    (event.isSeriesMaster ? event.providerEventId : undefined)
  return (
    !!series &&
    events.some(
      (e) =>
        e.recurringEventId === series &&
        e.recurrenceEdit &&
        e.recurrenceEdit.scope !== 'this',
    )
  )
}
