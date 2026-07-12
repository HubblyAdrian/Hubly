-- Temporary diagnostic function -- answers "do any chatbot_conversations
-- rows exist with zero chatbot_messages rows?" before building the
-- transcript RPC, per explicit request. Dropped in the very next
-- migration once the count has been read; not meant to persist.
create or replace function _debug_conversations_without_messages_count()
returns bigint
language sql security definer set search_path = public
as $$
  select count(*) from chatbot_conversations c
  left join chatbot_messages m on m.conversation_id = c.id
  where m.id is null
$$;
grant execute on function _debug_conversations_without_messages_count() to anon, authenticated;
