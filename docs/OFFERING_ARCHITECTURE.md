# The canonical Offering architecture — discovery and plan

**Phase 1 discovery, 2026-09-21. Architecture only: no code, no SQL, no migration, no deploy,
no database write was made to produce this.** Everything below is read from the repo, the
committed `docs/schema.sql` dump, and prior rulings. Where a number is quoted from an earlier
measurement it says so and gives the date — a scar note is a memory of a measurement, not a
measurement.

---

## A. DISCOVERY — what already exists

### A1. An Offering model already exists, in three different forms, and they disagree

**Conceptually — and it is already RULED.** `docs/SETTLED.md` #1a and `docs/BLOCK_SPEC.md`
(both dated 2026-09-20):

> **Offering and Product are separate canonical entities with separate stable ids** —
> `services.id` and `commerce_products.id` — that happen to render through one block mechanism.
> An Offering is something the business DOES; a Product is something it SELLS.

That ruling also states the direction of travel, explicitly:

> **Names are attributes, never identity.** The href shapes carry a NAME today (`svc=<name>`,
> `sku=<name>`); that is the form this spec was written in, and it is **the thing the Offering
> work is changing** — a rename must not change what a card points at.

**So Phase 1 is not choosing an architecture. It is executing one that was ruled and never
built.**

**Structurally, as a type.** `supabase/functions/_shared/service_engine.ts` defines
`HublyService` — a rich model carrying identity, description, category, media, pricing mode,
lifecycle status, sort order, `flags.website` / `flags.marketplace` / `flags.instant_book_eligible`,
and the two-axis `offer: { kind, sale }`. **Every field group this phase asked for already exists
on that type.** There is nothing conceptual left to invent.

**As two stores.** `docs/SETTLED.md` #2 — two website stores, and the same split runs through
services:

| store | shape | id space | who reads it |
|---|---|---|---|
| **`public.services`** (table) | 11 columns, flat | `uuid`, `gen_random_uuid()` | freeform placement, `get_business_services`, the record-edit path |
| **`businesses.meta.service_catalog`** (JSON) | `ServiceCatalog v1` → `HublyService[]` | `text`, client-generated | classic renderer, booking engine, marketplace, `offerType` |

### A2. The type model is already built

`docs/OFFER_TYPE.md` (2026-09-16, `npm run check:offer-type`). Two **independent** axes on the
offer:

- `kind` — `service` · `membership` · `other` · `unknown` — *what it is*
- `sale` — `bookable` · `quoted` · `unknown` — *how someone gets it*

with a precedence rule that is itself a settled decision: **declared → unreadable-declaration →
structural → ask.** "Untyped must not guess." This is the `CUSTOMER ACTION` group of this phase,
already specified and already checked.

### A3. What the other nouns turn out to be

| noun | what it actually is | bearing on Offering identity |
|---|---|---|
| **services** | a 11-column table; uuid PK | **candidate owner** |
| **service catalogue** | `meta.service_catalog`, `HublyService[]` | the rich model, the wrong store |
| **Product** | `commerce_products` — a full engine: variants, collections, **bundles**, carts, orders, discounts, gift cards, inventory | **separate entity, already ruled** |
| **Commerce / Storefront** | 18 `commerce_*` tables + `website_pages` | consumes Product, not Offering |
| **Website AST** | `business_documents.rendered_html` + build-time anchors | **projection** |
| **Booking** | `booking_requests` → `jobs` | consumer; **name-keyed** |
| **Jobs** | `jobs` | consumer + historical record |
| **Marketplace** | `marketplace_*`; `marketplace_bookings.service_snapshot jsonb` | consumer; already snapshots |
| **Business** | `businesses` | the owner of everything here |
| **Business DNA** | Business Profile + Owner Profile (`HUBLY_MEMORY.md`) | knowledge *about* the business, not what it sells |
| **Business Instance** | one real company = a `businesses` row (`HUBLY_RUNTIME_SPEC.md`) | a layering concept, not a store |
| **Capabilities** | `businesses.capabilities` jsonb + the 212-function registry | gates surfaces, does not own identity |

**Neither Business DNA nor Business Instance is a rival home for Offering identity.** They are a
layer above (which company) and a layer beside (what we know about it).

### A4. The reference graph as it stands — measured from `docs/schema.sql`

**Exactly ONE foreign key in the entire database references `services.id`:**

```
service_photos.service_id  uuid  →  services(id)  ON DELETE CASCADE
```

