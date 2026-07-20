# Phase 6 — Service Engine

**Status:** ✅ **FROZEN** (schema locked · all experiences consume Service Engine · dual-write removed)  
**Internal name:** Service Engine (not “Shared Service Catalog”).  
**Rule:** No Marketplace Lite features. No Marketplace Ops expansion. No UI redesign unless blocked. Production bugs only.

---

## Philosophy

> **A Service describes what a business sells. AI metadata describes how Hubly helps customers discover, understand, and book that service.**

Business owners own the Service.  
Hubly owns the intelligence layered on top of it.

That boundary keeps the Service Engine clean as AI capabilities grow.

---

## Platform engines

| Engine | Job |
|---|---|
| AI Engine | Understand the job |
| Matching Engine | Rank providers |
| Booking Engine | Confirm appointments |
| Availability Engine | Open slots |
| Payments Engine | Checkout + Connect |
| Messaging Engine | Booking threads |
| Provider Engine | Lite lifecycle |
| Marketplace Ops | Quality / trust |
| **Service Engine** | **Canonical services every consumer reads** |

```
               Service Engine
        ↓        ↓        ↓        ↓        ↓
   Website   Booking   AI   Reporting   Marketplace
```

One edit. Updates everywhere.

---

## What is a Service?

A **Service** is one bookable offer owned by one Business.

Examples: Interior Detail · Exterior Window Cleaning · Wedding Photography · Lawn Mowing · AC Tune-Up.

**Delete the word Package** — internally and in product copy going forward. Everything is a Service.

---

## What is an Add-on?

A first-class catalog object. Services reference add-ons by id.

```
Business
  └── Add-ons: Pet Hair Removal, Odor Removal, Screen Cleaning, …
  └── Services: Interior Detail → [Pet Hair, Odor Removal]
```

Change the price of “Odor Removal” once → every Service that references it updates.

---

## Canonical schema

Stored at `businesses.meta.service_catalog` (versioned JSON).  
**Writers persist `service_catalog` only** (dual-write removed).  
`getCatalog()` still migrate-on-reads legacy `editorSvcs` / `meta.services` until a business is re-saved.

See TypeScript types in `supabase/functions/_shared/service_engine.ts`.

### Reserved: `service.ai` (Phase 9/10 — not Phase 6)

Every Service owns its own intelligence slot. Empty today. Shape **locked**.

| Field | Future use |
|---|---|
| `recommended_addon_ids` | “Would you like to add Odor Removal?” |
| `frequently_combined_service_ids` | Interior + Exterior often book Screen Cleaning |
| `suggested_upsells` | Engagement Photos with Wedding Photography |
| `preparation_instructions` | What to do before the appointment |
| `aftercare_instructions` | What to do after |
| `estimated_completion_window` | Soft completion guidance for AI / customer copy |
| `seasonality` | Demand / timing priors |
| `common_customer_questions` | Service-level FAQs for Concierge |
| `customer_expectations` | What “done” looks like |
| `extensions` | Non-breaking bag for later experiments |

**Hard rules:** preserve `ai` on read/write; default empty; never wipe on owner save; do not populate until Phase 9/10.

### Architectural rule: AI metadata is derived, never required

Providers must **never** be expected to fill `service.ai` during normal setup.  
Eventually populated by AI learning, industry packs, marketplace performance, provider behavior, coaching.  
Optional customization later is fine — default experience requires **zero extra work**.

### Architectural rule: catalog always wins

AI metadata may **enrich** a Service. It may **never redefine** a Service.  
Never invent a Service the Business does not offer.

---

## Booking snapshots

Bookings store an immutable `service_snapshot`. Later catalog edits never rewrite history.

---

## Consumer audit (freeze)

| Experience | Consumer | Status |
|---|---|---|
| Website / Hubly Pro | `applyBizMeta` / `buildBizMeta` / `getBookingServices` | ✅ catalog load + catalog-only save |
| Booking Engine | `toBookingDto` / `listBookingServices` / snapshots | ✅ |
| AI Matching | `listServices` + `toMatchDto` | ✅ |
| Chatbot | `toAiSummary(..., "website")` | ✅ |
| Reporting | `reportServicesBreakdown` via catalog ids/names | ✅ |
| Marketplace Lite | `handleLiteServicesSave` → `buildCatalogWritePayload` | ✅ |
| Marketplace provider DTO | `listBookingServices` | ✅ |
| Marketplace score | `getCatalog` | ✅ |
| Smart Quote | `getBookingServices` | ✅ |
| Ops / Lite health | `listCatalogServices` / `listServices` | ✅ |

**In-memory `S.editorSvcs`** = Pro editor working copy only (hydrated from / saved to `service_catalog`).

**Migrate-on-read** in `getCatalog()` still accepts legacy mirrors until re-save. New writes delete those mirrors.

**Relational `services` table:** no longer written by Pro. Last-resort read only if catalog + editor empty.

---

## Dual-write — removed

`buildCatalogWritePayload` and `buildBizMeta` persist **`service_catalog` only**.

---

## Success criteria

- [x] Service Engine module + canonical schema
- [x] Booking / Match / Lite / Website / Chatbot / Reporting / Score / Smart Quote consume Service Engine
- [x] `service.ai` reserved shape locked; derived-never-required; catalog always wins
- [x] Dual-write removed
- [x] **Phase 6 FROZEN**
