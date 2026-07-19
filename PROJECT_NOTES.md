# Hubly — Project Notes

Last updated: 2026-07-19

This file exists so any AI tool (Cursor, a future Claude session, a human)
can pick this project up without re-discovering everything from scratch.
Nothing about this project is locked to Claude — the code lives in a real
GitHub repo, the backend lives in a real Supabase project, and both are
fully owned by the account holder.

## What Hubly is

A SaaS scheduling/CRM app for mobile auto-detailing businesses.
$29/month, 14-day trial. Each detailer gets a public booking page at
`{slug}.myhubly.app`.

## Stack

- **Frontend**: single-file HTML/JS app — `public/hubly.html`. No build
  step, no framework. Vanilla JS with template-literal HTML rendering.
  Deployed via Vercel, auto-deploys on push to `main`.
- **Repo**: `HubblyAdrian/Hubly` on GitHub.
- **Backend**: Supabase (project ref `rtwxxkxpkqdrhclkozma`) — Postgres +
  Auth + Edge Functions + Database Webhooks + Storage.
- **Storage**: public bucket `brand-assets` for logos/banners. Paths are
  `{owner_id}/{kind}-{timestamp}.jpg`. Owners write only under their
  `auth.uid()` folder; anyone can read (public site needs the URL).
- **Email**: Resend, domain `notifications.myhubly.app`. Secrets:
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- **Receipts**: No Twilio SMS send. Receipt modal uses Copy message / native
  Share / Open PDF (print-to-PDF) for phone-friendly workflows.
- **AI**: Anthropic API, called from Supabase Edge Functions using
  `claude-haiku-4-5-20251001` (switched from Sonnet 5 for cost — quality
  holds up fine for this use case). Secret: `ANTHROPIC_API_KEY`.

## Database schema (key tables)

- **businesses** — id, name, slug, phone, email, logo_url, banner_url,
  font, services (jsonb or separate table depending on era of the code —
  check `S.services` in the frontend), timezone, buffer settings.
- **jobs** — id (uuid), business_id, customer_name, service_name,
  scheduled_date, scheduled_time, address, amount, notes, status
  (`pending` | `scheduled` | `completed`), from_booking (bool), phone,
  email, vehicle, vehicle_color, paid (bool), pay_method, pay_notes,
  paid_at, plus Sync Engine fields: `hubly_job_id`, `google_event_id`,
  `last_synced_at`, `last_google_update`, `last_hubly_update`,
  `sync_status` (`idle`|`pending`|`synced`|`conflict`|`error`|`local_only`),
  `google_etag`, `hubly_push_at`.
- **customers** — id (uuid), business_id, name, phone, email, vehicle,
  vehicle_type, vehicle_year, vehicle_make, vehicle_model, vehicle_color,
  preferred_service, customer_type (`one_off` | `recurring`),
  recurring_amount, notes.
- **booking_requests** — the public booking form writes here first
  (status `pending`); accepting one inserts a real row into `jobs` and
  marks the request `accepted`.
- **google_calendar_connections** — one row per business: google_user_id,
  google_email, calendar_id, refresh_token, access_token,
  access_token_expires_at, connected_at, last_sync_at (null until sync).
  RLS on with no client policies — tokens only via service-role edge
  functions.
- **google_calendar_oauth_states** — short-lived CSRF states for OAuth.
- **google_calendar_events** — imported Google events (google_event_id
  unique per business). Owners can SELECT; writes via sync function only.
  Shown on Jobs calendar as blue blocked time.

## Edge Functions

- **booking-notify** — fires on insert into `booking_requests` via a
  Database Webhook (`booking_request_notify`, already configured in
  Supabase → Database → Webhooks). Emails the customer "we got your
  request."
- **booking-confirmed** — source:
  `supabase/functions/booking-confirmed/index.ts`. Call directly from the
  frontend (`db.functions.invoke('booking-confirmed', {...})`) right after a
  detailer accepts a booking. Emails the customer a confirmation with an
  .ics calendar attachment. **This is not triggered by a webhook** — it's
  called explicitly in `acceptBookingRequest()` in the frontend. Field names:
  `business_id`, `customer_email`, `customer_name`, `service_name`, `date`,
  `time`, `address`, `vehicle`, optional `duration_hours`. Requires auth +
  business ownership. Deploy: `supabase functions deploy booking-confirmed`
  (needs `RESEND_API_KEY`, `RESEND_FROM_EMAIL`).
