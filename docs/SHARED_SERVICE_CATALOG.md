# Phase 6 — Shared Service Catalog (data model)

**Status:** Design locked for implementation. Phase 5 is **FROZEN**.  
**Rule:** Do not redesign UI unless a consumer cannot read the catalog.  
**Rule:** No Marketplace Lite features. No Marketplace Ops expansion.

---

## Why this phase exists

Today services are referenced in several places that drift apart:

| Location | Role today | Problem |
|---|---|---|
| `businesses.meta.editorSvcs` | De-facto source for website + Lite | Dollar/hour fields; inconsistent keys |
| `businesses.meta.services` | Lossy mirror | Duplicates without payment/id fields |
| Relational `services` table | Chatbot only | Independent copy; goes stale |
| `businesses.meta.editorAddons` | Global add-ons | Not attached to services; Booking Engine ignores |
| Nested `addOns` on a service | Lite / booking DTO | Editor rarely produces these |
| `bookingWizard.services` | Snapshot for wizard UI | Not live truth |
| `marketplace_providers.ai_document` | Cached AI summary | Can lag behind edits |
| Industry blueprints | Starter templates | Not owner catalog |

**After Phase 6 there is exactly one owner catalog per Business.**  
Every Hubly experience **reads** that catalog. Nothing syncs copies.

```
Business
   └── Service Catalog  (single source of truth)
            ↓
   Marketplace · Website · Booking Engine · AI Concierge · AI Matching
   Provider Experience · Hubly Pro · Reporting · Future APIs
```

One edit. Updates everywhere.

---

## Engines (platform mental model)

| Engine | Phase | Job |
|---|---|---|
| AI Engine | 2 | Understand the job |
| Matching Engine | 3 | Rank providers for the job |
| Booking Engine | 4 | Confirm appointments |
| Availability Engine | 4/5 | Open slots from hours + calendars |
| Payments Engine | Stripe | Checkout + Connect |
| Provider Engine | 5 | Lite lifecycle for receiving jobs |
| Marketplace Ops | 5 | Quality / trust / verification |
| **Service Engine** | **6** | **Canonical catalog every consumer reads** |

---

## Core questions (answered)

### What is a Service?

A **Service** is a bookable offer owned by one Business.

It is the thing a customer hires: “Interior Detail”, “Exterior Window Clean”, “Weekly Lawn Cut”.

It is **not**:
- A membership plan (recurring entitlement — future, references Services)
- A CRM job row (execution record — may snapshot a Service)
- A marketplace listing (listing is the Business + lifecycle)

**One Business → one Service Catalog → many Service objects.**

### What belongs on a Service?

Identity, presentation, fulfillment, and pricing for that offer:

- Stable `id` (UUID string)
- `name`, `description`
- `category` (optional industry/tag for matching & website grouping)
- Duration (canonical: **minutes**)
- Base price (canonical: **integer cents**, currency)
- Pricing mode (`fixed` | `from` | `variable`)
- Variable price map when needed (e.g. vehicle tiers) — still cents
- What’s included (`includes[]`)
- Media (`image_url`, `photo_urls[]`)
- Visibility flags (`active`, `marketplace_visible`, `website_visible`, `popular`)
- Booking hints (`instant_book_eligible`, `buffer_before_min`, `buffer_after_min`)
- Optional payment override (`payment` — else inherit Business defaults)
- Ordered `addon_ids[]` (references Add-ons in the same catalog)
- Sort order + timestamps

### What belongs on a Package?

**Package is not a second entity in Phase 6.**

Historically Hubly used “package” and “service” interchangeably (`editorSvcs`).  
That conflation continues as naming debt only:

- Canonical term: **Service**
- UI copy may still say “Package” where the product already does
- There is **no** separate Package table or Package type

If a future product needs “bundles of services” (buy A+B together), that becomes a
**Bundle** entity later — out of Phase 6 scope. Do not invent Packages now.

### What belongs on an Add-on?

An **Add-on** is an optional priced modifier that can attach to one or more Services.

