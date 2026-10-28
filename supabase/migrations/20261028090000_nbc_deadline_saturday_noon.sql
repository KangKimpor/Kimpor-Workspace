-- Handler updates are due Saturday 12:00 in Phnom Penh. The week still runs Monday to Sunday.
-- The boundary is exclusive: a confirmation stamped exactly at noon is late.
-- Existing confirmed rows keep the late flag they were stamped with.
create or replace function kw_private.nbc_deadline(week date) returns timestamptz language sql immutable set search_path='' as $$
  select ((week + 5)::timestamp + interval '12 hours') at time zone 'Asia/Phnom_Penh'
$$;
