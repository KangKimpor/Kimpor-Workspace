import './update.css'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { summarize } from '../progress'
import { canUpdate, submissionId, weekLabel, weekStart } from '../submissions'
import { percent } from '../format'
import { handlers } from '../types'
import type { Handler, NbcActivity, NbcSubmission } from '../types'
import { deadlineNote, useNow } from './deadline'
import { HandlerGate } from './HandlerGate'
import { UpdateEditor } from './UpdateEditor'

interface Props { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }

function UpdateScreen({ projectId, activities, submissions, handler, onChange }: Props & { handler: Handler; onChange: () => void }) {
  const scope = useWorkspace((s) => s.scope), now = useNow()
  const week = weekStart()
  const selected = submissions.find((s) => s.id === submissionId(projectId, week, handler))
  const assigned = summarize(activities.filter((a) => canUpdate(a, handler)))
  const deadline = deadlineNote(week, now)
  return <section className="nbc-update" aria-label="Weekly progress update">
    <header className="nbc-update-head">
      <div><h2>Update Progress</h2>
        <p className="small muted">{handler} · {weekLabel(week)} · {assigned.count} items · {percent(assigned.progress, 1)} complete</p></div>
      <div className="nbc-update-controls">
        {selected?.status === 'confirmed'
          ? <span className="nbc-deadline" data-tone={selected.late ? 'late' : 'ok'}>{selected.late ? 'Late' : 'On time'}</span>
          : <span className="nbc-deadline" data-tone={deadline.tone}>{deadline.text}</span>}
        <button className="nbc-chip nbc-change-handler" aria-label={`Change handler, currently ${handler}`} onClick={onChange}>Change Handler</button>
      </div>
    </header>
    <UpdateEditor key={`${scope}:${week}:${handler}:${selected?.status ?? 'new'}:${activities[0]?.baselineResetAt ?? ''}`} projectId={projectId} week={week} handler={handler} activities={activities} submission={selected} pastDeadline={deadline.late}/>
  </section>
}

export default function UpdateProgress({ projectId, activities, submissions }: Props) {
  const [params, setParams] = useSearchParams()
  // A handler in the link (for example from Overview) counts as already chosen. Otherwise ask first.
  const [handler, setHandler] = useState<Handler | null>(() => handlers.find((h) => h === params.get('handler')) ?? null)
  function choose(value: Handler | null) {
    setHandler(value)
    const next = new URLSearchParams(params)
    if (value) next.set('handler', value); else next.delete('handler')
    setParams(next, { replace: true })
  }
  if (!handler) return <section className="nbc-update nbc-update-gate" aria-label="Choose your handler"><HandlerGate projectId={projectId} week={weekStart()} activities={activities} submissions={submissions} onChoose={choose}/></section>
  return <UpdateScreen projectId={projectId} activities={activities} submissions={submissions} handler={handler} onChange={() => choose(null)}/>
}
