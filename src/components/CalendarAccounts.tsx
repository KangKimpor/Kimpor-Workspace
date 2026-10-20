import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  connectGoogle,
  disconnectGoogle,
  googleService,
  syncGoogle,
  useCalendars,
} from '@/calendar/google'
import { useAccount } from '@/data/sync'
import { supabase } from '@/lib/supabase'
import type { PaletteColor } from '@/data'

export function CalendarAccounts() {
  const { session } = useAccount(),
    { accounts, calendars, busy, error } = useCalendars()
  const [message, setMessage] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectUrl, setConnectUrl] = useState('')
  async function startConnection() {
    if (connecting) return
    setConnecting(true)
    setConnectUrl('')
    setMessage('')
    try {
      setConnectUrl(await connectGoogle())
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not start Google sign-in. Please try again.',
      )
    } finally {
      setConnecting(false)
    }
  }
  const server = useQuery({
    queryKey: ['calendar-service-info'],
    queryFn: () => googleService('info'),
    retry: 1,
    staleTime: 60000,
  })
  const configured = server.data?.configured
  useEffect(() => {
    if (session) void syncGoogle()
  }, [session])
  const run = (fn: () => Promise<unknown>) => {
    setMessage('')
    void fn().catch((e) => setMessage(e.message))
  }
  async function saveDefault(id: string) {
    if (!session || !supabase) return
    const previous = calendars,
      next = calendars.map((calendar) => ({
        ...calendar,
        isDefault: calendar.id === id,
      }))
    useCalendars.setState({ calendars: next, busy: true })
    try {
      const { error } = await supabase.from('kw_calendars').upsert(
        next.map((calendar) => ({
          id: calendar.id,
          user_id: session.user.id,
          account_id: calendar.accountId,
          provider_id: calendar.providerId,
          data: calendar,
        })),
        { onConflict: 'user_id,account_id,provider_id' },
      )
      if (error) throw error
    } catch (error) {
      if (useAccount.getState().session?.user.id === session.user.id)
        useCalendars.setState({ calendars: previous })
      throw error
    } finally {
      useCalendars.setState({ busy: false })
    }
  }
  return (
    <section className="settings-section">
      <div className="row-between">
        <div>
          <h2>Google Calendar</h2>
          <p className="small muted">
            All your calendars, together. Refresh tokens stay encrypted on the
            server.
          </p>
        </div>
        <button
          className="btn-accent"
          disabled={!session || !configured || connecting}
          onClick={() => void startConnection()}
        >
          {connecting ? 'Preparing Google sign-in…' : 'Add Google account'}
        </button>
      </div>
      {connectUrl && (
        <div className="flat-card calendar-connect-step" role="status">
          <strong>Choose your Google account</strong>
          <p className="small muted">
            Open Google in a new tab to choose an account and approve Calendar
            access. Return here when finished. This link expires in 10 minutes.
          </p>
          <a
            className="btn-accent"
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue to Google ↗
          </a>
        </div>
      )}
      {server.isPending && (
        <p role="status" className="small muted">
          Checking calendar service…
        </p>
      )}
      {server.isError && (
        <div role="alert" className="form-error">
          <p>
            Could not reach the calendar service. Check your connection and try
            again.
          </p>
          <button
            className="btn-secondary"
            onClick={() => void server.refetch()}
          >
            Retry connection check
          </button>
        </div>
      )}
      {session && calendars.length > 0 && (
        <label className="settings-row">
          <span>Default calendar for new events</span>
          <select
            aria-label="Default calendar for new events"
            disabled={busy}
            value={calendars.find((calendar) => calendar.isDefault)?.id || ''}
            onChange={(e) => run(() => saveDefault(e.target.value))}
          >
            <option value="">Local · Personal</option>
            {accounts.map((account) => (
              <optgroup key={account.id} label={account.email}>
                {calendars
                  .filter(
                    (calendar) =>
                      calendar.accountId === account.id &&
                      ['owner', 'writer'].includes(calendar.accessRole),
                  )
                  .map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {!session && (
        <p className="muted">Sign in to your workspace account first.</p>
      )}
      {configured === false && (
        <p role="status" className="small muted">
          Google OAuth server configuration is required before connecting
          accounts. Your local calendars still work.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {accounts.map((account) => (
        <div className="flat-card settings-section" key={account.id}>
          <div className="row-between">
            <div>
              <strong>{account.name}</strong>
              <p className="small muted">
                {account.email} · {account.status}
              </p>
            </div>
            <div className="filter-controls">
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => run(() => syncGoogle(true))}
              >
                Sync
              </button>
              <button
                className="btn-secondary"
                disabled={connecting}
                onClick={() => void startConnection()}
              >
                Reconnect
              </button>
              <button
                className="btn-text danger-text"
                onClick={() => run(() => disconnectGoogle(account.id))}
              >
                Disconnect
              </button>
            </div>
          </div>
          {calendars
            .filter((c) => c.accountId === account.id)
            .map((calendar) => (
              <div className="settings-row" key={calendar.id}>
                <label className="inline">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={calendar.visible}
                    onChange={(e) => {
                      const next = { ...calendar, visible: e.target.checked }
                      useCalendars.setState({
                        calendars: calendars.map((c) =>
                          c.id === calendar.id ? next : c,
                        ),
                      })
                      void supabase
                        ?.from('kw_calendars')
                        .update({ data: next })
                        .eq('id', calendar.id)
                        .then(({ error }) => {
                          if (error) setMessage(error.message)
                        })
                    }}
                  />
                  {calendar.name}
                </label>
                <select
                  aria-label={`Color for ${calendar.name}`}
                  disabled={busy}
                  value={calendar.color}
                  onChange={(e) => {
                    const next = {
                      ...calendar,
                      color: e.target.value as PaletteColor,
                    }
                    useCalendars.setState({
                      calendars: calendars.map((c) =>
                        c.id === calendar.id ? next : c,
                      ),
                    })
                    void supabase
                      ?.from('kw_calendars')
                      .update({ data: next })
                      .eq('id', calendar.id)
                      .then(({ error }) => {
                        if (error) setMessage(error.message)
                      })
                  }}
                >
                  {[
                    'gray',
                    'brown',
                    'orange',
                    'yellow',
                    'green',
                    'blue',
                    'purple',
                    'pink',
                    'red',
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
        </div>
      ))}
      {session && busy && accounts.length === 0 && (
        <p role="status" className="small muted">
          Loading connected calendars…
        </p>
      )}
      {session && !busy && accounts.length === 0 && (
        <div className="quiet-empty flat-card">
          No Google accounts connected yet.
        </div>
      )}
    </section>
  )
}
