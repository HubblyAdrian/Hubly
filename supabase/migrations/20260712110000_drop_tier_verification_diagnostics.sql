-- Drops the two temporary diagnostics from
-- 20260712100000_debug_tier_column_and_role_check.sql, now that both
-- answers (the real tier column definition, and the service-role
-- identity/trigger-bypass confirmation) have been read and reported.
-- Not meant to persist.
drop function if exists _debug_tier_column_def();
drop function if exists _debug_current_role_identity();
