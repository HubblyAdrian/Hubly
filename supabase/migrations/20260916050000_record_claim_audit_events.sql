-- COUNTABLE RECORD-CLAIM AUDIT (instrument, not enforcement).
--
-- THE CLASS: when Hubly reports what is in the record — how many, which ones, what state, who,
-- when — those figures must come from a reader, not from the model's recollection. Five sentences
-- in five days were the same act; the sharpest was "one paid store order — Store Walk, $24.99,
-- paid" against a record holding TWO orders, at $12.34 and $9.99, both PENDING.
--
-- MEASURED FIRST (2026-09-16): 89 of 284 stored assistant turns make a record claim. Only four
-- composeXTruth functions exist against 284 registry summaries the model re-narrates. And the
-- retrospective measurement CANNOT be taken any further, because nothing stored which capability
-- ran on a turn or what it returned — hubly_reasoning_events exists and holds 0 rows. So these
-- rows ARE the measurement, which is why they come before any enforcement.
--
-- TWO VERDICTS, and they are different defects:
--   'unsupported_figure'  a figure in the reply absent from the result. The model had something to
--                         read and departed from it.
--   'no_reader'           a record claim on a turn where NOTHING was read. Ungrounded by
--                         construction — there is nothing the figure could have come from.
--
-- `prior_evidence` exists to settle the caveat that would make 'no_reader' too aggressive: a model
-- may legitimately repeat a figure a reader established EARLIER in the same conversation. If most
-- no_reader rows carry prior_evidence = true, the rule needs conversation scope, not turn scope.
-- That is a measurement, not an argument, and this column is how it gets taken.
--
-- WHAT IS NOT STORED: the reply, and the evidence. Both are a real business's own data. `sample`
-- keeps a short prefix for triage and `figures` keeps only the offending values.
create table if not exists public.record_claim_audit_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid,
  verdict       text not null,          -- 'unsupported_figure' | 'no_reader'
  markers       text[],                 -- count / state / money / date
  figures       text[],                 -- the unsupported values only
  prior_evidence boolean,               -- could an earlier reader in this conversation have supplied them
  had_reader    boolean,                -- did anything read at all this turn
  sample        text,                   -- first 160 chars of the reply, for triage
  created_at    timestamptz not null default now()
);

alter table public.record_claim_audit_events enable row level security;
revoke all on public.record_claim_audit_events from anon, authenticated;

create index if not exists record_claim_audit_events_created_idx
  on public.record_claim_audit_events (created_at desc);
create index if not exists record_claim_audit_events_verdict_idx
  on public.record_claim_audit_events (verdict, created_at desc);

create or replace function public.record_claim_audit(
  p_business_id    uuid,
  p_verdict        text,
  p_markers        text[],
  p_figures        text[],
  p_prior_evidence boolean,
  p_had_reader     boolean,
  p_sample         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An unrecognised verdict is recorded rather than rejected: losing the event to a typo in the
  -- caller would be the instrument failing at the moment it is needed.
  insert into public.record_claim_audit_events
    (business_id, verdict, markers, figures, prior_evidence, had_reader, sample)
  values (
    p_business_id,
    left(coalesce(p_verdict,'unknown'), 32),
    p_markers,
    -- Cap the array so one pathological reply cannot write an unbounded row.
    (select array_agg(x) from (select unnest(coalesce(p_figures,'{}'::text[])) as x limit 12) s),
    p_prior_evidence,
    p_had_reader,
    left(coalesce(p_sample,''), 160)
  );
end;
$$;

grant execute on function public.record_claim_audit(uuid, text, text[], text[], boolean, boolean, text) to anon, authenticated, service_role;
