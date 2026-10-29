import { expect, test } from './workspace-test'
import type { Page } from './workspace-test'
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { strFromU8, unzipSync } from 'fflate'
import { fixtureTemplate } from '../src/nbc/export/test-template'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'
import { calculate } from '../src/nbc/progress'
import { canUpdate, submissionId, transitionSubmission } from '../src/nbc/submissions'
import { handlers } from '../src/nbc/types'
import type { SubmissionState } from '../src/nbc/submissions'

const current = '2026-10-26', last = '2026-10-19'
async function setup(page: Page, state: SubmissionState = { activities: fixtureActivities(), submissions: [], summaries: [] }) {
  await page.clock.install({ time: new Date('2026-10-27T07:05:00Z') })
  await page.addInitScript(({ state, project }) => {
    if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], events: [], projects: [project], nbc_activities: state.activities, nbc_submissions: state.submissions, nbc_summaries: state.summaries, scratchpad: '', taskViews: [] }))
  }, { state, project: fixtureProject })
}
function history() {
  let state: SubmissionState = { activities: fixtureActivities(), submissions: [], summaries: [] }
  for (const [week, value] of [[last, .4], [current, .8]] as const) {
    const id = submissionId('nbc-bp03', week, 'Tola')
    state.submissions.push({ id, projectId: 'nbc-bp03', handler: 'Tola', weekStart: week, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note: '', entries: [{ activityId: 'nbc:1.6.1.2', previous: .25, progress: value, remark: '' }], updatedAt: '' })
    state = transitionSubmission(state, id, 'confirm', 'guest', new Date(`${week}T08:00:00Z`))
  }
  state = transitionSubmission(state, submissionId('nbc-bp03', current, 'Tola'), 'reopen', 'guest', new Date('2026-10-27T06:00:00Z'))
  state.submissions = state.submissions.map(s => s.weekStart === current ? { ...s, entries: s.entries.map(e => ({ ...e, progress: .95 })) } : s)
  return state
}
async function exportFile(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Export XLSX', exact: true }).click()
  const file = await download
  return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) }
}
function value(xml: string, address: string) {
  const cell = xml.match(new RegExp(`<c\\b[^>]*r="${address}"[^>]*>([\\s\\S]*?)</c>`))?.[1]
  return Number(cell?.match(/<v>([^<]*)<\/v>/)?.[1])
}

test('right-click reports a linked issue, cancel is harmless and Delete remains above Report issue', async ({ page }) => {
  await setup(page); await page.goto('/projects-progress/nbc-bp03/activities')
  const row = page.locator('tr[data-wbs="1.6.1.2"]')
  await row.click({ button: 'right' })
  await expect(page.getByRole('menuitem')).toHaveText(['Report issue'])
  await page.getByRole('menuitem', { name: 'Report issue for Install board', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Issue title')).toHaveValue('Issue: Install board')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!).tasks)).toHaveLength(0)
  await row.click({ button: 'right' }); await page.getByRole('menuitem').click()
  await dialog.getByLabel('Issue title').fill('Damaged board delivery')
  await dialog.getByLabel('Details').fill('Replace damaged panels before installation.')
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])
  await dialog.getByRole('button', { name: 'Report issue', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!))
  expect(state.tasks[0]).toMatchObject({ title: 'Damaged board delivery', projectId: 'nbc-bp03', nbcActivityId: 'nbc:1.6.1.2', labels: ['Issue'] })
  expect(state.nbc_activities).toEqual(fixtureActivities())
  await page.locator('.nbc-views').getByRole('link', { name: 'Issues', exact: true }).click()
  await page.getByRole('textbox', { name: 'Title for Damaged board delivery', exact: true }).locator('..').click({ button: 'right' })
  await expect(page.getByRole('menuitem')).toHaveText(['Delete', 'Report issue'])
  await page.getByRole('menuitem', { name: 'Delete task Damaged board delivery', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Title for Damaged board delivery', exact: true })).toHaveCount(0)
})

test('saving an export template upgrades existing local storage without losing records', async ({ page }) => {
  await page.goto('/favicon.svg')
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('kimpor-workspace', 1)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const [name, keyPath] of [['snapshots', 'scope'], ['outbox', 'key'], ['versions', 'key'], ['files', 'id']]) {
        const store = database.createObjectStore(name!, { keyPath: keyPath! })
        if (name === 'outbox') store.createIndex('scope', 'scope')
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result, transaction = database.transaction('versions', 'readwrite')
      transaction.objectStore('versions').put({ key: 'migration-marker', value: 'preserve me' })
      transaction.oncomplete = () => { database.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }))
  await setup(page); await page.goto('/projects-progress/nbc-bp03/overview')
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  await page.getByLabel('Weekly report template').setInputFiles({ name: 'NBC-template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(fixtureTemplate()) })
  await expect(page.getByText('Saved template: NBC-template.xlsx')).toBeVisible()
  const preserved = await page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('kimpor-workspace')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result, query = database.transaction('versions').objectStore('versions').get('migration-marker')
      query.onsuccess = () => { resolve(query.result); database.close() }
      query.onerror = () => reject(query.error)
    }
  }))
  expect(preserved).toEqual({ key: 'migration-marker', value: 'preserve me' })
})

