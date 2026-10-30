/**
 * Contract dates and planned cumulative progress for BP-03.
 * Taken from "S-Curve BP03" and "PI(p)" in the weekly report no. 24 (18 to 24 Oct 2026).
 * Only the plan is copied. Current and past progress always come from the app's own updates.
 * The workbook types the S-curve weeks as 2025; they line up with the 2026 contract dates, so 2026 is used here.
 */
export interface NbcPlan { commencement: string; completion: string; source: string; points: readonly (readonly [string, number])[] }

export const NBC_PLAN: NbcPlan = {
  commencement: '2026-03-18',
  completion: '2026-06-20',
  source: 'BP-03 weekly report no. 24',
  points: [
    ['2026-03-18', 0], ['2026-03-22', .1], ['2026-03-29', .22], ['2026-04-05', .3], ['2026-04-12', .43], ['2026-04-19', .47],
    ['2026-04-26', .53], ['2026-05-03', .63], ['2026-05-10', .75], ['2026-05-17', .8], ['2026-05-24', .85], ['2026-05-31', .9],
    ['2026-06-07', .93], ['2026-06-14', .97], ['2026-06-20', 1],
  ] as readonly (readonly [string, number])[],
} as const

/** BP04 PI(p)!B27/D27 and S-Curve BP04!B44:AH44/B47:AH47.
 * Only construction dates and projected cumulative ratios are used.
 * Source curve dates say 2025; user approved alignment to contract year 2026.
 */
export const BP04_PLAN: NbcPlan = {
  commencement: '2026-03-18', completion: '2026-06-20', source: 'BP-04 weekly report no. 23',
  points: [
    ['2026-03-18', 0], ['2026-03-22', .02], ['2026-03-29', .05], ['2026-04-05', .09], ['2026-04-12', .19],
    ['2026-04-19', .25], ['2026-04-26', .3], ['2026-05-03', .43], ['2026-05-10', .59], ['2026-05-17', .74],
    ['2026-05-24', .81], ['2026-05-31', .89], ['2026-06-07', .93], ['2026-06-14', .98], ['2026-06-20', 1],
    ['2026-06-26', 1], ['2026-07-03', 1], ['2026-07-10', 1], ['2026-07-17', 1], ['2026-07-25', 1],
    ['2026-08-01', 1], ['2026-08-08', 1], ['2026-08-15', 1], ['2026-08-22', 1], ['2026-08-29', 1],
    ['2026-09-05', 1], ['2026-09-11', 1], ['2026-09-19', 1], ['2026-09-26', 1], ['2026-10-03', 1],
    ['2026-10-10', 1], ['2026-10-17', 1], ['2026-10-24', 1],
  ],
}
export const projectPlan = (projectId: string) => projectId === 'nbc-bp04' ? BP04_PLAN : NBC_PLAN

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
