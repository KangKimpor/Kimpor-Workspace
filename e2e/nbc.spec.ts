import { expect, test } from './workspace-test'
import type { Page } from './workspace-test'
import AxeBuilder from '@axe-core/playwright'
import { existsSync, readFileSync } from 'node:fs'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'
import { submissionId, transitionSubmission } from '../src/nbc/submissions'
import type { SubmissionState } from '../src/nbc/submissions'
import type { NbcSubmission } from '../src/nbc/types'

const now = new Date('2026-10-27T07:05:00Z'), current = '2026-10-26', last = '2026-10-19'
async function setup(page: Page, data: SubmissionState = { activities: fixtureActivities(), submissions: [], summaries: [] }) {
  await page.clock.install({ time: now })
  await page.addInitScript(({ data, project }) => { if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify({ pages: [], tasks: [], events: [], projects: [project], nbc_activities: data.activities, nbc_submissions: data.submissions, nbc_summaries: data.summaries, scratchpad: '', taskViews: [] })) }, { data, project: fixtureProject })
}
async function open(page: Page) { await page.goto('/projects-progress/nbc-bp03/update?handler=Tola'); await expect(page.getByLabel('This week % for 1.6.1.2')).toBeVisible() }
async function edit(page: Page, value: string) { await page.getByLabel('This week % for 1.6.1.2').fill(value); await expect(page.getByText('Draft saved', { exact: true })).toBeVisible() }
async function confirm(page: Page, note?: string, label = 'Confirm update') {
  await page.getByRole('button', { name: label, exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Confirm update' }); if (note) await sheet.getByLabel(/Weekly note/).fill(note)
  await sheet.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(page.getByText(/^Confirmed Tue/)).toBeVisible()
}
function historical(): SubmissionState {
  let state: SubmissionState = { activities: fixtureActivities(), submissions: [], summaries: [] }
  for (const [week, progress] of [[last, .4], [current, .8]] as const) {
    const s: NbcSubmission = { id: submissionId('nbc-bp03', week, 'Tola'), projectId: 'nbc-bp03', weekStart: week, handler: 'Tola', status: 'draft', confirmedAt: null, confirmedBy: null, late: false, note: '', entries: [{ activityId: 'nbc:1.6.1.2', previous: .25, progress, remark: '' }], updatedAt: now.toISOString() }
    state.submissions.push(s); state = transitionSubmission(state, s.id, 'confirm', 'guest', now)
  }
  state.summaries.push({ id: 'old', projectId: 'nbc-bp03', weekStart: '2026-01-05', overall: .2, previous: .1, contributions: { Tola: .1 }, updatedAt: now.toISOString() })
  state.submissions.push({ ...state.submissions[0]!, id: 'old-update', weekStart: '2026-01-05' })
  return state
}
test('autosaved draft survives reload without changing live progress, then confirms in one click', async ({ page }) => {
  await setup(page); await open(page)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByLabel('Reporting date')).toHaveCount(0)
  await expect(page.getByLabel('This week % for GR&P')).toBeVisible()
  await expect(page.getByLabel('This week % for 1.6.1.1', { exact: true })).toHaveCount(0)
  await edit(page, '62.5%')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_activities.find((a: { id: string }) => a.id === 'nbc:1.6.1.2').progress)).toBe(.25)
  await page.reload(); await expect(page.getByLabel('This week % for 1.6.1.2')).toHaveValue('62.5%')
  await confirm(page, 'Crane coordination complete'); await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('This week % for 1.6.1.2')).toHaveCount(0)
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByText('1 of 6 handlers updated this week')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tola this week update' })).toContainText('Updated')
})
test('no-change confirmation and short-window Undo keep a saved editable draft', async ({ page }) => {
  await setup(page); await open(page)
  await confirm(page, undefined, 'Confirm, no changes')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('This week % for 1.6.1.2')).toBeVisible()
  await expect(page.getByText('Draft saved', { exact: true })).toBeVisible()
})
test('confirmed update edits and deletes through a small popover, restoring previous values', async ({ page }) => {
  await setup(page); await open(page); await edit(page, '50'); await confirm(page)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await edit(page, '75'); await confirm(page)
  await page.getByRole('button', { name: 'Update actions', exact: true }).click()
  await page.getByRole('button', { name: 'Delete update', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByLabel('This week % for 1.6.1.2')).toHaveValue('25')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_activities.find((a: { id: string }) => a.id === 'nbc:1.6.1.2').progress)).toBe(.25)
})
test('Overview edits last week, re-chains this week, and keeps older history read-only', async ({ page }) => {
  await setup(page, historical()); await page.goto('/projects-progress/nbc-bp03/overview')
  await expect(page.getByRole('link', { name: 'Past Updates' })).toHaveCount(0)
  await expect(page.getByRole('row')).toHaveCount(7)
  await page.getByRole('button', { name: 'Expand Tola', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for Tola Last week', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Last week', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await edit(page, '60'); await confirm(page)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!).nbc_submissions.find((s: { weekStart: string; handler: string }) => s.weekStart === '2026-10-26' && s.handler === 'Tola').entries[0].previous)).toBe(.6)
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Expand Tola', exact: true }).click()
  await page.getByRole('button', { name: 'Older weeks', exact: true }).click()
  await page.getByRole('button', { name: /^Actions for Tola 5 Jan/ }).click()
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'View as table', exact: true }).click()
  await expect(page.locator('.nbc-trend tbody tr')).toHaveCount(3)
  await page.getByRole('link', { name: 'Update Progress', exact: true }).click()
  await expect(page.getByText(/26 Oct – 1 Nov/).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Who is updating?' })).toBeVisible()
  await page.locator('.nbc-gate-list').getByRole('button', { name: /^Sitha/ }).click()
  await page.getByRole('button', { name: 'Continue as Sitha', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Last week', exact: true })).toBeDisabled()
})
test('tabs are Overview, Activities, Update Progress and old Past Updates links land on Overview', async ({ page }) => {
  await setup(page); await page.goto('/projects-progress/nbc-bp03/past')
  await expect(page).toHaveURL(/\/overview/)
  await expect(page.locator('.nbc-tabs a')).toHaveText(['Overview', 'Progress', 'Update Progress'])
  await page.goto('/projects-progress/nbc-bp03/board?wbs=1.6.1.2')
  await expect(page).toHaveURL(/\/issues\?wbs=1\.6\.1\.2$/)
  await expect(page.locator('.nbc-views a')).toHaveText(['Table', 'Issues'])
  await expect(page.locator('.nbc-tabs a[aria-current=page]')).toHaveText('Progress')
})
test('Activities shows real WBS numbers with deeper levels indented and no editable progress', async ({ page }) => {
  await setup(page); await page.goto('/projects-progress/nbc-bp03/activities')
  await expect(page.getByRole('columnheader')).toHaveText(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark', 'Handler'])
  const pad = (wbs: string) => page.locator(`tr[data-wbs="${wbs}"] td:nth-child(2)`).evaluate((el) => parseFloat(getComputedStyle(el).paddingInlineStart))
  expect(await pad('1.6.1.1')).toBeGreaterThan(await pad('1.6.1'))
  await expect(page.locator('tr[data-wbs="GR&P"]')).toHaveCount(1)
  await expect(page.locator('tbody input')).toHaveCount(0)
  await expect(page.locator('tr[data-wbs="1.6.1"] .nbc-group-handlers')).toHaveText('Sitha, Tola')
  await page.getByRole('button', { name: 'Install board', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Tola', { exact: true })).toBeVisible()
})
test('invalid text keeps its group open and blocks confirmation; shared GR&P appears once', async ({ page }) => {
  await setup(page); await open(page)
  await expect(page.locator('tr[data-wbs="GR&P"]')).toHaveCount(1)
  await expect(page.locator('tr[data-wbs="GR&P"]')).toContainText('Shared')
  await page.getByLabel('This week % for 1.6.1.2').fill('bad')
  await page.getByRole('button', { name: 'Collapse 1.6.1', exact: true }).click()
  await expect(page.getByLabel('This week % for 1.6.1.2')).toHaveValue('bad')
  await page.getByRole('button', { name: /^Confirm/ }).click()
  await expect(page.getByRole('alert')).toContainText('numeric')
  await expect(page.getByText(/^Confirmed Tue/)).toHaveCount(0)
})
test('Last week is disabled when the handler has no last-week update, and a fully complete handler sees an empty state', async ({ page }) => {
  await setup(page, { activities: fixtureActivities().map((a) => a.wbs === 'GR&P' ? { ...a, progress: 1, baseline: 1 } : a), submissions: [], summaries: [] })
  await page.goto('/projects-progress/nbc-bp03/update?handler=Sitha')
  await expect(page.getByRole('button', { name: 'Last week', exact: true })).toBeDisabled()
  await expect(page.getByText(/Nothing needs an update/)).toBeVisible()
  await page.getByRole('button', { name: 'Show all activities', exact: true }).click()
  await expect(page.getByLabel('This week % for 1.6.1.1')).toBeVisible()
})
for (const viewport of [{ width: 1920, height: 1080 }, { width: 820, height: 1180 }, { width: 393, height: 852 }]) for (const theme of ['light','dark']) test(`responsive current-week editor ${viewport.width} ${theme}`, async ({ page }) => {
  await setup(page); await page.setViewportSize(viewport); await open(page)
  await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
  await edit(page, '45.25')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  const bar = await page.locator('.nbc-update-bar').boundingBox(), table = await page.locator('.nbc-update .nbc-wbs-scroll').boundingBox()
  expect(table!.height).toBeGreaterThan(viewport.height * .35)
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(viewport.height)
  expect(bar!.y - (table!.y + table!.height)).toBeLessThan(50)
  const scan = await new AxeBuilder({ page }).include('.nbc-project').analyze(); expect(scan.violations).toEqual([])
  await page.screenshot({ path: `test-results/nbc-update-${viewport.width}-${theme}.png`, fullPage: true })
  if (viewport.width < 768) { await page.setViewportSize({ width: 393, height: 520 }); await expect(page.getByRole('button', { name: 'Confirm update', exact: true })).toBeInViewport() }
})
test('real BOQ keeps all six handler groups usable and supplies shared GR&P', async ({ page }) => {
  const file = '.private/nbc-bp03/initial.json'; test.skip(!existsSync(file), 'Private dataset excluded from Git')
  const { activities } = JSON.parse(readFileSync(file, 'utf8'))
  await setup(page, { activities, submissions: [], summaries: [] }); await page.goto('/projects-progress/nbc-bp03/update')
  for (const handler of ['Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola']) {
    await page.getByRole('button', { name: new RegExp(`^${handler}`) }).click(); await page.getByRole('button', { name: `Continue as ${handler}`, exact: true }).click()
    await expect(page.getByLabel('This week % for GR&P')).toBeVisible()
    const group = page.locator('.nbc-update tr[data-group=true] button').last(); await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'false'); await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: /^Change handler/ }).click()
  }
  await page.locator('.nbc-tabs').getByRole('link', { name: 'Progress', exact: true }).click(); await expect(page.getByRole('table', { name: 'Activities by WBS', exact: true })).toBeVisible()
})
