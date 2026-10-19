import { PanelRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { Ambient, Glass } from '@/components/glass'
import { useGlass, watchFrameTime } from '@/lib/glass'
import { watchSystemTheme } from '@/lib/theme'
import { BottomSheet, SideSheet } from './Overlays'
import { Sidebar } from './Sidebar'
import { SidebarContent } from './SidebarContent'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import { useCrumb } from './routes'
import { breakpointFor, useShell } from './store'

function InspectorBody() {
  return (
    <EmptyState icon={<PanelRight size={28} strokeWidth={1.75} />} title="Nothing selected">
      Task and event details open here.
    </EmptyState>
  )
}

/** App shell: sidebar, canvas and inspector at expanded and large; drawer and right sheet at medium; tab bar and bottom sheets at compact. */
export function AppShell() {
  const root = useRef<HTMLDivElement>(null)
  const [bp, setBp] = useState(() => breakpointFor(window.innerWidth))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const crumb = useCrumb(pathname)
  const shell = useShell()
  const persistent = bp === 'expanded' || bp === 'large'

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => entry && setBp(breakpointFor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const stopTheme = watchSystemTheme()
    const stopFrames = watchFrameTime()
    useGlass.getState().setAuto('full')
    return () => {
      stopTheme()
      stopFrames()
    }
  }, [])

  // Overlays that do not exist at this breakpoint close when the breakpoint changes.
  const { setDrawerOpen, setSheet } = shell
  useEffect(() => {
    if (persistent) setDrawerOpen(false)
    if (bp !== 'compact') setSheet(null)
  }, [bp, persistent, setDrawerOpen, setSheet])

  // Ctrl or Cmd plus backslash toggles the sidebar; Ctrl or Cmd plus K opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '\\') {
        e.preventDefault()
        if (persistent) useShell.getState().setSidebarOpen(!useShell.getState().sidebarOpen)
        else if (bp === 'medium') useShell.getState().setDrawerOpen(!useShell.getState().drawerOpen)
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate('/search')
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [bp, navigate, persistent])

  return (
    <div
      ref={root}
      className="shell"
      data-bp={bp}
      data-sidebar={shell.sidebarOpen ? 'open' : 'closed'}
      data-inspector={shell.inspectorOpen ? 'open' : 'closed'}
      style={{ ['--sidebar-w' as string]: `${shell.sidebarWidth}px` }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Ambient />
      {persistent ? <Sidebar /> : null}

      <div className="main">
        <TopBar crumb={crumb} bp={bp} />
        <main id="main" tabIndex={-1} className={bp === 'compact' ? 'canvas canvas-compact-pad' : 'canvas'}>
          <Outlet context={crumb.meta} />
        </main>
      </div>

      {persistent && shell.inspectorOpen ? (
        <div className="inspector-slot">
          <Glass as="aside" material="regular" className="inspector" aria-label="Details">
            <div className="inspector-head t-label">Details</div>
            <InspectorBody />
          </Glass>
        </div>
      ) : null}

      {bp === 'medium' ? (
        <>
          <SideSheet side="left" className="drawer" title="Sidebar" open={shell.drawerOpen} onOpenChange={shell.setDrawerOpen}>
            <SidebarContent onNavigate={() => shell.setDrawerOpen(false)} />
          </SideSheet>
          <SideSheet side="right" className="rsheet" title="Details" open={shell.inspectorOpen} onOpenChange={shell.setInspectorOpen}>
            <div className="inspector-head t-label">Details</div>
            <InspectorBody />
          </SideSheet>
        </>
      ) : null}

      {bp === 'compact' ? (
        <>
          <TabBar />
          <BottomSheet
            open={shell.sheet !== null}
            onOpenChange={(o) => !o && shell.setSheet(null)}
            title={shell.sheet === 'quick-add' ? 'Quick add' : 'Details'}
          >
            {shell.sheet === 'quick-add' ? (
              <EmptyState icon={<PanelRight size={28} strokeWidth={1.75} />} title="Quick add">
                Natural language task and event entry arrives in Phase 4.
              </EmptyState>
            ) : (
              <InspectorBody />
            )}
          </BottomSheet>
        </>
      ) : null}
    </div>
  )
}
