import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { emptyContent, useWorkspace } from '@/data'
import { fixtureActivities, fixtureProject } from '../test-fixture'
import { weekStart } from '../submissions'
import { useUpdateDraft } from './useUpdateDraft'

beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-27T07:05:00Z'))
  useWorkspace.setState({ ...structuredClone(emptyContent), scope: 'guest', projects: [fixtureProject], nbc_activities: fixtureActivities() })
})
afterEach(() => vi.useRealTimers())
const setup = () => renderHook(() => useUpdateDraft({ projectId: fixtureProject.id, week: weekStart(), handler: 'Tola', activities: useWorkspace((s) => s.nbc_activities!), submission: undefined }))

test('typing a valid value marks the activity changed and moves the weighted contribution', () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', '65'))
  expect(result.current.changed).toHaveLength(1)
  expect(result.current.contribution).toBeCloseTo(0.24, 10)
  expect(result.current.invalid.size).toBe(0)
})

test('invalid text is flagged and kept, and other rows are untouched', () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', 'abc'))
  expect([...result.current.invalid]).toEqual(['nbc:1.6.1.2'])
  expect(result.current.text('nbc:1.6.1.2')).toBe('abc')
  expect(result.current.changed).toHaveLength(0)
})

test('a valid value autosaves once after 400 ms and never changes live progress', () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', '70'))
  expect(useWorkspace.getState().nbc_submissions ?? []).toHaveLength(0)
  act(() => { vi.advanceTimersByTime(450) })
  expect(useWorkspace.getState().nbc_submissions).toHaveLength(1)
  expect(useWorkspace.getState().nbc_activities![3]!.progress).toBe(0.25)
  expect(result.current.status).toBe('saved')
})

test('confirm is blocked while any value is invalid and keeps the draft', async () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', 'abc'))
  await act(async () => { await result.current.confirm() })
  expect(result.current.error).toMatch(/numeric/)
  expect(useWorkspace.getState().nbc_submissions ?? []).toHaveLength(0)
  expect(result.current.text('nbc:1.6.1.2')).toBe('abc')
})

test('one invalid row does not hide the other edits', () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', 'abc'))
  const other = result.current.rows.find((e) => e.activityId !== 'nbc:1.6.1.2')!
  act(() => result.current.setText(other.activityId, '99'))
  expect(result.current.invalid.size).toBe(1)
  expect(result.current.changed.map((e) => e.activityId)).toEqual([other.activityId])
})

test('lowering progress without a remark is flagged and blocks confirm until a remark is added', async () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', '10'))
  expect(result.current.lowered).toHaveLength(1)
  expect([...result.current.needsRemark]).toEqual(['nbc:1.6.1.2'])
  await act(async () => { await result.current.confirm() })
  expect(result.current.error).toMatch(/remark/)
  expect(useWorkspace.getState().nbc_submissions ?? []).toHaveLength(0)
  act(() => result.current.setRemark('nbc:1.6.1.2', 'Rework'))
  expect(result.current.needsRemark.size).toBe(0)
})

test('edited rows are remembered as touched so they can stay visible', () => {
  const { result } = setup()
  act(() => result.current.setText('nbc:1.6.1.2', '100'))
  expect(result.current.touched.has('nbc:1.6.1.2')).toBe(true)
})
