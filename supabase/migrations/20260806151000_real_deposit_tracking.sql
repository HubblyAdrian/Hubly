-- Real deposit tracking, replacing the fabricated version in journey.js
-- (j.depositStatus = amount >= 300 ? 'due' : 'none', 25% flat guess).
--
-- Verified before building anything here:
-- - booking_requests already has real, Stripe-webhook-confirmed payment
--   columns (payment_status, amount_due_cents, amount_paid_cents,
--   stripe_checkout_session_id, paid_at) — see 20260718010000. The webhook
--   (stripe-webhook/index.ts) genuinely writes payment_status='paid' only
--   on a real checkout.session.completed event, matched by the
--   hubly_booking_request_id it embeds at checkout-creation time. That
--   part needed no new building — it's real.
-- - jobs already has a real, human-driven paid/pay_method/pay_notes/paid_at
--   for full-invoice payment at job completion. Deposits are a different
--   lifecycle stage (collected at booking, balance due at service), so
--   reusing that boolean would conflate the two — hence the new columns
--   below rather than overloading `paid`.
-- - The actual gap: booking_requests never recorded whether a deposit was
--   configured at all (only the amount ultimately charged, if any, via
--   Stripe), and none of it was ever carried onto the resulting job.

alter table public.booking_requests
  add column if not exists deposit_cents integer;
comment on column public.booking_requests.deposit_cents is
  'Real configured deposit amount for this booking, from the business''s Payment & deposits setting at time of booking. Null = no deposit was configured (full payment or pay-in-person).';

alter table public.jobs
  add column if not exists deposit_cents integer,
  add column if not exists deposit_status text;
comment on column public.jobs.deposit_status is
  'none | due | paid_online | collected. Populated from the real booking_requests row at acceptance time — paid_online only when payment_status=''paid'' (Stripe-webhook-confirmed). collected is set only by a real human action (Mark deposit collected), never inferred.';

drop function if exists _debug_check_jobs_columns();
