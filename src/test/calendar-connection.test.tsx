import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import { CalendarAccounts } from '@/components/CalendarAccounts'

const mocks = vi.hoisted(() => ({ connect: vi.fn(), sync: vi.fn() }))
vi.mock('@/data/sync', () => ({ useAccount: () => ({ session: { user: { id: 'test' } } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: null }))
vi.mock('@/calendar/google', () => ({
  connectGoogle: mocks.connect, syncGoogle: mocks.sync, disconnectGoogle: vi.fn(),
  googleService: async () => ({ configured: true }),
  useCalendars: () => ({ accounts: [], calendars: [], busy: true, error: '' }),
}))
function settings() {
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CalendarAccounts /></QueryClientProvider>)
  return screen.findByRole('button', { name: 'Add Google account' })
}
beforeEach(() => vi.clearAllMocks())
test('connection stays available during sync and opens Google through an explicit new-tab link', async () => {
  let finish!: (url: string) => void
  mocks.connect.mockImplementation(() => new Promise<string>(resolve => {finish = resolve}))
  const button = await settings()
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  expect(screen.getByRole('button', {name:'Preparing Google sign-in…'})).toBeDisabled()
  finish('https://accounts.google.com/o/oauth2/v2/auth?state=test')
  const link = await screen.findByRole('link', { name: 'Continue to Google ↗' })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(link).toHaveAttribute('href', 'https://accounts.google.com/o/oauth2/v2/auth?state=test')
  expect(button).toBeEnabled()
  expect(mocks.connect).toHaveBeenCalledTimes(1)
})
test('failed connection shows an error and allows a retry', async () => {
  mocks.connect.mockRejectedValueOnce(new Error('The calendar service took too long. Please try again.'))
  const button = await settings()
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('took too long')
  expect(button).toBeEnabled()
})
