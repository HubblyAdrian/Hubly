-- Diagnostic ahead of the recurring_schedules migration: confirm the real
-- live column set on jobs and customers before designing the FK/type
-- shapes (both tables were created outside version control — same
-- discipline as 20260806150000_debug_check_jobs_columns.sql and
-- 20260805223000_debug_check_customers_policies.sql). Dropped in the
-- follow-up migration once read.
create or replace function _debug_check_recurring_prereqs()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'jobs_columns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'column_name', column_name, 'is_nullable', is_nullable, 'data_type', data_type
      )), '[]'::jsonb)
      from information_schema.columns
      where table_schema='public' and table_name='jobs'
    ),
    'customers_columns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'column_name', column_name, 'is_nullable', is_nullable, 'data_type', data_type
      )), '[]'::jsonb)
      from information_schema.columns
      where table_schema='public' and table_name='customers'
    ),
    'jobs_with_recur_tag_count', (
      select count(*) from public.jobs where notes ~ '\[RECUR:[^\]]+\]'
    ),
    'owns_business_exists', (
      select exists(
        select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='owns_business'
      )
    )
  );
$$;

grant execute on function _debug_check_recurring_prereqs() to authenticated, anon;
