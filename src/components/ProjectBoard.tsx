import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, Plus } from 'lucide-react'
import { statuses, useWorkspace } from '@/data'
import type { Task, TaskStatus } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { Badge, formatDate, statusColor } from './WorkspaceUI'

function Card({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: task.id })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="board-card flat-card"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 5 : undefined,
        touchAction: 'manipulation',
      }}
      onClick={() => useWorkspaceUI.getState().openTask(task.id)}
    >
      <Badge
        color={
          task.priority === 'Urgent'
            ? 'red'
            : task.priority === 'High'
              ? 'orange'
              : 'gray'
        }
      >
        {task.priority}
      </Badge>
      <h3>{task.title}</h3>
      <p className="small muted">{task.notes || 'Add notes and details…'}</p>
      <div className="row-between small muted">
        <span className="inline">
          <CalendarDays size={13} />
          {formatDate(task.due)}
        </span>
        <span className="owner-avatar">K</span>
      </div>
    </button>
  )
}
function Column({
  status,
  tasks,
  add,
}: {
  status: TaskStatus
  tasks: Task[]
  add: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className="board-column" data-over={isOver}>
      <header>
        <Badge color={statusColor[status]}>
          <span className="dot" />
          {status}
        </Badge>
        <span className="muted small">{tasks.length}</span>
        <button
          className="ibtn"
          aria-label={`Add task to ${status}`}
          onClick={add}
        >
          <Plus size={15} />
        </button>
      </header>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="board-cards">
          {tasks
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((t) => (
              <Card task={t} key={t.id} />
            ))}
        </div>
      </SortableContext>
      <button className="add-row" onClick={add}>
        <Plus size={14} />
        New task
      </button>
    </section>
  )
}
export function ProjectBoard({
  tasks,
  projectId,
}: {
  tasks: Task[]
  projectId: string
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const { moveTask, addTask } = useWorkspace()
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        args = {...args, droppableContainers:args.droppableContainers.filter(container=>container.id !== args.active.id)}
        const pointer = pointerWithin(args)
        const cards = pointer.filter((hit) =>
          tasks.some((t) => t.id === hit.id),
        )
        return cards.length
          ? cards
          : pointer.length
            ? pointer
            : closestCenter(args)
      }}
      onDragEnd={({ active, over }) => {
        if (!over) return
        const task = tasks.find((t) => t.id === String(over.id))
        const status = statuses.find((s) => s === over.id) ?? task?.status
        if (status) {
          if (active.id === over.id) return
          moveTask(String(active.id), status, task?.id)
          useWorkspaceUI.getState().notify(`Moved to ${status}`)
        }
      }}
    >
      <div className="board-scroll">
        <div className="board">
          {statuses.map((status) => (
            <Column
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              key={status}
              add={() =>
                useWorkspaceUI
                  .getState()
                  .openTask(addTask({ title: 'New task', projectId, status }))
              }
            />
          ))}
        </div>
      </div>
    </DndContext>
  )
}
