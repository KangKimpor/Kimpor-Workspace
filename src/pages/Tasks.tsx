import { CheckCircle2, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { TaskList } from '@/components/TaskList'
import { dateKey, useProjects, useWorkspace } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

export default function Tasks() {
  const { tasks, addTask, taskViews, setTaskViews } = useWorkspace()
  const projects = useProjects()
  const openTask = useWorkspaceUI((s) => s.openTask)
  const [project, setProject] = useState('all')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('all')
  const [label, setLabel] = useState('all'),
    [viewName, setViewName] = useState(''),
    [selectedView, setSelectedView] = useState('')
  const labels = [...new Set(tasks.flatMap((task) => task.labels || []))].sort()
  const today = dateKey()
  const filtered = tasks.filter(
    (t) =>
      !t.deletedAt &&
      (project === 'all' || t.projectId === project) &&
      (priority === 'all' || t.priority === priority) &&
      (label === 'all' || t.labels?.includes(label)) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  )
  const groups = [
    {
      name: 'Overdue',
      tasks: filtered.filter(
        (t) => t.status !== 'Done' && t.due && t.due < today,
      ),
      tone: 'danger',
    },
    {
      name: `Today, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
      tasks: filtered.filter((t) => t.status !== 'Done' && t.due === today),
    },
    {
      name: 'Upcoming',
      tasks: filtered.filter((t) => t.status !== 'Done' && t.due > today),
    },
    {
      name: 'No date',
      tasks: filtered.filter((t) => t.status !== 'Done' && !t.due),
    },
    { name: 'Completed', tasks: filtered.filter((t) => t.status === 'Done') },
  ]
  return (
    <div className="workspace-surface tasks-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</span>
          <h1 className="t-h1">My tasks</h1>
          <p className="muted">Everything on your plate, in one quiet place.</p>
        </div>
        <button
          className="btn-accent"
          onClick={() =>
            openTask(
              addTask({
                title: 'New task',
                projectId: project === 'all' ? 'website' : project,
              }),
            )
          }
        >
          <Plus size={16} />
          New task
        </button>
      </header>
      <div className="view-toolbar">
        <label className="inline small">
          Saved view
          <select
            aria-label="Saved task view"
            value={selectedView}
            onChange={(e) => {
              const view = taskViews.find((view) => view.id === e.target.value)
              setSelectedView(e.target.value)
              setProject(view?.project || 'all')
              setPriority(view?.priority || 'all')
              setLabel(view?.label || 'all')
              setQuery(view?.query || '')
            }}
          >
            <option value="">All tasks</option>
            {taskViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="filter-controls"
          onSubmit={(e) => {
            e.preventDefault()
            if (!viewName.trim()) return
            const id =
              taskViews.find(
                (view) =>
                  view.name.toLowerCase() === viewName.trim().toLowerCase(),
              )?.id || crypto.randomUUID()
            setTaskViews([
              ...taskViews.filter((view) => view.id !== id),
              { id, name: viewName.trim(), project, priority, label, query },
            ])
            setSelectedView(id)
            setViewName('')
          }}
        >
          <input
            aria-label="Name for saved view"
            placeholder="Name this view"
            maxLength={100}
            required
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
          <button className="btn-secondary">Save view</button>
          {selectedView && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setTaskViews(
                  taskViews.filter((view) => view.id !== selectedView),
                )
                setSelectedView('')
              }}
            >
              Remove view
            </button>
          )}
        </form>
      </div>
      <div className="view-toolbar">
        <div className="filter-controls">
          <select
            aria-label="Filter by project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select
            aria-label="Filter by label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          >
            <option value="all">All labels</option>
            {labels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            placeholder="Search your tasks…"
            aria-label="Search your tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="task-summary muted small">
        <CheckCircle2 size={15} />
        {tasks.filter((t) => !t.deletedAt && t.status === 'Done').length}{' '}
        completed ·{' '}
        {tasks.filter((t) => !t.deletedAt && t.status !== 'Done').length} to go
      </div>
      {groups.map((group) => (
        <details
          open
          className="task-group"
          key={group.name}
          data-tone={group.tone}
        >
          <summary className="section-title">
            {group.name}
            <span className="pill">{group.tasks.length}</span>
          </summary>
          <div className="task-group-body">
            <TaskList tasks={group.tasks} />
            {!group.tasks.length && (
              <p className="quiet-empty small">
                Nothing here. You’re all caught up.
              </p>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}
