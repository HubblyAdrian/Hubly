# Phase 6 — Service Engine

**Status:** Model approved · Schema frozen · Consumer migration in progress. Phase 5 is **FROZEN**.  
**Internal name:** Service Engine (not “Shared Service Catalog”).  
**Rule:** No Marketplace Lite features. No Marketplace Ops expansion. No UI redesign unless blocked.

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
Business
   ↓
Service Engine (one catalog)
   ↓
Marketplace → Website → Booking → AI → Lite → Pro → Reporting
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
Legacy `editorSvcs` / `services` / `editorAddons` are migrate-on-read + dual-write until cutover.

```ts
type ServiceCatalog = {
  version: 1;
  currency: "usd";
  updated_at: string;
  services: Service[];
  addons: Addon[];
};

type ServiceStatus = "active" | "inactive" | "archived";

type PricingMode = "fixed" | "from" | "variable" | "quote_required";

type Service = {
  id: string;
  name: string;
  description: string | null;

  /** Internal Hubly metadata — AI, matching, analytics. Not required customer-facing. */
  category: string | null;
  subcategory: string | null;

  status: ServiceStatus;         // active | inactive | archived

  duration_minutes: number;

  pricing: {
    mode: PricingMode;
    /** null when quote_required */
    price_cents: number | null;
    variable_prices?: Record<string, number>;
    show_price: boolean;
  };

  includes: string[];
  addon_ids: string[];
  sort_order: number;

  /** Service-owned media (not business-only). */
  media: {
    photos: string[];
    /** Reserved */
    videos?: string[];
    /** Reserved — pairs of { before, after } */
    before_after?: Array<{ before: string; after: string }>;
  };

  flags: {
    marketplace: boolean;
    website: boolean;
    popular: boolean;
    instant_book_eligible: boolean;
  };

  buffers?: { before_min?: number; after_min?: number };

  /** null = inherit Business payment defaults. Ignored when quote_required. */
  payment?: {
    rule: "pay_in_full" | "deposit" | "card_on_file" | "pay_after_service" | "customer_choice";
    deposit_type?: "pct" | "flat";
    deposit_val?: number;
  } | null;

  recommend_tag?: string | null;

  /**
   * Reserved AI intelligence — Phase 9/10.
   * Always present (`{}`-shaped object). Empty in Phase 6.
   * Do not omit; do not populate in Phase 6 consumers.
   */
  ai: ServiceAiMetadata;

  created_at: string;
  updated_at: string;
};

/**
 * Per-service intelligence. The Service becomes bookable *and* smart later.
 * Shape is LOCKED — approved for Phase 6 schema freeze.
 */
type ServiceAiMetadata = {
  recommended_addon_ids: string[];
  frequently_combined_service_ids: string[];
  suggested_upsells: Array<{
    kind: "addon" | "service";
    id: string;
    label?: string | null;
  }>;
  preparation_instructions: string | null;
  aftercare_instructions: string | null;
  estimated_completion_window: string | null; // e.g. "2–3 hours"
  seasonality: string[];                      // e.g. ["spring", "wedding_season"]
  common_customer_questions: Array<{ question: string; answer: string }>;
  customer_expectations: string | null;
  /** Forward-compat bag — promote named keys when a capability graduates */
  extensions: Record<string, unknown>;
};

type Addon = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  duration_delta_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
```

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

**Hard rules for Phase 6:**

1. Read/write must preserve `ai` and default it to empty.
2. Owner/Lite/Website saves that omit `ai` must keep the prior service’s `ai` (never wipe).
3. Do not populate or consume `ai` in Booking / Match / Concierge / Website yet.

### Architectural rule: AI metadata is derived, never required

Providers must **never** be expected to fill `service.ai` during normal setup.

These fields are eventually populated by:

- AI learning from the provider’s catalog
- Industry knowledge packs
- Marketplace performance
- Provider behavior
- Future AI coaching

Optional provider customization later is fine. The default experience requires **zero extra work**.

### Architectural rule: catalog always wins

The Service Engine is the source of truth.

AI metadata may **enrich** a Service.  
It may **never redefine** a Service.

| ✅ Allowed | ❌ Forbidden |
|---|---|
| Recommend Odor Removal with Interior Detail (both in catalog) | Invent Ceramic Coating when the provider doesn’t offer it |

---

### Service status

| Status | Meaning |
|---|---|
| `active` | Bookable / listable (subject to channel flags) |
| `inactive` | Temporarily hidden — not deleted |
| `archived` | Retired — kept for history, never offered |

### Pricing modes

| Mode | Meaning |
|---|---|
| `fixed` | Single `price_cents` |
| `from` | Starting-at price |
| `variable` | Tier map in cents |
| `quote_required` | No upfront price — still requestable/bookable; provider prices after review |

### Category metadata

`category` + `subcategory` are **internal** (AI Matching, analytics, ops).  
Customers never need to see them.

Examples: `Detailing` / `Interior` · `Window Cleaning` / `Residential` · `Photography` / `Wedding`.

---

## AI rule (hard)

Industry packs are **priors** only.

1. The Business catalog is the source of truth.
2. AI may recommend combinations of **existing** Services and Add-ons.
3. AI may **never invent** a Service that does not exist in the provider’s catalog.

If the provider does not offer Ceramic Coating, AI cannot recommend Ceramic Coating.  
It may recommend Interior Detail + Odor Removal when those exist.

---

## Booking snapshots

Bookings store an immutable `service_snapshot` (name, duration, price, add-ons, pricing mode).  
Later catalog edits never rewrite history.

---

## Consumer migration order

1. Booking Engine — done  
2. Matching Engine — done  
3. Provider Experience (Lite) — done  
4. Website / Hubly Pro — **done** (read + dual-write `service_catalog`)  
5. Chatbot — **done** (Service Engine, website channel)  
6. Reporting — **done** (aggregate by `service_id` / catalog match)

Hard rule: consumers call the Service Engine. No new direct `editorSvcs` / relational `services` readers in new code.

Do **not** introduce new Service Engine concepts during migration. Objective: every consumer reads the same catalog.

---

## Final schema review (locked)

| Area | Status | Notes |
|---|---|---|
| Identity / status / category | Locked | |
| Pricing + quote_required | Locked | |
| Add-ons by reference | Locked | |
| Media (photos + future) | Locked | |
| Booking snapshots | Locked | |
| AI invent-forbidden | Locked | |
| `service.ai` reserved shape | **Locked** | Empty by default; derived later; never setup-required |
| AI enrich ≠ redefine | Locked | Catalog always wins |
| Memberships | Out of scope | Will reference `service_id` later |
| Bundles (A+B SKUs) | Out of scope | Not Packages |

---

## Success criteria

- [x] Service Engine module (`service_engine.ts`) + canonical schema
- [x] Booking Engine reads Service Engine (incl. quote_required + snapshots)
- [x] Matching Engine scores only catalog Services / Add-ons
- [x] Provider Experience dual-writes `meta.service_catalog` (+ legacy mirrors)
- [x] AI document directives: invent_services_forbidden
- [x] `service.ai` reserved (empty, always present) for Phase 9/10 — shape locked
- [x] Philosophy + derived-metadata + catalog-wins rules documented
- [x] Website / Hubly Pro: prefer `service_catalog` on load; dual-write on save
- [x] Chatbot reads Service Engine (website channel) — no relational `services` query
- [x] Reporting aggregates by `service_id` / catalog name match (“By service”)
