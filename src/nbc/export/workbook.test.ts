import { expect, test } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { fixtureActivities } from '../test-fixture'
import type { NbcSubmission } from '../types'
import { fixtureTemplate } from './test-template'
import { confirmedCount, reportFilename, reportingBlock, reportValues, weeklyWorkbook } from './workbook'

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

test('report filenames use full Sunday–Saturday dates, including month and year boundaries', () => {
  expect(reportFilename('2026-10-19')).toBe('NBC-BP03-Progress Tracking by BOQ-(18 October to 24 October).xlsx')
  expect(reportingBlock('2026-11-02')).toBe('1 November to 7 November')
  expect(reportingBlock('2026-12-28')).toBe('27 December to 2 January')
  expect(() => reportingBlock('2026-10-18')).toThrow('reporting week')
})

function cell(files: Record<string, Uint8Array>, sheet: number, address: string) {
  const doc = new DOMParser().parseFromString(strFromU8(files[`xl/worksheets/sheet${sheet}.xml`]!), 'application/xml')
  return [...doc.getElementsByTagNameNS(NS, 'c')].find(c => c.getAttribute('r') === address)!
}
const submission = (week: string, previous: number, progress: number): NbcSubmission => ({ id: week, projectId: 'nbc-bp03', weekStart: week, handler: 'Tola', status: 'confirmed', confirmedAt: `${week}T08:00:00Z`, confirmedBy: 'guest', late: false, note: '', updatedAt: '', entries: [{ activityId: 'nbc:1.6.1.2', previous, progress, remark: '' }] })

test('weekly snapshots roll back later weeks and exclude reopened draft edits', () => {
  const activities = fixtureActivities().map(a => a.id === 'nbc:1.6.1.2' ? { ...a, progress: .5 } : a)
  const last = submission('2026-10-19', .1, .25), current = submission('2026-10-26', .25, .5)
  const earlier = reportValues(activities, [last, current], '2026-10-19')
  expect(earlier.current.progress.get('nbc:1.6.1.2')).toBe(.25)
  expect(earlier.previous.progress.get('nbc:1.6.1.2')).toBe(.1)
  const reopened: NbcSubmission = { ...current, status: 'draft', appliedEntries: current.entries, entries: [{ ...current.entries[0]!, progress: .9 }] }
  expect(reportValues(activities, [last, reopened], '2026-10-26').current.progress.get('nbc:1.6.1.2')).toBe(.5)
})

test('export keeps unrelated parts, numeric percentages, template layout and live formulas', () => {
  const template = fixtureTemplate(), source = unzipSync(template)
  const output = unzipSync(weeklyWorkbook(template, fixtureActivities(), [], '2026-10-26').bytes)
  expect(output['xl/styles.xml']).toEqual(source['xl/styles.xml'])
  expect(output['xl/comments1.xml']).toEqual(source['xl/comments1.xml'])
  expect(output['xl/calcChain.xml']).toBeUndefined()
  expect(cell(output, 1, 'N9').querySelector('v')?.textContent).toBe('0.25')
  expect(cell(output, 1, 'N9').querySelector('f')?.textContent).toBe("'Tola'!M6")
  expect(cell(output, 7, 'M6').getAttribute('t')).toBeNull()
  expect(cell(output, 7, 'M6').querySelector('v')?.textContent).toBe('0.25')
  expect(cell(output, 7, 'L6').querySelector('f')?.textContent).toBe('ROUND(M6-K6,6)')
  expect(strFromU8(output['xl/worksheets/sheet1.xml']!)).toContain('orientation="portrait"')
  expect(strFromU8(output['xl/worksheets/sheet1.xml']!)).toContain('topLeftCell="B5"')
})

