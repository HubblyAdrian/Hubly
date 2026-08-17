-- SMS consent: a recorded fact, not a marker inside free text.
--
-- Consent currently lives as the literal string '[SMS_CONSENT:yes]' concatenated
-- into booking_requests.notes (hubly.html:41923) and '[SMS:yes]' into
-- customers.notes (buildCustomerNotes). That is wrong in three separate ways:
--
--   1. It pollutes a customer-visible field. Every renderer of notes leaks it —
--      including at least one outbound email an owner received reading
--      "NOTES: [SMS_CONSENT:yes] · Where: Studio". The strippers that hide it
--      (stripBookingMachineTags, stripCustomerMetaNotes) are CLIENT-ONLY, so any
--      server-side or third-party renderer shows the raw string.
--   2. booking_requests.sms_consent ALREADY EXISTS as a boolean and is entirely
--      unused — 0 code references, 0 rows true, while 19 rows carry the marker.
--      It defaults to FALSE, so anything that started trusting it would conclude
--      those 19 customers had declined.
--   3. A boolean alone is not evidence. In a TCPA dispute the question is not
--      "did a flag say true" but "what exactly were they shown, and when".
--
-- SCOPE. Two consents, never one. The current checkbox reads "Yes, text me
-- updates about my booking" with fine print about scheduling and service
-- updates — that is TRANSACTIONAL and scopes itself to this booking. Marketing
-- requires prior express written consent: separately ticked, unticked by
-- default, naming the sender, disclosing automated messaging and frequency, and
-- stating that consent is NOT a condition of purchase. The existing copy does
-- none of that and the existing checkbox is mandatory, so it cannot carry
-- marketing consent no matter how it is stored.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. booking_requests
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.booking_requests
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_text text,
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_marketing_consent_text text;

comment on column public.booking_requests.sms_consent is
  'TRANSACTIONAL SMS consent — messages about THIS booking (scheduling, service '
  'updates). Existed unused since creation; wired 2026-08-17. Does NOT authorise '
  'marketing: see sms_marketing_consent. NULL means never asked, which is not the '
  'same as false (declined).';

comment on column public.booking_requests.sms_consent_at is
  'When transactional consent was given. NULL for rows backfilled from the '
  '[SMS_CONSENT:yes] notes marker, where only the booking timestamp is known.';

comment on column public.booking_requests.sms_consent_text is
  'The EXACT consent wording shown to the customer. A boolean records that '
  'someone agreed; this records what they agreed to, which is the part that '
  'matters when it is challenged. NULL on backfilled rows — the wording at the '
  'time was not captured.';

comment on column public.booking_requests.sms_marketing_consent is
  'Promotional/marketing SMS consent. Requires prior express written consent: a '
  'separate, unticked-by-default box that names the sender, discloses automated '
  'messaging and frequency, and states consent is not a condition of purchase. '
  'FALSE for every existing row — nobody has ever been asked.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. customers — no consent column at all today, only a notes marker
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.customers
  add column if not exists sms_consent boolean,
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_text text,
  add column if not exists sms_marketing_consent boolean not null default false,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_marketing_consent_text text;

-- Nullable with NO default, deliberately: on customers, "never asked" and
-- "declined" are genuinely different and the difference decides whether an owner
-- may text them. booking_requests.sms_consent already had `default false` when
-- this migration found it and is left as-is rather than changed underneath
-- existing rows.
comment on column public.customers.sms_consent is
  'TRANSACTIONAL SMS consent for this customer. NULL = never asked (NOT the same '
  'as declined). Replaces the [SMS:yes] marker in customers.notes.';

comment on column public.customers.sms_marketing_consent is
  'Promotional SMS consent. FALSE for every existing row — never asked.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill from the markers
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Only the positive marker is trusted. An ABSENT marker is not a decline: the
-- booking may predate the marker entirely, so it stays NULL/false rather than
-- being asserted as a refusal.
--
-- sms_consent_at is set to created_at as the best available approximation, and
-- sms_consent_text stays NULL because the wording shown at the time was never
-- recorded. Both are stated honestly rather than invented — a fabricated consent
-- string would be worse than none in exactly the situation this exists for.

update public.booking_requests
set sms_consent = true,
    sms_consent_at = coalesce(sms_consent_at, created_at)
where notes ilike '%[SMS_CONSENT:yes]%'
  and sms_consent is distinct from true;

update public.customers
set sms_consent = true,
    sms_consent_at = coalesce(sms_consent_at, created_at)
where notes ilike '%[SMS:yes]%'
  and sms_consent is distinct from true;

-- Explicit declines, if any were ever recorded.
update public.booking_requests
set sms_consent = false
where notes ilike '%[SMS_CONSENT:no]%'
  and notes not ilike '%[SMS_CONSENT:yes]%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Report — READ THIS OUTPUT
-- ─────────────────────────────────────────────────────────────────────────────

select
  'booking_requests'::text as tbl,
  format(
    'total=%s | consent_true=%s | consent_false=%s | consent_null=%s | marker_in_notes=%s | marketing_true=%s',
    count(*),
    count(*) filter (where sms_consent is true),
    count(*) filter (where sms_consent is false),
    count(*) filter (where sms_consent is null),
    count(*) filter (where notes ilike '%[SMS_CONSENT:%'),
    count(*) filter (where sms_marketing_consent is true)
  ) as detail
from public.booking_requests
union all
select
  'customers',
  format(
    'total=%s | consent_true=%s | consent_null=%s | marker_in_notes=%s | marketing_true=%s',
    count(*),
    count(*) filter (where sms_consent is true),
    count(*) filter (where sms_consent is null),
    count(*) filter (where notes ilike '%[SMS:yes]%'),
    count(*) filter (where sms_marketing_consent is true)
  )
from public.customers
union all
-- Textable = has transactional consent AND a phone that looks like a phone.
-- The second half matters: writeAbandonedBookingRequest stores `email:foo@bar`
-- in customer_phone when only an email is known (hubly.html:41139), so the
-- column alone cannot be trusted as a dialable number.
select
  'textable_leads',
  format(
    'abandoned=%s | with_consent=%s | with_consent_and_real_phone=%s',
    count(*) filter (where status = 'abandoned'),
    count(*) filter (where status = 'abandoned' and sms_consent is true),
    count(*) filter (where status = 'abandoned' and sms_consent is true
                       and customer_phone ~ '^[0-9()+ .-]{7,}$')
  )
from public.booking_requests
order by tbl;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Correction applied immediately after the first run
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The first run left five rows reading sms_consent = FALSE. None of them carries
-- any [SMS_CONSENT:*] marker — they predate it entirely and inherited the
-- column's pre-existing `default false`. Recording them as a refusal asserts
-- something about a customer that never happened, which is the exact confusion
-- the column comment above warns about. Section 3 said an absent marker "stays
-- NULL/false"; NULL is the only honest half of that, and the default made the
-- wrong half win.
--
-- Practically it failed safe — an owner would see "no consent" and not text
-- them — but "never asked" and "declined" must stay distinguishable, or the
-- opt-in email in step 5 cannot tell who is worth asking.

update public.booking_requests
set sms_consent = null
where sms_consent is false
  and notes not ilike '%[SMS_CONSENT:%';

-- Every write path sets this explicitly now, so an unset column should read
-- "unknown" rather than being answered by a default.
alter table public.booking_requests alter column sms_consent drop default;