Everything else that points at an offering points at it **by name, or by a text id from the
other store**:

| holder | column | type | what it actually contains |
|---|---|---|---|
| `booking_requests` | `service_name` | text | the name, and **nothing else** — no id column at all |
| `jobs` | `service_name` + `service_id` | text + **text** | name, plus a **catalog** id |
| `marketplace_bookings` | `service_name` + `service_id` + `service_snapshot` | text + text + jsonb | name, catalog id, and a snapshot |
| `recurring_schedules` | `service_id` | **text** | a catalog id |
| website page | `data-hubly-service="<name>"`, `data-hubly-price="<name>"` | attribute | **the name** |
| booking URL | `?book=1&svc=<name>` | query | **the name** |
| `get_business_services()` | returns `name, price, …, source, conflicts` | — | **no id is returned at all** |
| jobs↔services SQL join | `s.business_id = j.business_id AND s.name = j.service_name` | — | **a name join inside the database** |

**And the two id spaces are already crossed.** `booking_job.ts` fills `jobs.service_id` via
`resolveServiceIdByName(business, name)`, which searches **`getCatalog(business)`** — so
`jobs.service_id` holds a *catalog* id while `docs/BLOCK_SPEC.md` declares `services.id` the
Offering identity. The comment there states the discipline that must survive migration:

> *"Never invent a service_id — a wrong one mislabels revenue."*

### A5. Two structural hazards found during this discovery

**(i) The catalog's identity generation has an unreachable branch.** `service_engine.ts:331`:

```ts
const id = String(raw.id || `svc-${index}` || newId("svc"));
```

`` `svc-${index}` `` is always a non-empty string, so **`newId("svc")` can never execute**. The
evident intent — stored id, else a *fresh unique* id — is not what runs: an offer with no stored
id gets a **positional** id (`svc-0`, `svc-1`, …). Reorder the array and `svc-2` denotes a
different service. Line 462 has the same dead branch for addons.

*What would make this less serious than it reads:* the fallback only fires when `raw.id` is
absent, so if every persisted offer has always carried a real id, no positional id was ever
stored, and nothing downstream points at one. **That cannot be checked from the repo and was not
measured** (no service-role key in this environment). So: a real defect in the identity path, with
its realisation in live data **unmeasured**. It must be measured before any backfill keys on a
catalog id.

**(ii) `services.price numeric NOT NULL DEFAULT 0`.** Zero is indistinguishable from "no price
set". Any pricing-mode derivation that reads `0` as *free* will publish a false price.

### A6. Which store actually holds the data

Quoted from `docs/SERVICE_STORES_RESOLVED.md`, **measured 2026-09-16 and not re-counted today**:

| | businesses |
|---|---|
| examined (claimed, or named rather than `site-*`) | 194 |
| **only the `services` table** | **78** |
| only `meta.service_catalog` | 3 |
| both populated | 5 |
| neither | 108 |
| both populated **and genuinely different** | **2** |

The two real conflicts are `adrians-lawn-service` (table holds window-cleaning rows *with
duplicates*, catalog holds lawn services) and **`graefs-autocare` — the only paying customer,
whose 8 real services are in the CATALOG while the table holds one stray row, `clay and seal`.**

**Four market businesses serve the classic renderer** (`aquaspeed`, `bucket-mobile-detailing`,
`devdetailing661`, `graefs-autocare`), and classic is a **supported path, not a legacy exception**
(CLAUDE.md). The classic renderer reads the catalog. **Therefore the catalog cannot be deleted —
only demoted to a projection.**

---

## B. THE CANONICAL MODEL — the ten answers

**1. What represents the identity of something a business sells?**
A row in a real table with a database-generated uuid, owned by one `business_id`, whose identity
is independent of its name, its price, its position in an array and its presence on any page.

**2. Which existing table/model should own that identity?**
**`public.services`.** It is the only candidate that already has a uuid primary key with a
`gen_random_uuid()` default, can carry a foreign key (one already points at it), can be
row-level-secured, and cannot be re-ordered into a different meaning.

**3. Should the existing `services` table become the canonical Offering record?**
**Yes — extended, not replaced.** Its *identity* is right and its *field set* is poor: it has 11
columns where `HublyService` has ~20 meaningful ones. The work is to move the catalog's richness
onto the table, not to move the table's identity into the catalog.

