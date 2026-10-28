import { expect, test } from 'vitest'
import { daysToCompletion, NBC_PLAN, plannedProgress } from './plan'

test('plan points come from the weekly report: start at 0, finish at 100% on the completion date', () => {
  expect(NBC_PLAN.points).toHaveLength(15)
  expect(NBC_PLAN.points[0]).toEqual(['2026-03-18', 0])
  expect(NBC_PLAN.points.at(-1)).toEqual([NBC_PLAN.completion, 1])
  expect(NBC_PLAN.points.every((p, i, all) => i === 0 || (p[0] > all[i - 1]![0] && p[1] >= all[i - 1]![1]))).toBe(true)
})

test('planned progress interpolates between weekly points and clamps at both ends', () => {
  expect(plannedProgress('2026-01-01')).toBe(0)
  expect(plannedProgress('2026-03-29')).toBeCloseTo(.22, 10)
  expect(plannedProgress('2026-04-02')).toBeCloseTo(.22 + (.3 - .22) * 4 / 7, 10)
  expect(plannedProgress('2026-10-28')).toBe(1)
})

test('days to completion count down to the contract date and go negative afterwards', () => {
  expect(daysToCompletion('2026-06-10')).toBe(10)
  expect(daysToCompletion('2026-06-20')).toBe(0)
  expect(daysToCompletion('2026-10-28')).toBe(-130)
})
