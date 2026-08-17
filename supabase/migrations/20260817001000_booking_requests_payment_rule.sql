-- booking_requests.payment_rule + amount_required_cents — freeze what was owed,
-- and under which rule, AT BOOKING TIME.
--
-- The website booking path is where all five payment rules live (pay in person,
-- deposit, pay in full, customer choice, card on file) and it is the path that
-- records none of them. marketplace_bookings has payment_rule and does not need
-- it — on marketplace the customer always pays upfront, so the rule never
-- varies. This migration is for booking_requests ONLY; marketplace_bookings is
-- deliberately untouched.
--
-- WHY THIS IS NEEDED
--
-- The auto-accept sweeper (autoAcceptSkipLeadBookings, hubly.html:45168) accepts
-- a returning customer's booking whenever the owner's app loads jobs. That is
-- correct for pay-in-person work — nothing is owed at booking, so there is
-- nothing to wait for. It is wrong when the booking owes money that has not
-- been paid.
--
-- Deciding that from today's columns is guesswork:
--
--   payment_status='paid'              -> paid, safe
--   payment_status='pending_checkout'  -> owed, unpaid
--   amount_due_cents > 0, not paid     -> owed, unpaid
--   everything NULL                    -> UNKNOWABLE
--
-- The last case is ambiguous between "pay in person, nothing owed" and "payment
-- was required but checkout never ran" — the exact failure fixed in 24025bb,
-- which left no trace on the row. Worse, even a row that shows money owed does
-- not record WHICH rule produced it, so a business that later switches from
-- deposit to pay-in-full makes its own historical bookings unjudgeable.
--
-- resolveBookingPayment() already computes both of these values at booking time
-- and discards them. This stores them.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.booking_requests
  add column if not exists payment_rule text,
  add column if not exists amount_required_cents integer;

-- Vocabulary is the canonical PaymentRule union in _shared/booking_engine.ts
-- plus customer_choice, which exists in the client ruleMap (hubly.html:14680).
-- NULL is allowed and meaningful: rows written before this column existed.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_requests_payment_rule_check'
  ) then
    alter table public.booking_requests
      add constraint booking_requests_payment_rule_check
      check (payment_rule is null or payment_rule in (
        'pay_in_full', 'deposit', 'pay_after_service', 'customer_choice', 'card_on_file'
      ));
  end if;
end $$;

comment on column public.booking_requests.payment_rule is
  'The payment rule that applied WHEN THIS BOOKING WAS MADE, frozen so a later '
  'change to the business or package default cannot re-judge an old booking. '
  'NULL means the booking predates this column — consumers must fall back to '
  'inference from payment_status/amount_due_cents and must NOT assume '
  'pay_after_service. Website bookings only; marketplace uses '
  'marketplace_bookings.payment_rule.';

comment on column public.booking_requests.amount_required_cents is
  'What had to be paid AT BOOKING TIME for this booking to be considered settled '
  '— the deposit for a deposit booking, the full total for pay_in_full, and 0 '
  'when nothing was owed (pay in person). NOT the order total. A booking is paid '
  'up when amount_paid_cents >= amount_required_cents. NULL means unknown '
  '(pre-migration row), which is NOT the same as 0.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill — only the value that is a copy, never an inference
-- ─────────────────────────────────────────────────────────────────────────────
--
-- amount_due_cents is written by create-booking-checkout and is, by definition,
-- the amount that had to be paid at that moment. Copying it is a restatement,
-- not a guess, so it is safe.
--
-- payment_rule is deliberately NOT backfilled. deposit_cents > 0 looks like it
-- implies 'deposit', but it is set on more than one path and a wrong rule here
-- would make the sweeper accept an unpaid booking — the precise failure this
-- migration exists to prevent. Historical rows keep NULL and consumers fall
-- back to inference.

update public.booking_requests
set amount_required_cents = amount_due_cents
where amount_required_cents is null
  and amount_due_cents is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Report — READ THIS OUTPUT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `unknowable` is the count of accepted bookings where neither the rule nor the
-- required amount can be determined. Those are the rows the sweeper cannot
-- safely judge, and the number should trend to zero as new bookings arrive.

select
  'summary'::text as kind,
  format(
    'total=%s | required_backfilled=%s | rule_null=%s | accepted_unknowable=%s',
    (select count(*) from public.booking_requests),
    (select count(*) from public.booking_requests where amount_required_cents is not null),
    (select count(*) from public.booking_requests where payment_rule is null),
    (select count(*) from public.booking_requests
      where status = 'accepted'
        and payment_rule is null
        and amount_required_cents is null
        and payment_status is distinct from 'paid')
  ) as detail
union all
select
  'by_state',
  format(
    'status=%s payment_status=%s required=%s -> %s row(s)',
    coalesce(status, 'null'),
    coalesce(payment_status, 'null'),
    coalesce(amount_required_cents::text, 'null'),
    count(*)
  )
from public.booking_requests
group by status, payment_status, amount_required_cents
order by kind, detail;
