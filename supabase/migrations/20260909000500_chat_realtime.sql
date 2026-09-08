-- CHAT LEADS IN REALTIME — and the policy that is the actual control.
--
-- WHY: a chat lead is the most time-sensitive event we have. The 30-minute idle threshold
-- was chosen because in home services a customer who waits an hour has already called
-- somebody else. An event that only appears the next time the owner opens the app defeats
-- the point of choosing 30 minutes at all.
--
-- THE CONTROL IS THE POLICY, NOT THE CLIENT FILTER.
--
-- The client subscribes with filter:'business_id=eq.<id>', and that is a CONVENIENCE, not
-- a security boundary — a filter is a request, and anything a client requests it can also
-- request differently. What decides whether another business's conversation can ever reach
-- a subscriber is the row-level policy on what the subscription is allowed to see.
--
-- chatbot_conversations had RLS ENABLED WITH ZERO POLICIES, which is why this had to be
-- added rather than assumed: with RLS on and no policy, `authenticated` sees nothing at
-- all, so publishing the table without this would have produced a subscription that never
-- fires — a feature that looks built and delivers silence.
--
-- owns_business() is the same predicate the already-published tables use
-- (booking_requests: "owner can read booking requests" -> owns_business(business_id)), so
-- chat leads are governed by exactly the rule bookings already are, not a parallel one.

create policy "owner can read chat conversations"
  on public.chatbot_conversations for select
  using (owns_business(business_id));

create policy "owner can read chat messages"
  on public.chatbot_messages for select
  using (exists (
    select 1 from public.chatbot_conversations c
    where c.id = chatbot_messages.conversation_id
      and owns_business(c.business_id)
  ));

-- Only after the policy exists.
alter publication supabase_realtime add table public.chatbot_conversations;
