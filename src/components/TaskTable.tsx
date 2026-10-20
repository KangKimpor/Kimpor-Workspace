import { GlassSelect } from '@/components/glass/GlassSelect'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { Columns3 } from 'lucide-react'
import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { priorities, statuses, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'

const columns = ['title', 'status', 'priority', 'due'] as const
type Column = (typeof columns)[number]
const names = {
  title: 'Task name',
  status: 'Status',
  priority: 'Priority',
  due: 'Due date',
}
export function TaskTable({ tasks }: { tasks: Task[] }) {
  const update = useWorkspace((s) => s.updateTask)
  const [sort, setSort] = useState<Column>('title'),
    [descending, setDescending] = useState(false)
  const [hidden, setHidden] = useState<Column[]>([]),
    [widths, setWidths] = useState<Record<Column, number>>({
      title: 300,
      status: 170,
      priority: 140,
      due: 170,
    })
  const resize = (column: Column, width: number) =>
    setWidths((current) => ({
      ...current,
      [column]: Math.max(100, Math.min(600, width)),
    }))
  const rows = tasks
    .slice()
    .sort(
      (a, b) =>
        String(a[sort]).localeCompare(String(b[sort])) * (descending ? -1 : 1),
    )
  const parent = useRef<HTMLDivElement>(null)
  const large = rows.length > 100
  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parent.current,
    getItemKey: (index) => rows[index]!.id,
    estimateSize: () => 48,
    overscan: 8,
    enabled: large,
    useFlushSync: false,
  })
  const items = large
    ? virtual.getVirtualItems()
    : rows.map((_, index) => ({
        index,
        key: rows[index]!.id,
        start: 0,
        end: 0,
      }))
  return (
    <>
      <div className="table-options">
      <GlassPopover label="Table columns" trigger={<button className="btn-secondary"><Columns3 size={14} />Table columns</button>}>
        <div className="column-choices">
          {columns.map((column) => (
            <label className="inline" key={column}>
              <input
                type="checkbox"
                checked={!hidden.includes(column)}
                onChange={(e) =>
                  setHidden(
                    e.target.checked
                      ? hidden.filter((c) => c !== column)
                      : [...hidden, column],
                  )
                }
              />
              {names[column]}
            </label>
          ))}
        </div>
      </GlassPopover>
      </div>
      <div
        className="table-scroll"
        ref={parent}
        style={large ? { maxHeight: 600 } : undefined}
      >
        <table
          className="task-table"
          style={{
            tableLayout: 'fixed',
            width: columns
              .filter((c) => !hidden.includes(c))
              .reduce((sum, c) => sum + widths[c], 44),
          }}
        >
          <thead>
            <tr>
              {columns
                .filter((c) => !hidden.includes(c))
                .map((column) => (
                  <th
                    key={column}
                    style={{ width: widths[column], position: 'relative' }}
                    aria-sort={
                      sort === column
                        ? descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button
                      onClick={() => {
                        if (sort === column) setDescending(!descending)
                        else {
                          setSort(column)
                          setDescending(false)
                        }
                      }}
                    >
                      {names[column]}{' '}
                      {sort === column ? (descending ? '↓' : '↑') : ''}
                    </button>
                    <span
                      className="table-resizer"
                      role="separator"
                      tabIndex={0}
                      aria-label={`Resize ${names[column]} column`}
                      aria-orientation="vertical"
                      aria-valuemin={100}
                      aria-valuemax={600}
                      aria-valuenow={widths[column]}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId)
                        e.currentTarget.dataset.start = String(e.clientX)
                        e.currentTarget.dataset.width = String(widths[column])
                      }}
                      onPointerMove={(e) => {
                        if (e.currentTarget.hasPointerCapture(e.pointerId))
                          resize(
                            column,
                            Number(e.currentTarget.dataset.width) +
                              e.clientX -
                              Number(e.currentTarget.dataset.start),
                          )
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                          e.preventDefault()
                          resize(
                            column,
                            widths[column] +
                              (e.key === 'ArrowRight' ? 16 : -16),
                          )
                        }
                      }}
                    />
                  </th>
                ))}
              <th aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {large && items[0] && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={columns.length + 1}
                  style={{ height: items[0].start, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {items.map((item) => {
              const task = rows[item.index]!
              return (
                <tr
                  key={task.id}
                  data-index={item.index}
                  ref={large ? virtual.measureElement : undefined}
                  aria-rowindex={item.index + 2}
                >
                  {columns
                    .filter((c) => !hidden.includes(c))
                    .map((column) => (
                      <td key={column}>
                        {column === 'title' ? (
                          <input
                            aria-label={`Title for ${task.title}`}
                            value={task.title}
                            onChange={(e) =>
                              update(task.id, { title: e.target.value })
                            }
                          />
                        ) : column === 'due' ? (
                          <input
                            type="date"
                            aria-label={`Due date for ${task.title}`}
                            value={task.due}
                            onChange={(e) =>
                              update(task.id, { due: e.target.value })
                            }
                          />
                        ) : (
                          <GlassSelect
                            aria-label={`${names[column]} for ${task.title}`}
                            value={task[column]}
                            onChange={(e) =>
                              update(task.id, { [column]: e.target.value })
                            }
                          >
                            {(column === 'status' ? statuses : priorities).map(
                              (value) => (
                                <option key={value}>{value}</option>
                              ),
                            )}
                          </GlassSelect>
                        )}
                      </td>
                    ))}
                  <td>
                    <button
                      className="ibtn"
                      aria-label={`Open ${task.title}`}
                      onClick={() =>
                        useWorkspaceUI.getState().openTask(task.id)
                      }
                    >
                      ↗
                    </button>
                  </td>
                </tr>
              )
            })}
            {large && items.length > 0 && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={columns.length + 1}
                  style={{
                    height: Math.max(
                      0,
                      virtual.getTotalSize() - items[items.length - 1]!.end,
                    ),
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
