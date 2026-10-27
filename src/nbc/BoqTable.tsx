import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, ChevronsDown, ChevronsUp, Columns3, Info, LockKeyhole, MessageSquare, MoreHorizontal, Search, SlidersHorizontal, X } from 'lucide-react'
import { GlassPopover } from '@/components/glass/GlassPopover'
import { GlassSelect } from '@/components/glass/GlassSelect'
import { BottomSheet } from '@/shell/Overlays'
import { useWorkspace } from '@/data'
import { useMediaQuery, useMotionReduced } from '@/motion/hooks'
import { pendingCollectionIds, syncWorkspace } from '@/data/sync'
import { updateActivity } from './actions'
import { calculate, visibleHierarchy } from './progress'
import type { NbcActivity } from './types'
import { handlers } from './types'
import { delta, money, percent } from './format'

export function ProgressBar({value,label}:{value:number;label:string}) {
  return <span className="nbc-flat-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number((value*100).toFixed(2))} data-complete={value===1}><span style={{transform:`scaleX(${value})`}}/></span>
}

function Variance({value}:{value:number}) {
  return <span key={value} className="nbc-variance" data-sign={Math.sign(value)}>{Math.abs(value)<1e-10?'Steady':`${delta(value)}%`}</span>
}

function ProgressCell({activity:a,value}:{activity:NbcActivity;value:number}) {
  return <div className="nbc-progress-cell"><span className="nbc-number" title={!a.editable?'Calculated from child activities.':'Confirm a handler update to change progress.'}>{percent(value)}</span><ProgressBar value={value} label={`${a.name} progress`}/></div>
}

