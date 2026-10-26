// Disposable PostgreSQL (PGlite). Never connects to Supabase or reads credentials.
// npm install --prefix .private/validation --no-save @electric-sql/pglite@0.5.11
// node scripts/nbc-bp03-db-check.mjs
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(`${process.cwd()}/.private/validation/node_modules/@electric-sql/pglite/dist/index.js`).href)
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users(id uuid primary key);
  insert into auth.users values('${owner}'),('${other}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
  create schema kw_private; revoke all on schema kw_private from public,anon;`)
const initial = await readFile('supabase/migrations/20261019084505_workspace_v1.sql','utf8')
await db.exec(initial.split('insert into storage.buckets')[0])
await db.exec(await readFile('supabase/migrations/20261026085710_nbc_bp03_progress.sql','utf8'))
await db.exec(await readFile('supabase/migrations/20261026110000_nbc_discard_update.sql','utf8'))
const seed = (await readFile('.private/nbc-bp03/initialize.sql','utf8')).replace(/^\\set.*$/gm,'').replaceAll(":'owner_id'", `'${owner}'`)
await db.exec(seed)
const count = async (table) => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n)
assert.equal(await count('kw_nbc_activities'),790)
assert.equal(await count('kw_projects'),1)
const select = async (table, id) => (await db.query(`select * from public.${table} where id=$1`,[id])).rows[0]
const write = async (collection, data, expected = null) => (await db.query('select public.kw_workspace_write($1,$2,$3::jsonb,$4::timestamptz) as result',[collection,data.id,JSON.stringify(data),expected])).rows[0].result
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
const report = {id:'report-1',projectId:'nbc-bp03',date:'2026-10-25',status:'draft',previousReportId:null,correctionOf:null,reason:'',entries:[],overall:0,previous:0,createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',finalizedAt:null,editor:owner}
const leaf = await select('kw_nbc_activities','nbc:1.6.1.1.1')
await assert.rejects(write('nbc_activities',{...leaf.data,progress:0.375},leaf.updated_at),/Start a reporting week/)
await write('nbc_reports',report)
let result = await write('nbc_activities',{...leaf.data,progress:0.375,remark:'Local test',history:[]},leaf.updated_at)
assert.equal(result.conflict,false)
assert.equal(result.row.data.progress,0.375)
assert.equal(result.row.data.history.length,1)
assert.equal(result.row.data.history[0].editor,owner)
// Ordinary Trash deletion uses existing owner RLS and an expected server revision.
await write('tasks',{id:'purge-check',title:'Deleted task',deletedAt:'2026-10-25T00:00:00Z'})
const purge = await select('kw_tasks','purge-check')
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query("delete from public.kw_tasks where id='purge-check' returning id")).rows.length,0)
await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`)
assert.equal((await db.query("delete from public.kw_tasks where id='purge-check' and updated_at='2000-01-01' returning id")).rows.length,0)
assert.equal((await db.query("delete from public.kw_tasks where id='purge-check' and updated_at=$1 returning id",[purge.updated_at])).rows.length,1)
const task = {id:'site-action',title:'Site inspection',projectId:'nbc-bp03',nbcActivityId:leaf.id}
assert.equal((await write('tasks',task)).conflict,false)
await assert.rejects(write('tasks',{...task,id:'invalid-link',nbcActivityId:'missing'}),/must belong/)
assert.equal((await write('nbc_activities',{...leaf.data,progress:0.9},leaf.updated_at)).conflict,true)
await assert.rejects(write('nbc_activities',{...result.row.data,progress:1.01},result.row.updated_at))
await assert.rejects(write('nbc_activities',{...result.row.data,globalWeight:0.7},result.row.updated_at),/immutable/)
const parent = await select('kw_nbc_activities','nbc:1.6.1')
await assert.rejects(write('nbc_activities',{...parent.data,progress:1},parent.updated_at),/calculated/)
await db.exec('reset role')
await db.exec(seed)
assert.equal(await count('kw_projects'),1)
assert.equal(await count('kw_nbc_activities'),790)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.375)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.remark,'Local test')
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
let queued = await select('kw_nbc_activities',leaf.id)
const pendingHistory = [...queued.data.history,
  {id:'offline-one',at:'2026-10-25T01:00:00Z',editor:other,previous:0.375,progress:0.5,handler:queued.data.handler,remark:'Offline step one'},
  {id:'offline-two',at:'2026-10-25T02:00:00Z',editor:other,previous:0.5,progress:0.375,handler:queued.data.handler,remark:'Offline step two'}]
