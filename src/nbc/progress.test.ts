import { beforeEach, expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { calculate, parseProgress, percentage, summarize, visibleHierarchy } from './progress'
import { fixtureActivities, fixtureProject } from './test-fixture'
import { assignActivities, updateActivity } from './actions'
import { emptyContent, useWorkspace } from '@/data'
import type { NbcActivity } from './types'

beforeEach(() => { localStorage.clear(); useWorkspace.setState({ ...structuredClone(emptyContent), projects: [fixtureProject], nbc_activities: fixtureActivities(), scope: 'guest' }) })

test('live progress and remarks require confirmation; reassignment remains audited', () => {
  expect(() => updateActivity('nbc:1.6.1.2', { progress: .5 })).toThrow('handler draft')
  expect(() => updateActivity('nbc:1.6.1.2', { remark: 'Draft only' })).toThrow('handler draft')
  updateActivity('nbc:1.6.1.2', { handler: 'Sitha' })
  expect(useWorkspace.getState().nbc_activities![3]!.history.at(-1)!.handler).toBe('Sitha')
})

test('percentage entry accepts decimals and percent signs, clamps bounds and rejects invalid text', () => {
  expect(parseProgress(' 37.5% ').progress).toBe(0.375)
  expect(parseProgress('.25').progress).toBe(0.0025)
  expect(parseProgress('101')).toEqual({ progress: 1, message: 'Progress must be between 0% and 100%.' })
  expect(parseProgress('-0.5').progress).toBe(0)
  for (const input of ['', '%', 'NaN', 'abc', '50%%', '1.2.3', 'Infinity']) expect(() => parseProgress(input)).toThrow('numeric')
})
test('bulk handler reassignment preserves percentages and records each changed assignment', () => {
  assignActivities(['nbc:1.6.1.1','nbc:1.6.1.2'], 'Kheng')
  const activities = useWorkspace.getState().nbc_activities!
  expect(activities[2]?.handler).toBe('Kheng')
  expect(activities[3]?.handler).toBe('Kheng')
  expect(activities[2]?.progress).toBe(1)
  expect(activities[3]?.progress).toBe(0.25)
  expect(activities[3]?.history[0]?.handler).toBe('Kheng')
  expect(() => assignActivities(['nbc:1.6.1'], 'Tola')).toThrow('editable')
})

test('weighted hierarchy counts only leaves and GR&P once; fractions retain precision', () => {
  const activities = fixtureActivities(), c = calculate(activities)
  expect(c.overall).toBeCloseTo(0.35, 14)
  expect(c.progress.get('nbc:1.6.1')).toBeCloseTo(0.4375, 14)
  activities[0]!.progress = 0.375
  expect(calculate(activities).overall).toBeCloseTo(0.425, 14)
  expect(summarize(activities.filter((a) => a.handler === 'Tola')).contribution).toBeCloseTo(0.15, 14)
})
test('zero weights, downward corrections and propagation; invalid input is rejected', () => {
  const activities = fixtureActivities()
  activities[3]!.progress = 0.123456789
  expect(calculate(activities).overall).toBeCloseTo(0.2 + 0.6 * 0.123456789, 14)
  activities[3]!.globalWeight = 0; activities[3]!.relativeWeight = 0
  expect(calculate(activities).progress.get('nbc:1.6.1')).toBe(1)
  activities[2]!.relativeWeight = 0
  expect(calculate(activities).progress.get('nbc:1.6.1')).toBe(0)
  for (const value of [-1, 1.01, NaN, Infinity]) expect(() => percentage(value)).toThrow()
  activities[0]!.globalWeight = NaN
  expect(() => calculate(activities)).toThrow('Invalid weight')
})
test('invalid relationships, duplicate nodes and cycles are rejected', () => {
  const a = fixtureActivities()
  expect(() => calculate([...a, a[0]!])).toThrow('Duplicate')
  a[3]!.parentId = 'missing'; expect(() => calculate(a)).toThrow('Missing parent')
  a[3]!.parentId = a[1]!.id; a[1]!.parentId = a[1]!.id
  expect(() => calculate(a)).toThrow('Cyclic')
})
test('filters preserve ancestors, collapse works, and sorting preserves grouping', () => {
  const a = fixtureActivities(), p = calculate(a).progress
  expect(visibleHierarchy(a, () => true, new Set([a[1]!.id]), 'wbs', p)).toHaveLength(2)
  expect(visibleHierarchy(a, (n) => n.handler === 'Tola', new Set(), 'progress', p).map((r) => r.activity.wbs)).toEqual(['1.6.1', '1.6.1.2'])
  expect(visibleHierarchy(a, (n) => n.handler === 'Tola', new Set([a[1]!.id]), 'wbs', p).map((r) => r.activity.wbs)).toEqual(['1.6.1'])
})
test('task WBS links remain in their project and clear when a task moves', () => {
  const state = useWorkspace.getState()
  const task = state.addTask({ title: 'Inspection', projectId: fixtureProject.id, nbcActivityId: 'nbc:1.6.1.2' })
  expect(() => state.updateTask(task, { nbcActivityId: 'missing' })).toThrow('same NBC')
  expect(() => state.updateTask(task, { nbcActivityId: 'nbc:1.6.1' })).toThrow('same NBC')
  const standard = state.addProject('Standard', 'personal')
  expect(() => state.addTask({ title: 'Wrong link', projectId: standard, nbcActivityId: 'nbc:1.6.1.2' })).toThrow('same NBC')
  state.updateTask(task, { projectId: standard })
  expect(useWorkspace.getState().tasks.find((t) => t.id === task)?.nbcActivityId).toBeNull()
})
const privatePath = '.private/nbc-bp03/initial.json'
test.skipIf(!existsSync(privatePath))('private workbook reconciliation: all 790 nodes, 561 handlers, every parent and effective weight', () => {
  const { activities, reconciliation: r } = JSON.parse(readFileSync(privatePath, 'utf8')) as { activities: NbcActivity[]; reconciliation: { overall: number; boqValue: number; handlers: Record<string, number> } }
  const c = calculate(activities)
  expect(activities).toHaveLength(790)
  expect(c.leaves).toHaveLength(562)
  expect(c.leaves.filter((a) => a.handler)).toHaveLength(561)
  for (const [handler, count] of Object.entries(r.handlers)) expect(c.leaves.filter((a) => a.handler === handler)).toHaveLength(count)
  expect(c.overall).toBeCloseTo(r.overall, 13)
  expect(c.overall * 100).toBeCloseTo(42.023278891, 8)
  expect(c.leaves.reduce((s, a) => s + a.globalWeight, 0)).toBeCloseTo(1, 13)
  expect(activities.filter((a) => !a.parentId).reduce((s, a) => s + (a.boqValue ?? 0), 0)).toBeCloseTo(r.boqValue, 7)
  for (const a of activities) expect(c.progress.get(a.id), a.wbs).toBeCloseTo(a.progress, 12)
  const contributions = [...Object.keys(r.handlers), ''].map((handler) => summarize(c.leaves.filter((a) => (a.handler || '') === handler)).contribution)
  expect(contributions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(c.overall, 13)
  for (const handler of Object.keys(r.handlers)) {
    const summary = summarize(c.leaves.filter((a) => a.handler === handler))
    expect(summary.contribution).toBeLessThanOrEqual(summary.weight)
    const expanded = visibleHierarchy(activities, (a) => a.handler === handler, new Set(), 'wbs', c.progress)
    const group = expanded.find((row) => !row.activity.editable)!.activity
    const collapsed = visibleHierarchy(activities, (a) => a.handler === handler, new Set([group.id]), 'wbs', c.progress)
    expect(collapsed.length).toBeLessThan(expanded.length)
    expect(collapsed.some((row) => row.activity.wbs.startsWith(group.wbs + '.'))).toBe(false)
  }
  const leaf = c.leaves.find((a) => a.handler)!, prior = leaf.progress
  leaf.progress = 0.123456789
  expect(calculate(activities).overall).toBeCloseTo(c.overall + leaf.globalWeight * (leaf.progress - prior), 13)
})
