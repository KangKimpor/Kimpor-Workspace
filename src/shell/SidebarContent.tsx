/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Delegated link clicks include keyboard activation. */
import {
  FileText,
  FolderKanban,
  ChartNoAxesCombined,
  Search,
  Settings,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProjects } from '@/data'
import { modKey } from './store'
import { Tile } from '@/components/WorkspaceUI'
import { useWorkspaceUI } from './workspace'
/** Lucide at 1.75 px stroke, currentColor (§9). */
const ic = { size: 18, strokeWidth: 1.75 } as const

function Item({
  to,
  icon,
  label,
  meta,
  end,
  children,
}: {
  to: string
  icon: React.ReactNode
  label: string
  meta?: React.ReactNode
  end?: boolean
  children?: React.ReactNode
}) {
  const { search } = useLocation()
  return (
    <li>
      <NavLink to={to} end={end} className="nav-item" aria-current={to.includes('?') && search !== `?${to.split('?')[1]}` ? false : undefined}>
        <span className="nav-icon">{icon}</span>
        <span className="nav-label">{label}</span>
        {meta ? <span className="nav-meta">{meta}</span> : null}
      </NavLink>
      {children}
    </li>
  )
}

/** Sidebar contents, shared by the persistent sidebar and the overlay drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects()

  return (
    <>
      <div className="nav-item workspace-btn" style={{ cursor: 'default' }}>
        <img className="brand-logo" src="/brand/favicon.svg" alt="" width={28} height={28} />
        <span className="nav-label">SingBuild Workspace</span>
      </div>

      <nav
        className="sidebar-body"
        aria-label="Primary"
        onClick={(e) =>
          (e.target as HTMLElement).closest('a') && onNavigate?.()
        }
      >
        <ul className="nav-list" style={{ marginTop: 'var(--space-8)' }}>
          <li>
            <button
              className="nav-item sidebar-search"
              onClick={() => {
                onNavigate?.()
                useWorkspaceUI.getState().setCommandOpen(true)
              }}
            >
              <Search size={15} />
              <span className="nav-label">Search</span>
              <span className="kbd">{modKey()} K</span>
            </button>
          </li>

        </ul>

        {(['team', 'personal'] as const).map((workspace) => (
          <div className="nav-section" key={workspace}>
            <div className="t-caption">{workspace === 'team' ? 'Team Workspace' : 'Personal Workspace'}</div>
            <ul className="nav-list">
              <Item to={`/projects?workspace=${workspace}`} end icon={<FolderKanban {...ic} />} label={workspace === 'team' ? 'Team projects' : 'Personal projects'} meta={<ChevronDown size={13} />}>
                <ul className="nav-list nav-projects" aria-label={workspace === 'team' ? 'Team projects' : 'Personal projects'}>
                  {projects.filter((p) => !p.nbcBp03 && (p.workspace ?? 'personal') === workspace).map((p) => (
                    <li key={p.id}><NavLink to={`/projects/${p.id}/table`} className="nav-item">
                      <span className="nav-icon"><Tile name={p.icon || p.id} color={p.color} /></span>
                      <span className="nav-label">{p.name}</span><span className="nav-meta">{Math.round(p.progress * 100)}%</span>
                    </NavLink></li>
                  ))}
                </ul>
              </Item>
            </ul>
          </div>
        ))}
        <div className="nav-section"><div className="t-caption">Projects Progress</div><ul className="nav-list"><Item to="/projects-progress" end icon={<ChartNoAxesCombined {...ic} />} label="Projects Progress" /><li><ul className="nav-list nav-projects" aria-label="Progress projects">{projects.filter((p) => p.nbcBp03).map((p) => <li key={p.id}><NavLink to={`/projects-progress/${p.id}/overview`} className="nav-item"><span className="nav-icon"><Tile name={p.icon || p.id} color={p.color} /></span><span className="nav-label">{p.name}</span><span className="nav-meta">{Math.round(p.progress * 100)}%</span></NavLink></li>)}</ul></li></ul></div>
      </nav>

      <div className="sidebar-foot">
        <ul className="nav-list">
          <Item to="/trash" icon={<Trash2 {...ic} />} label="Trash" />
          <Item
            to="/settings/appearance"
            icon={<Settings {...ic} />}
            label="Settings"
          />
        </ul>

      </div>
    </>
  )
}

export const PageIcon = FileText