for (const mobile of [false, true]) test(`weekly XLSX exports confirmed snapshots and remembers the private template${mobile ? ' on mobile' : ''}`, async ({ page }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 })
  await setup(page, history()); await page.goto('/projects-progress/nbc-bp03/overview')
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('status')).toContainText('0 of 6 handlers confirmed')
  await page.getByLabel('Weekly report template').setInputFiles({ name: 'NBC-template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(fixtureTemplate()) })
  await expect(page.getByText('Saved template: NBC-template.xlsx')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('export.png') })
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])
  const file = await exportFile(page), xml = strFromU8(unzipSync(file.bytes)['xl/worksheets/sheet1.xml']!)
  expect(file.name).toBe('NBC-BP03-2026-10-26-partial.xlsx')
  expect(value(xml, 'N9')).toBe(.8); expect(value(xml, 'L9')).toBe(.4); expect(value(xml, 'M9')).toBe(.4)
  await page.reload(); await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  await expect(page.getByText('Saved template: NBC-template.xlsx')).toBeVisible()
  await page.getByRole('combobox', { name: 'Reporting week', exact: true }).click()
  await page.getByRole('option', { name: /19 Oct/ }).click()
  const earlier = await exportFile(page), old = strFromU8(unzipSync(earlier.bytes)['xl/worksheets/sheet1.xml']!)
  expect(earlier.name).toContain(last); expect(value(old, 'N9')).toBe(.4); expect(value(old, 'L9')).toBe(.25)
})

test('actual private client template exports all BOQ rows in the browser', async ({ page }) => {
  test.skip(!process.env.NBC_EXPORT_TEMPLATE || !process.env.NBC_EXPORT_DATA, 'Private workbook is only available during local verification')
  const dataset = JSON.parse(readFileSync(process.env.NBC_EXPORT_DATA!, 'utf8'))
  let state: SubmissionState = { activities: dataset.activities, submissions: [], summaries: [] }
  for (const handler of handlers) {
    const chosen = state.activities.find(a => a.editable && a.handler === handler && a.progress < 1)
    const id = submissionId('nbc-bp03', current, handler)
    state.submissions.push({ id, projectId: 'nbc-bp03', handler, weekStart: current, status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note: '', entries: state.activities.filter(a => canUpdate(a, handler)).map(a => ({ activityId: a.id, previous: a.progress, progress: a.id === chosen?.id ? Math.min(1, a.progress + .035) : a.progress, remark: '' })), updatedAt: '' })
    state = transitionSubmission(state, id, 'confirm', 'guest', new Date('2026-10-27T07:05:00Z'))
  }
  await setup(page, state)
  await page.goto('/projects-progress/nbc-bp03/overview'); await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  await page.getByLabel('Weekly report template').setInputFiles(process.env.NBC_EXPORT_TEMPLATE!)
  await expect(page.getByText(/^Saved template:/)).toBeVisible()
  const file = await exportFile(page), files = unzipSync(file.bytes), xml = strFromU8(files['xl/worksheets/sheet1.xml']!)
  expect(file.name).toBe('NBC-BP03-2026-10-26.xlsx')
  expect(value(xml, 'N5')).toBeCloseTo(calculate(state.activities).overall, 10)
  expect(value(xml, 'L5')).toBeCloseTo(dataset.reconciliation.overall, 10)
  expect(value(xml, 'M5')).toBeGreaterThan(0)
  expect(Object.keys(files).filter(key => /^xl\/worksheets\/sheet\d+\.xml$/.test(key))).toHaveLength(7)
  if (process.env.NBC_EXPORT_OUTPUT) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.NBC_EXPORT_OUTPUT, file.bytes) }
})
