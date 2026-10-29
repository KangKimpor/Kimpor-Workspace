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
function Screen({ handler = 'Tola' }: { handler?: string | null }) {
  const activities = useWorkspace((s) => s.nbc_activities!), submissions = useWorkspace((s) => s.nbc_submissions ?? [])
  return <MemoryRouter initialEntries={[handler ? `/update?handler=${handler}` : '/update']}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={submissions}/></MemoryRouter>
}
const wbsOrder = () => [...document.querySelectorAll('tbody tr[data-wbs]')].map((r) => r.getAttribute('data-wbs'))
const value = (wbs: string) => screen.getByLabelText(`This week % for ${wbs}`) as HTMLInputElement

test('shows the handler leaves under their ancestor groups, then shared GR&P once', () => {
  render(<Screen/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2', 'GR&P'])
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['WBS', 'Description', 'Previous week %', 'This week %', 'Remark'])
})

test('only the current week is available', () => {
  render(<Screen/>)
  expect(screen.queryByRole('button', { name: 'Last week' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'This week' })).toBeNull()
  expect(screen.getByText('This week')).toBeTruthy()
})

test('invalid text keeps its group expanded and visible when the group is collapsed', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: 'bad' } })
  fireEvent.click(screen.getByRole('button', { name: 'Collapse 1.6.1' }))
  expect(value('1.6.1.2').value).toBe('bad'); expect(value('1.6.1.2').getAttribute('aria-invalid')).toBe('true')
})

test('Needs update hides finished rows but never a row that was edited or is changed', () => {
  render(<Screen handler="Sitha"/>)
  expect(wbsOrder()).toEqual(['GR&P'])
  fireEvent.click(screen.getByRole('button', { name: /^All/ }))
  expect(wbsOrder()).toContain('1.6.1.1')
  fireEvent.change(value('1.6.1.1'), { target: { value: '90' } })
  fireEvent.change(value('1.6.1.1'), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: /^Needs update/ }))
  expect(wbsOrder()).toContain('1.6.1.1')
})

test('the Changed filter lists only rows that differ from last week', () => {
  render(<Screen/>)
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2', 'GR&P'])
  fireEvent.click(screen.getByRole('button', { name: /^Changed/ }))
  expect(screen.getByText(/No changes yet/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^All/ }))
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  fireEvent.click(screen.getByRole('button', { name: /^Changed/ }))
  expect(wbsOrder()).toEqual(['1.6.1', '1.6.1.2'])
})

test('shows an empty state with a way back when every row is completed', () => {
  load((a) => { for (const x of a) if (x.wbs === 'GR&P') { x.progress = 1; x.baseline = 1 } })
  render(<Screen handler="Sitha"/>)
  expect(screen.getByText(/Nothing needs an update/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Show all activities' }))
  expect(wbsOrder()).toContain('GR&P')
})

test('people type percentages themselves: there are no preset chips', () => {
  render(<Screen/>)
  fireEvent.focus(value('1.6.1.2'))
  expect(screen.queryByRole('button', { name: /^Set 1\.6\.1\.2 to/ })).toBeNull()
  fireEvent.change(value('1.6.1.2'), { target: { value: '50' } })
  expect(value('1.6.1.2').value).toBe('50')
})

test('asks who is updating first and only opens the editor after Continue', () => {
  render(<Screen handler={null}/>)
  expect(screen.getByRole('heading', { name: 'Who is updating?' })).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 1.6.1.2')).toBeNull()
  expect((screen.getByRole('button', { name: 'Choose a handler' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /^Tola/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Tola' }))
  expect(value('1.6.1.2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Change handler/ }))
  expect(screen.getByRole('heading', { name: 'Who is updating?' })).toBeTruthy()
})

test('the header shows the Saturday 12 PM deadline while the week stays Monday to Sunday', () => {
  render(<Screen/>)
  expect(screen.getByText('Due Saturday 12:00 PM · 3 days left')).toBeTruthy()
  expect(screen.getByText(/^Tola · 26 Oct – 1 Nov/)).toBeTruthy()
})

test('after the deadline the header says updates are marked Late and the sheet repeats it', () => {
  vi.setSystemTime(new Date('2026-10-31T07:00:00Z'))
  render(<Screen/>)
  expect(screen.getByText(/Deadline passed Saturday 12:00 PM/)).toBeTruthy()
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  expect(within(screen.getByRole('dialog', { name: 'Confirm update' })).getByText('Late')).toBeTruthy()
})

test('lowering a value needs a remark before the confirm sheet opens', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: '10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  expect(screen.getByText(/A remark is required/)).toBeTruthy()
  expect(screen.getByText(/1 to fix/)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.change(screen.getByLabelText('Remark for 1.6.1.2'), { target: { value: 'Rework after inspection' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  expect(screen.getByRole('dialog', { name: 'Confirm update' })).toBeTruthy()
})

test('an invalid value blocks the confirm sheet and names the fix', () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByRole('button', { name: /^Confirm/ }))
  expect(screen.getByText('Enter 0 to 100')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('the sheet can list every updated task with its old and new percentage, then confirms and locks the table', async () => {
  render(<Screen/>)
  fireEvent.change(value('1.6.1.2'), { target: { value: '65' } })
  expect(screen.getByText(/1 changed/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm update' }))
  const sheet = screen.getByRole('dialog', { name: 'Confirm update' })
  expect(within(sheet).queryByRole('list')).toBeNull()
  fireEvent.click(within(sheet).getByRole('switch'))
  expect(within(within(sheet).getByRole('list', { name: 'Updated tasks' })).getByText(/25\.0% → 65\.0%/)).toBeTruthy()
  fireEvent.change(within(sheet).getByLabelText(/Weekly note/), { target: { value: 'Crane done' } })
  await act(async () => { fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm' })); await vi.advanceTimersByTimeAsync(10) })
  expect(screen.getByText(/^Confirmed /)).toBeTruthy()
  expect(screen.queryByLabelText('This week % for 1.6.1.2')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(within(screen.getByRole('group', { name: 'Update actions' })).getByRole('button', { name: 'Edit' })).toBeTruthy()
})

test('past-week links always open the current week', () => {
  const activities = useWorkspace.getState().nbc_activities!
  render(<MemoryRouter initialEntries={['/update?handler=Tola&week=2026-10-19']}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={[]}/></MemoryRouter>)
  expect(screen.queryByText(/editing last week/)).toBeNull()
  expect(screen.getAllByText(/26 Oct – 1 Nov/)).toBeTruthy()
  expect(value('1.6.1.2')).toBeTruthy()
})
