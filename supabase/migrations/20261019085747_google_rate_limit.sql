create table public.kw_google_limits(user_id uuid primary key references auth.users(id) on delete cascade, window_at timestamptz not null default now(), requests integer not null default 0);
alter table public.kw_google_limits enable row level security;
revoke all on public.kw_google_limits from public,anon,authenticated;
grant all on public.kw_google_limits to service_role;
create function public.kw_google_rate(owner_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$ declare total integer; begin
 insert into public.kw_google_limits(user_id,window_at,requests) values(owner_id,now(),1)
 on conflict(user_id) do update set requests=case when kw_google_limits.window_at<now()-interval '1 minute' then 1 else kw_google_limits.requests+1 end,window_at=case when kw_google_limits.window_at<now()-interval '1 minute' then now() else kw_google_limits.window_at end returning requests into total;
 return total<=60;
end $$;
revoke all on function public.kw_google_rate(uuid) from public,anon,authenticated;
grant execute on function public.kw_google_rate(uuid) to service_role;
