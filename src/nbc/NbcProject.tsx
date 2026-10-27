import './nbc.css'
import './precision.css'
import './weekly.css'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Link, NavLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { ProjectSummary } from '@/data'
import { useWorkspace } from '@/data'
import { TaskTable } from '@/components/TaskTable'
import { ProjectBoard } from '@/components/ProjectBoard'
import { Tile } from '@/components/WorkspaceUI'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { BottomSheet } from '@/shell/Overlays'
import { useMediaQuery, useMotionReduced } from '@/motion/hooks'
import { supabase } from '@/lib/supabase'
import { syncWorkspace } from '@/data/sync'
import { calculate, summarize } from './progress'
import { assignActivities } from './actions'
import BoqTable, { ProgressBar } from './BoqTable'
import WeeklyProgress from './WeeklyProgress'
import WeeklyHandlers from './WeeklyHandlers'
import PastUpdates from './PastUpdates'
import { addDays, appliedEntries, weekLabel, weekStart } from './submissions'
import { delta, money, percent, shortDate } from './format'
import { handlers } from './types'
import type { NbcActivity, NbcSubmission, NbcWeekSummary } from './types'
const Trend=lazy(()=>import('./Trend'))
const EMPTY_ACTIVITIES:NbcActivity[]=[],EMPTY_SUBMISSIONS:NbcSubmission[]=[],EMPTY_SUMMARIES:NbcWeekSummary[]=[]
const views=[['overview','Overview'],['update','Update Progress'],['past','Past Updates'],['activities','Activities']] as const
const scopes:Record<string,string>={Sitha:'Marble, Tile, Screeding, Waterproofing',Lychhinh:'Carpet, Wood Flooring, Ceiling',Chhorvaon:'Sanitary Ware and Glazing',Srun:'Loose / Fixed Furniture and Drapery',Kheng:'Decorative Lighting and Doors',Tola:'MEP'}

function Breakdown({title,activities,field,previous,compact=false}:{title:string;activities:NbcActivity[];field:'area'|'location'|'trade'|'handler';previous:Map<string,number>;compact?:boolean}) {
  const phone=useMediaQuery('(max-width: 767px)'),[all,setAll]=useState(false)
  const groups=new Map<string,NbcActivity[]>()
  if(field==='handler')for(const name of handlers)groups.set(name,[])
  for(const a of activities)if(a.editable){const key=a[field]||'Unassigned';const list=groups.get(key)??[];list.push(a);groups.set(key,list)}
  const data=[...groups].map(([name,list])=>({name,...summarize(list,previous)})),limit=phone?5:field==='handler'?6:field==='area'?data.length:8
  return <section className={`nbc-panel nbc-breakdown ${compact?'nbc-compact-breakdown':''}`}><div className="row-between"><h2>{title}</h2><span className="small muted">{field==='handler'?'Contribution to project':'Progress · global weight'}</span></div>
    <div className="nbc-breakdown-list">{data.slice(0,all?undefined:limit).map((s)=><Link key={s.name} to={`/projects-progress/${activities[0]?.projectId}/activities?${field}=${encodeURIComponent(s.name)}`} className="nbc-breakdown-row"><span className="nbc-breakdown-name">{s.name}</span><span className="nbc-numeric">{percent(field==='handler'?s.contribution:s.progress)}</span><progress max={1} value={field==='handler'?s.contribution:s.progress} aria-label={`${s.name} progress`}/>{!compact&&<span className="small muted nbc-breakdown-weight">{percent(s.weight,3)} weight</span>}</Link>)}</div>
    {data.length>limit&&<button className="text-link small nbc-show-all" onClick={()=>setAll(!all)}>{all?'Show less':`Show all (${data.length})`}</button>}
  </section>
}

