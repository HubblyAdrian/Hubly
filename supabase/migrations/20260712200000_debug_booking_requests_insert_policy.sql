-- Bug E two-session test hit an unexpected RLS violation on an anon
-- booking_requests insert. The earlier diagnostic only read `qual`, which
-- is null for INSERT policies -- the real gate is `with_check` (and
-- whether the policy is permissive vs restrictive), neither of which was
-- checked. Re-checking those now before assuming anything about the fix.
create or replace function _debug_booking_requests_insert_policy()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'policyname', policyname, 'cmd', cmd, 'roles', roles,
    'permissive', permissive, 'qual', qual, 'with_check', with_check
  )), '[]'::jsonb)
  from pg_policies where schemaname='public' and tablename='booking_requests';
$$;

grant execute on function _debug_booking_requests_insert_policy() to authenticated, anon;
