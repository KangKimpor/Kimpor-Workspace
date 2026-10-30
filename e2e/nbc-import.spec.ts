import { expect, test } from './workspace-test'
import { existsSync, readFileSync } from 'node:fs'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'
import { fixtureTemplate } from '../src/nbc/export/test-template'
import { XLSX_TYPE } from '../src/nbc/export/workbook'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { NbcActivity } from '../src/nbc/types'

const bp04 = { ...fixtureProject, id: 'nbc-bp04', name: 'NBC BP04 – Pan Pacific Hotel' }
const bp04Activities = () => fixtureActivities().map(a => ({ ...a, id: a.id.replace('nbc:', 'nbc-bp04:'), parentId: a.parentId?.replace('nbc:', 'nbc-bp04:') ?? null, projectId: bp04.id }))
for (const projectId of [fixtureProject.id, bp04.id]) test(`XLSX import previews, persists and confirms only ${projectId}, then exports correctly`, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T03:00:00Z') })
  await page.addInitScript(data => { if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify(data)) }, { pages: [], tasks: [], events: [], scratchpad: '', taskViews: [], projects: [fixtureProject, bp04], nbc_activities: [...fixtureActivities(), ...bp04Activities()], nbc_submissions: [], nbc_summaries: [] })
  const files = unzipSync(fixtureTemplate(true))
  files['xl/worksheets/sheet7.xml'] = strToU8(strFromU8(files['xl/worksheets/sheet7.xml']!).replace('<c r="M6" s="0"><v>0.25</v>', '<c r="M6" s="0"><v>0.625</v>'))
  const file = zipSync(files)
  await page.goto(`/projects-progress/${projectId}/activities`)
  await page.getByRole('button', { name: 'Import XLSX', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Import progress from Excel' })
  await dialog.getByLabel('Import progress workbook').setInputFiles({ name: 'NBC.xlsx', mimeType: XLSX_TYPE, buffer: Buffer.from(file) })
  await expect(dialog.getByText(/1 activities changed/)).toBeVisible()
  await expect(dialog.getByRole('cell', { name: '62.50%', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Import drafts', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Imported 1 handler drafts')
  await dialog.getByRole('link', { name: 'Review Tola', exact: true }).click()
  await expect(page.getByLabel('This week % for 1.6.1.2', { exact: true })).toHaveValue('62.5')
  await page.reload()
  await expect(page.getByLabel('This week % for 1.6.1.2', { exact: true })).toHaveValue('62.5')
  await page.getByRole('button', { name: 'Confirm update', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm update', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText(/^Confirmed Fri/)).toBeVisible()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!))
  expect(state.nbc_activities.find((a: NbcActivity) => a.projectId === projectId && a.handler === 'Tola').progress).toBe(.625)
  const otherId = projectId === bp04.id ? fixtureProject.id : bp04.id
  expect(state.nbc_activities.filter((a: NbcActivity) => a.projectId === otherId)).toEqual(otherId === bp04.id ? bp04Activities() : fixtureActivities())
  expect(state.nbc_submissions.every((s: { projectId: string }) => s.projectId === projectId)).toBe(true)
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  await page.getByLabel('Weekly report template').setInputFiles({ name: 'NBC.xlsx', mimeType: XLSX_TYPE, buffer: Buffer.from(file) })
  const download = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Export XLSX', exact: true }).click()
  const downloaded = await download
  expect(downloaded.suggestedFilename().replaceAll('_', ' ')).toContain(projectId.toUpperCase())
  const output = unzipSync(readFileSync((await downloaded.path())!))
  expect(strFromU8(output['xl/worksheets/sheet1.xml']!)).toMatch(/r="N9"[^>]*>[\s\S]*?<v>0.625<\/v>/)
})

test('supplied BP04 workbook uploads and previews without changing existing data', async ({ page }) => {
  test.skip(!existsSync('.private/nbc-bp04/initial.json'), 'Prepare private source first')
  const source = JSON.parse(readFileSync('.private/nbc-bp04/initial.json', 'utf8'))
  await page.addInitScript(data => localStorage.setItem('kw-workspace-v1', JSON.stringify(data)), { pages: [], tasks: [], events: [], scratchpad: '', taskViews: [], projects: [source.project], nbc_activities: source.activities, nbc_submissions: [], nbc_summaries: [] })
  await page.goto('/projects-progress/nbc-bp04/activities')
  await page.getByRole('button', { name: 'Import XLSX', exact: true }).click()
  await page.getByLabel('Import progress workbook').setInputFiles('.private/nbc-bp04/template.xlsx')
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('No progress percentages changed.')
  await expect(page.getByRole('button', { name: 'Import drafts', exact: true })).toBeDisabled()
  await page.screenshot({ path: `.private/nbc-bp04/import-preview-${test.info().project.name}.png` })
})
