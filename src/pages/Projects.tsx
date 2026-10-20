import { TaskTable } from '@/components/TaskTable'
import { ProjectCalendar } from '@/components/ProjectCalendar'
import { ProjectBoard } from '@/components/ProjectBoard'
import {
  CalendarDays,
  CheckCircle2,
  Kanban,
  List,
  Plus,
  Search,
  Table2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import {
  Badge,
  ProjectCards,
  SectionTitle,
  statusColor,
  Tile,
  tint,
} from '@/components/WorkspaceUI'
import { TaskRow } from '@/components/TaskRow'
import { TaskList } from '@/components/TaskList'
import { dateKey, statuses, useProjects, useWorkspace } from '@/data'
import type { TaskStatus } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

export default function Projects() {
  const { id, view = 'overview' } = useParams()
  const projects = useProjects()
  const project = projects.find((p) => p.id === id)
  const { tasks, addTask, addProject, updateProject } = useWorkspace()
  const [newName, setNewName] = useState('')
  const { openTask } = useWorkspaceUI()
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('All priorities')
  if (!id)
    return (
      <div className="page workspace-page" data-wide="true">
        <header className="page-heading">
          <div>
            <h1 className="t-title">Projects</h1>
            <p className="muted">
              A home for every idea you’re bringing to life.
            </p>
          </div>
        </header>
        <form
          className="filter-controls"
          onSubmit={(e) => {
            e.preventDefault()
            if (newName.trim()) {
              addProject(newName)
              setNewName('')
            }
          }}
        >
          <input
            aria-label="New project name"
            placeholder="Name your project"
            required
            maxLength={200}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-accent">
            <Plus size={16} />
            New project
          </button>
        </form>
        <ProjectCards />
        {projects.some((p) => p.status === 'Archived') && (
          <details className="flat-card settings-section">
            <summary>Archived projects</summary>
            {projects
              .filter((p) => p.status === 'Archived')
              .map((p) => (
                <div className="settings-row" key={p.id}>
                  <Link to={`/projects/${p.id}/overview`}>{p.name}</Link>
                  <button
                    className="btn-secondary"
                    onClick={() => updateProject(p.id, { status: 'Active' })}
                  >
                    Restore project
                  </button>
                </div>
              ))}
          </details>
        )}
      </div>
    )
  if (!project)
    return (
      <div className="page">
        <h1 className="t-title">Project not found</h1>
        <Link to="/projects">All projects</Link>
      </div>
    )
  const allTasks = tasks.filter((t) => !t.deletedAt && t.projectId === id)
  const filtered = allTasks.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (priority === 'All priorities' || t.priority === priority),
  )
  const complete = allTasks.filter((t) => t.status === 'Done').length
  const progress = allTasks.length
    ? Math.round((complete / allTasks.length) * 100)
    : 0
  const add = (status: TaskStatus = 'Not started') =>
    openTask(addTask({ title: 'New task', projectId: id, status }))
  return (
    <div className="workspace-surface project-page">
      <header className="page-heading">
        <div className="project-heading">
          <Tile name={project.icon || project.id} color={project.color} />
          <div>
            <div className="eyebrow">PROJECT · PERSONAL WORKSPACE</div>
            <h1 className="t-h1">{project.name}</h1>
            <p className="muted">{project.description}</p>
          </div>
        </div>
        <button className="btn-accent" onClick={() => add()}>
          <Plus size={16} />
          New task
        </button>
      </header>
      <div className="project-properties">
        <Badge color="green">{project.status || 'Active'}</Badge>
        <span className="inline small muted">
          <CalendarDays size={14} /> Target{' '}
          {project.target
            ? new Date(`${project.target}T12:00:00`).toLocaleDateString()
            : 'No target date'}
        </span>
        <span className="small muted">{allTasks.length} tasks</span>
      </div>
      <details className="flat-card settings-section">
        <summary>Edit project</summary>
        <div className="account-form">
          <label>
            Name
            <input
              value={project.name}
              maxLength={200}
              onChange={(e) => updateProject(id, { name: e.target.value })}
            />
          </label>
          <label>
            Icon
            <input
              aria-label="Project icon"
              maxLength={12}
              placeholder="📁"
              value={project.icon || ''}
              onChange={(e) => updateProject(id, { icon: e.target.value })}
            />
          </label>
          <label>
            Start date
            <input
              type="date"
              value={project.startDate || ''}
              onChange={(e) => updateProject(id, { startDate: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              value={project.description}
              onChange={(e) =>
                updateProject(id, { description: e.target.value })
              }
            />
          </label>
          <label>
            Target date
            <input
              type="date"
              value={project.target}
              onChange={(e) => updateProject(id, { target: e.target.value })}
            />
          </label>
          <label>
            Status
            <select
              value={project.status || 'Active'}
              onChange={(e) =>
                updateProject(id, {
                  status: e.target.value as typeof project.status,
                })
              }
            >
              {['Planned', 'Active', 'On hold', 'Completed', 'Archived'].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Color
            <select
              value={project.color}
              onChange={(e) =>
                updateProject(id, {
                  color: e.target.value as typeof project.color,
                })
              }
            >
              {['blue', 'purple', 'green', 'orange', 'red', 'pink', 'gray'].map(
                (color) => (
                  <option key={color}>{color}</option>
                ),
              )}
            </select>
          </label>
        </div>
      </details>
      <div className="view-toolbar">
        <nav className="view-tabs" aria-label="Project views">
          {[
            { name: 'Overview', key: 'overview', icon: CheckCircle2 },
            { name: 'Board', key: 'board', icon: Kanban },
            { name: 'List', key: 'list', icon: List },
            { name: 'Table', key: 'table', icon: Table2 },
            { name: 'Calendar', key: 'calendar', icon: CalendarDays },
          ].map((v) => (
            <NavLink
              key={v.key}
              to={`/projects/${id}/${v.key}`}
              className="view-tab"
            >
              <v.icon size={15} />
              {v.name}
            </NavLink>
          ))}
        </nav>
        <div className="filter-controls">
          <label className="search-field">
            <Search size={14} />
            <input
              aria-label="Search project tasks"
              placeholder="Search tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {['All priorities', 'Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      {view === 'overview' ? (
        <>
          <div className="metrics-grid">
            <div className="flat-card metric-progress">
              <div
                className="progress-ring"
                style={{ '--progress': `${progress}%` } as React.CSSProperties}
              >
                <strong>{progress}%</strong>
              </div>
              <div>
                <h2>Overall progress</h2>
                <p className="muted small">
                  {complete} of {allTasks.length} tasks completed
                </p>
                <Badge color="green">Keep it moving</Badge>
              </div>
            </div>
            <div className="flat-card metric-status">
              <h2>Tasks by status</h2>
              <div className="status-bar">
                {statuses.map((s) => (
                  <span
                    key={s}
                    title={s}
                    style={{
                      ...tint(statusColor[s]),
                      flex: allTasks.filter((t) => t.status === s).length,
                    }}
                  />
                ))}
              </div>
              <div className="status-legend">
                {statuses.map((s) => (
                  <span key={s}>
                    <Badge color={statusColor[s]}>{s}</Badge>
                    <strong>
                      {allTasks.filter((t) => t.status === s).length}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="flat-card">
              <span className="eyebrow">NEXT MILESTONE</span>
              <h2>Quiet Glass, ready to ship</h2>
              <p className="muted">
                Clear priorities. Thoughtful details. One focused step at a
                time.
              </p>
              <span className="inline small">
                <CalendarDays size={14} />
                {project.target
                  ? new Date(`${project.target}T12:00:00`).toLocaleDateString()
                  : 'No target date'}
              </span>
            </div>
          </div>
          <SectionTitle>Project documents</SectionTitle>
          <div className="document-grid">
            {allTasks
              .filter((t) => t.pageId)
              .map((t) => (
                <Link
                  className="flat-card document-card"
                  key={t.id}
                  to={`/p/${t.pageId}`}
                >
                  <Tile name="note" />
                  <h3>{t.title}</h3>
                  <span className="small muted">Task notes and details</span>
                </Link>
              ))}
            {!allTasks.some((t) => t.pageId) && (
              <p className="quiet-empty small">
                Task notes will appear here as you add tasks.
              </p>
            )}
          </div>
          <div className="overview-lists">
            <section>
              <SectionTitle>Overdue & urgent</SectionTitle>
              {filtered
                .filter(
                  (t) => t.status !== 'Done' && t.due && t.due < dateKey(),
                )
                .map((t) => (
                  <TaskRow key={t.id} task={t} compact />
                ))}
            </section>
            <section>
              <SectionTitle>Coming up next</SectionTitle>
              {filtered
                .filter((t) => t.status !== 'Done' && t.due >= dateKey())
                .map((t) => (
                  <TaskRow key={t.id} task={t} compact />
                ))}
            </section>
          </div>
          <details className="completed-section">
            <summary>Completed recently · {complete}</summary>
            {allTasks
              .filter((t) => t.status === 'Done')
              .map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
          </details>
        </>
      ) : view === 'board' ? (
        <ProjectBoard tasks={filtered} projectId={id} />
      ) : view === 'table' ? (
        <TaskTable tasks={filtered} />
      ) : view === 'calendar' ? (
        <ProjectCalendar tasks={filtered} />
      ) : (
        <div>
          {statuses.map((status) => (
            <details key={status} className="task-group" open>
              <summary>
                <SectionTitle>
                  {status}{' '}
                  <span className="muted small">
                    {filtered.filter((t) => t.status === status).length}
                  </span>
                </SectionTitle>
              </summary>
              <TaskList tasks={filtered.filter((t) => t.status === status)} />
            </details>
          ))}
        </div>
      )}
      {filtered.length === 0 && (
        <p className="quiet-empty">No tasks match these filters.</p>
      )}
      <footer className="workspace-footer">
        Your personal workspace · Changes saved on this device
      </footer>
    </div>
  )
}
