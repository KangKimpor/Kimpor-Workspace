import type { PageNode, ProjectSummary, SyncState } from '../types'

export const mockProjects: ProjectSummary[] = [
  { id: 'website', name: 'Website', color: 'blue', progress: 0.62 },
  { id: 'singbuild', name: 'Singbuild tools', color: 'orange', progress: 0.35 },
  { id: 'statistics', name: 'Statistics course', color: 'purple', progress: 0.8 },
]

export const mockPages: PageNode[] = [
  {
    id: 'weekly-plan',
    title: 'Weekly plan',
    icon: '🗓️',
    isFavorite: true,
    children: [{ id: 'monday-notes', title: 'Monday notes', icon: '📝', isFavorite: false, children: [] }],
  },
  { id: 'reading-list', title: 'Reading list', icon: '📚', isFavorite: true, children: [] },
  { id: 'ideas', title: 'Ideas', icon: '💡', isFavorite: false, children: [] },
]

export const mockSyncState: SyncState = { kind: 'saved' }
