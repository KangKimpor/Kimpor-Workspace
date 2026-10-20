-- Google instance IDs include calendar and series identifiers and can exceed 100 characters.
create or replace function public.kw_workspace_write(collection text, record_id text, payload jsonb, expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; result jsonb; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection='profiles' and record_id<>auth.uid()::text then raise exception 'Invalid profile'; end if;
  if collection not in ('pages','projects','tasks','events','profiles') or jsonb_typeof(payload)<>'object' or length(payload::text)>2000000 or octet_length(record_id)>2048 then raise exception 'Invalid record'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id::text=$2','kw_'||collection) into existing using auth.uid(),record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then return jsonb_build_object('conflict',true,'row',existing); end if;
  if existing is null then
    execute format('insert into public.%I(id,user_id,data) values(%s,$2,$3) returning to_jsonb(%I.*)','kw_'||collection,case when collection='profiles' then '$1::uuid' else '$1' end,'kw_'||collection) into result using record_id,auth.uid(),payload;
  else
    execute format('update public.%I set data=$3,updated_at=clock_timestamp() where user_id=$1 and id::text=$2 returning to_jsonb(%I.*)','kw_'||collection,'kw_'||collection) into result using auth.uid(),record_id,payload;
  end if;
  return jsonb_build_object('conflict',false,'row',result);
end $$;
