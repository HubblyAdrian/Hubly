# Shell terrain — facts for the post-claim shell

Read-only survey, 2026-08-29. **Facts and file references only — no proposals, no
design.** Where something could not be determined it is marked `AMBIGUOUS`. Data counts
are filtered to `account_kind = 'market'` (the 7 genuine outside businesses); that is a
small denominator — every number below is out of **N = 7 market businesses**, all claimed.

> **EVERY DATA COUNT IN THIS FILE IS DATED 2026-08-29 AND HAS NOT BEEN RE-VERIFIED.**
> That includes the §0 per-business table and the whole §4 inventory (services 9,
> booking_requests 9, customers 4, jobs 2, `commerce_products` 0, `commerce_orders` 0,
> `settings_business_hours` 0, `portfolio_photos` 0, `stripe_connect_accounts` 0, …). A
> re-check was attempted on 2026-09-02 and could not run: no database credentials in that
> environment (`.env.local` holds only a Vercel OIDC token; the linked CLI's pooler URL has
> no password). **Re-pull before quoting any of these as current** — most of all the zeros,
> because a zero that has since become non-zero is exactly the kind of stale fact that gets
> read as "nobody uses this" and used to justify deleting something.
>
> The §2/§3/§6 code references were re-read on 2026-09-02 and still hold, with one
> correction: §2's "Text color / font swatches — **works on AST, hidden/dead on freeform**"
> understates it. They are not merely hidden — `applyDirectFreeformEdit` has no
> attribute/class/style op at all, so styling is structurally impossible on a freeform page.
> Since every market page is freeform, colour and font reach no real business.
> See `STATE.md` "Click-to-edit".

Schema note: `docs/schema.sql` is a full introspected dump of the live tables (core
operational tables live there, not in `supabase/migrations/`, which holds deltas).

---

## 0. The 7 market businesses (the whole market corpus)

| slug | type | created | website doc | bookings | services | customers | jobs |
|---|---|---|---|---|---|---|---|
| aquaspeed | detailing | 2026-07-11 | none | 2 | 3 | 0 | 0 |
| graefs-autocare | detailing | 2026-07-11 | none | **6** | 0 | **4** | **2** |
| devdetailing661 | detailing | 2026-07-13 | none | 0 | 0 | 0 | 0 |
| bucket-mobile-detailing | detailing | 2026-07-20 | none | 1 | 0 | 0 | 0 |
| detailing-chemicals-equipment-courses | detailing | 2026-08-22 | html | 0 | 4 | 0 | 0 |
| mobile-auto-detailing-in-los-angeles | detailing | 2026-08-22 | html | 0 | 0 | 0 | 0 |
| window-washing | windows | 2026-08-26 | html (2 versions) | 0 | 2 | 0 | 0 |

**The single most important terrain fact:** the businesses with a **stored website**
(the 3 August `format='html'` freeform docs) have **zero** bookings/customers/jobs, and
the businesses with **pipeline data** (graefs-autocare: 6 bookings / 4 customers / 2 jobs;
aquaspeed: 2 bookings) have **no stored website document at all** (`business_documents`
= 0 **and** `website_pages` = 0 for all 4 July businesses). Their public site therefore
renders from the classic archetype renderer off the `businesses` columns + `services`
table, not from a stored document (classic renderer confirmed in §3). `graefs-autocare`
is the only business exercising the booking→customer→job pipeline.

**Who that pipeline data represents (do not read it as market demand):** every booking in
the corpus — the 9 above included — traces to an owner, family, a founder, or testing, not
to a member of the public. Hubly has never received a booking from a stranger (count is zero,
all the way back; source: Adrian, and see `docs/BOOKING_DESTINATION.md`). So the booking/
customer/job counts here are **real rows of internal/test activity**, not evidence of real
customers. A row is not a person — treat these numbers as "the pipeline has been exercised",
never as "N real customers booked".

(Note on identity: `mobile-detailing`, `lugnutz`, `pike-holloway-tree-service`,
`larkspur-landscaping` etc. are **not** `market` — do not count them here.)

---

## 1. What claim actually does today

**Entry → claim, in order** (`public/platform-home.html`):
1. `hcHandleOpenAccount()` (`:3569`) — from the block-level "Create your account" button
   (`:2126`), the reserved-offer buttons (`:1092`), or the model returning
   `data.openAccount === true` (`:2319`).
