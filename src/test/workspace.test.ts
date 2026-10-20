import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dateKey, pageTree, useWorkspace } from '@/data'
import { addDays, weekStart } from '@/pages/Calendar'

const initial = useWorkspace.getState()
beforeEach(() => {
  useWorkspace.setState(initial)
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('local workspace', () => {
  it('reorders board cards and gives tasks a valid project in an empty account', () => {
    useWorkspace.setState({tasks:[], projects:[], pages:[]})
    const first = useWorkspace.getState().addTask({title:'First',projectId:'missing'})
    const second = useWorkspace.getState().addTask({title:'Second',projectId:'missing'})
    const state = useWorkspace.getState()
    expect(state.projects).toHaveLength(1)
    expect(state.tasks.every(t=>t.projectId === state.projects[0]?.id)).toBe(true)
    state.moveTask(second,'Not started',first)
    expect(useWorkspace.getState().tasks.find(t=>t.id===second)?.position).toBe(0)
    expect(useWorkspace.getState().tasks.find(t=>t.id===first)?.position).toBe(1)
  })
  it('creates a child page and keeps the saved tree consistent through trash and restore', () => {
    const root = useWorkspace.getState().addPage('Parent')
    const child = useWorkspace.getState().addPage('Child', root)
    expect(
      pageTree(useWorkspace.getState().pages).find((p) => p.id === root)
        ?.children[0]?.id,
    ).toBe(child)
    useWorkspace
      .getState()
      .updatePage(root, { deletedAt: new Date().toISOString() })
    expect(
      pageTree(useWorkspace.getState().pages).some((p) => p.id === root),
    ).toBe(false)
    useWorkspace.getState().updatePage(root, { deletedAt: null })
    expect(
      pageTree(useWorkspace.getState().pages).find((p) => p.id === root)
        ?.children,
    ).toHaveLength(1)
    expect(
      JSON.parse(localStorage.getItem('kw-workspace-v1')!).pages,
    ).toHaveLength(initial.pages.length + 2)
  })
  it('updates a task and event without creating duplicate records', () => {
    const id = useWorkspace
      .getState()
      .addTask({ title: '  New task  ', projectId: 'website' })
    useWorkspace.getState().updateTask(id, { status: 'Done' })
    expect(
      useWorkspace.getState().tasks.find((t) => t.id === id),
    ).toMatchObject({ title: 'New task', status: 'Done' })
    const event = {
      id: 'new',
      title: 'Review',
      date: dateKey(),
      start: '09:00',
      end: '10:00',
      calendar: 'Personal',
      color: 'blue' as const,
      location: '',
    }
    useWorkspace.getState().saveEvent(event)
    useWorkspace.getState().saveEvent({ ...event, title: 'Updated' })
    expect(
      useWorkspace.getState().events.filter((e) => e.id === 'new'),
    ).toHaveLength(1)
    useWorkspace.getState().deleteEvent('new')
    expect(
      useWorkspace
        .getState()
        .events.some((e) => e.id === 'new' && !e.deletedAt),
    ).toBe(false)
  })
  it('keeps edits in memory and reports a storage failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded')
    })
    useWorkspace.getState().setScratchpad('Do not lose this thought')
    expect(useWorkspace.getState().scratchpad).toBe('Do not lose this thought')
    expect(useWorkspace.getState().storageError).toBe(true)
  })
  it('finds a Monday and crosses month and year boundaries in local time', () => {
    expect(dateKey(weekStart(new Date(2027, 0, 3, 12)))).toBe('2026-12-28')
    expect(dateKey(addDays(new Date(2026, 11, 31, 12), 1))).toBe('2027-01-01')
  })
})
