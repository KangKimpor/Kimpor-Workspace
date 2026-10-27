import { useState } from 'react'
import { X } from 'lucide-react'
import { useWorkspace } from '@/data'
import { money, percent } from '../format'
import type { NbcActivity } from '../types'

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
