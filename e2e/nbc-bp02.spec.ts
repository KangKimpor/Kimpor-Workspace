import { expect, test } from './workspace-test'
import { existsSync, readFileSync } from 'node:fs'
import { calculate } from '../src/nbc/progress'
import type { NbcActivity } from '../src/nbc/types'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'

test.skip(!existsSync('.private/nbc-bp02/initial.json'), 'Prepare private BP02 source first')
test('BP02 persists drafts, confirmation, history and export without touching another project', async ({ page }) => {
  test.setTimeout(240_000)
  const bp02 = JSON.parse(readFileSync('.private/nbc-bp02/initial.json', 'utf8')), bp03 = { project: fixtureProject, activities: fixtureActivities() }
  await page.clock.install({ time: new Date('2026-10-30T03:00:00Z') })
  await page.route('https://**.supabase.co/**', route => route.abort())
  await page.addInitScript(data => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('kw-workspace-v1', JSON.stringify(data)) } }, { pages: [], tasks: [], events: [], projects: [bp03.project, bp02.project], nbc_activities: [...bp03.activities, ...bp02.activities], nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] })
  await page.goto('/projects-progress')
  await expect(page.getByRole('link', { name: /NBC BP02 – Pan Pacific Hotel/ }).first()).toBeVisible()
  const read = () => page.evaluate(async () => {
    const raw = localStorage.getItem('kw-workspace-v1')
    if (raw) return JSON.parse(raw)
    return new Promise<unknown>((resolve, reject) => { const open = indexedDB.open('kimpor-workspace'); open.onerror = () => reject(open.error); open.onsuccess = () => { const get = open.result.transaction('snapshots').objectStore('snapshots').get('guest'); get.onsuccess = () => resolve(get.result.content); get.onerror = () => reject(get.error) } })
  }) as Promise<any>
  const before = await read()
  await page.goto('/projects-progress/nbc-bp02/overview')
  await expect(page.getByText('Completion deadline')).toBeVisible()
  await page.goto('/projects-progress/nbc-bp02/activities')
  await expect(page.getByRole('heading', { name: /NBC BP02/ })).toBeVisible()
  const leaf = (bp02.activities as NbcActivity[]).find(a => a.editable && a.handler === 'Tola' && a.progress < 1)!
  const value = Math.min(1, leaf.progress + .125)
  await page.goto('/projects-progress/nbc-bp02/update?handler=Tola')
  await page.getByLabel(`This week % for ${leaf.wbs}`, { exact: true }).fill(`${value * 100}%`)
  await expect(page.getByText('Draft saved', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel(`This week % for ${leaf.wbs}`, { exact: true })).toHaveValue(new RegExp(`^${value * 100}%?$`))
  await page.getByRole('button', { name: 'Confirm update', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm update' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText(/^Confirmed Fri/)).toBeVisible()
  await page.reload()
  // IndexedDB snapshots are written asynchronously after each commit.
  await expect.poll(async () => (await read()).nbc_summaries?.find((x: { projectId: string; weekStart: string }) => x.projectId === 'nbc-bp02' && x.weekStart === '2026-10-26')?.overall).toBeGreaterThan(calculate(bp02.activities).overall)
  const after = await read()
  expect(after.nbc_activities.find((a: NbcActivity) => a.id === leaf.id).progress).toBe(value)
  for (const collection of ['nbc_activities', 'nbc_submissions', 'nbc_summaries']) expect(after[collection].filter((a: NbcActivity) => a.projectId === 'nbc-bp03')).toEqual(before[collection].filter((a: NbcActivity) => a.projectId === 'nbc-bp03'))
  const mine = after.nbc_activities.filter((a: NbcActivity) => a.projectId === 'nbc-bp02')
  expect(after.nbc_summaries.find((s: { projectId: string; weekStart: string }) => s.projectId === 'nbc-bp02' && s.weekStart === '2026-10-26').overall).toBeCloseTo(calculate(mine).overall, 12)
  await page.goto('/projects-progress/nbc-bp02/overview')
  await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
  await page.getByLabel('Weekly report template').setInputFiles('.private/nbc-bp02/template.xlsx')
  const download = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Export XLSX', exact: true }).click()
  expect((await download).suggestedFilename().replaceAll('_', ' ')).toContain('NBC-BP02-Progress Tracking by BOQ-')
})
