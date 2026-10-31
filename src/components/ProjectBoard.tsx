import { completeTask } from './TaskRow'
import { TaskFields, TaskPrioritySelect, TaskStatusSelect } from './TaskFields'
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
import { CircleCheck, GripVertical, Plus } from 'lucide-react'
import { statuses, useWorkspace } from '@/data'
import type { Task, TaskStatus } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { Badge, statusColor, tint } from './WorkspaceUI'
import { useShallow } from 'zustand/react/shallow'

function Card({ task }: { task: Task }) {
  const update = useWorkspace((s) => s.updateTask)
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} className="board-card flat-card" style={{ ...tint(statusColor[task.status]), transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 5 : undefined }}>
      <div className="board-card-heading">
        <label className="board-complete"><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.status === 'Done'} onChange={() => completeTask(task)} /><CircleCheck size={20} aria-hidden="true" /></label>
        <textarea className="board-task-title" rows={1} aria-label={`Title for ${task.title}`} value={task.title} onChange={(e) => update(task.id, { title: e.target.value })} />
      </div>
      <div className="board-card-meta"><TaskPrioritySelect task={task} /><button {...attributes} {...listeners} className="ibtn board-drag" aria-label={`Move ${task.title}`} style={{ touchAction: 'none' }}><GripVertical size={16} /></button></div>
      <TaskFields task={task} compact>
        <div className="board-status-field"><span>Status</span><TaskStatusSelect task={task} /></div>
        <label>Due date<input aria-label={`Due date for ${task.title}`} type="date" value={task.due} onChange={(e) => update(task.id, { due: e.target.value })} /></label>
        <label>Description<textarea rows={3} aria-label={`Description for ${task.title}`} value={task.notes} onChange={(e) => update(task.id, { notes: e.target.value })} /></label>
      </TaskFields>
    </div>
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
    <section ref={setNodeRef} className="board-column" data-status={status} data-over={isOver} style={tint(statusColor[status])}>
      <header>
        <Badge color={statusColor[status]}>
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
  const { moveTask, addTask } = useWorkspace(
    useShallow((s) => ({ moveTask: s.moveTask, addTask: s.addTask })),
  )
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
          {(['Not started', 'In progress', 'Done', 'In review', 'Blocked'] as const).map((status) => (
            <Column
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
              key={status}
              add={() => { addTask({ title: 'New task', projectId, status }) }}
            />
          ))}
        </div>
      </div>
    </DndContext>
  )
}
