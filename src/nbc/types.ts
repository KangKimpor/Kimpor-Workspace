export const handlers = ['Sitha', 'Lychhinh', 'Chhorvaon', 'Srun', 'Kheng', 'Tola'] as const
export type Handler = typeof handlers[number]
export interface HandlerConfirmation { at: string; editor: string; assignedCount: number; changedCount: number }
// Separate fields let the existing sync merge confirmations from different handlers.
type HandlerConfirmations = Partial<Record<`handlerUpdate${Handler}`, HandlerConfirmation>>
export interface ProgressChange {
  id: string
  at: string
  editor: string
  previous: number
  progress: number
  remark: string
  handler: string
  recordedAt?: string
}
export interface NbcActivity {
  id: string
  projectId: string
  wbs: string
  parentId: string | null
  order: number
  name: string
  description: string
  area: string
  location: string
  trade: string
  editable: boolean
  relativeWeight: number
  globalWeight: number
  progress: number
  baseline: number
  sourcePrevious: number
  sourceWeekly: number
  duration: number | null
  boqValue: number | null
  schedule: number | null
  handler: string
  remark: string
  updatedAt?: string
  history: ProgressChange[]
  sourceRow?: number
  sourceFormulas?: Record<string, string>
}
export interface ReportEntry {
  id: string
  wbs: string
  name: string
  area: string
  location: string
  trade: string
  handler: string
  previous: number
  progress: number
  difference: number
  weight: number
  remark: string
  updatedAt: string | null
}
export interface NbcReport extends HandlerConfirmations {
  startedBy?: Handler
  note?: string
  id: string
  projectId: string
  date: string
  status: 'draft' | 'final'
  previousReportId: string | null
  correctionOf: string | null
  reason: string
  entries: ReportEntry[]
  overall: number
  previous: number
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  editor: string
}
