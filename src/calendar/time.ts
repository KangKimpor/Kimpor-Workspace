import { useWorkspace } from '@/data'
import { TZDate } from '@date-fns/tz'

export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
export const clock = (value: number) =>
  `${String(Math.floor(Math.max(0, Math.min(1439, value)) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.min(1439, value)) % 60).padStart(2, '0')}`
export function zonedDate(
  date: string,
  time: string,
  zone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const [y, m, d] = date.split('-').map(Number)
  return new TZDate(
    y!,
    m! - 1,
    d!,
    Number(time.slice(0, 2)),
    Number(time.slice(3)),
    zone,
  )
}

export function displayTime(value: string) {
  if (!useWorkspace.getState().calendarPreferences?.hour12) return value
  const [hour, minute] = value.split(':').map(Number)
  return `${hour! % 12 || 12}:${String(minute).padStart(2, '0')} ${hour! < 12 ? 'AM' : 'PM'}`
}
