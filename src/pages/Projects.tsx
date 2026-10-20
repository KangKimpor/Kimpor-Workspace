import './workspace-views.css'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { TaskTable } from '@/components/TaskTable'
import { ProjectBoard } from '@/components/ProjectBoard'
import { ProjectEditor } from '@/components/ProjectEditor'
import { CalendarDays, Kanban, Pencil, Plus, Search, Table2 } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { Badge, ProjectCards, Tile } from '@/components/WorkspaceUI'
import { useProjects, useWorkspace } from '@/data'
import type { TaskStatus } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

export default function Projects() {
  const { id, view = 'table' } = useParams()
  const projects = useProjects()
  const project = projects.find((p) => p.id === id)
  const { tasks, addTask, addProject, updateProject } = useWorkspace()
  const [editing, setEditing] = useState(false)
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
                  <Link to={`/projects/${p.id}/table`}>{p.name}</Link>
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
  if (!['table', 'board'].includes(view))
    return <Navigate to={`/projects/${id}/table`} replace />
  const add = (status: TaskStatus = 'Not started') =>
    openTask(addTask({ title: 'New task', projectId: id, status }))
  return (
    <div className="workspace-surface project-page">
      <header className="page-heading">
        <div className="project-heading">
          <Tile name={project.icon || project.id} color={project.color} />
          <div>
            <h1 className="t-h1">{project.name}</h1>
            <p className="muted">{project.description}</p>
          </div>
        </div>
        <div className="heading-actions">
          <button className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={14} />Edit project</button>
          <button className="btn-accent" onClick={() => add()}><Plus size={16} />New task</button>
        </div>
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
      {editing && <ProjectEditor key={project.id} project={project} onClose={() => setEditing(false)} />}
      <div className="view-toolbar">
        <nav className="view-tabs" aria-label="Project views">
          {[
            { name: 'Table', key: 'table', icon: Table2 },
            { name: 'Board', key: 'board', icon: Kanban },
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
          <GlassSelect
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {['All priorities', 'Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </GlassSelect>
        </div>
      </div>
      {view === 'board' ? (
        <ProjectBoard tasks={filtered} projectId={id} />
      ) : (
        <TaskTable tasks={filtered} />
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
