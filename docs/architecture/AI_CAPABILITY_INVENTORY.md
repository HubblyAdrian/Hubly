# Hubly AI Capability Inventory

**Audited:** 2026-08-17
**Method:** verified against the deployed production project (`rtwxxkxpkqdrhclkozma`) AND the repository, not either alone.

> **RE-VERIFY BEFORE DESIGNING ANYTHING AROUND THIS DOCUMENT.**
> This is a snapshot of one day. Capabilities are added by editing a single file,
> functions are deployed independently of the repo, and database triggers can
> invoke things no code search can see. A stale inventory is worse than none,
> because it reads like permission. If the date above is not recent, re-run the
> audit before you rely on a single row.

---

## Why this document exists

The risk it guards against is specific: designing a product surface around a
capability the AI cannot actually perform. If Hubly says *"I drafted three
messages — want me to send them?"* and the user says yes, the system has to
actually send them. Anything less is a chatbot impersonating an operator, which
is the one failure that destroys trust permanently.

So every claim below names the code path that invokes it **today**.

## Two rules this audit applied

**1. Production and repo are different things.** On 2026-08-16 five Edge
Functions were found deployed with no repository file, a live endpoint was
deleted as "dead" because its caller was a row in `pg_trigger`, and an
owner-facing email was traced to a function that existed nowhere in source. A
capability search that reads only the repo misses things in both directions.

**2. Implemented ≠ reachable.** Several capabilities are fully built, deployed
and working — and wired to nothing the AI can call. **A capability with no live
call path is PARTIAL at best, never LIVE.**

---

## The determining fact

The AI's entire reach is defined by one file:
`supabase/functions/_shared/hubly_capability_registry.ts`.

`hubly-conversation` asks "which capability solves this?", invokes one of its
actions, and reports what happened. **If it is not in that registry, the AI
cannot do it** — regardless of what exists elsewhere in the product.

The registry contains **5 capabilities, 17 actions**:

| Capability | Actions |
|---|---|
| `website` | `analyze`, `generateDocument`, `patchDocument` |
| `online_presence` | `analyze_facebook`, `analyze_instagram`, `analyze_google_business` |
| `booking` | `getAvailability`, `create` |
| `business` | `startDraft`, `updateDraft`, `setServices` |
| `storefront` | `listCatalog`, `createProduct`, `updateProduct`, `setProductVisibility`, `addVariant`, `updateVariant`, `createCollection`, `addProductsToCollection`, `configureStore`, `generateStorefront`, `patchStorefront` |

Every `name:` declaration in that file was enumerated. Matches for **lead, job,
planner, calendar, customer, message, review, quote, membership, revenue, photo,
sms, email: NONE.**

---

## The matrix

| Capability | Status | AI read | AI act | Approval | Backend / actual call path |
|---|---|---|---|---|---|
| Read Leads | 🔴 | ✗ | ✗ | — | Client → Supabase REST under RLS. No AI capability, no server API |
| Identify leads needing follow-up | 🔴 | ✗ | ✗ | — | Client-side only (`journey-os/journey.js`) |
| Draft customer message | 🟡 | ✗ | ✗ | — | `draft-customer-message` deployed. **Only caller: `public/hubly.html`** (a UI button) |
| Send customer email | 🟡 | ✗ | ✗ | — | `send-customer-email` deployed. Callers: `hubly.html`, `smart-quote/ui.js`. Sends only owner-reviewed content. Not AI-callable |
| Send SMS | 🔴 | ✗ | ✗ | — | **No implementation of any kind.** Zero files call `api.twilio.com`. Twilio appears only in a connected-apps catalog. Every "text" action is `location.href='sms:'` — the user's own phone app |
| Read Jobs | 🔴 | ✗ | ✗ | — | Client → Supabase |
| Reschedule Job | 🔴 | ✗ | ✗ | — | Client-side |
| Read Planner/Calendar | 🔴 | ✗ | ✗ | — | No AI capability |
| Create/update Planner item | 🔴 | ✗ | ✗ | — | Client-side |
| Create Quick Quote | 🔴 | ✗ | ✗ | — | Client-side |
| Send Quote | 🔴 | ✗ | ✗ | — | Client-side |
| Read Customers | 🔴 | ✗ | ✗ | — | Client → Supabase |
| Find inactive customers | 🔴 | ✗ | ✗ | — | Client-side |
| Send review request | 🟡 | ✗ | ✗ | — | Uses `send-customer-email`, owner-triggered from `hubly.html` |
| Analyze photos | 🟡 | ✗ | ✗ | — | `analyze-photos` deployed. **Only caller: `hubly.html`**. Not registered |
| Creative Director | 🟡 | ✗ | ✗ | — | `creative-director` deployed. Only caller: `hubly.html` |
| Generate / edit website | 🟢 | ✓ | ✓ | see note | `business.startDraft`, `website.generateDocument`, `website.patchDocument` via `hubly-conversation` → registry |
| Set services | 🟢 | ✓ | ✓ | see note | `business.setServices` |
| Booking availability / create | 🟢 | ✓ | ✓ | see note | `booking.getAvailability`, `booking.create` |
| Store / products | 🟢 | ✓ | ✓ | see note | `storefront.*` → owner-gated `commerce-api` |
| Analyse web presence | 🟢 | ✓ | ✓ | — | `website.analyze`, `online_presence.analyze_*` |

