-- VISITOR CONVERSATIONS: RETENTION, AND THE INDEXES THE LEAD READ NEEDS.
--
-- Context (2026-09-08). The public Website Concierge persisted NOTHING: a visitor who
-- asked "can you detail a truck this Saturday" and drifted away left no trace, so the
-- owner lost a customer he never knew he had. Measured on a clone — every candidate
-- table zero. The tables below already existed (written by the legacy chatbot-message
-- function, last used 2026-08-28); the concierge simply never wrote to them. Another
-- missing door, so we use the SAME store rather than inventing a second one.
--
-- ── RETENTION: 90 DAYS FOR MESSAGE BODIES. A DECISION, NOT A DEFAULT. ────────────
--
-- We are storing what STRANGERS type on a real business's site. That earns an explicit
-- end date rather than "forever, because nobody chose".
--
--   * chatbot_messages.content  is deleted after 90 days. The transcript ages out.
--   * chatbot_conversations     rows are KEPT: if a visitor volunteered contact details
--                               and it became a lead the owner acted on, that lead has
--                               its own life. We age out the transcript, not the customer.
--
-- And a policy with no job that enforces it is a sentence in a document. The pg_cron
-- schedule below is the enforcement; if it is ever removed, the claim must be removed
-- with it.
--
-- ── THE 30-MINUTE IDLE THRESHOLD ────────────────────────────────────────────────
-- Not stored here. "Idle" is computed from max(chatbot_messages.created_at) at read
-- time, so changing the number never requires a backfill. It governs when a lead is
-- FLAGGED AS NEEDING ACTION, never whether it exists: a conversation that never became
-- a booking surfaces regardless, timestamped, for the owner to judge.

-- Read path: "conversations for this business, newest first".
create index if not exists chatbot_conversations_business_started_idx
  on public.chatbot_conversations (business_id, started_at desc);

-- Read path: "last activity in this conversation" (the idle computation) and the
-- retention sweep, which scans by age.
create index if not exists chatbot_messages_conversation_created_idx
  on public.chatbot_messages (conversation_id, created_at desc);
create index if not exists chatbot_messages_created_idx
  on public.chatbot_messages (created_at);

-- ── THE ENFORCEMENT ─────────────────────────────────────────────────────────────
create or replace function public.purge_old_visitor_messages()
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.chatbot_messages where created_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  -- Deliberately NOT silent: a retention job that deletes nothing because it broke
  -- looks identical to one that deletes nothing because there is nothing to delete.
  raise notice 'purge_old_visitor_messages: deleted % message bodies older than 90 days', removed;
  return removed;
end; $$;

comment on function public.purge_old_visitor_messages() is
  '90-day retention for visitor chat transcripts (2026-09-08 decision). Deletes message
   BODIES only; chatbot_conversations rows persist because a lead the owner acted on
   outlives the transcript. Scheduled via pg_cron as purge-visitor-messages-daily.';

select cron.unschedule('purge-visitor-messages-daily')
  where exists (select 1 from cron.job where jobname = 'purge-visitor-messages-daily');

select cron.schedule(
  'purge-visitor-messages-daily',
  '17 4 * * *',
  $cron$ select public.purge_old_visitor_messages(); $cron$
);
