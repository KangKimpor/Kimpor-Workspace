import {
  BarChart3,
  BookOpen,
  FileText,
  Flag,
  Globe,
  LayoutDashboard,
  Lightbulb,
  NotebookPen,
  Smartphone,
  Star,
  HardHat,
  Hammer,
  Wrench,
  Construction,
  Building2,
  Warehouse,
  Truck,
  Ruler,
  Paintbrush,
  Drill,
  BrickWall,
  Pickaxe,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '@/data'
import type { PaletteColor, ProjectSummary, TaskStatus } from '@/data'

export const statusColor: Record<TaskStatus, PaletteColor> = {
  'Not started': 'gray',
  'In progress': 'blue',
  'In review': 'purple',
  Blocked: 'red',
  Done: 'green',
}
export function tint(color: PaletteColor): CSSProperties {
  return {
    '--tint': `var(--c-${color})`,
    '--tint-bg': `var(--chip-${color})`,
  } as CSSProperties
}
export const projectIcons = {
  website: Globe,
  mobile: Smartphone,
  planning: BarChart3,
  star: Star,
  book: BookOpen,
  layout: LayoutDashboard,
  flag: Flag,
  bulb: Lightbulb,
  note: NotebookPen,
  'hard-hat': HardHat,
  hammer: Hammer,
  wrench: Wrench,
  construction: Construction,
  building: Building2,
  warehouse: Warehouse,
  truck: Truck,
  ruler: Ruler,
  paintbrush: Paintbrush,
  drill: Drill,
  'brick-wall': BrickWall,
  pickaxe: Pickaxe,
} satisfies Record<string, typeof FileText>
export function Tile({
  name,
  color = 'blue',
}: {
  name: string
  color?: PaletteColor
}) {
  const Icon = (projectIcons as Record<string, typeof FileText>)[name] ?? FileText
  return (
    <span className="icon-tile" style={tint(color)}>
      {/^(storage:|local-file:)/.test(name) ? (
        <UploadedIcon source={name} />
      ) : /\p{Extended_Pictographic}/u.test(name) ? (
        <span aria-hidden="true">{name}</span>
      ) : (
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  )
}
function UploadedIcon({ source }: { source: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    void import('@/data/files')
      .then((module) => module.resolveFile(source))
      .then((value) => {
        if (active) setUrl(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [source])
  return url ? (
    <img
      src={url}
      width={16}
      height={16}
      alt=""
      style={{ objectFit: 'cover', borderRadius: 'var(--radius-chip)' }}
    />
  ) : (
    <FileText size={16} aria-hidden="true" />
  )
}
export function Badge({
  color = 'gray',
  children,
}: {
  color?: PaletteColor
  children: ReactNode
}) {
  return (
    <span className="status-badge" style={tint(color)}>
      {children}
    </span>
  )
}
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  )
}
export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      className="project-card flat-card"
      to={`/projects/${project.id}/table`}
      style={tint(project.color)}
    >
      <div className="row-between">
        <Tile name={project.icon || project.id} color={project.color} />
        <span className="project-percent">
          {Math.round(project.progress * 100)}%
        </span>
      </div>
      <div>
        <h3>{project.name}</h3>
        <p>{project.description}</p>
      </div>
      <div className="progress-track">
        <span style={{ width: `${project.progress * 100}%` }} />
      </div>
      <div className="row-between muted small">
        <span className="inline">
          <Flag size={13} /> Due {formatDate(project.target)}
        </span>
        <span className="owner-avatar">K</span>
      </div>
    </Link>
  )
}
export function ProjectCards({ workspace }: { workspace?: 'team' | 'personal' } = {}) {
  return (
    <div className="project-grid">
      {useProjects().filter((p) => !workspace || (p.workspace ?? 'personal') === workspace).map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  )
}
export function formatDate(value: string): string {
  if (!value) return 'No date'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid time value')
  return `${date.toDateString().slice(4, 7)} ${date.getDate()}`
}
