-- Stable client IDs preserve pre-existing local page links during account import.
create table public.kw_pages (id text not null, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null check (jsonb_typeof(data) = 'object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(user_id,id));
create table public.kw_projects (like public.kw_pages including all);
alter table public.kw_projects add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_tasks (like public.kw_pages including all);
alter table public.kw_tasks add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_events (like public.kw_pages including all);
alter table public.kw_events add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_profiles (id uuid primary key references auth.users(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(id=user_id));
create table public.kw_calendar_accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, provider_account_id text not null, email text not null, name text not null, picture text, status text not null default 'OK', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider_account_id));
create table public.kw_calendar_tokens (account_id uuid primary key references public.kw_calendar_accounts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, encrypted_token text not null, key_id text not null default 'v1', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.kw_calendars (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, account_id uuid not null references public.kw_calendar_accounts(id) on delete cascade, provider_id text not null, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,account_id,provider_id));
create table public.kw_labels (like public.kw_pages including all);
alter table public.kw_labels add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_task_labels (like public.kw_pages including all);
alter table public.kw_task_labels add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_reminders (like public.kw_pages including all);
alter table public.kw_reminders add foreign key(user_id) references auth.users(id) on delete cascade;
create table public.kw_oauth_states (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, verifier text not null, expires_at timestamptz not null, created_at timestamptz not null default now());
do $$ declare t text; begin
  foreach t in array array['pages','projects','tasks','events','profiles','calendar_accounts','calendars','labels','task_labels','reminders'] loop
    execute format('alter table public.%I enable row level security','kw_'||t);
    execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)','kw_'||t);
    execute format('grant select,insert,update,delete on public.%I to authenticated','kw_'||t);
    execute format('revoke all on public.%I from anon','kw_'||t);
  end loop;
end $$;
alter table public.kw_calendar_tokens enable row level security;
alter table public.kw_oauth_states enable row level security;
revoke all on public.kw_calendar_tokens, public.kw_oauth_states from anon,authenticated;
grant all on public.kw_calendar_tokens, public.kw_oauth_states to service_role;
create index on public.kw_pages(user_id,updated_at);
create index on public.kw_projects(user_id,updated_at);
create index on public.kw_tasks(user_id,updated_at);
create index on public.kw_events(user_id,updated_at);
create index on public.kw_calendars(user_id,account_id);
create index on public.kw_calendar_accounts(user_id);

-- Compare-and-swap prevents stale offline writes from silently replacing newer edits.
create function public.kw_workspace_write(collection text, record_id text, payload jsonb, expected timestamptz default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; result jsonb; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if collection not in ('pages','projects','tasks','events') or jsonb_typeof(payload)<>'object' or length(payload::text)>2000000 or length(record_id)>100 then raise exception 'Invalid record'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||collection||record_id,0));
  execute format('select to_jsonb(t) from public.%I t where user_id=$1 and id=$2','kw_'||collection) into existing using auth.uid(),record_id;
  if existing is not null and (expected is null or (existing->>'updated_at')::timestamptz<>expected) then return jsonb_build_object('conflict',true,'row',existing); end if;
  if existing is null then
    execute format('insert into public.%I(id,user_id,data) values($1,$2,$3) returning to_jsonb(%I.*)','kw_'||collection,'kw_'||collection) into result using record_id,auth.uid(),payload;
  else
    execute format('update public.%I set data=$3,updated_at=clock_timestamp() where user_id=$1 and id=$2 returning to_jsonb(%I.*)','kw_'||collection,'kw_'||collection) into result using auth.uid(),record_id,payload;
  end if;
  return jsonb_build_object('conflict',false,'row',result);
end $$;
revoke all on function public.kw_workspace_write(text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.kw_workspace_write(text,text,jsonb,timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kw-files','kw-files',false,10485760,array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown']) on conflict(id) do nothing;
create policy kw_own_files_select on storage.objects for select to authenticated using(bucket_id='kw-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kw_own_files_insert on storage.objects for insert to authenticated with check(bucket_id='kw-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kw_own_files_update on storage.objects for update to authenticated using(bucket_id='kw-files' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='kw-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kw_own_files_delete on storage.objects for delete to authenticated using(bucket_id='kw-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
