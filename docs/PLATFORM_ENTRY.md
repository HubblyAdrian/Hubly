# Phase 6.5 — Platform Entry Experience

**Status:** ✅ Approved · live on `main`  
**Prerequisite:** Hubly Platform v1 + `docs/HUBLY_EXPERIENCES.md`  
**Rule:** Do not modify Hubly Pro onboarding, Marketplace provider app internals, Consumer booking flows, or platform engines. **Do not expand the homepage further at this stage.**

**Public branding (locked):** **Hubly Marketplace** · **Hubly Pro**. Never “Marketplace Lite” in UI or marketing. That name is internal packaging/engineering only.

---

## Job of the homepage

Not to explain every feature.

To help every visitor identify the correct path within seconds:

| Path | Destination |
|---|---|
| Need a Service | AI Concierge → `/get-done` |
| Want More Customers | Hubly Marketplace → `/marketplace` → `/marketplace-lite` |
| Grow My Business | Hubly Pro → `/pro` → `/signup` or `/login` |

Marketplace path label may later experiment with copy (*Get Booked*, *Receive Bookings*, *Join the Marketplace*, *Start Getting Customers*). Do not change homepage messaging without an explicit copy pass.

---

## Routes

| Path | File | Purpose |
|---|---|---|
| `/` | `public/platform-home.html` | Platform chooser (front door) |
| `/marketplace` | `public/marketplace-landing.html` | Hubly Marketplace landing |
| `/pro` | `public/pro-landing.html` | Hubly Pro landing |
| `/enter` | `public/enter.html` | Auth / account-entry chooser |
| `/get-done` | unchanged | Consumer Experience |
| `/marketplace-lite` | provider app (URL may stay; **UI says Hubly Marketplace**) | Provider app + auth |
| `/login`, `/signup` | unchanged (`hubly.html`) | Pro auth / Instant Site |

Wired in `api/router.js` only. Catch-all still serves `hubly.html` for Pro SPA paths.

---

## Auth / account-entry architecture

Hubly does **not** use one shared login for all personas.

| Persona | Account? | Entry |
|---|---|---|
| Customer | No | `/get-done` (guest booking) |
| Marketplace provider | Yes | `/marketplace-lite` (sign-in / join — branded **Hubly Marketplace**) |
| Hubly Pro owner | Yes (Pro) | `/login` or `/signup` (existing Instant Site / sign-in) |

`/enter` is a thin router page. It does not invent new auth systems.

---

## Navigation (public)

Shared chrome across entry pages:

- Get done · Marketplace · Hubly Pro · Sign in (`/enter` or context CTA)

Consumer `/get-done` keeps “For businesses” → `/` (platform home).  
Provider auth footers point to `/pro`.

---

## Business Readiness placeholder

Footer / note copy only: “Business Readiness · coming later.”

No surface, no checklist UI, no Phase 7 implementation.

---

## What we did not change

- Hubly Pro Instant Site / onboarding internals
- Marketplace provider join / dashboard / booking flows (logic)
- `/get-done` intake · match · book
- Service / Booking / Matching / Payments engines
- Marketplace Ops

---

## Related

- `docs/HUBLY_PLATFORM_ARCHITECTURE.md` — Hubly Platform v1
- `docs/HUBLY_EXPERIENCES.md` — experience definitions
- `docs/MY_HUB.md` — Consumer My Hub (next design)
