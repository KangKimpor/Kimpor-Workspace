import '@/styles/calendar.css'
import './workspace-views.css'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { displayTime } from '@/calendar/time'
import { TZDate } from '@date-fns/tz'
import { zonedDate } from '@/calendar/time'
import { useCalendars, defaultCalendar } from '@/calendar/store'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { Badge, tint } from '@/components/WorkspaceUI'
import { completeTask } from '@/components/TaskRow'
import { dateKey, useWorkspace } from '@/data'
import type { CalendarEvent, Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { clock, expandEvents, layoutEvents, minutes } from '@/calendar/layout'
import {
  seriesEditPending,
  shiftDay,
  dayDifference,
} from '@/calendar/recurrence'

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
export function weekStart(date: Date, start: 0 | 1 = 1) {
  return addDays(date, -((date.getDay() - start + 7) % 7))
}
function TimelineDay({
  date,
  events,
  tasks,
}: {
  date: Date
  events: CalendarEvent[]
  tasks: Task[]
}) {
  const key = dateKey(date),
    ui = useWorkspaceUI(),
    { saveEvent, updateTask } = useWorkspace()
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    start: number
    x: number
    y: number
    active: boolean
    event?: CalendarEvent
    resize?: boolean
  } | null>(null)
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [selection, setSelection] = useState<{
    start: number
    end: number
  } | null>(null)
  const [moving, setMoving] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  const [activeSlot, setActiveSlot] = useState(28)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    const preventScroll = (e: TouchEvent) => {
      if (drag.current?.active) e.preventDefault()
    }
    const element = grid.current
    element?.addEventListener('touchmove', preventScroll, { passive: false })
    return () => {
      clearInterval(timer)
      clearTimeout(delay.current)
      element?.removeEventListener('touchmove', preventScroll)
    }
  }, [])
  const point = (y: number) =>
    Math.max(
      0,
      Math.min(
        1425,
        Math.floor(
          ((y - (grid.current?.getBoundingClientRect().top || 0)) /
            (grid.current?.getBoundingClientRect().height || 1)) *
            96,
        ) * 15,
      ),
    )
  function startGesture(
    e: React.PointerEvent<HTMLElement>,
    event?: CalendarEvent,
    resize = false,
  ) {
    if (e.button !== 0) return
    e.stopPropagation()
    const gesture = {
      start: point(e.clientY),
      x: e.clientX,
      y: e.clientY,
      active: e.pointerType !== 'touch',
      event,
      resize,
    }
    drag.current = gesture
    const target = e.currentTarget,
      pointer = e.pointerId
    const activate = () => {
      if (drag.current !== gesture) return
      gesture.active = true
      target.setPointerCapture(pointer)
      if (!event)
        setSelection({ start: gesture.start, end: gesture.start + 15 })
    }
    if (e.pointerType === 'touch') delay.current = setTimeout(activate, 350)
    else activate()
  }
  function saveMoved(event: CalendarEvent, patch: Partial<CalendarEvent>) {
    if (seriesEditPending(useWorkspace.getState().events, event)) {
      ui.notify('This series has a change waiting to sync.')
      return
    }
    const base =
      useWorkspace.getState().events.find((e) => e.id === event.id) || event
    if (
      !event.providerEventId &&
      event.sourceTimeZone &&
      event.timeZone !== event.sourceTimeZone
    ) {
      const first = new TZDate(
        zonedDate(
          patch.date || event.date,
          patch.start || event.start,
          event.timeZone,
        ).getTime(),
        event.sourceTimeZone,
      )
      const last = new TZDate(
        zonedDate(
          patch.endDate || patch.date || event.endDate || event.date,
          patch.end || event.end,
          event.timeZone,
        ).getTime(),
        event.sourceTimeZone,
      )
      patch = {
        ...patch,
        date: dateKey(first),
        endDate: dateKey(last),
        start: `${String(first.getHours()).padStart(2, '0')}:${String(first.getMinutes()).padStart(2, '0')}`,
        end: `${String(last.getHours()).padStart(2, '0')}:${String(last.getMinutes()).padStart(2, '0')}`,
      }
    }
    if (base.recurrence || base.recurringEventId)
      ui.openEvent(event.id, event.originalStartTime || event.date, patch)
    else saveEvent({ ...base, ...patch })
  }
  function finish(x: number, y: number) {
    const gesture = drag.current
    clearTimeout(delay.current)
    drag.current = null
    setSelection(null)
    setMoving(null)
    if (!gesture) return
    const distance = Math.hypot(x - gesture.x, y - gesture.y)
    if (gesture.event) {
      if (distance < 8) {
        ui.openEvent(
          gesture.event.id,
          gesture.event.originalStartTime || gesture.event.date,
        )
        return
      }
      if (!gesture.active) return
      const event = gesture.event
      const delta =
        Math.round(
          ((y - gesture.y) /
            (grid.current?.getBoundingClientRect().height || 1)) *
            96,
        ) * 15
      const start = gesture.resize
        ? minutes(event.start)
        : Math.max(0, Math.min(1425, minutes(event.start) + delta))
      const end = gesture.resize
        ? Math.max(start + 15, Math.min(1439, minutes(event.end) + delta))
        : Math.min(1439, start + minutes(event.end) - minutes(event.start))
      const targetDate = gesture.resize
        ? key
        : document
            .elementFromPoint(x, y)
            ?.closest<HTMLElement>('.week-day[data-date]')?.dataset.date || key
      saveMoved(event, {
        date: targetDate,
        endDate: shiftDay(
          event.endDate || event.date,
          dayDifference(targetDate, event.date),
        ),
        start: clock(start),
        end: clock(end),
      })
      return
    }
    if (!gesture.active) {
      if (distance < 8) ui.openEvent(`new:${key}:${clock(gesture.start)}`)
      return
    }
    const end = point(y),
      id = crypto.randomUUID(),
      preferred = defaultCalendar()
    saveEvent({
      id,
      title: 'New event',
      date: key,
      start: clock(Math.min(gesture.start, end)),
      end: clock(Math.min(1439, Math.max(gesture.start, end) + 15)),
      calendar: preferred?.name || 'Personal',
      calendarId: preferred?.id,
      color: preferred?.color || 'blue',
      location: '',
    })
    ui.openEvent(id)
  }
  return (
    <div className="week-day" data-date={key}>
      <header>
        <span className="small muted">
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </span>
        <span className="day-number" data-today={key === dateKey()}>
          {date.getDate()}
        </span>
        <Link className="small text-link" to={`/p/daily?date=${key}`}>
          Daily note
        </Link>
      </header>
      <div className="all-day-tasks">
        {events
          .filter((e) => e.allDay)
          .map((event) => (
            <button
              className="calendar-task"
              key={event.id}
              style={tint(event.color)}
              onClick={() =>
                ui.openEvent(event.id, event.originalStartTime || event.date)
              }
            >
              {event.title}
            </button>
          ))}
        {tasks
          .filter((t) => !t.dueTime)
          .map((task) => (
            <label className="calendar-task task-chip" key={task.id}>
              <input
                type="checkbox"
                aria-label={`Complete ${task.title}`}
                checked={task.status === 'Done'}
                onChange={() => completeTask(task)}
              />
              <span
                draggable
                onDragStart={(e) => e.dataTransfer.setData('kw-task', task.id)}
              >
                {task.title}
              </span>
            </label>
          ))}
      </div>
      <div
        className="time-slots"
        role="grid"
        tabIndex={-1}
        aria-label={`${date.toDateString()} time grid`}
        ref={grid}
        onPointerMove={(e) => {
          const g = drag.current
          if (!g) return
          if (!g.active) {
            if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) {
              clearTimeout(delay.current)
              drag.current = null
            }
            return
          }
          if (g.event)
            setMoving({
              id: g.event.id,
              x: g.resize ? 0 : e.clientX - g.x,
              y: e.clientY - g.y,
            })
          else
            setSelection({
              start: Math.min(g.start, point(e.clientY)),
              end: Math.max(g.start, point(e.clientY)) + 15,
            })
        }}
        onPointerUp={(e) => finish(e.clientX, e.clientY)}
        onPointerCancel={() => {
          clearTimeout(delay.current)
          drag.current = null
          setSelection(null)
          setMoving(null)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const id = e.dataTransfer.getData('kw-task')
          if (id) updateTask(id, { due: key, dueTime: clock(point(e.clientY)) })
        }}
      >
        {Array.from({ length: 96 }, (_, slot) => (
          <div role="row" className="time-slot-row" key={slot}>
            <button
              className="time-slot"
              role="gridcell"
              tabIndex={activeSlot === slot ? 0 : -1}
              aria-label={`Add event ${key} at ${clock(slot * 15)}`}
              onFocus={() => setActiveSlot(slot)}
              onPointerDown={(e) => startGesture(e)}
              onKeyDown={(e) => {
                let next = slot
                if (e.key === 'ArrowUp') next = Math.max(0, slot - 1)
                else if (e.key === 'ArrowDown') next = Math.min(95, slot + 1)
                else if (e.key === 'Home') next = 0
                else if (e.key === 'End') next = 95
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  const days = Array.from(
                    e.currentTarget
                      .closest('.week-grid')!
                      .querySelectorAll('.week-day'),
                  )
                  const index =
                    days.indexOf(e.currentTarget.closest('.week-day')!) +
                    (e.key === 'ArrowLeft' ? -1 : 1)
                  days[index]
                    ?.querySelectorAll<HTMLButtonElement>('.time-slot')
                    [slot]?.focus()
                  e.preventDefault()
                  return
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  ui.openEvent(`new:${key}:${clock(slot * 15)}`)
                  return
                } else return
                e.preventDefault()
                grid.current
                  ?.querySelectorAll<HTMLButtonElement>('.time-slot')
                  [next]?.focus()
              }}
            />
          </div>
        ))}
        {selection && (
          <div
            className="calendar-selection"
            style={{
              top: `${(selection.start / 1440) * 100}%`,
              height: `${((selection.end - selection.start) / 1440) * 100}%`,
            }}
          />
        )}
        {layoutEvents(events).map(({ event, start, end, column, columns }) => (
          <div
            className="positioned-event"
            role="row"
            key={`${event.id}:${event.originalStartTime || ''}`}
            data-moving={moving?.id === event.id || undefined}
            style={{
              top: `${(start / 1440) * 100}%`,
              height: `${(Math.max(20, end - start) / 1440) * 100}%`,
              left: `calc(${(column / columns) * 100}% + var(--space-2))`,
              width: `calc(${100 / columns}% - var(--space-4))`,
              right: 'auto',
              ...(moving?.id === event.id
                ? {
                    transform: `translate(${moving.x}px,${moving.y}px)`,
                    pointerEvents: 'none',
                    zIndex: 20,
                  }
                : {}),
            }}
            onPointerDown={(e) => startGesture(e, event)}
          >
            <button
              className="calendar-event"
              role="gridcell"
              style={tint(event.color)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' ||
                  e.key === ' ' ||
                  e.key.toLowerCase() === 'e'
                ) {
                  e.preventDefault()
                  ui.openEvent(event.id, event.originalStartTime || event.date)
                } else if (
                  e.altKey &&
                  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault()
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const offset = e.key === 'ArrowLeft' ? -1 : 1
                    saveMoved(event, {
                      date: shiftDay(event.date, offset),
                      endDate: shiftDay(event.endDate || event.date, offset),
                    })
                  } else {
                    const delta = e.key === 'ArrowUp' ? -15 : 15
                    saveMoved(event, {
                      start: clock(start + delta),
                      end: clock(end + delta),
                    })
                  }
                }
              }}
            >
              <strong>{event.title}</strong>
              <span>
                {displayTime(event.start)} – {displayTime(event.end)}
              </span>
              <span>
                {event.calendar}
                {event.sourceTimeZone && event.sourceTimeZone !== event.timeZone
                  ? ` · ${event.sourceTimeZone}`
                  : ''}
              </span>
            </button>
            <button
              className="event-resize"
              role="gridcell"
              aria-label={`Resize ${event.title}`}
              onPointerDown={(e) => startGesture(e, event, true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  saveMoved(event, {
                    end: clock(
                      Math.max(
                        start + 15,
                        end + (e.key === 'ArrowUp' ? -15 : 15),
                      ),
                    ),
                  })
                }
              }}
            />
          </div>
        ))}
        {tasks
          .filter((t) => t.dueTime)
          .map((task) => (
            <div
              className="positioned-task"
              role="row"
              key={task.id}
              style={{
                top: `${(minutes(task.dueTime!) / 1440) * 100}%`,
                height: `${(Math.max(30, task.estimate || 30) / 1440) * 100}%`,
              }}
            >
              <div role="gridcell" style={{ display: 'contents' }}>
                <input
                  type="checkbox"
                  aria-label={`Complete ${task.title}`}
                  checked={task.status === 'Done'}
                  onChange={() => completeTask(task)}
                />
                <button onClick={() => ui.openTask(task.id)}>
                  {task.dueTime} · {task.title}
                </button>
              </div>
            </div>
          ))}
        {key === dateKey(now) && (
          <div
            className="now-line"
            style={{
              top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%`,
            }}
          >
            <span />
          </div>
        )}
      </div>
    </div>
  )
}
export default function Calendar() {
  const { view = 'week', date = 'today' } = useParams(),
    navigate = useNavigate(),
    { events: stored, tasks: storedTasks } = useWorkspace(),
    ui = useWorkspaceUI()
  const parsed = date === 'today' ? new Date() : new Date(`${date}T12:00:00`),
    anchor = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const [showTasks, setShowTasks] = useState(true),
    [hidden, setHidden] = useState<string[]>([]),
    [secondZone, setSecondZone] = useState(''),
    scroll = useRef<HTMLDivElement>(null)
  const preferences = useWorkspace((s) => s.calendarPreferences)
  const first = weekStart(anchor, preferences?.weekStart),
    monthFirst = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12),
    monthDays = Array.from({ length: 42 }, (_, i) =>
      addDays(weekStart(monthFirst, preferences?.weekStart), i),
    )
  const calendarPrefs = useCalendars((s) => s.calendars)
  const accounts = useCalendars((s) => s.accounts)
  const [calendarQuery, setCalendarQuery] = useState('')
  const calendarError = useCalendars((s) => s.error)
  const events = expandEvents(
    stored.filter(
      (e) =>
        (e.calendarId || !hidden.includes(e.calendar)) &&
        (!e.calendarId ||
          calendarPrefs.find((c) => c.id === e.calendarId)?.visible !== false),
    ),
    view === 'month' ? monthDays[0]! : addDays(anchor, -7),
    view === 'month' ? monthDays[41]! : addDays(anchor, 20),
  )
  const tasks = storedTasks.filter((t) => !t.deletedAt),
    calendars = [
      ...new Set([
        'Singbuild',
        'Work',
        'Personal',
        ...stored.filter((e) => !e.deletedAt && !e.calendarId).map((e) => e.calendar),
      ]),
    ]
  const days = Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) =>
    view === 'day' ? anchor : addDays(first, i),
  )
  const go = (direction: number) =>
    navigate(
      `/calendar/${view}/${dateKey(view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1, 12) : addDays(anchor, direction * (view === 'day' ? 1 : 7)))}`,
    )
  const swipe = useRef<number | null>(null)
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7 * 64
  }, [view, date])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        e.ctrlKey ||
        e.metaKey ||
        document.querySelector('[role="dialog"]')
      )
        return
      const views: Record<string, string> = {
        d: 'day',
        w: 'week',
        m: 'month',
        a: 'agenda',
        '1': 'day',
        '2': 'week',
        '3': 'month',
        '4': 'agenda',
      }
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault()
        ui.openEvent('new')
        return
      }
      if (views[e.key]) navigate(`/calendar/${views[e.key]}/${date}`)
      if (e.key === 't') navigate(`/calendar/${view}/today`)
      if (e.key === 'j') go(1)
      if (e.key === 'k') go(-1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const eventButton = (event: CalendarEvent) => (
    <button
      className="calendar-event"
      key={`${event.id}:${event.date}`}
      style={tint(event.color)}
      onClick={() =>
        ui.openEvent(event.id, event.originalStartTime || event.date)
      }
    >
      <strong>{event.title}</strong>
      <span>
        {event.allDay
          ? 'All day'
          : `${displayTime(event.start)} – ${displayTime(event.end)}`}
      </span>
      <span>
        {event.calendar}
        {event.timeZone &&
        event.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone
          ? ` · ${event.timeZone}`
          : ''}
      </span>
    </button>
  )
  return (
    <div className="workspace-surface calendar-page">
      <header className="page-heading">
        <div>
          <h1 className="t-h1">Calendar</h1>
          <p className="muted">Your time, thoughtfully put together.</p>
        </div>
        <button className="btn-accent" onClick={() => ui.openEvent('new')}>
          <Plus size={16} />
          New event
        </button>
      </header>
      {calendarError && (
        <div className="form-error" role="alert">
          <p>{calendarError}</p>
          <button
            className="btn-secondary"
            onClick={() =>
              void import('@/calendar/google').then((module) =>
                module.syncGoogle(true),
              )
            }
          >
            Retry calendar sync
          </button>
        </div>
      )}
      <div className="calendar-toolbar">
        <div className="inline">
          <Link className="btn-secondary" to={`/calendar/${view}/today`}>
            Today
          </Link>
          <button
            className="ibtn"
            aria-label="Previous period"
            onClick={() => go(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="ibtn"
            aria-label="Next period"
            onClick={() => go(1)}
          >
            <ChevronRight size={18} />
          </button>
          <h2>
            {anchor.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>
        <div className="calendar-view-controls">
        <GlassPopover label="Select calendars" trigger={<button className="btn-secondary calendar-picker-trigger"><CalendarDays size={15} />Calendars<span className="pill">{calendars.filter((name) => !hidden.includes(name)).length + calendarPrefs.filter((c) => c.visible !== false).length}</span><ChevronDown size={13} /></button>}>
          <div className="calendar-picker">
            <div className="row-between"><strong className="small">Visible calendars</strong><button className="btn-text" onClick={() => {
              setHidden([])
              setShowTasks(true)
              useCalendars.setState({ calendars: calendarPrefs.map((c) => ({ ...c, visible: true })) })
            }}>Show all</button></div>
            <input className="calendar-picker-search" aria-label="Search calendars" placeholder="Find a calendar…" value={calendarQuery} onChange={(e) => setCalendarQuery(e.target.value)} />
            <div className="calendar-picker-list">
<p className="calendar-picker-label">Workspace</p>
          {calendars.filter((name) => name.toLowerCase().includes(calendarQuery.toLowerCase())).map((name) => (
            <label
              className="calendar-layer"
              key={name}
              style={tint((['orange', 'purple', 'blue'] as const)[calendars.indexOf(name) % 3]!)}
            >
              <input
                type="checkbox"
                checked={!hidden.includes(name)}
                onChange={() =>
                  setHidden(
                    hidden.includes(name)
                      ? hidden.filter((n) => n !== name)
                      : [...hidden, name],
                  )
                }
              />
              {name}
            </label>
          ))}
          <label className="calendar-layer">
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(e) => setShowTasks(e.target.checked)}
            />
            Tasks
          </label>

              {accounts.map((account) => <div key={account.id}>
                <p className="calendar-picker-label">{account.email}</p>
                {calendarPrefs.filter((c) => c.accountId === account.id && c.name.toLowerCase().includes(calendarQuery.toLowerCase())).map((calendar) => <label className="calendar-layer" key={calendar.id} style={tint(calendar.color)}><input type="checkbox" checked={calendar.visible !== false} onChange={() => useCalendars.setState({ calendars: calendarPrefs.map((c) => c.id === calendar.id ? { ...c, visible: c.visible === false } : c) })} /><span>{calendar.name}</span></label>)}
              </div>)}
              {calendarQuery && ![...calendars, ...calendarPrefs.map((c) => c.name)].some((name) => name.toLowerCase().includes(calendarQuery.toLowerCase())) && <p className="quiet-empty small">No calendars found.</p>}
            </div>
            <div className="calendar-picker-footer">
          <label className="small muted">
            Second time zone
            <GlassSelect
              aria-label="Second time zone"
              value={secondZone}
              onChange={(e) => setSecondZone(e.target.value)}
            >
              <option value="">Off</option>
              {[
                'Asia/Bangkok',
                'UTC',
                'America/New_York',
                'Europe/London',
                'Asia/Tokyo',
              ].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </GlassSelect>
          </label>
          <Link className="text-link small" to="/settings/accounts">
            Calendar accounts
          </Link>
            </div>
          </div>
        </GlassPopover>
        <nav className="view-tabs" aria-label="Calendar views">
          {['day', 'week', 'month', 'agenda'].map((v) => (
            <Link
              className="view-tab"
              aria-current={view === v ? 'page' : undefined}
              to={`/calendar/${v}/${date}`}
              key={v}
            >
              {v[0]?.toUpperCase()}
              {v.slice(1)}
            </Link>
          ))}
        </nav>
        </div>
      </div>
      <div className="calendar-layout calendar-layout-wide">

        <div
          className="calendar-content"
          onTouchStart={(e) => {
            swipe.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            if (swipe.current !== null) {
              const delta =
                (e.changedTouches[0]?.clientX ?? swipe.current) - swipe.current
              if (Math.abs(delta) > 100) go(delta < 0 ? 1 : -1)
              swipe.current = null
            }
          }}
        >
          {view === 'month' ? (
            <div className="month-grid">
              {(preferences?.weekStart === 0
                ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              ).map((d) => (
                <div className="month-label" key={d}>
                  {d}
                </div>
              ))}
              {monthDays.map((d) => {
                const key = dateKey(d),
                  dayEvents = events.filter((e) => e.date === key)
                return (
                  <div
                    className="month-cell"
                    key={key}
                    data-other={d.getMonth() !== anchor.getMonth()}
                  >
                    <button
                      className="day-number"
                      data-today={key === dateKey()}
                      onClick={() => navigate(`/calendar/day/${key}`)}
                    >
                      {d.getDate()}
                    </button>
                    {dayEvents.slice(0, 3).map(eventButton)}
                    {dayEvents.length > 3 && (
                      <details>
                        <summary className="small">
                          +{dayEvents.length - 3} more
                        </summary>
                        {dayEvents.slice(3).map(eventButton)}
                      </details>
                    )}
                    {showTasks &&
                      tasks
                        .filter((t) => t.due === key)
                        .map((t) => (
                          <button
                            className="calendar-task"
                            key={t.id}
                            onClick={() => ui.openTask(t.id)}
                          >
                            □ {t.title}
                          </button>
                        ))}
                  </div>
                )
              })}
            </div>
          ) : view === 'agenda' ? (
            <div className="agenda">
              {Array.from({ length: 14 }, (_, i) => addDays(anchor, i)).map(
                (d) => {
                  const key = dateKey(d),
                    dayEvents = events
                      .filter((e) => e.date === key)
                      .sort((a, b) => a.start.localeCompare(b.start)),
                    dayTasks = showTasks
                      ? tasks.filter((t) => t.due === key)
                      : []
                  return (
                    <section key={key}>
                      <h3>
                        {d.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {key === dateKey() && <Badge color="blue">Today</Badge>}
                      </h3>
                      {dayEvents.map(eventButton)}
                      {dayTasks.map((t) => (
                        <label className="agenda-task" key={t.id}>
                          <input
                            type="checkbox"
                            checked={t.status === 'Done'}
                            onChange={() => completeTask(t)}
                          />
                          {t.title}
                        </label>
                      ))}
                      {!dayEvents.length && !dayTasks.length && (
                        <p className="quiet-empty small">
                          No plans. A little space for yourself.
                        </p>
                      )}
                    </section>
                  )
                },
              )}
            </div>
          ) : (
            <div className="week-scroll" ref={scroll}>
              <div
                className="week-grid"
                role="group"
                aria-label="Calendar time grid"
                data-day={view === 'day'}
              >
                <div className="time-gutter">
                  <div className="timezone-label">
                    {secondZone
                      ? 'LOCAL / ' + secondZone.split('/').pop()
                      : 'LOCAL'}
                  </div>
                  {Array.from({ length: 24 }, (_, i) => (
                    <span key={i}>
                      {displayTime(`${String(i).padStart(2, '0')}:00`)}
                      {secondZone && (
                        <small>
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: secondZone,
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(
                            new Date(
                              anchor.getFullYear(),
                              anchor.getMonth(),
                              anchor.getDate(),
                              i,
                            ),
                          )}
                        </small>
                      )}
                    </span>
                  ))}
                </div>
                {days.map((d) => (
                  <TimelineDay
                    key={dateKey(d)}
                    date={d}
                    events={events.filter((e) => e.date === dateKey(d))}
                    tasks={
                      showTasks ? tasks.filter((t) => t.due === dateKey(d)) : []
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
