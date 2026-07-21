# Hubly Platform — Release Candidate Validation

**Date:** 2026-07-21  
**Environment:** Production `https://myhubly.app` + Supabase `rtwxxkxpkqdrhclkozma` + Stripe account `Hubly` (`acct_1TubAAEEmwNmC4XD`)  
**Scope:** No new features. Route, CTA, wording, and journey validation only.  
**Phase 7 (Hubly AI):** **BLOCKED** until blockers below are cleared.

## Verdict

| Area | Status | Notes |
|------|--------|-------|
| 1. Customer Journey | ❌ | Match works; **booking dead-ends** when provider has no published services |
| 2. Marketplace Provider Journey | ⚠ | Routes/UI present; auth-gated steps not fully E2E’d in this pass |
| 3. Business Journey | ⚠ | Instant Site / login / app routes work; Readiness waitlist is fake |
| 4. Public Website Navigation | ⚠ | Destinations resolve; mobile primary nav incomplete |
| 5. Authentication | ✅ | Entry paths and logout destinations correct |
| 6. Booking Flow | ❌ | Empty catalog → copy promises request, UI only offers Back |
| 7. Payments | ⚠ | Stripe + checkout wiring live; **no completed PaymentIntents** to prove E2E |
| 8. Calendar Sync | ⚠ | Google path wired; Outlook/Apple Coming soon |
| 9. Messaging | ⚠ | Surfaces exist; homepage Ask Hubly is a Get Done redirect |
| 10. Mobile Responsiveness | ⚠ | Key apps OK; marketing nav hides links with no drawer |

**Foundation is not frozen for Phase 7 yet.** Fix blockers first, then re-run this checklist.

---

## Blockers (must fix before Phase 7)

