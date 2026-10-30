import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import { fixtureTemplate } from '../export/test-template'
import { weeklyWorkbook } from '../export/workbook'
import { importPercentages } from './workbook'
import { importDrafts } from './actions'
import { readHandlerDraft, writeHandlerDraft } from '../drafts'
import { confirmUpdate, reopenUpdate } from '../submission-actions'
import type { NbcActivity } from '../types'

const week = '2026-10-26'
const workbook = () => weeklyWorkbook(fixtureTemplate(), fixtureActivities(), [], week).bytes
function patch(file: Uint8Array, sheet: number, address: string, content: string) {
  const files = unzipSync(file), name = `xl/worksheets/sheet${sheet}.xml`
  const doc = new DOMParser().parseFromString(strFromU8(files[name]!), 'application/xml')
  const cell = [...doc.getElementsByTagName('c')].find(c => c.getAttribute('r') === address)!
  cell.innerHTML = content; cell.removeAttribute('t')
  files[name] = strToU8(new XMLSerializer().serializeToString(doc))
  return zipSync(files)
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-30T03:00:00Z')); localStorage.clear(); useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() }) })
afterEach(() => vi.useRealTimers())

test('imports handler accumulation instead of stale master caches; calculates weighted totals and never imports parents', () => {
  const file = patch(workbook(), 7, 'M6', '<v>0.625</v>')
  const parsed = importPercentages(file, fixtureActivities())
  expect(parsed.values.size).toBe(3)
  expect(parsed.values.get('nbc:1.6.1.2')).toBe(.625)
  expect(parsed.overall).toBeCloseTo(.575, 12)
})
test('rejects blank, formula, invalid range, wrong WBS, missing and duplicate handler input', () => {
  for (const content of ['', '<v>101</v>', '<v>-0.1</v>', '<v>NaN</v>', '<f>1/2</f><v>0.5</v>']) expect(() => importPercentages(patch(workbook(), 7, 'M6', content), fixtureActivities())).toThrow()
  expect(() => importPercentages(workbook(), fixtureActivities().slice(1))).toThrow('do not match')
  expect(() => importPercentages(fixtureTemplate(), fixtureActivities())).toThrow('Duplicate')
  const files = unzipSync(workbook()); files['xl/worksheets/sheet7.xml'] = strToU8(strFromU8(files['xl/worksheets/sheet7.xml']!).replace('1.6.1.2</t>', '1.6.1.999</t>'))
  expect(() => importPercentages(zipSync(files), fixtureActivities())).toThrow('Unknown WBS')
  files['xl/worksheets/sheet7.xml'] = strToU8(strFromU8(files['xl/worksheets/sheet7.xml']!).replace(/<row r="6"[^>]*>[\s\S]*?<\/row>/, ''))
  expect(() => importPercentages(zipSync(files), fixtureActivities())).toThrow('Missing')
})
test('atomic imports preserve other projects, persist drafts and use the existing confirmation/history path', async () => {
  const other = fixtureActivities().map(a => ({ ...a, id: a.id.replace('nbc:', 'nbc-bp04:'), parentId: a.parentId?.replace('nbc:', 'nbc-bp04:') ?? null, projectId: 'nbc-bp04' }))
  useWorkspace.setState({ projects: [fixtureProject, { ...fixtureProject, id: 'nbc-bp04' }], nbc_activities: [...fixtureActivities(), ...other] })
  const parsed = importPercentages(patch(workbook(), 7, 'M6', '<v>0.625</v>'), fixtureActivities())
  expect(importDrafts('nbc-bp03', week, parsed.values, '', '')).toEqual(['Tola'])
  expect(useWorkspace.getState().nbc_activities).toEqual([...fixtureActivities(), ...other])
  expect(JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_submissions[0].entries[0].progress).toBe(.625)
  await confirmUpdate(week, 'Tola', 'nbc-bp03')
  expect(useWorkspace.getState().nbc_activities?.filter(a => a.projectId === 'nbc-bp04')).toEqual(other)
  expect(useWorkspace.getState().nbc_activities?.find(a => a.id === 'nbc:1.6.1.2')?.history).toHaveLength(1)
})
test('refuses existing drafts/raw recovery/confirmed updates, lowered values without a reason and ambiguous GR&P', () => {
  const parsed = importPercentages(patch(workbook(), 7, 'M6', '<v>0.625</v>'), fixtureActivities())
  writeHandlerDraft('guest', fixtureProject.id, week, 'Tola', { values: {}, note: 'unsaved' })
  expect(() => importDrafts(fixtureProject.id, week, parsed.values, '', '')).toThrow('already has')
  localStorage.clear()
  parsed.values.set('nbc:1.6.1.1', .5)
  expect(() => importDrafts(fixtureProject.id, week, parsed.values, '', '')).toThrow('reason')
  parsed.values.set('nbc:GR&P', .2)
  expect(() => importDrafts(fixtureProject.id, week, parsed.values, '', 'Correction')).toThrow('GR&P')
  importDrafts(fixtureProject.id, week, parsed.values, 'Sitha', 'Correction')
  expect(useWorkspace.getState().nbc_submissions?.flatMap(s => s.entries).filter(e => e.activityId === 'nbc:GR&P')).toHaveLength(1)
  const before = structuredClone(useWorkspace.getState().nbc_submissions)
  expect(() => importDrafts(fixtureProject.id, week, parsed.values, 'Sitha', 'Correction')).toThrow('already has')
  expect(useWorkspace.getState().nbc_submissions).toEqual(before)
  importDrafts(fixtureProject.id, week, parsed.values, 'Sitha', 'Correction', true)
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(2)
})
test.skipIf(!existsSync('.private/nbc-bp04/initial.json'))('accepts the supplied real BP04 workbook and reconciles every editable percentage', () => {
  const { activities } = JSON.parse(readFileSync('.private/nbc-bp04/initial.json', 'utf8')) as { activities: NbcActivity[] }
  const parsed = importPercentages(new Uint8Array(readFileSync('.private/nbc-bp04/template.xlsx')), activities)
  expect(parsed.values.size).toBe(284)
  expect(parsed.overall).toBe(0)
  for (const a of activities.filter(a => a.editable)) expect(parsed.values.get(a.id)).toBe(a.progress)
  expect(() => importPercentages(new Uint8Array(readFileSync('.private/nbc-bp04/template.xlsx')), fixtureActivities())).toThrow('do not match')
})
test('a conflict in a later handler leaves every draft unchanged; explicit replacement survives confirm/edit/reimport', async () => {
  const values = importPercentages(patch(workbook(), 7, 'M6', '<v>0.625</v>'), fixtureActivities()).values
  values.set('nbc:1.6.1.1', .5)
  writeHandlerDraft('guest', fixtureProject.id, week, 'Tola', { values: {}, note: 'keep me' })
  expect(() => importDrafts(fixtureProject.id, week, values, '', 'Correction')).toThrow('already has')
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(0)
  importDrafts(fixtureProject.id, week, values, '', 'Correction', true)
  expect(readHandlerDraft('guest', fixtureProject.id, week, 'Tola')).toBeNull()
  await confirmUpdate(week, 'Tola')
  values.set('nbc:1.6.1.2', .75)
  expect(() => importDrafts(fixtureProject.id, week, values, '', 'Correction', true)).toThrow('confirmed update')
  await reopenUpdate(week, 'Tola')
  importDrafts(fixtureProject.id, week, values, '', 'Correction', true)
  expect(useWorkspace.getState().nbc_activities?.find(a => a.id === 'nbc:1.6.1.2')?.progress).toBe(.625)
  expect(useWorkspace.getState().nbc_submissions?.find(s => s.handler === 'Tola')?.entries.find(e => e.activityId === 'nbc:1.6.1.2')?.progress).toBe(.75)
})
