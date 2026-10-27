import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { fixtureActivities } from '../test-fixture'
import { buildWbsRows } from '../wbs-table'
import { WbsTable } from './WbsTable'
import type { NbcActivity } from '../types'

const base = fixtureActivities()[2]!
const node = (wbs: string, parent: string | null, patch: Partial<NbcActivity> = {}): NbcActivity => ({ ...base, id: `nbc:${wbs}`, wbs, name: `Name ${wbs}`, parentId: parent ? `nbc:${parent}` : null, editable: false, relativeWeight: 1, globalWeight: 0.1, baseline: 0, progress: 0, history: [], ...patch })
const activities = [node('1.6.1', null, { order: 1 }), node('1.6.1.1', '1.6.1', { order: 2 }), node('1.6.1.1.1', '1.6.1.1', { order: 3, editable: true, progress: 0.4 })]

function setup(extra: Partial<Parameters<typeof WbsTable>[0]> = {}) {
  const onToggle = vi.fn()
  render(<WbsTable rows={buildWbsRows(activities)} caption="Test table" collapsed={new Set()} onToggle={onToggle} previous={(a) => a.baseline} current={(r) => <span>{`cur ${r.activity.wbs}`}</span>} remark={() => <span>remark</span>} {...extra}/>)
  return onToggle
}

test('shows exactly the workbook columns and no Accumulation or Change column', () => {
  setup()
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark'])
})

test('shows the real WBS number and indents each level further', () => {
  setup()
  const group = screen.getByText('Name 1.6.1.1').closest('td')!, leaf = screen.getByText('Name 1.6.1.1.1').closest('td')!
  expect(screen.getByText('1.6.1.1.1')).toBeTruthy()
  expect(parseFloat(leaf.style.paddingInlineStart)).toBeGreaterThan(parseFloat(group.style.paddingInlineStart))
})

test('group toggles announce state and report their id', () => {
  const onToggle = setup()
  const toggle = within(screen.getByText('Name 1.6.1.1').closest('tr')!).getByRole('button')
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(toggle)
  expect(onToggle).toHaveBeenCalledWith('nbc:1.6.1.1')
})

test('extra columns are appended after Remark', () => {
  setup({ extra: [{ header: 'Handler', cell: () => <span>H</span> }] })
  expect(screen.getAllByRole('columnheader').at(-1)!.textContent).toBe('Handler')
})
