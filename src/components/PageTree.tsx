import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { usePages, useWorkspace } from '@/data'
import type { PageNode } from '@/data'
import { useWorkspaceUI } from '@/shell/workspace'
import { Tile } from './WorkspaceUI'

function PageRow({ node, depth }: { node: PageNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(false)
  const drag = useDraggable({ id: node.id }),
    drop = useDroppable({ id: node.id })
  return (
    <li>
      <div
        className="page-tree-row"
        data-over={drop.isOver}
        ref={(element) => {
          drag.setNodeRef(element)
          drop.setNodeRef(element)
        }}
        style={{
          paddingLeft: `calc(var(--space-4) + ${depth * 16}px)`,
          transform: CSS.Translate.toString(drag.transform),
          opacity: drag.isDragging ? 0.6 : 1,
        }}
      >
        <button
          className="page-tree-handle ibtn"
          aria-label={`Move page ${node.title}`}
          {...drag.attributes}
          {...drag.listeners}
        >
          <GripVertical size={13} />
        </button>
        {node.children.length > 0 && (
          <button
            className="page-tree-toggle ibtn"
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${node.title}`}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronRight
              size={12}
              style={{ transform: collapsed ? 'none' : 'rotate(90deg)' }}
            />
          </button>
        )}
        <NavLink className="nav-item" to={`/p/${node.id}`}>
          <span className="nav-icon" aria-hidden="true">
            <Tile name={node.icon} />
          </span>
          <span className="nav-label" title={node.title}>
            {node.title || 'Untitled'}
          </span>
        </NavLink>
      </div>
      {!collapsed && node.children.length > 0 && (
        <ul className="nav-list">
          {node.children.map((child) => (
            <PageRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
function RootDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: 'workspace-root' })
  return (
    <div ref={setNodeRef} className="page-root-drop" data-over={isOver}>
      Move to workspace
    </div>
  )
}
export function PageTree() {
  const pages = usePages(),
    [dragging, setDragging] = useState(false)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const candidates = {
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.id !== args.active.id,
          ),
        }
        const pointer = pointerWithin(candidates)
        return pointer.length ? pointer : closestCenter(candidates)
      }}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={({ active, over, delta }) => {
        setDragging(false)
        if (!over || active.id === over.id) return
        const state = useWorkspace.getState(),
          id = String(active.id),
          moving = state.pages.find((page) => page.id === id),
          target = state.pages.find((page) => page.id === over.id)
        if (!moving) return
        const siblings = state.pages
            .filter((p) => p.parentId === moving.parentId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
          next = siblings[siblings.findIndex((p) => p.id === id) + 1]?.id
        const nest = delta.x > 24 && target
        const parent =
          over.id === 'workspace-root'
            ? null
            : nest
              ? target.id
              : (target?.parentId ?? null)
        if (state.reorderPage(id, parent, nest ? undefined : target?.id))
          useWorkspaceUI
            .getState()
            .notify(nest ? `Moved inside ${target.title}` : 'Page moved', () =>
              state.reorderPage(id, moving.parentId, next),
            )
        else
          useWorkspaceUI
            .getState()
            .notify('A page cannot be nested inside itself.')
      }}
    >
      <ul className="nav-list">
        {pages.map((page) => (
          <PageRow key={page.id} node={page} depth={0} />
        ))}
      </ul>
      {dragging && (
        <>
          <p className="small muted">Move right to nest inside a page.</p>
          <RootDrop />
        </>
      )}
    </DndContext>
  )
}
