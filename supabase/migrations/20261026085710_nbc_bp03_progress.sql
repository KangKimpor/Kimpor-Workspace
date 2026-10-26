-- NBC BP03 only. Uses the workspace's owner-scoped JSON row and CAS conventions.
create table public.kw_nbc_activities (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id text generated always as (data->>'projectId') stored not null,
  parent_id text generated always as (data->>'parentId') stored,
  wbs text generated always as (data->>'wbs') stored not null,
  primary key (user_id,id),
  unique (user_id,project_id,wbs),
  foreign key (user_id,project_id) references public.kw_projects(user_id,id),
  foreign key (user_id,parent_id) references public.kw_nbc_activities(user_id,id) deferrable initially deferred,
  check (jsonb_typeof(data)='object' and data->>'id'=id),
  check (data ?& array['progress','baseline','relativeWeight','globalWeight','editable','history','handler','remark','projectId','wbs','parentId','order','name','area','trade','location']),
  check (jsonb_typeof(data->'progress')='number' and (data->>'progress')::numeric between 0 and 1),
  check (jsonb_typeof(data->'baseline')='number' and (data->>'baseline')::numeric between 0 and 1),
  check (jsonb_typeof(data->'relativeWeight')='number' and (data->>'relativeWeight')::numeric >= 0),
  check (jsonb_typeof(data->'globalWeight')='number' and (data->>'globalWeight')::numeric between 0 and 1),
  check (jsonb_typeof(data->'editable')='boolean'),
  check (jsonb_typeof(data->'history')='array'),
  check (jsonb_typeof(data->'handler')='string' and jsonb_typeof(data->'remark')='string' and jsonb_typeof(data->'name')='string'),
  check (length(data->>'remark') <= 4000 and length(data->>'handler') <= 100)
);
create table public.kw_nbc_reports (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id text generated always as (data->>'projectId') stored not null,
  primary key (user_id,id),
  foreign key (user_id,project_id) references public.kw_projects(user_id,id),
  check (jsonb_typeof(data)='object' and data->>'id'=id),
  check (data ?& array['status','entries','date','projectId','previousReportId','correctionOf','reason']),
  check (data->>'status' in ('draft','final')),
  check (jsonb_typeof(data->'entries')='array'),
  check (data->>'date' ~ '^\d{4}-\d{2}-\d{2}$')
);
create unique index kw_nbc_one_project on public.kw_projects(user_id) where data->>'nbcBp03'='true';
create unique index kw_nbc_reporting_date on public.kw_nbc_reports(user_id,project_id,(data->>'date'));
create unique index kw_nbc_open_period on public.kw_nbc_reports(user_id,project_id) where data->>'status'='draft';
create index on public.kw_nbc_activities(user_id,project_id);
create index on public.kw_nbc_reports(user_id,project_id);

