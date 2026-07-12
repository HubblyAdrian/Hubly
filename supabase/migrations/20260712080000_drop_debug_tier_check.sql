-- Drops the temporary grants-check diagnostic from
-- 20260712070000_debug_tier_revoke_check.sql, now that its answer
-- (the column-level revoke did not take effect) has been read and
-- reported. Not meant to persist.
drop function if exists _debug_tier_grants_check();
