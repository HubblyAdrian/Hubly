-- Temporary diagnostic function -- investigates the real RLS policies
-- (or lack thereof) on businesses, whether RLS is even enabled, and
-- column-level grants specifically on tier, for the tier-escalation
-- security investigation. Dropped once read; not meant to persist.
create or replace function _debug_businesses_rls()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'rls_enabled', (select relrowsecurity from pg_class where relname='businesses' and relnamespace='public'::regnamespace),
    'rls_forced', (select relforcerowsecurity from pg_class where relname='businesses' and relnamespace='public'::regnamespace),
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'policyname', policyname, 'cmd', cmd, 'permissive', permissive,
        'roles', roles::text, 'qual', qual, 'with_check', with_check
      )), '[]'::jsonb)
      from pg_policies where schemaname='public' and tablename='businesses'
    ),
    'table_grants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'grantee', grantee, 'privilege_type', privilege_type
      )), '[]'::jsonb)
      from information_schema.role_table_grants
      where table_schema='public' and table_name='businesses'
        and grantee in ('anon','authenticated','public')
    ),
    'tier_column_grants', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'grantee', grantee, 'privilege_type', privilege_type, 'column_name', column_name
      )), '[]'::jsonb)
      from information_schema.column_privileges
      where table_schema='public' and table_name='businesses' and column_name='tier'
    ),
    'other_column_grants_check', (
      -- surfaces whether ANY column has a narrower grant than the table
      -- default, which would indicate someone already tried to lock down
      -- specific columns (informative either way)
      select coalesce(jsonb_agg(jsonb_build_object(
        'grantee', grantee, 'privilege_type', privilege_type, 'column_name', column_name
      )), '[]'::jsonb)
      from information_schema.column_privileges
      where table_schema='public' and table_name='businesses'
        and grantee in ('anon','authenticated')
        and column_name in ('id','owner_id','payment_setting','deposit_type','deposit_value','site_mode')
    )
  )
$$;
grant execute on function _debug_businesses_rls() to authenticated;
revoke all on function _debug_businesses_rls() from public, anon;
