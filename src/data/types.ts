/**
 * Data contract, Phase 0 subset. Screens import from `src/data`, never from a component.
 * Codex replaces `src/data/index.ts` with real hooks behind the same shapes (docs/UI-CONTRACT.md).
 */

export type PaletteColor = 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'

export interface ProjectSummary {
  id: string
  name: string
  color: PaletteColor
  /** 0 to 1, derived from the project's tasks. */
  progress: number
}

export interface PageNode {
  id: string
  title: string
  icon: string
  isFavorite: boolean
  children: PageNode[]
}

export type SyncState =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'offline'; pending: number }
  | { kind: 'error'; reason: string }
