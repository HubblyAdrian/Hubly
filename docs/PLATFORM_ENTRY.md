# Phase 6.5 — Platform Entry Experience

**Status:** ✅ Approved · live on `main`  
**Prerequisite:** Hubly Platform v1 + `docs/HUBLY_EXPERIENCES.md`  
**Rule:** Do not modify Hubly Pro onboarding, Marketplace provider app internals, Consumer booking flows, or platform engines. Homepage visual rebuild to the approved public front-door mockup is allowed; do not invent additional marketing sections beyond that.

**Public branding (locked):** **Hubly Marketplace** · **Hubly Pro**. Never “Marketplace Lite” in UI or marketing. That name is internal packaging/engineering only.

---

## Job of the homepage

Not to explain every feature.

To help every visitor identify the correct path within seconds:

| Path | Destination |
|---|---|
| Need a Service | AI Concierge → `/get-done` |
| Want More Customers | Hubly Marketplace → `/marketplace` → `/marketplace/join` or `/marketplace/login` |
| Grow My Business / Run Your Business | Instant Site setup → `/signup` (existing Hubly Pro onboarding) |

Marketplace path label may later experiment with copy (*Get Booked*, *Receive Bookings*, *Join the Marketplace*, *Start Getting Customers*). Do not change homepage messaging without an explicit copy pass.

---

## Public URL map (Hubly Marketplace)

Users never see “Lite” in the URL.

| Path | Role |
|---|---|
| `/marketplace` | Marketing landing |
| `/marketplace/join` | Provider signup |
| `/marketplace/login` | Provider login |
| `/marketplace/home` | Provider experience (signed in) |

Legacy `/marketplace-lite` and `/lite` **302 →** `/marketplace/login`.  
Internal capability / eng packaging may still be `marketplace_lite`.

| Path | File | Purpose |
|---|---|---|
| `/` | `public/platform-home.html` | Platform chooser (front door) |
| `/marketplace` | `public/marketplace-landing.html` | Hubly Marketplace landing |
| `/pro` | `public/pro-landing.html` | Hubly Pro landing |
| `/enter` | `public/enter.html` | Auth / account-entry chooser |
| `/get-done` | unchanged | Consumer Experience |
| `/marketplace/join` · `/login` · `/home` | `public/marketplace-lite.html` | Provider app (file name is eng only) |
| `/login`, `/signup` | unchanged (`hubly.html`) | Pro auth / Instant Site |

Wired in `api/router.js` only. Catch-all still serves `hubly.html` for Pro SPA paths.

---

## Auth / account-entry architecture

Hubly does **not** use one shared login for all personas.

| Persona | Account? | Entry |
|---|---|---|
| Customer | No | `/get-done` (guest booking) |
| Marketplace provider | Yes | `/marketplace/login` or `/marketplace/join` (branded **Hubly Marketplace**) |
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

Homepage may show a **Coming soon** panel (checklist tease + waitlist CTA). No readiness product, verification flow, or Phase 7 implementation.

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
