import { expect, test } from '@playwright/test'
const base = {
  id: 'verification-series',
  title: 'Recurring review',
  date: '2026-10-19',
  endDate: '2026-10-19',
  start: '09:00',
  end: '10:00',
  calendar: 'Personal',
  color: 'blue',
  location: '',
  recurrence: 'FREQ=DAILY;COUNT=4',
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (event) =>
      !localStorage.getItem('kw-workspace-v1') &&
      localStorage.setItem(
        'kw-workspace-v1',
        JSON.stringify({
          pages: [],
          projects: [],
          tasks: [],
          events: [event],
          taskViews: [],
          scratchpad: '',
        }),
      ),
    base,
  )
})
test('a later recurring occurrence opens its own date and supports This and following', async ({
  page,
}) => {
  await page.goto('/calendar/agenda/2026-10-19')
  await page
    .getByRole('button', { name: /Recurring review/ })
    .nth(2)
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(
    '2026-10-21',
  )
  await dialog.getByLabel('Title', { exact: true }).fill('Changed following')
  await dialog.getByRole('combobox', { name: 'Apply changes to' }).click()
  await page.getByRole('option', { name: 'This and following', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Recurring review/ }),
  ).toHaveCount(2)
  await expect(
    page.getByRole('button', { name: /Changed following/ }),
  ).toHaveCount(2)
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Changed following/ }),
  ).toHaveCount(2)
})
test('This event changes one occurrence and All events keeps the series anchor', async ({
  page,
}) => {
  await page.goto('/calendar/agenda/2026-10-19')
  await page
    .getByRole('button', { name: /Recurring review/ })
    .nth(1)
    .click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title', { exact: true }).fill('One exception')
  await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
  await expect(page.getByRole('button', { name: /One exception/ })).toHaveCount(
    1,
  )
  await expect(
    page.getByRole('button', { name: /Recurring review/ }),
  ).toHaveCount(3)
  await page
    .getByRole('button', { name: /Recurring review/ })
    .last()
    .click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Apply changes to' }).click()
  await page.getByRole('option', { name: 'All events', exact: true }).click()
  await dialog.getByLabel('Title', { exact: true }).fill('Whole series')
  await dialog.getByRole('button', { name: 'Save event', exact: true }).click()
  await expect(page.getByRole('button', { name: /Whole series/ })).toHaveCount(
    3,
  )
  await page
    .getByRole('button', { name: /Whole series/ })
    .first()
    .click()
  await expect(
    page.getByRole('dialog').getByLabel('Date', { exact: true }),
  ).toHaveValue('2026-10-19')
})
test('15-minute grid navigation opens the selected time and event keyboard moves ask recurrence scope', async ({
  page,
}) => {
  await page.goto('/calendar/week/2026-10-19')
  const first = page.getByRole('gridcell', {
    name: 'Add event 2026-10-19 at 09:00',
    exact: true,
  })
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('gridcell', {
      name: 'Add event 2026-10-19 at 09:15',
      exact: true,
    }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog').getByLabel('Start', { exact: true }),
  ).toHaveValue('09:15')
  await page.keyboard.press('Escape')
  const review = page
    .locator('.calendar-event')
    .filter({ hasText: 'Recurring review' })
    .first()
  await review.focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(
    page.getByRole('dialog').getByRole('combobox', { name: 'Apply changes to' }),
  ).toHaveText('This event')
  await expect(
    page.getByRole('dialog').getByLabel('Date', { exact: true }),
  ).toHaveValue('2026-10-20')
})

test('dragging across days previews an occurrence edit instead of silently changing the series', async ({
  page,
}) => {
  await page.goto('/calendar/week/2026-10-19')
  await page
    .locator('.positioned-event .calendar-event')
    .first()
    .evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const source = await page
    .locator('.positioned-event .calendar-event')
    .first()
    .boundingBox()
  const target = await page
    .locator('.week-day[data-date="2026-10-20"] .time-slots')
    .boundingBox()
  if (!source || !target) throw new Error('Calendar event must be visible')
  const x = source.x + source.width / 2,
    y = source.y + source.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, y + 64, { steps: 12 })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await page.mouse.up()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue(
    '2026-10-20',
  )
  await expect(dialog.getByRole('combobox', { name: 'Apply changes to' })).toHaveText('This event')
})
test('touch creation waits for the long press and cancels when the finger scrolls', async ({
  page,
}) => {
  await page.goto('/calendar/week/2026-10-19')
  // The synthetic touch fixture tests the delay; native pointer capture is covered by mouse dragging.
  await page.evaluate(() => {
    HTMLElement.prototype.setPointerCapture = () => {}
  })
  const slot = page.getByRole('gridcell', {
    name: 'Add event 2026-10-19 at 09:00',
    exact: true,
  })
  const box = await slot.boundingBox()
  if (!box) throw new Error('Time slot must be present')
  const pointer = {
    pointerType: 'touch',
    pointerId: 11,
    button: 0,
    clientX: box.x + 10,
    clientY: box.y + 8,
  }
  await slot.dispatchEvent('pointerdown', pointer)
  await expect(page.locator('.calendar-selection')).toHaveCount(0)
  await expect(page.locator('.calendar-selection')).toBeVisible({
    timeout: 1500,
  })
  await slot.dispatchEvent('pointercancel', pointer)
  await slot.dispatchEvent('pointerdown', pointer)
  await slot.dispatchEvent('pointermove', {
    ...pointer,
    clientY: pointer.clientY + 30,
  })
  await page.waitForTimeout(400)
  await expect(page.locator('.calendar-selection')).toHaveCount(0)
})
