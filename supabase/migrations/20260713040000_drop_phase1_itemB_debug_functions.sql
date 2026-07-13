-- Cleanup for the temporary test-support functions in 20260713020000 and
-- 20260713030000.
drop function if exists _debug_seed_chatbot_test(uuid,text,text);
drop function if exists _debug_set_test_tier(uuid,text);
