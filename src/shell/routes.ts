import { usePages, useProjects } from '@/data'
import type { PageNode } from '@/data'
import type { Crumb } from './TopBar'

export interface ScreenMeta {
  title: string
  /** Phase that delivers the real screen. Absent for screens that already exist. */
  phase?: number
  blurb?: string
}

const flat = (nodes: PageNode[]): PageNode[] =>
  nodes.flatMap((n) => [n, ...flat(n.children)])

export function useCrumb(pathname: string): Crumb & { meta: ScreenMeta } {
  const pages = flat(usePages())
  const projects = useProjects()
  const seg = pathname.split('/').filter(Boolean)
  const head = seg[0]
  if (!head) return { label: 'Home', meta: { title: 'Home' } }
  if (head === 'design')
    return {
      label: 'Design system',
      parent: 'Workspace',
      meta: { title: 'Design system' },
    }
  if (head === 'calendar')
    return {
      label: 'Calendar',
      meta: {
        title: 'Calendar',
        phase: 3,
        blurb: 'Day, week, month and agenda views arrive in Phase 3.',
      },
    }
  if (head === 'tasks')
    return {
      label: 'My tasks',
      meta: {
        title: 'My tasks',
        phase: 2,
        blurb: 'Today, upcoming and overdue tasks arrive in Phase 2.',
      },
    }
  if (head === 'projects')
    return {
      label: projects.find((p) => p.id === seg[1])?.name ?? 'Projects',
      parent: seg[1] ? 'Projects' : undefined,
      meta: { title: 'Projects' },
    }
  if (head === 'search')
    return {
      label: 'Search',
      meta: {
        title: 'Search',
        phase: 4,
        blurb: 'Full search with filters arrives in Phase 4.',
      },
    }
  if (head === 'settings')
    return {
      label: 'Settings',
      meta: {
        title: 'Settings',
        phase: 4,
        blurb: 'Appearance, calendar and data settings arrive in Phase 4.',
      },
    }
  if (head === 'trash')
    return {
      label: 'Trash',
      meta: {
        title: 'Trash',
        phase: 1,
        blurb: 'Deleted pages are kept for 30 days. Trash arrives in Phase 1.',
      },
    }
  if (head === 'p') {
    const page = pages.find((p) => p.id === seg[1])
    const title = page?.title ?? 'New page'
    return {
      label: title,
      parent: 'Pages',
      meta: { title, phase: 1, blurb: 'The block editor arrives in Phase 1.' },
    }
  }
  return {
    label: 'Not found',
    meta: { title: 'Not found', blurb: 'This page does not exist.' },
  }
}
