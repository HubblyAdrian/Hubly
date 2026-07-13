-- Cleanup for the temporary backfill helper in 20260712330000.
drop function if exists _backfill_apply_meta(uuid, text);
