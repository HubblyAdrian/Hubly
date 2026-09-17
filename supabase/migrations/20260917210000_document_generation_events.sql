-- ══ THE RETRY RATE WAS NEVER RECORDED, SO "BEFORE" COULD NOT BE MEASURED ═════════════════════
--
-- Adrian, 2026-09-17: "json_object -> json_schema + strict. Report the retry rate before and
-- after." The first half of that is not answerable today and saying so is the finding:
-- `generateAndValidateDocument` RETURNS `firstAttemptOk` and nothing anywhere writes it down. No
-- column, no table, no log we can query. The rate before the change cannot be recovered
-- retrospectively, and a number invented for it would be exactly the thing this repo spends its
-- days preventing.
--
-- So it is recorded from now on, and the change that would improve it is measured against a real
-- baseline rather than against a guess. One row per generation:
--
--   first_attempt_ok   did the model's FIRST output validate? That is the retry rate.
--   schema_mode        'json_object' today; 'json_schema' when the strict contract is turned on.
--                      The comparison is then one GROUP BY, not an argument.
--   error_kinds        WHICH errors the first attempt made — shape errors (a bad tag, an unknown
--                      class token) are the ones a strict schema can prevent; content errors (a
--                      hollow section, a claim the record contradicts) are not. Without this split
--                      the "after" number would be unattributable.
--
-- IT IS A MEASUREMENT TABLE, NOT A LEDGER OF RECORD. Nothing reads it to decide anything; it
-- exists so a question about our own behaviour has an answer that is not a memory.

create table if not exists public.document_generation_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  tag text,
  model text,
  schema_mode text not null default 'json_object',
  first_attempt_ok boolean not null,
  -- The distinct error kinds the FIRST attempt produced, e.g. {"tag","class_token","hollow_section"}.
  -- The first attempt is the honest signal: the retry has already been told what we want.
  error_kinds text[] not null default '{}',
  error_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists document_generation_events_created_idx
  on public.document_generation_events (created_at desc);
create index if not exists document_generation_events_mode_idx
  on public.document_generation_events (schema_mode, first_attempt_ok);

comment on table public.document_generation_events is
  'One row per page generation. Exists because "how often does the model need a retry" had no '
  'answer at all — firstAttemptOk was computed and thrown away — so the json_object -> json_schema '
  'change could not be measured. Nothing reads this to make a decision.';

-- Service role only. This is our own telemetry about our own model calls; no owner and no
-- visitor has any business reading or writing it.
alter table public.document_generation_events enable row level security;
revoke all on public.document_generation_events from anon, authenticated;
