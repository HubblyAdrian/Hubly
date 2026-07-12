-- Temporary diagnostic -- did the revoke from 20260712060000 actually
-- take effect at the database level? Dropped once read.
create or replace function _debug_tier_grants_check()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'tier_column_grants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'grantee', grantee, 'privilege_type', privilege_type, 'column_name', column_name
      )), '[]'::jsonb)
      from information_schema.column_privileges
      where table_schema='public' and table_name='businesses' and column_name='tier'
    )
  )
$$;
grant execute on function _debug_tier_grants_check() to authenticated;
revoke all on function _debug_tier_grants_check() from public, anon;