2. `authOpen()` (`:3553`) — opens the one-door modal.
3. Authenticate: **email + 6-digit code** (`verifyOtp`, ~`:3700`) or **Google OAuth**
   (`authGoogle()` `:3765`, redirects to `location.origin + '/?hcauth=1'` `:3777`).
4. `hcAfterAuth()` (`:3936`) → `hcClaimDraft()` (`:3848`).
5. The claim RPC: `platform-home.html:3852` —
   `c.rpc('claim_draft_business', { p_draft_id, p_draft_token })`.

**What the claim writes to the DB:**
- RPC `claim_draft_business` (`supabase/migrations/20260821110000_claim_draft_business.sql`,
  `security definer`, authed-only). The **only** column it writes is
  `businesses.owner_id` (`:65-69`), guarded against already-claimed / bad-token / race.
- A `BEFORE UPDATE` trigger `trg_mark_test_on_claim` → `mark_test_on_claim()` fires on
  that update. Authoritative version:
  `supabase/migrations/20260825130000_owner_identified.sql:35-52`. Behaviour: on the
  claim transition it reads the owner's email from `auth.users`; a **tester** email
  (`adriansmithee%`, `%@hublytest.dev`, `test@%`, a `+` in the local part, …) →
  `account_kind := 'test'`; otherwise the pre-claim default `'test'` →
  `account_kind := 'market'`. It **never** sets `owner_identified` — that column defaults
  `false` (`:16-17`) and is only flipped by hand-classification.
- Net for a real signup: `owner_id` set, `account_kind → 'market'`, `owner_identified`
  stays `false`. Also, just before claim, `set_draft_signup_device` records the device
  (`platform-home.html:3964`).

**Post-claim landing — there is no dashboard.** The owner **stays in the builder**
(`platform-home.html`); there is no redirect to `hubly.html`, `/dashboard`, or anywhere.
Inside `hcAfterAuth` on success (`:3973-3992`): `hc.draftClaimed = true`; the address
pill flips from "reserved" to the live link (`hcUpdateAddressBar` `:3975`); the preview
iframe is told it's authed (`hcTellPreviewAuthed` `:3976`); `hcConfirmSignedIn` (`:3910`)
supersedes the "reserved for you" message and appends **"You're in — this is your site,
and it's live at &lt;host&gt;. Keep editing whenever you like."** (`:3926`). The first
post-claim screen is the **same builder** (live-site preview canvas + chat thread), now
in owned/editable state.
- Owner re-entry on later loads: `hcLoadOwnedBusiness()` (`:3269`) → `get_my_businesses`
  (`:3274`); owns one → open it; owns several → last-worked or a **picker** (`:3281`),
  not a dashboard.

**Mobile vs desktop:** the modal, RPC, and claim logic are shared. The **only** explicit
branch is `platform-home.html:3991` — on mobile, `hcSetMobileView('chat')` so the "you're
in" line is visible; desktop shows both panes. (`hcIsMobile()` = `matchMedia('(max-width:700px)')`
`:1402`.) iOS storage nuances (ITP/Private Browsing) are handled in comments/behaviour,
not a viewport code branch.

---

## 2. What a claimed owner can do right now

There are **two distinct editors** in `public/hubly.html`; do not conflate them.

**(A) The post-claim click-to-edit canvas shell** — gated by `hcEditable=1`, set only when
`hc.draftClaimed && hcIsAuthed()` (`platform-home.html:1532`). This is what "nothing is
editable until claimed" turns on. See §3 for exactly what it edits.

**(B) The classic `ed-shell` / PE-popup website editor** — gated by `isEditorViewOpen()`
(`hubly.html:33849`), opened via `openWebsiteEditorHub` / `goEdSettingsNav`. This is a
richer, mostly-working editor (hours, services, FAQ, socials, deposit).
- **AMBIGUOUS (flag for the shell):** which of these two a freshly-claimed owner is
  actually routed into could not be proven from the client files alone. The claim flow
  (§1) lands in the builder canvas (editor A); how/whether an owner reaches editor B
  post-claim is unconfirmed.

**Surface inventory — works / placeholder / dead:**

