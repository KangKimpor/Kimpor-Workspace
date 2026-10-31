import { CalendarDays, Check, ChevronRight, Cloud, Monitor, Moon, Smartphone, Sun, UserRound } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { AccountSettings } from '@/components/AccountSettings'
import { useTheme } from '@/lib/theme'
import { useGlass } from '@/lib/glass'
import { useWorkspace } from '@/data'
import { useShallow } from 'zustand/react/shallow'
import { useInstall } from '@/lib/install'
import './settings.css'

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

export default function Settings() {
  const { section = 'appearance' } = useParams()
  const theme = useTheme()
  const glass = useGlass()
  const install = useInstall()
  const { calendarPreferences, setCalendarPreferences } = useWorkspace(
    useShallow((s) => ({ calendarPreferences: s.calendarPreferences, setCalendarPreferences: s.setCalendarPreferences })),
  )
  const preferences = calendarPreferences || { weekStart: 1 as const, hour12: false }
  const account = section === 'account'

  if (section === 'accounts') return <Navigate to="/settings/appearance" replace />

  return (
    <div className="page settings-page">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Settings</h1>
          <p className="muted">A workspace that feels like yours.</p>
        </div>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <Link aria-current={!account ? 'page' : undefined} to="/settings/appearance">
            <span className="settings-nav-icon"><Monitor size={17} aria-hidden="true" /></span>
            Appearance
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <Link aria-current={account ? 'page' : undefined} to="/settings/account">
            <span className="settings-nav-icon settings-icon-account"><UserRound size={17} aria-hidden="true" /></span>
            Account & sync
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </nav>
        <div className="settings-content">
          <header className="settings-content-heading">
            <h2>{account ? 'Account & sync' : 'Appearance'}</h2>
            <p>{account ? 'Your account, your work. Always together.' : 'Make yourself at home.'}</p>
          </header>
          {account ? <AccountSettings /> : <>
            <section className="settings-group" aria-labelledby="appearance-heading">
              <h3 id="appearance-heading">Display</h3>
              <div className="settings-card">
                <div className="settings-theme">
                  <div className="settings-label"><span>Appearance</span><p>Choose a look, or match your device.</p></div>
                  <div className="settings-theme-options" role="group" aria-label="Theme">
                    {themes.map(({ value, label, Icon }) => (
                      <button key={value} className="settings-theme-choice" aria-pressed={theme.pref === value} onClick={() => theme.setPref(value)}>
                        <span className="settings-theme-preview" data-preview={value} aria-hidden="true">
                          <span className="settings-preview-window"><span /><span><i /><i /><i /></span></span>
                        </span>
                        <span className="settings-theme-name"><Icon size={14} aria-hidden="true" />{label}<span className="settings-theme-check" aria-hidden="true">{theme.pref === value && <Check size={12} />}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="settings-preference" htmlFor="reduce-motion">
                  <span className="settings-label"><span>Reduce motion</span><span className="settings-description">Gentler animations and simpler transitions.</span></span>
                  <input id="reduce-motion" className="settings-switch" type="checkbox" role="switch" aria-label="Reduce motion" aria-checked={glass.motion === 'reduced'} checked={glass.motion === 'reduced'} onChange={(e) => glass.setMotion(e.target.checked ? 'reduced' : 'system')} />
                </label>
              </div>
            </section>
            <section className="settings-group" aria-labelledby="calendar-display-heading">
              <h3 id="calendar-display-heading"><CalendarDays size={15} aria-hidden="true" />Calendar display</h3>
              <div className="settings-card">
                <div className="settings-preference">
                  <label htmlFor="week-start">Week starts on</label>
                  <GlassSelect id="week-start" aria-label="Week starts on" value={preferences.weekStart} onChange={(e) => setCalendarPreferences({ ...preferences, weekStart: e.target.value === '0' ? 0 : 1 })}>
                    <option value="1">Monday</option><option value="0">Sunday</option>
                  </GlassSelect>
                </div>
                <div className="settings-preference">
                  <label htmlFor="clock-format">Clock format</label>
                  <GlassSelect id="clock-format" aria-label="Clock format" value={preferences.hour12 ? '12' : '24'} onChange={(e) => setCalendarPreferences({ ...preferences, hour12: e.target.value === '12' })}>
                    <option value="24">24 hour</option><option value="12">12 hour</option>
                  </GlassSelect>
                </div>
              </div>
            </section>
            <section className="settings-group" aria-labelledby="install-heading">
              <h3 id="install-heading"><Smartphone size={15} aria-hidden="true" />On this device</h3>
              <div className="settings-card settings-install">
                <img src="/brand/icon-192.png" width={44} height={44} alt="" />
                <div className="settings-label"><span>SingBuild Workspace</span><p>{install.installed ? 'Installed on this device. Your workspace is available from your home screen or app launcher.' : 'Keep your workspace a tap away.'}</p></div>
                {install.prompt && !install.installed && <button className="btn-secondary" onClick={async () => {
                  const prompt = install.prompt!
                  useInstall.setState({ prompt: null })
                  await prompt.prompt()
                  await prompt.userChoice
                }}>Install app</button>}
                {!install.installed && <p className="settings-install-help">On iPhone or iPad, open Safari’s Share menu, choose Add to Home Screen, then Add. In Chrome or Edge, use Install app in the address bar or browser menu.</p>}
              </div>
            </section>
            <p className="settings-footnote"><Cloud size={15} aria-hidden="true" />Your calendar display preferences sync with your workspace.</p>
          </>}
        </div>
      </div>
    </div>
  )
}