- **ai-advisor** — powers the "Ask AI" dashboard widget. Pulls the
  business's own jobs/customers, builds a compact summary server-side
  (revenue this month, upcoming week, stale customers, top spenders),
  and asks Claude to answer using only that summary. Expects
  `{business_id, question}`, returns `{answer}` or `{error}`.
- **google-calendar-oauth-start** — starts per-owner Google Calendar
  OAuth. POST `{business_id, return_to?}` → `{url}`. Scopes:
  `calendar.events` + `calendar.readonly` + openid/email/profile.
  `return_to` host-allowlisted. Secrets: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_OAUTH_REDIRECT_URI`,
  `HUBLY_APP_URL`.
- **google-calendar-oauth-callback** — Google redirect URI; exchanges
  code, stores tokens in `google_calendar_connections`, re-validates
  `return_to`, redirects with `?gcal_oauth=connected|error`.
- **google-calendar-connection** — POST `{action:'status'|'disconnect',
  business_id}`. Status never selects refresh tokens. Returns email,
  picture, calendar_name, last_sync, watch_active, last_error.
- **google-calendar-sync** — POST `{business_id}` imports primary-calendar
  events (−30d…+90d) into `google_calendar_events` (page-capped).
- **google-calendar-push-job** — Sync Engine create/update/delete.
  Update never silently creates; missing link → explicit create.
- **google-calendar-webhook** — Authenticated via channel id + random
  `watch_channel_token` + resource id (not business_id). Debounced;
  single-flight inbound lock.
- **google-calendar-inbound-sync** — Owner-triggered poll + watch renew.
- **google-calendar-maintain** — Cron worker: expire OAuth states, renew
  watches, poll stale tenants. Auth: `x-hubly-cron-secret` or service
  role bearer. Set `HUBLY_CRON_SECRET`.
- **stripe-connect-onboard** — starts Stripe Connect Express onboarding
  for the signed-in owner. POST `{business_id, return_to?}` → `{url}`.
  Creates/reuses `stripe_connect_accounts` row. Secrets: `STRIPE_SECRET_KEY`,
  optional `HUBLY_APP_URL`.
- **stripe-connect-connection** — POST `{action:'status'|'disconnect'|
  'dashboard', business_id}`. Status refreshes charges/payouts flags from
  Stripe. Never exposes secret keys.
- **create-booking-checkout** — public-safe Checkout Session for deposit
  or full payment. POST `{business_id, charge_kind, amount_dollars,
  booking, success_url, cancel_url}` → `{url}`. Requires Connect account
  with `charges_enabled`. Optional `STRIPE_APPLICATION_FEE_PERCENT`.
- **stripe-webhook** — `account.updated` + `checkout.session.completed`.
  `verify_jwt=false`; authenticity via `STRIPE_WEBHOOK_SECRET`.

Shared: `_shared/google_calendar_security.ts`, `_shared/google_calendar_sync.ts`,
`_shared/google_calendar_sync_engine.ts`, `_shared/google_calendar_inbound.ts`,
`_shared/stripe.ts`.

All edge functions use `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
Deno.env.get("SUPABASE_SECRET_KEYS")` for the service-role client — the
project has both secret names floating around from different eras, this
pattern covers either.

### Stripe Connect secrets (Supabase Edge)

```
STRIPE_SECRET_KEY=sk_live_…   # or sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
HUBLY_APP_URL=https://myhubly.app
# optional platform fee, e.g. 2 for 2%:
# STRIPE_APPLICATION_FEE_PERCENT=0
```

Webhook endpoint: `https://<project>.supabase.co/functions/v1/stripe-webhook`
Events: `account.updated`, `checkout.session.completed`.

### Marketplace — AI-first booking engine (vision + foundation)

