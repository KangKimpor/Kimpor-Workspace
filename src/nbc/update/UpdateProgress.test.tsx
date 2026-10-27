import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import UpdateProgress from './UpdateProgress'

function load(patch?: (a: ReturnType<typeof fixtureActivities>) => void) {
  const activities = fixtureActivities(); patch?.(activities)
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: activities })
}
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T07:05:00Z')); load() })
afterEach(() => vi.useRealTimers())
function Screen({ handler = 'Tola' }: { handler?: string }) {
  const activities = useWorkspace((s) => s.nbc_activities!), submissions = useWorkspace((s) => s.nbc_submissions ?? [])
  return <MemoryRouter initialEntries={[`/update?handler=${handler}`]}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={submissions}/></MemoryRouter>
}
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))

test('shows the handler leaves under their ancestor groups, then shared GR&P once', () => {
  render(<Screen/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2', 'GR&P'])
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark'])
})

test('Last week is disabled with an explanation when the handler has no last-week update', () => {
  render(<Screen/>)
  const last = screen.getByRole('button', { name: 'Last week' })
  expect((last as HTMLButtonElement).disabled).toBe(true)
  expect(last.getAttribute('title')).toBe('No update to edit')
  expect(screen.getByRole('button', { name: 'This week' }).getAttribute('aria-pressed')).toBe('true')
})

test('invalid text keeps its group expanded and visible when the group is collapsed', () => {
  render(<Screen/>)
  fireEvent.change(screen.getByLabelText('This week % for 1.6.1.2'), { target: { value: 'bad' } })
  fireEvent.click(screen.getByRole('button', { name: 'Collapse 1.6.1' }))
  const input = screen.getByLabelText('This week % for 1.6.1.2') as HTMLInputElement
  expect(input.value).toBe('bad'); expect(input.getAttribute('aria-invalid')).toBe('true')
})

test('Hide completed hides finished rows but never a row that was edited or is changed', () => {
  render(<Screen handler="Sitha"/>)
  expect(wbsOrder()).toEqual(['GR&P'])
  fireEvent.click(screen.getByRole('button', { name: 'Show completed' }))
  expect(wbsOrder()).toContain('1.6.1.1')
  fireEvent.change(screen.getByLabelText('This week % for 1.6.1.1'), { target: { value: '90' } })
  fireEvent.change(screen.getByLabelText('This week % for 1.6.1.1'), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: 'Hide completed' }))
  expect(wbsOrder()).toContain('1.6.1.1')
})

test('shows an empty state with a way back when every row is completed', () => {
  load((a) => { for (const x of a) if (x.wbs === 'GR&P') { x.progress = 1; x.baseline = 1 } })
  render(<Screen handler="Sitha"/>)
  expect(screen.getByText(/No activities to update/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Show completed' }))
  expect(wbsOrder()).toContain('GR&P')
})

test('quick-set chips appear for the focused row and set the value', () => {
  render(<Screen/>)
  fireEvent.focus(screen.getByLabelText('This week % for 1.6.1.2'))
  fireEvent.click(screen.getByRole('button', { name: 'Set 1.6.1.2 to 50%' }))
  expect((screen.getByLabelText('This week % for 1.6.1.2') as HTMLInputElement).value).toBe('50')
})

test('the footer reports changes and confirms in one click, locking the table', async () => {
  render(<Screen/>)
  fireEvent.change(screen.getByLabelText('This week % for 1.6.1.2'), { target: { value: '65' } })
  expect(screen.getByText(/1 changed/)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm update' })); await vi.advanceTimersByTimeAsync(10) })
  expect(screen.getByText(/^Confirmed /)).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 1.6.1.2')).toBeNull()
  expect(within(screen.getByRole('group', { name: 'Update actions' })).getByRole('button', { name: 'Edit' })).toBeTruthy()
})