- Stable `id`
- `name`, `description` (optional)
- Price in **cents**
- `active`
- Optional duration delta in minutes (default `0`)

Add-ons live **in the same catalog** as Services (`catalog.addons[]`).  
Services reference them by id (`addon_ids`).  

This replaces both:
- orphaned global `editorAddons` with no service link, and
- only-nested add-ons that website editors never wrote.

### How does pricing work?

**Canonical money = integer cents + ISO currency (default `usd`).**  
**Canonical time = integer minutes.**

| Mode | Meaning |
|---|---|
| `fixed` | Single `price_cents` shown and charged |
| `from` | `price_cents` is the starting / from price (label “From $X”) |
| `variable` | `price_cents` is fallback; `variable_prices` map holds tier cents |

Deposit / pay-in-full rules:

1. Service may override Business payment defaults
2. Else Business `payment` defaults apply
3. Booking Engine computes `charge_now_cents` from rule + price (+ selected add-ons)

Legacy dollar fields (`price`, `dur` hours) are **migration input only**, never written by new code.

### How does AI consume a Service?

| Consumer | Reads | Uses for |
|---|---|---|
| AI Concierge | Catalog names, descriptions, includes, categories, add-on names | Recommend which Service fits the job; ask only gaps |
| AI Matching | Same + starting price + duration + active/marketplace flags | Specialization score, “why matched”, starting-at |
| AI document / Ops | Summarized catalog | Provider readiness & 360 |

AI must **not** keep a parallel industry-only catalog as truth for a specific Business.  
Industry knowledge packs remain **priors**; the Business catalog is **authority**.

### How does Booking consume a Service?

Booking Engine already wants:

```ts
service_id → { duration_minutes, price_cents, add_ons[], name }
```

Phase 6 makes that a direct read from the Service Engine (no field guessing).

On booking create, persist a **snapshot** (`service_snapshot`) so historical bookings
do not change when the catalog is edited later.

### How do future memberships consume a Service?

Memberships (Hubly Pro, later) should **reference** `service_id`s they entitle —
not copy price/name/duration.

```
MembershipPlan
  └── entitled_service_ids[]
```

Out of Phase 6 implementation scope; the model must not block it.

---

## Canonical schema (logical)

Stored on the Business as one JSON document until/unless volume forces tables.

**Recommended storage key (Phase 6):** `businesses.meta.service_catalog`  
**Read path:** Service Engine only.  
**Legacy keys:** `editorSvcs`, `services`, `editorAddons` become migrate-once inputs.

```ts
type ServiceCatalog = {
  version: 1;
  currency: "usd"; // catalog default
  updated_at: string; // ISO
  services: Service[];
  addons: Addon[];
};

type Service = {
  id: string;                    // uuid
  name: string;
  description: string | null;
  category: string | null;

  duration_minutes: number;      // > 0
  pricing: {
    mode: "fixed" | "from" | "variable";
    price_cents: number | null;
    variable_prices?: Record<string, number>; // cents by tier key
    show_price: boolean;
  };

  includes: string[];
  image_url: string | null;
  photo_urls: string[];

  addon_ids: string[];           // refs catalog.addons[].id
  sort_order: number;

  flags: {
    active: boolean;
    marketplace: boolean;        // eligible for marketplace consumers
    website: boolean;            // eligible for website / booking page
    popular: boolean;
    instant_book_eligible: boolean;
  };

  buffers?: {
    before_min?: number;
    after_min?: number;
  };

  /** null = inherit Business payment defaults */
  payment?: {
    rule: "pay_in_full" | "deposit" | "card_on_file" | "pay_after_service" | "customer_choice";
    deposit_type?: "pct" | "flat";
    deposit_val?: number;        // pct 0–100 or flat cents
  } | null;

  recommend_tag?: string | null; // website quiz affinity; optional
  created_at: string;
  updated_at: string;
};

type Addon = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  duration_delta_minutes: number; // default 0
  active: boolean;
  created_at: string;
  updated_at: string;
};
```

### Business payment defaults (unchanged ownership)

Remain on Business (columns +/or meta), not duplicated per experience:

