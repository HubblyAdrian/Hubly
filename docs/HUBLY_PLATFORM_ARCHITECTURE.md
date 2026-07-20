# Hubly Platform v1 — Canonical Architecture

**Internal name:** Hubly Platform v1  
**Status:** LOCKED / CANONICAL (baseline)  
**Purpose:** Single source of truth for platform architecture, ownership boundaries, and v1 freeze rules.

Everything from here builds on **Hubly Platform v1** — one platform, shared engines, four experiences.

**Pre–Phase 7 product definition:** how users enter and move through those experiences — see `docs/HUBLY_EXPERIENCES.md` (defined, not implemented).

**Phase 6.5 public front door:** `docs/PLATFORM_ENTRY.md` — `/` · `/marketplace` · `/pro` · `/enter` (approved).

**Next Consumer design:** `docs/MY_HUB.md` — My Hub (defined, not implemented).

---

## Core principle

Hubly is **one platform** with shared engines and multiple experiences.

We do **not** build separate products with separate data models for CRM, Marketplace,
Website, Chatbot, and Reporting. We build shared engines once and let every
experience consume them.

---

## Every Experience

Product experiences (user journeys): see **`docs/HUBLY_EXPERIENCES.md`**.

| Experience | Primary user | Surface | Role |
|---|---|---|---|
| Consumer Experience | Customer | `/get-done` | AI-first intake, matching, booking |
| Marketplace Provider Experience | Marketplace provider | `/marketplace-lite` | Receive and complete marketplace bookings |
| Hubly Pro Experience | Full SaaS business owner | `/app` | Full business OS (CRM, marketing, automations, memberships, etc.) |
| Business Readiness | Owner becoming marketplace-ready | *Future platform capability — not standalone* |
| Marketplace Ops *(internal)* | Hubly staff | `/marketplace-ops` | Trust, quality, verification, lifecycle, analytics |

**Naming rule:** “Provider Experience” = engineering. “Marketplace Lite” = product packaging for Marketplace Provider.

## Every Engine

| Engine | Canonical job |
|---|---|
| AI Engine | Understand customer intent and orchestrate recommendations |
| Matching Engine | Rank viable providers/services for the job |
| Booking Engine | Convert request to confirmed appointment + immutable snapshots |
| Availability Engine | Compute open times / scheduling constraints |
| Payments Engine | Checkout + Stripe Connect payout flows |
| Messaging Engine | Booking thread communication + notifications |
| Service Engine | Canonical service catalog + add-ons + pricing modes |

---

## Engine → Experience consumption matrix

| Engine \ Experience | Customer | Provider Lite | Hubly Pro | Marketplace Ops |
|---|---:|---:|---:|---:|
| AI Engine | ✅ | ⚪ | ⚪ | ⚪ |
| Matching Engine | ✅ | ⚪ | ⚪ | ✅ |
| Booking Engine | ✅ | ✅ | ✅ | ✅ |
| Availability Engine | ✅ | ✅ | ✅ | ✅ |
| Payments Engine | ✅ | ✅ | ✅ | ✅ |
| Messaging Engine | ✅ | ✅ | ✅ | ✅ |
| **Service Engine** | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ directly consumed · ⚪ indirect/minimal

---

## Service Engine architecture (Phase 6 freeze)

`businesses.meta.service_catalog` is the canonical service truth.

- Services + add-ons are first-class
- Pricing modes include `quote_required`
- Booking snapshots are immutable
- `service.ai` shape is reserved and locked (empty today)
- AI metadata is **derived**, never setup-required
- Catalog always wins: AI may enrich a service, never redefine/invent one

**Persistence rule:** Writers persist `service_catalog` only. Dual-write mirrors removed.  
**Compatibility rule:** `getCatalog()` may migrate-on-read from legacy mirrors for unsaved historical businesses.

Reference: `docs/SERVICE_ENGINE.md`

---

## Product boundaries (hard)

### Marketplace Lite owns
Receiving bookings · managing services · availability · messaging · payouts.

### Hubly Pro owns
CRM · customers · marketing · automations · memberships · coach · team · inventory.

### Marketplace Ops owns
Verification · trust & safety · fraud/moderation · provider lifecycle · marketplace analytics.

**Hard rule:** Nothing from Hubly Pro leaks into Marketplace Ops.

---

## One Business model (hard)

Every company has one `businesses` row.

Capabilities gate experiences:

- `capabilities.marketplace`
- `capabilities.hubly_pro`

`marketplace_providers` is a **1:1 lifecycle/listing extension**, not a second business profile.

### Upgrade path (Lite → Pro)

No migration/copy/import. Enable capability; keep the same business, services,
availability, bookings, and Stripe identity.

---

## Hubly Platform v1 freeze directives

1. One platform, shared engines.
2. No per-experience forks of core engines.
3. One Business record with capability flags.
4. Keep Lite / Pro / Ops boundaries strict.
5. Phase 5 (Provider Experience/Lite) is frozen except production bugs.
6. Phase 6 (Service Engine) is frozen: canonical catalog architecture is locked.

**v1 baseline is locked.** New work extends the platform; it does not fork it.