Editor A (click-to-edit canvas):
- Hero headline / subhead / image (legacy path) — **works** (`hubly.html:52914-52999` →
  `platform-home.html:3081`).
- Any leaf text node, any image (AST or freeform) — **works** (`hubly.html:53434-53473`).
- Text color / font swatches — **works on AST, hidden/dead on freeform**
  (`hubly.html:53376`, rationale `:53371`).
- Structural edits (move / add / remove sections) — **dead / not offered**; server
  returns `unsupported_op` (`_shared/hubly_capability_registry.ts:1246`).

Classic renderer / editor B — placeholders & fabricated data shown to the owner:
- **Business hours are fabricated defaults** (Mon–Fri 8–5, Sat 8–3, Sun 9–5) invented in
  **three** places: `hubly.html:18101`, `:35833`, `:52272`. Data confirms it: **0 of 7**
  market businesses have any `settings_business_hours` row — every displayed hour is invented
  unless the owner edits it. The hours PE editor popup itself **works + persists**
  (`openHoursPeEditor` `:35832`, `applyWsPeHours` `:35851`).
- "Add contact info in the editor" — **placeholder string** (`wsAddContactInfo`,
  `hubly.html:50557` en / `:51491` es; rendered `:39328`). Real contact fields
  (`ed-phone`/`ed-email`/`ed-city`) behind it **work**.
- "Tap to add contact" hero pill — **placeholder label, no click handler** (`:38988`).
- "Add your location to show the map" — **placeholder string** (`wsAreaAddLocation`,
  `:50546` / `:51480`; rendered `:39287`).
- `goEdSettingsNav('packages')` settings accordion — **dead** (closes the sheet and dumps
  the owner back to canvas; per-package payment field unreachable) (`:36082-36091`).
- Duplicate service — **partial/placeholder**: `duplicateEditorService?.() || toast('Duplicate coming soon')`
  (`:34253`); other duplicate → "available … soon" (`:34256`).
- Voice-input mic (welcome) — **dead/hidden**, `aria-label="Voice input coming soon"` (`:10243`).
- Profile custom-tab body / story (public, empty) — **placeholder "Coming soon"**
  (`:35634`, `:35724`).
- Gallery / services / memberships empty states — **placeholder prompts** "Tap to add …"
  (`:35651`, `:35661`, `:35670`).
- Language toggle on some generated views — **dead** (removed on that view, `:17623`).

`platform-home.html` builder surfaces:
- Attach button — **works** (the old 8-item classify menu was removed; "6 of 8 were dead",
  `:3118`). Inspiration link inputs — **work** (`:3108`). Logo upload — **works**
  (`business.setLogo`, `:3139`).

---

## 3. Where editing lives post-claim, and whether it can touch a freeform page

- **Page that serves it:** the generated page `public/hubly.html`, loaded as the canvas
  iframe inside `platform-home.html`. Freeform (`format='html'`) mounts into a same-origin
  `srcdoc` iframe (`hcMountDocumentHtml` `:17361`, `hcIsFullDocument` `:17361`); AST mounts
  via `innerHTML`.
- **Gate:** `hcEditable=1` only (claimed+authed); `hcEditableEnabled()` (`hubly.html:52909`),
  `wireHublyDocumentClickToEdit` returns unless `hcEditable==='1'` (`:53201`, wired `:17632`).
- **Freeform IS editable post-claim** — for **text and images**, not styling:
  - Selector `EDITABLE_SEL = '[data-node],[data-hc]'` (`:53434`); `data-hc` is the freeform
    handle. Leaf text only (`if(target.children.length>0) return` `:53471`); images open a
    file picker (`:53465`); color/font row hidden for freeform (`:53376`).
  - Save path: canvas posts `hcFreeformInlineEdit` / `hcFreeformInlineImageEdit`
    (`:53391`, `:53424`) → `platform-home.html:3081` → edge `hubly-conversation`
    (`index.ts:1096-1216`) → `applyDirectFreeformEdit` (`_shared/hubly_capability_registry.ts:1419`;
    rejects non-`html` with `wrong_format` `:1437`; string-patches `rendered_html` and
    persists with `p_created_by:'patch'`).
- **AST path** is parallel: `applyDirectDocumentPatch` (`capability_registry.ts:1237`;
  rejects non-`ast`; re-renders and persists). AST additionally allows color/font.
