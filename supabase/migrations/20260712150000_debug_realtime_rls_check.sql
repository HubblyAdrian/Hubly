-- Temporary diagnostic for Bug E: confirm RLS policies + Realtime
-- publication membership on jobs / booking_requests before implementing
-- postgres_changes subscriptions. Dropped in a follow-up migration once read.
create or replace function _debug_realtime_rls_check()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'jobs_policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'policyname', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual
      )), '[]'::jsonb)
      from pg_policies where schemaname='public' and tablename='jobs'
    ),
    'booking_requests_policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'policyname', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual
      )), '[]'::jsonb)
      from pg_policies where schemaname='public' and tablename='booking_requests'
    ),
    'jobs_rls_enabled', (
      select relrowsecurity from pg_class where relname='jobs' and relnamespace='public'::regnamespace
    ),
    'booking_requests_rls_enabled', (
      select relrowsecurity from pg_class where relname='booking_requests' and relnamespace='public'::regnamespace
    ),
    'realtime_publication_tables', (
      select coalesce(jsonb_agg(tablename), '[]'::jsonb)
      from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public'
        and tablename in ('jobs','booking_requests')
    )
  );
$$;

grant execute on function _debug_realtime_rls_check() to authenticated;
revoke all on function _debug_realtime_rls_check() from public, anon;