export function ActivityDetail({activity:a,readOnly=false,onClose}:{activity:NbcActivity;readOnly?:boolean;onClose?:()=>void}) {
  const [all,setAll] = useState(false),[error,setError]=useState('')
  const addTask=useWorkspace((s)=>s.addTask)
  return <div className="nbc-detail">
    <div className="row-between"><div><span className="nbc-wbs" title={a.wbs}>{a.wbs}</span><h3>{a.name}</h3></div>{onClose&&<button className="ibtn" aria-label="Close activity details" onClick={onClose}><X size={16}/></button>}</div>
    <p className="small muted">{a.description}</p>
    <div className="nbc-field">Site remark<p>{a.remark||'No remark recorded.'}</p></div>
    <p className="small muted">{a.updatedAt?`Updated ${new Date(a.updatedAt).toLocaleString()} by ${a.history.at(-1)?.editor??'workspace owner'}`:'Initial baseline (undated)'}</p>
    <dl className="nbc-metadata">{[['Area',a.area],['Trade',a.trade],['BOQ value',a.boqValue===null?'—':money(a.boqValue)],['Schedule',a.schedule===null?'—':percent(a.schedule)],['Duration',a.duration===null?'—':`${a.duration} days`],['Global weight',percent(a.globalWeight,3)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="row-between"><h3>Progress history</h3>{a.history.length>5&&<button className="text-link small" onClick={()=>setAll(!all)}>{all?'Last 5 changes':'View all'}</button>}</div>
    {a.history.length?<ol className="nbc-history">{a.history.toReversed().slice(0,all?undefined:5).map((h)=><li key={h.id}><span>{percent(h.previous)} → {percent(h.progress)}</span><span className="small muted">{new Date(h.at).toLocaleString()} · {h.editor}</span></li>)}</ol>:<p className="small muted">No recorded changes.</p>}
    {!readOnly&&<button className="btn-secondary" onClick={()=>{addTask({title:`Inspection · ${a.name}`,projectId:a.projectId,nbcActivityId:a.id,labels:['Inspection']});setError('Linked issue created.')}}>Create issue</button>}
    {error&&<p className="small" role="status">{error}</p>}
  </div>
}

const optionalColumns = ['Area','Trade','BOQ value','Schedule %','Status'] as const
export default function BoqTable({activities,previous}:{activities:NbcActivity[];previous:Map<string,number>}) {
  const reduced=useMotionReduced()
  const mobile=useMediaQuery('(max-width: 767px)'),tablet=useMediaQuery('(min-width: 768px) and (max-width: 1279px)')
  const [params,setParams]=useSearchParams(),[query,setQuery]=useState(''),[range,setRange]=useState('all'),[minimum,setMinimum]=useState(''),[maximum,setMaximum]=useState(''),[changed,setChanged]=useState(false)
  const [sort,setSort]=useState<'wbs'|'name'|'progress'>('wbs'),[optional,setOptional]=useState<string[]>([]),[filters,setFilters]=useState(false),[detail,setDetail]=useState<string|null>(null)
  const [collapsed,setCollapsed]=useState(()=>new Set(activities.filter((a)=>!a.editable&&a.parentId).map((a)=>a.id))),[focused,setFocused]=useState(activities[0]?.id??'')
  const search=useRef<HTMLInputElement>(null),scroll=useRef<HTMLDivElement>(null), grid=useRef<HTMLDivElement>(null)
  const handler=params.get('handler')??'',area=params.get('area')??'',location=params.get('location')??'',trade=params.get('trade')??'',wbs=params.get('wbs')??''
  useEffect(()=>{if(params.toString()){setCollapsed(new Set());scroll.current?.scrollTo({top:0})}},[params])
  const sync=useWorkspace((s)=>s.sync),tasks=useWorkspace((s)=>s.tasks)
  const pendingIds=pendingCollectionIds('nbc_activities')
  const calculation=useMemo(()=>calculate(activities),[activities]),before=useMemo(()=>calculate(activities,previous),[activities,previous])
  const active=!!(query||handler||area||location||trade||wbs||range!=='all'||minimum||maximum||changed)
  const matches=useMemo(()=>new Set(activities.filter((a)=>{
    const p=calculation.progress.get(a.id)!,b=before.progress.get(a.id)!
    return (!query||`${a.wbs} ${a.name} ${a.description}`.toLowerCase().includes(query.toLowerCase()))&&(!handler||(a.handler||'Unassigned')===handler)&&(!area||a.area===area)&&(!location||a.location===location)&&(!trade||a.trade===trade)&&(!wbs||a.wbs===wbs)&&(!changed||a.editable&&Math.abs(p-b)>1e-12)&&(minimum===''||p*100>=Number(minimum))&&(maximum===''||p*100<=Number(maximum))&&(range==='all'||a.editable&&(range==='zero'?p===0:range==='done'?p===1:p>0&&p<1))
  }).map((a)=>a.id)),[activities,calculation,before,query,handler,area,location,trade,wbs,changed,minimum,maximum,range])
  const rows=useMemo(()=>visibleHierarchy(activities,(a)=>matches.has(a.id),collapsed,sort,calculation.progress),[activities,matches,collapsed,sort,calculation])
  const visible=useMemo(()=>rows.flatMap((row)=>!mobile&&detail===row.activity.id?[{...row,detail:false},{...row,detail:true}]:[{...row,detail:false}]),[rows,mobile,detail])
  // oxlint-disable-next-line react/incompatible-library -- Uses the same installed virtualizer as TaskTable.
  const virtual=useVirtualizer({count:visible.length,getScrollElement:()=>scroll.current,getItemKey:(i)=>`${visible[i]!.activity.id}:${visible[i]!.detail}`,estimateSize:(i)=>visible[i]?.detail?360:mobile?80:48,overscan:8,useFlushSync:false})
  useEffect(()=>{function key(e:globalThis.KeyboardEvent){if(e.key==='/'&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,[contenteditable=true]'))){e.preventDefault();search.current?.focus()}};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[])
  function filter(key:string,value:string){setCollapsed(new Set());const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);setParams(next)}
  function clear(){setParams({});setQuery('');setRange('all');setMinimum('');setMaximum('');setChanged(false)}
  async function toggle(id:string,expand?:boolean){
    const opening=expand??collapsed.has(id),parent=calculation.byId.get(id)
    if(!opening&&parent){
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'
      const children=[...(grid.current?.querySelectorAll<HTMLElement>('[data-wbs]')??[])].filter((el)=>el.dataset.wbs?.startsWith(`${parent.wbs}.`))
      await Promise.all(children.map((el)=>el.animate(reduced?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(4px)'}],{duration:reduced?140:154,easing:'cubic-bezier(0.4,0,1,1)'}).finished.catch(()=>{})))
    }
    setCollapsed((old)=>{const next=new Set(old);if(opening)next.delete(id);else next.add(id);return next})
  }
  function focus(id:string,edit=false){setFocused(id);const index=visible.findIndex((r)=>r.activity.id===id&&!r.detail);if(index<0)return;virtual.scrollToIndex(index,{align:'auto'});requestAnimationFrame(()=>{const row=grid.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);row?.focus({preventScroll:true});if(edit)row?.querySelector<HTMLButtonElement>('[data-edit-progress]')?.click()})}
  function rowKey(e:KeyboardEvent<HTMLDivElement>,a:NbcActivity){if(e.target!==e.currentTarget)return;const at=rows.findIndex((r)=>r.activity.id===a.id);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focus(rows[Math.max(0,Math.min(rows.length-1,at+(e.key==='ArrowDown'?1:-1)))]!.activity.id)}if(e.key==='ArrowRight'&&!a.editable){e.preventDefault();toggle(a.id,true)}if(e.key==='ArrowLeft'){e.preventDefault();if(!a.editable&&!collapsed.has(a.id))toggle(a.id,false);else if(a.parentId)focus(a.parentId)}if(e.key.toLowerCase()==='r'){e.preventDefault();setDetail(detail===a.id?null:a.id)}}
  const filterCount=[handler,area,location,trade,wbs,range!=='all',changed,minimum,maximum].filter(Boolean).length
  const chips=[...['handler','area','location','trade','wbs'].flatMap((key)=>params.get(key)?[{key,label:params.get(key)!}]:[]),...(query?[{key:'query',label:`Search: ${query}`}]:[]),...(range!=='all'?[{key:'range',label:range==='zero'?'0%':range==='done'?'100%':'1–99%'}]:[]),...(changed?[{key:'changed',label:'Changed this week'}]:[]),...(minimum||maximum?[{key:'bounds',label:`${minimum||0}–${maximum||100}%`}]:[])]
  const handlerControl=<GlassSelect aria-label="Assigned handler" value={handler} onChange={(e)=>filter('handler',e.target.value)}><option value="">All handlers</option>{[...new Set([...handlers,...activities.filter((a)=>a.editable).map((a)=>a.handler||'Unassigned')])].map((h)=><option key={h}>{h}</option>)}</GlassSelect>
  const columnControl=<div className="column-choices">{optionalColumns.map((c)=><label className="inline" key={c}><input type="checkbox" checked={optional.includes(c)} onChange={(e)=>setOptional(e.target.checked?[...optional,c]:optional.filter((v)=>v!==c))}/>{c}</label>)}</div>
  const filterControls=<>
    {handlerControl}<GlassSelect aria-label="Work area" value={area} onChange={(e)=>filter('area',e.target.value)}><option value="">All areas</option>{[...new Set(activities.map((a)=>a.area))].map((a)=><option key={a}>{a}</option>)}</GlassSelect>
    <GlassSelect aria-label="Progress range" value={range} onChange={(e)=>setRange(e.target.value)}><option value="all">All progress</option><option value="zero">0% · Not started</option><option value="active">1–99% · In progress</option><option value="done">100% · Done</option></GlassSelect>
    <div className="nbc-bounds"><input aria-label="Minimum progress" type="number" min={0} max={100} placeholder="Min %" value={minimum} onChange={(e)=>setMinimum(e.target.value)}/><span>–</span><input aria-label="Maximum progress" type="number" min={0} max={100} placeholder="Max %" value={maximum} onChange={(e)=>setMaximum(e.target.value)}/></div>
    <label className="inline small"><input type="checkbox" checked={changed} onChange={(e)=>setChanged(e.target.checked)}/>Changed this week</label>
    <GlassSelect aria-label="Sort BOQ siblings" value={sort} onChange={(e)=>setSort(e.target.value as typeof sort)}><option value="wbs">WBS order</option><option value="name">Activity name</option><option value="progress">Highest progress</option></GlassSelect>
  </>
  const baseColumns=mobile?2:tablet?5:8,colCount=baseColumns+(mobile||tablet?0:optional.length)
  const selected=activities.find((a)=>a.id===detail)
  const scrollTop=scroll.current?.scrollTop??0,viewportHeight=scroll.current?.clientHeight??0
  const displayed=virtual.getVirtualItems().filter((item)=>!visible[item.index]?.detail&&item.end>scrollTop&&item.start<scrollTop+viewportHeight-(mobile?0:48)).length
  const columns=mobile?'minmax(0,1fr)':tablet?'var(--nbc-tablet-cols)':`var(--nbc-desktop-cols)${optional.map(()=> ' calc(var(--space-64) * 2)').join('')}`
  function optionalValue(a:NbcActivity,c:string){return c==='Area'?a.area:c==='Trade'?a.trade:c==='BOQ value'?a.boqValue===null?'—':money(a.boqValue):c==='Schedule %'?a.schedule===null?'—':percent(a.schedule):a.progress===1?'Done':a.progress===0?'Not started':'In progress'}
  function handlerPicker(a:NbcActivity):ReactNode {return a.editable?<GlassPopover label={`Assign ${a.wbs}`} trigger={<button className="nbc-handler-button" aria-label={`Assign handler for ${a.wbs}: ${a.handler.slice(0,2).toUpperCase()||'—'} ${a.handler||'Unassigned'}`}><span className="nbc-avatar" title={a.handler||'Unassigned'}>{a.handler.slice(0,2).toUpperCase()||'—'}</span>{a.handler==='Tola'&&<span className="nbc-lead">Lead</span>}<span className="nbc-handler-name">{a.handler||'Unassigned'}</span></button>}><GlassSelect aria-label={`Handler for ${a.wbs}`} value={a.handler} onChange={(e)=>updateActivity(a.id,{handler:e.target.value})}>{a.wbs==='GR&P'&&<option value="">Shared</option>}{[...new Set([...handlers,a.handler].filter(Boolean))].map((h)=><option key={h}>{h}</option>)}</GlassSelect></GlassPopover>:<span className="muted">{a.handler||'—'}</span>}
  return <section className="nbc-boq" >
    {<div className="nbc-banner"><LockKeyhole size={16}/><span>Use Update Progress to draft and confirm changes.</span><Link className="text-link" to={`/projects-progress/${activities[0]?.projectId}/update`}>Update Progress</Link></div>}
    <div className="nbc-table-tools">
      <div className="nbc-toolbar"><label className="search-field"><Search size={16}/><input ref={search} aria-label="Search BOQ" placeholder="Search WBS or activity" value={query} onChange={(e)=>{setQuery(e.target.value);setCollapsed(new Set())}}/><kbd>/</kbd></label>
        {mobile?<button className="btn-secondary" onClick={()=>setFilters(true)}><SlidersHorizontal size={16}/>Filters {filterCount>0&&<span className="pill">{filterCount}</span>}</button>:<><div className="nbc-desktop-controls"><GlassPopover label="BOQ filters" trigger={<button className="btn-secondary"><SlidersHorizontal size={16}/>Filters {filterCount>0&&`(${filterCount})`}</button>}><div className="nbc-filter-fields">{filterControls}</div></GlassPopover><label className="inline small"><input type="checkbox" checked={changed} onChange={(e)=>setChanged(e.target.checked)}/>Changed this week</label></div><div className="nbc-tool-end"><GlassSelect aria-label="Sort BOQ siblings" value={sort} onChange={(e)=>setSort(e.target.value as typeof sort)}><option value="wbs">WBS order</option><option value="name">Activity name</option><option value="progress">Highest progress</option></GlassSelect><GlassPopover label="BOQ columns" trigger={<button className="ibtn" aria-label="BOQ columns"><Columns3 size={16}/></button>}>{columnControl}</GlassPopover><button className="ibtn" title="Expand all" aria-label="Expand all" onClick={()=>setCollapsed(new Set())}><ChevronsDown size={16}/></button><button className="ibtn" title="Collapse all" aria-label="Collapse all" onClick={()=>setCollapsed(new Set(activities.filter((a)=>!a.editable).map((a)=>a.id)))}><ChevronsUp size={16}/></button></div></>}
      </div>
      {!mobile&&<div className="nbc-handler-tabs" aria-label="Handler filters">{['',...handlers].map((h)=><button className="view-tab" key={h} aria-pressed={handler===h} onClick={()=>filter('handler',h)}>{h||'All handlers'}</button>)}</div>}
      {chips.length>0&&<div className="nbc-filter-chips">{<AnimatePresence initial={false} mode="popLayout">{chips.map((chip)=><motion.button layout={reduced?false:"position"} initial={reduced?{opacity:0}:{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.14,layout:{duration:.22}}} className="pill" key={chip.key} aria-label={`Remove ${chip.label} filter`} onClick={()=>{if(chip.key==='query')setQuery('');else if(chip.key==='range')setRange('all');else if(chip.key==='changed')setChanged(false);else if(chip.key==='bounds'){setMinimum('');setMaximum('')}else filter(chip.key,'')}}>{chip.label}<X size={12}/></motion.button>)}</AnimatePresence>}<button className="text-link small" onClick={clear}>Clear all</button></div>}
      <div className="nbc-table-caption small muted"><span title={`${activities.length} records in the project`}>{displayed} of {rows.length} WBS rows displayed{sort!=='wbs'?' · Sorted within groups':''}</span><span>R for activity details</span></div>
    </div>
    <div className="nbc-grid-scroll" ref={scroll}>
      <div ref={grid} role="treegrid" aria-label="BOQ progress" aria-rowcount={visible.length+1} aria-colcount={colCount} style={{['--nbc-cols' as string]:columns}} className={`nbc-treegrid ${mobile?'nbc-phone-grid':tablet?'nbc-ipad-grid':''}`}>
        {!mobile&&<div role="row" aria-rowindex={1} className="nbc-grid-header nbc-grid-row">{(tablet?['WBS','Activity','Handler','Actual %','Δ']:['WBS','Activity','Handler','Weight','Previous %','Actual %','Variance Δ','Actions',...optional]).map((c,i)=><div key={c} role="columnheader" className={i===0?'nbc-sticky-cell':i>2?'nbc-numeric':''}>{c}</div>)}</div>}
        <div role="rowgroup" className="nbc-virtual-body" style={{height:virtual.getTotalSize()}}>
          {virtual.getVirtualItems().map((item)=>{const row=visible[item.index]!,a=row.activity,p=calculation.progress.get(a.id)!,b=before.progress.get(a.id)!,d=p-b,issues=tasks.filter((t)=>t.nbcActivityId===a.id&&!t.deletedAt&&t.status!=='Done')
            const progress=<ProgressCell activity={a} value={p}/>
            return <div key={item.key} data-index={item.index} ref={virtual.measureElement} style={{transform:`translateY(${item.start}px)`}} className="nbc-positioned-row">
              {row.detail?<div role="row" aria-rowindex={item.index+2}><div role="gridcell" aria-colspan={colCount}><ActivityDetail activity={a} readOnly={false} onClose={()=>setDetail(null)}/></div></div>:<div role="row" aria-rowindex={item.index+2} aria-level={row.depth+1} aria-expanded={a.editable?undefined:!collapsed.has(a.id)} tabIndex={focused===a.id?0:-1} onFocus={()=>setFocused(a.id)} onKeyDown={(e)=>rowKey(e,a)} data-row-id={a.id} data-wbs={a.wbs} data-parent={!a.editable} data-context={active&&!matches.has(a.id)} data-zero={a.globalWeight===0} data-depth={row.depth} style={{['--row-stagger' as string]:`${item.index<8?item.index*(active?30:20):0}ms`}} className={`nbc-grid-row ${mobile?'nbc-mobile-row':''}`}>
                <span className="nbc-change-flash" aria-hidden="true"/>{mobile?<><div role="gridcell" className="nbc-phone-title">{!a.editable&&<button className="ibtn" aria-label={`${collapsed.has(a.id)?'Expand':'Collapse'} ${a.wbs}`} onClick={()=>toggle(a.id)}><ChevronRight className="nbc-chevron" data-expanded={!collapsed.has(a.id)} size={16}/></button>}<span className="nbc-wbs" title={a.wbs}>{a.wbs}</span><span className="nbc-activity-name" title={a.name}>{a.name}</span><button className="ibtn" aria-label={`Details for ${a.wbs}`} onClick={()=>setDetail(a.id)}><MoreHorizontal size={16}/></button></div><div role="gridcell" className="nbc-phone-progress">{progress}<span className="nbc-delta"><Variance value={d}/></span></div></>:<>
                  <div role="gridcell" className="nbc-sticky-cell nbc-wbs-cell">{!a.editable?<button className="ibtn" aria-label={`${collapsed.has(a.id)?'Expand':'Collapse'} ${a.wbs}`} onClick={()=>toggle(a.id)}><ChevronRight className="nbc-chevron" data-expanded={!collapsed.has(a.id)} size={16}/></button>:<span className="nbc-chevron-space"/>}<span className="nbc-wbs" title={a.wbs}>{a.wbs}</span>{!a.editable&&<LockKeyhole className="nbc-parent-lock" size={12} aria-label="Calculated from child activities" role="img"><title>Calculated from child activities</title></LockKeyhole>}</div>
                  <div role="gridcell" className="nbc-name-cell" style={{paddingInlineStart:`calc(var(--space-12) + ${row.depth} * var(--space-16))`}}><button className="nbc-activity-name" aria-label={`Details for ${a.wbs} ${a.name}`} title={a.name} onClick={()=>setDetail(detail===a.id?null:a.id)}>{a.name}</button>{a.wbs==='GR&P'&&<span className="pill" title="Standalone weighted BOQ entry; its cumulative percentage is editable in an open week.">Standalone</span>}{a.globalWeight===0&&<Info size={14} aria-label="Zero weight: does not contribute to project progress"/>}{issues.length>0&&<Link className="pill nbc-issue-chip" to={`/projects-progress/${a.projectId}/issues?wbs=${encodeURIComponent(a.wbs)}`} aria-label={`${issues.length} open issues for ${a.wbs}`} title={`WBS ${a.wbs} · ${issues[0]?.labels?.[0]||'Inspection'}`}>WBS {a.wbs} · {issues[0]?.labels?.[0]||'Inspection'}</Link>}</div>
                  <div role="gridcell">{handlerPicker(a)}</div>
                  {!tablet&&<><div role="gridcell" className="nbc-numeric">{percent(a.globalWeight,3)}</div><div role="gridcell" className="nbc-numeric muted">{percent(b)}</div></>}
                  <div role="gridcell">{progress}</div><div role="gridcell" className="nbc-numeric nbc-delta"><Variance value={d}/></div>
                  {!tablet&&<><div role="gridcell" className="nbc-row-actions"><button className="ibtn" aria-label={`Remark for ${a.wbs}: ${a.remark||'—'}`} title={a.remark||'Activity details and site remark'} onClick={()=>setDetail(detail===a.id?null:a.id)}><MessageSquare size={14}/></button><button className="ibtn" aria-label={`More actions for ${a.wbs}`} title="Activity details" onClick={()=>setDetail(detail===a.id?null:a.id)}><MoreHorizontal size={14}/></button></div>{optional.map((c)=><div role="gridcell" key={c} className="nbc-optional-value" title={String(optionalValue(a,c))}>{optionalValue(a,c)}</div>)}</>}
                </>}
                {sync.kind!=='saved'&&pendingIds.has(a.id)&&<span className="nbc-row-sync" title={sync.kind==='error'?sync.reason:'Pending sync'}>{sync.kind==='error'?<button className="text-link small" onClick={()=>void syncWorkspace(false)}>Save failed · Retry</button>:<span className="small muted">Pending sync</span>}</span>}
              </div>}
            </div>})}
        </div>
      </div>
      {!rows.length&&<div className="quiet-empty">No activities match these filters.<button className="text-link" onClick={clear}>Clear filters</button></div>}
    </div>
    <BottomSheet initial="large" open={filters} onOpenChange={setFilters} title="BOQ filters"><div className="nbc-sheet-fields">{filterControls}<div className="inline"><button className="btn-secondary" onClick={()=>setCollapsed(new Set())}>Expand all</button><button className="btn-secondary" onClick={()=>setCollapsed(new Set(activities.filter((a)=>!a.editable).map((a)=>a.id)))}>Collapse all</button></div><details><summary>Optional columns (desktop)</summary>{columnControl}</details><button className="btn-accent" onClick={()=>setFilters(false)}>Show activities</button></div></BottomSheet>
    <BottomSheet initial="large" open={mobile&&!!selected} onOpenChange={(open)=>{if(!open)setDetail(null)}} title="Activity details">{selected&&<ActivityDetail activity={selected} readOnly={false}/>}</BottomSheet>
  </section>
}
