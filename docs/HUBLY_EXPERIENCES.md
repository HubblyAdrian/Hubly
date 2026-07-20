# Hubly Experiences — Pre–Phase 7 Definition

**Status:** DEFINED (not implemented)  
**Prerequisite:** Hubly Platform v1 locked — see `docs/HUBLY_PLATFORM_ARCHITECTURE.md`  
**Purpose:** Define how users enter, grow, and move through Hubly **before** Phase 7 engineering.

This document is product architecture only. No new surfaces, schema, or features until Phase 7 is scoped against it.

---

## Two layers (do not confuse)

Hubly has **product experiences** (who uses the platform) and **internal control planes** (how Hubly runs the platform).

| Layer | What it is |
|---|---|
| **Product experiences (this doc)** | Consumer · Marketplace Provider · Hubly Pro · Business Readiness |
| **Internal (not a product experience)** | Marketplace Ops — staff verification, trust, lifecycle, analytics |

Marketplace Ops supports verification and quality. It is **not** one of the four experiences below.

---

## The four experiences (overview)

```
                         ┌─────────────────────────────┐
                         │   Business Readiness        │
                         │   (platform capability)     │
                         │   not a standalone product  │
                         └──────────────┬──────────────┘
                                        │ becomes marketplace-ready
                                        ▼
   Consumer          Marketplace Provider          Hubly Pro
   (get a job done)  (receive marketplace jobs)    (run the business)
        │                      │                         │
        └────────── shared engines (Service, Booking, …) ─┘
```

| # | Experience | Primary user | Current / future surface |
|---|---|---|---|
| 1 | **Consumer Experience** | Customer who needs work done | `/get-done` |
| 2 | **Marketplace Provider Experience** | Provider receiving marketplace bookings | `/marketplace-lite` |
| 3 | **Hubly Pro Experience** | Owner running a full service business | `/app` |
| 4 | **Business Readiness Experience** | Owner becoming marketplace-ready | *Future capability — no standalone product yet* |

**Naming:** “Provider Experience” = engineering name. “Marketplace Lite” = product packaging for experience #2.

---

## 1. Consumer Experience

**Job:** Help a customer describe what they need, match them to real providers, and book.

### Who
Anyone who wants a local service done — not browsing a directory.

### Entry
- `/get-done` — “What can we help you get done today?”
- AI Concierge intake (natural language)
- Optional suggested prompts

### Journey

```
Describe job → AI understands intent → Match ranked providers
    → Pick provider + service → Book (Instant or Request) → Confirmed
```

| Stage | What happens | Engine |
|---|---|---|
| Intake | Customer describes the job in plain language | AI Engine |
| Understand | Job need extracted; no invented services | AI Engine |
| Match | Top providers scored on fit, trust, availability | Matching Engine + Service Engine |
| Book | Service, time, payment as applicable | Booking · Availability · Payments |
| Confirm | Booking thread + notifications | Messaging Engine |

### Ownership boundary

**Owns:** job intake, match presentation, booking UX for customers.  
**Does not own:** provider CRM, provider service editing, verification, ops queues.

### Exit paths
- Completes booking → Messaging / email confirmation
- Abandons → no account required; may return later
- Does **not** upgrade into Provider or Pro (different actor)

### Platform v1 today
Implemented at `/get-done` with frozen Matching + Booking + Service Engine consumers.

---

## 2. Marketplace Provider Experience

**Job:** Help a verified marketplace provider receive, manage, and complete bookings — and get paid.

### Who
A business with `capabilities.marketplace = true` and lifecycle `verified` (public) or participating pre/post verification.

### Entry
- Direct: join Marketplace Lite (`lite_join` / onboarding flow)
- From Business Readiness: graduate when readiness + verification pass
- From Hubly Pro: enable marketplace capability on same Business

### Journey

```
Join → Profile + Services + Availability + Stripe → Submit for verification
    → (Ops review) → Verified → Receive bookings → Messages → Complete → Payout
```

| Stage | What happens | Surface area |
|---|---|---|
| Onboard | Business created; marketplace capability enabled | Lite join |
| Configure | Services (Service Engine), hours, photos, calendar, Stripe | Lite: Services · Availability · Profile · Payouts |
| Submit | Lifecycle → `pending_verification` | Lite dashboard |
| Operate | Bookings, messages, availability updates | Lite: Bookings · Messages |
| Earn | Stripe Connect payouts | Lite: Payouts |

### Ownership boundary

