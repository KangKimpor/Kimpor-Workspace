import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckSquare,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { completeTask } from '@/components/TaskRow'
import { Badge, statusColor } from '@/components/WorkspaceUI'
import {
  dateKey,
  priorities,
  statuses,
  useProjects,
  useWorkspace,
} from '@/data'
import type { CalendarEvent, Priority, TaskStatus } from '@/data'
import { useTheme } from '@/lib/theme'
import { modKey } from './store'
import { useWorkspaceUI } from './workspace'
import { useCalendars, defaultCalendar } from '@/calendar/store'
import { canParentTask } from '@/data/task-tree'
import { contentText, searchRank, htmlText } from '@/data/text'
import {
  localSeriesChange,
  occurrenceDraft,
  validateRecurrence,
  seriesEditPending,
} from '@/calendar/recurrence'
import type { RecurrenceScope } from '@/calendar/recurrence'
import { googleEventColors } from '@/calendar/colors'
import type { PaletteColor } from '@/data'

export function SearchResults({
  query,
  onSelect,
  selected = -1,
}: {
  query: string
  onSelect?: () => void
  selected?: number
}) {
  const pages = useWorkspace((s) => s.pages)
  const tasks = useWorkspace((s) => s.tasks)
  const events = useWorkspace((s) => s.events)
  const projects = useProjects()
  const q = query.toLowerCase().trim()
  const { openTask, openEvent } = useWorkspaceUI()
  const results = [
    ...pages
      .filter((p) => !p.deletedAt)
      .map((p) => ({
        id: p.id,
        title: p.title || 'Untitled',
        body: contentText(p.content || p.blocks),
        type: 'Page',
        to: `/p/${p.id}`,
        icon: FileText,
      })),
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      body: p.description,
      type: 'Project',
      to: `/projects/${p.id}/overview`,
      icon: FileText,
    })),
    ...tasks
      .filter((t) => !t.deletedAt)
      .map((t) => ({
        id: t.id,
        title: t.title,
        body: `${t.notes} ${(t.labels || []).join(' ')}`,
        type: 'Task',
        to: '',
        icon: CheckSquare,
      })),
    ...events
      .filter((e) => !e.deletedAt && !e.isSeriesMaster)
      .map((e) => ({
        id: e.id,
        title: e.title,
        body: `${e.description || ''} ${e.location}`,
        type: 'Event',
        to: '',
        icon: CalendarDays,
      })),
  ]
    .map((result) => ({
      ...result,
      rank: searchRank(q, result.title, result.body),
    }))
    .filter((result) => Number.isFinite(result.rank))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, q ? 12 : 5)
  return (
    <div className="search-results">
      {results.map((result, i) => {
        const children = (
          <>
            <result.icon size={17} />
            <span>
              <strong>{result.title}</strong>
              <span className="small muted">
                {result.type} · Kimpor Workspace
              </span>
            </span>
            <ArrowRight size={14} />
          </>
        )
        return result.to ? (
          <Link
            data-search-result
            data-selected={selected === i}
            className="search-result"
            key={`${result.type}-${result.id}`}
            to={result.to}
            onClick={onSelect}
          >
            {children}
          </Link>
        ) : (
          <button
            data-search-result
            data-selected={selected === i}
            className="search-result"
            key={`${result.type}-${result.id}`}
            onClick={() => {
              onSelect?.()
              if (result.type === 'Task') openTask(result.id)
              else openEvent(result.id)
            }}
          >
            {children}
          </button>
        )
      })}
      {!results.length && (
        <p className="quiet-empty">
          No results for “{query}”. Try a different word.
        </p>
      )}
    </div>
  )
}
export function SearchPage() {
  const [query, setQuery] = useState('')
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1 className="t-title">Search</h1>
          <p className="muted">Find a thought, a task, or your next plan.</p>
        </div>
      </header>
      <label className="search-field search-page-field">
        <Search size={20} />
        <input
          aria-label="Search workspace"
          placeholder="Search your workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <SearchResults query={query} />
    </div>
  )
}
function CommandPalette() {
  const { commandOpen, setCommandOpen, openTask } = useWorkspaceUI()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()
  const { addPage, addTask } = useWorkspace()
  const theme = useTheme()
  useEffect(() => {
    if (commandOpen) {
      setQuery('')
      setSelected(0)
    }
  }, [commandOpen])
  return (
    <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="command-palette glass"
          data-material="thick"
          onKeyDown={(e) => {
            const results = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                '[data-search-result]',
              ),
            )
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setSelected((i) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    i + (e.key === 'ArrowDown' ? 1 : -1),
                  ),
                ),
              )
            }
            if (
              e.key === 'Enter' &&
              document.activeElement?.tagName === 'INPUT'
            ) {
              e.preventDefault()
              results[selected]?.click()
            }
          }}
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <div className="command-input">
            <Search size={21} />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(0)
              }}
              placeholder="Search pages, tasks, and events…"
              aria-label="Search and commands"
            />
            <Dialog.Close className="kbd">Esc</Dialog.Close>
          </div>
          <div className="command-body">
            <span className="eyebrow">
              {query ? 'RESULTS' : 'JUMP BACK IN'}
            </span>
            <SearchResults
              query={query}
              selected={selected}
              onSelect={() => setCommandOpen(false)}
            />
            {!query && (
              <>
                <div className="menu-sep" />
                <span className="eyebrow">QUICK ACTIONS</span>
                {[
                  {
                    label: 'Create a new page',
                    icon: Plus,
                    run: () => navigate(`/p/${addPage()}`),
                  },
                  {
                    label: 'Create a new task',
                    icon: CheckSquare,
                    run: () =>
                      openTask(
                        addTask({ title: 'New task', projectId: 'website' }),
                      ),
                  },
                  {
                    label: 'Go to today',
                    icon: CalendarDays,
                    run: () => navigate('/calendar/day/today'),
                  },
                  {
                    label: 'Toggle theme',
                    icon: Check,
                    run: () =>
                      theme.setPref(
                        theme.resolved === 'dark' ? 'light' : 'dark',
                      ),
                  },
                ].map((action) => (
                  <button
                    className="command-action"
                    key={action.label}
                    onClick={() => {
                      setCommandOpen(false)
                      action.run()
                    }}
                  >
                    <action.icon size={16} />
                    {action.label}
                  </button>
                ))}
              </>
            )}
          </div>
          <footer>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> to navigate
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
            <span>{modKey()} K to search</span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
