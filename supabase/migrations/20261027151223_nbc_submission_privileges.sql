-- Supabase default privileges grant broad rights on newly created public tables.
-- Only checked submission functions may write these two server-managed tables.
revoke all on public.kw_nbc_submissions,public.kw_nbc_summaries from public,anon,authenticated;
grant select on public.kw_nbc_submissions,public.kw_nbc_summaries to authenticated;
grant all on public.kw_nbc_submissions,public.kw_nbc_summaries to service_role;