queued = (await write('nbc_activities',{...queued.data,progress:0.375,remark:'Offline step two',history:pendingHistory},queued.updated_at)).row
assert.equal(queued.data.history.length,3)
assert.equal(queued.data.history[2].editor,owner)
assert.equal(queued.data.history[1].progress,0.5)
const rows = (await db.query('select data from public.kw_nbc_activities')).rows.map((r)=>r.data)
const entries = rows.filter((a)=>a.editable).sort((a,b)=>a.order-b.order).map((a)=>({ id:a.id,wbs:a.wbs,name:a.name,area:a.area,location:a.location,trade:a.trade,handler:a.handler,previous:a.baseline,progress:a.progress,difference:a.progress-a.baseline,weight:a.globalWeight,remark:a.remark,updatedAt:a.updatedAt??null }))
const draft = (await write('nbc_reports',report)).row
await assert.rejects(write('nbc_reports',{...report,id:'duplicate'}),/duplicate key/)
const final = (await write('nbc_reports',{...draft.data,status:'final',entries},draft.updated_at)).row
assert.equal(final.data.entries.length,562)
assert.equal(final.data.editor,owner)
assert.ok(Math.abs(final.data.overall-entries.reduce((s,e)=>s+e.progress*e.weight,0))<1e-12)
await assert.rejects(write('nbc_reports',{...final.data,reason:'Silent overwrite'},final.updated_at),/immutable/)
await assert.rejects(db.exec("delete from public.kw_nbc_reports where id='report-1'"),/permission denied/)
const correction = {...report,id:'report-2',date:'2026-11-01',previousReportId:'report-1',correctionOf:'report-1',reason:'Audited correction'}
const next = (await write('nbc_reports',correction)).row
let current = await select('kw_nbc_activities',leaf.id)
current = (await write('nbc_activities',{...current.data,progress:0.25},current.updated_at)).row
const corrected = entries.map((e)=>({...e,previous:e.progress,progress:e.id===leaf.id?0.25:e.progress,difference:e.id===leaf.id?0.25-e.progress:0}))
await assert.rejects(write('nbc_reports',{...next.data,status:'final',entries},next.updated_at),/changed/)
const second = (await write('nbc_reports',{...next.data,status:'final',entries:corrected},next.updated_at)).row
assert.equal(second.data.entries.find((e)=>e.id===leaf.id).difference,-0.125)
await assert.rejects(write('nbc_activities',{...current.data,progress:0.1},current.updated_at),/Start a reporting week/)
assert.equal((await select('kw_nbc_reports','report-1')).data.entries.find((e)=>e.id===leaf.id).progress,0.375)
// Another owner cannot select or update any NBC data or attach rows to this project.
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select * from public.kw_nbc_activities')).rows.length,0)
assert.equal((await db.query('select * from public.kw_nbc_reports')).rows.length,0)
assert.equal((await db.query("update public.kw_nbc_activities set data=data where id=$1 returning id",[leaf.id])).rows.length,0)
await assert.rejects(write('nbc_activities',leaf.data),/Team project required/)
await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)")
await assert.rejects(db.exec('select * from public.kw_nbc_activities'),/permission denied/)
await assert.rejects(write('nbc_reports',report),/permission denied/)
await db.exec('reset role')
// Reuse a matching existing project and preserve its ordinary task data.
const reused = seed.replaceAll(owner,other)
await db.query('insert into public.kw_projects(id,user_id,data) values($1,$2,$3::jsonb)',['existing-nbc',other,JSON.stringify({id:'existing-nbc',name:'NBC BP03 Existing',workspace:'team',color:'blue'})])
await assert.rejects(db.exec(reused),/already initialized under another storage owner/)
await db.exec('rollback')
assert.equal(await count('kw_projects'),2)
assert.equal((await db.query('select * from public.kw_nbc_activities where user_id=$1',[other])).rows.length,0)
// Discard is atomic, owner scoped, revision guarded and cannot remove final snapshots.
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
const discard = async(id,expected) => (await db.query('select public.kw_nbc_discard_update($1,$2::timestamptz) as result',[id,expected])).rows[0].result
const finalReport = (await db.query("select * from public.kw_nbc_reports where user_id=$1 and data->>'status'='final' order by data->>'date' desc limit 1",[owner])).rows[0]
assert.equal((await discard(finalReport.id,finalReport.updated_at)).conflict,true)
const discardReport = {...report,id:'discard-me',date:'2026-12-01',previousReportId:finalReport.id}
await write('nbc_reports',discardReport)
const beforeDiscard = await select('kw_nbc_activities',leaf.id)
await write('nbc_activities',{...beforeDiscard.data,progress:0.987654},beforeDiscard.updated_at)
const draftDiscard = await select('kw_nbc_reports','discard-me')
assert.equal((await discard('discard-me','2000-01-01')).conflict,true)
await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await discard('discard-me',draftDiscard.updated_at)).conflict,false)
await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.987654)
assert.equal((await discard('discard-me',draftDiscard.updated_at)).conflict,false)
assert.equal(await select('kw_nbc_reports','discard-me'),undefined)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,finalReport.data.entries.find((e)=>e.id===leaf.id).progress)
assert.equal((await discard('discard-me',draftDiscard.updated_at)).conflict,false)
await db.exec("reset role; set role anon")
await assert.rejects(discard('discard-me',null),/permission denied/)
await db.exec('reset role')
// The sharing migration never silently merges two independent NBC datasets.
const companyMigration=await readFile('supabase/migrations/20261026130000_nbc_company_access.sql','utf8')
await db.exec('begin')
await db.query("update public.kw_projects set data=data||jsonb_build_object('nbcBp03',true) where user_id=$1",[other])
await assert.rejects(db.exec(companyMigration),/Multiple NBC projects/)
await db.exec('rollback')
await db.exec(companyMigration)
const newcomer='33333333-3333-4333-8333-333333333333'
await db.query('insert into auth.users values($1)',[newcomer])
for(const table of ['pages','tasks','events']) await db.query(`insert into public.kw_${table}(id,user_id,data) values($1,$2,$3::jsonb)`,['private-a',owner,JSON.stringify({id:'private-a',title:'Private A'})])
await db.query('insert into public.kw_projects(id,user_id,data) values($1,$2,$3::jsonb)',['private-a',owner,JSON.stringify({id:'private-a',name:'Private A',workspace:'personal'})])
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${other}',false)`)
assert.equal((await db.query('select public.kw_nbc_owner() as owner')).rows[0].owner,owner)
assert.equal((await db.query('select * from public.kw_nbc_activities')).rows.length,790)
assert.equal((await db.query("select * from public.kw_projects where data->>'nbcBp03'='true'")).rows.length,1)
for(const table of ['pages','tasks','events','projects']) assert.equal((await db.query(`select * from public.kw_${table} where id='private-a'`)).rows.length,0)
await assert.rejects(write('projects',{id:'evil-nbc',name:'Copy',workspace:'team',nbcBp03:true}),/administrative setup/)
await assert.rejects(write('projects',{id:'nbc-bp03',name:'Private duplicate',workspace:'personal'}),/reserved/)
await assert.rejects(db.query('insert into public.kw_nbc_activities(id,user_id,data) values($1,$2,$3::jsonb)',['injected',owner,JSON.stringify({...leaf.data,id:'injected'})]),/permission denied/)
const latestFinal=(await db.query("select * from public.kw_nbc_reports where data->>'status'='final' order by data->>'date' desc limit 1")).rows[0]
const sharedDraft=(await write('nbc_reports',{...report,id:'shared-draft',date:'2026-12-08',previousReportId:latestFinal.id,editor:owner})).row
assert.equal(sharedDraft.user_id,owner)
assert.equal(sharedDraft.data.editor,other)
const sharedBefore=await select('kw_nbc_activities',leaf.id)
const sharedEdited=(await write('nbc_activities',{...sharedBefore.data,progress:0.777},sharedBefore.updated_at)).row
assert.equal(sharedEdited.user_id,owner)
assert.equal(sharedEdited.data.history.at(-1).editor,other)
assert.equal((await write('nbc_activities',{...sharedBefore.data,progress:0.111},sharedBefore.updated_at)).conflict,true)
await assert.rejects(write('nbc_activities',{...sharedEdited.data,globalWeight:0.001},sharedEdited.updated_at),/immutable/)
await write('tasks',{id:'personal-action-b',title:'My action',projectId:'nbc-bp03',nbcActivityId:leaf.id})
assert.equal((await select('kw_tasks','personal-action-b')).user_id,other)
// A user created after setup automatically receives the same data and can finalize/discard.
await db.exec(`select set_config('request.jwt.claim.sub','${newcomer}',false)`)
assert.equal((await db.query('select * from public.kw_nbc_activities')).rows.length,790)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.777)
assert.equal(await select('kw_tasks','personal-action-b'),undefined)
await assert.rejects(write('nbc_reports',{...sharedDraft.data,id:'second-open',date:'2026-12-09'}),/duplicate key/)
const sharedActivities=(await db.query('select data from public.kw_nbc_activities')).rows.map((r)=>r.data)
const previousValues=new Map(latestFinal.data.entries.map((e)=>[e.id,e.progress]))
const sharedEntries=sharedActivities.filter((a)=>a.editable).sort((a,b)=>a.order-b.order).map((a)=>({id:a.id,wbs:a.wbs,name:a.name,area:a.area,location:a.location,trade:a.trade,handler:a.handler,previous:previousValues.get(a.id)??a.baseline,progress:a.progress,difference:a.progress-(previousValues.get(a.id)??a.baseline),weight:a.globalWeight,remark:a.remark,updatedAt:a.updatedAt??null}))
const sharedFinal=(await write('nbc_reports',{...sharedDraft.data,status:'final',entries:sharedEntries},sharedDraft.updated_at)).row
assert.equal(sharedFinal.data.editor,newcomer)
assert.equal((await discard(sharedFinal.id,sharedFinal.updated_at)).conflict,true)
const undoDraft=(await write('nbc_reports',{...report,id:'shared-undo',date:'2026-12-15',previousReportId:sharedFinal.id})).row
const beforeUndo=await select('kw_nbc_activities',leaf.id)
await write('nbc_activities',{...beforeUndo.data,progress:0.333},beforeUndo.updated_at)
assert.equal((await discard(undoDraft.id,undoDraft.updated_at)).conflict,false)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.777)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.history.at(-1).editor,newcomer)
await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.777)
assert.equal(await select('kw_tasks','personal-action-b'),undefined)
await assert.rejects(write('projects',{id:'nbc-bp03',name:'Hide shared',workspace:'personal',nbcBp03:false},(await select('kw_projects','nbc-bp03')).updated_at),/metadata is managed/)
await assert.rejects(db.exec("delete from public.kw_projects where id='nbc-bp03'"),/cannot be deleted/)
await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)")
for(const table of ['kw_nbc_activities','kw_nbc_reports','kw_projects']) await assert.rejects(db.exec(`select * from public.${table}`),/permission denied/)
await assert.rejects(db.exec('select public.kw_nbc_owner()'),/permission denied/)
await assert.rejects(discard(sharedFinal.id,sharedFinal.updated_at),/permission denied/)
await db.exec('reset role')
await db.exec(seed)
assert.equal((await select('kw_nbc_activities',leaf.id)).data.progress,0.777)
assert.equal((await db.query("select * from public.kw_projects where data->>'nbcBp03'='true'")).rows.length,1)
await db.close()
console.log('NBC migrations/seed, shared access for existing/new users, shared CAS/finalize/discard/audit, private workspace isolation and anonymous denial: passed (disposable PostgreSQL).')