**Approval note:** the registry does not currently implement a generic approval
gate. Draft edits are authorised by `draft_token`; store actions by the
owner-gated `commerce-api`. Any approval requirement in the Home spec is a
product rule to be built, not an existing mechanism.

---

## A. 🟢 LIVE NOW

Design against these and nothing else. All reached identically:
`hubly-conversation` → `HUBLY_CAPABILITY_REGISTRY` → handler.

1. **Build a real website** — `business.startDraft` creates a live site at
   `<slug>.myhubly.app`
2. **Edit that website** — `website.generateDocument`, `website.patchDocument`,
   `business.updateDraft`
3. **Set up services** — `business.setServices`
4. **Bookings** — `booking.getAvailability`, `booking.create`
5. **Store** — `storefront.*` (11 actions, owner-gated)
6. **Analyse an existing web presence** — website, Facebook, Instagram, Google
   Business Profile

## B. 🟡 PARTIAL — built, deployed, unreachable by the AI

`draft-customer-message` · `send-customer-email` · `analyze-photos` ·
`creative-director` · `hubly-daily` · `lead-extract`

Each is deployed and functioning. Each has exactly one kind of caller: **a button
in `hubly.html`**. None is in the registry, so the AI cannot invoke any of them.

This is the cheapest path to a larger Phase 2 — the backends are proven, only the
registry wiring is missing.

## C. 🔴 NOT AVAILABLE

Leads · Jobs · Planner/Calendar · Customers · Reviews · Quick Quote ·
Memberships · Revenue

No AI capability **and no server-side API**. The browser talks to Supabase
directly under RLS, so there is nothing for a server-side AI to call. Reaching
these requires building an owner-gated API first — the `commerce-api` pattern is
the model — and then registering capabilities against it.

**SMS is the hardest of these.** It is not a wiring problem; there is no Twilio
integration to wire.

## D. Recommended Phase 1 for Home

Only **A**. In the user's language: *build my site, change my site, set up what I
sell, take bookings, run my store, look at my web presence.*

Phase 2: promote **B** by registering `draft-customer-message` and
`analyze-photos` first.
Phase 3: **C**, gated on building an owner API.

---

## Language this inventory forbids

| Claim | Verdict |
|---|---|
| "Hubly can build and edit your website" | ✅ true and AI-executable |
| "Hubly can take bookings and run your store" | ✅ true |
| "Hubly can draft customer messages" | ⚠️ the drafter exists but **the AI cannot call it** |
| "Hubly can send messages" | ❌ sending exists, not AI-reachable |
| "Hubly can send texts" | ❌ no implementation at all |

---

## Production/repo state at audit time

- **47 functions deployed, 48 repo directories, zero orphans.** (Five orphans
  were found and imported on 2026-08-16 — see
  `KNOWN_ISSUES.md`, "The repo does not describe production".)
- `commerce-merchandising` exists in repo, not deployed.
- **Zero** `http_request` database triggers. One cron:
  `hubly-recurring-maintain-30min`.

### One correction carried forward

`api/notify.js` and `booking-notify` both produce the subject *"New booking from
X"*. Their headers differ — `api/notify.js` says **"New booking!"**,
`booking-notify` says **"New booking request"**. The owner email observed on
2026-08-16 said *"New booking request"*, so **`booking-notify` sent it**.

An earlier conclusion that `api/notify.js` was live was therefore based on a
wrong attribution. It has **no known caller**. It was restored after being
deleted, which was correct under the uncertainty at the time, but its honest
status is *unknown, probably dead* — not *live*. Do not delete it again on
inference; prove a caller exists or does not before acting.
