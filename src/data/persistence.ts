import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  CalendarEvent,
  ProjectSummary,
  Task,
  WorkspacePage,
  TaskView,
} from './types'

export interface Content {
  pages: WorkspacePage[]
  projects: ProjectSummary[]
  tasks: Task[]
  events: CalendarEvent[]
  scratchpad: string
  taskViews: TaskView[]
  calendarPreferences?: { weekStart: 0 | 1; hour12: boolean }
}
export type Collection = 'pages' | 'projects' | 'tasks' | 'events'
export const collections: Collection[] = [
  'pages',
  'projects',
  'tasks',
  'events',
]
export interface Pending {
  key: string
  scope: string
  collection: Collection | 'profiles'
  id: string
  data: Record<string, unknown>
  version: string
  base: string | null
}
class WorkspaceDB extends Dexie {
  snapshots!: Table<{ scope: string; content: Content }, string>
  outbox!: Table<Pending, string>
  versions!: Table<{ key: string; value: string }, string>
  files!: Table<{ id: string; blob: Blob; name: string }, string>
  constructor() {
    super('kimpor-workspace')
    this.version(1).stores({
      snapshots: 'scope',
      outbox: 'key,scope',
      versions: 'key',
      files: 'id',
    })
  }
}
export const db = new WorkspaceDB()
export function eventWriteReady(event: CalendarEvent, now = Date.now()) {
  const after = Date.parse(event.deleteAfter || '')
  return !event.deletedAt || !Number.isFinite(after) || after <= now
}
let writeQueue: Promise<unknown> = Promise.resolve()
export function persist(scope: string, content: Content, previous: Content) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() =>
      db.transaction('rw', db.snapshots, db.outbox, db.versions, async () => {
        await db.snapshots.put({ scope, content: structuredClone(content) })
        if (scope === 'guest') return
        if (
          content.scratchpad !== previous.scratchpad ||
          content.taskViews !== previous.taskViews ||
          content.calendarPreferences !== previous.calendarPreferences
        ) {
          const key = `${scope}:profiles:${scope}`
          await db.outbox.put({
            key,
            scope,
            collection: 'profiles',
            id: scope,
            data: {
              id: scope,
              scratchpad: content.scratchpad,
              taskViews: content.taskViews,
              calendarPreferences: content.calendarPreferences,
            },
            version: crypto.randomUUID(),
            base: (await db.versions.get(key))?.value ?? null,
          })
        }
        for (const collection of collections) {
          const old = new Map(
            previous[collection].map((row) => [row.id, JSON.stringify(row)]),
          )
          for (const row of content[collection]) {
            if (old.get(row.id) === JSON.stringify(row)) continue
            const key = `${scope}:${collection}:${row.id}`
            const base = (await db.versions.get(key))?.value ?? null
            await db.outbox.put({
              key,
              scope,
              collection,
              id: row.id,
              data: row as unknown as Record<string, unknown>,
              version: crypto.randomUUID(),
              base,
            })
          }
        }
      }),
    )
  return writeQueue
}
export async function flushLocal() {
  await writeQueue
}
