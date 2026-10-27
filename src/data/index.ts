import { create } from 'zustand'
import { eventSeed, pageSeed, projectSeed, taskSeed } from './seed'
import { canParentTask } from './task-tree'
import { contentText } from './text'
import { useWorkspaceUI } from '@/shell/workspace'
import type { Content } from './persistence'
import type {
  CalendarEvent,
  PageNode,
  ProjectSummary,
  SyncState,
  Task,
  WorkspacePage,
} from './types'
export * from './types'
export { dateKey, relativeDate } from './seed'
export type { Content } from './persistence'

export interface Workspace extends Content {
  commitNbc: (patch: Pick<Content, 'nbc_activities' | 'nbc_submissions' | 'nbc_summaries'>) => void
  scope: string
  storageError: boolean
  sync: SyncState
  updatePage: (id: string, patch: Partial<WorkspacePage>) => void
  addPage: (title?: string, parentId?: string | null) => string
  reorderPage: (
    id: string,
    parentId: string | null,
    beforeId?: string,
  ) => boolean
  updateTask: (id: string, patch: Partial<Task>) => void
  trashTask: (id: string) => void
  emptyTrash: () => void
  moveTask: (id: string, status: Task['status'], beforeId?: string) => void
  addTask: (input: Pick<Task, 'title' | 'projectId'> & Partial<Task>) => string
  addProject: (name: string, workspace?: 'team' | 'personal') => string
  updateProject: (id: string, patch: Partial<ProjectSummary>) => void
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void
  setScratchpad: (text: string) => void
  setTaskViews: (views: Content['taskViews']) => void
  setCalendarPreferences: (
    preferences: NonNullable<Content['calendarPreferences']>,
  ) => void
}
export const emptyContent: Content = {
  nbc_activities: [],
  nbc_submissions: [],
  nbc_summaries: [],
  pages: [],
  projects: [],
  tasks: [],
  events: [],
  scratchpad: '',
  taskViews: [],
}
export const sampleContent: Content = {
  taskViews: [],
  pages: pageSeed,
  projects: projectSeed,
  tasks: taskSeed,
  events: eventSeed,
  scratchpad:
    'Review the Quiet Glass tokens and verify the Safari blur fallback before the next milestone.',
}
const KEY = 'kw-workspace-v1'
function validWbsLink(state: Content, projectId: string, activityId?: string | null) {
  return !activityId || (state.projects.some((p) => p.id === projectId && p.nbcBp03) && state.nbc_activities?.some((a) => a.id === activityId && a.projectId === projectId && a.editable))
}
function read(): Content {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return sampleContent
    const data = JSON.parse(raw)
    if (
      !Array.isArray(data.pages) ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.events) ||
      typeof data.scratchpad !== 'string'
    )
      return sampleContent
    return {
      ...data,
      taskViews: data.taskViews ?? [],
      projects: (data.projects ?? projectSeed).map((p: ProjectSummary) => ({ ...p, workspace: p.workspace === 'team' ? 'team' : 'personal' })),
    }
  } catch {
    return sampleContent
  }
}
export const useWorkspace = create<Workspace>((set, get) => {
  const commit = (patch: Partial<Content>) => {
    const previous = contentOf(get())
    const next = { ...previous, ...patch }
    const scope = get().scope
    if (scope !== 'guest') {
      set({ ...patch, sync: { kind: 'saving' } })
      return
    }
    const recoveryKey = scope === 'guest' ? KEY : `kw-recovery:${scope}`
    const serialized = JSON.stringify(next)
    try {
      // The small recovery copy is kept until the IndexedDB transaction completes.
      localStorage.setItem(recoveryKey, serialized)
      set({ ...patch, storageError: false, sync: { kind: 'saving' } })
      if (typeof indexedDB !== 'undefined')
        void import('./persistence')
          .then(({ persist }) => persist(scope, next, previous))
          .then(() => {
            if (
              scope !== 'guest' &&
              localStorage.getItem(recoveryKey) === serialized
            )
              localStorage.removeItem(recoveryKey)
            if (scope === 'guest' && get().scope === scope)
              set({ sync: { kind: 'saved' } })
          })
          .catch(() =>
            set({
              storageError: true,
              sync: {
                kind: 'error',
                reason:
                  'Could not save offline. Export a backup before closing this tab.',
              },
            }),
          )
      else set({ sync: { kind: 'saved' } })
    } catch {
      set({
        ...patch,
        storageError: true,
        sync: { kind: 'error', reason: 'Storage unavailable' },
      })
    }
  }
  return {
    ...read(),
    commitNbc: (patch) => commit(patch),
    scope: 'guest',
    storageError: false,
    sync: { kind: 'saved' },
    trashTask: (id) => {
      const scope = get().scope
      const previous = get().tasks.find((task) => task.id === id)
      if (!previous || previous.deletedAt) return
      get().updateTask(id, { deletedAt: new Date().toISOString() })
      useWorkspaceUI.getState().notify('Task moved to Trash', () => {
        if (get().scope === scope) get().updateTask(id, { deletedAt: previous.deletedAt ?? null })
      })
    },
    emptyTrash: () => {
      const taskIds = new Set(get().tasks.filter((task) => task.deletedAt).map((task) => task.id))
      const pageIds = new Set(get().pages.filter((page) => page.deletedAt || get().tasks.some((task) => taskIds.has(task.id) && task.pageId === page.id)).map((page) => page.id))
      const now = new Date().toISOString()
      commit({
        pages: get().pages.filter((page) => !pageIds.has(page.id)).map((page) => page.parentId && pageIds.has(page.parentId) ? { ...page, parentId: null, updatedAt: now } : page),
        tasks: get().tasks.filter((task) => !taskIds.has(task.id)).map((task) => ({
          ...task,
          ...(task.parentId && taskIds.has(task.parentId) ? { parentId: null, updatedAt: now } : {}),
          ...(task.pageId && pageIds.has(task.pageId) ? { pageId: undefined, notes: '', updatedAt: now } : {}),
        })),
      })
    },
    updatePage: (id, patch) =>
      commit({
        ...(patch.content || patch.blocks
          ? {
              tasks: get().tasks.map((task) =>
                task.pageId === id
                  ? {
                      ...task,
                      notes: contentText(patch.content || patch.blocks).slice(
                        0,
                        500,
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : task,
              ),
            }
          : {}),
        pages: get().pages.map((p) =>
          p.id === id
            ? { ...p, ...patch, id, updatedAt: new Date().toISOString() }
            : p,
        ),
      }),
    addPage: (title = 'Untitled', parentId = null) => {
      const id = crypto.randomUUID()
      commit({
        pages: [
          ...get().pages,
          {
            id,
            title,
            parentId,
            icon: 'note',
            isFavorite: false,
            position: get().pages.length,
            blocks: [{ id: crypto.randomUUID(), kind: 'paragraph', text: '' }],
            updatedAt: new Date().toISOString(),
            deletedAt: null,
          },
        ],
      })
      return id
    },
    reorderPage: (id, parentId, beforeId) => {
      let ancestor = parentId
      const seen = new Set<string>()
      while (ancestor) {
        if (ancestor === id || seen.has(ancestor)) return false
        seen.add(ancestor)
        ancestor = get().pages.find((p) => p.id === ancestor)?.parentId ?? null
      }
      const siblings = get()
        .pages.filter((p) => p.parentId === parentId && p.id !== id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const at = beforeId
        ? siblings.findIndex((p) => p.id === beforeId)
        : siblings.length
      const moving = get().pages.find((p) => p.id === id)
      if (!moving) return false
      siblings.splice(at < 0 ? siblings.length : at, 0, moving)
      const positions = new Map(siblings.map((p, i) => [p.id, i]))
      commit({
        pages: get().pages.map((p) =>
          positions.has(p.id)
            ? {
                ...p,
                parentId,
                position: positions.get(p.id),
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      })
      return true
    },
    updateTask: (id, patch) => {
      const previous = get().tasks.find((t) => t.id === id)
      if (previous && patch.projectId && patch.projectId !== previous.projectId && patch.nbcActivityId === undefined) patch = { ...patch, nbcActivityId: null }
      if (previous && !validWbsLink(get(), patch.projectId ?? previous.projectId, patch.nbcActivityId)) throw new Error('Choose a WBS activity from the same NBC BP03 project.')
      if (
        !previous ||
        (patch.parentId !== undefined &&
          !canParentTask(get().tasks, id, patch.parentId))
      )
        return
      const completedAt = new Date().toISOString()
      commit({
        ...(patch.deletedAt !== undefined && previous.pageId ? { pages: get().pages.map((page) => page.id === previous.pageId ? { ...page, deletedAt: patch.deletedAt ?? null, updatedAt: completedAt } : page) } : {}),
        tasks: get().tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                id,
                updatedAt: new Date().toISOString(),
                completedAt:
                  patch.status === 'Done'
                    ? completedAt
                    : patch.status
                      ? null
                      : t.completedAt,
                activity: [
                  ...(t.activity ?? []),
                  {
                    at: new Date().toISOString(),
                    text: patch.status
                      ? `Status changed to ${patch.status}`
                      : 'Task updated',
                  },
                ].slice(-50),
              }
            : t,
        ),
      })
      if (patch.title !== undefined && previous.pageId)
        get().updatePage(previous.pageId, { title: patch.title })
      if (
        patch.status &&
        patch.status !== 'Done' &&
        previous.status === 'Done'
      ) {
        const spawned = get().tasks.find(
          (t) =>
            t.recurringFrom === id &&
            !t.deletedAt &&
            !t.activity?.length &&
            t.status === 'Not started',
        )
        const page = get().pages.find((p) => p.id === spawned?.pageId)
        if (spawned && (!page || page.updatedAt === spawned.createdAt))
          get().updateTask(spawned.id, { deletedAt: new Date().toISOString() })
      }
      if (
        patch.status === 'Done' &&
        previous.status !== 'Done' &&
        previous.recurrence
      ) {
        const scope = get().scope
        void import('./task-rules')
          .then(({ nextTaskDue, nextTaskReminder }) => {
            const current = get().tasks.find((t) => t.id === id)
            if (
              get().scope !== scope ||
              current?.status !== 'Done' ||
              current.completedAt !== completedAt ||
              get().tasks.some((t) => t.recurringFrom === id && !t.deletedAt)
            )
              return
            const due = nextTaskDue(previous)
            if (due) {
              const nextId = get().addTask({
                title: previous.title,
                projectId: previous.projectId,
                priority: previous.priority,
                notes: previous.notes,
                parentId: previous.parentId,
                reminder: nextTaskReminder(previous, due),
                due,
                dueTime: previous.dueTime,
                estimate: previous.estimate,
                labels: previous.labels,
                recurrence: previous.recurrence,
                recurrenceStart: previous.recurrenceStart || previous.due,
                recurringFrom: id,
                subtasks: previous.subtasks.map((t) => ({
                  ...t,
                  id: crypto.randomUUID(),
                  done: false,
                })),
              })
              const source = get().pages.find((p) => p.id === previous.pageId)
              const target = get().tasks.find((t) => t.id === nextId)?.pageId
              if (source && target)
                commit({
                  pages: get().pages.map((page) =>
                    page.id === target
                      ? {
                          ...page,
                          content: source.content
                            ? structuredClone(source.content)
                            : undefined,
                          blocks: structuredClone(source.blocks),
                        }
                      : page,
                  ),
                })
            }
          })
          .catch(() => {
            const current = get().tasks.find((t) => t.id === id)
            if (
              get().scope === scope &&
              current?.status === 'Done' &&
              current.completedAt === completedAt
            ) {
              get().updateTask(id, { status: previous.status })
              useWorkspaceUI
                .getState()
                .notify(
                  'Could not load the repeat schedule. Reconnect and try completing this task again.',
                )
            }
          })
      }
    },
    moveTask: (id, status, beforeId) => {
      const moving = get().tasks.find((t) => t.id === id)
      if (!moving) return
      const siblings = get()
        .tasks.filter(
          (t) =>
            t.projectId === moving.projectId &&
            t.status === status &&
            t.id !== id,
        )
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const at = beforeId
        ? siblings.findIndex((t) => t.id === beforeId)
        : siblings.length
      siblings.splice(at < 0 ? siblings.length : at, 0, moving)
      const positions = new Map(siblings.map((t, i) => [t.id, i]))
      commit({
        tasks: get().tasks.map((t) =>
          positions.has(t.id)
            ? {
                ...t,
                status,
                position: positions.get(t.id),
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      })
    },
    addTask: (input) => {
      const projectId = get().projects.some((p) => p.id === input.projectId)
        ? input.projectId
        : (get().projects[0]?.id ?? get().addProject('Personal'))
      if (!validWbsLink(get(), projectId, input.nbcActivityId)) throw new Error('Choose a WBS activity from the same NBC BP03 project.')
      const id = crypto.randomUUID(),
        pageId = crypto.randomUUID(),
        now = new Date().toISOString()
      commit({
        pages: [
          ...get().pages,
          {
            id: pageId,
            title: input.title.trim() || 'Untitled task',
            icon: 'note',
            isFavorite: false,
            parentId: null,
            blocks: input.notes
              ? [
                  {
                    id: crypto.randomUUID(),
                    kind: 'paragraph',
                    text: input.notes,
                  },
                ]
              : [],
            updatedAt: now,
            deletedAt: null,
          },
        ],
        tasks: [
          ...get().tasks,
          {
            status: 'Not started',
            priority: 'Medium',
            due: '',
            notes: '',
            subtasks: [],
            position: get().tasks.length,
            createdAt: now,
            updatedAt: now,
            ...input,
            projectId,
            id,
            pageId,
            title: input.title.trim() || 'Untitled task',
          },
        ],
      })
      return id
    },
    addProject: (name, workspace = 'personal') => {
      const id = crypto.randomUUID()
      commit({
        projects: [
          ...get().projects,
          {
            id,
            name: name.trim() || 'Untitled project',
            workspace,
            color: 'blue',
            description: '',
            target: '',
            progress: 0,
            status: 'Planned',
            updatedAt: new Date().toISOString(),
          },
        ],
      })
      return id
    },
    updateProject: (id, patch) =>
      commit({
        projects: get().projects.map((p) =>
          p.id === id
            ? { ...p, ...patch, id, updatedAt: new Date().toISOString() }
            : p,
        ),
      }),
    saveEvent: (event) =>
      commit({
        events: [
          ...get().events.filter((e) => e.id !== event.id),
          { ...event, updatedAt: new Date().toISOString() },
        ],
      }),
    deleteEvent: (id) =>
      commit({
        events: get().events.map((e) =>
          e.id === id
            ? {
                ...e,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : e,
        ),
      }),
    setScratchpad: (scratchpad) => commit({ scratchpad }),
    setTaskViews: (taskViews) => commit({ taskViews }),
    setCalendarPreferences: (calendarPreferences) =>
      commit({ calendarPreferences }),
  }
})
export function contentOf(s: Content): Content {
  return {
    nbc_activities: s.nbc_activities ?? [],
    nbc_submissions: s.nbc_submissions ?? [],
    nbc_summaries: s.nbc_summaries ?? [],
    pages: s.pages,
    projects: s.projects,
    tasks: s.tasks,
    events: s.events,
    scratchpad: s.scratchpad,
    taskViews: s.taskViews ?? [],
    calendarPreferences: s.calendarPreferences,
  }
}
export function pageTree(
  pages: WorkspacePage[],
  parentId: string | null = null,
  visited = new Set<string>(),
): PageNode[] {
  return pages
    .filter(
      (p) => p.parentId === parentId && !p.deletedAt && !visited.has(p.id),
    )
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => ({
      ...p,
      children: pageTree(pages, p.id, new Set([...visited, p.id])),
    }))
}
export function usePages(): PageNode[] {
  const { pages, tasks } = useWorkspace()
  return pageTree(pages.filter((p) => !tasks.some((t) => t.pageId === p.id)))
}
export function useProjects() {
  const { tasks, projects, nbc_activities } = useWorkspace()
  return projects
    .filter((p) => p.status !== 'Archived')
    .map((project) => {
      const list = tasks.filter(
        (t) => t.projectId === project.id && !t.deletedAt,
      )
      return {
        ...project,
        progress: project.nbcBp03 ? (nbc_activities?.some((a) => a.projectId === project.id) ? nbc_activities.filter((a) => a.projectId === project.id && a.editable).reduce((sum, a) => sum + a.globalWeight * a.progress, 0) : project.progress) : list.length
          ? list.filter((t) => t.status === 'Done').length / list.length
          : 0,
      }
    })
}
export function useSyncStatus(): SyncState {
  return useWorkspace((s) => s.sync)
}
