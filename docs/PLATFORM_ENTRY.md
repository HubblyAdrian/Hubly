# Phase 6.5 — Platform Entry Experience

**Status:** ✅ Approved · live on `main`  
**Prerequisite:** Hubly Platform v1 + `docs/HUBLY_EXPERIENCES.md`  
**Rule:** Do not modify Hubly Pro onboarding, Marketplace Lite internals, Consumer booking flows, or platform engines. **Do not expand the homepage further at this stage.**

The public entry experience is the front door to the Hubly platform.

**Next product design milestone:** Consumer **My Hub** — see `docs/MY_HUB.md` (defined, not implemented).

---

## Job of the homepage

Not to explain every feature.

To help every visitor identify the correct path within seconds:

| Path | Destination |
|---|---|
| Need a Service | AI Concierge → `/get-done` |
| Want More Customers | Marketplace → `/marketplace` → `/marketplace-lite` |
| Grow My Business | Hubly Pro → `/pro` → `/signup` or `/login` |

Marketplace path label may later experiment with copy (*Get Booked*, *Receive Bookings*, *Join the Marketplace*, *Start Getting Customers*). Do not change homepage messaging in follow-on work without an explicit copy pass.

Post-booking consumer home is **My Hub** (design only) — `docs/MY_HUB.md`.

---

## Routes

| Path | File | Purpose |
|---|---|---|
| `/` | `public/platform-home.html` | Platform chooser (front door) |
| `/marketplace` | `public/marketplace-landing.html` | Marketplace Provider landing |
| `/pro` | `public/pro-landing.html` | Hubly Pro landing |
| `/enter` | `public/enter.html` | Auth / account-entry chooser |
| `/get-done` | unchanged | Consumer Experience |
| `/marketplace-lite` | unchanged | Provider app + auth |
| `/login`, `/signup` | unchanged (`hubly.html`) | Pro auth / Instant Site |

Wired in `api/router.js` only. Catch-all still serves `hubly.html` for Pro SPA paths.

---

## Auth / account-entry architecture

Hubly does **not** use one shared login for all personas.

| Persona | Account? | Entry |
|---|---|---|
| Customer | No | `/get-done` (guest booking) |
| Marketplace provider | Yes (Lite) | `/marketplace-lite` (existing sign-in / join) |
| Hubly Pro owner | Yes (Pro) | `/login` or `/signup` (existing Instant Site / sign-in) |

`/enter` is a thin router page. It does not invent new auth systems.

---

## Navigation (public)

Shared chrome across entry pages:

- Get done · Marketplace · Hubly Pro · Sign in (`/enter` or context CTA)

Consumer `/get-done` keeps “For businesses” → `/` (platform home).  
Lite auth footers point to `/pro` instead of the old Instant Site apex.

---

## Business Readiness placeholder

Footer / note copy only: “Business Readiness · coming later.”

No surface, no checklist UI, no Phase 7 implementation.

---

## What we did not change

- Hubly Pro Instant Site / onboarding internals
- Marketplace Lite join / dashboard / booking flows
- `/get-done` intake · match · book
- Service / Booking / Matching / Payments engines
- Marketplace Ops

---

## Related

- `docs/HUBLY_PLATFORM_ARCHITECTURE.md` — Hubly Platform v1
- `docs/HUBLY_EXPERIENCES.md` — experience definitions
