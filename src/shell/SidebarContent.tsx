import {
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  Home,
  Palette,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { usePages, useProjects } from '@/data'
import type { PageNode } from '@/data'
import { modKey } from './store'

/** Lucide at 1.75 px stroke, currentColor (§9). */
const ic = { size: 18, strokeWidth: 1.75 } as const

function Item({ to, icon, label, meta, end }: { to: string; icon: React.ReactNode; label: string; meta?: React.ReactNode; end?: boolean }) {
  return (
    <li>
      <NavLink to={to} end={end} className="nav-item">
        <span className="nav-icon">{icon}</span>
        <span className="nav-label">{label}</span>
        {meta ? <span className="nav-meta">{meta}</span> : null}
      </NavLink>
    </li>
  )
}

function PageRows({ nodes, depth = 0 }: { nodes: PageNode[]; depth?: number }) {
  return nodes.map((n) => (
    <li key={n.id}>
      <NavLink to={`/p/${n.id}`} className="nav-item" style={{ paddingLeft: `calc(var(--space-12) + ${depth * 16}px)` }}>
        <span className="nav-icon" aria-hidden="true">
          {n.icon}
        </span>
        <span className="nav-label" title={n.title}>
          {n.title}
        </span>
      </NavLink>
      {n.children.length ? (
        <ul className="nav-list">
          <PageRows nodes={n.children} depth={depth + 1} />
        </ul>
      ) : null}
    </li>
  ))
}

/** Sidebar contents, shared by the persistent sidebar and the overlay drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useProjects()
  const pages = usePages()
  const favorites = pages.filter((p) => p.isFavorite)

  return (
    <>
      <div className="nav-item workspace-btn" style={{ cursor: 'default' }}>
        <span
          className="nav-icon"
          aria-hidden="true"
          style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)', borderRadius: 'var(--radius-control)', fontWeight: 700 }}
        >
          K
        </span>
        <span className="nav-label">Kimpor Workspace</span>
      </div>

      <nav className="sidebar-body" aria-label="Primary" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
        <ul className="nav-list" style={{ marginTop: 'var(--space-8)' }}>
          <Item to="/search" icon={<Search {...ic} />} label="Search" meta={<span className="kbd">{modKey()} K</span>} />
          <Item to="/" end icon={<Home {...ic} />} label="Home" />
          <Item to="/calendar/week/today" icon={<CalendarDays {...ic} />} label="Calendar" />
          <Item to="/tasks" icon={<CheckSquare {...ic} />} label="My tasks" />
        </ul>

        <div className="nav-section">
          <div className="t-caption">Projects</div>
          <ul className="nav-list">
            {projects.map((p) => (
              <li key={p.id}>
                <NavLink to={`/projects/${p.id}/overview`} className="nav-item">
                  <span className="nav-icon">
                    <span className="dot" style={{ ['--dot' as string]: `var(--c-${p.color})` }} />
                  </span>
                  <span className="nav-label">{p.name}</span>
                  <span className="nav-meta">{Math.round(p.progress * 100)}%</span>
                </NavLink>
              </li>
            ))}
            <Item to="/projects" end icon={<FolderKanban {...ic} />} label="All projects" />
          </ul>
        </div>

        <div className="nav-section">
          <div className="t-caption">Favorites</div>
          <ul className="nav-list">
            <PageRows nodes={favorites.map((f) => ({ ...f, children: [] }))} />
          </ul>
        </div>

        <div className="nav-section">
          <div className="t-caption">Pages</div>
          <ul className="nav-list">
            <PageRows nodes={pages} />
          </ul>
        </div>
      </nav>

      <div className="sidebar-foot">
        <ul className="nav-list">
          <Item to="/trash" icon={<Trash2 {...ic} />} label="Trash" />
          <Item to="/settings/appearance" icon={<Settings {...ic} />} label="Settings" />
          <Item to="/design" icon={<Palette {...ic} />} label="Design system" />
        </ul>
        <NavLink to="/p/new" className="btn-accent" onClick={onNavigate}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New page
        </NavLink>
      </div>
    </>
  )
}

export const PageIcon = FileText
