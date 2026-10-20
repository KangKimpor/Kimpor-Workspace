import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useInstall } from '@/lib/install'
import { UpdateNotice } from './UpdateNotice'

test('updates wait for an explicit Reload tap and prevent duplicate requests', () => {
  const update = vi.fn().mockResolvedValue(undefined)
  useInstall.setState({ update })
  render(<UpdateNotice />)
  expect(update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
  expect(update).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Reloading…' })).toBeDisabled()
})

test('updates can be postponed without reloading', () => {
  const update = vi.fn().mockResolvedValue(undefined)
  useInstall.setState({ update })
  render(<UpdateNotice />)
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(update).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
})
