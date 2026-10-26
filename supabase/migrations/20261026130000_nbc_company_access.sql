-- One NBC BP03 dataset for every authenticated account, including new signups.
-- Keep the original storage owner and all existing progress/history in place.
do $$ begin
  if (select count(*) from public.kw_projects where data->>'nbcBp03'='true')>1 then
    raise exception 'Multiple NBC projects exist. Review and choose the canonical dataset before sharing; no data was merged or removed';
  end if;
  if exists(select 1 from public.kw_projects shared join public.kw_projects other on other.id=shared.id and other.user_id<>shared.user_id where shared.data->>'nbcBp03'='true') then
    raise exception 'A private project conflicts with the NBC project identifier. Resolve explicitly before sharing';
  end if;
end $$;
create unique index kw_nbc_company_project on public.kw_projects((data->>'nbcBp03')) where data->>'nbcBp03'='true';

-- Only returns the canonical storage identity, never another account's private data.
create function public.kw_nbc_owner() returns uuid language sql stable security definer set search_path='' as $$
  select user_id from public.kw_projects where auth.uid() is not null and data->>'nbcBp03'='true'
$$;
revoke all on function public.kw_nbc_owner() from public,anon;
grant execute on function public.kw_nbc_owner() to authenticated;
create policy nbc_company_read on public.kw_projects for select to authenticated using ((select auth.uid()) is not null and data->>'nbcBp03'='true');

-- The shared project is initialized administratively, never claimed/duplicated by signup.
create function kw_private.nbc_project_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user='authenticated' then
    if tg_op='DELETE' then
      if old.data->>'nbcBp03'='true' then raise exception 'The company NBC project cannot be deleted'; end if;
      return old;
    end if;
    if new.data->>'nbcBp03'='true' and (tg_op='INSERT' or old.data->>'nbcBp03' is distinct from 'true') then raise exception 'NBC initialization requires the administrative setup'; end if;
    if tg_op='UPDATE' and old.data->>'nbcBp03'='true' and new.data is distinct from old.data then raise exception 'Company project metadata is managed administratively'; end if;
    if exists(select 1 from public.kw_projects where data->>'nbcBp03'='true' and id=new.id and user_id<>new.user_id) then raise exception 'Project identifier is reserved for company NBC progress'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger nbc_project_guard before insert or update or delete on public.kw_projects for each row execute function kw_private.nbc_project_guard();
revoke all on function kw_private.nbc_project_guard() from public,anon,authenticated;

-- Everybody reads/updates the same rows; only administrative initialization inserts BOQ nodes.
drop policy own_rows on public.kw_nbc_activities;
revoke insert,delete on public.kw_nbc_activities from authenticated;
create policy nbc_company_read on public.kw_nbc_activities for select to authenticated using(user_id=(select public.kw_nbc_owner()));
create policy nbc_company_update on public.kw_nbc_activities for update to authenticated using(user_id=(select public.kw_nbc_owner())) with check(user_id=(select public.kw_nbc_owner()));
drop policy own_rows on public.kw_nbc_reports;
create policy nbc_company_read on public.kw_nbc_reports for select to authenticated using(user_id=(select public.kw_nbc_owner()));
create policy nbc_company_insert on public.kw_nbc_reports for insert to authenticated with check(user_id=(select public.kw_nbc_owner()));
create policy nbc_company_update on public.kw_nbc_reports for update to authenticated using(user_id=(select public.kw_nbc_owner())) with check(user_id=(select public.kw_nbc_owner()));

-- Personal coordination tasks may reference a shared activity; their own_rows policy is unchanged.
create or replace function kw_private.nbc_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.data->>'nbcActivityId' is not null and not exists(select 1 from public.kw_nbc_activities where user_id=public.kw_nbc_owner() and id=new.data->>'nbcActivityId' and project_id=new.data->>'projectId' and data->>'editable'='true') then raise exception 'WBS activity must belong to this task project'; end if;
  return new;
end $$;

