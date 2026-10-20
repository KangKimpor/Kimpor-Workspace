import { create } from 'zustand'
import type { CalendarAccount, UserCalendar } from '@/data/types'

export const useCalendars = create<{
  accounts: CalendarAccount[]
  calendars: UserCalendar[]
  busy: boolean
  error: string
}>(() => ({ accounts: [], calendars: [], busy: false, error: '' }))
export function defaultCalendar() {
  return useCalendars
    .getState()
    .calendars.find(
      (calendar) =>
        calendar.isDefault && ['owner', 'writer'].includes(calendar.accessRole),
    )
}
