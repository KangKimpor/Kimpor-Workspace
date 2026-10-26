-- Delete only an owner's open update and undo its percentages in one transaction.
-- No direct report DELETE grant; finalized snapshots retain their existing protections.
create function public.kw_nbc_discard_update(record_id text, expected timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); current_row jsonb; prior jsonb; pid text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||'nbc-bp03',0));
  select to_jsonb(r) into current_row from public.kw_nbc_reports r where r.user_id=owner_id and r.id=record_id;
  if current_row is null then return jsonb_build_object('conflict',false,'row',null); end if;
  if current_row->'data'->>'status'<>'draft' or (current_row->>'updated_at')::timestamptz is distinct from expected then
    return jsonb_build_object('conflict',true,'row',current_row);
  end if;
  pid := current_row->'data'->>'projectId';
  select data into prior from public.kw_nbc_reports where user_id=owner_id and id=current_row->'data'->>'previousReportId' and project_id=pid and data->>'status'='final';
  update public.kw_nbc_activities a set data=jsonb_set(a.data,'{progress}',coalesce((select e->'progress' from jsonb_array_elements(coalesce(prior->'entries','[]'::jsonb)) e where e->>'id'=a.id),a.data->'baseline'))
  where a.user_id=owner_id and a.project_id=pid and a.data->>'editable'='true'
    and a.data->'progress' is distinct from coalesce((select e->'progress' from jsonb_array_elements(coalesce(prior->'entries','[]'::jsonb)) e where e->>'id'=a.id),a.data->'baseline');
  delete from public.kw_nbc_reports where user_id=owner_id and id=record_id;
  return jsonb_build_object('conflict',false,'row',null);
end $$;
revoke all on function public.kw_nbc_discard_update(text,timestamptz) from public,anon;
grant execute on function public.kw_nbc_discard_update(text,timestamptz) to authenticated;
-- Reuse the existing private, owner-scoped notification when that migration is installed.
do $$ begin
  if to_regprocedure('kw_private.workspace_deleted()') is not null then
    create trigger kw_workspace_deleted after delete on public.kw_nbc_reports for each row execute function kw_private.workspace_deleted();
  end if;
end $$;
