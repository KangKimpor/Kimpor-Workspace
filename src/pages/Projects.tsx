import './workspace-views.css'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { TaskTable } from '@/components/TaskTable'
import { ProjectBoard } from '@/components/ProjectBoard'
import { ProjectEditor } from '@/components/ProjectEditor'
import { ArrowLeft, ChevronDown, Kanban, Pencil, Plus, Search, SlidersHorizontal, Star, Table2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ProjectCards, Tile } from '@/components/WorkspaceUI'
import { useProjects, useWorkspace } from '@/data'
import type { TaskStatus } from '@/data'
import { rememberWorkspace } from '@/shell/landing'
import { useMediaQuery } from '@/motion/hooks'

export default function Projects() {
  const mobile = useMediaQuery('(max-width: 639px)')
  const { id, view = 'table' } = useParams()
  const projects = useProjects()
  const project = projects.find((p) => p.id === id)
  const { tasks, addTask, updateProject } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const [params] = useSearchParams()
  const workspace = params.get('workspace') === 'team' ? 'team' : 'personal'
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('All priorities')
  const scope = useWorkspace((s) => s.scope)
  const projectId = project?.id, projectWorkspace = project?.workspace
  useEffect(() => {
    if (!id || projectId) rememberWorkspace(scope, { workspace: projectWorkspace ?? workspace, projectId })
  }, [id, projectId, projectWorkspace, scope, workspace])
  if (!id)
    return (
      <div className="page workspace-page" data-wide="true">
        <header className="page-heading">
          <div>
            <h1 className="t-title">{workspace === 'team' ? 'Team Workspace' : 'Personal Workspace'}</h1>
          </div>
          <button className="btn-accent" onClick={() => setEditing(true)}><Plus size={16} />New project</button>
        </header>
        {editing && <ProjectEditor workspace={workspace} onClose={() => setEditing(false)} />}
        <ProjectCards workspace={workspace} />
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
    addTask({ title: 'New task', projectId: id, status })
  const toolbar = <>
    {!mobile && <nav className="view-tabs" aria-label="Project views">
      <NavLink to={`/projects/${id}/table`} className="view-tab"><Star size={16} />All Tasks</NavLink>
      <NavLink to={`/projects/${id}/board`} className="view-tab"><Kanban size={16} />By Status</NavLink>
    </nav>}
    {mobile && <GlassPopover label="Project views" align="start" trigger={<button className="project-view-picker"><Star size={18} />{view === 'board' ? 'Board' : 'All Tasks'}<ChevronDown size={16} /></button>}>
      <nav className="project-view-menu" aria-label="Project views">
        <NavLink to={`/projects/${id}/table`} className="view-tab"><Table2 size={16} />All Tasks</NavLink>
        <NavLink to={`/projects/${id}/board`} className="view-tab"><Kanban size={16} />Board</NavLink>
      </nav>
    </GlassPopover>}
    <div className="project-toolbar-spacer" />
    <GlassPopover label="Search tasks" trigger={<button className="ibtn" aria-label="Search project tasks" title="Search tasks" data-active={!!query}><Search size={19} /></button>}>
      <label className="search-field"><Search size={16} /><input aria-label="Search project tasks" placeholder="Search tasks…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    </GlassPopover>
    <GlassPopover label="Task filters" trigger={<button className="ibtn" aria-label="Filter tasks" title="Filter tasks" data-active={priority !== 'All priorities'}><SlidersHorizontal size={19} /></button>}>
      <GlassSelect aria-label="Filter priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        {['All priorities', 'Low', 'Medium', 'High', 'Urgent'].map((p) => <option key={p}>{p}</option>)}
      </GlassSelect>
    </GlassPopover>
  </>
  const actions = <button className="btn-accent project-add-task" aria-label="New task" title="New task" onClick={() => add()}><Plus size={mobile ? 21 : 15} />{!mobile && 'New'}</button>
  return (
    <div className="workspace-surface project-page" data-view={view}>
      {mobile && view === 'table' && <div className="project-topbar">
        <Link className="ibtn" to="/projects" aria-label="All projects"><ArrowLeft size={22} /></Link>
        <button className="ibtn" aria-label="Edit project" title="Edit project" onClick={() => setEditing(true)}><Pencil size={18} /></button>
      </div>}
      <header className="page-heading">
        <div className="project-heading">
          <Tile name={project.icon || project.id} color={project.color} />
          <div>
            <h1 className="t-h1">{project.name}</h1>
          </div>
        </div>
        {(!mobile || view !== 'table') && <div className="heading-actions">
          <button className="btn-secondary" onClick={() => setEditing(true)}><Pencil size={14} />Edit project</button>
        </div>}
      </header>
      {editing && <ProjectEditor key={project.id} project={project} onClose={() => setEditing(false)} />}
      {view === 'board' ? (
        <>
          <div className="project-table-toolbar">{toolbar}{actions}</div>
          <ProjectBoard tasks={filtered} projectId={id} />
        </>
      ) : (
        <TaskTable tasks={filtered} mobile={mobile} toolbar={toolbar} actions={actions} />
      )}
      {filtered.length === 0 && (
        <p className="quiet-empty">No tasks match these filters.</p>
      )}
    </div>
  )
}
