-- Temporary -- re-confirms the real businesses.tier column definition
-- live, on request, rather than relying on the earlier (already
-- reported) result. Dropped once read.
create or replace function _debug_reconfirm_tier_column()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'column_default', (select column_default from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier'),
    'is_nullable', (select is_nullable from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier'),
    'data_type', (select data_type from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='tier')
  )
$$;
grant execute on function _debug_reconfirm_tier_column() to authenticated;
revoke all on function _debug_reconfirm_tier_column() from public, anon;
