import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from './test-fixture'
import { confirmUpdate, deleteUpdate, draftEntries, reopenUpdate, saveDraft } from './submission-actions'
import { calculate } from './progress'
import { BP04_PLAN, NBC_PLAN, plannedProgress, projectPlan } from './plan'
import { reportFilename, weeklyWorkbook } from './export/workbook'
import { strFromU8, unzipSync } from 'fflate'
import type { NbcActivity } from './types'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T03:00:00Z')); localStorage.clear() })
afterEach(() => vi.useRealTimers())

test('both projects isolate drafts, confirm/reopen/delete, shared GR&P, summaries and audit history', async () => {
  const bp04 = fixtureActivities().map(a => ({ ...a, id: a.id.replace('nbc:', 'nbc-bp04:'), parentId: a.parentId?.replace('nbc:', 'nbc-bp04:') ?? null, projectId: 'nbc-bp04' }))
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject, { ...fixtureProject, id: 'nbc-bp04' }], nbc_activities: [...fixtureActivities(), ...bp04] })
  const snapshot = (id: string) => JSON.stringify({ activities: useWorkspace.getState().nbc_activities?.filter(a => a.projectId === id), submissions: useWorkspace.getState().nbc_submissions?.filter(a => a.projectId === id), summaries: useWorkspace.getState().nbc_summaries?.filter(a => a.projectId === id) })
  for (const [id, other] of [['nbc-bp04', 'nbc-bp03'], ['nbc-bp03', 'nbc-bp04']]) {
    const untouched = snapshot(other!)
    const entries = draftEntries('2026-10-26', 'Tola', id).map(e => ({ ...e, progress: .6 }))
    saveDraft('2026-10-26', 'Tola', entries, '', id)
    await confirmUpdate('2026-10-26', 'Tola', id)
    expect(snapshot(other!)).toBe(untouched)
    await reopenUpdate('2026-10-26', 'Tola', id)
    await deleteUpdate('2026-10-26', 'Tola', id)
    expect(snapshot(other!)).toBe(untouched)
  }
  expect(() => draftEntries('2026-10-26', 'Tola', 'missing')).toThrow('not initialized')
  expect(() => saveDraft('2026-10-26', 'Tola', draftEntries('2026-10-26', 'Tola', 'nbc-bp03'), '', 'nbc-bp04')).toThrow('only your')
})

test('BP04 plan is independent and uses only the approved report dates/projected ratios', () => {
  expect(projectPlan('nbc-bp03')).toBe(NBC_PLAN)
  expect(projectPlan('nbc-bp04')).toBe(BP04_PLAN)
  expect(BP04_PLAN.commencement).toBe('2026-03-18')
  expect(BP04_PLAN.completion).toBe('2026-06-20')
  expect(BP04_PLAN.points).toHaveLength(33)
  expect(plannedProgress('2026-04-05', BP04_PLAN.points)).toBe(.09)
  expect(plannedProgress('2026-04-05', NBC_PLAN.points)).toBe(.3)
  expect(reportFilename('2026-10-26', 'nbc-bp04')).toContain('NBC-BP04-')
})

test.skipIf(!existsSync('.private/nbc-bp04/initial.json'))('private BP04 BOQ reconciles every parent, weights and export totals', () => {
  const { activities, reconciliation } = JSON.parse(readFileSync('.private/nbc-bp04/initial.json', 'utf8')) as { activities: NbcActivity[]; reconciliation: { boqValue: number; workbookOverall: number } }
  const c = calculate(activities)
  expect(activities).toHaveLength(382); expect(c.leaves).toHaveLength(284)
  expect(c.overall).toBe(reconciliation.workbookOverall)
  expect(c.leaves.reduce((s, a) => s + a.globalWeight, 0)).toBeCloseTo(1, 12)
  expect(activities.filter(a => !a.parentId).reduce((s, a) => s + (a.boqValue ?? 0), 0)).toBe(reconciliation.boqValue)
  for (const a of activities) expect(c.progress.get(a.id)).toBeCloseTo(a.progress, 12)
  const template = new Uint8Array(readFileSync('.private/nbc-bp04/template.xlsx'))
  const output = unzipSync(weeklyWorkbook(template, activities, [], '2026-10-26').bytes)
  const doc = new DOMParser().parseFromString(strFromU8(output['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(doc.querySelector('c[r="N5"] v')?.textContent).toBe('0')
  const leaf = c.leaves.find(a => a.handler === 'Tola')!
  const edited = activities.map(a => a.id === leaf.id ? { ...a, progress: .5 } : a)
  expect(calculate(edited).overall).toBeCloseTo(leaf.globalWeight * .5, 14)
  const editedFiles = unzipSync(weeklyWorkbook(template, edited, [], '2026-10-26').bytes)
  const editedDoc = new DOMParser().parseFromString(strFromU8(editedFiles['xl/worksheets/sheet1.xml']!), 'application/xml')
  expect(Number(editedDoc.querySelector('c[r="N5"] v')?.textContent)).toBeCloseTo(leaf.globalWeight * .5, 14)
  expect(() => weeklyWorkbook(template, fixtureActivities(), [], '2026-10-26')).toThrow('do not match')
})
