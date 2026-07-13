-- Re-check after enabling the publication: did it actually take, and are
-- there other blockers (replica identity, RLS auth role visibility)?
create or replace function _debug_realtime_publication_recheck()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'realtime_publication_tables', (
      select coalesce(jsonb_agg(jsonb_build_object('schemaname', schemaname, 'tablename', tablename)), '[]'::jsonb)
      from pg_publication_tables
      where pubname='supabase_realtime'
    ),
    'jobs_replica_identity', (
      select relreplident from pg_class where relname='jobs' and relnamespace='public'::regnamespace
    ),
    'booking_requests_replica_identity', (
      select relreplident from pg_class where relname='booking_requests' and relnamespace='public'::regnamespace
    ),
    'publication_exists', (
      select exists(select 1 from pg_publication where pubname='supabase_realtime')
    )
  );
$$;

grant execute on function _debug_realtime_publication_recheck() to authenticated;
revoke all on function _debug_realtime_publication_recheck() from public, anon;