**Philosophy:** Hubly is not Google/Yelp/Angi/Thumbtack. Customers should not
browse businesses. They describe a job (“I need my windows cleaned”); Hubly’s
AI intakes, matches, and books. Feel: ChatGPT + Uber + Airbnb.

**Do not build** a search-first marketplace homepage (search bars, category
grids, maps, endless provider cards, long filter panels).

**Customer flow**
1. Entry (`/get-done`): “What can we help you get done today?” + large
   conversational input + suggested prompts.
2. **AI Concierge v2** (Phase 2 complete when all six exist):
   1. Customer describes the problem naturally
   2. AI understands the job automatically
   3. AI recommends the appropriate service (+ short Why)
   4. AI asks only essential follow-ups (never what it already knows)
   5. Customer confirms **Your Booking** (Looks good / Edit / Add / Continue)
   6. AI matches the best providers

   Philosophy: *Every AI interaction should reduce uncertainty, not
   increase conversation.* Prefer ending the conversation.

   - Live **Building Your Booking** panel (`booking` on intake)
   - Industry knowledge packs + preference inference + personalized why
   - Modules: `marketplace_intake.ts`, `marketplace_job.ts`,
     `marketplace_industry_knowledge.ts`, `marketplace_booking_state.ts`
3. **Phase 3 — Recommendation engine** (`POST /match`) — **FROZEN**
   Audit complete (checklist below). Do **not** polish matching further.
   Philosophy: Google finds businesses; **Hubly helps hire the right one**.
   Never a directory. Ranking stays; **presentation is job-specific**.
   Optimize for: exact job · likely to complete successfully · fastest path
   to a confirmed booking — not rating/reviews/distance alone.
   - Ranking: availability, specialization, distance (city/service area),
     completion, Instant Book, marketplace quality, response reliability
   - **Match explanation** before cards: what Hubly looked for on *this* request
   - Labels from the job — almost never “Best Overall”
   - “Why Hubly matched them” — fit for *this* job, not generic quality
   - Trust indicators + three choices + optional Browse More
   See `marketplace_match.ts` (`buildMatchExplanation`, `labelsForJob`).

   **Phase 3 freeze checklist (PASS)**
   - [x] Natural language intake → exact job understanding → smart follow-ups
   - [x] Job-specific matching + full ranking dimensions
   - [x] Transparency: explain criteria before recommendations
   - [x] Cards: dynamic label, why matched, trust, availability, Book/Request
   - [x] Decision: three excellent matches; Browse More optional
   - [x] Feels like a local expert — not a search directory

4. CTAs: **Book Now** / **Request Booking** / **Schedule Service**. Avoid
   “Get Quotes”. Goal = paid jobs.

**Roadmap (next milestones)**
- **Phase 4 — Booking Engine** (IN PROGRESS): Review Match → Choose Service
  (Shared Service Catalog) → real Appointment → Payment rules → Confirmation.
  Provider-agnostic `booking_engine.ts` (service_id / duration / pricing /
  availability / payment rules only). Statuses: requested → confirmed →
  in_progress → completed | cancelled. Instant Book auto-confirms + reserves
  calendar + Google push; otherwise Booking Request. Provider/customer email
  notify; owner Accept/Decline in Marketplace → Bookings; Stripe checkout
  links `marketplace_booking_id`. One engine for marketplace / websites /
  future AI / Hubly Pro.
- **Phase 5 — Marketplace Lite Dashboard** (Dashboard, Bookings, Messages,
  Services, Availability, Profile, Payouts — no CRM/automations/pipelines)
- **Phase 6 — Shared Services** (single SoT across marketplace / website /
  booking / AI)
- **Phase 7 — AI Onboarding** (get providers marketplace-ready fast)

**Services = single source of truth** (packages / editor services on the Hubly
business). Power marketplace, website, booking page, AI matching, future CRM.
Do not duplicate service data into marketplace tables.

**Infrastructure**
- **Tables:** `marketplace_providers` (1:1 with `businesses`, no profile
  duplication), `marketplace_bookings`, `marketplace_requests`.
