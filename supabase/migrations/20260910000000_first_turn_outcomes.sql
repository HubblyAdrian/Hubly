-- THE FIRST TURN COUNTS ITSELF.
--
-- The most important moment in the product — a stranger's first sentence — was the one
-- moment we could not measure at any price. A turn that creates no draft writes NOTHING:
-- no businesses row, and no business_conversations row either (hcFlushPersist buffers
-- until a draft exists). So every measurement of the first-turn build rate has been a
-- snapshot bought with real quota, and two of them were read as answers to questions they
-- could not answer:
--   "94% of businesses got a build"  — counted only conversations that produced a business.
--   "50 of 50 real-client builds"    — same denominator; a menu reply is invisible to it.
-- Both true, both about a narrower population than they were read as.
--
-- This is parked ruling 10 (every refusal branch writes a row) applied to the moment that
-- matters most. Zero quota, one row per first turn, permanent instead of 23% of a top-up
-- per snapshot.
--
-- NO JUDGEMENT IS WRITTEN HERE. `said` and `reply` are stored raw and what they MEAN is
-- decided at read time. A detector in a write path poisons the data permanently — a wrong
-- regex writes a wrong boolean and the truth is gone; a detector in a read path can be
-- corrected any time. On 2026-09-09 a detector deciding "asked = true" at write time cost
-- a whole run and would have reported success on the exact failure Adrian had just watched.
create table if not exists public.first_turn_outcomes (
  id bigserial primary key,

  -- Issued by the client, sent on every turn of the same conversation. DECLARED, never
  -- inferred: it is what lets a later draft be joined back to the turn that opened the
  -- conversation, and no text-matching heuristic is used to do it.
  conversation_key text not null,

  -- THE VISITOR'S OWN WORDS, and the whole value of this table: the three openers we spent
  -- a week arguing about were invented, and the six real ones would have been here.
  -- 200 chars, and NOTHING else about them — no IP, no user agent, no identifier.
  -- Truncation does not protect someone who types their name and address in sentence one.
  -- Retention and non-exposure do; see the purge below and the RLS immediately after.
  said text,
  -- What Hubly said back, stored so "did it ask for a name" / "was that a menu" can be
  -- decided later and re-decided when the detector is wrong.
  reply text,

  -- Facts about what actually ran, not opinions about what it meant.
  drafted boolean not null,          -- business.startDraft ran on THIS turn
  built boolean not null,            -- website.generateDocument followed on THIS turn
  named boolean not null,            -- the draft carried a name (they gave one)

  business_id uuid,                  -- the draft this turn created, when it created one

  -- A TURN IS NOT A CONVERSATION. "can you build me a site" -> "what kind of business is
  -- it?" creates no draft and is CORRECT; a menu creates no draft and is the failure. They
  -- are identical on this row until the conversation continues, so a draft created on a
  -- LATER turn of the same conversation is recorded here and the three cases separate:
  --   drafted                        -> built on turn one, the product working
  --   not drafted, later_business_id -> asked a fair question, then built
  --   not drafted, nothing later     -> the failure we actually care about
  later_business_id uuid,
  later_at timestamptz,

  -- DECLARED BY OUR HARNESSES, never sniffed. An absent Origin header is a heuristic, and
  -- a heuristic is wrong in the direction that flatters us on the day it matters. Our
  -- scripts send x-hubly-synthetic; anything without it is presumed a real visitor, so an
  -- unmarked harness shows up as a visible bug rather than a quietly better number.
  is_synthetic boolean not null default false,

  occurred_at timestamptz not null default now()
);

create index if not exists first_turn_outcomes_recent on public.first_turn_outcomes (occurred_at desc);
create index if not exists first_turn_outcomes_convo on public.first_turn_outcomes (conversation_key, occurred_at desc);

-- INTERNAL ONLY. RLS on with NO policies: nothing but the service role can read or write
-- this. It is never rendered to an owner, never surfaced in a reader, and never part of
-- any answer Hubly gives anyone. It exists to be read by us.
alter table public.first_turn_outcomes enable row level security;

create or replace function public.record_first_turn(
  p_conversation_key text,
  p_said text,
  p_reply text,
  p_drafted boolean,
  p_built boolean,
  p_named boolean,
  p_business_id uuid default null,
  p_is_synthetic boolean default false
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into first_turn_outcomes (conversation_key, said, reply, drafted, built, named, business_id, is_synthetic)
  values (nullif(trim(coalesce(p_conversation_key, '')), ''), left(coalesce(p_said, ''), 200), left(coalesce(p_reply, ''), 500),
          coalesce(p_drafted, false), coalesce(p_built, false), coalesce(p_named, false), p_business_id, coalesce(p_is_synthetic, false));
exception when others then
  null;  -- recording a signup must never be able to fail a signup
end;
$$;

-- A draft appeared on a later turn: close the loop on that conversation's opening row.
create or replace function public.resolve_first_turn_draft(
  p_conversation_key text,
  p_business_id uuid
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update first_turn_outcomes
     set later_business_id = p_business_id, later_at = now()
   where conversation_key = nullif(trim(coalesce(p_conversation_key, '')), '')
     and business_id is null
     and later_business_id is null
     and occurred_at > now() - interval '24 hours';
exception when others then
  null;
end;
$$;

-- THIRTY-DAY RETENTION ON THE WORDS, PERMANENT RETENTION OF THE RATE. The strangers'
-- sentences go; the booleans that make this a measurement stay, so the metric has a
-- history without us quietly accumulating a corpus of what people typed.
create or replace function public.purge_first_turn_text()
returns void language sql security definer set search_path to 'public' as $$
  update first_turn_outcomes set said = null, reply = null
   where occurred_at < now() - interval '30 days' and (said is not null or reply is not null);
$$;

revoke all on function public.record_first_turn(text, text, text, boolean, boolean, boolean, uuid, boolean) from public;
revoke all on function public.resolve_first_turn_draft(text, uuid) from public;
grant execute on function public.record_first_turn(text, text, text, boolean, boolean, boolean, uuid, boolean) to service_role;
grant execute on function public.resolve_first_turn_draft(text, uuid) to service_role;

select cron.schedule('purge-first-turn-text-daily', '23 4 * * *', $$ select public.purge_first_turn_text(); $$);
