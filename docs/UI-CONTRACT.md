# UI Contract (Stitch UI continuation)

The initial Phase 0 hooks below remain available. `ProjectSummary` now also includes `description` and `target`; progress derives from local tasks. `src/data/types.ts` additionally defines `WorkspacePage`, `Block`, `Task`, and `CalendarEvent`. `useWorkspace` exposes the browser persistence store and mutations; failures keep edits in memory and set `storageError` for a visible banner. `useSyncStatus` reports local persistence only. No remote provider is implemented. Current mutation methods return an ID or void, so the previously proposed result union below is a future backend contract, not implemented behavior.

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
