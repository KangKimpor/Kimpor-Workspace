import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { useWorkspace } from '@/data'
import Trash from '@/pages/Trash'
import { ProjectCard } from '@/components/WorkspaceUI'
import { MemoryRouter } from 'react-router-dom'

const initial = useWorkspace.getState()
afterEach(() => { useWorkspace.setState(initial); localStorage.clear() })

test('Trash restores pages in their available parent and detaches missing parents', () => {
  const state = useWorkspace.getState()
  const parent = state.addPage('Parent')
  const child = state.addPage('Child', parent)
  const orphan = state.addPage('Orphan', 'missing')
  state.updatePage(child, { deletedAt: new Date().toISOString() })
  state.updatePage(orphan, { deletedAt: new Date().toISOString() })
  render(<Trash />)
  fireEvent.click(screen.getByRole('button', { name: 'Restore page: Child' }))
  fireEvent.click(screen.getByRole('button', { name: 'Restore page: Orphan' }))
  expect(useWorkspace.getState().pages.find((p) => p.id === child)).toMatchObject({ parentId: parent, deletedAt: null })
  expect(useWorkspace.getState().pages.find((p) => p.id === orphan)).toMatchObject({ parentId: null, deletedAt: null })
})

test('Trash shows task notes once, restores them, and requires confirmation to empty', () => {
  const state = useWorkspace.getState()
  const id = state.addTask({ title: 'Recover me', projectId: 'website' })
  const task = useWorkspace.getState().tasks.find((t) => t.id === id)!
  state.updateTask(id, { deletedAt: new Date().toISOString() })
  render(<Trash />)
  const list = screen.getByRole('region', { name: 'Deleted items' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Restore task: Recover me' }))
  expect(useWorkspace.getState().pages.find((p) => p.id === task.pageId)?.deletedAt).toBeNull()
  expect(screen.getByText('Your trash is empty.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Empty Trash' })).toBeDisabled()
})

test('emptying Trash can be cancelled and purges task notes only after confirmation', () => {
  const state = useWorkspace.getState()
  const id = state.addTask({ title: 'Disposable', projectId: 'website' })
  const notes = useWorkspace.getState().tasks.find((t) => t.id === id)!.pageId
  state.updateTask(id, { deletedAt: new Date().toISOString() })
  render(<Trash />)
  fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(useWorkspace.getState().tasks.some((t) => t.id === id)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }))
  expect(useWorkspace.getState().tasks.some((t) => t.id === id)).toBe(false)
  expect(useWorkspace.getState().pages.some((p) => p.id === notes)).toBe(false)
})

test('workspace cards hide progress while project progress cards retain it', () => {
  const project = initial.projects[0]!
  const { container, rerender } = render(<MemoryRouter><ProjectCard project={{ ...project, nbcBp03: false }} /></MemoryRouter>)
  expect(container.querySelector('.progress-track')).toBeNull()
  expect(container.querySelector('.project-percent')).toBeNull()
  rerender(<MemoryRouter><ProjectCard project={{ ...project, nbcBp03: true }} /></MemoryRouter>)
  expect(container.querySelector('.progress-track')).not.toBeNull()
})
