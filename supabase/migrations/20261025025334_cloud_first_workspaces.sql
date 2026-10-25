-- Private project groups; this does not grant cross-account access.
update public.kw_projects set data = jsonb_set(data, '{workspace}', '"personal"')
where data->>'workspace' is null or data->>'workspace' not in ('team', 'personal');
alter table public.kw_projects add constraint kw_project_workspace
check (coalesce(data->>'workspace', '') in ('team', 'personal'));

-- Existing own_rows RLS policies remain authoritative for each signed-in account.
do $$ declare name text; begin
  foreach name in array array['kw_pages','kw_projects','kw_tasks','kw_events','kw_profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=name) then
      execute format('alter publication supabase_realtime add table public.%I', name);
    end if;
  end loop;
end $$;

-- Filtered Postgres Changes cannot deliver DELETE. Notify only the owner on a
-- private topic; the client ignores the payload and refetches through table RLS.
create schema if not exists kw_private;
revoke all on schema kw_private from public, anon;
create policy kw_workspace_receive on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'kw-workspace:' || (select auth.uid())::text);
create policy kw_workspace_send_delete on realtime.messages for insert to authenticated
with check (topic = 'kw-workspace:' || (select auth.uid())::text and extension = 'broadcast');
create function kw_private.workspace_deleted() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform realtime.send('{}'::jsonb, 'DELETE', 'kw-workspace:' || old.user_id::text, true);
  return old;
end $$;
revoke all on function kw_private.workspace_deleted() from public, anon, authenticated;
do $$ declare name text; begin
  foreach name in array array['kw_pages','kw_projects','kw_tasks','kw_events','kw_profiles'] loop
    execute format('create trigger kw_workspace_deleted after delete on public.%I for each row execute function kw_private.workspace_deleted()', name);
  end loop;
end $$;

-- Google instance IDs include calendar and series identifiers and can exceed 100 characters.
create or replace function public.kw_workspace_write(collection text, record_id text, payload jsonb, expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; result jsonb; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection='profiles' and record_id<>auth.uid()::text then raise exception 'Invalid profile'; end if;
  if collection not in ('pages','projects','tasks','events','profiles') or jsonb_typeof(payload)<>'object' or length(payload::text)>2000000 or octet_length(record_id)>2048 then raise exception 'Invalid record'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id::text=$2','kw_'||collection) into existing using auth.uid(),record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then return jsonb_build_object('conflict',true,'row',existing); end if;
  -- A stale update must not recreate a record deleted on another session.
  if existing is null and expected is not null then return jsonb_build_object('conflict',true,'row',null); end if;
  if collection='projects' then
    payload = jsonb_set(payload, '{workspace}', to_jsonb(coalesce(payload->>'workspace','personal')));
  end if;
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