```ts
payment: {
  rule: "pay_in_full" | "deposit" | "card_on_file" | "pay_after_service" | "customer_choice";
  deposit_type?: "pct" | "flat";
  deposit_val?: number;
  message?: string | null;
}
```

---

## Service Engine API (conceptual)

Single module, e.g. `supabase/functions/_shared/service_catalog.ts`
(and optional thin wrappers for Hubly Pro client).

| Function | Purpose |
|---|---|
| `getCatalog(business)` | Load + normalize catalog (migrate legacy on read if needed) |
| `listServices(business, { channel })` | Active services filtered for marketplace / website / all |
| `getService(business, serviceId)` | Resolve one service + hydrated add-ons |
| `upsertService` / `removeService` | Owner writes (Lite + Pro) |
| `upsertAddon` / `removeAddon` | Owner writes |
| `toBookingDto(service)` | Cents/minutes shape Booking Engine already uses |
| `toMatchDto(service)` | Name/desc/includes/price for Matching Engine |
| `toAiSummary(catalog)` | Compact list for concierge / documents |
| `snapshotService(service, addonIds)` | Immutable booking/job snapshot |

**Hard rule:** Consumers call the Service Engine. They do not read `editorSvcs` directly after cutover.

---

## Consumer contract

| Consumer | May | Must not |
|---|---|---|
| Marketplace listing | Read marketplace-visible services | Store its own packages table |
| Website | Read website-visible services | Keep a parallel `meta.services` truth |
| Booking Engine | Resolve by `service_id`, snapshot | Guess `dur` vs `durationMinutes` |
| AI Concierge / Matching | Read catalog for that Business | Invent a second Business catalog |
| Provider Experience (Lite) | Edit catalog (same engine) | Fork a “Lite services” schema |
| Hubly Pro | Edit catalog (same engine) | Write only to relational `services` |
| Chatbot | Read via Service Engine | Query legacy `services` table as truth |
| Reporting | Join on snapshot `service_id` + name | Assume live catalog price = historical |
| Ops / AI document | Summarize via Engine | Cache without rebuild-on-write |

---

## Migration strategy (implementation order)

1. **Ship Service Engine** that *reads* legacy `editorSvcs` (+ `editorAddons`, `services`) and *emits* canonical DTOs (backward compatible).
2. **Dual-write** new edits to `meta.service_catalog` while still updating `editorSvcs` for old UI.
3. **Point consumers one-by-one** at the Engine (Booking → Match → Lite → Website → Chatbot).
4. **Stop writing** `meta.services`, relational `services`, and wizard snapshots as truth.
5. **Rebuild** marketplace AI documents on catalog write.
6. **Freeze legacy keys** as read-only migrate paths; delete only after all writers are gone.

No big-bang UI redesign. Website package editor can keep looking the same while writing through the Engine.

---

## Explicit non-goals (Phase 6)

- Marketplace Lite feature expansion
- Marketplace Ops expansion
- Membership product implementation
- Inventory / SKUs / retail products
- Multi-location catalogs
- Customer-facing service browse/directory
- Redesigning Hubly Pro package UI for aesthetics

---

## Success criteria

- [ ] Every Business has one logical Service Catalog
- [ ] Marketplace, Website, Booking, AI Matching, Lite, and Hubly Pro resolve the same `service_id`
- [ ] Editing a service in Lite or Pro changes what Booking and Matching see without a sync job
- [ ] No new code path writes a second service list
- [ ] Booking snapshots remain stable historically
- [ ] Legacy shapes migrate without owner data loss

---

## Decision log

| Decision | Choice | Why |
|---|---|---|
| Storage | JSON on `businesses.meta.service_catalog` first | Matches one-Business model; avoids premature tables |
| Package entity | None — Service only | Removes years of package/service dual naming debt |
| Add-ons | First-class in catalog, referenced by id | Fixes global vs nested split |
| Money / time | Cents / minutes | Aligns Booking Engine + Stripe |
| Memberships | Reference service ids later | Avoids copying offers |
| UI | No redesign unless blocked | Phase 6 is architectural |
