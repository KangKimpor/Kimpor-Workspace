begin;
insert into auth.users(id) values('f0000000-0000-4000-8000-000000000001'),('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if (public.kw_workspace_write('pages','rls-check','{"id":"rls-check","title":"Isolation test"}',null)->>'conflict')::boolean then raise exception 'Initial write rejected'; end if;
 if not (public.kw_workspace_write('pages','rls-check','{"id":"rls-check","title":"Stale write"}',null)->>'conflict')::boolean then raise exception 'Stale write accepted'; end if;
end$$;
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select count(*) as other_user_visible_rows from public.kw_pages where id='rls-check';
do $$begin
 if exists(select 1 from public.kw_pages where id='rls-check') then raise exception 'Cross-user data visible'; end if;
 begin
 insert into public.kw_pages(id,user_id,data) values('illegal','f0000000-0000-4000-8000-000000000001','{}');
 raise exception 'RLS failed: cross-user write succeeded';
 exception when insufficient_privilege then null;
 end;
 begin
 perform encrypted_token from public.kw_calendar_tokens;
 raise exception 'Token permissions failed';
 exception when insufficient_privilege then null;
 end;
end$$;
select 'owner isolation, stale-write rejection, cross-user write denial, token denial passed' as result;
rollback;
