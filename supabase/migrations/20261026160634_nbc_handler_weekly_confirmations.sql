-- Keep the existing report, snapshot and RLS protections; permit six independent confirmation fields.
create or replace function kw_private.nbc_report_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior jsonb; canonical jsonb; actual numeric; previous numeric; pid text; ending date; handler text; field text; confirmation jsonb; assigned_count integer; changed_count integer;
begin
  pid = new.data->>'projectId';
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||'nbc-bp03',0));
  if not exists(select 1 from public.kw_projects where user_id=new.user_id and id=pid and data->>'nbcBp03'='true' and data->>'workspace'='team') then raise exception 'NBC BP03 Team project required'; end if;
  ending = (new.data->>'date')::date;
  if length(coalesce(new.data->>'note',''))>4000 then raise exception 'Finalization note is too long'; end if;
  if tg_op='INSERT' then new.data=jsonb_set(new.data,'{editor}',to_jsonb(auth.uid())); end if;
  if tg_op='UPDATE' then
    if old.data->>'status'='final' then raise exception 'Finalized reports are immutable; create a dated correction'; end if;
    if new.id<>old.id or new.user_id<>old.user_id or (new.data - array['status','entries','overall','updatedAt','finalizedAt','editor','note','handlerUpdateSitha','handlerUpdateLychhinh','handlerUpdateChhorvaon','handlerUpdateSrun','handlerUpdateKheng','handlerUpdateTola']) is distinct from (old.data - array['status','entries','overall','updatedAt','finalizedAt','editor','note','handlerUpdateSitha','handlerUpdateLychhinh','handlerUpdateChhorvaon','handlerUpdateSrun','handlerUpdateKheng','handlerUpdateTola']) then raise exception 'Reporting period metadata is immutable'; end if;
  end if;
  select data into prior from public.kw_nbc_reports where user_id=new.user_id and project_id=pid and data->>'status'='final' and id<>new.id order by data->>'date' desc limit 1;
  if (new.data->>'previousReportId') is distinct from (prior->>'id') then raise exception 'Previous finalized report changed'; end if;
  if prior is not null and ending <= (prior->>'date')::date then raise exception 'Report must follow latest finalized date'; end if;
  if new.data->>'correctionOf' is not null and (length(trim(coalesce(new.data->>'reason','')))=0 or not exists(select 1 from public.kw_nbc_reports where user_id=new.user_id and project_id=pid and id=new.data->>'correctionOf' and data->>'status'='final')) then raise exception 'Correction requires a finalized report and reason'; end if;
  if new.data ? 'startedBy' and (jsonb_typeof(new.data->'startedBy') is distinct from 'string' or new.data->>'startedBy' not in ('Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola')) then raise exception 'Choose a valid handler'; end if;
  if exists(select 1 from jsonb_object_keys(new.data) k where k like 'handlerUpdate%' and k not in ('handlerUpdateSitha','handlerUpdateLychhinh','handlerUpdateChhorvaon','handlerUpdateSrun','handlerUpdateKheng','handlerUpdateTola')) then raise exception 'Unknown handler confirmation'; end if;
  foreach handler in array array['Sitha','Lychhinh','Chhorvaon','Srun','Kheng','Tola'] loop
    field = 'handlerUpdate'||handler;
    if tg_op='UPDATE' and old.data ? field and not (new.data ? field) then raise exception 'Handler confirmations cannot be removed'; end if;
    if new.data ? field and (tg_op='INSERT' or new.data->field is distinct from old.data->field) then
      confirmation = new.data->field;
      if jsonb_typeof(confirmation) is distinct from 'object' then raise exception 'Invalid handler confirmation'; end if;
      -- Canonical counts, actor and server time prevent forged on-time confirmations.
      select count(*),count(*) filter (where (a.data->>'progress')::numeric is distinct from coalesce((p.value->>'progress')::numeric,(a.data->>'baseline')::numeric))
        into assigned_count,changed_count
        from public.kw_nbc_activities a
        left join lateral (select value from jsonb_array_elements(coalesce(prior->'entries','[]')) where value->>'id'=a.id) p on true
        where a.user_id=new.user_id and a.project_id=pid and a.data->>'editable'='true' and a.data->>'handler'=handler;
      new.data = jsonb_set(new.data,array[field],jsonb_build_object('at',clock_timestamp(),'editor',auth.uid(),'assignedCount',assigned_count,'changedCount',changed_count));
    end if;
  end loop;
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

revoke all on function kw_private.nbc_report_guard() from public,anon,authenticated;
