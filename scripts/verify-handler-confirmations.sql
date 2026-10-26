-- Run as the database administrator. Every test write is rolled back.
begin;
do $$
declare owner_id uuid; pid text; rid text; prior_id text; ending date; first_confirmation jsonb; second_confirmation jsonb; canonical_count integer;
begin
  select user_id,id into owner_id,pid from public.kw_projects where data->>'nbcBp03'='true' and data->>'workspace'='team' limit 1;
  if owner_id is null then raise exception 'Initialize the NBC project before running this check'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select id into rid from public.kw_nbc_reports where user_id=owner_id and project_id=pid and data->>'status'='draft' limit 1;
  if rid is null then
    select id,(data->>'date')::date+1 into prior_id,ending from public.kw_nbc_reports where user_id=owner_id and project_id=pid and data->>'status'='final' order by data->>'date' desc limit 1;
    ending=greatest(coalesce(ending,current_date),current_date);
    rid='verification:'||gen_random_uuid()::text;
    insert into public.kw_nbc_reports(id,user_id,data) values(rid,owner_id,jsonb_build_object('id',rid,'projectId',pid,'date',ending,'status','draft','entries','[]'::jsonb,'previousReportId',prior_id,'correctionOf',null,'reason','','startedBy','Sitha'));
  end if;
  update public.kw_nbc_reports set data=jsonb_set(data,'{handlerUpdateSitha}','{"at":"2000-01-01T00:00:00Z","editor":"forged","assignedCount":999999,"changedCount":999999}'::jsonb) where user_id=owner_id and id=rid;
  select data->'handlerUpdateSitha' into first_confirmation from public.kw_nbc_reports where user_id=owner_id and id=rid;
  select count(*) into canonical_count from public.kw_nbc_activities where user_id=owner_id and project_id=pid and data->>'editable'='true' and data->>'handler'='Sitha';
  if (first_confirmation->>'at')::timestamptz < transaction_timestamp() or first_confirmation->>'editor'<>owner_id::text or (first_confirmation->>'assignedCount')::integer<>canonical_count then raise exception 'Server confirmation canonicalization failed'; end if;
  update public.kw_nbc_reports set data=jsonb_set(data,'{handlerUpdateTola}','{}'::jsonb) where user_id=owner_id and id=rid;
  select data->'handlerUpdateSitha',data->'handlerUpdateTola' into first_confirmation,second_confirmation from public.kw_nbc_reports where user_id=owner_id and id=rid;
  if first_confirmation is null or second_confirmation is null or second_confirmation->>'editor'<>owner_id::text then raise exception 'Independent handler confirmation was lost'; end if;
  begin
    update public.kw_nbc_reports set data=jsonb_set(data,'{date}',to_jsonb('2099-01-01'::text)) where user_id=owner_id and id=rid;
    raise exception 'Immutable report date was changed';
  exception when others then
    if sqlerrm<>'Reporting period metadata is immutable' then raise; end if;
  end;
  begin
    update public.kw_nbc_reports set data=data-'handlerUpdateSitha' where user_id=owner_id and id=rid;
    raise exception 'Confirmation was removed';
  exception when others then
    if sqlerrm<>'Handler confirmations cannot be removed' then raise; end if;
  end;
end $$;
rollback;
select jsonb_build_object('server_timestamp',true,'server_actor',true,'canonical_counts',true,'independent_handlers',true,'immutable_metadata',true,'confirmation_retained',true,'test_writes','rolled back') as verification;
