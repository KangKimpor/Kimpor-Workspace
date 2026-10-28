import { useState } from 'react'
import { canUpdate, submissionId, weekLabel } from '../submissions'
import { handlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'

interface Props { projectId: string; week: string; activities: NbcActivity[]; submissions: NbcSubmission[]; onChoose: (handler: Handler) => void }

/** First step of Update Progress: say who you are before any activity can be edited. */
export function HandlerGate({ projectId, week, activities, submissions, onChoose }: Props) {
  const [picked, setPicked] = useState<Handler | null>(null)
  return <div className="nbc-gate">
    <span className="nbc-eyebrow">Site audit &amp; progress ledger · Phnom Penh, KH</span>
    <h2>Who is updating?</h2>
    <p className="muted">Choose your handler name before you update progress. You will see and edit only your own activities, plus the shared GR&amp;P row. Week of {weekLabel(week)}.</p>
    <div className="nbc-gate-list" role="group" aria-label="Handler">
      {handlers.map((h) => {
        const done = submissions.find((s) => s.id === submissionId(projectId, week, h))?.status === 'confirmed'
        const count = activities.filter((a) => canUpdate(a, h) && a.wbs !== 'GR&P').length
        return <button key={h} aria-pressed={picked === h} onClick={() => setPicked(h)}>
          <span><strong>{h}</strong><small>{count} activities</small></span>
          <span className="nbc-pill" data-status={done ? 'Updated' : 'Not yet'}>{done ? 'Updated' : 'Not yet'}</span>
        </button>
      })}
    </div>
    <button className="btn-accent nbc-gate-go" disabled={!picked} onClick={() => picked && onChoose(picked)}>{picked ? `Continue as ${picked}` : 'Choose a handler'}</button>
  </div>
}
