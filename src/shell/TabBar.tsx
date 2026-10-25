import { FolderKanban, LayoutDashboard, Plus, Search, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Glass } from '@/components/glass/Glass'
import { useShell } from './store'

const ic = { size: 22, strokeWidth: 1.75 } as const

function Tab({ to, label, end, children }: { to: string; label: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink to={to} end={end} className="tab" aria-label={label}>
      {children}
      <span>{label}</span>
    </NavLink>
  )
}

/** Compact workspace navigation, add, projects, search and settings. 64 px plus the safe area (§12). */
export function TabBar() {
  const setSheet = useShell((s) => s.setSheet)
  return (
    <Glass as="nav" material="regular" className="tabbar" aria-label="Tabs" data-testid="tabbar">
      <Tab to="/" end label="Workspace"><LayoutDashboard {...ic} /></Tab>
      {/* Solid, not glass: glass never stacks on glass (§10) */}
      <button type="button" className="btn-accent tab-add" data-round="true" aria-label="Quick add" onClick={() => setSheet('quick-add')}>
        <Plus size={24} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <Tab to="/projects" label="Projects">
        <FolderKanban {...ic} />
      </Tab>
      <Tab to="/search" label="Search">
        <Search {...ic} />
      </Tab>
      <Tab to="/settings/appearance" label="Settings"><Settings {...ic} /></Tab>
    </Glass>
  )
}
