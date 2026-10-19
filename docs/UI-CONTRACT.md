# UI Contract (Phase 0 subset)

Screens import only from `src/data`. Codex replaces `src/data/index.ts` with real providers behind these shapes. Source of truth today: `src/data/types.ts`.

```ts
type PaletteColor = 'gray'|'brown'|'orange'|'yellow'|'green'|'blue'|'purple'|'pink'|'red'
interface ProjectSummary { id: string; name: string; color: PaletteColor; progress: number /* 0..1 */ }
interface PageNode { id: string; title: string; icon: string; isFavorite: boolean; children: PageNode[] }
type SyncState =
  | { kind: 'saved' } | { kind: 'saving' }
  | { kind: 'offline'; pending: number } | { kind: 'error'; reason: string }

useProjects(): ProjectSummary[]
usePages(): PageNode[]
useSyncStatus(): SyncState
```

Mutations will return `{ ok: true } | { ok: false; reason: string }`; screens never catch.
Page, Block, Task, Event, Calendar and provider interfaces are added in Phases 1 to 3.
