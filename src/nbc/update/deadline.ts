import { useEffect, useState } from 'react'
import { weekDeadline } from '../submissions'

export type DeadlineTone = 'calm' | 'soon' | 'late'
const HOUR = 3_600_000, DAY = 24 * HOUR
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** What the header says about the Saturday 12:00 deadline for a week, relative to now. */
export function deadlineNote(week: string, now = Date.now()): { text: string; tone: DeadlineTone; late: boolean } {
  const left = weekDeadline(week) - now
  if (left <= 0) return { text: 'Deadline passed Saturday 12:00 PM · updates are marked Late', tone: 'late', late: true }
  const rest = left < HOUR ? 'under an hour left' : left < DAY ? `${plural(Math.ceil(left / HOUR), 'hour')} left` : `${plural(Math.floor(left / DAY), 'day')} left`
  return { text: `Due Saturday 12:00 PM · ${rest}`, tone: left < DAY ? 'soon' : 'calm', late: false }
}

/** Current time, refreshed every minute so the deadline note moves through noon without a reload. */
export function useNow(every = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), every); return () => clearInterval(timer) }, [every])
  return now
}