function TaskInspector() {
  const navigate = useNavigate()
  const { taskId, openTask } = useWorkspaceUI()
  const { tasks, updateTask } = useWorkspace()
  const projects = useProjects()
  const [subtask, setSubtask] = useState('')
  const task = tasks.find((t) => t.id === taskId)
  useEffect(() => setSubtask(''), [taskId])
  return (
    <Dialog.Root open={!!task} onOpenChange={(open) => !open && openTask(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="inspector-scrim" />
        <Dialog.Content
          className="task-inspector glass"
          data-material="thick"
          aria-describedby={undefined}
        >
          <div className="row-between">
            <span className="eyebrow">TASK DETAILS</span>
            <Dialog.Close className="ibtn" aria-label="Close task details">
              <X size={17} />
            </Dialog.Close>
          </div>
          {task && (
            <>
              <Dialog.Title className="sr-only">{task.title}</Dialog.Title>
              <div className="inspector-complete">
                <input
                  type="checkbox"
                  aria-label="Mark task complete"
                  checked={task.status === 'Done'}
                  onChange={() => completeTask(task)}
                />
                <Badge color={statusColor[task.status]}>{task.status}</Badge>
              </div>
              <textarea
                className="task-title-input"
                rows={3}
                aria-label="Task title"
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
              />
              <div className="property-list">
                <label>
                  Status
                  <select
                    aria-label="Status"
                    value={task.status}
                    onChange={(e) =>
                      updateTask(task.id, {
                        status: e.target.value as TaskStatus,
                      })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    aria-label="Priority"
                    value={task.priority}
                    onChange={(e) =>
                      updateTask(task.id, {
                        priority: e.target.value as Priority,
                      })
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Due date
                  <input
                    aria-label="Due date"
                    type="date"
                    value={task.due}
                    onChange={(e) =>
                      updateTask(task.id, { due: e.target.value })
                    }
                  />
                </label>
                <label>
                  Project
                  <select
                    aria-label="Project"
                    value={task.projectId}
                    onChange={(e) =>
                      updateTask(task.id, { projectId: e.target.value })
                    }
                  >
                    {projects.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start date
                  <input
                    type="datetime-local"
                    value={task.startAt || ''}
                    onChange={(e) =>
                      updateTask(task.id, { startAt: e.target.value })
                    }
                  />
                </label>
                <label>
                  Due time
                  <input
                    type="time"
                    value={task.dueTime || ''}
                    onChange={(e) =>
                      updateTask(task.id, { dueTime: e.target.value })
                    }
                  />
                </label>
                <label>
                  Estimate (minutes)
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={task.estimate ?? ''}
                    onChange={(e) =>
                      updateTask(task.id, {
                        estimate: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label>
                  Labels
                  <input
                    placeholder="Separate labels with commas"
                    key={task.id}
                    defaultValue={(task.labels || []).join(', ')}
                    onBlur={(e) =>
                      updateTask(task.id, {
                        labels: e.target.value
                          .split(',')
                          .map((label) => label.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Parent task
                  <select
                    value={task.parentId || ''}
                    onChange={(e) =>
                      updateTask(task.id, { parentId: e.target.value || null })
                    }
                  >
                    <option value="">No parent</option>
                    {tasks
                      .filter(
                        (parent) =>
                          parent.id !== task.id &&
                          !parent.deletedAt &&
                          canParentTask(tasks, task.id, parent.id),
                      )
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Repeat
                  <select
                    value={task.recurrence || ''}
                    onChange={(e) =>
                      updateTask(task.id, {
                        recurrence: e.target.value,
                        recurrenceStart: task.due,
                      })
                    }
                  >
                    <option value="">Does not repeat</option>
                    <option value="FREQ=DAILY">Daily</option>
                    <option value="FREQ=WEEKLY">Weekly</option>
                    <option value="FREQ=MONTHLY">Monthly</option>
                  </select>
                  {task.recurrence && !task.due && (
                    <span className="small muted">
                      Set a due date to start repeating.
                    </span>
                  )}
                </label>
                <label>
                  Reminder
                  <input
                    type="datetime-local"
                    value={task.reminder || ''}
                    onChange={(e) =>
                      updateTask(task.id, { reminder: e.target.value })
                    }
                  />
                </label>
              </div>
              <section className="inspector-section">
                <h3>
                  Subtasks{' '}
                  <span className="small muted">
                    {task.subtasks.filter((s) => s.done).length}/
                    {task.subtasks.length}
                  </span>
                </h3>
                {task.subtasks.map((sub) => (
                  <label className="subtask" key={sub.id}>
                    <input
                      type="checkbox"
                      checked={sub.done}
                      onChange={(e) =>
                        updateTask(task.id, {
                          subtasks: task.subtasks.map((s) =>
                            s.id === sub.id
                              ? { ...s, done: e.target.checked }
                              : s,
                          ),
                        })
                      }
                    />
                    <span data-checked={sub.done}>{sub.title}</span>
                  </label>
                ))}
                <form
                  className="subtask-add"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (subtask.trim()) {
                      updateTask(task.id, {
                        subtasks: [
                          ...task.subtasks,
                          {
                            id: crypto.randomUUID(),
                            title: subtask.trim(),
                            done: false,
                          },
                        ],
                      })
                      setSubtask('')
                    }
                  }}
                >
                  <input
                    aria-label="New subtask"
                    placeholder="Add a subtask…"
                    value={subtask}
                    onChange={(e) => setSubtask(e.target.value)}
                  />
                  <button className="ibtn" aria-label="Add subtask">
                    <Plus size={16} />
                  </button>
                </form>
              </section>
              <section className="inspector-section">
                <h3>Notes & specifications</h3>
                {task.pageId ? (
                  <>
                    <p className="small muted">
                      {task.notes ||
                        'Add notes, checklists, files and context to this task’s page.'}
                    </p>
                    <Link
                      className="btn-secondary"
                      to={`/p/${task.pageId}`}
                      onClick={() => openTask(null)}
                    >
                      Open notes editor
                      <ArrowRight size={15} />
                    </Link>
                  </>
                ) : (
                  <>
                    <textarea
                      className="notes-input"
                      rows={6}
                      value={task.notes}
                      placeholder="Add a little context…"
                      aria-label="Task notes"
                      onChange={(e) =>
                        updateTask(task.id, { notes: e.target.value })
                      }
                    />
                    <button
                      className="btn-text"
                      onClick={() => {
                        const state = useWorkspace.getState()
                        const pageId = state.addPage(task.title)
                        state.updatePage(pageId, {
                          blocks: task.notes
                            ? [
                                {
                                  id: crypto.randomUUID(),
                                  kind: 'paragraph',
                                  text: task.notes,
                                },
                              ]
                            : [],
                        })
                        state.updateTask(task.id, { pageId })
                        openTask(null)
                        navigate(`/p/${pageId}`)
                      }}
                    >
                      Open as a task page
                      <ArrowRight size={15} />
                    </button>
                  </>
                )}
              </section>
              <div className="inspector-section small muted">
                <details>
                  <summary>Activity</summary>
                  {(task.activity || [])
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <p key={`${entry.at}:${i}`}>
                        {entry.text} · {new Date(entry.at).toLocaleString()}
                      </p>
                    ))}
                </details>
                <button
                  className="btn-text danger-text"
                  onClick={() => {
                    updateTask(task.id, {
                      deletedAt: new Date().toISOString(),
                    })
                    openTask(null)
                    useWorkspaceUI
                      .getState()
                      .notify('Task deleted', () =>
                        updateTask(task.id, { deletedAt: null }),
                      )
                  }}
                >
                  Delete task
                </button>
              </div>
              <WorkspaceToast />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
function EventEditor() {
  const calendars = useCalendars((s) => s.calendars)
  const accounts = useCalendars((s) => s.accounts)
  const { eventId, eventOccurrence, eventPatch, openEvent, notify } =
    useWorkspaceUI()
  const { saveEvent, deleteEvent } = useWorkspace()
  const [draft, setDraft] = useState<CalendarEvent | null>(null)
  const pendingSeries = useWorkspace((s) => {
    const event = s.events.find((e) => e.id === eventId)
    return event ? seriesEditPending(s.events, event) : false
  })
  const [original, setOriginal] = useState<CalendarEvent | null>(null)
  const [scope, setScope] = useState<RecurrenceScope>('this')
  const [guestText, setGuestText] = useState('')
  const [descriptionText, setDescriptionText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    setScope('this')
    const existing = useWorkspace
      .getState()
      .events.find((e) => e.id === eventId && !e.deletedAt)
    const occurrence = existing
      ? occurrenceDraft(existing, eventOccurrence)
      : null
    setOriginal(occurrence)
    setDescriptionText(
      existing?.providerEventId
        ? htmlText(existing.description || '')
        : existing?.description || '',
    )
    setGuestText(
      useWorkspace
        .getState()
        .events.find((event) => event.id === eventId)
        ?.guests?.join(', ') || '',
    )
    if (!eventId) {
      setDraft(null)
      return
    }
    const [, date, hour, minute] = eventId.split(':')
    const preferred = defaultCalendar()
    const start = hour ? `${hour}:${minute ?? '00'}` : '09:00'
    const end = hour
      ? `${String(Math.min(23, Number(hour) + 1)).padStart(2, '0')}:${minute ?? '00'}`
      : '10:00'
    setDraft(
      eventId.startsWith('new')
        ? {
            id: crypto.randomUUID(),
            title: '',
            date: date || dateKey(),
            start,
            end,
            calendar: preferred?.name || 'Personal',
            calendarId: preferred?.id,
            color: preferred?.color || 'blue',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            location: '',
          }
        : occurrence
          ? { ...occurrence, ...eventPatch }
          : null,
    )
  }, [eventId, eventOccurrence, eventPatch])
  const recurring = !!(
    original?.recurrence ||
    original?.recurringEventId ||
    original?.localSeriesId
  )
  function applyChange(event: CalendarEvent, remove = false) {
    const before = useWorkspace.getState().events
    if (event.recurringEventId && recurring) {
      const fields = [
        'title',
        'date',
        'endDate',
        'start',
        'end',
        'timeZone',
        'sourceTimeZone',
        'allDay',
        'recurrence',
        'description',
        'guests',
        'reminders',
        'googleReminders',
        'busy',
        'visibility',
        'googleColorId',
        'location',
      ] as const
      saveEvent({
        ...event,
        ...(remove
          ? {
              deletedAt: new Date().toISOString(),
              deleteAfter: new Date(Date.now() + 8000).toISOString(),
            }
          : {}),
        recurrenceEdit: {
          scope,
          occurrence: event.originalStartTime || event.date,
          baseDate: original!.date,
          baseEndDate: original!.endDate || original!.date,
          changedFields: fields.filter(
            (field) =>
              JSON.stringify(event[field]) !==
              JSON.stringify(original?.[field]),
          ),
        },
      })
      notify(
        remove ? 'Deletion queued for Google' : 'Changes queued for Google',
        remove
          ? () => {
              const previous = before.find((item) => item.id === event.id)
              if (previous) saveEvent(previous)
            }
          : undefined,
      )
    } else {
      const changed = recurring
        ? localSeriesChange(before, event, scope, remove, original || undefined)
        : [
            {
              ...event,
              ...(remove ? { deletedAt: new Date().toISOString() } : {}),
            },
          ]
      for (const item of changed) saveEvent(item)
      notify(remove ? 'Event deleted' : 'Event saved', () => {
        for (const item of changed) {
          const previous = before.find((e) => e.id === item.id)
          if (previous)
            saveEvent({
              ...previous,
              ...(remove && previous.providerEventId
                ? { restoreDeleted: true }
                : {}),
            })
          else deleteEvent(item.id)
        }
      })
    }
    openEvent(null)
  }
  return (
    <Dialog.Root
      open={!!eventId}
      onOpenChange={(open) => !open && openEvent(null)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className="event-editor glass"
          data-material="thick"
          aria-describedby={undefined}
        >
          <div className="row-between">
            <Dialog.Title className="t-h3">
              {eventId?.startsWith('new') ? 'New event' : 'Event details'}
            </Dialog.Title>
            <Dialog.Close className="ibtn" aria-label="Close event editor">
              <X size={17} />
            </Dialog.Close>
          </div>
          {draft ? (
            pendingSeries ? (
              <p role="status">
                A series change is waiting to sync. You can edit this series
                again after it finishes.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!draft.title.trim()) {
                    setError('Give this event a title.')
                    return
                  }
                  if (
                    !draft.allDay &&
                    (!draft.endDate || draft.endDate === draft.date) &&
                    draft.end <= draft.start
                  ) {
                    setError('End time must be after start time.')
                    return
                  }
                  try {
                    new Intl.DateTimeFormat('en', {
                      timeZone:
                        draft.timeZone ||
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  } catch {
                    setError(
                      'Choose a valid IANA time zone, such as Asia/Bangkok.',
                    )
                    return
                  }
                  const guests = guestText
                    .split(',')
                    .map((email) => email.trim())
                    .filter(Boolean)
                  if (
                    guests.some(
                      (email) => !/^\S+@[^\s@]+\.[^\s@]+$/.test(email),
                    )
                  ) {
                    setError(
                      'Enter valid guest email addresses separated by commas.',
                    )
                    return
                  }
                  if ((draft.endDate || draft.date) < draft.date) {
                    setError('End date must be on or after the start date.')
                    return
                  }
                  if (
                    recurring &&
                    scope === 'this' &&
                    draft.recurrence !== original?.recurrence
                  ) {
                    setError(
                      'Choose All events or This and following to change the repeat rule.',
                    )
                    return
                  }
                  try {
                    validateRecurrence(draft.recurrence || '')
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : 'Enter a valid RRULE.',
                    )
                    return
                  }
                  applyChange({ ...draft, guests, title: draft.title.trim() })
                }}
              >
                {recurring && (
                  <label>
                    Apply changes to
                    <select
                      aria-label="Apply changes to"
                      value={scope}
                      onChange={(e) =>
                        setScope(e.target.value as RecurrenceScope)
                      }
                    >
                      <option value="this">This event</option>
                      <option value="following">This and following</option>
                      <option value="all">All events</option>
                    </select>
                  </label>
                )}
                <label>
                  Title
                  <input
                    autoFocus
                    required
                    maxLength={300}
                    placeholder="What’s the plan?"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    required
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Start
                    <input
                      required
                      type="time"
                      value={draft.start}
                      onChange={(e) =>
                        setDraft({ ...draft, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    End
                    <input
                      required
                      type="time"
                      value={draft.end}
                      onChange={(e) =>
                        setDraft({ ...draft, end: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Calendar
                  <select
                    value={draft.calendarId || draft.calendar}
                    disabled={!!draft.providerEventId}
                    onChange={(e) => {
                      const calendar = calendars.find(
                        (c) => c.id === e.target.value,
                      )
                      setDraft({
                        ...draft,
                        calendarId: calendar?.id,
                        calendar: calendar?.name || e.target.value,
                        color: calendar?.color || 'blue',
                      })
                    }}
                  >
                    {['Personal', 'Work', 'Singbuild'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                    {Array.from(new Set(calendars.map((c) => c.accountId))).map(
                      (accountId) => (
                        <optgroup
                          key={accountId}
                          label={
                            accounts.find((a) => a.id === accountId)?.email ||
                            'Google Calendar'
                          }
                        >
                          {calendars
                            .filter((c) => c.accountId === accountId)
                            .map((c) => (
                              <option
                                key={c.id}
                                value={c.id}
                                disabled={
                                  !['owner', 'writer'].includes(c.accessRole)
                                }
                              >
                                {c.name}
                                {!['owner', 'writer'].includes(c.accessRole)
                                  ? ' (read only)'
                                  : ''}
                              </option>
                            ))}
                        </optgroup>
                      ),
                    )}
                  </select>
                </label>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={!!draft.allDay}
                    onChange={(e) =>
                      setDraft({ ...draft, allDay: e.target.checked })
                    }
                  />
                  All day
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    min={draft.date}
                    value={draft.endDate || draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, endDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  Time zone
                  <input
                    value={
                      draft.timeZone ||
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        timeZone: e.target.value,
                        sourceTimeZone: undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={descriptionText}
                    onChange={(e) => {
                      setDescriptionText(e.target.value)
                      setDraft({ ...draft, description: e.target.value })
                    }}
                  />
                </label>
                <label>
                  Repeat
                  <select
                    value={
                      draft.recurrence &&
                      ![
                        'FREQ=DAILY',
                        'FREQ=WEEKLY',
                        'FREQ=MONTHLY',
                        'FREQ=YEARLY',
                      ].includes(draft.recurrence)
                        ? 'custom'
                        : (draft.recurrence ??
                          (draft.recurringEventId || draft.localSeriesId
                            ? 'inherit'
                            : ''))
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        recurrence:
                          e.target.value === 'inherit'
                            ? undefined
                            : e.target.value === 'custom'
                              ? 'FREQ=WEEKLY;INTERVAL=2'
                              : e.target.value,
                      })
                    }
                  >
                    {(draft.recurringEventId || draft.localSeriesId) && (
                      <option value="inherit">
                        Series schedule (unchanged)
                      </option>
                    )}
                    <option value="">Does not repeat</option>
                    <option value="FREQ=DAILY">Daily</option>
                    <option value="FREQ=WEEKLY">Weekly</option>
                    <option value="FREQ=MONTHLY">Monthly</option>
                    <option value="FREQ=YEARLY">Yearly</option>
                    <option value="custom">Custom RRULE</option>
                  </select>
                </label>
                {draft.recurrence &&
                  ![
                    'FREQ=DAILY',
                    'FREQ=WEEKLY',
                    'FREQ=MONTHLY',
                    'FREQ=YEARLY',
                  ].includes(draft.recurrence) && (
                    <label>
                      Repeat rule
                      <input
                        aria-label="Repeat rule"
                        value={draft.recurrence}
                        onChange={(e) =>
                          setDraft({ ...draft, recurrence: e.target.value })
                        }
                      />
                      <span className="small muted">
                        For example: FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10
                      </span>
                    </label>
                  )}
                <label>
                  Reminder
                  <select
                    value={
                      draft.googleReminders?.useDefault
                        ? 'default'
                        : (draft.reminders?.[0] ?? '')
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        reminders:
                          e.target.value && e.target.value !== 'default'
                            ? [Number(e.target.value)]
                            : [],
                        googleReminders:
                          e.target.value === 'default'
                            ? { useDefault: true }
                            : undefined,
                      })
                    }
                  >
                    {draft.calendarId && (
                      <option value="default">Calendar default</option>
                    )}
                    <option value="">None</option>
                    <option value="10">10 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </label>
                <label>
                  Guests
                  <input
                    type="text"
                    placeholder="Email addresses separated by commas"
                    value={guestText}
                    onChange={(e) => setGuestText(e.target.value)}
                  />
                </label>
                {!!draft.googleAttendees?.length && (
                  <ul className="small muted">
                    {draft.googleAttendees
                      .filter((guest) =>
                        guestText
                          .split(',')
                          .map((email) => email.trim())
                          .includes(guest.email),
                      )
                      .map((guest) => (
                        <li key={guest.email}>
                          {guest.email} ·{' '}
                          {guest.responseStatus === 'accepted'
                            ? 'Accepted'
                            : guest.responseStatus === 'declined'
                              ? 'Declined'
                              : guest.responseStatus === 'tentative'
                                ? 'Maybe'
                                : 'Awaiting response'}
                        </li>
                      ))}
                  </ul>
                )}
                {draft.meetLink &&
                  /^https:\/\/meet\.google\.com\/[a-z-]+$/.test(
                    draft.meetLink,
                  ) && (
                    <a
                      className="text-link"
                      href={draft.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Join Google Meet ↗
                    </a>
                  )}
                <label>
                  Availability
                  <select
                    value={draft.busy === false ? 'free' : 'busy'}
                    onChange={(e) =>
                      setDraft({ ...draft, busy: e.target.value === 'busy' })
                    }
                  >
                    <option value="busy">Busy</option>
                    <option value="free">Free</option>
                  </select>
                </label>
                <label>
                  Visibility
                  <select
                    value={draft.visibility || 'default'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        visibility: e.target
                          .value as CalendarEvent['visibility'],
                      })
                    }
                  >
                    <option value="default">Calendar default</option>
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <label>
                  Event color
                  {draft.calendarId ? (
                    <select
                      value={draft.googleColorId || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          googleColorId: e.target.value || null,
                          color:
                            googleEventColors.find(
                              (c) => c.id === e.target.value,
                            )?.palette ||
                            calendars.find((c) => c.id === draft.calendarId)
                              ?.color ||
                            'blue',
                        })
                      }
                    >
                      <option value="">Calendar default</option>
                      {googleEventColors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={draft.color}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          color: e.target.value as PaletteColor,
                        })
                      }
                    >
                      {[
                        'gray',
                        'brown',
                        'orange',
                        'yellow',
                        'green',
                        'blue',
                        'purple',
                        'pink',
                        'red',
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Location
                  <input
                    placeholder="Add a location or meeting link"
                    value={draft.location}
                    onChange={(e) =>
                      setDraft({ ...draft, location: e.target.value })
                    }
                  />
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <footer>
                  {!eventId?.startsWith('new') && (
                    <button
                      className="btn-secondary danger-text"
                      type="button"
                      onClick={() => {
                        applyChange(draft, true)
                      }}
                    >
                      Delete
                    </button>
                  )}
                  <button className="btn-accent" type="submit">
                    Save event
                  </button>
                </footer>
                <p className="small muted">
                  {draft.calendarId
                    ? 'Changes sync to Google when online.'
                    : 'Saved in your workspace. Choose a Google calendar to sync this event.'}
                </p>
              </form>
            )
          ) : (
            <p>Event not found.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function WorkspaceOverlays() {
  const taskId = useWorkspaceUI((s) => s.taskId)
  const storageError = useWorkspace((s) => s.storageError)
  return (
    <>
      <CommandPalette />
      <TaskInspector />
      <EventEditor />
      {storageError && (
        <div className="storage-banner" role="alert">
          Storage is unavailable. Changes are only in memory; export pages
          before closing this tab.
        </div>
      )}
      {!taskId && <WorkspaceToast />}
    </>
  )
}

function WorkspaceToast() {
  const toast = useWorkspaceUI((s) => s.toast)
  return (
    <>
      {toast && (
        <div
          className="workspace-toast glass"
          data-material="thick"
          role="status"
        >
          <Check size={16} />
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.()
                useWorkspaceUI.setState({ toast: null })
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => useWorkspaceUI.setState({ toast: null })}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  )
}