do $$ declare t text; begin
  foreach t in array array['kw_nbc_activities','kw_nbc_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
    if exists(select 1 from pg_publication where pubname='supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

create function kw_private.nbc_activity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare proposed jsonb; audit jsonb; event jsonb; running numeric; added integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=new.user_id and id=new.data->>'projectId' and data->>'nbcBp03'='true' and data->>'workspace'='team') then
    raise exception 'NBC BP03 Team project required';
  end if;
  if tg_op='UPDATE' then
    if new.id<>old.id or new.user_id<>old.user_id or
       (new.data - array['progress','handler','remark','history','updatedAt']) is distinct from (old.data - array['progress','handler','remark','history','updatedAt']) then
      raise exception 'BOQ structure and baseline are immutable';
    end if;
    if old.data->>'editable'<>'true' then raise exception 'Parent activities are calculated'; end if;
    if new.data->'progress' is distinct from old.data->'progress' and not exists(select 1 from public.kw_nbc_reports where user_id=new.user_id and project_id=new.data->>'projectId' and data->>'status'='draft') then raise exception 'Start a reporting week to update progress'; end if;
    proposed = new.data->'history'; audit = old.data->'history'; running = (old.data->>'progress')::numeric;
    -- Stable event IDs preserve every queued offline edit, even when row writes coalesce.
    for event in select value from jsonb_array_elements(proposed) loop
      if event->>'id' is not null and not exists(select 1 from jsonb_array_elements(audit) e where e->>'id'=event->>'id') then
        if jsonb_typeof(event->'progress') is distinct from 'number' or (event->>'progress')::numeric not between 0 and 1 or
          jsonb_typeof(event->'previous') is distinct from 'number' or abs((event->>'previous')::numeric-running)>1e-12 or
          jsonb_typeof(event->'handler') is distinct from 'string' or jsonb_typeof(event->'remark') is distinct from 'string' or
          length(event->>'handler')>100 or length(event->>'remark')>4000 or jsonb_typeof(event->'at') is distinct from 'string' then raise exception 'Invalid progress history'; end if;
        perform (event->>'at')::timestamptz;
        running = (event->>'progress')::numeric;
        audit = audit || jsonb_build_array(event || jsonb_build_object('editor',auth.uid(),'recordedAt',clock_timestamp()));
        added = added + 1;
      end if;
    end loop;
    if added>0 then
      if abs(running-(new.data->>'progress')::numeric)>1e-12 or (audit->-1->'handler',audit->-1->'remark') is distinct from (new.data->'handler',new.data->'remark') then raise exception 'History must match current activity'; end if;
    elsif (new.data->'progress',new.data->'handler',new.data->'remark') is distinct from (old.data->'progress',old.data->'handler',old.data->'remark') then
      audit = audit || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'at',clock_timestamp(),'recordedAt',clock_timestamp(),'editor',auth.uid(),'previous',old.data->'progress','progress',new.data->'progress','handler',new.data->'handler','remark',new.data->'remark'));
    end if;
    new.data = jsonb_set(new.data,'{history}',audit);
  end if;
  new.updated_at = clock_timestamp();
  new.data = jsonb_set(new.data,'{updatedAt}',to_jsonb(new.updated_at));
  return new;
end $$;
create trigger nbc_activity_guard before insert or update on public.kw_nbc_activities for each row execute function kw_private.nbc_activity_guard();

create function kw_private.nbc_task_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.data->>'nbcActivityId' is not null and not exists(select 1 from public.kw_nbc_activities where user_id=new.user_id and id=new.data->>'nbcActivityId' and project_id=new.data->>'projectId' and data->>'editable'='true') then raise exception 'WBS activity must belong to this task project'; end if;
  return new;
end $$;
create trigger nbc_task_guard before insert or update on public.kw_tasks for each row execute function kw_private.nbc_task_guard();
revoke all on function kw_private.nbc_task_guard() from public,anon,authenticated;

