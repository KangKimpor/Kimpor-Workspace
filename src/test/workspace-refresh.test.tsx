import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { TaskTable, columns } from '@/components/TaskTable'
import { SidebarContent } from '@/shell/SidebarContent'
import { TaskRow } from '@/components/TaskRow'
import { rebaseWrite } from '@/data/sync-merge'
const initial = useWorkspace.getState()
afterEach(() => { useWorkspace.setState(initial); localStorage.clear() })
test('projects default to Personal, retain assignment and appear in only their group', () => {
  const state = useWorkspace.getState()
  const personal = state.addProject('Private planning')
  const team = state.addProject('Team planning', 'team')
  expect(useWorkspace.getState().projects.find((p) => p.id === personal)?.workspace).toBe('personal')
  state.updateProject(personal, { workspace: 'team' })
  expect(JSON.parse(localStorage.getItem('kw-workspace-v1')!).projects.find((p: { id: string }) => p.id === personal).workspace).toBe('team')
  render(<MemoryRouter><SidebarContent /></MemoryRouter>)
  const group = screen.getByText('Team Workspace').closest('.nav-section')!
  const parent = within(group as HTMLElement).getByRole('link', { name: /^Team projects$/ }).parentElement!
  expect(within(parent).getByRole('list', { name: 'Team projects' })).toContainElement(screen.getByRole('link', { name: /Private planning/ }))
  expect(within(group as HTMLElement).getByRole('link', { name: /Private planning/ })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /Team planning/ })).toHaveLength(1)
  expect(useWorkspace.getState().projects.find((p) => p.id === team)?.workspace).toBe('team')
  for (const name of ['Favorites', 'Pages', 'New page', 'My tasks', 'Home', 'Calendar']) expect(screen.queryByText(name, { exact: true })).not.toBeInTheDocument()
  expect(useWorkspace.getState().pages).toEqual(initial.pages)
})
test('table edits description inline without extra fields and has the requested order', () => {
  const task = initial.tasks[0]!
  render(<MemoryRouter><TaskTable tasks={[task]} mobile toolbar={null} actions={null} /></MemoryRouter>)
  expect(columns).toEqual(['title', 'status', 'priority', 'due', 'notes'])
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[^a-z ]/gi, '').trim())).toEqual(['AaTask name', 'Status', 'Priority', 'Due date', 'Description'])
  fireEvent.change(screen.getByLabelText(`Description for ${task.title}`), { target: { value: 'An editable description' } })
  expect(useWorkspace.getState().tasks.find((t) => t.id === task.id)?.notes).toBe('An editable description')
  expect(screen.queryByText('More fields')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Reminder')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Open / })).not.toBeInTheDocument()
})
test('list and board rows expose editable titles and colored status choices', () => {
  const task = initial.tasks[0]!
  render(<MemoryRouter><TaskRow task={task} compact /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText(`Title for ${task.title}`), { target: { value: 'Inline rename' } })
  expect(useWorkspace.getState().tasks.find((t) => t.id === task.id)?.title).toBe('Inline rename')
  fireEvent.click(screen.getByRole('combobox', { name: `Status for ${task.title}` }))
  for (const status of ['Not started', 'In progress', 'In review', 'Blocked', 'Done']) expect(screen.getByRole('option', { name: status }).querySelector('.status-badge')).not.toBeNull()
})
test('concurrent independent fields merge, while overlapping edits and deletions retain a recovery draft', () => {
  const base = { id: 'task', title: 'Original', status: 'Not started' }
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, status: 'Done' })).toEqual({ conflicts: false, data: { id: 'task', title: 'Local title', status: 'Done' } })
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, title: 'Remote title' }).conflicts).toBe(true)
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, { ...base, deletedAt: 'now' }).conflicts).toBe(true)
  expect(rebaseWrite(base, { ...base, title: 'Local title' }, null).conflicts).toBe(true)
})


test('opening screen remembers a selected project per account with a safe fallback', async () => {
  const { rememberWorkspace, workspaceStart } = await import('@/shell/landing')
  expect(workspaceStart('guest', initial.projects)).toBe('/projects/website/table')
  rememberWorkspace('account-a', { workspace: 'personal', projectId: 'mobile' })
  expect(workspaceStart('account-a', initial.projects)).toBe('/projects/mobile/table')
  expect(workspaceStart('account-b', [])).toBe('/projects?workspace=personal')
  rememberWorkspace('account-a', { workspace: 'team', projectId: 'removed' })
  expect(workspaceStart('account-a', initial.projects)).toBe('/projects?workspace=team')
})
