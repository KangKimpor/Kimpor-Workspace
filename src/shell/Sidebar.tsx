import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Glass } from '@/components/glass'
import { SidebarContent } from './SidebarContent'
import { SIDEBAR_MAX, SIDEBAR_MIN, useShell } from './store'

/** Persistent floating glass sidebar (expanded and large). Resizable 220 to 380 px (§5). */
export function Sidebar() {
  const width = useShell((s) => s.sidebarWidth)
  const setWidth = useShell((s) => s.setSidebarWidth)
  const open = useShell((s) => s.sidebarOpen)
  const [dragging, setDragging] = useState(false)
  const slot = useRef<HTMLDivElement>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const left = slot.current?.getBoundingClientRect().left ?? 0
    setWidth(e.clientX - left + 4)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 32 : 16
    if (e.key === 'ArrowLeft') setWidth(width - step)
    else if (e.key === 'ArrowRight') setWidth(width + step)
    else if (e.key === 'Home') setWidth(SIDEBAR_MIN)
    else if (e.key === 'End') setWidth(SIDEBAR_MAX)
    else return
    e.preventDefault()
  }

  return (
    <div className="sidebar-slot" ref={slot} hidden={!open}>
      <Glass as="aside" material="regular" className="sidebar" aria-label="Sidebar" data-testid="sidebar">
        <SidebarContent />
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={width}
          tabIndex={0}
          data-dragging={dragging}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={onKeyDown}
        />
      </Glass>
    </div>
  )
}