function HandlerArea({activities,previous,since}:{activities:NbcActivity[];previous:Map<string,number>;since?:string}) {
  const [mode,setMode]=useState<'handler'|'area'>('handler'),[expanded,setExpanded]=useState(new Set<string>()),[parent,setParent]=useState(''),[handler,setHandler]=useState<string>(handlers[0]),[confirm,setConfirm]=useState(false),[error,setError]=useState('')
  const c=useMemo(()=>calculate(activities),[activities]),b=useMemo(()=>calculate(activities,previous),[activities,previous])
  const leaves=activities.filter((a)=>a.editable&&parent&&(a.id===parent||a.wbs.startsWith(`${c.byId.get(parent)?.wbs}.`)))
  const rows=activities.filter((a)=>!a.parentId||a.parentId&&expanded.has(a.parentId))
  return <div className="nbc-group-view"><div className="nbc-section-heading"><div className="nbc-segment" aria-label="Group activities"><button aria-pressed={mode==='handler'} onClick={()=>setMode('handler')}>By Handler</button><button aria-pressed={mode==='area'} onClick={()=>setMode('area')}>By Area</button></div></div>
    {mode==='handler'?<><div className="nbc-handler-cards">{handlers.map((name)=>{const s=summarize(activities.filter((a)=>a.handler===name),previous,since);return <article className="nbc-panel nbc-handler-card" key={name}><div className="inline"><span className="nbc-avatar">{name.slice(0,2).toUpperCase()}</span><h2>{name}</h2>{name==='Tola'&&<span className="nbc-lead">Lead</span>}</div><p className="small muted nbc-scope">{scopes[name]}</p><strong className="nbc-contribution">{percent(s.contribution)}</strong><span className="small muted">contribution to the whole project</span><div className="row-between small"><span className="muted">Handler progress</span><strong>{percent(s.progress)}</strong></div><progress max={1} value={s.progress} aria-label={`${name} handler progress`}/><span className="small muted">Assigned share: {percent(s.weight,3)} of project</span><dl className="nbc-handler-counts">{[['Assigned',s.count],['Completed',s.completed],['In progress',s.inProgress],['Not started',s.notStarted]].map(([label,n])=><div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl><div className="row-between"><span className="small muted">Updated this period: {s.updated}</span><Link className="text-link small" to={`/projects-progress/${activities[0]?.projectId}/activities?handler=${encodeURIComponent(name)}`}>Open activities →</Link></div></article>})}</div><p className="small muted">Contribution is the sum of each activity’s global weight × progress. Unassigned / GR&amp;P contributes {percent(summarize(activities.filter((a)=>!a.handler)).contribution)} to the project.</p></>:<div className="table-scroll nbc-panel"><table className="task-table nbc-area-table"><thead><tr><th>Area</th><th className="nbc-numeric">Weight</th><th className="nbc-numeric">Progress</th><th className="nbc-numeric">Δ This week</th><th className="nbc-numeric">Activities</th></tr></thead><tbody>{rows.map((a)=>{const s=summarize(activities.filter((leaf)=>leaf.id===a.id||leaf.wbs.startsWith(`${a.wbs}.`)));return <tr key={a.id}><td><div className="inline" style={{paddingInlineStart:a.parentId?'var(--space-16)':0}}>{!a.editable&&<button className="ibtn" aria-label={`${expanded.has(a.id)?'Collapse':'Expand'} area ${a.wbs}`} onClick={()=>setExpanded((old)=>{const next=new Set(old);if(next.has(a.id))next.delete(a.id);else next.add(a.id);return next})}>{expanded.has(a.id)?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>}<Link to={`/projects-progress/${a.projectId}/activities?area=${encodeURIComponent(a.area)}`}>{a.name}</Link></div></td><td className="nbc-numeric">{percent(a.globalWeight,3)}</td><td className="nbc-numeric">{percent(c.progress.get(a.id)!)}</td><td className="nbc-numeric nbc-delta" data-sign={Math.sign(c.progress.get(a.id)!-b.progress.get(a.id)!)}>{delta(c.progress.get(a.id)!-b.progress.get(a.id)!)}</td><td className="nbc-numeric">{s.count}</td></tr>})}</tbody></table></div>}
    <section className="nbc-panel"><div className="row-between"><div><h2>Reassign a group</h2><p className="small muted">Select a parent activity to assign all its leaves together.</p></div><button className="btn-secondary" onClick={()=>{setConfirm(true);setError('')}}>Assign all leaves to…</button></div></section>
    <BottomSheet initial="large" open={confirm} onOpenChange={setConfirm} title="Reassign handlers"><form className="nbc-sheet-fields" onSubmit={(e)=>{e.preventDefault();try{if(!parent)throw new Error('Select a parent activity.');assignActivities(leaves.map((a)=>a.id),handler);setConfirm(false)}catch(err){setError((err as Error).message)}}}><label className="nbc-field">Parent activity<GlassSelect aria-label="Parent activity" value={parent} onChange={(e)=>setParent(e.target.value)}><option value="">Choose parent…</option>{activities.filter((a)=>!a.editable).map((a)=><option key={a.id} value={a.id}>{a.wbs} · {a.name}</option>)}</GlassSelect></label><label className="nbc-field">Assign to<GlassSelect aria-label="Bulk handler" value={handler} onChange={(e)=>setHandler(e.target.value)}>{handlers.map((h)=><option key={h}>{h}</option>)}</GlassSelect></label><p>{leaves.length} leaf activities will be assigned to {handler}. Progress percentages stay the same.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn-accent" type="submit" disabled={!leaves.length}>Confirm assignment · {leaves.length} activities</button></form></BottomSheet>
  </div>
}

function Issues({projectId,activities,board}:{projectId:string;activities:NbcActivity[];board:boolean}) {
  const [params,setParams]=useSearchParams(),[handler,setHandler]=useState(''),[query,setQuery]=useState('')
  const tasks=useWorkspace((s)=>s.tasks),addTask=useWorkspace((s)=>s.addTask),mobile=useMediaQuery('(max-width: 639px)')
  const wbs=params.get('wbs')??'',byId=new Map(activities.map((a)=>[a.id,a]))
  const list=tasks.filter((t)=>{const a=byId.get(t.nbcActivityId??'');return t.projectId===projectId&&!t.deletedAt&&(!wbs||a?.wbs===wbs)&&(!handler||a?.handler===handler)&&(!query||`${t.title} ${a?.wbs??''} ${a?.name??''}`.toLowerCase().includes(query.toLowerCase()))})
  const toolbar=<div className="view-tabs"><Link className="view-tab" to={`/projects-progress/${projectId}/issues`}>Table</Link><Link className="view-tab" to={`/projects-progress/${projectId}/board`}>Board</Link></div>
  const actions=<button className="btn-accent" onClick={()=>addTask({title:'New site action',projectId,nbcActivityId:activities.find((a)=>a.wbs===wbs)?.id,labels:[]})}>New action</button>
  return <section><div className="nbc-section-heading"><div><h2>Issues & actions</h2><p className="small muted">Your coordination tasks stay private. NBC progress and reports are shared with all signed-in users.</p></div></div><div className="nbc-toolbar"><input aria-label="Search issues or WBS" placeholder="Search issues or WBS" value={query} onChange={(e)=>setQuery(e.target.value)}/><GlassSelect aria-label="Issue handler" value={handler} onChange={(e)=>setHandler(e.target.value)}><option value="">All handlers</option>{handlers.map((h)=><option key={h}>{h}</option>)}</GlassSelect><GlassSelect aria-label="Issue WBS" value={wbs} onChange={(e)=>{const next=new URLSearchParams(params);if(e.target.value)next.set('wbs',e.target.value);else next.delete('wbs');setParams(next)}}><option value="">All WBS activities</option>{activities.filter((a)=>a.editable).map((a)=><option key={a.id} value={a.wbs}>{a.wbs} · {a.name}</option>)}</GlassSelect></div>{board?<><div className="project-table-toolbar">{toolbar}{actions}</div><ProjectBoard tasks={list} projectId={projectId}/></>:<TaskTable tasks={list} nbcActivities={activities.filter((a)=>a.editable)} mobile={mobile} toolbar={toolbar} actions={actions}/>}</section>
}

export default function NbcProject({project,view}:{project:ProjectSummary;view:string}) {
  const reduced=useMotionReduced(), scope=useWorkspace((s)=>s.scope)
  const allActivities=useWorkspace((s)=>s.nbc_activities??EMPTY_ACTIVITIES),allSubmissions=useWorkspace((s)=>s.nbc_submissions??EMPTY_SUBMISSIONS),allSummaries=useWorkspace((s)=>s.nbc_summaries??EMPTY_SUMMARIES)
  const activities=useMemo(()=>allActivities.filter((a)=>a.projectId===project.id),[allActivities,project.id]),submissions=useMemo(()=>allSubmissions.filter((s)=>s.projectId===project.id),[allSubmissions,project.id]),summaries=useMemo(()=>allSummaries.filter((s)=>s.projectId===project.id),[allSummaries,project.id])
  const nav=useRef<HTMLElement>(null),navigate=useNavigate(),current=weekStart(),[dismissed,setDismissed]=useState(false)
  const calculation=useMemo(()=>{try{return calculate(activities)}catch{return null}},[activities])
  const baseline=useMemo(()=>{const values=new Map(activities.map((a)=>[a.id,a.progress]));for(const s of [...submissions].filter((s)=>s.weekStart===current).sort((a,b)=>(b.confirmedAt??'').localeCompare(a.confirmedAt??'')))for(const e of appliedEntries(s))values.set(e.activityId,e.previous);return values},[activities,submissions,current])
  useEffect(()=>{if(!supabase||scope==='guest')return;const client=supabase,channel=client.channel(`nbc-bp03:${scope}`);for(const table of ['kw_nbc_activities','kw_nbc_submissions','kw_nbc_summaries'])channel.on('postgres_changes',{event:'*',schema:'public',table},()=>{void syncWorkspace()});channel.subscribe((status)=>{if(status==='SUBSCRIBED')void syncWorkspace()});return()=>{void client.removeChannel(channel)}},[scope])
  useEffect(()=>{nav.current?.querySelector<HTMLElement>('[aria-current=page]')?.scrollIntoView({block:'nearest',inline:'nearest'})},[view])
  const aliases:Record<string,string>={boq:'activities',progress:'activities',weekly:'update',handlers:'overview'}
  if(aliases[view])return <Navigate to={`/projects-progress/${project.id}/${aliases[view]}${location.search}`} replace/>
  if(!views.some(([key])=>key===view)&&!['issues','board'].includes(view))return <Navigate to={`/projects-progress/${project.id}/overview`} replace/>
  const count=summarize(activities.filter((a)=>a.wbs!=='GR&P'),baseline),overall=calculation?.overall??0,previous=summaries.find((s)=>s.weekStart===addDays(current,-7)),currentSummary=summaries.find((s)=>s.weekStart===current),last=activities.map((a)=>a.updatedAt??'').sort().at(-1)
  const updated=handlers.filter((h)=>submissions.some((s)=>s.handler===h&&s.weekStart===current&&s.status==='confirmed')).length
  return <div className="workspace-surface project-page nbc-project" data-view={view}>
    <header className="page-heading nbc-project-header"><div className="project-heading"><Tile name={project.icon||project.id} color={project.color}/><div><div className="inline"><h1>{project.name}</h1><span className="pill nbc-team-badge">Team</span></div><div className="nbc-header-progress"><strong>{percent(overall)}</strong><ProgressBar value={overall} label="Overall project progress"/></div></div></div><div className="nbc-project-week"><strong>{weekLabel(current)}</strong><span className="small muted">This week · Sunday end-of-day deadline</span></div></header>
    <nav ref={nav} className="view-tabs nbc-tabs" aria-label="Project views">{views.map(([key,label])=><NavLink className="view-tab" key={key} to={`/projects-progress/${project.id}/${key}`}>{label}{key===view&&<motion.span className="nbc-tab-underline" layoutId={reduced?undefined:'nbc-active-tab'} transition={{duration:.14}}/>}</NavLink>)}</nav>
    {!activities.length?<section className="nbc-panel"><h2>BOQ data has not been initialized.</h2><p>Complete the private project setup.</p></section>:<>
      {!calculation&&!dismissed&&<div className="nbc-banner nbc-warning" role="status"><span>Calculation needs attention. Progress editing is paused.</span><button className="ibtn" aria-label="Dismiss calculation warning" onClick={()=>setDismissed(true)}><X size={16}/></button></div>}
      {view==='overview'&&<><div className="nbc-kpi-strip" aria-label="Project indicators">{[['Overall progress',percent(overall)],['This week',`${delta((currentSummary?.overall??overall)-(currentSummary?.previous??calculate(activities,baseline).overall))}%`],['Previous week',previous?percent(previous.overall):'—'],['BOQ value',money(activities.filter((a)=>!a.parentId).reduce((sum,a)=>sum+(a.boqValue??0),0))],['Activities',String(count.count)],['Last updated',last?shortDate(last):'—']].map(([label,value])=><div className="nbc-kpi" key={label}><span>{label}</span><strong>{value}</strong>{label==='Activities'&&<span className="small muted">{count.completed} completed · {count.inProgress} in progress</span>}</div>)}</div><p className="small muted">{updated} of 6 handlers updated this week</p><WeeklyHandlers projectId={project.id} submissions={submissions} activities={activities}/><div className="nbc-overview-grid"><div className="nbc-chart-slot"><Suspense fallback={<p>Loading trend…</p>}><Trend summaries={summaries}/></Suspense></div><div className="nbc-handlers-slot"><Breakdown title="Handlers" activities={activities.filter((a)=>!!a.handler)} field="handler" previous={baseline} compact/></div><div className="nbc-area-slot"><Breakdown title="Progress by work area" activities={activities} field="area" previous={baseline}/></div><Breakdown title="Floor / location" activities={activities} field="location" previous={baseline}/><Breakdown title="Trade" activities={activities} field="trade" previous={baseline}/></div></>}
      {view==='update'&&calculation&&<WeeklyProgress projectId={project.id} activities={activities} submissions={submissions}/>}
      {view==='past'&&<PastUpdates projectId={project.id} activities={activities} submissions={submissions}/>}
      {view==='activities'&&calculation&&<><div className="row-between"><p className="small muted">Progress is applied when a handler confirms their update. Handler assignments remain editable here.</p><button className="btn-secondary" onClick={()=>navigate(`/projects-progress/${project.id}/issues`)}>Issues & actions</button></div><BoqTable activities={activities} previous={baseline}/><details className="nbc-panel"><summary>Handler assignments and work areas</summary><HandlerArea activities={activities} previous={baseline}/></details></>}
      {(view==='issues'||view==='board')&&<Issues projectId={project.id} activities={activities} board={view==='board'}/>}
    </>}
  </div>
}

