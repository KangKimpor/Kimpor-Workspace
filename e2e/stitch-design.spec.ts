import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixtureActivities, fixtureProject } from '../src/nbc/test-fixture'

for (const width of [1280, 820, 393]) for (const theme of ['light', 'dark'] as const) {
  test(`Stitch screens retain navigation, data and accessible layouts at ${width} ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.clock.install({ time: new Date('2026-10-28T07:00:00Z') })
    await page.addInitScript(({ project, activities }) => {
      if (!localStorage.getItem('kw-workspace-v1')) localStorage.setItem('kw-workspace-v1', JSON.stringify({
        pages: [], tasks: [], events: [], projects: [project], nbc_activities: activities,
        nbc_submissions: [], nbc_summaries: [], scratchpad: '', taskViews: [],
      }))
    }, { project: fixtureProject, activities: fixtureActivities() })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/projects-progress/nbc-bp03/overview')
    await expect(page.locator('.nbc-project')).toBeVisible()
    expect(await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return { sidebar: style.getPropertyValue('--surface-sidebar').trim(), accent: style.getPropertyValue('--accent-blue').trim() }
    })).toEqual({ sidebar: theme === 'light' ? '#f7f7f5' : '#202020', accent: '#2563eb' })
    if (width >= 1024) {
      const children = page.getByRole('list', { name: `${fixtureProject.name} views`, exact: true })
      await expect(children.getByRole('link')).toHaveCount(2)
      const parent = children.locator('..')
      await expect(parent.getByRole('link', { name: new RegExp(fixtureProject.name) }).first()).toBeVisible()
      expect((await children.boundingBox())!.x).toBeGreaterThan((await parent.boundingBox())!.x)
    }
    for (const [view, label] of [['overview', 'Overview'], ['activities', 'Activities'], ['issues', 'Issues'], ['update', 'Update Progress']] as const) {
      await page.locator(view === 'issues' ? '.nbc-views' : '.nbc-tabs').getByRole('link', { name: label, exact: true }).click()
      await expect(page.locator('.nbc-tabs a[aria-current=page]')).toHaveText(view === 'issues' ? 'Activities' : label)
      await expect(page.getByRole('heading', { name: fixtureProject.name, exact: true })).toBeVisible()
      if (view === 'overview') {
        await expect(page.getByLabel('Overall project progress')).toHaveAttribute('value', '0.35')
        await page.getByRole('button', { name: 'Work Area', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Work area', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Floor Breakdown', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Floor / location' })).toBeVisible()
      }
      if (view === 'activities') await expect(page.getByRole('region', { name: 'Completion distribution' })).toContainText('35.00%')
      if (view === 'issues') {
        await expect(page.getByRole('link', { name: 'Board', exact: true })).toHaveCount(0)
        await expect(page.getByText('No issues yet', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'New action', exact: true }).click()
        await page.getByRole('textbox', { name: 'Title for New site action' }).fill('Coordinate ceiling inspection')
        await page.getByRole('textbox', { name: 'Search issues or WBS' }).fill('ceiling')
        await expect(page.getByRole('textbox', { name: 'Title for Coordinate ceiling inspection' })).toBeVisible()
        const headers = page.getByRole('columnheader')
        await expect(headers).toHaveCount(5)
        if (width >= 820) expect(await page.locator('.nbc-issues > .table-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
        for (const header of await headers.all()) {
          const button = header.locator(':scope > button')
          expect(await button.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
          await expect(button).toHaveCSS('display', 'flex')
        }
      }
      if (view === 'update') {
        await expect(page.getByRole('combobox', { name: 'Your handler' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm, no changes', exact: true })).toBeInViewport()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const scan = await new AxeBuilder({ page }).include('.nbc-project').analyze()
      expect(scan.violations.map(v => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0) })
      await page.screenshot({ path: `docs/screenshots/stitch/${view}-${width}-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' })
    }
    expect(errors).toEqual([])
  })
}
