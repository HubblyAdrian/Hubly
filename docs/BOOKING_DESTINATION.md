# Where does a booking go — and can we prove a human saw it?

Read-only forensics, 2026-08-29 (corrected 2026-08-29 — see the correction note below).
Facts and file references only. Customer names are reduced to an initial.

**Who the requesters are (corrected, source: Adrian).** None of the 9 bookings came from a
member of the public. Every one traces back to an owner, family, a founder, or testing —
the same as every booking in the corpus. **Hubly has never received a booking request from
a stranger; that count is zero, all the way back.** So there are **zero dead drops** — no
real customer's request was dropped on the floor. The 5 pending rows are **untouched test
bookings, not lost demand.**

**The short answer up front.** Of the 9 bookings (all internal — owner/family/founder/test):
**4 were seen and acted on by a human** (all Graef's AutoCare — accepted by hand, turned into
customers, 2 completed jobs); **5 sit untouched** (Bucket ×1, Aquaspeed ×2, Graef's two
membership signups) — pending 13–39 days with no downstream artifact, i.e. no evidence the
owner ever opened them, but they are tests, so nothing was lost. **For none of the 9 can we
prove a notification was delivered** — the delivery ledger did not exist until after the most
recent booking.

**Correction note (the mistake this doc originally made).** The first version of this doc
called Bucket's and Aquaspeed's pending rows "dead drops" and wrote that "real people asked
these businesses for work and it was dropped on the floor." That was false. The error: it
held a strict evidence standard for whether a *notification was delivered* ("don't claim it
unless something confirms it") and then applied **no** standard at all to whether the
*requester was a real customer* — it read a name in a row and treated the name as proof of a
member of the public. A row is not a person. Who a booking's customer actually is (public vs
owner/family/founder/test) is a claim that needed checking against the account
classification and against Adrian, and it wasn't. The forensic facts below (timestamps,
status, the 08-17→08-21 trigger blackout, the ledger start date, 0 portal tokens) are
unchanged and stand; only the interpretation of who the customers were was wrong.

---

## 1. The full path (customer submit → terminus)

Both site shapes funnel into the **same** client booking wizard and the **same** table,
`booking_requests`. A website "Book" click never writes `marketplace_bookings` (that is a
separate product; see §2).

