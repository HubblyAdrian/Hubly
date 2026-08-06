-- Root-cause fix for the "Could not save customer" silent-failure bug
-- (real customer screenshot: booking confirmation shows, then a black
-- toast fires). Reproduced directly: an anon insert into public.customers
-- returned 42501 "new row violates row-level security policy" — confirmed
-- via _debug_check_customers_policies() that the only two existing
-- policies are "owner can manage customers" (ALL, gated by
-- owns_business(business_id) — never true for an anonymous booking
-- customer) and "public can read customer by recurring token" (SELECT
-- only). There has never been an INSERT policy covering an anonymous
-- booking-flow customer. This affected every business, every anonymous
-- booking, always — not isolated to one customer.
--
-- INSERT-only, no SELECT: customers holds real PII (name/phone/email/
-- vehicle). Granting anon SELECT would let anyone enumerate a business's
-- customer list by guessing business_id — same posture already chosen for
-- booking_requests (INSERT-only for anon, no SELECT). The client is
-- updated in the same commit to generate the row id itself and insert
-- without .select(), avoiding the RLS-under-RETURNING gap this would
-- otherwise hit even with a working INSERT policy (same pattern already
-- used for booking_requests in writeAbandonedBookingRequest()).
create policy "public can create customers for a business"
  on public.customers
  for insert
  to public
  with check (business_id is not null);

drop function if exists _debug_check_customers_policies();