**Owns:** receiving marketplace bookings, managing services catalog, availability, booking threads, payouts.  
**Does not own:** CRM pipeline, email campaigns, memberships, team, inventory, ops verification UI.

**Boundary test:** *Does this help a provider receive and complete marketplace bookings?*  
If no → Hubly Pro.

### Upgrade path → Hubly Pro

```
Same Business → enable capabilities.hubly_pro → full /app
```

No migration. No copy. Profile, Service Engine catalog, bookings, availability, and Stripe stay on the same row.

### Platform v1 today
Frozen (Phase 5). `/marketplace-lite` — dashboard, bookings, messages, services, availability, profile, payouts.

---

## 3. Hubly Pro Experience

**Job:** Help a service business owner run everything — customers, jobs, marketing, revenue, team — whether or not they are on the marketplace.

### Who
Business with `capabilities.hubly_pro = true` (may also have marketplace).

### Entry
- Direct SaaS signup (`/app`, 14-day trial)
- Upgrade from Marketplace Lite (enable Pro capability)
- Website / instant site onboarding (Pro path)

### Journey

```
Sign up → Business + website + services → Run daily ops
    → (optional) pursue marketplace via Business Readiness
```

| Stage | What happens | Surface area |
|---|---|---|
| Acquire | Trial / signup; business + slug | Auth + onboarding |
| Operate | Jobs, customers, calendar, money, reports | Pro app views |
| Grow | Marketing, automations, memberships, coach | Pro-only modules |
| Publish | Public website + booking (Service Engine) | Website / Smart Quote / Chatbot |
| Expand | Optional marketplace opt-in | Readiness → Lite |

### Ownership boundary

**Owns:** CRM, customers, jobs, marketing, automations, memberships, coach, team, inventory, website builder, reporting.  
**Does not own:** marketplace verification decisions, ops analytics, trust & safety queues.

### Upgrade / expansion paths

| From | To | Mechanism |
|---|---|---|
| Hubly Pro only | Marketplace Provider | Enable `capabilities.marketplace` + complete readiness + verification |
| Marketplace Lite | Hubly Pro | Enable `capabilities.hubly_pro` |
| Either | Both | Same Business; both flags true |

### Platform v1 today
`/app` (hubly.html) — full business OS. Service Engine powers website, booking, chatbot, reporting.

---

## 4. Business Readiness Experience

**Job:** Help a business become **marketplace-ready** — complete, trustworthy, and bookable — before (or while) joining Marketplace Lite.

### Critical rule

> **Business Readiness is not a standalone product at this stage.**

It is a **future platform capability** — a guided layer that spans existing surfaces and engines. It does not get its own URL, nav product, or separate data model.

Think: readiness score + checklist + AI coaching + progressive unlock — **not** “Readiness App.”

### Who
- New business approaching marketplace (from Pro or direct Lite intent)
- Existing Lite provider improving score before / during verification
- Hubly Pro owner who wants marketplace listing

### What “marketplace-ready” means (aligned with v1 verification)

Readiness criteria mirror what Ops and Lite health already measure:

| Requirement | Why |
|---|---|
| Business identity (name, logo) | Trust |
| Service catalog (Service Engine) | Match + book real offers |
| Service photos / portfolio | Conversion |
| Business hours | Availability truth |
| Calendar connected | Instant book / scheduling |
| Stripe Connect | Get paid |
| Insurance / license (when required) | Ops verification |
| Response behavior | Quality signal |

Today these appear as:
- Lite **Marketplace Health** checklist (`buildMarketplaceHealth`)
- Ops **missing requirements** queue (`missingRequirements`)
- Lifecycle **`pending_verification` → `verified`**

Business Readiness **formalizes the journey** across those signals — it does not duplicate them.

### Journey (defined — not built)

```
Intent to join marketplace
    → Readiness assessment (what’s missing?)
    → Guided completion (services, photos, calendar, Stripe, …)
    → Submit for verification (lifecycle: pending_verification)
    → Ops review (Marketplace Ops — not Readiness UI)
    → Verified → full Marketplace Provider Experience
```

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ Business         │     │ Business Readiness  │     │ Marketplace Ops  │
│ (Pro or pre-Lite)│────▶│ capability (future) │────▶│ verification     │
└──────────────────┘     │ checklist + coach   │     │ approve / reject │
                         └─────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
                                                   Marketplace Provider (Lite)
                                                   lifecycle: verified