-- Normal workspace writes remain account-private; NBC writes target its canonical storage owner.
create or replace function public.kw_workspace_write(collection text, record_id text, payload jsonb, expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; result jsonb; owner_id uuid := auth.uid(); begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection='profiles' and record_id<>auth.uid()::text then raise exception 'Invalid profile'; end if;
  if collection not in ('pages','projects','tasks','events','profiles','nbc_activities','nbc_reports') or jsonb_typeof(payload)<>'object' or length(payload::text)>2000000 or octet_length(record_id)>2048 then raise exception 'Invalid record'; end if;
  if collection in ('nbc_activities','nbc_reports') then
    owner_id := public.kw_nbc_owner();
    if owner_id is null then raise exception 'Company NBC project is not initialized'; end if;
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text||'nbc-bp03',0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id::text=$2','kw_'||collection) into existing using owner_id,record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then return jsonb_build_object('conflict',true,'row',existing); end if;
  if existing is null and expected is not null then return jsonb_build_object('conflict',true,'row',null); end if;
  if collection='projects' then payload = jsonb_set(payload, '{workspace}', to_jsonb(coalesce(payload->>'workspace','personal'))); end if;
  if payload->>'id' is distinct from record_id then raise exception 'Record ID mismatch'; end if;
  if existing is null then
    execute format('insert into public.%I(id,user_id,data) values(%s,$2,$3) returning to_jsonb(%I.*)','kw_'||collection,case when collection='profiles' then '$1::uuid' else '$1' end,'kw_'||collection) into result using record_id,owner_id,payload;
  else
    execute format('update public.%I set data=$3,updated_at=clock_timestamp() where user_id=$1 and id::text=$2 returning to_jsonb(%I.*)','kw_'||collection,'kw_'||collection) into result using owner_id,record_id,payload;
  end if;
  return jsonb_build_object('conflict',false,'row',result);
end $$;
revoke all on function public.kw_workspace_write(text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.kw_workspace_write(text,text,jsonb,timestamptz) to authenticated;

create or replace function public.kw_nbc_discard_update(record_id text, expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid := public.kw_nbc_owner(); current_row jsonb; prior jsonb; pid text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if owner_id is null then raise exception 'Company NBC project is not initialized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||'nbc-bp03',0));
  select to_jsonb(r) into current_row from public.kw_nbc_reports r where r.user_id=owner_id and r.id=record_id;
  if current_row is null then return jsonb_build_object('conflict',false,'row',null); end if;
  if current_row->'data'->>'status'<>'draft' or (current_row->>'updated_at')::timestamptz is distinct from expected then
    return jsonb_build_object('conflict',true,'row',current_row);
  end if;
  pid := current_row->'data'->>'projectId';
  select data into prior from public.kw_nbc_reports where user_id=owner_id and id=current_row->'data'->>'previousReportId' and project_id=pid and data->>'status'='final';
  update public.kw_nbc_activities a set data=jsonb_set(a.data,'{progress}',coalesce((select e->'progress' from jsonb_array_elements(coalesce(prior->'entries','[]'::jsonb)) e where e->>'id'=a.id),a.data->'baseline'))
  where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true'
    and a.data->'progress' is distinct from coalesce((select e->'progress' from jsonb_array_elements(coalesce(prior->'entries','[]'::jsonb)) e where e->>'id'=a.id),a.data->'baseline');
  delete from public.kw_nbc_reports where user_id=owner_id and id=record_id;
  return jsonb_build_object('conflict',false,'row',null);
end $$;
revoke all on function public.kw_nbc_discard_update(text,timestamptz) from public,anon;
grant execute on function public.kw_nbc_discard_update(text,timestamptz) to authenticated;

create or replace function kw_private.nbc_report_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior jsonb; canonical jsonb; actual numeric; previous numeric; pid text; ending date;
begin
  pid = new.data->>'projectId';
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=new.user_id and id=pid and data->>'nbcBp03'='true' and data->>'workspace'='team') then raise exception 'NBC BP03 Team project required'; end if;
  ending = (new.data->>'date')::date;
  if length(coalesce(new.data->>'note',''))>4000 then raise exception 'Finalization note is too long'; end if;
  if tg_op='INSERT' then new.data=jsonb_set(new.data,'{editor}',to_jsonb(auth.uid())); end if;
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
