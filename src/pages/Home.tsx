import { displayTime } from '@/calendar/time'
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Clock3,
  Lightbulb,
  MapPin,
  NotebookPen,
  Plus,
} from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import type { ScreenMeta } from '@/shell/routes'
import { dateKey, useWorkspace } from '@/data'
import {
  Badge,
  ProjectCards,
  SectionTitle,
  Tile,
  tint,
} from '@/components/WorkspaceUI'
import { TaskRow } from '@/components/TaskRow'
import { useWorkspaceUI } from '@/shell/workspace'
const homeDateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function Home() {
  const { tasks, events, pages, scratchpad, setScratchpad, addPage, addTask } =
    useWorkspace()
  const { openTask, openEvent } = useWorkspaceUI()
  const navigate = useNavigate()
  const today = dateKey()
  const upcoming = events
    .filter((e) => !e.deletedAt && !e.isSeriesMaster && e.date === today)
    .sort((a, b) => (a.start === b.start ? 0 : a.start < b.start ? -1 : 1))
  const priority = tasks.slice(0, 4)
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="page home-page" data-wide="true">
      <header className="page-heading">
        <div>
          <h1 className="t-title">{greeting}, Kimpor</h1>
          <p className="muted">
            {homeDateFormat.format(new Date())} · {upcoming.length} events,{' '}
            {
              tasks.filter(
                (t) =>
                  t.status !== 'Done' &&
                  (t.priority === 'High' || t.priority === 'Urgent'),
              ).length
            }{' '}
            priority tasks
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate(`/p/${addPage()}`)}
          >
            <NotebookPen size={14} /> + Note
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              openTask(addTask({ title: 'New task', projectId: 'website' }))
            }
          >
            <CheckSquare size={14} /> + Task
          </button>
          <button className="btn-accent" onClick={() => openEvent('new')}>
            <Plus size={15} /> Event
          </button>
        </div>
      </header>
      <div className="home-columns">
        <section>
          <SectionTitle
            action={
              <Link
                className="icon-link"
                aria-label="Open calendar"
                to="/calendar/week/today"
              >
                <CalendarDays size={17} />
              </Link>
            }
          >
            Up Next Today <span className="pill">{upcoming.length} local</span>
          </SectionTitle>
          <div className="event-stack">
            {upcoming.map((event) => (
              // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- The visible event fields supply the accessible name.
              <button
                key={event.id}
                className="event-card flat-card"
                style={tint(event.color)}
                onClick={() => openEvent(event.id)}
              >
                <div className="row-between">
                  <strong className="event-title">{event.title}</strong>
                  <Badge color={event.color}>{event.calendar}</Badge>
                </div>
                <div className="row-between muted small">
                  <span className="inline">
                    <Clock3 size={13} />
                    {displayTime(event.start)} to {displayTime(event.end)}
                  </span>
                  <span className="inline">
                    <MapPin size={13} />
                    {event.location || 'No location'}
                  </span>
                </div>
              </button>
            ))}
            {!upcoming.length && (
              <div className="flat-card quiet-empty">
                A little breathing room. Your day is clear.
              </div>
            )}
          </div>
          <Link className="text-link" to="/calendar/day/today">
            Full day view <ArrowRight size={14} />
          </Link>
        </section>
        <section>
          <SectionTitle
            action={
              <Link
                className="icon-link"
                aria-label="View all tasks"
                to="/tasks"
              >
                <CheckSquare size={17} />
              </Link>
            }
          >
            Priority Tasks{' '}
            <span className="pill success-pill">
              {priority.filter((t) => t.status === 'Done').length} of{' '}
              {priority.length} completed
            </span>
          </SectionTitle>
          <div className="task-stack">
            {priority.map((task) => (
              <TaskRow key={task.id} task={task} compact />
            ))}
          </div>
          <div className="scratchpad flat-card">
            <div className="row-between">
              <strong className="inline">
                <Lightbulb size={14} />
                Quick Scratchpad
              </strong>
              <span className="small muted">Saved locally</span>
            </div>
            <textarea
              aria-label="Quick Scratchpad"
              rows={3}
              value={scratchpad}
              onChange={(e) => setScratchpad(e.target.value)}
            />
          </div>
        </section>
      </div>
      <section className="home-section">
        <SectionTitle
          action={
            <Link className="text-link" to="/projects">
              View all 3 projects <ArrowRight size={14} />
            </Link>
          }
        >
          Active Projects
        </SectionTitle>
        <ProjectCards />
      </section>
      <section className="home-section">
        <SectionTitle
          action={<span className="small muted">Recently opened by you</span>}
        >
          Recent Pages & Notes
        </SectionTitle>
        <div className="recent-grid">
          {pages
            .filter((p) => !p.deletedAt)
            .slice(0, 4)
            .map((page, i) => (
              <Link
                key={page.id}
                className="recent-card flat-card"
                to={`/p/${page.id}`}
              >
                <Tile
                  name={page.icon}
                  color={(['yellow', 'pink', 'blue', 'purple'] as const)[i]}
                />
                <div>
                  <h3>{page.title}</h3>
                  <p className="small muted">Saved in your workspace</p>
                </div>
              </Link>
            ))}
        </div>
      </section>
    </div>
  )
}

/** Route target for screens delivered in later phases. Shows what is coming and when. */
export function Placeholder() {
  const meta = useOutletContext<ScreenMeta>()
  return (
    <div className="page">
      <h1 className="t-title large-title">{meta.title}</h1>
      <EmptyState
        icon={<NotebookPen size={28} strokeWidth={1.75} />}
        title={meta.phase ? `Coming in Phase ${meta.phase}` : meta.title}
      >
        {meta.blurb}
      </EmptyState>
    </div>
  )
}
