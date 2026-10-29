-- The private source workbook is provisioned administratively, never bundled in public assets.
create table public.kw_nbc_templates (
  project_id text primary key,
  name text not null,
  base64 text not null check (length(base64) <= 13981016)
);
alter table public.kw_nbc_templates enable row level security;
revoke all on public.kw_nbc_templates from public,anon,authenticated;
grant select on public.kw_nbc_templates to authenticated;
create policy nbc_company_read on public.kw_nbc_templates for select to authenticated
using ((select auth.uid()) is not null and exists (
  select 1 from public.kw_projects p where p.id=project_id and p.data->>'nbcBp03'='true'
));
