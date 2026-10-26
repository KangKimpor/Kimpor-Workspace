import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { priorities, statuses, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { canParentTask } from '@/data/task-tree'
import { GlassSelect } from './glass/GlassSelect'

export function TaskStatusSelect({ task }: { task: Task }) {
  return <GlassSelect aria-label={`Status for ${task.title}`} value={task.status} onChange={(e) => useWorkspace.getState().updateTask(task.id, { status: e.target.value as Task['status'] })}>{statuses.map((s) => <option key={s}>{s}</option>)}</GlassSelect>
}
export function TaskPrioritySelect({ task }: { task: Task }) {
  return <GlassSelect aria-label={`Priority for ${task.title}`} value={task.priority} onChange={(e) => useWorkspace.getState().updateTask(task.id, { priority: e.target.value as Task['priority'] })}>{priorities.map((s) => <option key={s}>{s}</option>)}</GlassSelect>
}
/** Extra fields expand in the document flow, without a task overlay. */
export function TaskFields({ task, compact = false, children }: { task: Task; compact?: boolean; children?: ReactNode }) {
  const { tasks, projects, updateTask } = useWorkspace()
  const [subtask, setSubtask] = useState('')
  const update = (patch: Partial<Task>) => updateTask(task.id, patch)
  return <details className="task-fields"><summary aria-label={`More fields for ${task.title}`}>{compact ? <Ellipsis size={18} aria-hidden="true" /> : 'More fields'}</summary>
    <div className="task-field-grid">
      {children}
      <label>Project<GlassSelect value={task.projectId} onChange={(e) => update({ projectId: e.target.value })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</GlassSelect></label>
      <label>Start date<input type="datetime-local" value={task.startAt || ''} onChange={(e) => update({ startAt: e.target.value })} /></label>
      <label>Due time<input type="time" value={task.dueTime || ''} onChange={(e) => update({ dueTime: e.target.value })} /></label>
      <label>Estimate (minutes)<input type="number" min={0} max={100000} value={task.estimate ?? ''} onChange={(e) => update({ estimate: Math.max(0, Math.min(100000, Number(e.target.value))) })} /></label>
      <label>Labels<input placeholder="Separate with commas" defaultValue={(task.labels || []).join(', ')} onBlur={(e) => update({ labels: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label>
      <label>Parent task<GlassSelect value={task.parentId || ''} onChange={(e) => update({ parentId: e.target.value || null })}><option value="">No parent</option>{tasks.filter((t) => !t.deletedAt && canParentTask(tasks, task.id, t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</GlassSelect></label>
      <label>Repeat<GlassSelect value={task.recurrence || ''} onChange={(e) => update({ recurrence: e.target.value, recurrenceStart: task.due })}><option value="">Does not repeat</option>{['DAILY', 'WEEKLY', 'MONTHLY'].map((v) => <option key={v} value={`FREQ=${v}`}>{v[0]}{v.slice(1).toLowerCase()}</option>)}{task.recurrence && !['FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY'].includes(task.recurrence) && <option value={task.recurrence}>{task.recurrence}</option>}</GlassSelect></label>
      <label>Reminder<input type="datetime-local" value={task.reminder || ''} onChange={(e) => update({ reminder: e.target.value })} /></label>
    </div>
    {task.pageId && <Link className="text-link" to={`/p/${task.pageId}`}>Notes & specifications editor</Link>}
    <fieldset><legend>Subtasks</legend>{task.subtasks.map((sub) => <label className="inline" key={sub.id}><input type="checkbox" checked={sub.done} onChange={(e) => update({ subtasks: task.subtasks.map((s) => s.id === sub.id ? { ...s, done: e.target.checked } : s) })} />{sub.title}</label>)}
      <form className="inline" onSubmit={(e) => { e.preventDefault(); if (subtask.trim()) { update({ subtasks: [...task.subtasks, { id: crypto.randomUUID(), title: subtask.trim(), done: false }] }); setSubtask('') } }}><input aria-label="New subtask" placeholder="Add a subtask…" value={subtask} onChange={(e) => setSubtask(e.target.value)} /><button className="btn-secondary">Add</button></form>
    </fieldset>
    <details><summary>Activity</summary>{(task.activity || []).slice().reverse().map((a, i) => <p className="small muted" key={i}>{a.text} · {new Date(a.at).toLocaleString()}</p>)}</details>
    <button className="btn-text danger-text" onClick={() => useWorkspace.getState().trashTask(task.id)}>Delete task</button>
  </details>
}
