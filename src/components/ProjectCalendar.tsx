import { useState } from 'react'
import { dateKey } from '@/data'
import type { Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

export function ProjectCalendar({ tasks }: { tasks: Task[] }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12),
  )
  const first = new Date(month)
  first.setDate(1 - ((first.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => {
    const day = new Date(first)
    day.setDate(day.getDate() + i)
    return day
  })
  return (
    <>
      <div className="calendar-toolbar">
        <button
          className="btn-secondary"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))
          }
        >
          ←
        </button>
        <h2>
          {month.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <button
          className="btn-secondary"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))
          }
        >
          →
        </button>
      </div>
      <div className="table-scroll">
        <div className="month-grid" style={{ minWidth: 640 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div className="month-label" key={day}>
              {day}
            </div>
          ))}
          {days.map((day) => (
            <div
              className="month-cell"
              key={dateKey(day)}
              data-other={day.getMonth() !== month.getMonth()}
            >
              <span
                className="day-number"
                data-today={dateKey(day) === dateKey()}
              >
                {day.getDate()}
              </span>
              {tasks
                .filter((task) => task.due === dateKey(day))
                .map((task) => (
                  <button
                    key={task.id}
                    className="calendar-task"
                    onClick={() => useWorkspaceUI.getState().openTask(task.id)}
                  >
                    {task.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
