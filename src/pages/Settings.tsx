import { GlassSelect } from '@/components/glass/GlassSelect'
import { useEffect } from 'react'
import { initializeCloud } from '@/data/sync'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarAccounts } from '@/components/CalendarAccounts'
import { Link, useParams } from 'react-router-dom'
import { useTheme } from '@/lib/theme'
import { useGlass } from '@/lib/glass'
import { AccountSettings } from '@/components/AccountSettings'
import { useWorkspace } from '@/data'
import { useInstall } from '@/lib/install'

const queryClient = new QueryClient()
export default function Settings() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsContent />
    </QueryClientProvider>
  )
}
function SettingsContent() {
  const { section = 'appearance' } = useParams()
  useEffect(() => {
    if (section === 'account' || section === 'accounts') void initializeCloud()
  }, [section])
  const theme = useTheme()
  const glass = useGlass()
  const install = useInstall()
  const { calendarPreferences, setCalendarPreferences } = useWorkspace()
  const preferences = calendarPreferences || {
    weekStart: 1 as const,
    hour12: false,
  }
  return (
    <div className="page settings-page">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Settings</h1>
          <p className="muted">Make a little space your own.</p>
        </div>
      </header>
      <nav className="view-tabs" aria-label="Settings sections">
        <Link
          className="view-tab"
          aria-current={section === 'account' ? 'page' : undefined}
          to="/settings/account"
        >
          Account & sync
        </Link>
        <Link
          className="view-tab"
          aria-current={section === 'appearance' ? 'page' : undefined}
          to="/settings/appearance"
        >
          Appearance
        </Link>
        <Link
          className="view-tab"
          aria-current={section === 'accounts' ? 'page' : undefined}
          to="/settings/accounts"
        >
          Calendar accounts
        </Link>
      </nav>
      {section === 'account' ? (
        <AccountSettings />
      ) : section === 'accounts' ? (
        <CalendarAccounts />
      ) : (
        <>
          <section className="settings-section">
            <h2>Theme</h2>
            <p className="muted small">
              Choose what feels right, or follow your device.
            </p>
            <GlassSelect aria-label="Theme" value={theme.pref} onChange={(e) => theme.setPref(e.target.value as 'light' | 'dark' | 'system')}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </GlassSelect>
          </section>
          <section className="settings-section settings-row">
            <div>
              <h2>Reduce motion</h2>
              <p className="muted small">
                Use gentle fades and simpler transitions.
              </p>
            </div>
            <input
              aria-label="Reduce motion"
              type="checkbox"
              checked={glass.motion === 'reduced'}
              onChange={(e) =>
                glass.setMotion(e.target.checked ? 'reduced' : 'system')
              }
            />
          </section>
          <section className="settings-section">
            <h2>Calendar display</h2>
            <div className="settings-row">
              <label htmlFor="week-start">Week starts on</label>
              <GlassSelect
                id="week-start" aria-label="Week starts on"
                value={preferences.weekStart}
                onChange={(e) =>
                  setCalendarPreferences({
                    ...preferences,
                    weekStart: e.target.value === '0' ? 0 : 1,
                  })
                }
              >
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
              </GlassSelect>
            </div>
            <div className="settings-row">
              <label htmlFor="clock-format">Clock format</label>
              <GlassSelect
                id="clock-format" aria-label="Clock format"
                value={preferences.hour12 ? '12' : '24'}
                onChange={(e) =>
                  setCalendarPreferences({
                    ...preferences,
                    hour12: e.target.value === '12',
                  })
                }
              >
                <option value="24">24 hour</option>
                <option value="12">12 hour</option>
              </GlassSelect>
            </div>
          </section>
          <section className="settings-section">
            <h2>Install SingBuild Workspace</h2>
            <p className="muted small">
              {install.installed
                ? 'Installed on this device. Your workspace is available from your home screen or app launcher.'
                : 'On iPhone or iPad, open Safari’s Share menu, choose Add to Home Screen, then Add. In Chrome or Edge, use Install app in the address bar or browser menu.'}
            </p>
            {install.prompt && !install.installed && (
              <button
                className="btn-accent"
                onClick={async () => {
                  const prompt = install.prompt!
                  useInstall.setState({ prompt: null })
                  await prompt.prompt()
                  await prompt.userChoice
                }}
              >
                Install app
              </button>
            )}
          </section>
          <section className="settings-section">
            <h2>Your workspace data</h2>
            <p className="muted small">
              Sign in for a persistent cloud workspace. Signed-in changes are saved to the server and updated live across your sessions. Offline edits wait for confirmation; guest content is a local demo.
            </p>
            <Link className="text-link" to="/design">
              Explore the design system
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
