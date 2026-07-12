-- Two temporary diagnostics for the tier-trigger verification:
-- 1. The real column definition for businesses.tier (default,
--    nullability, check constraint), pulled directly rather than
--    assumed from the original migration file.
-- 2. current_user/session_user as seen from a plain (non-security-
--    definer) function, so it reflects whatever role actually
--    executed the RPC call -- used to confirm what role the
--    service-role key resolves to via PostgREST. Callable by anon
--    too so an edge function using the service-role key (which
--    PostgREST maps to a real Postgres role, not an app-level
--    concept) can call it without needing an authenticated user JWT.
create or replace function _debug_tier_column_def()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'column_default', (select column_default from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier'),
    'is_nullable', (select is_nullable from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier'),
    'data_type', (select data_type from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier'),
    'check_constraints', (
      select coalesce(jsonb_agg(jsonb_build_object('constraint_name', cc.constraint_name, 'check_clause', cc.check_clause)), '[]'::jsonb)
      from information_schema.check_constraints cc
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = cc.constraint_name
      where ccu.table_schema='public' and ccu.table_name='businesses' and ccu.column_name='tier'
    )
  )
$$;
grant execute on function _debug_tier_column_def() to authenticated;
revoke all on function _debug_tier_column_def() from public, anon;

create or replace function _debug_current_role_identity()
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object('current_user', current_user, 'session_user', session_user)
$$;
grant execute on function _debug_current_role_identity() to anon, authenticated, service_role;
