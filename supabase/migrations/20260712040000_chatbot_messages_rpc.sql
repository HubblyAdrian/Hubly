-- Owner read path for a single conversation's full message transcript.
-- Pro tier only -- unlike get_chatbot_conversations_for_business(),
-- which Starter tier also needs (aggregate stats), there is no
-- legitimate Starter use case for a transcript at all, so this hard-
-- gates in the WHERE clause instead of nulling columns per-row: a
-- non-owner or non-Pro caller gets zero rows, full stop, not partial
-- data. The join chain (messages -> conversation -> business) scopes
-- to that specific conversation's business before checking ownership
-- and tier, so a Pro-tier owner can't pull another business's
-- transcript by guessing a conversation id.
create or replace function get_chatbot_messages_for_conversation(p_conversation_id uuid)
returns table(id uuid, role text, content text, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select m.id, m.role, m.content, m.created_at
  from chatbot_messages m
  join chatbot_conversations c on c.id = m.conversation_id
  join businesses b on b.id = c.business_id
  where m.conversation_id = p_conversation_id
    and b.owner_id = auth.uid()
    and b.tier = 'pro'
  order by m.created_at asc
$$;

-- Explicit defense-in-depth on top of the auth.uid() check -- this
-- function returns raw customer conversation content, not the
-- already-redacted aggregate view, so it shouldn't rely on the
-- absence of a grant being merely incidental.
revoke all on function get_chatbot_messages_for_conversation(uuid) from public, anon;
grant execute on function get_chatbot_messages_for_conversation(uuid) to authenticated;
