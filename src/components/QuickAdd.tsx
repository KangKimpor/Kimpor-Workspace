import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as chrono from 'chrono-node'
import { dateKey, useWorkspace } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import type { Priority } from '@/data'
import { defaultCalendar } from '@/calendar/store'

export function parseQuickAdd(raw: string, now = new Date()) {
  const priorityName = raw.match(/!(low|medium|high|urgent)\b/i)?.[1]
  const project = raw.match(/#([^!#]+?)(?=\s+!|$)/)?.[1]?.trim() ?? ''
  let text = raw
    .replace(/!(low|medium|high|urgent)\b/gi, '')
    .replace(/#[^!#]+?(?=\s+!|$)/g, '')
    .trim()
  const parsed = chrono.parse(text, now, { forwardDate: true })[0]
  const date = parsed?.start.date()
  if (parsed)
    text =
      `${text.slice(0, parsed.index)}${text.slice(parsed.index + parsed.text.length)}`.trim()
  const priority = priorityName
    ? priorityName[0]!.toUpperCase() + priorityName.slice(1).toLowerCase()
    : 'Medium'
  return {
    title: text.replace(/\s+/g, ' '),
    project,
    priority: priority as Priority,
    due: date ? dateKey(date) : '',
    time:
      date && parsed?.start.isCertain('hour')
        ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : '',
  }
}
export function QuickAdd({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState(''),
    [kind, setKind] = useState('task'),
    [error, setError] = useState('')
  const { projects, addProject, addTask, saveEvent } = useWorkspace()
  const ui = useWorkspaceUI()
  const navigate = useNavigate()
  return (
    <form
      className="quick-add-form"
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseQuickAdd(text)
        if (!parsed.title) {
          setError('Add a title for your plan.')
          return
        }
        if (kind === 'task') {
          const project = projects.find((p) =>
            p.name.toLowerCase().includes(parsed.project.toLowerCase()),
          )
          if (parsed.project && !project) {
            setError(`Project “${parsed.project}” was not found.`)
            return
          }
          const id = addTask({
            title: parsed.title,
            projectId: project?.id ?? projects[0]?.id ?? addProject('Personal'),
            due: parsed.due,
            dueTime: parsed.time,
            priority: parsed.priority,
          })
          onDone?.()
          const task = useWorkspace.getState().tasks.find((t) => t.id === id)!
          navigate(`/projects/${task.projectId}/table?task=${id}`)
        } else {
          const id = crypto.randomUUID()
          const start = parsed.time || '09:00'
          const endHour = Math.min(23, Number(start.slice(0, 2)) + 1)
          saveEvent({
            id,
            title: parsed.title,
            date: parsed.due || dateKey(),
            start,
            end: `${String(endHour).padStart(2, '0')}:${start.slice(3)}`,
            calendar: defaultCalendar()?.name || 'Personal',
            calendarId: defaultCalendar()?.id,
            color: defaultCalendar()?.color || 'blue',
            location: '',
          })
          onDone?.()
          ui.openEvent(id)
        }
        setText('')
      }}
    >
      <div className="view-tabs">
        <button
          type="button"
          className="view-tab"
          aria-pressed={kind === 'task'}
          onClick={() => setKind('task')}
        >
          Task
        </button>
        <button
          type="button"
          className="view-tab"
          aria-pressed={kind === 'event'}
          onClick={() => setKind('event')}
        >
          Event
        </button>
      </div>
      <label className="sr-only" htmlFor="quick-add-input">
        Quick add
      </label>
      <input
        id="quick-add-input"
        autoFocus
        placeholder="Review plan tomorrow 3pm #Website !high"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="small muted">
        Use a date, #project, and !priority. Everything is parsed on your
        device.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn-accent">Create {kind}</button>
    </form>
  )
}
