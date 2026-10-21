import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('desktop retains the project header, views and table arrangement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/projects/website/table')
  await expect(page.getByRole('button', { name: 'Edit project', exact: true })).toHaveText('Edit project')
  await expect(page.getByRole('navigation', { name: 'Project views' }).getByRole('link', { name: 'Table', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Search project tasks' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Details', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All Tasks', exact: true })).toHaveCount(0)
})

for (const theme of ['light', 'dark']) {
  test(`project table mobile layout and controls in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.addInitScript((value) => localStorage.setItem('kw-theme', value), theme)
    await page.goto('/projects/website/table')
    await expect(page.getByRole('heading', { name: 'Website Redesign' })).toBeVisible()
    const table = page.locator('.table-scroll')
    await expect(table.locator('tbody tr').first().getByRole('button', { name: /^Open / })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await table.evaluate((element) => { element.scrollLeft = element.scrollWidth })
    await expect(table.getByRole('columnheader', { name: /Due date/ })).toBeVisible()
    await table.evaluate((element) => { element.scrollLeft = 0 })
    await page.getByRole('button', { name: 'Table columns', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Task name', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Search project tasks', exact: true }).click()
    await page.getByRole('textbox', { name: 'Search project tasks' }).fill('Finalize token')
    await page.keyboard.press('Escape')
    await expect(table.locator('tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: 'Filter tasks', exact: true }).click()
    await page.getByRole('combobox', { name: 'Filter priority' }).click()
    await page.getByRole('option', { name: 'Urgent', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByText('No tasks match these filters.')).toBeVisible()
    await page.reload()
    await page.getByRole('heading', { name: 'Website Redesign' }).waitFor()
    await page.screenshot({ path: `docs/screenshots/project-reference-${theme}.png`, animations: 'disabled' })
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await table.locator('tbody tr').first().getByRole('button', { name: /^Open / }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
}

test('mobile task names and Open controls fit on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/projects/website/table')
  const open = page.locator('.table-scroll tbody tr').first().getByRole('button', { name: /^Open / })
  await expect(open).toBeInViewport()
  await page.getByRole('button', { name: 'All Tasks', exact: true }).click()
  await page.getByRole('link', { name: 'Board', exact: true }).click()
  await expect(page).toHaveURL(/\/board$/)
  await expect(page.getByRole('button', { name: 'Edit project', exact: true })).toHaveText('Edit project')
})

test('zoom gestures are blocked while normal scrolling and typing remain available', async ({ page }) => {
  await page.goto('/projects/website/table')
  await page.getByRole('heading', { name: 'Website Redesign' }).waitFor()
  const result = await page.evaluate(() => {
    const zoomWheel = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true })
    const scroll = new WheelEvent('wheel', { cancelable: true, bubbles: true })
    const zoomKey = new KeyboardEvent('keydown', { ctrlKey: true, key: '+', cancelable: true, bubbles: true })
    const typing = new KeyboardEvent('keydown', { key: '+', cancelable: true, bubbles: true })
    const gesture = new Event('gesturestart', { cancelable: true, bubbles: true })
    const events = [zoomWheel, scroll, zoomKey, typing, gesture]
    events.forEach((event) => document.dispatchEvent(event))
    return { blocked: events.map((event) => event.defaultPrevented), touchAction: getComputedStyle(document.documentElement).touchAction }
  })
  expect(result).toEqual({ blocked: [true, false, true, false, true], touchAction: 'pan-x pan-y' })
})
