-- WHO SET THIS, AND WHEN. The eighth instance of the failure-that-leaves-no-trace, closed.
--
-- 2026-09-16, after a whole session spent unable to answer a one-line question about one row:
-- the driveway job on hubly-classic-fixture read 17:00 and NOTHING could say whether the model
-- wrote it or Adrian did. `jobs` has no `updated_at`, no `created_by`, no source column — and
-- the model path and the by-hand editor write the SAME column through the SAME rpc
-- (update_business_job), so the two are indistinguishable by construction.
--
-- It cost a false headline. An earlier session read 17:00 as "the 4 PM seq 40 asked for" (17:00
-- is 5 PM), the reading was inherited as a premise, and it became an alarm. The data was fine —
-- Adrian had moved it by hand — but nothing in the database could say so, and the only thing
-- that settled it was asking him. That is precisely the shape: a question about last week that
-- cannot be answered today.
--
-- Adrian: "Add the trace. Not because anything is wrong today, but because we just spent a
-- session unable to answer a one-line question about a row."
--
-- THE CHEAPEST HONEST RECORD, and deliberately not more. Three columns and a trigger:
--   updated_at   when the row last moved            (the trigger fills it; nothing can forget)
--   updated_by   the authorising owner              (already known at the writer)
--   updated_via  which hand did it                  (the one thing the writer must declare)
-- It does NOT say WHAT changed. An audit table answers that, and nothing today asks it. "Did
-- this move, when, and by whose hand" is the unanswered question, and this is exactly that.
--
-- WHY A TRIGGER AND NOT A COLUMN THE WRITERS SET: a writer that must remember is a writer that
-- will forget, and the forgetting is silent. `updated_at` is filled by the database on every
-- UPDATE whatever path performs it — including a hand-run SQL statement, which is itself one of
-- the ways a row has moved here. Only `updated_via` needs declaring, because only the caller
-- knows which hand it is, and its default is the honest value: 'unknown'.

alter table public.jobs
  add column if not exists updated_at  timestamptz,
  add column if not exists updated_by  uuid,
  add column if not exists updated_via text;

-- 'unknown' IS THE DEFAULT AND THAT IS ON PURPOSE. A category that describes who did something
-- may not default to the flattering value; an unlabelled write is unknown, not 'model'.
alter table public.jobs
  drop constraint if exists jobs_updated_via_check;
alter table public.jobs
  add constraint jobs_updated_via_check
  check (updated_via is null or updated_via in ('model','hand','booking','calendar','script','unknown'));

-- EXISTING ROWS ARE LEFT NULL, NOT BACKFILLED. Every row predates the column, and stamping them
-- with a guess is exactly the fabrication this trace exists to prevent. NULL reads as "we did
-- not record it", which is true, and is the only honest value available.

create or replace function public.jobs_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.jobs_touch_updated_at();

comment on column public.jobs.updated_at is
  'Set by trigger on every UPDATE, whatever path performed it. NULL = the row has not been '
  'updated since 2026-09-16, when the column was added.';
comment on column public.jobs.updated_via is
  'Which hand last wrote the row: model (a capability), hand (the owner''s own editor), booking, '
  'calendar, script. Declared by the caller because only the caller knows; defaults to unknown, '
  'never to the flattering value. NULL = written before the column existed.';
