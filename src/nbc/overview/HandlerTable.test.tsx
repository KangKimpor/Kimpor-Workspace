import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import { submissionId } from '../submissions'
import { HandlerTable } from './HandlerTable'
import type { NbcSubmission } from '../types'

const now = Date.parse('2026-10-27T07:05:00Z'), current = '2026-10-26', old = '2026-01-05'
const confirmed = (week: string, progress: number): NbcSubmission => ({ id: submissionId(fixtureProject.id, week, 'Tola'), projectId: fixtureProject.id, weekStart: week, handler: 'Tola', status: 'confirmed', confirmedAt: `${week}T08:00:00Z`, confirmedBy: 'guest', late: false, note: 'Site note', entries: [{ activityId: 'nbc:1.6.1.2', previous: 0.25, progress, remark: '' }], updatedAt: `${week}T08:00:00Z` })
function setup(submissions: NbcSubmission[] = []) {
  render(<MemoryRouter><HandlerTable projectId={fixtureProject.id} activities={fixtureActivities()} submissions={submissions} now={now}/></MemoryRouter>)
}
const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) })

test('lists the six handlers with the five columns', () => {
  setup()
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Handler', 'This week', 'Last week', 'Changed', 'Contribution'])
  expect(['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola'].every((n) => within(screen.getByRole('table')).getByText(n))).toBe(true)
})

test('a confirmed current-week update shows Updated and its changed count', () => {
  setup([confirmed(current, 0.5)])
  expect(within(row('Tola')).getByText('Updated')).toBeTruthy()
  expect(within(row('Tola')).getByText('1')).toBeTruthy()
  expect(within(row('Sitha')).getByText('Not yet')).toBeTruthy()
})

test('contribution tracks retain the true project share, including zero and shared work', () => {
  const activities = fixtureActivities()
  activities[0]!.progress = .5
  render(<MemoryRouter><HandlerTable projectId={fixtureProject.id} activities={activities} submissions={[]} now={now}/></MemoryRouter>)
  expect(screen.getByRole('progressbar', { name: 'Tola contribution' })).toHaveAttribute('value', '0.15')
  expect(screen.getByRole('progressbar', { name: 'Kheng contribution' })).toHaveAttribute('value', '0')
  expect(Number(screen.getByRole('progressbar', { name: 'Total project contribution' }).getAttribute('value'))).toBeCloseTo(.45)
  expect(screen.getByText('45.00%')).toBeTruthy()
})

test('expanding a handler shows this week, last week as Missing, and a collapsed Older weeks', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Expand Tola' }))
  expect(within(document.querySelector('.nbc-weeks') as HTMLElement).getByText('Missing')).toBeTruthy()
  const older = screen.getByRole('button', { name: /Older weeks/ })
  expect(older.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull()
})

test('an older week offers only Open and Export CSV', () => {
  setup([confirmed(old, 0.4)])
  fireEvent.click(screen.getByRole('button', { name: 'Expand Tola' }))
  fireEvent.click(screen.getByRole('button', { name: /Older weeks/ }))
  fireEvent.click(screen.getByRole('button', { name: /Actions for Tola .*Jan/ }))
  expect(screen.getByText('Open')).toBeTruthy()
  expect(screen.getByText('Export CSV')).toBeTruthy()
  expect(screen.queryByText('Edit')).toBeNull()
})

test('Open shows a read-only peek with the entries and the note', () => {
  setup([confirmed(current, 0.5)])
  fireEvent.click(screen.getByRole('button', { name: 'Expand Tola' }))
  fireEvent.click(screen.getByRole('button', { name: /Actions for Tola This week/ }))
  fireEvent.click(screen.getByText('Open'))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Install board')).toBeTruthy()
  expect(within(dialog).getByText('Site note')).toBeTruthy()
  expect(within(dialog).queryByRole('textbox')).toBeNull()
})
