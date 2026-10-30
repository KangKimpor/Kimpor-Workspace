import { expect, test } from './workspace-test'
import { existsSync, readFileSync } from 'node:fs'
import { calculate } from '../src/nbc/progress'
import type { NbcActivity } from '../src/nbc/types'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'

for (const real of [false, true]) test(`both projects persist isolated drafts, confirmations, history and exports (${real ? 'private workbooks' : 'synthetic'})`, async ({ page }) => {
  test.skip(real && !existsSync('.private/nbc-bp04/initial.json'), 'Prepare private BP04 source first')
  const bp03 = real ? JSON.parse(readFileSync('.private/nbc-bp03/initial.json', 'utf8')) : { project: fixtureProject, activities: fixtureActivities() }
  const bp04 = real ? JSON.parse(readFileSync('.private/nbc-bp04/initial.json', 'utf8')) : { project: { ...fixtureProject, id: 'nbc-bp04', name: 'NBC BP04 – Pan Pacific Hotel' }, activities: fixtureActivities().map(a => ({ ...a, id: a.id.replace('nbc:', 'nbc-bp04:'), parentId: a.parentId?.replace('nbc:', 'nbc-bp04:') ?? null, projectId: 'nbc-bp04' })) }
  await page.clock.install({ time: new Date('2026-10-30T03:00:00Z') })
  await page.route('https://**.supabase.co/**', route => route.abort())
  await page.addInitScript(data => { if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify(data)) }, { pages: [], tasks: [], events: [], projects: [bp03.project, bp04.project], nbc_activities: [...bp03.activities, ...bp04.activities], nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [] })
  await page.goto('/projects-progress')
  for (const project of [bp03.project, bp04.project]) await expect(page.getByRole('link', { name: new RegExp(project.name) }).first()).toBeVisible()
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('kw-workspace-v1')!))
  for (const [data, other] of [[bp04, bp03], [bp03, bp04]]) {
    const before = await read()
    const leaf = (data.activities as NbcActivity[]).find(a => a.editable && a.handler === 'Tola' && a.progress < 1)!
    const value = Math.min(1, leaf.progress + .125)
    await page.goto(`/projects-progress/${data.project.id}/update?handler=Tola`)
    await page.getByLabel(`This week % for ${leaf.wbs}`, { exact: true }).fill(`${value * 100}%`)
    await expect(page.getByText('Draft saved', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel(`This week % for ${leaf.wbs}`, { exact: true })).toHaveValue(`${value * 100}%`)
    expect((await read()).nbc_activities.find((a: NbcActivity) => a.id === leaf.id).progress).toBe(leaf.progress)
    await page.getByRole('button', { name: 'Confirm update', exact: true }).click()
    await page.getByRole('dialog', { name: 'Confirm update' }).getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByText(/^Confirmed Fri/)).toBeVisible()
    await page.reload()
    const after = await read()
    expect(after.nbc_activities.find((a: NbcActivity) => a.id === leaf.id).progress).toBe(value)
    for (const collection of ['nbc_activities', 'nbc_submissions', 'nbc_summaries']) expect(after[collection].filter((a: NbcActivity) => a.projectId === other.project.id)).toEqual(before[collection].filter((a: NbcActivity) => a.projectId === other.project.id))
    const activities = after.nbc_activities.filter((a: NbcActivity) => a.projectId === data.project.id)
    expect(after.nbc_summaries.find((s: { projectId: string; weekStart: string }) => s.projectId === data.project.id && s.weekStart === '2026-10-26').overall).toBeCloseTo(calculate(activities).overall, 12)
    await page.goto(`/projects-progress/${data.project.id}/overview`)
    await expect(page.getByText('1 of 6 handlers updated this week')).toBeVisible()
    await page.getByRole('button', { name: 'Expand Tola', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Actions for Tola This week', exact: true })).toBeVisible()
    if (real && data.project.id === 'nbc-bp04') {
      await page.getByRole('button', { name: 'Export XLSX', exact: true }).click()
      await page.getByLabel('Weekly report template').setInputFiles('.private/nbc-bp04/template.xlsx')
      const download = page.waitForEvent('download')
      await page.getByRole('dialog').getByRole('button', { name: 'Export XLSX', exact: true }).click()
      expect((await download).suggestedFilename().replaceAll('_', ' ')).toContain('NBC-BP04-Progress Tracking by BOQ-')
    }
  }
})
