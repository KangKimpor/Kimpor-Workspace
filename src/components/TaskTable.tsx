import { GlassSelect } from '@/components/glass/GlassSelect'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { Columns3 } from 'lucide-react'
import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { priorities, statuses, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { statusColor, tint } from '@/components/WorkspaceUI'

const columns = ['title', 'status', 'priority', 'due'] as const
type Column = (typeof columns)[number]
const names = {
  title: 'Task name',
  status: 'Status',
  priority: 'Priority',
  due: 'Due date',
}
export function TaskTable({ tasks, mobile, toolbar, actions }: {
  tasks: Task[]
  mobile: boolean
  toolbar: ReactNode
  actions: ReactNode
}) {
  const update = useWorkspace((s) => s.updateTask)
  const [sort, setSort] = useState<Column>('title'),
    [descending, setDescending] = useState(false)
  const [hidden, setHidden] = useState<Column[]>([]),
    [widths, setWidths] = useState<Record<Column, number>>({
      title: mobile ? Math.min(360, innerWidth - 32) : 300,
      status: 170,
      priority: 140,
      due: 170,
    })
  const visibleColumns = columns.filter((column) => (mobile && column === 'title') || !hidden.includes(column))
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
      <div className={mobile ? 'project-table-toolbar' : 'table-options'}>
      {mobile && toolbar}
      <GlassPopover label="Table columns" trigger={<button className={mobile ? 'ibtn' : 'btn-secondary'} aria-label="Table columns" title="Table columns"><Columns3 size={mobile ? 18 : 14} />{!mobile && 'Table columns'}</button>}>
        <div className="column-choices">
          {columns.map((column) => (
            <label className="inline" key={column}>
              <input
                type="checkbox"
                disabled={mobile && column === 'title'}
                checked={visibleColumns.includes(column)}
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
      {mobile && actions}
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
            width: visibleColumns
              .reduce((sum, c) => sum + widths[c], mobile ? 0 : 44),
          }}
        >
          <thead>
            <tr>
              {visibleColumns
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
                      {mobile && column === 'title' && <span className="table-text-icon" aria-hidden="true">Aa </span>}{names[column]}{' '}
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
              {!mobile && <th aria-label="Details" />}
            </tr>
          </thead>
          <tbody>
            {large && items[0] && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={visibleColumns.length + (mobile ? 0 : 1)}
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
                  {visibleColumns
                    .map((column) => (
                      <td key={column} data-column={column}>
                        {column === 'title' ? (
                          <div className="table-task-name">
                          <input
                            aria-label={`Title for ${task.title}`}
                            value={task.title}
                            onChange={(e) =>
                              update(task.id, { title: e.target.value })
                            }
                          />
                          {mobile && <button className="table-open" aria-label={`Open ${task.title}`} onClick={() => useWorkspaceUI.getState().openTask(task.id)}>Open</button>}
                          </div>
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
                          <div className={mobile && column === 'status' ? 'table-status' : undefined} style={mobile && column === 'status' ? tint(statusColor[task.status]) : undefined}>
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
                          </div>
                        )}
                      </td>
                    ))}
                  {!mobile && <td><button className="ibtn" aria-label={`Open ${task.title}`} onClick={() => useWorkspaceUI.getState().openTask(task.id)}>↗</button></td>}
                </tr>
              )
            })}
            {large && items.length > 0 && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={visibleColumns.length + (mobile ? 0 : 1)}
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
