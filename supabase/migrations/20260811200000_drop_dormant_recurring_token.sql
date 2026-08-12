-- Security fix (predates #189): customers had a public SELECT policy
-- keyed only on "recurring_token IS NOT NULL" — an existence check, not
-- an equality check against a caller-supplied token. Any anon caller
-- could read a customer's full PII row (name/phone/email/vehicle/notes)
-- for ANY row with a non-null recurring_token, regardless of what token
-- (if any) they actually presented. There is no request-scoped
-- comparison in a Postgres RLS `USING` clause without one being written
-- explicitly, and none was.
--
-- Verified before this migration:
--   - 0 of 11 real customer rows have a non-null recurring_token today
--     (select count(*), count(recurring_token) from customers).
--   - Zero application code anywhere in the repo reads or writes this
--     column (grepped supabase/functions and public/*.html, *.js).
--   - The similarly-named `?rp=` recurring-booking link
--     (buildRecurringBookingUrl/encodeRecurringToken, hubly.html) is a
--     separate, unrelated mechanism — it base64-encodes customer data
--     directly into the URL and never reads this column or queries the
--     database through it at all.
--   - No triggers, no dependent views reference this column.
-- So this column and policy were already fully dormant — this migration
-- removes the exposure rather than trying to patch a policy for a
-- feature nothing uses. #189's portal identity model uses an entirely
-- new, separately-designed mechanism (see #189 implementation plan) —
-- this column is not reused for it.
drop policy if exists "public can read customer by recurring token" on public.customers;
alter table public.customers drop constraint if exists customers_recurring_token_key;
drop index if exists public.idx_customers_recurring_token;
alter table public.customers drop column if exists recurring_token;
