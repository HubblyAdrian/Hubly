-- First Customer payments: close the hire money loop.
-- charge_kind on booking_requests, booking_request_id on jobs,
-- idempotent Stripe webhook event log.

alter table public.booking_requests
  add column if not exists charge_kind text;

comment on column public.booking_requests.charge_kind is
  'deposit | full — what Stripe Checkout charged for this hire.';

alter table public.jobs
  add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null;

create index if not exists jobs_booking_request_id_idx
  on public.jobs (booking_request_id)
  where booking_request_id is not null;

comment on column public.jobs.booking_request_id is
  'Source booking_requests row when the job was created from a hire.';

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- Service-role only (no anon/authenticated policies).

comment on table public.stripe_webhook_events is
  'Idempotency log for Stripe webhook event ids. Prevents double fulfillment.';
