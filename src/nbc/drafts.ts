import type { Handler } from './types'
export interface HandlerDraft { values: Record<string, { text: string; remark: string; baseRevision?: string }>; note: string }
const draftKey = (scope: string, project: string, week: string, handler: Handler) => `kw-nbc-handler-draft:${scope}:${project}:${week}:${handler}`
export function readHandlerDraft(scope: string, project: string, week: string, handler: Handler): HandlerDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(scope, project, week, handler)) || 'null')
    return value && value.values && typeof value.note === 'string' && Object.values(value.values).every((v) => v && typeof (v as { text?: unknown }).text === 'string' && typeof (v as { remark?: unknown }).remark === 'string') ? value : null
  } catch { return null }
}
export function writeHandlerDraft(scope: string, project: string, week: string, handler: Handler, value: HandlerDraft) { localStorage.setItem(draftKey(scope, project, week, handler), JSON.stringify(value)) }
export function clearHandlerDraft(scope: string, project: string, week: string, handler: Handler) { localStorage.removeItem(draftKey(scope, project, week, handler)) }
