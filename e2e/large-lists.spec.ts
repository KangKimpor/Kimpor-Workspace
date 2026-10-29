import { expect, test } from './workspace-test'
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const projects = [
      {
        id: 'qa-large',
        name: 'Large project',
        color: 'blue',
        progress: 0,
        description: '',
        target: '',
        status: 'Active',
      },
    ]
    const tasks = Array.from({ length: 500 }, (_, i) => ({
      id: `task-${i}`,
      title: `QA Task ${String(i).padStart(4, '0')}`,
      projectId: 'qa-large',
      status: 'Not started',
      priority: 'Medium',
      due: '2099-01-01',
      notes: '',
      subtasks: [],
    }))
    localStorage.setItem(
      'kw-workspace-v1',
      JSON.stringify({
        projects,
        tasks,
        pages: [],
        events: [],
        taskViews: [],
        scratchpad: '',
      }),
    )
  })
})
test('500-task lists render a bounded window, support End navigation and inline renaming', async ({
  page,
}) => {
  await page.goto('/tasks')
  const list = page.locator('.virtual-task-list')
  await expect(list).toBeVisible()
  expect(await list.locator('.task-row').count()).toBeLessThan(80)
  await list.focus()
  await page.keyboard.press('End')
  await expect(list.getByLabel('Title for QA Task 0499', { exact: true })).toBeVisible()
  await expect(list.getByLabel('Title for QA Task 0499', { exact: true })).toBeFocused()
  await list.getByLabel('Title for QA Task 0499', { exact: true }).fill('Renamed in list')
  await expect(list.getByLabel('Title for Renamed in list', { exact: true })).toHaveValue('Renamed in list')
})
test('500-task table renders a bounded row window and reaches the final task', async ({
  page,
}) => {
  await page.goto('/projects/qa-large/table')
  const table = page.locator('.table-scroll')
  await expect(page.getByLabel('Title for QA Task 0000')).toBeVisible()
  expect(await table.locator('tbody tr').count()).toBeLessThan(80)
  await table.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(page.getByLabel('Title for QA Task 0499')).toBeVisible()
})
