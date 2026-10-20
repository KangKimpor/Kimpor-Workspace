import { create } from 'zustand'

export type Breakpoint = 'compact' | 'medium' | 'expanded' | 'large'

/** Compact below 640, medium 640 to 1023, expanded 1024 to 1439, large 1440 and up (§3). */
export function breakpointFor(width: number): Breakpoint {
  if (width < 640) return 'compact'
  if (width < 1024) return 'medium'
  if (width < 1440) return 'expanded'
  return 'large'
}

export const SIDEBAR_MIN = 220
export const SIDEBAR_MAX = 380
export const SIDEBAR_DEFAULT = 260
const WIDTH_KEY = 'kw-sidebar-w'

function readWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY))
    return n >= SIDEBAR_MIN && n <= SIDEBAR_MAX ? n : SIDEBAR_DEFAULT
  } catch {
    return SIDEBAR_DEFAULT
  }
}

export type SheetKind = 'quick-add' | null

interface ShellState {
  sidebarWidth: number
  /** Persistent sidebar (expanded and large) is open. */
  sidebarOpen: boolean
  /** Overlay drawer (medium) is open. */
  drawerOpen: boolean
  sheet: SheetKind
  setSidebarWidth: (w: number) => void
  setSidebarOpen: (open: boolean) => void
  setDrawerOpen: (open: boolean) => void
  setSheet: (sheet: SheetKind) => void
}

export const useShell = create<ShellState>((set) => ({
  sidebarWidth: readWidth(),
  sidebarOpen: true,
  drawerOpen: false,
  sheet: null,
  setSidebarWidth: (w) => {
    const sidebarWidth = Math.min(
      SIDEBAR_MAX,
      Math.max(SIDEBAR_MIN, Math.round(w / 4) * 4),
    )
    try {
      localStorage.setItem(WIDTH_KEY, String(sidebarWidth))
    } catch {
      /* storage unavailable */
    }
    set({ sidebarWidth })
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setSheet: (sheet) => set({ sheet }),
}))

export const isMac = () =>
  /Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)
export const modKey = () => (isMac() ? '⌘' : 'Ctrl')
