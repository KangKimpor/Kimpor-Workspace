import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import Activities from './Activities'

beforeEach(() => {
  // jsdom has no layout; give elements a size so the virtualizer renders rows.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1200 })
  localStorage.clear(); useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() }) })
function setup(query = '', view: 'activities' | 'issues' = 'activities') {
  const activities = fixtureActivities(), baseline = new Map(activities.map((a) => [a.id, a.progress]))
  render(<MemoryRouter initialEntries={[`/activities${query}`]}><Activities projectId={fixtureProject.id} activities={activities} baseline={baseline} view={view}/></MemoryRouter>)
}
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))

test('a handler filter keeps only that handler leaves with their ancestor groups', () => {
  setup('?handler=Tola')
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
})

test('completion distribution uses the weighted matching activities and follows search', () => {
  setup('?handler=Tola')
  const distribution = within(screen.getByRole('region', { name: 'Completion distribution' }))
  expect(distribution.getByRole('img').getAttribute('aria-label')).toBe('25.00% complete')
  expect(distribution.getByText('1 task')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: 'no match' } })
  expect(distribution.getByRole('img').getAttribute('aria-label')).toBe('0.00% complete')
  expect(distribution.getAllByText('0 tasks')).toHaveLength(3)
})

test('shows the workbook columns plus Handler, and no progress input', () => {
  setup()
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark', 'Handler'])
  expect(document.querySelectorAll('table input')).toHaveLength(0)
})

test('search matches WBS or name, and a group name brings its whole subtree', () => {
  setup()
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: 'Install' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: '1.6.1.1' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.1'])
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: 'Test area' } })
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.1', '1.6.1.2'])
})

test('shared GR&P is listed once under Unassigned', () => {
  setup('?handler=Unassigned')
  expect(wbsOrder()).toEqual(['GR&P'])
})

test('the view switcher links only to Table and Issues', () => {
  setup()
  const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
  expect([href('Table'), href('Issues')]).toEqual([`/projects-progress/${fixtureProject.id}/activities`, `/projects-progress/${fixtureProject.id}/issues`])
  expect(screen.queryByRole('link', { name: 'Board' })).toBeNull()
})

test('issues search supports its shortcut, WBS search and a clearable empty state', () => {
  useWorkspace.getState().addTask({ title: 'Check ceiling', projectId: fixtureProject.id, nbcActivityId: 'nbc:1.6.1.2' })
  setup('', 'issues')
  const search = screen.getByRole('textbox', { name: 'Search issues or WBS' })
  fireEvent.keyDown(window, { key: '/' })
  expect(document.activeElement).toBe(search)
  fireEvent.change(search, { target: { value: '1.6.1.2' } })
  expect(screen.getByRole('textbox', { name: 'Title for Check ceiling' })).toBeTruthy()
  fireEvent.change(search, { target: { value: 'nothing matches' } })
  expect(screen.getByText('No matching issues')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('textbox', { name: 'Title for Check ceiling' })).toBeTruthy()
})

test('a new issue clears search and preserves the selected WBS link', () => {
  setup('?wbs=1.6.1.2', 'issues')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search issues or WBS' }), { target: { value: 'no match' } })
  fireEvent.click(screen.getByRole('button', { name: 'New action' }))
  expect(screen.getByRole('textbox', { name: 'Title for New site action' })).toBeTruthy()
  expect(useWorkspace.getState().tasks[0]?.nbcActivityId).toBe('nbc:1.6.1.2')
  expect(screen.queryByText('No matching issues')).toBeNull()
})

test('clicking an activity name opens its details in a side panel', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Install board' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Progress history')).toBeTruthy()
})
