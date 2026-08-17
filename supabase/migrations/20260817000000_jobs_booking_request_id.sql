-- jobs.booking_request_id — the link that has never existed.
--
-- A booking request becomes a job through acceptBookingRequest(), which calls
-- createJob() and then stamps booking_requests.status='accepted'. createJob's
-- payload carries `from_booking` (a boolean) and nothing else: the reqId lives
-- only on the in-memory pseudo-job built by loadJobs() and is discarded at
-- insert. So today there is NO way to ask "which job came from this booking",
-- and therefore no way to create a job idempotently.
--
-- That matters now because a second creator is arriving. Payment is about to
-- create jobs (via the Stripe webhook and a reconcile path) alongside the
-- existing auto-accept sweeper. Without a key to deduplicate on, the two would
-- race and produce two jobs for one paid booking — a double entry on the
-- business's calendar for a session the customer booked once.
--
-- This migration only adds the column, backfills what can be matched with
-- certainty, and adds the uniqueness that makes idempotency possible. It
-- changes no application behaviour on its own.
--
-- The final statement is a SELECT, not RAISE NOTICE: the Supabase SQL editor
-- does not surface notices. Read its output — the ambiguous rows are a human
-- queue, not an error.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The column
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.jobs
  add column if not exists booking_request_id uuid
    references public.booking_requests (id) on delete set null;

comment on column public.jobs.booking_request_id is
  'The booking_requests row this job was created from, or NULL for jobs created '
  'directly (manual entry, blocks, Google Calendar imports). Job creation from a '
  'booking MUST be idempotent on this column — see jobs_booking_request_id_unique. '
  'Backfilled 2026-08-17 for unambiguous historical matches only.';

create index if not exists jobs_booking_request_id_idx
  on public.jobs (booking_request_id)
  where booking_request_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill — only where the pairing is unique in BOTH directions
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Deliberately conservative. A wrong link is worse than no link: it would make a
-- future paid booking believe its job already exists and skip creating one, so
-- the business silently never gets the work. Anything with more than one
-- plausible partner on either side is left NULL and reported below rather than
-- guessed at.
--
-- Match requires ALL of: same business, job came from a booking, the request was
-- accepted, same customer name, same service name, same date, and the job was
-- created at or after the request. Name/service compared case-insensitively and
-- trimmed, because both sides are free text typed by a customer.

with candidates as (
  select
    j.id  as job_id,
    br.id as req_id
  from public.jobs j
  join public.booking_requests br
    on  br.business_id = j.business_id
    and br.status = 'accepted'
    and lower(btrim(coalesce(j.customer_name, ''))) = lower(btrim(coalesce(br.customer_name, '')))
    and lower(btrim(coalesce(j.service_name,  ''))) = lower(btrim(coalesce(br.service_name,  '')))
    and j.scheduled_date = br.requested_date
    and j.created_at >= br.created_at
  where j.from_booking is true
    and j.booking_request_id is null
    and j.scheduled_date is not null
),
-- One job may look like several requests (a customer who booked the same
-- service twice on the same day) and vice versa. Keep only pairs that are the
-- sole candidate on both sides.
unique_pairs as (
  select c.job_id, c.req_id
  from candidates c
  where c.job_id in (select job_id from candidates group by job_id having count(*) = 1)
    and c.req_id in (select req_id from candidates group by req_id having count(*) = 1)
)
update public.jobs j
set booking_request_id = up.req_id
from unique_pairs up
where j.id = up.job_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Uniqueness — this is what makes creation idempotent
-- ─────────────────────────────────────────────────────────────────────────────
--
-- One booking request produces at most one job. PARTIAL, so the many jobs with
-- no booking behind them (manual entry, blocks, Google imports) are unaffected.
--
-- Created AFTER the backfill on purpose: the backfill only writes pairs that are
-- unique on both sides, so it cannot violate this — but if it somehow did, the
-- index build failing here is the loud signal we want, not a silent duplicate.

create unique index if not exists jobs_booking_request_id_unique
  on public.jobs (booking_request_id)
  where booking_request_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Report — READ THIS OUTPUT
-- ─────────────────────────────────────────────────────────────────────────────
--
--   summary            one row: what got linked and what is left over
--   ambiguous_job      a job matching several requests — left NULL, resolve by hand
--   ambiguous_request  a request matching several jobs  — left NULL, resolve by hand
--
-- Ambiguous rows are the expected outcome for repeat bookings of the same
-- service on the same day. NULL is the safe state: a future paid booking will
-- simply create its job normally.

with candidates as (
  select
    j.id  as job_id,
    br.id as req_id
  from public.jobs j
  join public.booking_requests br
    on  br.business_id = j.business_id
    and br.status = 'accepted'
    and lower(btrim(coalesce(j.customer_name, ''))) = lower(btrim(coalesce(br.customer_name, '')))
    and lower(btrim(coalesce(j.service_name,  ''))) = lower(btrim(coalesce(br.service_name,  '')))
    and j.scheduled_date = br.requested_date
    and j.created_at >= br.created_at
  where j.from_booking is true
    and j.booking_request_id is null
    and j.scheduled_date is not null
)
select
  'summary'::text as kind,
  format(
    'linked=%s | from_booking_still_unlinked=%s | accepted_requests_without_job=%s | ambiguous_jobs=%s | ambiguous_requests=%s',
    (select count(*) from public.jobs where booking_request_id is not null),
    (select count(*) from public.jobs
      where from_booking is true and booking_request_id is null),
    (select count(*) from public.booking_requests br
      where br.status = 'accepted'
        and not exists (select 1 from public.jobs j where j.booking_request_id = br.id)),
    (select count(*) from (select job_id from candidates group by job_id having count(*) > 1) x),
    (select count(*) from (select req_id from candidates group by req_id having count(*) > 1) y)
  ) as detail,
  null::text as candidate_ids
union all
select
  'ambiguous_job',
  format('job %s matches %s accepted requests', job_id, count(*)),
  array_agg(req_id)::text
from candidates
group by job_id
having count(*) > 1
union all
select
  'ambiguous_request',
  format('request %s matches %s booking-derived jobs', req_id, count(*)),
  array_agg(job_id)::text
from candidates
group by req_id
having count(*) > 1
order by kind, detail;
