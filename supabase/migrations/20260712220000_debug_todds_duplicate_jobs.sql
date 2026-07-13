-- Duplicate-job cleanup check (Bug A follow-up): earlier searches for
-- "Adrian Smithee" jobs came back empty, but that search likely hit the
-- RLS blind spot (jobs has no public SELECT policy the way businesses
-- does, so an empty result could mean "no rows" or "RLS silently
-- blocked the query"). Bypassing RLS with security definer, scoped to
-- Todds specifically, to get a real answer either way.
create or replace function _debug_todds_duplicate_jobs()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'todds_business_id', 'a9d5e990-acdb-4f76-849d-751d863cdc18',
    'all_jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'customer_name', customer_name, 'service_name', service_name,
        'scheduled_date', scheduled_date, 'scheduled_time', scheduled_time,
        'status', status, 'created_at', created_at
      ) order by created_at), '[]'::jsonb)
      from jobs where business_id = 'a9d5e990-acdb-4f76-849d-751d863cdc18'
    ),
    'duplicate_groups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'customer_name', customer_name, 'scheduled_date', scheduled_date,
        'scheduled_time', scheduled_time, 'service_name', service_name, 'count', cnt
      )), '[]'::jsonb)
      from (
        select customer_name, scheduled_date, scheduled_time, service_name, count(*) cnt
        from jobs where business_id = 'a9d5e990-acdb-4f76-849d-751d863cdc18'
        group by customer_name, scheduled_date, scheduled_time, service_name
        having count(*) > 1
      ) dupes
    )
  );
$$;

grant execute on function _debug_todds_duplicate_jobs() to authenticated;
revoke all on function _debug_todds_duplicate_jobs() from public, anon;
