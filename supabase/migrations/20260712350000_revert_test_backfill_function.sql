-- Revert the "Test" business's backfill: excluded per instruction (throwaway
-- scratch data, not worth an API generation call), restoring its exact
-- pre-backfill meta.
create or replace function _revert_test_meta(original_meta text)
returns void
language sql
security definer
set search_path = public
as $$
  update businesses set meta = original_meta
  where id = 'a8e04c26-ed8c-4801-b37b-ca41ed266385';
$$;

grant execute on function _revert_test_meta(text) to authenticated;
revoke all on function _revert_test_meta(text) from public, anon;
