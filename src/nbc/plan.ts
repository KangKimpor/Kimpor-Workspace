/**
 * Contract dates and planned cumulative progress for BP-03.
 * Taken from "S-Curve BP03" and "PI(p)" in the weekly report no. 24 (18 to 24 Oct 2026).
 * Only the plan is copied. Current and past progress always come from the app's own updates.
 * The workbook types the S-curve weeks as 2025; they line up with the 2026 contract dates, so 2026 is used here.
 */
export const NBC_PLAN = {
  commencement: '2026-03-18',
  completion: '2026-06-20',
  source: 'BP-03 weekly report no. 24',
  points: [
    ['2026-03-18', 0], ['2026-03-22', .1], ['2026-03-29', .22], ['2026-04-05', .3], ['2026-04-12', .43], ['2026-04-19', .47],
    ['2026-04-26', .53], ['2026-05-03', .63], ['2026-05-10', .75], ['2026-05-17', .8], ['2026-05-24', .85], ['2026-05-31', .9],
    ['2026-06-07', .93], ['2026-06-14', .97], ['2026-06-20', 1],
  ] as readonly (readonly [string, number])[],
} as const

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000
/** Whole days from one date to another (negative when the second is earlier). */
export const daysBetween = (from: string, to: string) => Math.round(day(to) - day(from))

/** Planned cumulative progress on a date, interpolated between the report's weekly points. */
export function plannedProgress(date: string, points = NBC_PLAN.points) {
  const first = points[0]!, last = points.at(-1)!
  if (date <= first[0]) return first[1]
  if (date >= last[0]) return last[1]
  const i = points.findIndex((p) => p[0] >= date), [d1, v1] = points[i]!, [d0, v0] = points[i - 1]!
  return v0 + (v1 - v0) * (daysBetween(d0, date) / daysBetween(d0, d1))
}

/** Calendar days left to the contract completion date. Negative once it has passed. */
export const daysToCompletion = (today: string, completion = NBC_PLAN.completion) => daysBetween(today, completion)
export const planDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
