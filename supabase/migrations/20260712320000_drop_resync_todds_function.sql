-- Cleanup for the one-time re-sync function in 20260712310000.
drop function if exists _resync_todds_gen_content(text);
