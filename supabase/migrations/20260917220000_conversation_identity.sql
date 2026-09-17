-- ══ A DIFFERENT CONVERSATION IN EVERY TAB — the storage was built and had no door ═══════════
--
-- ADRIAN, 2026-09-17: "CONVERSATION IDENTITY — a different conversation in every tab except
-- Home, and chats SAVED the way ChatGPT and Claude save them. This is a feature, not polish, and
-- it has been open since the beginning."
--
-- IT IS NOT A NEW TABLE. `ask_hubly_conversations` and `ask_hubly_messages` have existed since
-- 2026-07-27 with exactly the right shape — a titled conversation per business per owner, and
-- messages linked to it — with owner RLS on both, so an authenticated owner can already read and
-- write them through PostgREST with no RPC at all.
--
--   ask_hubly_conversations : 0 rows
--   ask_hubly_messages      : 0 rows
--   references anywhere in public/ or supabase/functions/ : NONE
--
-- Built, authorised, and unreachable. The tenth instance of that shape this week, and the reason
-- the standing rule is to look for the missing door before building the room.
--
-- WHAT IT WAS MISSING IS ONE COLUMN: which PLACE a conversation belongs to. Without it every
-- thread is "a conversation about this business" and the tabs cannot each have their own.
--
-- MULTIPLE CONVERSATIONS PER PLACE ARE THE POINT, so this is deliberately NOT unique on
-- (business, user, place): the current thread for a place is the most recently updated one, and
-- starting a new one is what "saved chats" means. A unique constraint here would build the
-- single-thread product Adrian is asking us to stop building.

alter table public.ask_hubly_conversations
  add column if not exists place text not null default 'home';

comment on column public.ask_hubly_conversations.place is
  'Which surface this conversation belongs to — home, planner, website, jobs, customers, leads, '
  'quotes. The tab IS the identity: Home is the main chat, and every other place has its own. '
  'Not unique: a place accumulates conversations over time, which is what a saved chat list is.';

create index if not exists ask_hubly_conversations_place_idx
  on public.ask_hubly_conversations (business_id, place, updated_at desc);

-- The one thing the owner policies do not cover: an owner must be able to RENAME and TOUCH his own
-- conversation (updated_at moves when a message lands, and a title is how a saved chat is found
-- again). The existing update policy already allows it; this asserts the column list is not the
-- limit. No new policy is needed — recorded here so the next reader does not go looking.
