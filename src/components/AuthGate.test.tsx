import { render, screen, act } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { useAccount } from '@/data/sync'
import { AuthGate } from './AuthGate'

vi.mock('@/data/sync', async (original) => ({ ...await original<object>(), initializeCloud: vi.fn() }))
vi.mock('./AccountSettings', () => ({ AccountSettings: () => <h1>Welcome</h1> }))
beforeEach(() => useAccount.setState({ ready: false, session: null, recovering: false }))
const session = { user: { id: 'test-user' } } as Session
test('hides workspace until session restoration finishes and closes it on sign-out or recovery', () => {
  render(<AuthGate><h1>Private workspace</h1></AuthGate>)
  expect(screen.queryByText('Private workspace')).toBeNull()
  act(() => useAccount.setState({ session }))
  expect(screen.queryByText('Private workspace')).toBeNull()
  act(() => useAccount.setState({ ready: true }))
  expect(screen.getByText('Private workspace')).toBeVisible()
  act(() => useAccount.setState({ recovering: true }))
  expect(screen.queryByText('Private workspace')).toBeNull()
  act(() => useAccount.setState({ recovering: false, session: null }))
  expect(screen.getByText('Welcome')).toBeVisible()
  expect(screen.queryByText('Private workspace')).toBeNull()
})