test('reassignment moves the handler row and rewires the master progress formula', () => {
  const activities = fixtureActivities().map(a => a.id === 'nbc:1.6.1.2' ? { ...a, handler: 'Kheng' } : a)
  const template = unzipSync(fixtureTemplate())
  const sheet = new DOMParser().parseFromString(strFromU8(template['xl/worksheets/sheet6.xml']!), 'application/xml')
  Array.from(sheet.getElementsByTagNameNS(NS, 'row')).filter(row => Number(row.getAttribute('r')) >= 5).forEach(row => row.remove())
  template['xl/worksheets/sheet6.xml'] = strToU8(new XMLSerializer().serializeToString(sheet))
  const output = unzipSync(weeklyWorkbook(zipSync(template), activities, [], '2026-10-26').bytes)
  expect(cell(output, 1, 'N9').querySelector('f')?.textContent).toBe("'Kheng'!M6")
  expect(strFromU8(output['xl/worksheets/sheet7.xml']!)).not.toContain('Install board')
})

test('unchanged handler assignments keep original rows, formatting and trailing content', () => {
  const files = unzipSync(fixtureTemplate())
  const doc = new DOMParser().parseFromString(strFromU8(files['xl/worksheets/sheet7.xml']!), 'application/xml')
  const rows = [...doc.getElementsByTagNameNS(NS, 'row')]
  rows.find(r => r.getAttribute('r') === '6')!.remove()
  const leaf = rows.find(r => r.getAttribute('r') === '7')!
  leaf.setAttribute('ht', '37'); leaf.setAttribute('hidden', '1')
  const footer = doc.createElementNS(NS, 'row'); footer.setAttribute('r', '20')
  doc.getElementsByTagNameNS(NS, 'sheetData')[0]!.append(footer)
  files['xl/worksheets/sheet7.xml'] = strToU8(new XMLSerializer().serializeToString(doc))
  const output = unzipSync(weeklyWorkbook(zipSync(files), fixtureActivities(), [], '2026-10-26').bytes)
  const saved = new DOMParser().parseFromString(strFromU8(output['xl/worksheets/sheet7.xml']!), 'application/xml')
  expect([...saved.getElementsByTagNameNS(NS, 'row')].find(r => r.getAttribute('r') === '7')?.getAttribute('ht')).toBe('37')
  expect([...saved.getElementsByTagNameNS(NS, 'row')].some(r => r.getAttribute('r') === '20')).toBe(true)
  expect(cell(output, 1, 'N9').querySelector('f')?.textContent).toBe("'Tola'!M7")
})

test('rejects mismatched WBS data and changed template weights', () => {
  expect(() => weeklyWorkbook(fixtureTemplate(), fixtureActivities().slice(1), [], '2026-10-26')).toThrow('do not match')
  const activities = fixtureActivities().map(a => ({ ...a, globalWeight: .9 }))
  expect(() => weeklyWorkbook(fixtureTemplate(), activities, [], '2026-10-26')).toThrow('weighting does not match')
  expect(() => weeklyWorkbook(fixtureTemplate(), fixtureActivities(), [], '2026-10-27')).toThrow('reporting week')
  expect(() => weeklyWorkbook(new Uint8Array(10 * 1024 * 1024 + 1), fixtureActivities(), [], '2026-10-26')).toThrow('10 MB')
  expect(() => weeklyWorkbook(new Uint8Array(), fixtureActivities(), [], '2026-10-26')).toThrow()
  const unassigned = fixtureActivities().map(a => a.handler === 'Tola' ? { ...a, handler: '' } : a)
  expect(() => weeklyWorkbook(fixtureTemplate(), unassigned, [], '2026-10-26')).toThrow('six handlers')
})

test('reassignment requiring review does not count as a completed weekly report', () => {
  const update = submission('2026-10-26', .25, .5)
  expect(confirmedCount(fixtureActivities(), [update], '2026-10-26')).toBe(1)
  const reassigned = fixtureActivities().map(a => a.handler === 'Sitha' ? { ...a, handler: 'Tola' } : a)
  expect(confirmedCount(reassigned, [update], '2026-10-26')).toBe(0)
})
