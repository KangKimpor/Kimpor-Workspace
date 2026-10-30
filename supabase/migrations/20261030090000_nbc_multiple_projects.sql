-- Shared NBC projects retain the existing canonical company storage owner.
-- No activity, submission, report, template or project data is changed here.
drop index public.kw_nbc_one_project;
drop index public.kw_nbc_company_project;
create unique index kw_nbc_company_project on public.kw_projects(id) where data->>'nbcBp03'='true';

-- ponytail: one company storage owner; use project-scoped ownership if separate companies are needed.
create or replace function public.kw_nbc_owner() returns uuid language sql stable security definer set search_path='' as $$
  select distinct user_id from public.kw_projects where auth.uid() is not null and data->>'nbcBp03'='true'
$$;

create function kw_private.nbc_storage_owner_guard() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('nbc-initialization',0));
  if new.data->>'nbcBp03'='true' and exists(
    select 1 from public.kw_projects where data->>'nbcBp03'='true' and user_id<>new.user_id
  ) then raise exception 'NBC projects must use the existing company storage owner'; end if;
  return new;
end $$;
revoke all on function kw_private.nbc_storage_owner_guard() from public,anon,authenticated;
create trigger nbc_storage_owner_guard before insert or update on public.kw_projects
  for each row execute function kw_private.nbc_storage_owner_guard();
