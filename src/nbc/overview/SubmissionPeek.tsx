import { SidePeek } from '../ui/SidePeek'
import { StatusPill } from '../ui/StatusPill'
import { percent } from '../format'
import { submissionStatus, weekLabel } from '../submissions'
import type { NbcActivity, NbcSubmission } from '../types'

/** Read-only view of one handler's weekly submission. */
export function SubmissionPeek({ submission, activities, now, onClose }: { submission: NbcSubmission | null; activities: NbcActivity[]; now: number; onClose: () => void }) {
  const byId = new Map(activities.map((a) => [a.id, a]))
  return <SidePeek open={!!submission} onOpenChange={(open) => { if (!open) onClose() }} title={submission ? `${submission.handler} · ${weekLabel(submission.weekStart)}` : 'Update'}>
    {submission && <>
      <p><StatusPill status={submissionStatus(submission, submission.weekStart, activities, now)} time={submission.confirmedAt}/>{submission.status === 'draft' && <span className="small muted"> Draft</span>}</p>
      {submission.note && <p className="nbc-peek-note">{submission.note}</p>}
      <table className="nbc-peek-table"><thead><tr><th scope="col">WBS</th><th scope="col">Activity</th><th scope="col" className="nbc-num">Previous week %</th><th scope="col" className="nbc-num">This week %</th><th scope="col">Remark</th></tr></thead>
        <tbody>{submission.entries.map((e) => { const a = byId.get(e.activityId); return <tr key={e.activityId}><td>{a?.wbs ?? e.activityId}</td><td>{a?.name ?? '—'}</td><td className="nbc-num">{percent(e.previous)}</td><td className="nbc-num">{percent(e.progress)}</td><td>{e.remark || '—'}</td></tr> })}</tbody></table>
      {!submission.entries.length && <p className="small muted">No activities were changed.</p>}
    </>}
  </SidePeek>
}
