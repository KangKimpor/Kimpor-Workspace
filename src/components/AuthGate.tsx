import { useEffect, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { initializeCloud, useAccount } from '@/data/sync'
import { useTheme, watchSystemTheme } from '@/lib/theme'
import { AccountSettings } from './AccountSettings'
import './auth-gate.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready, recovering } = useAccount()
  const theme = useTheme()
  useEffect(() => {
    void initializeCloud()
    return watchSystemTheme()
  }, [])
  if (ready && session && !recovering) return children
  return <div className="auth-page">
    <header className="auth-header">
      <span className="auth-brand"><img src="/brand/favicon.svg" alt="" width={30} height={30}/>SingBuild</span>
      <button className="ibtn" aria-label={`Switch to ${theme.resolved === 'dark' ? 'light' : 'dark'} theme`} onClick={() => theme.setPref(theme.resolved === 'dark' ? 'light' : 'dark')}>
        {theme.resolved === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}
      </button>
    </header>
    <main className="auth-main"><AccountSettings standalone loading={!ready}/></main>
    <footer className="auth-footer">SingBuild Workspace</footer>
  </div>
}
