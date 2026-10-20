import { beforeEach, expect, test, vi } from 'vitest'
import { useWorkspace, emptyContent } from '@/data'
import { nextTaskDue } from '@/data/task-rules'
import { canParentTask } from '@/data/task-tree'
const original = useWorkspace.getState()
beforeEach(() => {
  useWorkspace.setState({ ...original, ...structuredClone(emptyContent) })
  localStorage.clear()
})
test('task parents reject cycles, a third subtask level and another project', () => {
  const state = useWorkspace.getState()
  const project = state.addProject('One'),
    other = state.addProject('Two')
  const ids = ['A', 'B', 'C', 'D'].map((title) =>
    state.addTask({ title, projectId: project }),
  )
  state.updateTask(ids[1]!, { parentId: ids[0] })
  state.updateTask(ids[2]!, { parentId: ids[1] })
  state.updateTask(ids[3]!, { parentId: ids[2] })
  state.updateTask(ids[0]!, { parentId: ids[2] })
  expect(
    useWorkspace.getState().tasks.find((t) => t.id === ids[3])?.parentId,
  ).toBeUndefined()
  expect(
    useWorkspace.getState().tasks.find((t) => t.id === ids[0])?.parentId,
  ).toBeUndefined()
  const foreign = state.addTask({ title: 'Elsewhere', projectId: other })
  expect(canParentTask(useWorkspace.getState().tasks, ids[0]!, foreign)).toBe(
    false,
  )
})
test('recurring task completion creates the next date once and Undo removes the untouched successor', async () => {
  const state = useWorkspace.getState(),
    project = state.addProject('One')
  const id = state.addTask({
    title: 'Weekly review',
    projectId: project,
    due: '2026-10-20',
    recurrence: 'FREQ=WEEKLY;COUNT=2',
  })
  state.updateTask(id, { status: 'Done' })
  await vi.waitFor(() =>
    expect(
      useWorkspace.getState().tasks.filter((t) => !t.deletedAt),
    ).toHaveLength(2),
  )
  const next = useWorkspace
    .getState()
    .tasks.find((t) => t.recurringFrom === id)!
  expect(next.due).toBe('2026-10-27')
  expect(nextTaskDue(next)).toBeNull()
  state.updateTask(id, { status: 'Done' })
  expect(useWorkspace.getState().tasks).toHaveLength(2)
  state.updateTask(id, { status: 'Not started' })
  expect(
    useWorkspace.getState().tasks.find((t) => t.id === next.id)?.deletedAt,
  ).toBeTruthy()
})
test('monthly recurrence preserves the original rule rather than drifting after a short month', () => {
  const id = useWorkspace
    .getState()
    .addTask({
      title: 'Monthly',
      projectId: 'one',
      due: '2026-01-31',
      recurrence: 'FREQ=MONTHLY',
    })
  expect(
    nextTaskDue(useWorkspace.getState().tasks.find((t) => t.id === id)!),
  ).toBe('2026-03-31')
})
