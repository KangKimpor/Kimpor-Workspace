-- Old offline autosaves must not restore values from before an administrative baseline reset.
do $$
declare definition text; marker text := 'if activity.id is null or activity.data->>''editable''<>''true''';
begin
  select pg_get_functiondef('kw_private.nbc_submission_write(text,jsonb,timestamptz)'::regprocedure) into definition;
  if position(marker in definition)=0 then raise exception 'Unexpected submission validator; review reset guard'; end if;
  definition := replace(definition, marker,
    'if activity.data->>''baselineResetAt'' is not null and (nullif(entry->>''baseRevision'','''') is null or (entry->>''baseRevision'')::timestamptz < (activity.data->>''baselineResetAt'')::timestamptz) then raise exception ''BP03 baseline was reset. Reload before updating progress''; end if; ' || marker);
  execute definition;
end $$;
