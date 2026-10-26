import { handlers } from './types'
import type { Handler, NbcActivity, NbcReport } from './types'

export const reportingToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' })
export const isHandler = (value: string): value is Handler => handlers.some((handler) => handler === value)
export const confirmationKey = (handler: Handler) => `handlerUpdate${handler}` as const

/** Reporting weeks run Sunday–Saturday; confirmations are due Saturday at noon, Phnom Penh. */
export function reportingWeek(date = reportingToday()) {
  const day = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error('Choose a valid reporting date.')
  day.setUTCDate(day.getUTCDate() + (6 - day.getUTCDay() + 7) % 7)
  const ending = day.toISOString().slice(0, 10)
  return { ending, deadline: Date.parse(`${ending}T12:00:00+07:00`) }
}

export function weeklyHandlerStatus(reports: NbcReport[], date: string, activities: NbcActivity[], now = Date.now()) {
  const { ending, deadline } = reportingWeek(date)
  const week = reports.filter((report) => reportingWeek(report.date).ending === ending)
  return handlers.map((handler) => {
    const report = week.filter((r) => Number.isFinite(Date.parse(r[confirmationKey(handler)]?.at??''))).sort((a, b) => Date.parse(b[confirmationKey(handler)]!.at) - Date.parse(a[confirmationKey(handler)]!.at))[0]
    const confirmation = report?.[confirmationKey(handler)]
    const assigned = activities.filter((a) => a.editable && a.handler === handler)
    const revised = !!confirmation && week.some((r)=>r.status==='draft') && (assigned.length !== confirmation.assignedCount || assigned.some((a) => Date.parse(a.updatedAt ?? '') > Date.parse(confirmation.at)))
    const legacy = week.length > 0 && week.every((r)=>r.status==='final'&&!r.startedBy&&!handlers.some((h)=>r[confirmationKey(h)]))
    const status = legacy ? 'Not recorded' : revised ? 'Needs review' : confirmation ? Date.parse(confirmation.at) < deadline ? 'Updated' : 'Updated late' : now >= deadline ? 'Overdue' : 'Not yet updated'
    return { handler, status, confirmation, complete: !!confirmation && !revised }
  })
}
