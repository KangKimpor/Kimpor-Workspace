import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { ProjectEditor } from '@/components/ProjectEditor'
import { useWorkspace } from '@/data'

test('glass selector supports keyboard navigation and sends the real select change', async () => {
  const change = vi.fn()
  render(<GlassSelect aria-label="Priority" value="all" onChange={(e) => change(e.target.value)}><option value="all">All priorities</option><option value="High">High</option><option value="Low" disabled>Low</option></GlassSelect>)
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Priority' }), { key: 'ArrowDown' })
  await waitFor(() => expect(screen.getByRole('option', { name: 'All priorities' })).toHaveFocus())
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
  expect(screen.getByRole('option', { name: 'High' })).toHaveFocus()
  fireEvent.click(screen.getByRole('option', { name: 'High' }))
  expect(change).toHaveBeenCalledWith('High')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test('project editor holds a draft, validates dates, and saves only on submit', () => {
  const project = useWorkspace.getState().projects[0]!
  const close = vi.fn()
  render(<ProjectEditor project={project} onClose={close} />)
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Polished project' } })
  expect(useWorkspace.getState().projects[0]!.name).toBe(project.name)
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-10-20' } })
  fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-10-19' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!)
  expect(screen.getByRole('alert')).toHaveTextContent('Target date must be on or after')
  fireEvent.change(screen.getByLabelText('Target date'), { target: { value: '2026-10-21' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!)
  expect(useWorkspace.getState().projects[0]!.name).toBe('Polished project')
  expect(close).toHaveBeenCalledOnce()
  useWorkspace.getState().updateProject(project.id, project)
})
