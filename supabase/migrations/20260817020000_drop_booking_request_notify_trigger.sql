-- Drop booking_request_notify — the invisible caller.
--
-- WHAT IT DID
--
--   CREATE TRIGGER booking_request_notify
--     AFTER INSERT ON public.booking_requests FOR EACH ROW
--     EXECUTE FUNCTION supabase_functions.http_request(
--       'https://…/functions/v1/booking-notify', 'POST', …)
--
-- Every INSERT fired an HTTP call to the booking-notify Edge Function, with no
-- status filter. Two things follow, and both were live for months:
--
--   1. WRONG EVENT. The row is inserted at step 3, as an 'abandoned' LEAD, while
--      the customer is still filling in the contact form. So the owner was
--      emailed "New booking request" three minutes before any payment — on the
--      booking that prompted this, created_at 01:01:46 vs paid_at 01:04:39 — and
--      again for every customer who reached step 3 and never booked at all. That
--      noise is the bulk of what owners have been receiving.
--
--   2. INVISIBLE CALLER. The caller was a row in pg_trigger. No codebase search
--      can see it. That is how booking-notify existed as a deployed Edge Function
--      with no file in the repository, how three separate implementations of the
--      owner booking email came to coexist, and how a live endpoint
--      (api/notify.js) was deleted as dead 25 minutes after it sent a real email.
--      See docs/KNOWN_ISSUES.md, "The repo does not describe production".
--
-- WHAT REPLACES IT
--
-- The two places that know a booking became real now call booking-notify
-- directly:
--
--   * createJobFromBookingRequest (_shared/booking_job.ts) — payment landed and
--     the job exists. Only when it actually created the job, so a redelivered
--     Stripe event or the reconcile sweep cannot re-email.
--   * submitBooking (public/hubly.html) — a pay-in-person booking completed, where
--     no Stripe session ever opens and nothing server-side would otherwise fire.
--
-- booking-notify also refuses status='abandoned' itself, so the "never notify on
-- a lead row" property holds even if something calls it early.
--
-- Payment information becomes possible for the first time as a side effect: the
-- send now happens AFTER the money moves, so the email can say "$5.00 paid" and
-- present a paid booking as committed work rather than a request awaiting a
-- decision.

drop trigger if exists booking_request_notify on public.booking_requests;

-- Confirm it is gone, and that nothing else on this table still calls out over
-- HTTP invisibly.
select
  coalesce(
    (select string_agg(t.tgname || ' -> ' || regexp_replace(pg_get_triggerdef(t.oid),
              '^.*functions/v1/([a-z0-9-]+).*$', '\1'), ', ')
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
      where not t.tgisinternal
        and pg_get_triggerdef(t.oid) ilike '%http_request%'),
    'none'
  ) as remaining_http_triggers_all_tables;
