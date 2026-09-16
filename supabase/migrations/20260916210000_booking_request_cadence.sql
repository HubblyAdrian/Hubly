-- THE WIZARD CAN ASK A CUSTOMER IF IT REPEATS, AND THE ANSWER SURVIVES TO THE JOB.
--
-- Measured 2026-09-16: 507 `?book=1` links reach a four-step form that collects NO cadence, so a
-- customer booking through the FORM cannot say "every month" even when they want to. The only live
-- door was a customer typing it in chat to the booking assistant, and none ever has —
-- recurring_schedules holds 0 rows (docs/RECURRING_DOORS_MEASURED.md, SETTLED 17).
--
-- The wizard writes a booking_requests row, not a job: the owner accepts it later. So the answer
-- has to WAIT somewhere between those two moments, and this is that place. One nullable column.
--
-- NEVER DEFAULTED. NULL means the customer did not ask for a repeat, which is the overwhelming
-- case, and it is distinguishable from every cadence. The same rule createBooking has always
-- carried in words and cadenceGrounded now enforces on the owner's side: a repeat nobody asked
-- for is a standing commitment nobody made.
--
-- NO SECOND ENGINE AND NO SECOND WRITER: on accept, the existing job-creation path calls
-- set_job_recurring with this value, which is the same function the owner's own two doors use.

alter table public.booking_requests
  add column if not exists requested_frequency text,
  add column if not exists requested_interval_days int;

alter table public.booking_requests
  drop constraint if exists booking_requests_frequency_check;
alter table public.booking_requests
  add constraint booking_requests_frequency_check
  check (requested_frequency is null
         or requested_frequency in ('weekly','biweekly','monthly','quarterly','custom'));

-- A custom cadence without its interval is not a cadence. Refused at the column rather than left
-- for a reader to discover as a silently-weekly schedule.
alter table public.booking_requests
  drop constraint if exists booking_requests_custom_interval_check;
alter table public.booking_requests
  add constraint booking_requests_custom_interval_check
  check (requested_frequency is distinct from 'custom'
         or (requested_interval_days is not null and requested_interval_days between 1 and 365));

comment on column public.booking_requests.requested_frequency is
  'What the CUSTOMER asked for in the booking form, never inferred and never defaulted. NULL = a '
  'one-time booking, which is almost all of them. Carried onto a recurring_schedules row by '
  'set_job_recurring when the owner accepts — the same writer the owner''s own doors use.';
