import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from './test-fixture'
import UpdateProgress from './update/UpdateProgress'
import { readHandlerDraft } from './drafts'
import { weekStart } from './submissions'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T07:05:00Z')); useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() }) })
afterEach(() => vi.useRealTimers())
function Editor() { const activities = useWorkspace((s) => s.nbc_activities!), submissions = useWorkspace((s) => s.nbc_submissions!); return <MemoryRouter initialEntries={['/update?handler=Tola']}><UpdateProgress projectId={fixtureProject.id} activities={activities} submissions={submissions}/></MemoryRouter> }
test('raw edits journal immediately, autosave as handler drafts, and never change live activities', () => {
  render(<Editor/>); fireEvent.change(screen.getByLabelText('This week % for 1.6.1.2'), { target: { value: '73.125%' } })
  expect(readHandlerDraft('guest', fixtureProject.id, weekStart(), 'Tola')!.values['nbc:1.6.1.2']!.text).toBe('73.125%')
  act(() => vi.advanceTimersByTime(450))
  expect(useWorkspace.getState().nbc_submissions![0]!.entries[0]!.progress).toBe(.73125)
  expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(.25)
  expect(readHandlerDraft('other-account', fixtureProject.id, weekStart(), 'Tola')).toBeNull()
  expect(readHandlerDraft('guest', fixtureProject.id, weekStart(), 'Sitha')).toBeNull()
})
test('invalid input stays recoverable and cannot reach the submission or live progress', () => {
  render(<Editor/>); fireEvent.change(screen.getByLabelText('This week % for 1.6.1.2'), { target: { value: 'bad input' } }); act(() => vi.advanceTimersByTime(450))
  expect(screen.getByRole('alert')).toHaveTextContent('numeric')
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(0)
  expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(.25)
})
