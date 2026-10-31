import './workspace-views.css'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Folder, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { TaskList } from '@/components/TaskList'
import { dateKey, useProjects, useWorkspace } from '@/data'
import { useShallow } from 'zustand/react/shallow'

export default function Tasks() {
  const { tasks, addTask, taskViews, setTaskViews } = useWorkspace(
    useShallow((s) => ({
      tasks: s.tasks,
      addTask: s.addTask,
      taskViews: s.taskViews,
      setTaskViews: s.setTaskViews,
    })),
  )
  const projects = useProjects()
  const [project, setProject] = useState('all')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('all')
  const [label, setLabel] = useState('all'),
    [viewName, setViewName] = useState(''),
    [selectedView, setSelectedView] = useState('')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState('priority')
  const today = dateKey()
  const labels = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.labels || []))].sort(),
    [tasks],
  )
  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects])
  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.deletedAt),
    [tasks],
  )
  const queryLower = query.toLowerCase()
  const { groups } = useMemo(() => {
    const overdue: typeof tasks = []
    const todayGroup: typeof tasks = []
    const upcoming: typeof tasks = []
    const noDate: typeof tasks = []
    const done: typeof tasks = []
    for (const t of tasks) {
      if (t.deletedAt) continue
      if (scope !== 'all') {
        const inProject = projectIds.has(t.projectId)
        if (scope === 'personal' && inProject) continue
        if (scope === 'projects' && !inProject) continue
      }
      if (project !== 'all' && t.projectId !== project) continue
      if (priority !== 'all' && t.priority !== priority) continue
      if (label !== 'all' && !t.labels?.includes(label)) continue
      if (queryLower && !t.title.toLowerCase().includes(queryLower)) continue
      if (t.status === 'Done') { done.push(t); continue }
      if (!t.due) { noDate.push(t); continue }
      if (t.due < today) { overdue.push(t); continue }
      if (t.due === today) { todayGroup.push(t); continue }
      upcoming.push(t)
    }
    return {
      groups: [
        { name: 'Overdue', tasks: overdue, tone: 'danger' },
        {
          name: `Today, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
          tasks: todayGroup,
        },
        { name: 'Upcoming', tasks: upcoming },
        { name: 'No date', tasks: noDate },
        { name: 'Completed', tasks: done },
      ],
    }
  }, [tasks, scope, project, priority, label, queryLower, today, projectIds])
  return (
    <div className="workspace-surface tasks-page">
      <header className="page-heading">
        <div>
          <h1 className="t-h1">My tasks</h1>
          <p className="muted">Your personal agenda across {projects.length} projects. One place to focus.</p>
        </div>
        <button
          className="btn-accent"
          onClick={() =>
            addTask({
                title: 'New task',
                projectId: scope === 'personal' ? '' : project === 'all' ? projects[0]?.id || '' : project,
              })
          }
        >
          <Plus size={16} />
          New task
        </button>
      </header>
      <div className="tasks-topline">
        <div className="view-tabs task-scope" role="group" aria-label="Task scope">
          {[['all', 'All'], ['projects', 'Project tasks'], ['personal', 'Personal']].map(([key, name]) => (
            <button key={key} className="view-tab" aria-pressed={scope === key} onClick={() => setScope(key!)}>{name}<span className="muted">{activeTasks.filter((t) => key === 'all' || (key === 'personal' ? !projects.some((p) => p.id === t.projectId) : projects.some((p) => p.id === t.projectId))).length}</span></button>
          ))}
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
      <div className="tasks-filterline">
        <div className="filter-controls">
          <GlassSelect
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
          </GlassSelect>
          <GlassSelect
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </GlassSelect>
          <GlassSelect
            aria-label="Filter by label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          >
            <option value="all">All labels</option>
            {labels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </GlassSelect>
        </div>
        <div className="task-sort"><span className="small muted">Sort</span><GlassSelect aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value)}><option value="priority">Priority</option><option value="date">Due date</option><option value="title">Task name</option></GlassSelect></div>
        <GlassPopover label="Saved task views" trigger={<button className="btn-secondary"><SlidersHorizontal size={14} />Saved views</button>}>
      <div className="task-view-settings">
        <label className="inline small">
          Saved view
          <GlassSelect
            aria-label="Saved task view"
            value={selectedView}
            onChange={(e) => {
              const view = taskViews.find((view) => view.id === e.target.value)
              setSelectedView(e.target.value)
              setScope('all')
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
          </GlassSelect>
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
        </GlassPopover>
      </div>
      {groups.map((group) => (
        <details
          open={group.name !== 'Completed'}
          className={`task-group agenda-group ${group.name === 'Completed' ? 'agenda-completed' : ''}`}
          key={group.name}
          data-tone={group.tone}
        >
          <summary className="section-title">
            {group.tone === 'danger' ? <AlertTriangle size={16} /> : group.name.startsWith('Today') ? <CalendarDays size={16} /> : group.name === 'Completed' ? <CheckCircle2 size={16} /> : group.name === 'No date' ? <Folder size={16} /> : <Clock3 size={16} />}
            {group.name}
            <span className="pill">{group.tasks.length}</span>
          </summary>
          <div className="task-group-body">
            <TaskList tasks={[...group.tasks].sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'date' ? a.due.localeCompare(b.due) : ['Urgent', 'High', 'Medium', 'Low'].indexOf(a.priority) - ['Urgent', 'High', 'Medium', 'Low'].indexOf(b.priority))} />
            {!group.tasks.length && (
              <p className="quiet-empty small">
                Nothing here. You’re all caught up.
              </p>
            )}
          </div>
        </details>
      ))}
      <div className="task-summary muted small">
        <CheckCircle2 size={15} />
        {activeTasks.filter((t) => t.status === 'Done').length}{' '}
        completed ·{' '}
        {activeTasks.filter((t) => t.status !== 'Done').length} to go
      </div>
    </div>
  )
}
