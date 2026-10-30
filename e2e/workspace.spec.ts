import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './workspace-test'

test('page creation, slash editing, persistence, trash and restore', async ({
  page,
}) => {
  await page.goto('/p/new')
  await page
    .getByRole('textbox', { name: 'Page title', exact: true })
    .fill('A quieter workspace')
  const url = page.url()
  const editor = page.locator('.bn-editor')
  await editor.click()
  await page.keyboard.type('# My first heading')
  await page.keyboard.press('Enter')
  await expect(editor).toContainText('My first heading')
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem('kw-workspace-v1') || '{}').pages?.some(
      (p: { content?: unknown }) =>
        JSON.stringify(p.content || []).includes('My first heading'),
    ),
  )
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Page title', exact: true }),
  ).toHaveValue('A quieter workspace')
  await expect(page.locator('.bn-editor')).toContainText('My first heading')
  await page.getByRole('button', { name: 'Move page to Trash' }).click()
  await page.goto('/trash')
  await page.getByRole('button', { name: 'Restore page' }).click()
  await page.goto(url)
  await expect(
    page.getByRole('textbox', { name: 'Page title', exact: true }),
  ).toHaveValue('A quieter workspace')
})

test('inline board fields edit status and subtasks, completion can be undone', async ({ page }) => {
  await page.goto('/projects/website/board')
  const card = page.locator('.board-card').filter({ has: page.getByLabel('Title for Finalize token contrasts for WCAG AA', { exact: true }) })
  await card.getByLabel('More fields for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await card.getByRole('combobox', { name: /^Status for/ }).click()
  await page.getByRole('option', { name: 'In review', exact: true }).click()
  await card.getByLabel('More fields for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await card.getByRole('textbox', { name: 'New subtask' }).fill('Verify on Safari')
  await card.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(card.getByText('Verify on Safari')).toBeVisible()
  await card.getByRole('checkbox', { name: /^Complete / }).check()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await card.getByLabel('More fields for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await expect(card.getByRole('combobox', { name: /^Status for/ })).toHaveText('In review')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await card.getByLabel('More fields for Finalize token contrasts for WCAG AA', { exact: true }).click()
  await expect(card.getByRole('combobox', { name: /^Status for/ })).toHaveText('In review')
})

test('event validation, save, reload and delete', async ({ page }) => {
  await page.goto('/calendar/week/today')
  await page.getByRole('button', { name: 'New event' }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Title', { exact: true })
    .fill('Personal design review')
  await dialog.getByLabel('Start', { exact: true }).fill('11:00')
  await dialog.getByLabel('End', { exact: true }).fill('10:00')
  await dialog.getByRole('button', { name: 'Save event' }).click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'End time must be after start time.',
  )
  await dialog.getByLabel('End', { exact: true }).fill('12:00')
  await dialog.getByRole('button', { name: 'Save event' }).click()
  await page.goto('/calendar/agenda/today')
  await page.getByRole('button', { name: /Personal design review/ }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Personal design review/ }),
  ).toHaveCount(0)
})

test('command palette supports keyboard navigation', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Open command palette', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Control+k')
  await page
    .getByRole('textbox', { name: 'Search and commands' })
    .fill('Weekly plan')
  await page
    .getByRole('textbox', { name: 'Search and commands' })
    .press('Enter')
  await expect(page).toHaveURL(/\/p\/weekly-plan/)
  await expect(
    page.getByRole('textbox', { name: 'Page title', exact: true }),
  ).toHaveValue('Weekly plan')
})

test('daily notes keep the selected date and are created once', async ({
  page,
}) => {
  await page.goto('/p/daily?date=2026-10-21')
  await expect(
    page.getByRole('textbox', { name: 'Page title', exact: true }),
  ).toHaveValue('Daily note · 2026-10-21')
  const url = page.url()
  await page.goto('/p/daily?date=2026-10-21')
  await expect(page).toHaveURL(url)
})

