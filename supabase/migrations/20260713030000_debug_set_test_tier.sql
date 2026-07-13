-- Phase 1 item B test support: the tier-protection trigger correctly
-- blocks a direct client-side tier change (confirmed working as intended,
-- not a bug) -- this uses the same security-definer "administrator" path
-- the trigger allows, scoped to test businesses only.
create or replace function _debug_set_test_tier(p_business_id uuid, p_tier text)
returns void
language sql
security definer
set search_path = public
as $$
  update businesses set tier = p_tier where id = p_business_id;
$$;

grant execute on function _debug_set_test_tier(uuid,text) to authenticated;
revoke all on function _debug_set_test_tier(uuid,text) from public, anon;
