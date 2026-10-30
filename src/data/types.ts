/**
 * Data contract, Phase 0 subset. Screens import from `src/data`, never from a component.
 * Codex replaces `src/data/index.ts` with real hooks behind the same shapes (docs/UI-CONTRACT.md).
 */

export type PaletteColor =
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'

export interface ProjectSummary {
  /** Legacy field name: enables the shared NBC BOQ workflow for BP03 and BP04. */
  nbcBp03?: boolean
  id: string
  name: string
  workspace?: 'team' | 'personal'
  color: PaletteColor
  /** 0 to 1, derived from the project's tasks. */
  progress: number
  icon?: string
  description: string
  target: string
  status?: 'Planned' | 'Active' | 'On hold' | 'Completed' | 'Archived'
  startDate?: string
  updatedAt?: string
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

export const statuses = [
  'Not started',
  'In progress',
  'In review',
  'Blocked',
  'Done',
] as const
export type TaskStatus = (typeof statuses)[number]
export const priorities = ['Low', 'Medium', 'High', 'Urgent'] as const
export type Priority = (typeof priorities)[number]
export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'bullet'
  | 'todo'
  | 'quote'
  | 'code'
export interface Block {
  id: string
  kind: BlockKind
  text: string
  checked?: boolean
}
export interface WorkspacePage {
  id: string
  title: string
  icon: string
  isFavorite: boolean
  parentId: string | null
  blocks: Block[]
  updatedAt: string
  deletedAt: string | null
  content?: unknown[]
  cover?: string
  font?: 'default' | 'serif' | 'mono'
  fullWidth?: boolean
  smallText?: boolean
  position?: number
}
export interface Task {
  nbcActivityId?: string | null
  id: string
  title: string
  projectId: string
  status: TaskStatus
  priority: Priority
  due: string
  notes: string
  subtasks: { id: string; title: string; done: boolean }[]
  pageId?: string
  parentId?: string | null
  recurringFrom?: string
  recurrenceStart?: string
  startAt?: string
  dueTime?: string
  estimate?: number
  labels?: string[]
  recurrence?: string
  reminder?: string
  position?: number
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
  deletedAt?: string | null
  activity?: { at: string; text: string }[]
}
export interface TaskView {
  id: string
  name: string
  project: string
  priority: string
  label: string
  query: string
}
export interface CalendarEvent {
  id: string
  title: string
  date: string
  start: string
  end: string
  calendar: string
  color: PaletteColor
  location: string
  endDate?: string
  allDay?: boolean
  timeZone?: string
  recurrence?: string
  description?: string
  guests?: string[]
  meetLink?: string
  googleColorId?: string | null
  googleAttendees?: {
    email: string
    responseStatus?: string
    optional?: boolean
    comment?: string
    displayName?: string
  }[]
  googleReminders?: {
    useDefault: boolean
    overrides?: { method: 'email' | 'popup'; minutes: number }[]
  }
  sourceTimeZone?: string
  startInstant?: string
  endInstant?: string
  isSeriesMaster?: boolean
  restoreDeleted?: boolean
  deleteAfter?: string
  localSeriesId?: string
  excludedDates?: string[]
  recurrenceEdit?: {
    scope: 'this' | 'following' | 'all'
    occurrence: string
    baseDate: string
    baseEndDate: string
    changedFields: (keyof CalendarEvent)[]
  }
  reminders?: number[]
  busy?: boolean
  visibility?: 'default' | 'private' | 'public'
  calendarId?: string
  providerEventId?: string
  etag?: string
  recurringEventId?: string
  originalStartTime?: string
  updatedAt?: string
  deletedAt?: string | null
}

export interface CalendarAccount {
  id: string
  email: string
  name: string
  picture?: string
  status: string
}
export interface UserCalendar {
  id: string
  accountId: string
  providerId: string
  name: string
  color: PaletteColor
  visible: boolean
  isDefault?: boolean
  accessRole: string
  syncToken?: string
  eventFormatVersion?: number
  timeZone?: string
}
