create or replace function kw_private.nbc_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.data->>'nbcActivityId' is not null and not exists(select 1 from public.kw_nbc_activities where user_id=public.kw_nbc_owner() and id=new.data->>'nbcActivityId' and project_id=new.data->>'projectId') then raise exception 'WBS activity must belong to this task project'; end if;
  return new;
end $$;

