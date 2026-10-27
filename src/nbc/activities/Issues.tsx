import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TaskTable } from '@/components/TaskTable'
import { ProjectBoard } from '@/components/ProjectBoard'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { useMediaQuery } from '@/motion/hooks'
import { handlers } from '../types'
import type { NbcActivity } from '../types'

/** Coordination tasks linked to WBS activities. `switcher` is the shared Table / Board / Issues control. */
export function Issues({ projectId, activities, board, switcher }: { projectId: string; activities: NbcActivity[]; board: boolean; switcher: ReactNode }) {
  const [params, setParams] = useSearchParams(), [handler, setHandler] = useState(''), [query, setQuery] = useState('')
  const tasks = useWorkspace((s) => s.tasks), addTask = useWorkspace((s) => s.addTask), mobile = useMediaQuery('(max-width: 639px)')
  const wbs = params.get('wbs') ?? '', byId = new Map(activities.map((a) => [a.id, a]))
  const list = tasks.filter((t) => {
    const a = byId.get(t.nbcActivityId ?? '')
    return t.projectId === projectId && !t.deletedAt && (!wbs || a?.wbs === wbs) && (!handler || a?.handler === handler) && (!query || `${t.title} ${a?.wbs ?? ''} ${a?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  })
  const actions = <button className="btn-accent" onClick={() => addTask({ title: 'New site action', projectId, nbcActivityId: activities.find((a) => a.wbs === wbs)?.id, labels: [] })}>New action</button>
  return <section>
    <p className="small muted">Your coordination tasks stay private. NBC progress and reports are shared with all signed-in users.</p>
    <div className="nbc-toolbar">
      <input aria-label="Search issues or WBS" placeholder="Search issues or WBS" value={query} onChange={(e) => setQuery(e.target.value)}/>
      <GlassSelect aria-label="Issue handler" value={handler} onChange={(e) => setHandler(e.target.value)}><option value="">All handlers</option>{handlers.map((h) => <option key={h}>{h}</option>)}</GlassSelect>
      <GlassSelect aria-label="Issue WBS" value={wbs} onChange={(e) => { const next = new URLSearchParams(params); if (e.target.value) next.set('wbs', e.target.value); else next.delete('wbs'); setParams(next) }}><option value="">All WBS activities</option>{activities.filter((a) => a.editable).map((a) => <option key={a.id} value={a.wbs}>{a.wbs} · {a.name}</option>)}</GlassSelect>
    </div>
    {board
      ? <><div className="project-table-toolbar">{switcher}{actions}</div><ProjectBoard tasks={list} projectId={projectId}/></>
      : <TaskTable tasks={list} nbcActivities={activities.filter((a) => a.editable)} mobile={mobile} toolbar={switcher} actions={actions}/>}
  </section>
}