test('removed navigation preserves page access through Search', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary', exact: true })
  await expect(nav.getByText('Team Workspace', { exact: true })).toHaveCount(0)
  await expect(nav.getByText('Personal Workspace (Testing Phase)', { exact: true })).toBeVisible()
  for (const name of ['Favorites', 'Pages', 'My tasks', 'New page']) await expect(nav.getByText(name, { exact: true })).toHaveCount(0)
  await page.goto('/search')
  await page.getByLabel('Search workspace').fill('Reading list')
  await page.getByRole('link', { name: /Reading list/ }).click()
  await expect(page.getByLabel('Page title', { exact: true })).toHaveValue('Reading list')
})

test('saved task filters survive a reload', async ({ page }) => {
  await page.goto('/tasks')
  await page.getByRole('combobox', { name: 'Filter by priority', exact: true }).click()
  await page.getByRole('option', { name: 'High', exact: true }).click()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page
    .getByLabel('Name for saved view', { exact: true })
    .fill('High priority work')
  await page.getByRole('button', { name: 'Save view', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Saved views', exact: true }).click()
  await page.getByRole('combobox', { name: 'Saved task view', exact: true }).click()
  await page.getByRole('option', { name: 'High priority work', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('combobox', { name: 'Filter by priority', exact: true }),
  ).toHaveText('High')
})

test('project creation and editable, hideable, resizable task table', async ({
  page,
}) => {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByLabel('Project name', { exact: true }).fill('Release checklist')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(
    page.locator('main').getByText('Release checklist', { exact: true }),
  ).toBeVisible()
  await page.goto('/projects/website/table')
  const title = page.getByLabel(
    'Title for Finalize token contrasts for WCAG AA',
    { exact: true },
  )
  await title.fill('Verify release contrasts')
  await page
    .getByRole('columnheader')
    .filter({ hasText: 'Task name' })
    .getByRole('button')
    .click()
  await page.getByRole('button', { name: 'Table columns', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Priority', exact: true }).uncheck()
  await expect(
    page.getByRole('columnheader', { name: 'Priority', exact: true }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Table columns', exact: true })).toHaveCount(0)
  const handle = page.getByRole('separator', {
    name: 'Resize Task name column',
    exact: true,
  })
  await handle.press('ArrowRight')
  await expect(handle).toHaveAttribute('aria-valuenow', '416')
  await page.reload()
  await expect(
    page.getByLabel('Title for Verify release contrasts', { exact: true }),
  ).toHaveValue('Verify release contrasts')
})

test('installed shell and page editing survive a reload offline', async ({
  page,
  context,
}) => {
  await page.goto('/p/weekly-plan')
  await page.locator('.bn-editor').waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page
    .getByRole('textbox', { name: 'Page title', exact: true })
    .fill('Offline weekly plan')
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Page title', exact: true }),
  ).toHaveValue('Offline weekly plan')
  await context.setOffline(false)
})

test('board cards can move between statuses', async ({ page }) => {
  await page.goto('/projects/website/board')
  const card = page.getByRole('button', { name: /Move Finalize token contrasts/ })
  const column = page.locator('.board-column').filter({
    has: page.getByRole('button', {
      name: 'Add task to Done',
      exact: true,
    }),
  })
  const source = await card.boundingBox()
  const target = await column.boundingBox()
  if (!source || !target)
    throw new Error('Board card and column must be visible')
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    source.x + source.width / 2 + 10,
    source.y + source.height / 2,
    { steps: 3 },
  )
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(target.x + target.width / 2, target.y + 120, {
    steps: 20,
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.mouse.up()
  await expect(
    column.getByRole('button', { name: /Move Finalize token contrasts/ }),
  ).toBeVisible()
})

for (const width of [1920, 1180, 820, 393, 320]) {
  test(`core screens fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 900 })
    for (const route of [
      '/',
      '/projects/website/board',
      '/tasks',
      '/p/weekly-plan',
      '/calendar/week/today',
      '/settings/appearance',
    ]) {
      await page.goto(route)
      await expect(
        page.locator('h1, input[aria-label="Page title"]').first(),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      ).toBe(true)
    }
  })
}

for (const scheme of ['light', 'dark'] as const) {
  for (const route of [
    '/projects/website/board',
    '/tasks',
    '/p/weekly-plan',
    '/calendar/week/today',
    '/settings/appearance',
    '/search',
  ]) {
    test(`accessibility ${route} ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const result = await new AxeBuilder({ page }).analyze()
      expect(
        result.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.nodes[0]?.target}`),
      ).toEqual([])
    })
  }
}
