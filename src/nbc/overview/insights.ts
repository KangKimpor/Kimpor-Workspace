import { addDays, weekDeadline, weekStart } from '../submissions'
import { percent } from '../format'
import { handlers } from '../types'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from '../types'
import { deadlineNote } from '../update/deadline'

const WEEK_MS = 7 * 86400000, STALLED_DAYS = 14

/** Average weekly progress over the last four confirmed weeks, or null before any week is confirmed. */
export function weeklyPace(summaries: NbcWeekSummary[]) {
  const window = [...summaries].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-4)
  return window.length ? (window.at(-1)!.overall - window[0]!.previous) / window.length : null
}

/** The date progress reaches 100% if the recent pace holds, or null when there is no forward pace. */
export function forecastDate(overall: number, pace: number | null, today: string) {
  if (overall >= 1 || !pace || pace <= 0) return null
  return addDays(today, Math.ceil(((1 - overall) / pace) * 7))
}

export interface AttentionItem { id: string; tone: 'red' | 'amber'; title: string; detail: string; impact?: string; to: string }
interface AttentionInput { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; today: string; now: number }

/** What needs a manager's eye this week, most urgent first. Private coordination tasks are deliberately not included. */
export function attentionItems({ projectId, activities, submissions, today, now }: AttentionInput): AttentionItem[] {
  const current = weekStart(today), base = `/projects-progress/${projectId}`, items: AttentionItem[] = []
  const missing = handlers.filter((h) => activities.some((a) => a.editable && a.handler === h) && !submissions.some((s) => s.handler === h && s.weekStart === current && s.status === 'confirmed'))
  if (missing.length) {
    const overdue = now >= weekDeadline(current)
    items.push({ id: 'missing', tone: overdue ? 'red' : 'amber', title: `${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} not updated`, detail: overdue ? 'Deadline passed Saturday 12:00 PM' : deadlineNote(current, now).text, impact: overdue ? 'overdue' : `${missing.length} to go`, to: `${base}/update` })
  }
  const byId = new Map(activities.map((a) => [a.id, a]))
  const lowered = submissions.filter((s) => s.status === 'confirmed' && (s.weekStart === current || s.weekStart === addDays(current, -7)))
    .flatMap((s) => s.entries.filter((e) => e.progress < e.previous - 1e-12).map((e) => ({ s, e, a: byId.get(e.activityId) })))
    .filter((x): x is typeof x & { a: NbcActivity } => !!x.a && x.a.wbs !== 'GR&P')
    .map((x) => ({ ...x, drop: (x.e.previous - x.e.progress) * x.a.globalWeight })).sort((x, y) => y.drop - x.drop).slice(0, 3)
  for (const { s, e, a, drop } of lowered) items.push({ id: `lowered:${s.id}:${a.id}`, tone: 'amber', title: `${a.wbs} ${a.name} lowered ${percent(e.previous, 0)} → ${percent(e.progress, 0)}`, detail: `${s.handler}${e.remark.trim() ? ` · ${e.remark.trim()}` : ''}`, impact: `−${(drop * 100).toFixed(2)}% overall`, to: `${base}/activities?wbs=${encodeURIComponent(a.wbs)}` })
  const stalled = activities.filter((a) => a.editable && a.wbs !== 'GR&P' && a.progress > 0 && a.progress < 1 && a.history.length)
    .map((a) => ({ a, idle: now - Math.max(...a.history.map((h) => Date.parse(h.at))) })).filter((x) => x.idle >= STALLED_DAYS * 86400000)
    .sort((x, y) => y.a.globalWeight * (1 - y.a.progress) - x.a.globalWeight * (1 - x.a.progress)).slice(0, 3)
  for (const { a, idle } of stalled) items.push({ id: `stalled:${a.id}`, tone: 'amber', title: `${a.wbs} ${a.name} has not moved for ${Math.floor(idle / WEEK_MS)} weeks`, detail: `${a.handler || 'Unassigned'} · ${percent(a.progress, 0)} complete`, to: `${base}/activities?wbs=${encodeURIComponent(a.wbs)}` })
  return items.sort((x, y) => Number(y.tone === 'red') - Number(x.tone === 'red'))
}
