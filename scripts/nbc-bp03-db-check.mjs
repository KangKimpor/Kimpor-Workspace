// Disposable PostgreSQL only; never reads credentials or connects to production.
// npm install --prefix .private/validation --no-save @electric-sql/pglite@0.5.11
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(`${process.cwd()}/.private/validation/node_modules/@electric-sql/pglite/dist/index.js`).href)
const db = new PGlite(), owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
  insert into auth.users values('${owner}'),('${other}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
  create schema kw_private; revoke all on schema kw_private from public,anon;`)
await db.exec((await readFile('supabase/migrations/20261019084505_workspace_v1.sql','utf8')).split('insert into storage.buckets')[0])
for (const name of ['20261026085710_nbc_bp03_progress.sql','20261026110000_nbc_discard_update.sql']) await db.exec(await readFile(`supabase/migrations/${name}`,'utf8'))
await db.query('insert into public.kw_projects(id,user_id,data) values($1,$2,$3)', ['nbc-bp03',owner,JSON.stringify({id:'nbc-bp03',name:'Synthetic NBC',workspace:'team',nbcBp03:true})])
const activity = (id,handler,weight,progress,wbs=id) => ({id,projectId:'nbc-bp03',wbs,parentId:null,order:1,name:id,description:'Synthetic',area:'Test',location:'GF',trade:'Test',editable:true,relativeWeight:weight,globalWeight:weight,progress,baseline:progress,sourcePrevious:0,sourceWeekly:0,duration:1,boqValue:null,schedule:null,handler,remark:'',history:[]})
for (const a of [activity('tola','Tola',.6,.25),activity('sitha','Sitha',.2,1),activity('shared','',.2,0,'GR&P')]) await db.query('insert into public.kw_nbc_activities(id,user_id,data) values($1,$2,$3)',[a.id,owner,JSON.stringify(a)])
const current = (await db.query("select date_trunc('week',clock_timestamp() at time zone 'Asia/Phnom_Penh')::date::text as week")).rows[0].week
const add = (week,days) => new Date(Date.parse(week)+days*86400000).toISOString().slice(0,10)
const last = add(current,-7), frozen = add(current,-21)
await db.exec('alter table public.kw_nbc_reports disable trigger nbc_report_guard')
for (const week of [frozen,last]) {
  const entries = (await db.query('select data from public.kw_nbc_activities')).rows.map(({data:a}) => ({id:a.id,wbs:a.wbs,name:a.name,area:a.area,location:a.location,trade:a.trade,handler:a.handler,previous:a.progress,progress:a.progress,difference:0,weight:a.globalWeight,remark:'',updatedAt:null}))
  const r={id:`legacy-${week}`,projectId:'nbc-bp03',date:add(week,6),status:'final',entries,overall:.35,previous:.35,previousReportId:null,correctionOf:null,reason:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),finalizedAt:new Date().toISOString(),editor:owner}
  await db.query('insert into public.kw_nbc_reports(id,user_id,data) values($1,$2,$3)',[r.id,owner,JSON.stringify(r)])
}
await db.exec('alter table public.kw_nbc_reports enable trigger nbc_report_guard')
for (const name of ['20261026130000_nbc_company_access.sql','20261026160634_nbc_handler_weekly_confirmations.sql',...(await readdir('supabase/migrations')).filter((s)=>s.endsWith('_nbc_handler_submissions.sql'))]) await db.exec(await readFile(`supabase/migrations/${name}`,'utf8'))
const select = async (table,id) => (await db.query(`select * from public.${table} where id=$1`,[id])).rows[0]
const progress = async(id='tola') => (await select('kw_nbc_activities',id)).data.progress
const id=(week,h='Tola')=>`nbc-bp03:${week}:${h}`
const row=(week,h='Tola')=>select('kw_nbc_submissions',id(week,h))
const call=async(operation,week,h='Tola',entries,expected) => {
  const saved=await row(week,h)
  return (await db.query('select public.kw_nbc_submission_write($1,$2::jsonb,$3::timestamptz) as result',[operation,JSON.stringify({projectId:'nbc-bp03',weekStart:week,handler:h,entries,note:'Synthetic'}),expected===undefined?saved?.updated_at??null:expected])).rows[0].result
}
const entry=(value,activityId='tola',baseRevision)=>({activityId,previous:.25,progress:value,remark:'Test',baseRevision})
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select count(*)::int as n from public.kw_nbc_submissions')).rows[0].n,12)
assert.equal((await db.query('select count(*)::int as n from public.kw_nbc_reports')).rows[0].n,2)
const oldSummary=JSON.stringify((await select('kw_nbc_summaries',`nbc-bp03:${frozen}`)).data)
for(const op of ['save','confirm','delete','reopen','undo']) await assert.rejects(call(op,frozen,'Tola',[entry(.8)]),/Only this week/)
await assert.rejects(call('save',current,'Sitha',[entry(.9)]),/only your activities/)
await assert.rejects(call('save',current,'Tola',[entry(1.1)]),/Invalid progress/)
await call('save',current,'Tola',[entry(.5)])
assert.equal(await progress(),.25,'autosave cannot change live progress')
await call('confirm',current)
assert.equal(await progress(),.5)
assert.equal((await row(current)).data.confirmedBy,other)
assert.equal((await row(current)).data.late,false)
assert.equal((await select('kw_nbc_activities','tola')).data.history.at(-1).editor,other)
assert.ok(Math.abs((await select('kw_nbc_summaries',`nbc-bp03:${current}`)).data.overall-.5)<1e-12)
await call('undo',current)
assert.equal(await progress(),.25)
assert.equal((await row(current)).data.entries[0].progress,.5)
await call('confirm',current)
await call('reopen',last)
await call('save',last,'Tola',[entry(.4)])
await call('confirm',last)
assert.equal((await row(last)).data.late,true)
assert.equal((await row(current)).data.entries[0].previous,.4)
assert.equal(await progress(),.5)
await call('delete',last)
assert.equal((await row(current)).data.entries[0].previous,.25)
await call('delete',current)
assert.equal(await progress(),.25)
assert.equal(JSON.stringify((await select('kw_nbc_summaries',`nbc-bp03:${frozen}`)).data),oldSummary)
const revision=(await select('kw_nbc_activities','shared')).data.updatedAt
await call('save',current,'Sitha',[entry(1,'sitha'),entry(.2,'shared',revision)])
await call('save',current,'Tola',[entry(.3),entry(.4,'shared',revision)])
await call('confirm',current,'Sitha')
await assert.rejects(call('confirm',current,'Tola'),/GR&P changed/)
await call('delete',current,'Sitha')
assert.equal(await progress('shared'),0)
assert.equal((await call('save',current,'Tola',[entry(.6)],'2000-01-01')).conflict,true)
await assert.rejects(db.exec("update public.kw_nbc_activities set data=jsonb_set(data,'{progress}','0.8') where id='tola'"),/handler draft/)
await assert.rejects(db.exec('delete from public.kw_nbc_submissions'),/permission denied/)
await assert.rejects(db.exec('update public.kw_nbc_summaries set data=data'),/permission denied/)
await assert.rejects(db.exec('update public.kw_nbc_reports set data=data'),/permission denied/)
await db.exec("select set_config('request.jwt.claim.sub','',false)")
await assert.rejects(call('confirm',current),/Authentication/)
await db.exec('reset role; set role anon')
await assert.rejects(db.exec('select * from public.kw_nbc_submissions'),/permission denied/)
await db.close()
console.log('NBC migration, preservation, autosave, confirm/edit/delete/undo, re-chaining, GR&P, summaries, CAS and access checks passed.')
