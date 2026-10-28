import { GlassSelect } from '@/components/glass/GlassSelect'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { AlignLeft, CalendarDays, CircleDot, Columns3, Flag } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { RowActions } from './RowActions'
import type { RowActionTarget } from './RowActions'
import { Link, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { priorities, statuses, useWorkspace } from '@/data'
import type { Task } from '@/data'
import { statusColor, tint } from '@/components/WorkspaceUI'

export const columns = ['title', 'status', 'priority', 'due', 'notes'] as const
type Column = (typeof columns)[number]
const names = {
  title: 'Task name',
  status: 'Status',
  priority: 'Priority',
  due: 'Due date',
  notes: 'Description',
}
export function TaskTable({ tasks, mobile, toolbar, actions, nbcActivities }: {
  nbcActivities?: { id: string; wbs: string; name: string }[]
  tasks: Task[]
  mobile: boolean
  toolbar: ReactNode
  actions: ReactNode
}) {
  const [params] = useSearchParams()
  const [wbsQuery, setWbsQuery] = useState('')
  const [menu, setMenu] = useState<RowActionTarget | null>(null)
  const targetTask = params.get('task')
  const focusedTask = useRef<string | null>(null)
  const availableColumns = columns
  const update = useWorkspace((s) => s.updateTask)
  const [sort, setSort] = useState<Column>('title'),
    [descending, setDescending] = useState(false)
  const [hidden, setHidden] = useState<Column[]>([]),
    [widths, setWidths] = useState<Record<Column, number>>({
      title: mobile ? Math.min(360, innerWidth - 32) : nbcActivities ? 240 : 400,
      status: mobile ? 180 : nbcActivities ? 120 : 170,
      priority: mobile ? 150 : nbcActivities ? 105 : 140,
      due: mobile ? 170 : nbcActivities ? 135 : 145,
      notes: nbcActivities && !mobile ? 170 : 220,
    })
  const visibleColumns = availableColumns.filter((column) => (mobile && column === 'title') || !hidden.includes(column))
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
  useEffect(() => {
    if (!targetTask || focusedTask.current === targetTask) return
    const index = rows.findIndex((t) => t.id === targetTask)
    if (large && index >= 0) virtual.scrollToIndex(index, { align: 'center' })
    const frame = requestAnimationFrame(() => {
      const input = parent.current?.querySelector<HTMLInputElement>(`[data-task-id="${CSS.escape(targetTask)}"] input`)
      input?.scrollIntoView({ block: 'center', inline: 'nearest' })
      input?.focus({ preventScroll: true })
      if (input) focusedTask.current = targetTask
    })
    return () => cancelAnimationFrame(frame)
  }, [targetTask, large, virtual, rows])
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
      <div className="project-table-toolbar">
      {toolbar}
      <GlassPopover label="Table columns" trigger={<button className="ibtn" aria-label="Table columns" title="Table columns"><Columns3 size={18} /></button>}>
        <div className="column-choices">
          {availableColumns.map((column) => (
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
      {actions}
      <RowActions item={menu} onClose={() => setMenu(null)} onDelete={menu ? () => useWorkspace.getState().trashTask(menu.id) : undefined}/>
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
              .reduce((sum, c) => sum + widths[c], 0),
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
                      {column === 'title' ? null : column === 'status' ? <CircleDot size={14} aria-hidden="true" /> : column === 'due' ? <CalendarDays size={14} aria-hidden="true" /> : column === 'priority' ? <Flag size={14} aria-hidden="true" /> : <AlignLeft size={14} aria-hidden="true" />}{names[column]}{' '}
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
            </tr>
          </thead>
          <tbody>
            {large && items[0] && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={visibleColumns.length}
                  style={{ height: items[0].start, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {items.map((item) => {
              const task = rows[item.index]!
              return (
                <tr
                  key={task.id}
                  data-task-id={task.id}
                  data-index={item.index}
                  ref={large ? virtual.measureElement : undefined}
                  aria-rowindex={item.index + 2}
                  onContextMenu={(e) => {
                    if ((e.target as HTMLElement).closest('textarea')) return
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, id: task.id, title: task.title, projectId: task.projectId, nbcActivityId: task.nbcActivityId })
                  }}
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
                          
                          {nbcActivities && <div className="nbc-task-link">{task.nbcActivityId && <Link className="pill" to={`/projects-progress/${task.projectId}/progress?wbs=${encodeURIComponent(nbcActivities.find((a) => a.id === task.nbcActivityId)?.wbs ?? '')}`}>{nbcActivities.find((a) => a.id === task.nbcActivityId)?.wbs ?? 'WBS'}</Link>}<GlassPopover label="Link WBS activity" trigger={<button className="text-link small" aria-label={`Link WBS for ${task.title}`} onClick={() => setWbsQuery('')}>WBS</button>}><div className="nbc-wbs-picker"><input aria-label="Search WBS activity" placeholder="WBS code or activity name" value={wbsQuery} onChange={(e) => setWbsQuery(e.target.value)} /><div className="nbc-wbs-options"><button onClick={() => update(task.id, { nbcActivityId: null })}>No WBS link</button>{nbcActivities.filter((a) => `${a.wbs} ${a.name}`.toLowerCase().includes(wbsQuery.toLowerCase())).slice(0, 50).map((a) => <button key={a.id} onClick={() => update(task.id, { nbcActivityId: a.id })}>{a.wbs} · {a.name}</button>)}</div><p className="small muted">Search all activities by code or name.</p></div></GlassPopover></div>}
                          </div>
                        ) : column === 'notes' ? (
                          <textarea className="task-description" rows={1} aria-label={`Description for ${task.title}`} value={task.notes} onChange={(e) => update(task.id, { notes: e.target.value })} />
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
                          <div className={column === 'status' ? 'table-status' : undefined} style={column === 'status' ? tint(statusColor[task.status]) : undefined}>
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
                </tr>
              )
            })}
            {large && items.length > 0 && (
              <tr aria-hidden="true">
                <td
                  aria-hidden="true"
                  colSpan={visibleColumns.length}
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
