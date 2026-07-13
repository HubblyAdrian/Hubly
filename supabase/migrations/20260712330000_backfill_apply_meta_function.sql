-- Item 6 backfill: generic, reusable version of the Todds re-sync function
-- (20260712310000, already dropped) -- parameterized by business_id so the
-- same careful merge logic can be applied across all backfill businesses.
create or replace function _backfill_apply_meta(target_id uuid, new_meta text)
returns void
language sql
security definer
set search_path = public
as $$
  update businesses set meta = new_meta where id = target_id;
$$;

grant execute on function _backfill_apply_meta(uuid, text) to authenticated;
revoke all on function _backfill_apply_meta(uuid, text) from public, anon;
