import { Check, MoreHorizontal, PanelLeft, Search, WifiOff } from 'lucide-react'
import { useEffect, useState, lazy, Suspense } from 'react'
import type { MouseEvent } from 'react'
import {Glass} from '@/components/glass/Glass'
const GlassPopover=lazy(()=>import('@/components/glass/GlassPopover').then(module=>({default:module.GlassPopover})))
import { useSyncStatus, useWorkspace } from '@/data'
import { useGlass } from '@/lib/glass'
import type { MotionPref } from '@/lib/glass'
import { useTheme } from '@/lib/theme'
import type { ThemePref } from '@/lib/theme'
import { modKey, useShell } from './store'
import type { Breakpoint } from './store'
import { useWorkspaceUI } from './workspace'
import { Link } from 'react-router-dom'

const ic = { size: 18, strokeWidth: 1.75 } as const

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  }, [])
  return online
}

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

function Group<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T, e: MouseEvent) => void
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="menu-label t-caption">{label}</div>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="menu-option"
          onClick={(e) => onChange(o.value, e)}
        >
          {o.label}
          {value === o.value ? (
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function Appearance() {
  const theme = useTheme()
  const glass = useGlass()
  return (
    <>
      <Group<ThemePref>
        label="Theme"
        value={theme.pref}
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(v, e) => theme.setPref(v, { x: e.clientX, y: e.clientY })}
      />
      <div className="menu-sep" />
      <Group<MotionPref>
        label="Motion"
        value={glass.motion}
        options={[
          { value: 'system', label: 'Follow system' },
          { value: 'reduced', label: 'Reduced' },
        ]}
        onChange={(v) => glass.setMotion(v)}
      />
    </>
  )
}

export interface Crumb {
  label: string
  parent?: string
}

export function TopBar({ crumb, bp }: { crumb: Crumb; bp: Breakpoint }) {
  const [moreLoaded,setMoreLoaded]=useState(false),[moreOpen,setMoreOpen]=useState(false)
  const moreTrigger=<button type="button" className="ibtn" aria-label="More options" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={()=>{setMoreLoaded(true);setMoreOpen(true)}}><MoreHorizontal {...ic}/></button>
  const online = useOnline()
  const sync = useSyncStatus()
  const compact = bp === 'compact'
  const scrolled = useScrolled(48)
  const { sidebarOpen, setSidebarOpen, setDrawerOpen } = useShell()
  const persistent = bp === 'expanded' || bp === 'large'

  const toggleSidebar = () =>
    persistent ? setSidebarOpen(!sidebarOpen) : setDrawerOpen(true)

  return (
    <Glass
      as="header"
      material="thin"
      className="topbar"
      data-collapsed={compact ? scrolled : true}
    >
      {
        <button
          type="button"
          className="ibtn"
          aria-label={
            persistent && sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'
          }
          aria-pressed={persistent ? sidebarOpen : undefined}
          title={`Sidebar (${modKey()} \\)`}
          onClick={toggleSidebar}
        >
          <PanelLeft {...ic} />
        </button>
      }

      <nav
        className={`crumbs ${compact ? 'collapsed-title' : ''}`}
        aria-label="Breadcrumb"
      >
        <Link className="parent brand-crumb" to="/">
          SingBuild
        </Link>
        <span className="sep brand-crumb" aria-hidden="true">
          /
        </span>
        {crumb.parent ? (
          <>
            <span className="parent">{crumb.parent}</span>
            <span className="sep" aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <span className="current" aria-current="page" title={crumb.label}>
          {crumb.label}
        </span>
      </nav>

      <div className="actions">
        <span
          className="pill"
          role="status"
          data-tone={!online || sync.kind === 'offline' ? 'warn' : sync.kind === 'saving' ? 'busy' : sync.kind === 'error' ? 'error' : 'success'}
          title={sync.kind === 'error' ? sync.reason : undefined}
          aria-label={sync.kind === 'error' ? `Save failed: ${sync.reason}` : undefined}
          data-testid="sync-pill"
        >
          {!online || sync.kind === 'offline' ? <WifiOff size={12} aria-hidden="true"/> : sync.kind === 'saved' ? <Check className="sync-check" size={12} aria-hidden="true"/> : <span className="dot" aria-hidden="true" />}
          <span key={!online?'offline':sync.kind}>{!online || sync.kind === 'offline' ? 'Offline' : sync.kind === 'saved'
            ? useWorkspace.getState().scope === 'guest'
              ? 'Demo · local'
              : 'Saved to cloud'
            : sync.kind === 'saving'
              ? 'Saving'
              : 'Error'}</span>
          {sync.kind === 'error' && online && <button className="text-link small" onClick={()=>void import('@/data/sync').then(({ syncWorkspace }) => syncWorkspace(false))}>Retry</button>}
        </span>
        <button
          type="button"
          className="ibtn"
          aria-label="Open command palette"
          onClick={() => useWorkspaceUI.getState().setCommandOpen(true)}
        >
          <Search {...ic} />
        </button>
        {moreLoaded ? <Suspense fallback={moreTrigger}><GlassPopover label="Appearance and view options" open={moreOpen} onOpenChange={setMoreOpen} trigger={moreTrigger}><Appearance/></GlassPopover></Suspense> : moreTrigger}
        <Link
          to="/settings/appearance"
          className="ibtn"
          aria-label="Workspace settings"
        >
          <img className="brand-logo" src="/brand/favicon.svg" width={28} height={28} alt="" />
        </Link>
      </div>
    </Glass>
  )
}