create function kw_private.nbc_report_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior jsonb; canonical jsonb; actual numeric; previous numeric; pid text; ending date;
begin
  pid = new.data->>'projectId';
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=new.user_id and id=pid and data->>'nbcBp03'='true' and data->>'workspace'='team') then raise exception 'NBC BP03 Team project required'; end if;
  ending = (new.data->>'date')::date;
  if length(coalesce(new.data->>'note',''))>4000 then raise exception 'Finalization note is too long'; end if;
  if tg_op='UPDATE' then
    if old.data->>'status'='final' then raise exception 'Finalized reports are immutable; create a dated correction'; end if;
    if new.id<>old.id or new.user_id<>old.user_id or (new.data - array['status','entries','overall','updatedAt','finalizedAt','editor','note']) is distinct from (old.data - array['status','entries','overall','updatedAt','finalizedAt','editor','note']) then raise exception 'Reporting period metadata is immutable'; end if;
  end if;
  select data into prior from public.kw_nbc_reports where user_id=new.user_id and project_id=pid and data->>'status'='final' and id<>new.id order by data->>'date' desc limit 1;
  if (new.data->>'previousReportId') is distinct from (prior->>'id') then raise exception 'Previous finalized report changed'; end if;
  if prior is not null and ending <= (prior->>'date')::date then raise exception 'Report must follow latest finalized date'; end if;
  if new.data->>'correctionOf' is not null and (length(trim(coalesce(new.data->>'reason','')))=0 or not exists(select 1 from public.kw_nbc_reports where user_id=new.user_id and project_id=pid and id=new.data->>'correctionOf' and data->>'status'='final')) then raise exception 'Correction requires a finalized report and reason'; end if;
  if new.data->>'status'='final' then
    select jsonb_agg(jsonb_build_object(
      'id',a.id,'wbs',a.wbs,'name',a.data->>'name','area',a.data->>'area','location',a.data->>'location','trade',a.data->>'trade',
      'handler',a.data->>'handler','previous',coalesce(p.value->'progress',a.data->'baseline'),
      'progress',a.data->'progress','difference',(a.data->>'progress')::numeric-coalesce((p.value->>'progress')::numeric,(a.data->>'baseline')::numeric),
      'weight',a.data->'globalWeight','remark',a.data->>'remark','updatedAt',a.updated_at
    ) order by (a.data->>'order')::integer),
    sum((a.data->>'globalWeight')::numeric*(a.data->>'progress')::numeric),
    sum((a.data->>'globalWeight')::numeric*coalesce((p.value->>'progress')::numeric,(a.data->>'baseline')::numeric))
    into canonical,actual,previous
    from public.kw_nbc_activities a left join lateral (select value from jsonb_array_elements(coalesce(prior->'entries','[]')) where value->>'id'=a.id) p on true
    where a.user_id=new.user_id and a.project_id=pid and a.data->>'editable'='true';
    if canonical is null then raise exception 'BOQ not initialized'; end if;
    if jsonb_array_length(new.data->'entries')<>jsonb_array_length(canonical) or
      (select count(distinct e->>'id') from jsonb_array_elements(new.data->'entries') e)<>jsonb_array_length(canonical) or
      exists(select 1 from jsonb_array_elements(canonical) c left join jsonb_array_elements(new.data->'entries') e on e->>'id'=c->>'id'
        where e is null or abs((e->>'progress')::numeric-(c->>'progress')::numeric)>1e-12 or abs((e->>'previous')::numeric-(c->>'previous')::numeric)>1e-12 or abs((e->>'weight')::numeric-(c->>'weight')::numeric)>1e-12 or
        (e - array['progress','previous','difference','weight','updatedAt']) is distinct from (c - array['progress','previous','difference','weight','updatedAt'])) then
      raise exception 'Activity data changed; sync and review before finalizing';
    end if;
    new.data = new.data || jsonb_build_object('entries',canonical,'overall',actual,'previous',previous,'finalizedAt',clock_timestamp(),'editor',auth.uid());
  elsif new.data->>'status'='draft' then
    if new.data->'entries'<>'[]'::jsonb then raise exception 'Draft snapshots must be empty'; end if;
  else raise exception 'Invalid report status';
  end if;
  new.updated_at = clock_timestamp();
  new.data = jsonb_set(new.data,'{updatedAt}',to_jsonb(new.updated_at));
  return new;
end $$;
create trigger nbc_report_guard before insert or update on public.kw_nbc_reports for each row execute function kw_private.nbc_report_guard();
revoke all on function kw_private.nbc_activity_guard(),kw_private.nbc_report_guard() from public,anon,authenticated;

-- Preserve the existing CAS RPC; extend only its collection allow-list.
create or replace function public.kw_workspace_write(collection text, record_id text, payload jsonb, expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; result jsonb; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection='profiles' and record_id<>auth.uid()::text then raise exception 'Invalid profile'; end if;
  if collection not in ('pages','projects','tasks','events','profiles','nbc_activities','nbc_reports') or jsonb_typeof(payload)<>'object' or length(payload::text)>2000000 or octet_length(record_id)>2048 then raise exception 'Invalid record'; end if;
  if collection in ('nbc_activities','nbc_reports') then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'nbc-bp03',0)); end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id::text=$2','kw_'||collection) into existing using auth.uid(),record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then return jsonb_build_object('conflict',true,'row',existing); end if;
  if existing is null and expected is not null then return jsonb_build_object('conflict',true,'row',null); end if;
  if collection='projects' then payload = jsonb_set(payload, '{workspace}', to_jsonb(coalesce(payload->>'workspace','personal'))); end if;
  if payload->>'id' is distinct from record_id then raise exception 'Record ID mismatch'; end if;
  if existing is null then
    execute format('insert into public.%I(id,user_id,data) values(%s,$2,$3) returning to_jsonb(%I.*)','kw_'||collection,case when collection='profiles' then '$1::uuid' else '$1' end,'kw_'||collection) into result using record_id,auth.uid(),payload;
  else
    execute format('update public.%I set data=$3,updated_at=clock_timestamp() where user_id=$1 and id::text=$2 returning to_jsonb(%I.*)','kw_'||collection,'kw_'||collection) into result using auth.uid(),record_id,payload;
  end if;
  return jsonb_build_object('conflict',false,'row',result);
end $$;
revoke all on function public.kw_workspace_write(text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.kw_workspace_write(text,text,jsonb,timestamptz) to authenticated;