- Both shapes are hard-guarded to their own path (wrong format → `wrong_format`, no-op).
  All four edit shapes are also blocked when `!DOCUMENT_GENERATION_ENABLED`
  (`hubly-conversation/index.ts:1180`).
- **Not covered:** the click-to-edit editor touches only what the generated document
  contains as `[data-hc]`/`[data-node]` leaves. Post-build **record** facts (services
  prices, hours, area, logo, contact) have their own patch path (the anchor work,
  finding #7/#8) and are **not** what this editor changes.

---

## 4. Data that exists per business (what a shell could show)

Aggregate across the 7 market businesses (per-business distribution in §0):

| table / field | market rows | notes |
|---|---|---|
| `services` | 9 (all 9 priced) | across 3 businesses (aquaspeed 3, detailing-chemicals 4, window-washing 2) |
| `booking_requests` | 9 | statuses: **5 pending, 4 accepted**; across 3 businesses (graefs 6, aquaspeed 2, bucket 1) |
| `customers` | 4 | all graefs-autocare |
| `jobs` | 2 | all graefs; **0 paid, 0 recurring** |
| `business_documents` | 4 | 3 businesses, all `format='html'`; window-washing has 2 versions |
| `placed_images` | 6 | stock/generated images (3 businesses); **not owner photos** |
| `portfolio_photos` | 0 | no owner-uploaded work photos anywhere |
| `gallery_items` | 0 | — |
| `review_submissions` | 0 | — |
| `notification_deliveries` | 2 | — |
| `service_area_cities` (jsonb on businesses) | 2 have it | — |
| `phone` | 3 have it | — |
| `logo_url` | 4 have it | — |
| `years_in_business` | 0 have it | — |
| `settings_business_hours` | **0** | hours shown on sites are fabricated (see §2) |
| `website_pages` | **0** | legacy table, unused by market |
| commerce_products / commerce_orders | 0 / 0 | store scaffolding unused |
| `stripe_connect_accounts` | 0 | no market business has connected Stripe |
| `memberships` / `recurring_schedules` | 0 / 0 | — |
| `settings_subscriptions` | 0 | (this is Hubly's own SaaS plan for the owner, not customers) |
| marketplace_requests / marketplace_messages | 0 / 0 | — |
| ask_hubly_conversations | 0 | — |
| business_timeline_events | 0 | — |
| portal_access_tokens | 0 | no customer portal links issued for market |

Everything not listed with a positive count is **schema present, zero market rows**.

---

## 5. Signals that could "earn" a tab

**Signals that already exist in the data** (a tab could key off these today):
- **Bookings / requests** — `booking_requests` rows with `status` (`pending` / `accepted`).
  Present for 3 of 7 businesses; the `pending` count is a natural badge signal.
  (`docs/schema.sql:2113`.)
- **Jobs / schedule** — `jobs` rows with `status` (default `scheduled`), `scheduled_date`/
  `scheduled_time`, `paid`, `booking_request_id` (booking→job link), `assigned_to`. Present
  for 1 business (graefs). (`docs/schema.sql:3556`.)
- **Customers / CRM** — `customers` rows. Present for 1 business (graefs). (`schema.sql:3128`.)
- **Services / menu** — `services` rows (priced). Present for 3 businesses.
- **A published site** — a `business_documents` row (`format='html'`). Present for 3
  businesses; its absence (July businesses) is itself a signal (site is classic-from-columns).

**Signals we would have to invent** (schema exists but **0 market rows**, so nothing to key
off yet — or no signal at all):
- Payments received — `jobs.paid` exists but is `false` everywhere; no Stripe connected.
- Recurring / memberships — `recurring_schedules`, `memberships` empty.
- Store / orders — `commerce_*` empty.
- Reviews — `review_submissions` empty.
- Owner photos / gallery — `portfolio_photos`, `gallery_items` empty.
- Customer-portal activity — `portal_access_tokens` empty for market.
- Any "activity timeline" — `business_timeline_events` empty.
- Hours-set, area-set, logo-set as completeness signals exist as fields but are sparse
  (hours 0/7, area 2/7, logo 4/7).

---

## 6. What's missing entirely (per capability: code today, or greenfield)

- **Subscriptions / recurring billing** — data model **exists**, automated billing is
  **greenfield**. `memberships` (`schema.sql:3997`, migration `20260811180000`) is a read
  projection of a plan (mirrors a `[RP]{json}` tag in `customers.notes`), no Stripe, no
  charge scheduling. `recurring_schedules` (`schema.sql`, migration `20260811040500:35`) is
  **operational repetition only** — the migration is emphatic that scheduling and billing
  are "deliberately not connected". `settings_subscriptions`/`settings_billing`
  (`20260727130000`) are **Hubly billing the owner**, not the owner billing customers.
  No code charges a card on a cadence.
- **Location / day routing** — **greenfield**. Only static coverage exists:
  `service_area_cities` + `travel_radius_miles` (one fixed zone;
  `generate-site/index.ts:123,190`, `hubly.html:16011`). The "Route" button just opens
  Google Maps to a single job's address (`openJobRouteById` `hubly.html:48336`). No
  table/function assigns a different location to different days/times.
- **Job execution / dispatch** — **partial**. `jobs` is a real execution record (`status`
  default `scheduled`, `scheduled_date/time`, `paid`, `assigned_to` (free text),
  `booking_request_id`, full Google-Calendar sync columns; `schema.sql:3556`). Booking→job
  creation exists (`_shared/hubly_booking_execution.ts`). A true dispatch engine
  (crew/technician table, work-order lifecycle beyond a `status` string, dispatch board) is
  **greenfield** — `assigned_to` is plain text, no crew table found.
- **Customer-side view** — a **narrow magic-link portal exists**: `public/portal.html`
  ("My Appointments", noindex) + edge `customer-portal/index.ts` (a "deliberately narrow,
  customer-safe projection" of customers/jobs/recurring/memberships) + `portal_access_tokens`
  (SHA-256 magic links, 30-day, RLS default-deny; migration `20260811210000:15`). **No**
  customer login/password, signup, order history, or self-service reschedule. (Not to be
  confused with `customer_profiles` at `schema.sql:3104`, which is an AI-runtime identity.)
- **Messaging (two-way owner↔customer)** — **split**. Two-way threads exist **only in the
  separate Marketplace product**: `marketplace_conversations` (`schema.sql:3757`),
  `marketplace_messages` (`schema.sql:3811`, `sender_role` provider/customer/system),
  server `marketplace/index.ts` (`message_send` etc.), client `marketplace-lite.html:577`.
  In the **core Hubly CRM** (`hubly.html`) owner→customer comms are **one-way, AI-drafted,
  owner-approved**: `draft-customer-message/index.ts` (drafts only, "never sends"),
  `send-customer-email/index.ts` (sends what the owner reviewed). **No inbound SMS/reply
  capture** (no Twilio inbound handler found; `booking_requests.sms_consent` is
  outbound-consent only). Core-CRM two-way messaging is **greenfield**.

**Context infrastructure that DOES exist** (the shell builds near these):
`booking_requests` intake + `create-booking-checkout` + `stripe-webhook`; the
`booking.create` capability (`hubly_capability_registry.ts:136`) wrapping the `marketplace`
edge function; job creation + Google-Calendar sync functions; one-way notifications
(`_shared/booking_notifications.ts`, `booking-notify`, `booking-confirmed`,
`notification_deliveries` `20260821020000`).

---

## Open ambiguities (consolidated — resolve before designing)

1. **Two products, one DB.** "Marketplace" (`marketplace_*` tables, `marketplace-lite.html`)
   and core "Hubly" (`jobs`/`customers`/`booking_requests`, `hubly.html`) are separate
   surfaces sharing the database. Confirm which one the post-claim shell targets — bookings
   and two-way messaging live in *different* tables depending on the answer.
2. **Which editor a claimed owner lands in** — the click-to-edit canvas (editor A, proven
   from the claim flow) vs the classic `ed-shell` (editor B, richer, mostly working). The
   entry point into B post-claim is unproven from the client files.
3. **The website/activity disjoint (§0)** — market businesses either have a stored freeform
   site *or* booking-pipeline rows (all internal/test — see §0), never both. A shell that
   assumes both exist for one business has no market example to test against; graefs-autocare
   (most pipeline data) has no stored document.
4. **Customer portal scope** — read-mostly "what's next", not a full account; confirm whether
   the shell needs customer write/self-service.
