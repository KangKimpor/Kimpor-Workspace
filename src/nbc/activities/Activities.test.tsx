import { fireEvent, render, screen } from '@testing-library/react'
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
function setup(query = '', view: 'activities' | 'issues' | 'board' = 'activities') {
  const activities = fixtureActivities(), baseline = new Map(activities.map((a) => [a.id, a.progress]))
  render(<MemoryRouter initialEntries={[`/activities${query}`]}><Activities projectId={fixtureProject.id} activities={activities} baseline={baseline} view={view}/></MemoryRouter>)
}
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))

test('a handler filter keeps only that handler leaves with their ancestor groups', () => {
  setup('?handler=Tola')
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
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

test('the view switcher links to Table, Board and Issues', () => {
  setup()
  const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
  expect([href('Table'), href('Board'), href('Issues')]).toEqual([`/projects-progress/${fixtureProject.id}/activities`, `/projects-progress/${fixtureProject.id}/board`, `/projects-progress/${fixtureProject.id}/issues`])
})

test('clicking an activity name opens its details in a side panel', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Install board' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Progress history')).toBeTruthy()
})
