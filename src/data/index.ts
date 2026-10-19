import { mockPages, mockProjects, mockSyncState } from './mocks/shell'
import type { PageNode, ProjectSummary, SyncState } from './types'

export type { PageNode, PaletteColor, ProjectSummary, SyncState } from './types'

/** Phase 0 hooks. Same signatures the real providers will keep. */
export function useProjects(): ProjectSummary[] {
  return mockProjects
}

export function usePages(): PageNode[] {
  return mockPages
}

export function useSyncStatus(): SyncState {
  return mockSyncState
}
