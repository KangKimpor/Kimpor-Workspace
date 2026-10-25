import { create } from 'zustand'
import type { CalendarEvent } from '@/data'

interface WorkspaceUI {
  commandOpen: boolean
  eventId: string | null
  eventOccurrence: string | null
  eventPatch: Partial<CalendarEvent> | null
  toast: { message: string; undo?: () => void } | null
  setCommandOpen: (open: boolean) => void
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
  eventId: null,
  eventOccurrence: null,
  eventPatch: null,
  toast: null,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openEvent: (eventId, occurrence, patch) =>
    set({
      eventId,
      eventOccurrence: occurrence || null,
      eventPatch: patch || null,
        }),
  notify: (message, undo) => {
    clearTimeout(toastTimer)
    set({ toast: { message, undo } })
    toastTimer = setTimeout(() => set({ toast: null }), 6000)
  },
}))
