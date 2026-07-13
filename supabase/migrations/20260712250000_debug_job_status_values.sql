-- Item 3 follow-up: confirm the real distinct status values in use across
-- all jobs (not just the synthetic 'completed'/'scheduled' used in live
-- testing), so the revenue card's "completed jobs only" filter is checked
-- against actual data, not assumed.
create or replace function _debug_job_status_values()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]'::jsonb)
  from (
    select status, count(*) cnt from jobs group by status order by count(*) desc
  ) s;
$$;

grant execute on function _debug_job_status_values() to authenticated;
revoke all on function _debug_job_status_values() from public, anon;
