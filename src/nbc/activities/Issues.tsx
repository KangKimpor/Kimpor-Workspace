import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TaskTable } from '@/components/TaskTable'
import { Search } from 'lucide-react'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { useWorkspace } from '@/data'
import { useMediaQuery } from '@/lib/media'
import { handlers } from '../types'
import type { NbcActivity } from '../types'

/** Private coordination tasks linked to the shared WBS activities. */
export function Issues({ projectId, activities, switcher }: { projectId: string; activities: NbcActivity[]; switcher: ReactNode }) {
  const [params, setParams] = useSearchParams(), [handler, setHandler] = useState(''), [query, setQuery] = useState('')
  const tasks = useWorkspace((s) => s.tasks), addTask = useWorkspace((s) => s.addTask), mobile = useMediaQuery('(max-width: 639px)')
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable=true]'))) { e.preventDefault(); search.current?.focus() } }
    addEventListener('keydown', key); return () => removeEventListener('keydown', key)
  }, [])
  const wbs = params.get('wbs') ?? '', byId = new Map(activities.map((a) => [a.id, a]))
  const list = tasks.filter((t) => {
    const a = byId.get(t.nbcActivityId ?? '')
    return t.projectId === projectId && !t.deletedAt && (!wbs || a?.wbs === wbs) && (!handler || a?.handler === handler) && (!query || `${t.title} ${a?.wbs ?? ''} ${a?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  })
  const filtered = !!(query || handler || wbs)
  const actions = <button className="btn-accent" onClick={() => { addTask({ title: 'New site action', projectId, nbcActivityId: activities.find((a) => a.wbs === wbs)?.id, labels: [] }); setQuery(''); setHandler('') }}>New action</button>
  const filters = <div className="nbc-filters nbc-issue-filters">
      <label className="search-field"><Search size={16} aria-hidden="true"/><input ref={search} aria-label="Search issues or WBS" placeholder="Search issues or WBS" value={query} onChange={(e) => setQuery(e.target.value)}/><kbd>/</kbd></label>
      <GlassSelect aria-label="Issue handler" value={handler} onChange={(e) => setHandler(e.target.value)}><option value="">All handlers</option>{handlers.map((h) => <option key={h}>{h}</option>)}</GlassSelect>
      <GlassSelect aria-label="Issue WBS" value={wbs} onChange={(e) => { const next = new URLSearchParams(params); if (e.target.value) next.set('wbs', e.target.value); else next.delete('wbs'); setParams(next) }}><option value="">All WBS activities</option>{activities.map((a) => <option key={a.id} value={a.wbs}>{a.wbs} · {a.name}</option>)}</GlassSelect>
    </div>
  return <section className="nbc-issues" aria-label="Project issues">
    <div className="nbc-activity-band">{switcher}<span className="small muted">{list.length} {list.length === 1 ? 'issue' : 'issues'}</span></div>
    <TaskTable tasks={list} nbcActivities={activities} mobile={mobile} toolbar={filters} actions={actions}/>
    {!list.length && <div className="nbc-issue-empty" role="status"><h3>{filtered ? 'No matching issues' : 'No issues yet'}</h3><p className="small muted">{filtered ? 'Try another search or clear your filters.' : 'Add a site action to track coordination work and link it to a WBS activity.'}</p>{filtered && <button className="text-link small" onClick={() => { setQuery(''); setHandler(''); const next = new URLSearchParams(params); next.delete('wbs'); setParams(next) }}>Clear filters</button>}</div>}
    <p className="nbc-issue-privacy small muted">Your coordination tasks stay private. NBC progress and reports are shared with all signed-in users.</p>
  </section>
}
