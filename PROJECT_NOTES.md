# Hubly — Project Notes

Last updated: 2026-07-09

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
  Auth + Edge Functions + Database Webhooks.
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
  paid_at.
- **customers** — id (uuid), business_id, name, phone, email, vehicle,
  vehicle_type, vehicle_year, vehicle_make, vehicle_model, vehicle_color,
  preferred_service, customer_type (`one_off` | `recurring`),
  recurring_amount, notes.
- **booking_requests** — the public booking form writes here first
  (status `pending`); accepting one inserts a real row into `jobs` and
  marks the request `accepted`.

## Edge Functions

- **booking-notify** — fires on insert into `booking_requests` via a
  Database Webhook (`booking_request_notify`, already configured in
  Supabase → Database → Webhooks). Emails the customer "we got your
  request."
- **booking-confirmed** — call this directly from the frontend
  (`db.functions.invoke('booking-confirmed', {...})`) right after a
  detailer accepts a booking. Emails the customer a confirmation with an
  .ics calendar attachment. **This is not triggered by a webhook** — it's
  called explicitly in `acceptBookingRequest()` in the frontend. If you
  rewrite it, keep the field names it expects: `business_id`,
  `customer_email`, `customer_name`, `service_name`, `date`, `time`,
  `address`, `vehicle`.
- **ai-advisor** — powers the "Ask AI" dashboard widget. Pulls the
  business's own jobs/customers, builds a compact summary server-side
  (revenue this month, upcoming week, stale customers, top spenders),
  and asks Claude to answer using only that summary. Expects
  `{business_id, question}`, returns `{answer}` or `{error}`.

All edge functions use `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
Deno.env.get("SUPABASE_SECRET_KEYS")` for the service-role client — the
project has both secret names floating around from different eras, this
pattern covers either.

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

**Next:** click-to-edit on preview (Phase C), themed booking overlay, more themes.

## Website builder phases (2026-07-10)

| Phase | Status | What |
|-------|--------|------|
| A | Done | Biz name ↔ hero sync fix; removed global AI generate button |
| B | Done | Guided coach in editor (`editorGuide` in meta); onboard → "Customize your website" |
| C | Planned | Click-to-edit on preview (name, logo, services) |
| D | Planned | Themed booking overlay |
| E | Planned | Onboarding handoff polish |


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
