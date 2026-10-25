import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { UpdateNotice } from './UpdateNotice'
import { watchSystemTheme } from '@/lib/theme'
const BottomSheet = lazy(() =>
  import('./Overlays').then((module) => ({ default: module.BottomSheet })),
)
const SideSheet = lazy(() =>
  import('./Overlays').then((module) => ({ default: module.SideSheet })),
)
const Sidebar = lazy(() =>
  import('./Sidebar').then((module) => ({ default: module.Sidebar })),
)
const SidebarContent = lazy(() =>
  import('./SidebarContent').then((module) => ({ default: module.SidebarContent })),
)
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import { useCrumb } from './routes'
import { breakpointFor, useShell } from './store'
const WorkspaceOverlays = lazy(() =>
  import('./WorkspaceOverlays').then((module) => ({
    default: module.WorkspaceOverlays,
  })),
)
import { useWorkspaceUI } from './workspace'
import { useWorkspace } from '@/data'
const Reminders = lazy(() => import('@/components/Reminders'))
const QuickAdd = lazy(() =>
  import('@/components/QuickAdd').then((module) => ({
    default: module.QuickAdd,
  })),
)

/** Flat sidebar navigation with an overlay drawer and bottom tabs on smaller screens. */
export function AppShell() {
  const hasOverlay = useWorkspaceUI(
    (state) =>
      !!(state.commandOpen || state.eventId || state.toast),
  )
  const hasReminders = useWorkspace(
    (s) =>
      s.tasks.some((t) => t.reminder && !t.deletedAt && t.status !== 'Done') ||
      s.events.some((e) => e.reminders?.length && !e.deletedAt),
  )
  const scope = useWorkspace((s) => s.scope)
  const lastScope = useRef(scope)
  const root = useRef<HTMLDivElement>(null)
  const [bp, setBp] = useState(() => breakpointFor(window.innerWidth))
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (lastScope.current !== scope) { lastScope.current = scope; navigate('/', { replace: true }) }
  }, [scope, navigate])
  const crumb = useCrumb(pathname)
  const shell = useShell()
  const persistent = bp === 'expanded' || bp === 'large'
  const [overlaysReady, setOverlaysReady] = useState(false)
  useEffect(() => {
    if (shell.drawerOpen || shell.sheet) setOverlaysReady(true)
  }, [shell.drawerOpen, shell.sheet])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(
      ([entry]) => entry && setBp(breakpointFor(entry.contentRect.width)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const stopTheme = watchSystemTheme()
    return () => {
      stopTheme()
    }
  }, [])

  // Overlays that do not exist at this breakpoint close when the breakpoint changes.
  const { setDrawerOpen, setSheet } = shell
  useEffect(() => {
    if (persistent) setDrawerOpen(false)
    if (bp !== 'compact') setSheet(null)
  }, [bp, persistent, setDrawerOpen, setSheet])

  // Ctrl or Cmd plus backslash toggles the sidebar; Ctrl or Cmd plus K opens search.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (
          !e.altKey &&
          e.key.toLowerCase() === 'c' &&
          !(e.target as HTMLElement).closest(
            'input,textarea,select,[contenteditable="true"]',
          ) &&
          !document.querySelector('[role="dialog"]')
        ) {
          e.preventDefault()
          useShell.getState().setSheet('quick-add')
        }
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        if (persistent)
          useShell.getState().setSidebarOpen(!useShell.getState().sidebarOpen)
        else if (bp === 'medium')
          useShell.getState().setDrawerOpen(!useShell.getState().drawerOpen)
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useWorkspaceUI
          .getState()
          .setCommandOpen(!useWorkspaceUI.getState().commandOpen)
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
      style={{ ['--sidebar-w' as string]: `${shell.sidebarWidth}px` }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      {hasReminders && (
        <Suspense fallback={null}>
          <Reminders />
        </Suspense>
      )}
      {persistent ? <Suspense fallback={null}><Sidebar /></Suspense> : null}

      <div className="main">
        <TopBar crumb={crumb} bp={bp} />
        <main
          id="main"
          tabIndex={-1}
          className={bp === 'compact' ? 'canvas canvas-compact-pad' : 'canvas'}
        >
          <Outlet context={crumb.meta} />
        </main>
      </div>

      {bp === 'compact' ? <TabBar /> : null}
      <UpdateNotice />
      <Suspense
        fallback={
          <span className="sr-only" role="status">
            Opening…
          </span>
        }
      >
        {overlaysReady && (bp === 'medium' || bp === 'compact') ? (
          <>
            <SideSheet
              side="left"
              className="drawer"
              title="Sidebar"
              open={shell.drawerOpen}
              onOpenChange={shell.setDrawerOpen}
            >
              <SidebarContent onNavigate={() => shell.setDrawerOpen(false)} />
            </SideSheet>
          </>
        ) : null}

        {bp === 'compact' ? (
          <>
            {overlaysReady && (
              <BottomSheet
                open={shell.sheet !== null}
                onOpenChange={(o) => !o && shell.setSheet(null)}
                title="Quick add"
              >
                <Suspense fallback={<p>Loading quick add…</p>}>
                  <QuickAdd onDone={() => shell.setSheet(null)} />
                </Suspense>
                <div className="quick-add-options">
                  <button
                    className="btn-accent"
                    onClick={() => {
                      shell.setSheet(null)
                      useWorkspaceUI.getState().openEvent('new')
                    }}
                  >
                    New event
                  </button>
                </div>
              </BottomSheet>
            )}
          </>
        ) : null}
        {overlaysReady && bp !== 'compact' && (
          <SideSheet
            side="right"
            className="rsheet"
            open={shell.sheet !== null}
            onOpenChange={(open) => !open && shell.setSheet(null)}
            title="Quick add"
          >
            <Suspense fallback={<p>Loading quick add…</p>}>
              <QuickAdd onDone={() => shell.setSheet(null)} />
            </Suspense>
          </SideSheet>
        )}
      </Suspense>
      {hasOverlay && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              Opening…
            </span>
          }
        >
          <WorkspaceOverlays />
        </Suspense>
      )}
    </div>
  )
}
