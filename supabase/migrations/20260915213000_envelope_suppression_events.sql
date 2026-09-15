-- COUNTABLE ENVELOPE SUPPRESSION (instrument, not a feature).
--
-- 2026-09-15: Hubly printed its own wire format at an owner —
--     {"action":"reply","message":""}
-- Fixed at four ends and shipped. But the fix is a SUPPRESSION, and a suppression that keeps no
-- record is indistinguishable from a defect that never happened again. Adrian's note, and it is
-- the same lesson as the booking path having no failed-write record: "you cannot force a real
-- model parse failure in production — add the one thing that WOULD tell us."
--
-- So every time sayableText refuses to say something, we write a row. Then if this happens in
-- the wild we LEARN it from a table instead of guessing, and we can see whether the salvage
-- branch is carrying real answers through (good) or the silence branch is firing often (a model
-- or prompt problem that the guard is quietly absorbing).
--
-- `outcome` distinguishes the two that matter and they are not the same event:
--   'salvaged'  an envelope carried a real message; the owner got the sentence. Guard did its job.
--   'silenced'  nothing sayable; the no-silence floor spoke instead. A turn a person lost.
-- A rising 'silenced' count is a real problem. A rising 'salvaged' count is the parser to fix.
--
-- WHAT IS NOT STORED: the raw text. It is model output about a real business's conversation, it
-- can carry the owner's own facts, and we do not need it to learn the shape — `sample` keeps a
-- short, deliberately truncated prefix for triage and `raw_len` keeps the size. Nothing reads
-- this table in the product; we query it.
create table if not exists public.envelope_suppression_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid,
  surface     text,                       -- 'hubly-conversation' | 'chatbot-message' | 'client'
  outcome     text not null,              -- 'salvaged' | 'silenced'
  parsed      boolean,                    -- did the payload parse cleanly? (a nested envelope) 
  raw_len     integer,
  sample      text,                       -- first 120 chars, for triage only
  created_at  timestamptz not null default now()
);

alter table public.envelope_suppression_events enable row level security;
revoke all on public.envelope_suppression_events from anon, authenticated;

create index if not exists envelope_suppression_events_created_idx
  on public.envelope_suppression_events (created_at desc);

create or replace function public.record_envelope_suppression(
  p_business_id uuid,
  p_surface     text,
  p_outcome     text,
  p_parsed      boolean,
  p_raw_len     integer,
  p_sample      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An unrecognised outcome is recorded rather than rejected: losing the event to a typo in the
  -- caller would be the instrument failing at exactly the moment it is needed.
  insert into public.envelope_suppression_events (business_id, surface, outcome, parsed, raw_len, sample)
  values (
    p_business_id,
    left(coalesce(p_surface, 'unknown'), 40),
    left(coalesce(p_outcome, 'unknown'), 20),
    p_parsed,
    greatest(coalesce(p_raw_len, 0), 0),
    left(coalesce(p_sample, ''), 120)
  );
end;
$$;

grant execute on function public.record_envelope_suppression(uuid, text, text, boolean, integer, text) to anon, authenticated;
