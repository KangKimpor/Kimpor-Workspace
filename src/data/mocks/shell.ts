import type { PageNode, SyncState } from '../types'

export { projectSeed as mockProjects } from '../seed'

export const mockPages: PageNode[] = [
  {
    id: 'weekly-plan',
    title: 'Weekly plan',
    icon: '🗓️',
    isFavorite: true,
    children: [
      {
        id: 'monday-notes',
        title: 'Monday notes',
        icon: '📝',
        isFavorite: false,
        children: [],
      },
    ],
  },
  {
    id: 'reading-list',
    title: 'Reading list',
    icon: '📚',
    isFavorite: true,
    children: [],
  },
  { id: 'ideas', title: 'Ideas', icon: '💡', isFavorite: false, children: [] },
]

export const mockSyncState: SyncState = { kind: 'saved' }
