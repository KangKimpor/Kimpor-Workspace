import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, changedEntries, submissionStatus, weekStart } from './submissions'
import { confirmationTime } from './WeeklyProgress'
import { handlers } from './types'
import type { NbcActivity, NbcSubmission } from './types'

export function StatusChip({ status, time }: { status: string; time?: string | null }) {
  return <span className="nbc-update-status" data-status={status}><span>{status}</span>{time && <span>{confirmationTime(time)}</span>}</span>
}
export default function WeeklyHandlers({ projectId, submissions, activities }: { projectId: string; submissions: NbcSubmission[]; activities: NbcActivity[] }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const current = weekStart(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' }))
  return <section className="nbc-panel nbc-handler-strip"><h2>Handler updates</h2><p className="small muted">Weekly progress · due Sunday, end of day · Phnom Penh</p><table><thead><tr><th>Handler</th><th>Last week</th><th>This week</th></tr></thead><tbody>{handlers.map((handler) => <tr key={handler}><th scope="row">{handler}</th>{[addDays(current, -7), current].map((week) => {
    const s = submissions.find((s) => s.weekStart === week && s.handler === handler)
    return <td key={week}><Link aria-label={`${handler} ${week === current ? 'this' : 'last'} week update`} to={`/projects-progress/${projectId}/${week === current ? 'update' : 'past'}?handler=${handler}${week !== current ? `&week=${week}&open=1` : ''}`}><StatusChip status={submissionStatus(s, week, activities, now)} time={s?.confirmedAt}/><span className="small muted">{changedEntries(s?.entries ?? []).length} changed</span></Link></td>
  })}</tr>)}</tbody></table></section>
}
