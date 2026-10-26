import { useEffect, useState } from 'react'
import { useMediaQuery } from '@/motion/hooks'
import { reportingToday, reportingWeek, weeklyHandlerStatus } from './reporting-week'
import { shortDate } from './format'
import type { NbcActivity, NbcReport } from './types'

export default function WeeklyHandlers({ reports, activities, report, date }: { reports: NbcReport[]; activities: NbcActivity[]; report?: NbcReport; date?: string }) {
  const mobile = useMediaQuery('(max-width: 767px)')
  const [selectedWeek, setSelectedWeek] = useState<string|null>(null)
  const [expanded, setExpanded] = useState(!mobile), [now, setNow] = useState(Date.now)
  const { ending, deadline } = reportingWeek(report?.date || date || selectedWeek || reportingToday(new Date(now)))
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), deadline > now ? Math.min(60000, deadline - now) : 60000)
    return () => clearTimeout(timer)
  }, [deadline, now])
  const rows = weeklyHandlerStatus(report ? [report] : reports, ending, activities, now)
  const complete = rows.filter((row) => row.complete).length, late = rows.filter((row) => row.status === 'Updated late').length
  return <details className="nbc-week-checklist" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><span><strong>Weekly handler updates</strong><span className="small muted">Due Saturday {shortDate(ending)} · 12 PM · Phnom Penh</span></span><span role="status" aria-live="polite" className="nbc-confirmation-status" data-tone={complete === 6 && late === 0 ? 'success' : now >= deadline ? 'warning' : 'neutral'}>{complete} of 6 updated{late > 0 ? ` · ${late} late` : ''}{now >= deadline && complete < 6 ? ` · ${6-complete} overdue` : ''}</span></summary>
    <div className="nbc-checklist-body">
      {!report && !date && <label className="nbc-checklist-week small">Week containing<input aria-label="Reporting week date" type="date" value={selectedWeek??ending} onChange={(event) => setSelectedWeek(event.target.value||null)}/>{selectedWeek&&<button type="button" className="text-link small" onClick={()=>setSelectedWeek(null)}>Current week</button>}</label>}
      <div className="nbc-confirmation-grid">{rows.map(({handler,status,confirmation}) => <article className="nbc-handler-confirmation" key={handler}>
        <div className="inline"><span className="nbc-avatar">{handler.slice(0,2).toUpperCase()}</span><strong>{handler}</strong></div>
        <span className="nbc-confirmation-status" data-tone={status === 'Updated' ? 'success' : ['Overdue','Updated late','Needs review'].includes(status) ? 'warning' : 'neutral'}>{status}</span>
        <span className="small muted">{confirmation ? new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Phnom_Penh',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(confirmation.at)) : '—'}</span>
        {confirmation && <span className="small muted">{status==='Needs review'?'Changed after confirmation':confirmation.changedCount ? `${confirmation.changedCount} activities changed` : 'No changes confirmed'}</span>}
      </article>)}</div>
    </div>
  </details>
}
