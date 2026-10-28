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
    for (const [view, label] of [['overview', 'Overview'], ['activities', 'Activities'], ['update', 'Update Progress']] as const) {
      await page.locator('.nbc-tabs').getByRole('link', { name: label, exact: true }).click()
      await expect(page.locator('.nbc-tabs a[aria-current=page]')).toHaveText(label)
      await expect(page.getByRole('heading', { name: fixtureProject.name, exact: true })).toBeVisible()
      if (view === 'overview') {
        await expect(page.getByLabel('Overall project progress')).toHaveAttribute('value', '0.35')
        await page.getByRole('button', { name: 'Work Area', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Work area', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Floor Breakdown', exact: true }).click()
        await expect(page.getByRole('region', { name: 'Floor / location' })).toBeVisible()
      }
      if (view === 'activities') await expect(page.getByRole('region', { name: 'Completion distribution' })).toContainText('35.00%')
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
