import { weekLabel } from './submissions'
import type { NbcActivity, NbcSubmission } from './types'
export const percent = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`
export const delta = (n: number) => Math.abs(n) < 1e-10 ? '0.0' : `${n > 0 ? '▲ +' : '▼ −'}${Math.abs(n * 100).toFixed(2)}`
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
export const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date.slice(0,10)}T12:00:00`))
export function exportSubmission(submission: NbcSubmission, activities: NbcActivity[]) {
  const cell = (value: string | number) => `"${String(typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`
  const rows = [['Week',weekLabel(submission.weekStart)],['Handler',submission.handler],['Status',submission.status],['Confirmed at',submission.confirmedAt??''],['Note',submission.note],[],['WBS','Activity','Previous %','Progress %','Change %','Remark'],...submission.entries.map((e)=>{const a=activities.find((a)=>a.id===e.activityId);return [a?.wbs??e.activityId,a?.name??e.activityId,percent(e.previous),percent(e.progress),`${delta(e.progress-e.previous)}%`,e.remark]})]
  const url=URL.createObjectURL(new Blob(['\uFEFF',rows.map((r)=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download=`NBC-BP03-${submission.weekStart}-${submission.handler}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