- **Edge function:** `marketplace` (`verify_jwt=false`; auth on settings).
  Routes: providers, provider/:id, document, settings, ops, availability,
  book, request, **intake**, **match**. Action-style invoke supported.
- **Shared:** availability, score, provider, document, lifecycle, http,
  `marketplace_intake.ts`, `marketplace_match.ts`.
- **Owner UI:** app nav → Marketplace (listing toggles; “Accept booking
  requests” — DB field still `accept_quote_requests`).
- **Consumer UI:** `public/get-done.html` at `/get-done` (router special-case).
- **Lifecycle:** `draft` | `hidden` | `pending_verification` | `verified` |
  `paused` | `suspended` | `rejected`. Only `verified` is public / bookable.
- **AI document** `hubly.marketplace.provider.v1` + ops verify/reject/etc.
  via `x-hubly-marketplace-ops: $HUBLY_MARKETPLACE_OPS_SECRET`.
- Deploy function:
  `supabase functions deploy marketplace --project-ref rtwxxkxpkqdrhclkozma`.

## Known gotchas (bit us more than once)

1. **ID type mismatches.** Locally-created records (before a DB round
   trip) get a JS `Date.now()` numeric id. DB-persisted records get a
   real UUID string. Any `onclick="fn(${x.id})"` in a template literal
   must be **quoted** (`fn('${x.id}')`) or it breaks for UUID ids (invalid
   JS syntax — the browser silently does nothing). And any
   `array.find(x => x.id === someId)` should compare
   `String(x.id) === String(someId)` rather than `===`, since one side
   may be a number and the other a string. This exact bug has shown up in
   at least four places (job clicks, mark-paid, receipts, customer
   clicks) — if something "does nothing when clicked" for
   newly-created-but-not-yet-reloaded records, check this first.
