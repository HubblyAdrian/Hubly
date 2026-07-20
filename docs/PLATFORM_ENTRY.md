# Phase 6.5 — Platform Entry Experience

**Status:** ✅ Approved · live on `main`  
**Prerequisite:** Hubly Platform v1 + `docs/HUBLY_EXPERIENCES.md`  
**Rule:** Do not modify Business Experience onboarding, Marketplace provider app internals, Consumer booking flows, or platform engines. Public branding + landing redesigns are allowed without changing backend routes.

**Public product architecture (locked):**

```
Hubly
├── Get Done        (customers)
├── Marketplace     (receive bookings)
└── Hubly           (run your business — Business Experience)
```

Do **not** brand the business platform as “Hubly Pro” in public UI. That reads like a paid tier. Internally the experience is **Business Experience** (`capabilities.hubly_pro` remains the eng flag for now).

Never say “Marketplace Lite” in UI or marketing. That name is internal packaging/engineering only.

---

## Job of the homepage

Not to explain every feature.

To help every visitor identify the correct path within seconds:

| Path | Destination |
|---|---|
| Get Done | AI Concierge → `/get-done` |
| Marketplace | `/marketplace` → `/marketplace/join` or `/marketplace/login` |
| Hubly (run your business) | Instant Site setup → `/signup` (existing Business Experience onboarding) |

Public nav pattern: **Get Done · Marketplace · Hubly** (+ Sign in / Get started).

---

## Public URL map (unchanged routes)

Users never see “Lite” in the URL. Routes stay the same — branding only.

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
| `/` | `public/platform-home.html` | Platform front door |
| `/marketplace` | `public/marketplace-landing.html` | Marketplace marketing |
| `/pro` | `public/pro-landing.html` | Business Experience landing (public copy: Hubly / For businesses) |
| `/enter` | `public/enter.html` | Auth / account-entry chooser |
| `/get-done` | unchanged | Customer Experience |
| `/marketplace/join` · `/login` · `/home` | `public/marketplace-lite.html` | Provider app (file name is eng only) |
| `/login`, `/signup` | unchanged (`hubly.html`) | Business auth / Instant Site |

Wired in `api/router.js` only. Catch-all still serves `hubly.html` for Business Experience SPA paths.

---

## Auth / account-entry architecture

Hubly does **not** use one shared login for all personas.

| Persona | Account? | Entry |
|---|---|---|
| Customer | No | `/get-done` (guest booking) |
| Marketplace provider | Yes | `/marketplace/login` or `/marketplace/join` |
| Business owner | Yes | `/login` or `/signup` (Instant Site / sign-in) |

`/enter` is a thin router page. It does not invent new auth systems.

---

## Navigation (public)

Shared chrome across entry pages:

- **Get Done · Marketplace · Hubly** · Sign in (`/enter` or context CTA)

Consumer `/get-done` keeps “For businesses” → `/` (platform home).

---

## Business Readiness placeholder

Homepage may show a **Coming soon** panel (checklist tease + waitlist CTA). No readiness product, verification flow, or Phase 7 implementation. Do not add fake press logos, fabricated testimonials, or trust-stat strips.

---

## What we did not change

- Business Experience Instant Site / onboarding internals
- Marketplace provider join / dashboard / booking flows (logic)
- `/get-done` intake · match · book
- Service / Booking / Matching / Payments engines
- Marketplace Ops
- Backend routes

---

## Related

- `docs/HUBLY_PLATFORM_ARCHITECTURE.md` — Hubly Platform v1
- `docs/HUBLY_EXPERIENCES.md` — experience definitions (Business Experience)
- `docs/MY_HUB.md` — Customer My Hub (next design)