1. **❌ Booking dead end after Match** — Live match always returned the same provider (`Adrian's Window Cleaning`) with `services: []`. `/get-done` shows *“You can still send a booking request”* but only renders **Back**. Customer cannot complete Describe → Book.
2. **❌ Get Done talking pattern** — Follow-up chips still submit Hubly questions as user bubbles (`submitNeed(q)`). Fix exists in open PR [#129](https://github.com/HubblyAdrian/Hubly/pull/129) — not merged.
3. **❌ Business Readiness “Notify me”** — Button flips to *“You’re on the list”* with **no API / no persistence**. False success / dead end.

---

## Method

- HTTP GET/redirect probes of every public marketing route on `myhubly.app`
- Source audit of every `href`, form, and `location.href` on marketing pages
- Live Supabase `marketplace` actions: `intake`, `match`, `booking_catalog`
- Edge function presence: checkout, Stripe Connect, Google Calendar, messaging
- Stripe account + PaymentIntent list (read-only)
- Code-path review for auth-gated owner / marketplace lite flows (no test credentials used)

Legend: **✅ Working** · **⚠ Needs Improvement** · **❌ Broken**

---

## 1. Customer Journey

| Step | Check | Status |
|------|-------|--------|
| Land on homepage | `/` serves platform-home, hero “What can we help you get done today?” | ✅ |
| Describe job (hero input) | Seeds query; no navigation until CTA | ✅ |
| Get Matched | Routes to `/get-done?q=…` | ✅ |
| Industry cards | `/get-done?cat=…` (all 8) return 200 | ✅ |
| Explore all services | `/get-done` | ✅ |
| Intake conversation | `action:intake` returns reply + follow-ups | ✅ |
| Match recommendations | `action:match` returns providers | ✅ |
| Choose service / book | Catalog empty → dead end (see Blockers) | ❌ |
| Pay / confirm | Checkout function reachable; cannot complete without services | ⚠ |
| Stripe return URLs | `?stripe_pay=success\|cancel&booked=` handled in get-done | ✅ (code) |

---

## 2. Marketplace Provider Journey

| Step | Check | Status |
|------|-------|--------|
| `/marketplace` landing | 200, Join / Sign in CTAs | ✅ |
| Join Marketplace | `/marketplace/join` | ✅ |
| Sign in | `/marketplace/login` | ✅ |
| Legacy `/lite`, `/marketplace-lite` | 302 → `/marketplace/login` | ✅ |
| Signed-out `/marketplace/home` | App shell loads; redirects to login when session missing (client) | ✅ |
| App views | Dashboard, Bookings, Messages, Services, Availability, Profile, Payouts | ✅ (present) |
| Submit verification / Instant Book | Code paths in lite app | ⚠ needs signed-in E2E |
| Connect Google Calendar | Edge fn exists; requires auth | ⚠ |
| Connect Stripe / Payouts | Edge fns exist; Stripe account Hubly present | ⚠ needs signed-in E2E |
| Sign out | → `/marketplace/login` | ✅ |
| Cross-link “Start Hubly” | → `/signup` Instant Site | ✅ |

---

## 3. Business Journey (Instant Site / Hubly app)

| Step | Check | Status |
|------|-------|--------|
| Start Free / `/signup` | Serves hubly Instant Site onboarding | ✅ |
| `/login` | Sign-in page markers present | ✅ |
| `/onboarding`, `/app`, `/dashboard` | Served via hubly SPA | ✅ |
| `/reset-password` | Served | ✅ |
| Owner Sign out | `showP('p-signin')` → `/login` | ✅ |
| Run Your Business banner | `/signup`, wording matches Instant Site | ✅ |
| Join Marketplace banner | `/marketplace`, wording matches | ✅ |
| Business Readiness Notify me | Fake success, no backend | ❌ |
| Subdomain Instant Site | `{slug}.myhubly.app` returns hubly.html (200) | ✅ |
| Outlook / Apple calendar | “Coming soon” badges | ⚠ intentional incomplete |

---

## 4. Public Website Navigation — clickable checklist

### Homepage `/` (`platform-home.html`)

| Element | Destination | Wording ↔ destination | Status |
|---------|-------------|------------------------|--------|
| Logo hubly | `/` | Home | ✅ |
| How it works | `#how` | In-page section | ✅ |
| For businesses | `#grow` | In-page section (not Marketplace — intentional) | ✅ |
| Sign in | `/login` | Owner business login | ✅ |
| Start Free | `/signup` | Instant Site start | ✅ |
| Get Matched | `/get-done?q=` | Customer match | ✅ |
| Service chips | Fill input only | Supports Describe | ✅ |
| Industry cards (8) | `/get-done?cat=…` | Labels match categories | ✅ |
| Explore all services → | `/get-done` | OK | ✅ |
| Join Marketplace / Start Receiving Jobs → | `/marketplace` | OK | ✅ |
| Run Your Business / Start Free → | `/signup` | OK | ✅ |
| Footer Get Done | `/get-done` | OK | ✅ |
| Footer How / For businesses | `#how` / `#grow` | OK | ✅ |
| Footer Sign in | `/login` | OK | ✅ |
| Ask Hubly FAB | Opens panel | Opens assistant chrome | ✅ |
| Ask Hubly Send | `/get-done?q=` | Copy implies chat; actually redirects to Get Done | ⚠ |
| Business Readiness Notify me | JS stub | Claims “You’re on the list” | ❌ |

### Marketplace landing `/marketplace`

| Element | Destination | Status |
|---------|-------------|--------|
| Logo | `/` | ✅ |
| Get Done | `/get-done` | ✅ |
| Marketplace | `/marketplace` | ✅ |
| Hubly (nav) | `/signup` | ⚠ label “Hubly” → Instant Site (ambiguous vs home) |
| Sign in | `/marketplace/login` | ✅ |
| Join Marketplace / Start getting booked | `/marketplace/join` | ✅ |
| See how it works | `#how` | ✅ |
| Already a provider? Sign in | `/marketplace/login` | ✅ |
| Footer trio | Get Done / Marketplace / Hubly→signup | ⚠ same Hubly label issue |

### Pro landing `/pro`

| Element | Destination | Status |
|---------|-------------|--------|
| Logo, Get Done, Marketplace, Hubly→signup, Log in→`/login`, Start Hubly→`/signup` | All 200 | ✅ |

### Enter / Account `/enter`, `/account`

| Element | Destination | Status |
|---------|-------------|--------|
| Get Done path | `/get-done` | ✅ |
| Marketplace path | `/marketplace/login` | ✅ |
| Hubly business log in | `/login` | ✅ |
| Start Hubly | `/signup` | ✅ |
| Marketplace overview | `/marketplace` | ✅ |
| ← All paths | `/` | ✅ |

### Get Done `/get-done`

| Element | Destination | Status |
|---------|-------------|--------|
| Logo / For businesses | `/` | ✅ |
| Get Matched / follow-ups | Marketplace intake API | ✅ / ❌ talking pattern (PR #129) |
| Book CTAs | In-page booking sheet | ❌ empty catalog dead end |
| Stripe pay return | Handled on page | ✅ (code) |

### Redirects

| From | To | Status |
|------|----|--------|
| `/lite`, `/marketplace-lite` | `/marketplace/login` | ✅ |
| `/home`, `/index.html` | platform home | ✅ |
| `/hubly-pro`, `/pro.html` | pro landing | ✅ |

---

## 5. Authentication

| Check | Status |
|-------|--------|
| Customer path needs no account (`/get-done`) | ✅ |
| Provider auth separate (`/marketplace/login\|join`) | ✅ |
| Business auth separate (`/login`, `/signup` Instant Site) | ✅ |
| `/enter` chooser wording matches three destinations | ✅ |
| Owner logout → Sign in | ✅ |
| Marketplace logout → `/marketplace/login` | ✅ |
| Password reset route `/reset-password` | ✅ |
| Credentialed sign-in E2E (email/password) | ⚠ not exercised (no RC test users in this run) |

---

## 6. Booking Flow

| Check | Status |
|-------|--------|
| Intake → Match pipeline | ✅ |
| Match returns “bookable” copy | ⚠ overclaims when catalog empty |
| `booking_catalog` for matched provider | ❌ `services: []` |
| Empty-catalog UI | ❌ promises request; only Back |
| `booking_slots` / `booking_create` | ⚠ unreachable without service |
| `create-booking-checkout` | ✅ rejects missing `business_id` (alive) |
| Stripe success/cancel return handling | ✅ (code) |

---

## 7. Payments

| Check | Status |
|-------|--------|
| Stripe account connected (`Hubly`) | ✅ |
| Checkout edge function | ✅ |
| Connect onboard / connection / webhook functions | ✅ (OPTIONS 200) |
| PaymentIntents in account | ⚠ **none** — no live paid booking proof |
| Balance | ⚠ $0 — expected if no completed charges |

---

## 8. Calendar Sync

| Check | Status |
|-------|--------|
| Google Calendar OAuth start / sync functions | ✅ present (auth required) |
| Marketplace Availability “Connect Google Calendar” | ✅ UI wired |
| Owner app Google connect / sync | ✅ UI wired |
| OAuth return `?gcal_oauth=` | ✅ handled (code) |
| Outlook / Apple | ⚠ Coming soon |
| Customer “Add to Calendar” (.ics / Google template) | ✅ (code) |

---

## 9. Messaging

| Surface | Behavior | Status |
|---------|----------|--------|
| Homepage Ask Hubly | Panel opens; Send redirects to Get Done | ⚠ not a real assistant |
| hubly marketing support chat | `/api/support-chat` | ✅ endpoint (400 on empty body = validation) |
| Instant Site chatbot | `chatbot-message` fn | ✅ present |
| Owner Chats / email draft | `draft-customer-message`, `send-customer-email` | ✅ present |
| Marketplace Messages | conversation_list / message_send in lite app | ⚠ needs signed-in E2E |

---

## 10. Mobile Responsiveness

| Surface | Pattern | Status |
|---------|---------|--------|
| All key pages | `viewport` meta | ✅ |
| Homepage / Marketplace landing | Nav links hidden `<900px`; **no hamburger/drawer** | ⚠ How it works / For businesses unreachable in header |
| Footer | Still has some links on homepage | ⚠ partial mitigation |
| Marketplace lite | `#mobile-nav` pills | ✅ |
| Hubly owner app | Hamburger drawer | ✅ |
| Get Done | Single column + sheet | ✅ |
| Enter | Simple stacked paths | ✅ |

---

## API / infrastructure smoke

| Endpoint | Result | Status |
|----------|--------|--------|
| `POST …/marketplace` intake | 200 + reply | ✅ |
| `POST …/marketplace` match | 200 + recommendations | ✅ |
| `POST …/marketplace` booking_catalog | 200 + empty services | ❌ data/content |
| `POST …/create-booking-checkout` | 400 business_id required | ✅ |
| Google Calendar / Stripe Connect / messaging fns | Present | ✅ |
| `/api/weather` | 200 | ✅ |
| `/api/notify` empty | 500 | ⚠ expects valid payload |
| `/api/notify-signup`, `/api/support-chat` empty | 400 | ✅ validation |

---

## Auth-gated checklist (manual — required before freeze)

Use real staging credentials and tick:

### Marketplace provider (signed in)
- [ ] Join → email confirm → land `/marketplace/home`
- [ ] Profile save + Submit for verification
- [ ] Services: publish ≥1 service (unblocks customer booking)
- [ ] Availability + Connect Google + Sync Now
- [ ] Payouts → Connect Stripe → return `?stripe_connect=`
- [ ] Accept/decline a booking; Messages send/receive
- [ ] Sign out → login

### Business owner (signed in)
- [ ] `/signup` Instant Site → publish subdomain
- [ ] `/app` Dashboard nav: Leads, Jobs, Customers, Quote, Revenue, Chats, Marketplace, Website
- [ ] Google Calendar connect from Jobs
- [ ] Stripe Connect from Revenue
- [ ] Public `{slug}.myhubly.app` Book Now → checkout return
- [ ] Sign out → `/login`

### Customer paid booking
- [ ] Provider with published services + calendar
- [ ] Get Done → Match → service → slot → checkout
- [ ] Stripe test/live card → success URL confirmation
- [ ] Cancel path abandons unpaid booking

---

## Recommended fix order (still no Phase 7)

1. Publish real services on marketplace providers (or seed) so Match → Book works  
2. Fix empty-catalog UI: either continue to request **or** change copy and disable Book  
3. Merge get-done talking-pattern PR #129  
4. Wire or remove Business Readiness Notify me  
5. Add mobile nav drawer on homepage / marketplace landing  
6. Clarify marketplace nav label “Hubly” → “Start Hubly” / “Run Hubly”  
7. Complete signed-in E2E ticks above  
8. Re-run this doc → only then freeze foundation and start Phase 7

---

## Re-run

```bash
# Route + CTA probe helper (optional follow-up script)
node scripts/check-homepage-craft.mjs
node scripts/check-get-done-talking.mjs   # after #129 merges
```

Live probes used during this RC: curl against `myhubly.app`, marketplace function calls with the public anon key from `public/get-done.html`, Stripe MCP read-only.
