-- Tier-escalation fix: businesses.tier was writable by any authenticated
-- user on their own row via the generic "owner can manage their
-- business" policy (cmd ALL, with_check defaults to the USING clause,
-- which only checks owner_id -- nothing constrains tier specifically).
-- Confirmed via live investigation: there is no legitimate automated
-- write path to tier at all today (no billing/webhook code exists
-- anywhere in this repo) -- it's hand-edited via the Supabase Studio
-- dashboard, which authenticates as the postgres superuser and bypasses
-- RLS/grants entirely, so this revoke doesn't affect that workflow.
-- Column-level REVOKE, not a policy change, so the existing "owner can
-- manage their business" policy (and every other owner-editable field
-- on this table) is completely untouched.
revoke insert (tier), update (tier) on businesses from anon, authenticated;

-- Drop the temporary RLS-investigation diagnostic function now that
-- its answer has been read and reported.
drop function if exists _debug_businesses_rls();
