import { useLayoutEffect, useRef, useState } from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Task } from '@/data'
import { TaskRow } from './TaskRow'
export function TaskList({
  tasks,
  compact = false,
}: {
  tasks: Task[]
  compact?: boolean
}) {
  const parent = useRef<HTMLDivElement>(null),
    large = tasks.length > 100
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // oxlint-disable-next-line react/incompatible-library -- React Compiler is not enabled; this virtualizer is not memoized.
  const virtual = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parent.current,
    getItemKey: (index) => tasks[index]!.id,
    estimateSize: () => (compact ? 120 : 56),
    overscan: 8,
    // Keep an edited row mounted while newly measured rows adjust the scroll range.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      return activeIndex === null || activeIndex >= range.count || indexes.includes(activeIndex) ? indexes : [...indexes, activeIndex].sort((a, b) => a - b)
    },
    enabled: large,
    useFlushSync: false,
  })
  const items = virtual.getVirtualItems()
  useLayoutEffect(() => {
    if (focusIndex === null) return
    const button = parent.current?.querySelector<HTMLInputElement>(
      `[data-index="${focusIndex}"] .task-title-input`,
    )
    if (button) {
      button.focus({ preventScroll: true })
      setFocusIndex(null)
    }
  }, [focusIndex, items])
  if (!large)
    return (
      <div role="list" aria-label="Tasks">
        {tasks.map((task) => (
          <div role="listitem" key={task.id}>
            <TaskRow task={task} compact={compact} />
          </div>
        ))}
      </div>
    )
  /* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- The scrollable list supports keyboard navigation across virtual rows. */
  return (
    <div
      ref={parent}
      className="virtual-task-list"
      role="list"
      aria-label={`${tasks.length} tasks. Use arrow keys, Home and End to navigate.`}
      tabIndex={0}
      style={{ height: 560, overflow: 'auto' }}
      onFocusCapture={(e) => {
        const index = (e.target as HTMLElement).closest<HTMLElement>('[data-index]')?.dataset.index
        setActiveIndex(index === undefined ? null : Number(index))
      }}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveIndex(null) }}
      onKeyDown={(e) => {
        const current = Number(
          (e.target as HTMLElement).closest<HTMLElement>('[data-index]')
            ?.dataset.index || 0,
        )
        const next =
          e.key === 'End'
            ? tasks.length - 1
            : e.key === 'Home'
              ? 0
              : e.key === 'ArrowDown'
                ? Math.min(tasks.length - 1, current + 1)
                : e.key === 'ArrowUp'
                  ? Math.max(0, current - 1)
                  : -1
        if (
          next < 0 ||
          (e.target as HTMLElement).closest('input,textarea,select')
        )
          return
        e.preventDefault()
        virtual.scrollToIndex(next, { align: 'auto' })
        setFocusIndex(next)
      }}
    >
      <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
        {items.map((item) => (
          <div
            role="listitem"
            key={item.key}
            aria-setsize={tasks.length}
            aria-posinset={item.index + 1}
            data-index={item.index}
            ref={virtual.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            <TaskRow task={tasks[item.index]!} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  )
}
