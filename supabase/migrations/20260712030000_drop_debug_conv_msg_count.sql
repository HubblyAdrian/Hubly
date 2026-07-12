-- Drops the temporary diagnostic function from
-- 20260712020000_debug_conv_msg_count.sql, now that its one question
-- has been answered (0 conversations exist with zero messages --
-- confirmed live, see commit history). Not meant to persist.
drop function if exists _debug_conversations_without_messages_count();