2. **Customer/job persistence.** `upsertCustomer()` writes to the real
   `customers` table now (it didn't for a while — a past bug meant
   customers only lived in memory and vanished on refresh). If you touch
   this function, keep the `_persisted` flag pattern — it's how the code
   tells a real DB row apart from a local-only fallback object (used when
   `currentBusiness` isn't set yet).
3. **Duplicate CSS class names.** `.nav-badge` was reused for two unrelated
   things (the sidebar logo badge and the pending-jobs count pill), and
   they fought each other's sizing. Split into `.nav-badge` and
   `.nav-count-badge`. Worth grep'ing for other accidental class reuse
   before assuming a CSS bug is something else.
4. **KPI card date filtering.** "Revenue" and "Jobs this month" used to
   silently include *all-time* data despite the label — always confirm a
   "this month" label actually filters by the current month
   (`isThisMonth()` helper exists now, use it).

## Deployment method (matters if you're not using normal git)

During Claude browser-automation sessions, there's no direct filesystem
access to the deployed repo, so changes get made by: fetching the raw
file from GitHub, applying string replacements in-browser via JS, then
uploading the patched file back through GitHub's web upload UI and
committing. **This is a workaround, not the recommended way.** If you're
working from Cursor (or any tool with real filesystem + git access), just
clone the repo and use normal `git add / commit / push` — it's simpler
and Vercel will auto-deploy on push to `main` either way.

Edge functions are deployed via the Supabase dashboard's function code
editor (or `supabase functions deploy` via the Supabase CLI if you have
it set up locally — recommended over the dashboard editor for anything
beyond quick fixes).

## Current AI feature set

- **Ask AI** (dashboard widget) — one-shot Q&A about the business's own
  data. Not a persistent conversation yet. The frontend now injects a
  compact weather forecast summary into the AI prompt when available, so
  weather-aware reschedule advice works even if the edge function code
  hasn't been redeployed yet.
- Ideas discussed but not yet built: a dedicated AI tab with saved
  conversation history (bigger lift — needs a conversations/messages
  table and a rework of ai-advisor to take history instead of one-shot
  Q&A); a customer-facing chatbot on the public booking page to answer
  service/pricing questions (needs its own edge function, scoped to that
  business's real service data, plus abuse/rate-limiting since it'd be
  unauthenticated); per-job **Route** buttons on the dashboard and Jobs
  calendar open single-destination Google Maps directions
  (`/maps/dir/?api=1&destination=…`) — the old day-wide multi-stop header
  button was removed because shared addresses broke multi-waypoint routing.

## Cost reality check (as of writing)

Claude Haiku 4.5 is $1/MTok input, $5/MTok output. A single Ask AI
question costs roughly $0.002. Even heavy daily use per business is
well under $1/month in actual AI spend — currently bundled into the
$29/month plan rather than metered separately.


## Recurring plans & magic booking links (2026-07-08)

Recurring customer plan metadata is stored in `customers.notes` as a trailing
marker: `[RP]{...json...}` (stripped for display). Fields:
`id`, `planName`, `serviceName`, `cadence` (weekly|biweekly|monthly),
`defaultPrice`, `defaultDuration`, `nextDueDate`, `status`.

Recurring jobs are tagged in `jobs.notes` with `[RPJOB:{planId}]`.

Customer detail actions:
- **Book next visit** → opens New Job prefilled; on save advances `nextDueDate`
- **Copy recurring link** → `https://{slug}.myhubly.app?rp={base64 token}`
- **Manage plan** → modal editor for customer contact/vehicle + cadence/price/next due

Magic link public flow (`?rp=`):
- Decodes token in `maybeOpenRecurringBookingFromUrl()`
- Prefills contact/service/price and jumps booking wizard to **step 2**
  (date/time), skipping the full 1–4 service-selection grind

Jobs & Calendar has a **Recurring** filter pill for `j.isRecurring`.

## Reports UX (2026-07-08)

- Period dropdown includes: Today, This week, This month, **Last month**,
  This quarter, **Last quarter**, This year, Custom
- Sparkline bars have labels under them (weekday / month day / month)
- Clicking a report metric opens a drilldown modal of the underlying
  jobs/customers for that period
- Dashboard KPI routing:
  - Revenue → Money reports (year) + opens revenue drill
  - Jobs this month → Jobs & Calendar (month)
  - Customers → Customers tab
  - Online bookings → Jobs filter Online bookings

## Greeting (2026-07-08)

`updateDashGreeting()` uses business timezone (`S.timezone`, else browser):
time-of-day word + business name on two lines + live local time under it.
Refreshes on resize and every 60s.

## Premium auto-generated website (2026-07-10)

Replaced tabbed public profile with a **single-scroll premium website** at `{slug}.myhubly.app`.

| Area | What |
|------|------|
| **Public site** | Hero, services, gallery, reviews, meet owner, why choose us, service area map, FAQ, contact, sticky mobile Book Now |
| **Booking** | Opens as overlay on public site (no page-leave feel); separate booking page still used for owner preview |
| **Data** | `meta.website` JSON (hero, FAQ, why choose us, SEO, **theme**, **themeSettings**) + `meta.galleryPairs` |
| **AI** | Per-field suggestions later (global generate button removed) |
| **Editor** | Unified Website editor + guided setup coach (Phase A/B) |
| **Subdomains only** | No custom domains until Pro tier later (month 3–4+) |

Key functions: `renderWebsite()`, `applyWebsiteTheme()`, `selectWebsiteTheme()`, `generateWebsiteWithAI()`, `openPublicBookingOverlay()`, `closePublicBooking()`.

## Onboarding rewrite — resume after Claude Code limit (2026-07-13)

**Status:** local WIP on `main` (uncommitted). Claude Code hit weekly limit mid click-through.

### Bug that blocked `p-onboard` (fixed in Cursor)

`resetOnboardState()` set `document.getElementById('slug-disp').textContent=...` but `#slug-disp` was removed in the rewritten onboarding UI. That threw **before** `showP('p-onboard')` → `pOnboardActive: false`.

Also hardened: `updateSlug()`, null-safe `show`/`hide`, hours grid `toggleClosed(day, closed, containerId)` so `#ob-hours-grid` refreshes (not only `#hours-grid-ed`).

### New flow (6 steps + welcome)

welcome → identity + business type → logo → photos → services → packages → business info → build → headline → success.

`S.businessType` + `businesses.business_type` (migration `20260713130000_add_business_type.sql`). **Already applied on remote** (`supabase migration list` shows local=remote for 20260713130000). `loadBusiness()` now restores `S.businessType` from the column.

### Smoke test (local http.server :8099)

`goOnboard` with mocked `currentUser` → welcome → all step advances through business info + 7 hour rows. OK.

## Dashboard schedule compact + review card (2026-07-11)

**Branch / commit:** `cursor/dash-schedule-compact` → `6058d69`  
**Files:** `public/hubly.html` + synced root `hubly.html` (keep both in sync).

### What Cursor did (do not revert)

| Area | Change |
|------|--------|
| **Shorter panels** | `.dash-schedule-scroll` / `.dash-bookings-scroll` capped at `min(300px,38vh)` with internal scroll; `.dash-mid-grid` uses `align-items:start` |
| **Compact agenda** | Dashboard uses `renderDailyAgendaHtml(..., {compact:true})` with `rowH=40` + `.day-agenda-compact` denser CSS |
| **Today’s schedule actions** | Header: `+ Block` → `openDashBlockTime()` (today + block modal), `+ Job` → `openDashNewJob()` (today date prefills `nj-date`). Empty hour slots still call `openAgendaBlockAt` |
| **New bookings actions** | Header `+ Add` + empty-state “+ Add a job” both call `openDashNewJob()` |

Helpers live near `goDashCalendar()`: `openDashNewJob()`, `openDashBlockTime()`.

### Claude review-card work — preserved in same commit

Earlier PR work had gutted review-ready; Claude restored it locally and Cursor **kept** that diff when shipping the schedule UI:

- `#review-ready-card` HTML restored
- `getReviewReadyJobs()` / `renderReviewRequestList()` active again
- Draft caches: `reviewDraftAiCache`, `reviewDraftBlankCache`, `reviewDraftActiveMode`
- Back from AI/blank draft → `goBackToReviewChoice()` → complete prompt
- Related earlier: `72d9627` (prompt review on complete)

**If editing the dashboard mid-grid or review flow:** leave both behaviors; don’t strip review-ready again to “simplify” the dash.

### Left uncommitted on purpose

- `hubly-full-package/` / `.zip`, `supabase/.temp/`
- Opportunistic migration renames under `supabase/migrations/` — leave alone unless asked

## Website theme engine (2026-07-10)

Shopify-style **content vs presentation** split. Same business data; theme only changes layout/styling.

| Piece | Location |
|-------|----------|
| **Registry** | `public/themes/registry.js` — `HublyThemes.registerTheme()`, `applyTheme()`, token merge |
| **Themes shipped** | `modern` (free), `bold` (pro badge), `dark` (pro badge) |
| **Data** | `S.website.theme` + `S.website.themeSettings` persisted in `meta.website` |
| **Editor** | Section 2 "Website style" — thumbnail cards, instant preview switch (no save required) |
| **Static serve** | `api/router.js` serves `/themes/*` from `public/themes/` |

Theme tokens (CSS variables): accent, border radius, hero height, section spacing, button shape, container width.

**Next:** more themes, onboarding handoff (Phase E), premium gating.

## Website builder phases (2026-07-10)

| Phase | Status | What |
|-------|--------|------|
| A | Done | Biz name ↔ hero sync fix; removed global AI generate button |
| B | Done | Guided coach in editor (`editorGuide` in meta); onboard → "Customize your website" |
| C | Done | Click-to-edit on preview (name, tagline, logo, hero, CTA, services, gallery) |
| D | Done | Themed booking overlay — inherits website theme, grid/list layout, hero/compact header |
| E | Planned | Onboarding handoff polish |

### Phase D — themed booking overlay

- **Public flow:** Book Now opens a full-screen overlay on the website (storefront stays underneath)
- **Theme inheritance:** `applyThemedBookingShell()` applies `HublyThemes` + accent/font to `#bk-themed-root`
- **Service cards:** reuses `wsServiceCardHtml()` (same cards as the website)
- **Wizard accent:** `--bk-accent` on `body.ws-booking-open` tints progress bar, buttons, selections
- **Editor:** Section 4 "Booking style" — grid/list layout, hero/compact header, preview button
- **Data:** `S.website.bookingStyle = { layout, headerStyle }` persisted in `meta.website`


**2-pane layout (desktop):** live preview **left** | edit controls **right**

- Unified **top toolbar** spans full width: Profile/Booking tabs, Phone/PC toggle, Save, View profile
- **Left:** single live preview on a neutral gray stage — phone mockup or full desktop page card (no duplicate content panel)
- **Right:** “Jump to section” nav + accordion controls + status footer
- **Mobile:** Edit tab = controls; Preview tab = live preview only
- Key functions: `renderEdSectionNav()`, `jumpToEdSection()`, `applyEdPreviewDevice()`

## UX bugfix batch (2026-07-09) — Claude batches 0–4, finished in Cursor

All in `public/hubly.html` (+ synced `hubly.html`):

| Fix | What changed |
|-----|----------------|
| **Recurring Manage plan modal** | Phone, email, vehicle type/year/make/model/color fields; saved via `saveManagedRecurringPlan()` → `upsertCustomer()` |
| **Show price on booking page** | `updatePriceVisibilityPrev()` now calls full `updateSvcPreview()` (phone + desktop) |
| **Hardcoded add-ons** | Booking step 3 uses `#bk-addon-grid` + `renderBkAddonGrid()` from `S.editorAddons` |
| **$ input padding** | `.pfx input` padding-left 32px |
| **Service editor stuck open** | `_open` stripped on save (`buildBizMeta`) and cleared on load (`applyBizMeta`) |
| **Preview booking on both tabs** | Removed from Profile URL card; only on Booking tab |
| **Back from owner preview** | Owner bars on profile/booking; `goDash()` clears preview mode |
| **Copy my link** | Was sidebar nav item — moved to Dashboard Quick actions (2026-07-09) |

## Dashboard + editor polish (2026-07-09)

| Fix | What changed |
|-----|----------------|
| **Copy my link** | Dashboard Quick actions (`dash-link-btn` + `#dash-profile-url`); removed from sidebar |
| **Owner preview back bar** | Light sticky `.sf-prev-bar` + `.sf-prev-back` replaces dark gradient inline styles |
| **Profile editor PC view** | Left canvas (`renderEdProfileCanvas`) shows name, hours, services, portfolio |
| **Booking phone preview** | Service cards with images (`bookingLandCardHtml`) match desktop card style |
| **Default preview device** | PC/Desktop instead of Phone |
| **Profile canvas hero** | Logo + banner/gradient header on identity card |
| **Profile canvas services** | Image cards via `bookingLandCardHtml` (not text rows) |
| **Public profile services** | Services tab uses same card grid as booking landing |
| **Onboarding booking preview** | All booking previews use card layout consistently |

## Editor 3-pane redesign (2026-07-09)

| Change | What |
|--------|------|
| **3-column shell** | `#ed-left` content · `#ed-preview-area` live preview · `#ed-ctrl` controls |
| **Booking left canvas** | `renderEdBookingCanvas()` — hero, services, payment, add-ons summary |
| **Click-to-edit** | `jumpToEdSection()` opens matching accordion on the right |
| **Context rail** | Moved into left panel footer (sections, booking status, preview buttons) |
| **Center preview** | Profile desktop mockup re-enabled in center for PC mode |

**Not started:** dedicated 4th-column context rail on ultra-wide screens; drag-reorder on left canvas.

## Weather + editor previews (2026-07-08)

- `loadWeatherForecast()` pulls a 16-day Open-Meteo forecast keyed by
  `S.city`; dashboard/jobs rows show weather-risk badges for rain/snow
  days with >=40% precip probability
- `renderDashWeatherAlert()` surfaces upcoming risky jobs on the dashboard
  and jumps into Jobs & Calendar
- Editor preview now supports a **Phone / PC** toggle for both Profile and
  Booking views via `setEdPreviewDevice()`
- Keep `public/hubly.html` and root `hubly.html` in sync; Vercel serves the
  public copy, but local/project tooling still references the root file
