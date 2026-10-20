import { CalendarDays, Flag, Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { useProjects, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { Badge, formatDate, statusColor } from './WorkspaceUI'

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
export function TaskRow({
  task,
  compact = false,
}: {
  task: Task
  compact?: boolean
}) {
  const project = useProjects().find((p) => p.id === task.projectId)
  const openTask = useWorkspaceUI((s) => s.openTask)
  const [editing, setEditing] = useState(false),
    [title, setTitle] = useState(task.title)
  const cancelled = useRef(false)
  const rename = () => {
    cancelled.current = false
    setTitle(task.title)
    setEditing(true)
  }
  return (
    <div
      className={`task-row ${compact ? 'task-row-card flat-card' : ''}`}
      data-done={task.status === 'Done'}
    >
      <label className="checkbox-target">
        <input
          aria-label={`Complete ${task.title}`}
          type="checkbox"
          checked={task.status === 'Done'}
          onChange={() => completeTask(task)}
        />
      </label>
      <div className="task-main">
        {editing ? (
          <input
            className="task-title-input"
            autoFocus
            aria-label="Edit task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (
                !cancelled.current &&
                title.trim() &&
                title.trim() !== task.title
              )
                useWorkspace
                  .getState()
                  .updateTask(task.id, { title: title.trim() })
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                cancelled.current = true
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            className="task-open"
            onClick={() => openTask(task.id)}
            onKeyDown={(e) => {
              if (e.key === 'F2') {
                e.preventDefault()
                rename()
              }
            }}
          >
            {compact && (
              <span className="task-tags">
                <Badge>{project?.name ?? 'Personal'}</Badge>
                <Badge color={statusColor[task.status]}>{task.status}</Badge>
              </span>
            )}
            <span className="task-title">{task.title}</span>
            {!compact && (
              <span className="task-project small muted">
                {project?.name ?? 'Personal'}
              </span>
            )}
          </button>
        )}
        {!compact && !editing && (
          <button
            className="ibtn task-rename"
            aria-label={`Rename ${task.title}`}
            onClick={rename}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
      {!compact && (
        <>
          <span className="task-priority small">
            <Flag size={13} />
            {task.priority}
          </span>
          <span className="task-date small muted">
            <CalendarDays size={13} />
            {formatDate(task.due)}
          </span>
          <Badge color={statusColor[task.status]}>{task.status}</Badge>
        </>
      )}
    </div>
  )
}
