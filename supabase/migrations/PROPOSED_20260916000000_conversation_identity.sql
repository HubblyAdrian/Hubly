-- A CONVERSATION NEEDS AN IDENTITY.  *** PROPOSED — NOT APPLIED. ***
--
-- Filename is deliberately PROPOSED_ so it cannot be picked up by anything that globs the
-- migrations directory. Rename to 20260916000000_conversation_identity.sql only after Adrian
-- has approved it, then apply ONE FILE AT A TIME with:
--     supabase db query --linked -f supabase/migrations/<file>.sql
--
-- ── WHY ────────────────────────────────────────────────────────────────────────────────────
-- business_conversations is (id, business_id, seq, role, content, created_at). There is no
-- CONVERSATION in it — one endless stream per business. That is why "See earlier conversation"
-- had to be invented as a fold, and it is why per-tab threads and saved chats are the same
-- missing column rather than two features.
--
-- ── WHAT THIS TOUCHES, MEASURED 2026-09-15 ────────────────────────────────────────────────
--   482 rows, 67 businesses, 0 orphans (every row's business still exists)
--   29 of those businesses are CLAIMED; 38 are still unclaimed drafts
--   graefs-autocare (MARKET, paying) has 4 rows: seq 1-4, all 2026-09-08 19:29-19:30,
--     "how come everything is different?" and "Someone booked me for a clay and seal on 9/15
--      and im not able to see it?" with Hubly's two replies.
--     AFTER THIS MIGRATION THOSE FOUR ROWS ARE BYTE-FOR-BYTE UNCHANGED. They gain a
--     conversation_id pointing at one new 'home' conversation for his business, and nothing
--     else about them is written — not seq, not content, not created_at, not role.
--
-- ── HOW IT FAILS SAFE ─────────────────────────────────────────────────────────────────────
-- Three properties, each deliberate:
--
--   1. ADDITIVE ONLY. A new table and a NULLABLE column. No existing column is altered, no row
--      is deleted, no RPC is changed. Every current reader and writer keeps working with no
--      knowledge of any of this, because none of them selects the new column.
--
--   2. EVERY STEP IS IDEMPOTENT AND RE-RUNNABLE. `create table if not exists`, an INSERT whose
--      conflict target is the partial unique index, and an UPDATE guarded by
--      `where conversation_id is null`. If this dies halfway — a timeout, a dropped
--      connection — some rows are stamped and some are not, which is a VALID intermediate
--      state (the column is nullable), and running the file again completes it. There is no
--      half-written row and nothing to unwind.
--
--   3. `NOT NULL` IS NOT SET HERE. That is the one step that can fail hard on a straggler, and
--      it is deliberately left to a SECOND migration to be applied only after the count below
--      has been read back and confirmed zero. Setting it in the same file would turn a partial
--      backfill into a failed migration.
--
-- ROLLBACK, if it is ever wanted: `drop table business_conversations_meta cascade;` drops the
-- column with it. The rows are untouched, so the old behaviour returns exactly.

-- ── 1. THE CONVERSATION ───────────────────────────────────────────────────────────────────
create table if not exists public.business_conversations_meta (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,

  -- NULL while the business is an unclaimed draft — 38 of the 67 businesses with history are
  -- in exactly that state today. The claim sets it, the same moment it sets businesses.owner_id.
  owner_id uuid null,

  -- WHICH SURFACE THIS CONVERSATION BELONGS TO. 'home' is the daily relationship and there is
  -- exactly one per business, forever (the partial unique index below). Every other surface
  -- works like ChatGPT: a current conversation, a new one on demand, past ones saved.
  -- 'leads' and 'store' are deliberately absent: no such room exists yet, and a scope is added
  -- when its surface is, not in anticipation.
  scope text not null check (scope in ('home','website','planner','jobs','customers')),

  -- NULL until EARNED. A conversation with no owner turn, or whose only owner turns are
  -- greetings, is never titled and never listed — Adrian's own "hey" of 2026-09-14 must not
  -- become a chat called "Hey". Backfilled conversations are left NULL deliberately: they are
  -- all 'home', and Home is never listed.
  title text null,

  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

-- ONE HOME PER BUSINESS, ENFORCED BY THE DATABASE rather than by every caller remembering.
create unique index if not exists business_conversations_meta_one_home
  on public.business_conversations_meta (business_id)
  where scope = 'home';

create index if not exists business_conversations_meta_biz_idx
  on public.business_conversations_meta (business_id, scope, last_active_at desc);

-- Locked like the rows table: RLS on, NO policies, every read through a security-definer RPC.
-- Those RPCs are NOT written here — this migration adds no reader and changes no gate.
alter table public.business_conversations_meta enable row level security;
revoke all on public.business_conversations_meta from anon, authenticated;

-- ── 2. THE COLUMN — NULLABLE ON PURPOSE (see property 3 above) ───────────────────────────
alter table public.business_conversations
  add column if not exists conversation_id uuid
  references public.business_conversations_meta(id) on delete cascade;

create index if not exists business_conversations_conversation_idx
  on public.business_conversations (conversation_id, seq);

-- ── 3. THE BACKFILL: ONE 'home' CONVERSATION PER BUSINESS THAT HAS ROWS ───────────────────
--
-- EVERY EXISTING ROW WAS TYPED IN HOME. The other surfaces have never had a conversation of
-- their own, so assigning history anywhere else would invent a provenance we do not have.
--
-- AND NO TIME-GAP SPLIT. Measured corpus-wide: only 11 gaps over six hours exist, across 5
-- businesses (4 over 24h). That is not enough signal to infer boundaries, and inferring them
-- would fabricate a history that never happened — the same offence as an invented price.
--
-- created_at/last_active_at come from the ROWS, so a restored conversation carries its real
-- dates rather than the date of this migration.
insert into public.business_conversations_meta (business_id, owner_id, scope, created_at, last_active_at)
select c.business_id, b.owner_id, 'home', min(c.created_at), max(c.created_at)
from public.business_conversations c
join public.businesses b on b.id = c.business_id
group by c.business_id, b.owner_id
on conflict (business_id) where scope = 'home' do nothing;

-- Guarded by `is null`, so a re-run after a partial failure stamps only what is left.
update public.business_conversations c
set conversation_id = m.id
from public.business_conversations_meta m
where m.business_id = c.business_id
  and m.scope = 'home'
  and c.conversation_id is null;

-- ── 4. READ IT BACK. A migration's own word is not the record. ────────────────────────────
-- Expected after a complete run: unstamped = 0, conversations = 67, rows = 482,
-- and graef_rows = 4 all pointing at one conversation.
select
  (select count(*) from public.business_conversations where conversation_id is null) as unstamped,
  (select count(*) from public.business_conversations_meta) as conversations,
  (select count(*) from public.business_conversations) as rows_total,
  (select count(*) from public.business_conversations c
     join public.businesses b on b.id = c.business_id
    where b.slug = 'graefs-autocare') as graef_rows,
  (select count(distinct c.conversation_id) from public.business_conversations c
     join public.businesses b on b.id = c.business_id
    where b.slug = 'graefs-autocare') as graef_conversations;
