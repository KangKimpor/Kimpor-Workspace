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
/** BP02 PI(p)!B28/D28 (contract dates) and SC(p)!B52:BF52 / B55:BF55 (projected cumulative ratio) from
 * "BP-02 Weekly 58 - 18 Oct - 24 Oct 2026". Only these dates and ratios are used. The report's dates are real 2025-2026
 * dates, so no year alignment is applied. The 0% point on the commencement date anchors the curve.
 */
export const BP02_PLAN: NbcPlan = {
  commencement: '2025-09-01', completion: '2026-06-20', source: 'BP-02 weekly report no. 58',
  points: [
    ['2025-09-01', 0], ['2025-09-14', 0.01], ['2025-09-21', 0.02], ['2025-09-28', 0.03], ['2025-10-05', 0.04],
    ['2025-10-12', 0.06], ['2025-10-19', 0.08], ['2025-10-26', 0.1], ['2025-11-02', 0.12], ['2025-11-09', 0.14],
    ['2025-11-16', 0.16], ['2025-11-23', 0.18], ['2025-11-30', 0.2], ['2025-12-07', 0.22], ['2025-12-14', 0.24],
    ['2025-12-21', 0.26], ['2025-12-28', 0.28], ['2026-01-04', 0.3], ['2026-01-11', 0.32], ['2026-01-18', 0.34],
    ['2026-01-25', 0.36], ['2026-02-01', 0.39], ['2026-02-08', 0.42], ['2026-02-15', 0.46], ['2026-02-22', 0.5],
    ['2026-03-01', 0.54], ['2026-03-08', 0.58], ['2026-03-15', 0.6], ['2026-03-25', 0.66], ['2026-03-29', 0.7],
    ['2026-04-05', 0.74], ['2026-04-12', 0.78], ['2026-04-19', 0.83], ['2026-04-26', 0.88], ['2026-05-03', 0.91],
    ['2026-05-11', 0.94], ['2026-05-16', 0.96], ['2026-05-23', 0.98], ['2026-05-30', 0.99], ['2026-06-06', 0.995],
    ['2026-06-13', 1], ['2026-06-29', 1], ['2026-07-11', 1], ['2026-07-18', 1], ['2026-07-25', 1],
    ['2026-08-01', 1], ['2026-08-08', 1], ['2026-08-15', 1], ['2026-08-22', 1], ['2026-08-29', 1],
    ['2026-09-05', 1], ['2026-09-11', 1], ['2026-09-19', 1], ['2026-09-26', 1], ['2026-10-03', 1],
    ['2026-10-10', 1], ['2026-10-17', 1], ['2026-10-24', 1],
  ],
}
export const projectPlan = (projectId: string): NbcPlan => projectId === 'nbc-bp04' ? BP04_PLAN : projectId === 'nbc-bp02' ? BP02_PLAN : NBC_PLAN

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