**Client submit:** `submitBooking()` — `public/hubly.html:42270` (the wizard's "Confirm &
book" button, `:12686`).
- If payment is owed → `create-booking-checkout`, then redirect to Stripe **without
  inserting**; if checkout was required and failed, the booking is **not** created
  (`hubly.html:42440-42471`). The pay-in-person / no-payment branch is the one that inserts.
- **Insert:** `booking_requests`, `hubly.html:42523` (default `status='pending'`, confirmed
  `column_default 'pending'`). Membership signups insert the same table, `:36669`.

**What fires after the insert** — two triggers on `booking_requests`, and one of them is the
notification path:
- `trg_supersede_abandoned_booking` (`20260806160000...:107`, AFTER INSERT) — housekeeping,
  supersedes stale lead rows. No notification.
- `booking_request_completed_notify` (`20260821010000_notify_owner_on_booking_completion.sql:101`,
  AFTER INSERT OR UPDATE OF status) — on `status='pending'` it `net.http_post`s to the
  `booking-notify` edge function (`:81-93`). Fire-and-forget.
- The client `submitBooking` no longer calls `booking-notify` itself (browser holds only the
  publishable key → 403 at the secret gate); delivery depends entirely on the DB trigger
  (`hubly.html:42534-42550`).

**`booking-notify` terminus:** builds owner + customer HTML, sends **two emails via Resend**
(`booking-notify/index.ts:150`, dispatched `:379`), and **records the result in
`notification_deliveries`** (`:120`, `status: 'sent'|'failed'`, with the Resend receipt).
That ledger row is the end of the chain. **No SMS or push is sent by any traced path** —
SMS consent is captured on the form (`hubly.html:12635`) but nothing sends an SMS.

**Paid path (not relevant to these 9 — all are unpaid):** `stripe-webhook` flips the row to
`payment_status='paid'`, creates a job (`_shared/booking_job.ts`), sets status `'accepted'`,
and calls `notifyBookingReal` directly. AMBIGUOUS: `_shared/booking_notify_call.ts:1-20`
carries a "CHANGED BUT NEVER EXECUTED" banner — whether the paid notify path has ever run
end to end is unconfirmed. None of the 9 are paid.

---

## 2. The two site shapes — both reach `booking_requests`

- **Freeform sites** (August businesses, stored `format='html'` doc in the srcdoc iframe):
  the "Book" CTA is **a plain navigation link, not a fetch**. `injectHublyRuntime`
  (`_shared/hubly_page_runtime.ts:272`) rewrites the CTA href to
  `https://{slug}.myhubly.app/?book=1` with `target="_top"` (`:310-327`; fallback link `:246`).
  The slug domain serves `hubly.html`, which on `?book=1` opens the **same wizard**
  (`hubly.html:17918-17938` → `openBookingPage` → `submitBooking`). So a freeform Book click
  **does** reach `booking_requests` — via the deep link, because an iframe can't call the
  parent. (A booking made through the freeform **chat widget** instead terminates in `jobs`
  via `createWebsiteBookingJob`, `hubly_booking_execution.ts:393` — a different path, not the
  Book button.)
- **Classic sites** (July businesses, rendered from `businesses` columns, no stored doc): the
  Book button calls `submitBooking()` directly → same `booking_requests` insert.

**Consequence:** all 9 market bookings, regardless of site shape, are `booking_requests`
rows. Confirmed by data — every one of the 9 is in `booking_requests`; `marketplace_bookings`
has 0 market rows.

---

## 3. Forensics — the 9 bookings and 2 jobs

`booking_requests` has **no `updated_at`** column — only `created_at` plus specific event
stamps (`paid_at`, `superseded_at`). So "touched after insert" is proven by a status other
than the `pending` default, a linked/downstream `job` or `customer` row, or a payment stamp
— and there is **no audit/history table** logging booking status transitions
(`business_timeline_events` etc. are all empty for market).

| # | business | created (UTC) | age | status | linked job | payment | membership | downstream evidence |
|---|---|---|---|---|---|---|---|---|
| 1 | bucket-mobile-detailing | 2026-07-20 19:54 | **39 d** | pending | 0 | none | no | none — owner has 0 customers, 0 jobs ever |
| 2 | aquaspeed | 2026-07-22 17:34 | **37 d** | pending | 0 | none | no | none — owner has 0 customers, 0 jobs ever |
| 3 | aquaspeed | 2026-07-22 17:46 | **37 d** | pending | 0 | none | no | none (same customer P, 12 min after #2) |
| 4 | graefs-autocare | 2026-08-05 21:42 | 23 d | **accepted** | 1 | none | no | customer A created 21:46:41; job 21:46:43 → **completed** |
| 5 | graefs-autocare | 2026-08-05 21:57 | 23 d | **accepted** | 0 | none | no | accepted during the same active session (see below) |
| 6 | graefs-autocare | 2026-08-05 22:02 | 23 d | **accepted** | 0* | none | no | job (customer L) 22:02:35 → **completed**; customer L 22:05 |
| 7 | graefs-autocare | 2026-08-11 00:47 | 18 d | **accepted** | 0 | none | no | customer A created 00:48:25 (27 s later) |
| 8 | graefs-autocare | 2026-08-15 07:18 | **13 d** | pending | 0 | none | **yes** | none |
| 9 | graefs-autocare | 2026-08-15 07:20 | **13 d** | pending | 0 | none | **yes** | none (same customer A, 2 min after #8, no email) |

\* #6's job carries `from_booking=true` but no `booking_request_id`; it correlates to #6 by
customer (L) and timing (5 s after the booking).

**The 2 jobs (both Graef's, both `status='completed'`, both `from_booking=true`, unpaid):**
one created 2026-08-05 21:46:43 (customer A, scheduled 08-06) linked to #4; one created
2026-08-05 22:02:35 (customer L, scheduled 08-05) from #6.

**Reading the evidence:**
- `'accepted'` on an **unpaid** booking can only come from the manual owner action
  `acceptBookingRequest()` → `update({status:'accepted'})` (`hubly.html:43670`) — there is no
  auto-accept for unpaid bookings (the Stripe path that auto-accepts requires payment; these
  are `payment_status='none'`). So the 4 accepted rows were **flipped by a human**.
- Graef's `2026-08-05` evening is a single clear session of human activity: bookings #4/#5/#6
  accepted, customers A and L created minutes later, **two jobs created and marked
  completed**. On `2026-08-11` #7 was accepted (customer A created 27 s later) and a customer
  "D" was created **manually with no booking at all** (`2026-08-11 19:26`) — direct proof the
  owner was hands-on in the CRM.
- The **5 pending** rows have no status change, no linked job, no customer, no payment, no
  supersede. Bucket and Aquaspeed owners have **0 customers and 0 jobs in their entire
  history** — no evidence they ever opened the owner app or touched a booking. Graef's #8/#9
  (membership signups) arrived `2026-08-15`, **after** the owner's last observed activity
  (`2026-08-11`), and sit untouched.
- **Who these requesters are (source: Adrian):** all 9, including the 5 pending, trace to an
  owner, family, a founder, or testing — not the public. So "untouched" here means an
  **untouched test**, not a real request no one answered. The owner-activity facts above are
  unchanged; the point is only that no genuine demand was dropped.

---

## 4. Is there an owner surface that shows a booking?

**Yes** — the owner app is `public/hubly.html` itself (the same SPA served at the apex and
every business subdomain, `api/router.js:432`), gated client-side by the Supabase auth
session + `businesses.owner_id` match (`loadBusiness()`, `hubly.html:14425`) + `booking_requests`
owner-read RLS. `loadJobs()` (`hubly.html:15657`) reads `booking_requests where status='pending'`
and merges them into the jobs list. Pending bookings surface on:
- the **dashboard "New bookings" card** — `renderDashNewBookings()` (`hubly.html:48343`), whose
  Accept button is exactly `acceptBookingRequest()` (`:43670`). **AMBIGUOUS:** the `#new-bookings`
  DOM host isn't in the current markup and this classic card is skipped when JourneyOS is
  active (`:40424`) — treat as a legacy render;
- the **JourneyOS dashboard** (current default) — `enhanceDashboard()` (`journey-os/journey.js:14958`),
  pending shown as a "Need review" KPI (`:7196`);
- the **Jobs** view and the **Leads** pipeline, both fed from the same pending pseudo-jobs.

There is no separate `/dashboard` route or legacy admin page for native bookings — it is all
the one signed-in SPA. (`marketplace-lite.html` and `marketplace-ops.html` are the separate
Marketplace product, reading `marketplace_bookings`, and are irrelevant to these 9.)

**Does Graef's have access, and did he open it?** Yes to both, with evidence: his account
owns the business (claimed), and the accept actions themselves (4 rows flipped
`pending→accepted`, 2 jobs completed, a customer created by hand) **are** the record that he
opened the owner app and acted — the accept path is the only way those transitions happen.
**Bucket and Aquaspeed:** the businesses are claimed (owner_id set), so those owners *could*
reach the dashboard, but there is **no evidence any of them ever did** — zero customers, zero
jobs, zero accepted bookings, nothing beyond the pending rows.

---

## 5. Notification evidence — we cannot prove delivery for any of the 9

**The delivery ledger postdates every booking.** `notification_deliveries` is the only table
that records an actual send (Resend receipt); its earliest row across the whole database is
**2026-08-20 23:04** (migration `20260821020000`). **All 9 market bookings are ≤ 2026-08-15.**
So the ledger structurally cannot contain evidence for any of them.

- The 2 `notification_deliveries` rows that exist for market businesses are **not bookings**:
  a `first_visitor` alert sent to **adriansmithee@gmail.com** (you, not the owner) for
  Aquaspeed on 08-28, and a `signup` alert to Window Washing's owner on 08-26.
- There is no per-booking "notified" flag on `booking_requests`, and no other send-log table
  (the only booking-notif rows anywhere — 4 of them — are all post-08-20 and non-market).

**The notify trigger was also down when some of these landed.** The current tree shows the
notify trigger `booking_request_notify` **dropped 2026-08-17** (`20260817020000_drop_booking_request_notify_trigger.sql`)
and its replacement `booking_request_completed_notify` created **2026-08-21**
(`20260821010000`). AMBIGUOUS: I could not find the CREATE migration for the original
`booking_request_notify` in the current tree, so I cannot state whether a notify trigger even
existed when the July bookings (#1–#3) landed. What is not ambiguous: between 2026-08-17 and
2026-08-21 there was **no** booking-notify trigger at all, and no delivery ledger existed
until 2026-08-20.

**Conclusion:** for all 9 bookings there is **no surviving evidence that a notification was
delivered** — not that it failed, but that nothing recorded it and the recording mechanism
didn't yet exist. Do not assume the owners were emailed. (Resend's own logs are external and
were not consulted; if delivery for a specific booking must be established, that is the only
remaining place to look.)

---

## 6. The customer side — the portal has never been used by anyone

- `public/portal.html` does show a customer their appointment status, reading from **`jobs`**
  (not `booking_requests`) via `customer-portal/index.ts:79`, split into upcoming/past with
  status pills.
- A portal link is minted only by `issuePortalAccessToken()` (`_shared/portal_access.ts:48`),
  and its **only caller** is `hubly_booking_execution.ts:432` — i.e. the website/concierge
  (chat/AI) booking path, when the customer has an email. The wizard → `booking_requests` →
  manual-accept path does **not** mint a portal token.
- **Evidence:** `portal_access_tokens` has **0 rows across the entire database** (all
  businesses, not just market). No portal link has ever been issued, so `last_used_at` is
  moot — **no customer has ever opened a booking-status portal**, anywhere. Even Graef's two
  completed-job customers never received one.

---

## Verdict — per booking, is there evidence the owner saw it?

Every requester is internal (owner / family / founder / test; source: Adrian), so "not seen"
below means an untouched test, never a lost real request. **Dead drops: zero.**

| # | business / requester (internal) | verdict |
|---|---|---|
| 4 | Graef's / A (08-05) | **SEEN & WORKED** — accepted by hand, job created and **completed** |
| 5 | Graef's / L (08-05) | **SEEN** — accepted during the same proven active session |
| 6 | Graef's / L (08-05) | **SEEN & WORKED** — job created and **completed** |
| 7 | Graef's / A (08-11) | **SEEN** — accepted; customer created 27 s later |
| 1 | Bucket / A (07-20) | **NOT SEEN (untouched test)** — pending 39 d; owner created no customer/job; no delivery evidence |
| 2 | Aquaspeed / P (07-22) | **NOT SEEN (untouched test)** — pending 37 d; owner created no customer/job; no delivery evidence |
| 3 | Aquaspeed / P (07-22) | **NOT SEEN (untouched test)** — pending 37 d; same |
| 8 | Graef's / A (08-15, membership) | **NOT SEEN (untouched test)** — pending 13 d, no downstream, after owner's last activity |
| 9 | Graef's / A (08-15, membership) | **NOT SEEN (untouched test)** — pending 13 d, no downstream |

**Plainly:** **no real customer's request was dropped** — Hubly has never received a booking
from a member of the public; that count is still zero, all the way back. The 5 unseen rows
are untouched **tests**, not lost demand. The 4 Graef's bookings were seen and acted on by a
human (accepted, two jobs completed). And for **every** one of the 9, we cannot prove a
notification was delivered, because the mechanism that would record one did not exist yet.

**The design lesson survives the correction, as a hypothetical.** These 5 were tests, so
nothing was lost — but the *mechanism* that left them unseen is real: a pending booking's only
home is a signed-in dashboard the owner may never open, and (in the 08-17→08-21 window) with
no notification trigger and no delivery ledger at all. If a real request had landed the same
way, the same structure would have left it unseen and unrecorded. That is a fact about the
plumbing, stated without inventing a victim.

**Ambiguities flagged, not resolved:** (a) whether any notify trigger fired for the pre-08-17
bookings (the original trigger's CREATE isn't in the current tree); (b) whether Resend
actually delivered anything pre-ledger (external logs not consulted); (c) #5's accept has no
distinct downstream row — it is inferred "seen" from the surrounding active session, not from
its own artifact; (d) the "New bookings" dashboard card's current mount status under JourneyOS.
