-- Recurring Schedule — Phase 1 (database foundation + data migration only,
-- per explicit scope: no app-code changes in this migration, no Jobs-table
-- grouping UI, no membership-conversion, no customer portal/reminders).
--
-- Conceptual model, confirmed against the real live schema first
-- (introspected via 20260811035905's _debug_check_recurring_prereqs()):
--
--   CUSTOMER
--      |
--   RECURRING SCHEDULE  (this migration)      MEMBERSHIP (untouched — still
--      |                                        customers.notes' packed
--   JOB OCCURRENCES (real jobs.recurring_        [RP]{...json...} /
--   schedule_id FK, added below)                [RPJOB:planId] on jobs)
--      |
--   CALENDAR (jobsCalendarEvents() already reads real job rows —
--             unchanged, no calendar code touched here)
--
-- Recurring Schedule = operational repetition of work. Membership =
-- commercial/billing relationship. A schedule can exist with no
-- membership; a membership can (later, Phase 3+) create/manage a
-- schedule. They are deliberately not connected yet.
--
-- Two things worth flagging, found while introspecting rather than
-- assumed: customers already has unused recurring_service/recurring_
-- cadence/recurring_next_date/recurring_token/recurring_amount columns,
-- and jobs already has an unused is_recurring boolean and an unused
-- customer_id uuid — none of the four are read or written anywhere in
-- journey.js or hubly.html (grepped both, zero hits), so they're dead
-- columns from an earlier, abandoned pass at this exact feature, not the
-- live Membership system (that's the notes-packed [RP]/[RPJOB] tags,
-- confirmed actively used by recurringMetaFromCustomer/upsertCustomer/
-- bookNextRecurringVisit — none of that is touched here). Left alone —
-- out of this phase's scope to clean up, noted for a future pass.

create table if not exists public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid references public.customers(id) on delete cascade,
  -- Denormalized fallback, same reasoning as jobs.customer_name: the app's
  -- own customer<->job matching today is name/phone-based, not FK-based
  -- (jobs.customer_id exists but is never populated by createJob()), so a
  -- schedule needs a readable name even before that's fixed.
  customer_name text,
  service_name text,
  frequency text not null check (frequency in ('weekly','biweekly','monthly','quarterly','custom')),
  custom_interval_days integer,
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  start_date date not null,
  end_date date,
  next_occurrence_date date,
  preferred_time text,
  amount numeric,
  address text,
  assigned_to text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recurring_schedules is
  'The operational repetition of a service for a customer — parent of job occurrences (jobs.recurring_schedule_id). Distinct from Membership (customers.notes'' packed [RP]/[RPJOB] tags), which is the commercial/billing relationship. A schedule may exist with no membership.';

create index if not exists recurring_schedules_business_id_idx on public.recurring_schedules(business_id);
create index if not exists recurring_schedules_customer_id_idx on public.recurring_schedules(customer_id);

alter table public.recurring_schedules enable row level security;

create policy "owner can manage recurring schedules"
  on public.recurring_schedules
  for all
  to authenticated
  using (owns_business(business_id))
  with check (owns_business(business_id));

-- Job Occurrences — each occurrence stays a real, independent job row (its
-- own status/date/tech/completion/invoice state), just optionally linked
-- to the schedule that generated it. Null = one-time job, unchanged
-- behavior. ON DELETE SET NULL, not CASCADE: deleting a schedule should
-- never delete real job history.
alter table public.jobs
  add column if not exists recurring_schedule_id uuid references public.recurring_schedules(id) on delete set null;

comment on column public.jobs.recurring_schedule_id is
  'Parent recurring schedule this occurrence belongs to, if any. Null for one-time jobs. Every occurrence remains a fully real, independently-completable/cancellable job row regardless.';

create index if not exists jobs_recurring_schedule_id_idx on public.jobs(recurring_schedule_id);

-- Data migration: associate any already-created [RECUR:groupId|freq|
-- customDays] jobs (client-side recurring-frequency feature shipped
-- earlier this session, journey.js) into a real recurring_schedules row —
-- one row per distinct groupId, every job carrying that tag gets its
-- recurring_schedule_id set. Confirmed via the same introspection query:
-- zero rows currently carry the tag in production, so this is a no-op
-- today and only matters if it's ever re-run somewhere that has some —
-- written for real correctness regardless, not left as a TODO.
do $$
declare
  rec record;
  new_schedule_id uuid;
begin
  for rec in
    select
      m[1] as group_id,
      m[2] as freq,
      nullif(m[3], '') as custom_days,
      j.business_id,
      j.customer_name,
      j.service_name,
      j.address,
      j.amount,
      j.assigned_to
    from (
      select distinct on ((regexp_match(notes, '\[RECUR:([^|]+)\|([^|]*)\|([^\]]*)\]'))[1])
        notes, business_id, customer_name, service_name, address, amount, assigned_to
      from public.jobs
      where notes ~ '\[RECUR:[^\]]+\]' and recurring_schedule_id is null
      order by (regexp_match(notes, '\[RECUR:([^|]+)\|([^|]*)\|([^\]]*)\]'))[1], scheduled_date asc
    ) j,
    lateral (select regexp_match(j.notes, '\[RECUR:([^|]+)\|([^|]*)\|([^\]]*)\]') as m) g
  loop
    insert into public.recurring_schedules (
      business_id, customer_id, customer_name, service_name, frequency,
      custom_interval_days, status, start_date, next_occurrence_date,
      amount, address, assigned_to
    )
    select
      rec.business_id,
      (select c.id from public.customers c where c.business_id = rec.business_id and c.name = rec.customer_name limit 1),
      rec.customer_name,
      rec.service_name,
      case when rec.freq in ('weekly','biweekly','monthly','quarterly','custom') then rec.freq else 'custom' end,
      rec.custom_days::int,
      'active',
      coalesce((select min(j2.scheduled_date) from public.jobs j2 where j2.notes like '%[RECUR:' || rec.group_id || '|%'), current_date),
      (select min(j2.scheduled_date) from public.jobs j2 where j2.notes like '%[RECUR:' || rec.group_id || '|%' and j2.scheduled_date >= current_date and j2.status not in ('completed', 'cancelled')),
      rec.amount, rec.address, rec.assigned_to
    returning id into new_schedule_id;

    update public.jobs
    set recurring_schedule_id = new_schedule_id
    where notes like '%[RECUR:' || rec.group_id || '|%';
  end loop;
end $$;
