import { expect, test } from 'vitest'
import { fixtureActivities } from './test-fixture'
import { addDays, assertEditableWeek, canUpdate, submissionId, transitionSubmission, weekDeadline, weekStart } from './submissions'
import type { SubmissionState } from './submissions'
import type { Handler, NbcSubmission } from './types'

const now = new Date('2026-10-27T07:05:00Z'), week = '2026-10-26'
function draft(handler: Handler, date = week, progress = .5): NbcSubmission {
  const a = fixtureActivities().find((a) => a.handler === handler)!
  return { id: submissionId('nbc-bp03', date, handler), projectId: 'nbc-bp03', weekStart: date, handler, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note: '', updatedAt: now.toISOString(), entries: [{ activityId: a.id, previous: a.progress, progress, remark: 'Site update' }] }
}
const initial = (): SubmissionState => ({ activities: fixtureActivities(), submissions: [draft('Tola')], summaries: [] })
test('Monday weeks, year boundaries, Phnom Penh midnight and Saturday noon deadline', () => {
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
  expect(weekStart('2026-11-01')).toBe(week)
  expect(weekStart('2026-11-02')).toBe('2026-11-02')
  expect(weekDeadline(week)).toBe(Date.parse('2026-10-31T05:00:00Z'))
  expect(() => weekStart('2026-02-30')).toThrow()
  expect(() => assertEditableWeek(addDays(week, -14), now)).toThrow('Only this week')
  expect(() => assertEditableWeek(addDays(week, 7), now)).toThrow()
  assertEditableWeek(addDays(week, -7), now)
})
test('confirming before Saturday noon is on time, at noon or after is late, and Sunday is still this week', () => {
  const at = (iso: string) => transitionSubmission(initial(), initial().submissions[0]!.id, 'confirm', 'actor', new Date(iso)).submissions[0]!.late
  expect(at('2026-10-31T04:59:59Z')).toBe(false)
  expect(at('2026-10-31T05:00:00Z')).toBe(true)
  expect(at('2026-11-01T10:00:00Z')).toBe(true)
  expect(weekStart('2026-11-01')).toBe(week)
})
test('drafts stay separate; confirm, reopen, reconfirm, delete and audit are consistent', () => {
  const start = initial(), id = start.submissions[0]!.id
  expect(start.activities[3]!.progress).toBe(.25)
  let s = transitionSubmission(start, id, 'confirm', 'actor', now)
  expect(s.activities[3]!.progress).toBe(.5)
  expect(s.activities[3]!.history[0]!.editor).toBe('actor')
  expect(s.summaries.find((r) => r.weekStart === week)!.overall).toBeCloseTo(.5)
  s = transitionSubmission(s, id, 'reopen', 'actor', now)
  expect(s.activities[3]!.progress).toBe(.5)
  s.submissions[0]!.entries[0]!.progress = .75
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.25)
  s = transitionSubmission(s, id, 'delete', 'actor', now)
  expect(s.activities[3]!.progress).toBe(.25)
  expect(s.activities[3]!.history).toHaveLength(3)
})
test('undo is short-lived, restores values, and keeps the editable autosaved draft', () => {
  let s = initial(), id = s.submissions[0]!.id
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  expect(() => transitionSubmission(s, id, 'undo', 'other', now)).toThrow()
  expect(() => transitionSubmission(s, id, 'undo', 'actor', new Date(+now + 11000))).toThrow('expired')
  s = transitionSubmission(s, id, 'undo', 'actor', now)
  expect(s.activities[3]!.progress).toBe(.25)
  expect(s.submissions[0]!.entries[0]!.progress).toBe(.5)
  expect(s.submissions[0]!.status).toBe('draft')
})
test('editing/deleting last week rechains this week and freezes older summaries', () => {
  let s = initial(), last = draft('Tola', addDays(week, -7), .4)
  s.submissions = [last]
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.late).toBe(true)
  s.submissions.push(draft('Tola', week, .8))
  const currentId = s.submissions[1]!.id
  s = transitionSubmission(s, currentId, 'confirm', 'actor', now)
  s.summaries.push({ id: 'frozen', projectId: 'nbc-bp03', weekStart: '2026-01-05', overall: .3, previous: .2, contributions: {}, updatedAt: 'unchanged' })
  s = transitionSubmission(s, last.id, 'reopen', 'actor', now)
  s.submissions[0]!.entries[0]!.progress = .6
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions.find((r) => r.id === currentId)!.entries[0]!.previous).toBe(.6)
  expect(s.activities[3]!.progress).toBe(.8)
  expect(s.summaries.find((r) => r.weekStart === addDays(week, -7))!.overall).toBeCloseTo(.56)
  s = transitionSubmission(s, last.id, 'delete', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.25)
  expect(s.summaries.find((r) => r.id === 'frozen')!.updatedAt).toBe('unchanged')
  s.submissions[0]!.weekStart = '2026-01-05'
  for (const operation of ['confirm','reopen','delete','undo'] as const) expect(() => transitionSubmission(s, currentId, operation, 'actor', now)).toThrow('Only this week')
})
test('all handlers may edit shared GR&P; stale shared changes and foreign activities are rejected', () => {
  let s = initial(), id = s.submissions[0]!.id
  expect(canUpdate(s.activities[0]!, 'Sitha')).toBe(true)
  s.submissions[0]!.entries.push({ activityId: 'nbc:GR&P', previous: 0, progress: .3, remark: 'Shared' })
  s.activities[0]!.updatedAt = '2026-10-27T01:00:00Z'
  expect(() => transitionSubmission(s, id, 'confirm', 'actor', now)).toThrow('GR&P changed')
  s.submissions[0]!.entries[1]!.baseRevision = s.activities[0]!.updatedAt
  s = transitionSubmission(s, id, 'confirm', 'actor', now)
  expect(s.activities[0]!.progress).toBe(.3)
  expect(s.summaries.find((r) => r.weekStart === week)!.overall).toBeCloseTo(.56)
  s = transitionSubmission(s, id, 'reopen', 'actor', now)
  s.submissions[0]!.entries[0]!.activityId = 'nbc:1.6.1.1'
  expect(() => transitionSubmission(s, id, 'confirm', 'actor', now)).toThrow('only your activities')
})

test('unconfirmed current drafts are re-chained and the late flag flips at Saturday noon', () => {
  let s = initial(), last = draft('Tola', addDays(week, -7), .4)
  s.submissions.push(last)
  s = transitionSubmission(s, last.id, 'confirm', 'actor', now)
  expect(s.submissions[0]!.entries[0]!.previous).toBe(.4)
  let onTime = initial()
  onTime = transitionSubmission(onTime, onTime.submissions[0]!.id, 'confirm', 'actor', new Date('2026-10-31T04:59:59.999Z'))
  expect(onTime.submissions[0]!.late).toBe(false)
  const late = transitionSubmission(initial(), initial().submissions[0]!.id, 'confirm', 'actor', new Date('2026-10-31T05:00:00Z'))
  expect(late.submissions[0]!.late).toBe(true)
})
