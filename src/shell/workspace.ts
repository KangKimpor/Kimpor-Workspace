import { create } from 'zustand'
import type { CalendarEvent } from '@/data'

interface WorkspaceUI {
  commandOpen: boolean
  taskId: string | null
  eventId: string | null
  eventOccurrence: string | null
  eventPatch: Partial<CalendarEvent> | null
  toast: { message: string; undo?: () => void } | null
  setCommandOpen: (open: boolean) => void
  openTask: (id: string | null) => void
  openEvent: (
    id: string | null,
    occurrence?: string,
    patch?: Partial<CalendarEvent>,
  ) => void
  notify: (message: string, undo?: () => void) => void
}
let toastTimer: ReturnType<typeof setTimeout>
export const useWorkspaceUI = create<WorkspaceUI>((set) => ({
  commandOpen: false,
  taskId: null,
  eventId: null,
  eventOccurrence: null,
  eventPatch: null,
  toast: null,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openTask: (taskId) =>
    set({ taskId, eventId: null, eventOccurrence: null, eventPatch: null }),
  openEvent: (eventId, occurrence, patch) =>
    set({
      eventId,
      eventOccurrence: occurrence || null,
      eventPatch: patch || null,
      taskId: null,
    }),
  notify: (message, undo) => {
    clearTimeout(toastTimer)
    set({ toast: { message, undo } })
    toastTimer = setTimeout(() => set({ toast: null }), 6000)
  },
}))