The alternative — making `meta.service_catalog` canonical — is rejected on evidence, not taste:
- its ids are client-generated and can fall back to **positional** (A5-i);
- JSON in a column cannot be referenced by a foreign key, so `service_photos` and every future
  reference would stay name-based forever;
- per-row authorisation is impossible; the whole blob is one grant;
- **78 businesses have only the table** against 3 with only the catalog (2026-09-16).

**4. Does another existing model already represent this?**
Yes — **`HublyService`** represents it *as a type*, completely, and `meta.service_catalog` stores
it. This is the crucial discovery: **the model is not missing, only mis-stored.** Phase 1 is a
store migration, not a modelling exercise.

**5. Is a genuinely new Offering model required?**
**No. No new table and no new abstraction.** "Offering" is the *name* for what `services` rows
become once they carry `HublyService`'s fields. Introducing an `offerings` table beside
`services` would create a third representation of the thing whose duplication is the problem.

**6. What should Product represent relative to Offering?**
A sibling, never a subtype. **Offering = what the business DOES** (`services`, action `book`).
**Product = what it SELLS** (`commerce_products`, action `buy`). Separate id spaces that are
**never merged** (`BLOCK_SPEC.md`). They share one card and one block mechanism; the action is the
only service-specific part of the markup.

**7. Can one business have both Offerings and Products?**
**Yes, and the spec already names the case** — a photographer with a *Wedding Photography*
Offering and an *8x10 Print* Product. Two records, two stores, one grid.

**8. How should Website, Booking, Jobs, Storefront, Marketplace and AI reference the canonical entity?**

| consumer | reference | why |
|---|---|---|
| **Website** | `data-hubly-offering="<uuid>"` stamped **at generation**, beside the existing `data-hubly-service="<name>"` | a freeform page has no update path; anything a later change must find has to be marked while we still know what it is (CLAUDE.md) |
| **Booking** | `service_id uuid` on the request; `?svc=` accepts **id or name**, id first | a live URL must never stop working |
| **Jobs** | `service_id uuid` **plus** the `service_name` it was sold under, kept forever | a job is history; it must render correctly after a rename or a delete |
| **Storefront** | `commerce_products.id` — untouched by this work | separate entity |
| **Marketplace** | `service_id uuid` + the existing `service_snapshot jsonb` | the snapshot pattern is already right here; copy it, don't invent one |
| **AI** | resolves **by id**; when the owner speaks a name, resolves name→id against the canonical store and **asks on ambiguity** | "never invent a service_id"; and duplicate names exist today |

**9. What stable ID should be used?**
**`services.id` (uuid).** Database-generated, opaque, never derived from name, price or position.
The name travels **beside** it as an attribute and as a historical snapshot — never as the key.

**10. Which current name-based relationships must eventually move to ID-based?**
All of these, and they are the whole work list:

1. `booking_requests.service_name` → add `service_id uuid` (no id column exists today)
2. `jobs.service_name` + `jobs.service_id (text, catalog)` → `service_id uuid`, name retained as snapshot
3. `marketplace_bookings.service_name` + `service_id (text)` → uuid
4. `recurring_schedules.service_id (text)` → uuid
5. `service_photos.service_id` → **already correct**; the model for the rest
6. the in-database join `s.name = j.service_name`
7. the two-store reconciliation join on `lower(btrim(name))`
8. `get_business_services()` — must return the id
9. `applyServicesToFreeform(services: {name, price?, description?}[])` — three fields, keyed by name
10. website anchors `data-hubly-service` / `data-hubly-price` / `data-hubly-desc`, keyed by name
11. booking hrefs `?book=1&svc=<name>` (and `?buy=1&sku=<name>` on the product side)
12. `renameServiceInFreeform` — exists **only because** the reference is a name

---

## C. DATA MODEL — `services` mapped to Offering

`services` today: `id`, `business_id`, `name`, `description`, `price`, `duration_hours`,
`includes[]`, `is_popular`, `sort_order`, `created_at`, `show_price`.

