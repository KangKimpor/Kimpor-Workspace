import { useProjects, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { TaskFields, TaskStatusSelect, TaskPrioritySelect } from './TaskFields'

export function completeTask(task: Task) {
  const status = task.status === 'Done' ? 'Not started' : 'Done'
  useWorkspace.getState().updateTask(task.id, { status })
  useWorkspaceUI
    .getState()
    .notify(
      status === 'Done'
        ? 'Task completed. A little progress, every day.'
        : 'Task reopened',
      () =>
        useWorkspace.getState().updateTask(task.id, { status: task.status }),
    )
}
export function TaskRow({ task, compact = false }: { task: Task; compact?: boolean }) {
  const update = useWorkspace((s) => s.updateTask)
  const project = useProjects().find((p) => p.id === task.projectId)
  return <div className={`task-row ${compact ? 'task-row-card flat-card' : ''}`} data-priority={task.priority} data-done={task.status === 'Done'}>
    <label className="checkbox-target"><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.status === 'Done'} onChange={() => completeTask(task)} /></label>
    <div className="task-main">
      <input className="task-title-input" aria-label={`Title for ${task.title}`} value={task.title} onChange={(e) => update(task.id, { title: e.target.value })} />
      <span className="small muted">{project?.name}</span>
      <div className="task-inline-controls"><TaskStatusSelect task={task} /><TaskPrioritySelect task={task} /><input aria-label={`Due date for ${task.title}`} type="date" value={task.due} onChange={(e) => update(task.id, { due: e.target.value })} /></div>
      <textarea className="task-description" rows={2} aria-label={`Description for ${task.title}`} placeholder="Description" value={task.notes} onChange={(e) => update(task.id, { notes: e.target.value })} />
      <TaskFields task={task} />
    </div>
  </div>
}
