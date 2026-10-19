import { Check, MoreHorizontal, PanelLeft, PanelRight, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Glass, GlassPopover } from '@/components/glass'
import { useSyncStatus } from '@/data'
import { useGlass } from '@/lib/glass'
import type { GlassPref, MotionPref } from '@/lib/glass'
import { useTheme } from '@/lib/theme'
import type { ThemePref } from '@/lib/theme'
import { modKey, useShell } from './store'
import type { Breakpoint } from './store'

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
          {value === o.value ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  )
}

function Appearance() {
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
      <Group<GlassPref>
        label="Glass effect"
        value={glass.pref}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'full', label: 'Full' },
          { value: 'reduced', label: 'Reduced' },
          { value: 'off', label: 'Off' },
        ]}
        onChange={(v) => glass.setPref(v)}
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
  const online = useOnline()
  const sync = useSyncStatus()
  const compact = bp === 'compact'
  const scrolled = useScrolled(48)
  const { sidebarOpen, setSidebarOpen, setDrawerOpen, inspectorOpen, setInspectorOpen, setSheet } = useShell()
  const persistent = bp === 'expanded' || bp === 'large'

  const toggleSidebar = () => (persistent ? setSidebarOpen(!sidebarOpen) : setDrawerOpen(true))
  const toggleInspector = () => {
    if (compact) setSheet('inspector')
    else setInspectorOpen(!inspectorOpen)
  }

  return (
    <Glass as="header" material="thin" className="topbar" data-collapsed={compact ? scrolled : true}>
      {!compact ? (
        <button
          type="button"
          className="ibtn"
          aria-label={persistent && sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
          aria-pressed={persistent ? sidebarOpen : undefined}
          title={`Sidebar (${modKey()} \\)`}
          onClick={toggleSidebar}
        >
          <PanelLeft {...ic} />
        </button>
      ) : null}

      <nav className={`crumbs ${compact ? 'collapsed-title' : ''}`} aria-label="Breadcrumb">
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
        {!online ? (
          <span className="pill offline-pill" data-tone="warn" role="status">
            <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
            Offline
          </span>
        ) : null}
        <span className="pill" role="status" data-tone={sync.kind === 'saving' ? 'busy' : undefined} data-testid="sync-pill">
          <span className="dot" aria-hidden="true" />
          {sync.kind === 'saved' ? 'Saved' : sync.kind === 'saving' ? 'Saving' : 'Sync paused'}
        </span>
        <button
          type="button"
          className="ibtn"
          aria-label="Toggle details"
          aria-pressed={compact ? undefined : inspectorOpen}
          onClick={toggleInspector}
        >
          <PanelRight {...ic} />
        </button>
        <GlassPopover
          label="Appearance and view options"
          trigger={
            <button type="button" className="ibtn" aria-label="More options">
              <MoreHorizontal {...ic} />
            </button>
          }
        >
          <Appearance />
        </GlassPopover>
      </div>
    </Glass>
  )
}
