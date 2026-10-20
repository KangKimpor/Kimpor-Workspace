import { useState } from 'react'
import {
  ArrowRight,
  Check,
  Cloud,
  Download,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { importLocalWorkspace, syncWorkspace, useAccount } from '@/data/sync'
import { contentOf, useWorkspace } from '@/data'
import './account-settings.css'

type Mode = 'signin' | 'signup' | 'reset' | 'confirm'
function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      G
    </span>
  )
}
function backupWorkspace() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(contentOf(useWorkspace.getState()), null, 2)], {
      type: 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'kimpor-workspace-backup.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function AccountSettings() {
  const { session, recovering, error: accountError } = useAccount()
  const sync = useWorkspace((s) => s.sync)
  const [mode, setMode] = useState<Mode>('signin'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  function changeMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setVisible(false)
  }
  async function run(action: string, work: () => Promise<void>) {
    setBusy(action)
    setError('')
    setMessage('')
    try {
      await work()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setBusy('')
    }
  }
  async function submit() {
    if (!supabase)
      throw new Error(
        'Account services are unavailable. Your local workspace is safe.',
      )
    const redirectTo = `${location.origin}/settings/account`
    if (recovering) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      useAccount.setState({ recovering: false })
      setPassword('')
      setMessage('Your password has been updated.')
      return
    }
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (error) throw error
      setMessage('Check your inbox for a password reset link.')
      return
    }
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: name.trim() },
        },
      })
      if (error) throw error
      if (!data.session) setMode('confirm')
      setPassword('')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    setPassword('')
  }
  async function google() {
    if (!supabase)
      throw new Error('Account services are unavailable. Try again shortly.')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/settings/account`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
  }
  const notice = (
    <>
      {(error || accountError) && (
        <p className="account-notice account-error" role="alert">
          {error || accountError}
        </p>
      )}
      {message && (
        <p className="account-notice" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
    </>
  )
  if (session && !recovering)
    return (
      <div className="account-dashboard">
        <section className="account-profile flat-card">
          <div className="account-avatar" aria-hidden="true">
            {(session.user.user_metadata.full_name || session.user.email || 'K')
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div>
            <span className="eyebrow">YOUR WORKSPACE ACCOUNT</span>
            <h2>
              {session.user.user_metadata.full_name || 'You’re signed in'}
            </h2>
            <p className="muted">{session.user.email}</p>
          </div>
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              void run('signout', async () => {
                const result = await supabase!.auth.signOut()
                if (result.error) throw result.error
              })
            }
          >
            Sign out
          </button>
        </section>
        {notice}
        <section className="account-sync-card flat-card">
          <div className="account-section-icon">
            <Cloud size={22} />
          </div>
          <div>
            <h2>Everything, in sync</h2>
            <p className="muted">
              Your pages, projects and plans stay with you across devices.
            </p>
            <p className="account-sync-status" role="status">
              {sync.kind === 'saved'
                ? 'All changes saved'
                : sync.kind === 'saving'
                  ? 'Saving your changes…'
                  : sync.kind === 'offline'
                    ? `Offline · ${sync.pending} changes waiting to sync`
                    : sync.reason}
            </p>
          </div>
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() => void run('sync', syncWorkspace)}
          >
            <RefreshCw size={16} />
            Sync now
          </button>
        </section>
        <section className="account-action-grid">
          <div className="flat-card account-action-card">
            <h3>Bring your local work along</h3>
            <p className="muted">
              Import pages and tasks saved in this browser into your account.
              Existing account items are kept.
            </p>
            <button
              className="btn-secondary"
              disabled={!!busy}
              onClick={() =>
                void run('import', async () => {
                  await importLocalWorkspace()
                  setMessage('Your local workspace has been imported.')
                })
              }
            >
              Import local workspace
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="flat-card account-action-card">
            <h3>Your calendars, together</h3>
            <p className="muted">
              Connect Google calendars after signing in. Choose which accounts
              and calendars appear in your workspace.
            </p>
            <Link className="btn-secondary" to="/settings/accounts">
              Manage Google calendars
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <button className="btn-text account-backup" onClick={backupWorkspace}>
          <Download size={16} />
          Download workspace backup
        </button>
      </div>
    )
  const isSignup = mode === 'signup',
    isReset = mode === 'reset'
  return (
    <div className="account-auth-layout">
      <aside className="account-welcome">
        <div className="account-brand-icon" aria-hidden="true">
          K
        </div>
        <span className="eyebrow">A LITTLE SPACE FOR EVERYTHING</span>
        <h2>
          Your work.
          <br />
          Right where
          <br />
          you left it.
        </h2>
        <p className="muted">
          One home for your notes, projects and plans. Sign in once and take
          your workspace with you.
        </p>
        <div className="account-promise">
          <Cloud size={18} />
          <span>Saved across your devices</span>
        </div>
        <div className="account-promise">
          <ShieldCheck size={18} />
          <span>Private to your account</span>
        </div>
        <Link className="text-link" to="/">
          Keep working locally
          <ArrowRight size={15} />
        </Link>
      </aside>
      <section
        className="account-auth-card flat-card"
        aria-label="Workspace authentication"
      >
        {!recovering && mode !== 'confirm' && (
          <nav className="account-mode-tabs" aria-label="Authentication mode">
            <button
              aria-current={mode === 'signin' || isReset ? 'page' : undefined}
              onClick={() => changeMode('signin')}
            >
              Sign in
            </button>
            <button
              aria-current={isSignup ? 'page' : undefined}
              onClick={() => changeMode('signup')}
            >
              Create account
            </button>
          </nav>
        )}
        {mode === 'confirm' ? (
          <div className="account-confirm">
            <div className="account-section-icon">
              <Mail size={24} />
            </div>
            <h2>Check your inbox</h2>
            <p className="muted">
              We sent a confirmation link to <strong>{email}</strong>. Open it
              to finish creating your workspace account.
            </p>
            <p className="small muted">
              Can’t find it? Check your spam folder.
            </p>
            <button className="btn-accent" onClick={() => changeMode('signin')}>
              Back to sign in
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <header className="account-form-heading">
              <h2>
                {recovering
                  ? 'Choose a new password'
                  : isReset
                    ? 'Reset your password'
                    : isSignup
                      ? 'Make room for your ideas'
                      : 'Welcome back'}
              </h2>
              <p className="muted">
                {recovering
                  ? 'Use a strong password to keep your workspace secure.'
                  : isReset
                    ? 'We’ll email you a link to get back in.'
                    : isSignup
                      ? 'Create your private workspace in a moment.'
                      : 'Sign in to your Kimpor Workspace.'}
              </p>
            </header>
            {!isReset && !recovering && (
              <>
                <button
                  className="account-google"
                  disabled={!!busy || !supabase}
                  onClick={() => void run('google', google)}
                >
                  <GoogleMark />
                  {busy === 'google'
                    ? 'Opening Google…'
                    : 'Continue with Google'}
                </button>
                <div className="account-divider">
                  <span />
                  or continue with email
                  <span />
                </div>
              </>
            )}
            <form
              className="account-auth-form"
              onSubmit={(e) => {
                e.preventDefault()
                void run('email', submit)
              }}
            >
              {isSignup && !recovering && (
                <label>
                  Your name
                  <input
                    autoComplete="name"
                    required
                    maxLength={100}
                    placeholder="How should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              {!recovering && (
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {!isReset && (
                <div className="account-password-field">
                  <span className="account-password-label">
                    <label htmlFor="account-password">{recovering ? 'New password' : 'Password'}</label>
                    {!isSignup && !recovering && (
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => changeMode('reset')}
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <span className="account-password-input">
                    <input
                      id="account-password"
                      type={visible ? 'text' : 'password'}
                      aria-label={recovering ? 'New password' : 'Password'}
                      autoComplete={
                        isSignup || recovering
                          ? 'new-password'
                          : 'current-password'
                      }
                      required
                      minLength={isSignup || recovering ? 12 : undefined}
                      placeholder={
                        isSignup || recovering
                          ? 'At least 12 characters'
                          : 'Enter your password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ibtn"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                  {(isSignup || recovering) && (
                    <span className="small muted">
                      Use at least 12 characters for a strong password.
                    </span>
                  )}
                </div>
              )}
              {notice}
              <button
                className="btn-accent account-submit"
                disabled={!!busy || !supabase}
              >
                {busy === 'email'
                  ? 'Please wait…'
                  : recovering
                    ? 'Update password'
                    : isReset
                      ? 'Send reset link'
                      : isSignup
                        ? 'Create your account'
                        : 'Sign in'}
                {!busy && <ArrowRight size={17} />}
              </button>
              {isReset && (
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => changeMode('signin')}
                >
                  Back to sign in
                </button>
              )}
            </form>
          </>
        )}
        <footer className="account-form-footer">
          <LockKeyhole size={14} />
          <span>Your local work stays here. Import it after signing in.</span>
        </footer>
      </section>
    </div>
  )
}