| group | field | today | source | note |
|---|---|---|---|---|
| **IDENTITY** | `id` | ✅ `uuid` | — | canonical, never derived |
| | `business_id` | ⚠️ `uuid` **nullable, no FK in the dump** | — | should be `not null` + FK; orphan rows are possible today |
| | `name` | ✅ `text not null` | — | **attribute, not identity** |
| **CUSTOMER-FACING** | `description` | ✅ | — | |
| | `media` | ❌ | `HublyService.media` + `service_photos` | a table already exists with the only correct FK; prefer it over a jsonb blob |
| | `category` | ❌ | `HublyService.category` (+`subcategory`) | |
| **COMMERCIAL** | `pricing_mode` | ❌ | `PricingMode` (`fixed`/`from`/`variable`/`quote_required`) | **the missing field that makes `price = 0` readable** |
| | `amount` | ⚠️ `price numeric not null default 0` | — | 0 ≡ "unset"; store cents, and let mode carry the meaning |
| | `currency` | ❌ | catalog-level `"usd"` | per-offering, defaulted |
| | `show_price` | ✅ added 2026-09-18 | — | duplicated in the catalog; this migration ends that |
| **OPERATIONAL** | `duration` | ✅ `duration_hours` | catalog uses `duration_minutes` | **unit conflict — pick minutes, convert once** |
| | `sort_order` | ✅ | — | |
| **AVAILABILITY** | `lifecycle` | ❌ | `ServiceStatus` `active/inactive/archived` | **archive, never delete** — a deleted offering orphans history |
| | `website_visible` | ❌ | `flags.website` | |
| | `marketplace_visible` | ❌ | `flags.marketplace` | |
| | `instant_book` | ❌ | `flags.instant_book_eligible` | |
| **CUSTOMER ACTION** | `offer_kind` | ❌ | `offer.kind` | `service/membership/other/unknown` |
| | `offer_sale` | ❌ | `offer.sale` | `bookable/quoted/unknown` — **`unknown` must persist and ask, never default to bookable** |

Also already present and worth keeping: `includes text[]` (part of what the offering *is*) and
`is_popular` (→ `flags.popular`, merchandising).

### Fields that must NOT belong to Offering

| field | belongs to | why |
|---|---|---|
| `vehicle_*`, `condition`, `address` | `booking_requests` / `jobs` | facts about one **occasion**, not the thing sold |
| `customer_*`, `scheduled_*`, `status`, `paid`, `amount` | `jobs` | an instance, not a definition |
| `inventory`, `track_inventory`, `sku`, `barcode`, `weight_grams` | `commerce_products` | **Product** concerns; an Offering has no stock |
| `customer_id`, `next_due_date`, `source_plan_ref` | `memberships` | OFFER : MEMBERSHIP :: SERVICE : JOB (`OFFER_TYPE.md`) |
| `ai` metadata | reserved (Phase 9/10) | explicitly out of scope by its own comment |
| add-ons | `addons` / `addon_ids` | a related entity, referenced not embedded |
| availability rules, buffers | booking engine | scheduling policy, not identity — `buffers` may ride along but is not Offering identity |

---

## D. MIGRATION PLAN — smallest safe sequence

**Nothing below is implemented. No step may be started before the one above it is measured.**

Two invariants hold across every step:

- **Name resolution is never removed, only demoted.** Every id lookup falls back to the exact-name
  rule that runs today. A live booking URL must work forever.
- **Nothing is deleted.** Offerings are archived; catalogs are demoted to projections; names are
  retained as snapshots.

### Step 0 — Measure, before touching anything
*Current:* two stores, counts dated 2026-09-16, and the A5-i hazard unmeasured.
*Desired:* today's counts, plus three specific answers: how many catalog offers **lack a stored
id** (positional-id exposure); how many `jobs.service_id` / `marketplace_bookings.service_id` /
`recurring_schedules.service_id` values resolve to a catalog offer; how many businesses have
**duplicate service names** (name→id backfill is ambiguous there — `star-windows` had 4 duplicates
and `adrians-lawn-service` has duplicate rows).
*Risk if skipped:* a backfill keyed on an unstable id, silently mis-attributing revenue.
*Touches:* nothing. Read-only.

### Step 1 — Extend `services` additively
*Current:* 11 columns. *Desired:* the C table's fields exist, every one nullable or defaulted so
that **every existing row renders exactly as it does today**.
*Compat:* additive only; no reader changes; `graefs-autocare` is read-only and unaffected by a
defaulted column.
*Risk:* low. The only trap is defaulting `offer_sale` to `bookable` — it must default to
`unknown`, because "untyped must not guess."