```

### Where Readiness lives (future — not implemented)

| Surface | Readiness role |
|---|---|
| Hubly Pro | “Join marketplace” entry; readiness panel while configuring |
| Marketplace Lite (pre-verify) | Health score + “complete to submit” before verification |
| AI Coach (Pro) | Explains gaps; suggests next step (derived, not required fields) |
| Marketplace Ops | Receives `pending_verification`; sees same missing-requirements list |

Readiness **does not** replace Ops verification. It **prepares** the business so verification is fast and pass-rate is high.

### Ownership boundary

**Owns (future):** readiness assessment, guided completion UX, progress score, submit-for-verification handoff.  
**Does not own:** final verify/reject (Ops), day-to-day booking ops (Lite), CRM (Pro).

### Connection to Marketplace verification

| Lifecycle state | Readiness role | Ops role |
|---|---|---|
| `draft` | Assess + guide setup | — |
| `hidden` | Re-engage if marketplace paused | — |
| `pending_verification` | Readiness complete; awaiting review | Approve → `verified` or reject |
| `verified` | Maintenance / quality tips (optional) | Trust monitoring |
| `rejected` | Show gaps; path to resubmit | Reason + notes |
| `suspended` | — | Ops action |

**Single Business rule:** Readiness writes to the same `businesses` row and `marketplace_providers` lifecycle extension — never a second profile.

### Platform v1 today
Partial signals exist (Lite health, Ops missing requirements, lifecycle).  
**No unified Business Readiness experience yet** — that is Phase 7+ scope, defined here first.

---

## Cross-experience movement map

```
                    ┌─────────────────────────────────────────┐
                    │         CONSUMER EXPERIENCE             │
                    │  (customers — no business account)        │
                    └─────────────────────────────────────────┘

┌───────────────────┐         ┌───────────────────────────────┐
│  HUBLY PRO        │◀───────▶│  MARKETPLACE PROVIDER (Lite)  │
│  capabilities.    │ enable  │  capabilities.marketplace   │
│  hubly_pro        │  pro    │  + verified lifecycle       │
└─────────┬─────────┘         └───────────────▲───────────────┘
          │                                   │
          │         ┌─────────────────────────┴───────────────┐
          └────────▶│  BUSINESS READINESS (capability)      │
                    │  prepare → submit → pending_verification│
                    └─────────────────────┬───────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │  MARKETPLACE OPS (internal)             │
                    │  verify · trust · lifecycle · analytics │
                    └─────────────────────────────────────────┘
```

### Upgrade path summary

| Path | What changes | What stays |
|---|---|---|
| Pro → Marketplace | `capabilities.marketplace`, readiness, verification | Same Business, Service Engine, Stripe |
| Lite → Pro | `capabilities.hubly_pro` | Same everything |
| Readiness → Lite (verified) | Lifecycle `verified` | Same Business |
| Consumer → anything | N/A (different user type) | — |

---

## Engine consumption by experience

| Engine | Consumer | Marketplace Provider | Hubly Pro | Business Readiness |
|---|---:|---:|---:|---:|
| AI Engine | ✅ intake | ⚪ | ⚪ coach (future) | ✅ coach (future) |
| Matching Engine | ✅ | ⚪ | ⚪ | ⚪ |
| Booking Engine | ✅ | ✅ | ✅ | ⚪ |
| Availability Engine | ✅ | ✅ | ✅ | ✅ assess |
| Payments Engine | ✅ | ✅ | ✅ | ✅ assess (Stripe) |
| Messaging Engine | ✅ | ✅ | ✅ | ⚪ |
| Service Engine | ✅ read | ✅ edit | ✅ edit | ✅ assess + guide |

---

## Phase 7 gate

Do **not** start Phase 7 implementation until this definition is approved.

Phase 7 candidates (to be scoped against this doc):
- Unified Business Readiness capability (checklist + coach + submit flow)
- AI-assisted onboarding to marketplace-ready state
- Tighter Pro ↔ Lite readiness handoff

Phase 7 must **not**:
- Create a standalone “Readiness” product with its own nav
- Fork Service Engine or duplicate catalog truth
- Blur Lite / Pro / Ops boundaries
- Skip Ops verification for marketplace listing

---

## Related docs

| Doc | Role |
|---|---|
| `docs/HUBLY_PLATFORM_ARCHITECTURE.md` | Hubly Platform v1 — engines, boundaries, freeze |
| `docs/SERVICE_ENGINE.md` | Canonical service catalog (Phase 6 frozen) |
| `docs/PLATFORM_ENTRY.md` | Phase 6.5 public front door (routes + auth entry) |
| `PROJECT_NOTES.md` | Implementation history and deploy notes |
