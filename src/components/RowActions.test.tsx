import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RowActions } from './RowActions'

for (const projectId of ['team-project', 'personal-project']) test(`${projectId} only offers Delete`, () => {
  render(<RowActions item={{ id:'task', title:'Task', projectId, x:20, y:20 }} onClose={vi.fn()} onDelete={vi.fn()}/>)
  expect(screen.getAllByRole('menuitem')).toHaveLength(1)
  expect(screen.getByRole('menuitem', {name:'Delete task Task'})).toBeTruthy()
  expect(screen.queryByRole('menuitem', {name:/Report issue/})).toBeNull()
})