### Step 2 — Backfill the catalog into the table, keeping the old key
*Current:* 3 businesses catalog-only, 5 both, 2 conflicting — including the paying customer.
*Desired:* one `services` row per catalog offer, carrying `legacy_catalog_id text` so that every
existing `jobs.service_id` / `marketplace_bookings.service_id` / `recurring_schedules.service_id`
text value **still resolves** after the move.
*Protection:* the 2 genuine conflicts are **resolved by Adrian, one at a time, never merged
programmatically** — `adrians-lawn-service` holds two businesses' data in one record, and
`graefs-autocare` is READ-ONLY and must be the last one touched, by hand, with his page
byte-compared before and after.
*Risk:* duplicate names make the join ambiguous; where a name is duplicated the backfill **stops
and reports**, it does not pick.

### Step 3 — Add uuid references beside the name ones
*Current:* `booking_requests` has no id column; three tables hold text ids.
*Desired:* `service_id uuid` (nullable, FK, `on delete set null`) on `booking_requests`, `jobs`,
`marketplace_bookings`, `recurring_schedules`; backfilled by **exact name match within the
business**, never fuzzy, `null` when not exactly one match.
*Compat:* `service_name` is untouched and keeps being written. Nothing reads the new column yet.
*History:* `null` is the honest value for a historical row whose offering no longer exists — the
`service_name` snapshot is what renders it.

### Step 4 — Readers return the id; writers populate it
*Desired:* `get_business_services()` returns `id`; the booking and job writers set `service_id`
from the resolved offering; `applyServicesToFreeform` takes an id alongside name/price.
*Compat:* return shape only ever **gains** a column — the pattern `get_business_services` already
used when it gained `source`/`conflicts`.

### Step 5 — Stamp the page with the id at generation
*Current:* `data-hubly-service="<name>"`; a rename needs `renameServiceInFreeform` to rewrite HTML.
*Desired:* `data-hubly-offering="<uuid>"` stamped **at generation**, the name anchor kept as an
alias exactly as `BLOCK_SPEC` keeps `data-hubly-services-block`.
*Why at generation:* a freeform page is a single generation with no update path; re-finding an
element later by its markup shape is a matcher per shape and the model invents new shapes every
rebuild (CLAUDE.md). **No page is rebuilt for this** — existing pages keep their name anchors and
keep working; new generations carry both.

### Step 6 — Booking URLs accept an id, still accept a name
*Desired:* `?book=1&svc=<uuid-or-name>`; resolution order **id → exact name → ask**.
*Compat:* **every URL ever printed, texted, or linked keeps working.** This is also where the
known apostrophe defect in the `svc=` regex gets fixed, since that code is being touched anyway.

### Step 7 — Demote the catalog to a projection
*Current:* the catalog is written by several paths and read by the classic renderer, the booking
engine and the marketplace.
*Desired:* one writer derives `meta.service_catalog` **from** `services`; nothing else writes it.
**It is not deleted** — four market businesses serve classic and classic is supported.
*Risk:* highest step in the plan, and the one where the paying customer is most exposed. Gate it
on a byte-comparison of every classic page before and after.

### Step 8 — Retire name joins, last
*Desired:* the SQL `s.name = j.service_name` join and the `lower(btrim(name))` reconciliation are
removed **only after** a measurement shows every live row carries a uuid.
*Compat:* this is the only step that removes anything, and it removes nothing a customer can see.

### How each concern is protected

| concern | mechanism |
|---|---|
| existing `services.id` | never changes; it *becomes* the Offering id |
| existing catalogue ids | preserved in `legacy_catalog_id`; old text references keep resolving |
| name-based joins | kept until Step 8, then removed only on measured evidence |
| `booking_requests.service_name` | kept forever as the snapshot of what was booked |
| `jobs.service_name` | kept forever; a job must render after a rename or archive |
| historical snapshots | `marketplace_bookings.service_snapshot` is the pattern; extend it rather than invent one |
| existing booking URLs | name resolution never removed |
| website anchors | new pages gain the id anchor; old pages keep the name anchor; **no rebuild** |
| storefront | untouched — `commerce_products` is a separate entity |
| AI resolution | id first; name→id within the business; **ambiguity asks**, never guesses |

---

## What this phase deliberately did not decide

- **Bundles.** `commerce_bundles` and `commerce_bundle_products` already exist for Products. A
  bundle spanning Offerings *and* Products is a real future shape and is **out of scope**.
- **Whether `duration` becomes minutes.** Recommended (the catalog already uses minutes), but it
  is a conversion with a data cost and belongs to Step 1's detailed design.
- **Whether `media` lives in `service_photos` or a jsonb column.** `service_photos` holds the only
  correct FK in the system, which argues for it; not settled here.
