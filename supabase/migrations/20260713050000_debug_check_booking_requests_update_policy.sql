-- Phase 1 item C pre-build check: does an anon customer have any UPDATE
-- policy on booking_requests? The approved plan (write at end of Step 3,
-- UPDATE the same row to status='pending' on real completion instead of
-- inserting a second row) depends on this. Confirmed earlier tonight that
-- "owner can update booking requests" is owner-scoped only -- verifying
-- there's no separate anon UPDATE policy before building on that
-- assumption.
create or replace function _debug_check_br_update_policy()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'policyname', policyname, 'cmd', cmd, 'roles', roles,
    'permissive', permissive, 'qual', qual, 'with_check', with_check
  )), '[]'::jsonb)
  from pg_policies where schemaname='public' and tablename='booking_requests' and cmd in ('UPDATE','ALL');
$$;

grant execute on function _debug_check_br_update_policy() to authenticated;
