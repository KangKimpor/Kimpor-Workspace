import { rrulestr } from 'rrule'
import { minutes, zonedDate } from './time'
export { minutes, clock, zonedDate } from './time'
import { dateKey } from '@/data/seed'
import type { CalendarEvent } from '@/data/types'

export function layoutEvents(events: CalendarEvent[]) {
  const sorted = events
    .filter((e) => !e.allDay)
    .map((event) => ({
      event,
      start: minutes(event.start),
      end: Math.max(minutes(event.start) + 15, minutes(event.end)),
      column: 0,
      columns: 1,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster: typeof sorted = [],
    until = -1
  const finish = () => {
    const ends: number[] = []
    for (const item of cluster) {
      let col = ends.findIndex((end) => end <= item.start)
      if (col < 0) col = ends.length
      ends[col] = item.end
      item.column = col
    }
    for (const item of cluster) item.columns = ends.length
    cluster = []
  }
  for (const item of sorted) {
    if (item.start >= until) {
      finish()
      until = -1
    }
    cluster.push(item)
    until = Math.max(until, item.end)
  }
  finish()
  return sorted
}
export function expandEvents(
  events: CalendarEvent[],
  from: Date,
  to: Date,
): CalendarEvent[] {
  const result: CalendarEvent[] = []
  for (const event of events.filter((e) => !e.deletedAt && !e.isSeriesMaster)) {
    let starts = [new Date(`${event.date}T12:00:00`)]
    if (event.recurrence) {
      try {
        const rule = rrulestr(event.recurrence.replace(/^RRULE:/, ''), {
          dtstart: new Date(`${event.date}T12:00:00Z`),
        })
        starts = rule.between(
          new Date(from.getTime() - 86400000),
          new Date(to.getTime() + 86400000),
          true,
        )
      } catch {
        starts = []
      }
    }
    for (const start of starts) {
      const sourceDate = event.recurrence
        ? start.toISOString().slice(0, 10)
        : event.date
      if (event.excludedDates?.includes(sourceDate)) continue
      let date = sourceDate,
        startClock = event.start,
        endClock = event.end,
        displayEnd = event.endDate
      let displayed = event
      const sourceSpan = event.endDate
        ? Math.max(
            0,
            Math.round(
              (Date.parse(`${event.endDate}T12:00:00Z`) -
                Date.parse(`${event.date}T12:00:00Z`)) /
                86400000,
            ),
          )
        : 0
      if (
        !event.allDay &&
        event.timeZone &&
        event.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone
      ) {
        const sourceEnd = new Date(`${sourceDate}T12:00:00`)
        sourceEnd.setDate(sourceEnd.getDate() + sourceSpan)
        const first = new Date(
          zonedDate(sourceDate, event.start, event.timeZone).getTime(),
        )
        const last = new Date(
          zonedDate(dateKey(sourceEnd), event.end, event.timeZone).getTime(),
        )
        date = dateKey(first)
        displayEnd = dateKey(last)
        startClock = `${String(first.getHours()).padStart(2, '0')}:${String(first.getMinutes()).padStart(2, '0')}`
        endClock = `${String(last.getHours()).padStart(2, '0')}:${String(last.getMinutes()).padStart(2, '0')}`
        displayed = {
          ...event,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sourceTimeZone: event.timeZone,
          startInstant: first.toISOString(),
          endInstant: last.toISOString(),
        }
      } else if (event.recurrence && event.endDate) {
        const end = new Date(`${sourceDate}T12:00:00`)
        end.setDate(end.getDate() + sourceSpan)
        displayEnd = dateKey(end)
      }
      const span = displayEnd
        ? Math.max(
            0,
            Math.round(
              (new Date(`${displayEnd}T12:00:00`).getTime() -
                new Date(`${date}T12:00:00`).getTime()) /
                86400000,
            ),
          )
        : 0
      for (let day = 0; day <= Math.min(span, 366); day++) {
        const current = new Date(`${date}T12:00:00`)
        current.setDate(current.getDate() + day)
        const key = dateKey(current)
        if (current < from || current > to) continue
        result.push({
          ...displayed,
          id: event.id,
          endDate: displayEnd,
          originalStartTime: event.recurrence
            ? sourceDate
            : event.originalStartTime,
          date: key,
          start: day === 0 ? startClock : '00:00',
          end: day === span ? endClock : '23:59',
          allDay: event.allDay || span > 0,
        })
      }
    }
  }
  return result
}
