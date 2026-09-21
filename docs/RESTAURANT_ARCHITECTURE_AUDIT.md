# Restaurants against the Offering/Product architecture — a compatibility audit

**2026-09-21. Audit only: no code, no SQL, no migration, no endpoint, no OpenAI key, no deploy,
no database write was made to produce this.** Everything below is read from the repo, the
committed `docs/schema.sql` dump, and prior rulings.

**The headline: a restaurant does not stress this architecture, it validates it.** A menu item is
a **Product**. Catering and private events are **Offerings**. A restaurant is therefore the
photographer case from `docs/BLOCK_SPEC.md` — one business holding both — and the existing
commerce engine already covers most of a menu. **No restaurant system should be built.**

---

## 1. WHAT A MENU ITEM IS

`docs/BLOCK_SPEC.md` and `docs/SETTLED.md` #1a already give the test, and it decides this
without a new rule:

> **An Offering is something the business DOES for a customer. A Product is something the
> business SELLS.** Offering's action is `book` → booking panel. Product's action is `buy` →
> checkout panel.

A burger is **sold**, not performed. Its action is **buy**. It has no duration, no scheduling, no
job, no calendar. **A menu item is a Product — `commerce_products`.**

The same test cleanly splits the rest of a restaurant's business:

| the restaurant sells… | entity | store | action |
|---|---|---|---|
| a burger, a latte, a bottle of wine | **Product** | `commerce_products` | `buy` |
| catering for 40 people | **Offering** | `services` | `book` / quote |
| a private dining room hire | **Offering** | `services` | `book` |
| a cooking class | **Offering** | `services` | `book` |
| delivery / takeout | **fulfilment mode**, not an entity | `commerce_shipping_profiles` | — |
| a gift card | **Product** (`product_type='gift_card'`, already exists) | `commerce_products` | `buy` |

**8. Can one business hold both?** Yes — and this is the case the spec was written for. A
restaurant's menu lives in `commerce_products`; its catering lives in `services`. Two id spaces
that are never merged, rendering through one block mechanism with different actions. The
photographer (*Wedding Photography* Offering + *8x10 Print* Product) and the restaurant (catering
Offering + burger Product) are the same shape.

**Catering is the interesting case and it confirms the model.** Catering is quoted, scheduled,
produces a `job`, and its price is often `quote_required` — every one of those is an Offering
property that `PricingMode` and the `offer.sale` axis already carry. Forcing catering into
`commerce_products` would lose the booking, the job and the quote. Forcing a burger into
`services` would give it a duration and a calendar it does not want.

---

## 2. WHAT THE COMMERCE ENGINE ALREADY SUPPORTS — measured against a real menu

| menu concept | existing model | verdict |
|---|---|---|
| **menu item** | `commerce_products` — name, slug, description, `short_description`, `price_cents`, `compare_at_cents`, status, `featured`, `seo`, `metadata` | ✅ direct fit |
| **menu section** (Starters, Mains) | `commerce_collections` (name, slug, `published`, `sort_order`) | ✅ direct fit |
| **item order within a section** | `commerce_collection_products.sort_order` | ✅ — the join carries its own order |
| **section order on the page** | `commerce_collections.sort_order` | ✅ |
| **sizes** (12oz/16oz, 9"/12") | `commerce_product_variants` — `name`, `price_cents`, `options jsonb` | ✅ direct fit |
| **combo / meal deal** | `commerce_bundles` + `commerce_bundle_products`, with `discount_cents` | ✅ direct fit |
| **prices** | `price_cents` int; currency on `commerce_store_settings.currency` | ✅ |
| **descriptions** | `description` + `short_description` | ✅ |
| **images** | `commerce_product_images` — url, alt, `sort_order` | ✅ |
| **published / hidden** | `status` (`draft`/`active`/`archived`) + `visibility jsonb` | ✅ |
| **sold out** | `inventory` + `track_inventory`; checkout refuses `insufficient_stock` | ✅ mechanism exists (but see 4.2) |
| **takeout / delivery** | `commerce_shipping_profiles.mode` ∈ `pickup｜flat_rate｜local_delivery｜free`, and `shipping_defaults` already ships exactly those four | ✅ **already first-class** |
| **customer ordering** | `commerce_carts` → `commerce_cart_items` → `commerce_orders` → `commerce_order_items` → `create-store-checkout` | ✅ complete path |
| **order history integrity** | `commerce_order_items.title` + `unit_price_cents` are **snapshotted** on the row | ✅ same discipline as `jobs.service_name` |

**5. Does the existing commerce engine support a restaurant?** Substantially yes. Eighteen
`commerce_*` tables cover catalog, merchandising, cart, order, payment, refund, inventory and
fulfilment. Pickup and local delivery were already modelled before any restaurant asked.

**3. Can collections represent menu sections?** Yes, without modification. A menu *is* an ordered
list of named, published sections each holding an ordered list of items — which is
`commerce_collections` + `commerce_collection_products` exactly.

**2. Do modifiers and variants already have a model?** **Variants yes. Modifiers no** — see 3.1.

---

## 3. WHAT IS GENUINELY MISSING

### 3.1 Modifiers — the one real structural gap

A **variant** is a distinct sellable unit with its own price, SKU and stock (a 12" pizza). A
**modifier** is a choice applied to a line item: *add bacon +$2*, *no onions*, *choose 2 sides*,
*extra shot*. They differ in three ways the current model cannot express:

- **grouping** — "Choose your side" is a group; bacon and onions are not interchangeable options
- **constraints** — required/optional, single/multi, min/max ("choose exactly 2")
- **selection recorded on the line** — `commerce_cart_items` and `commerce_order_items` have
  **no column for selections**. An order cannot record "no onions" today.

`public.addons` exists but does not fill this: it is flat (no groups, no constraints),
business-level (not attached to a product), and service-shaped — `HublyAddon` carries
`duration_delta_minutes`, and `services.addon_ids` links it to Offerings, not Products.

**This is not restaurant-specific and must not be built as a restaurant feature.** "Add bacon" is
structurally identical to a detailer's "add a wax", an engraver's "add a message", a printer's
"upgrade the paper". The correct shape is **modifier groups attachable to a Product *or* an
Offering**, with the selection snapshotted onto the cart/order line the way `title` and
`unit_price_cents` already are.

### 3.2 Time-windowed availability

Breakfast until 11am, Sunday roast, happy-hour pricing. There is **no per-item availability
window**; `businesses.meta.hours` describes the business, not the dish. Also not
restaurant-specific — a detailer's winter package is the same shape.

### 3.3 "Market price" has no clean representation

A dish priced *MP* is the Product-side equivalent of `PricingMode.quote_required`, which exists on
the Offering side and has no counterpart on `commerce_products` (`price_cents` is a plain int).
Today it would be a `0`, which is the same "zero means unset" trap already recorded against
`services.price`.

### 3.4 Dietary and allergen information

Could ride `metadata jsonb`. **It should not, yet, and never from AI.** An allergen statement is a
safety claim a customer acts on, and CLAUDE.md's ruling on seeded content applies at its
strongest here: *"a price is a number someone can argue with; A LIST OF DELIVERABLES IS A PROMISE
A CUSTOMER CAN HOLD HIM TO."* Allergen data is the most consequential version of that promise.

---

## 4. TWO DEFECTS THAT WOULD BITE A RESTAURANT SPECIFICALLY

### 4.1 The import endpoint silently swallows duplicate names

`commerce_products` has `unique (business_id, slug)`, and `POST /products/import` derives the slug
from the name (`slugify(raw.slug || name)`). The insert loop is:

```ts
const { data, error } = await admin.from("commerce_products").insert(row).select("*").single();
if (!error && data) inserted.push(data);
```

**A failed insert is discarded without a word.** The response reports `imported: N` with no
indication that anything was dropped.

Menus repeat names far more than product catalogs do — *House Salad* on both the lunch and dinner
menu, *Garlic Bread* as a starter and a side. Importing such a menu drops the second occurrence
silently and reports success for a smaller number. That is prohibition 6 (a state change reported
without visible truth) and the false-success class this repo has paid for repeatedly.

### 4.2 Imported menu items are unbuyable if activated

*Stated before the claim — what would make this less serious than it reads:* it only bites once an
item is moved to `active` **and** a customer tries to buy it; the owner can fix it per product in
the Store admin; and nothing reaches a customer automatically because imports land as `draft`.

The import row sets `inventory: 0` and **never sets `track_inventory`**, so the column default
`true` applies. Checkout then refuses:

```ts
} else if (!isStockless && product.track_inventory !== false && product.inventory != null) {
  if (Number(product.inventory) < qty) return empty("insufficient_stock", …);
}
```

So every imported dish is `have 0, want 1`. Restaurants do not inventory-count most dishes; the
goods-shaped defaults (`track_inventory` on, `low_stock_at 5`, plus `weight_grams` and `barcode`)
are a **default mismatch, not a structural flaw**.

---

## 5. WEBSITE AND STOREFRONT

**7. How do menu items relate to Website and Storefront?** Through the mechanism that already
exists, with nothing new:

- `SETTLED.md` #1: **a storefront IS a website** — same model call, same freeform generation,
  **"no separate generator, no separate product architecture."**
- `BLOCK_SPEC.md`: the menu item renders as the **same card** as a service — image tile, name,
  price+unit, action button. Only the **action** differs (`buy` → checkout).
- The build path exists: `sfFetchProducts` / `sfFetchCollections` / `sfFetchVariants` →
  `sfBuildStorefrontAst` (already an `HublyAI.complete({ jsonMode: true })` call) → the page.

**A menu is a storefront whose collections are sections. No menu renderer should be built.**

---

## 6. OPENAI → HUBLY: THE BACKEND AUDIT

### 6.1 OpenAI is already integrated

`supabase/functions/_shared/hubly_ai.ts` already calls
`https://api.openai.com/v1/chat/completions` with a provider switch beside Anthropic
(`p === "openai"` → `OPENAI_API_KEY`). It already supports:

- **JSON mode** — `jsonMode` → `response_format: { type: "json_object" }`, with a `schemaMode`
  already written to recognise `json_schema` when the contract moves there
- **Vision** — `toOpenAIContent` emits `image_url` with a base64 data URL, so **a photographed
  menu is already an accepted input**
- retries on 429/5xx with backoff, and per-attempt metering

**9. Does the OpenAI integration need a new backend endpoint? No.** It exists, it is metered, and
it is already used for `storefront_build`.

One real limitation: on the OpenAI path a `document` part (a PDF menu) is replaced with
`"[Attached PDF document — ask the owner for a screenshot if text extraction is required.]"`.
**A PDF menu is not readable on that path today.**

### 6.2 The write path exists and is unreached — a missing door, not a missing system

| question | answer |
|---|---|
| **1. Where should AI-generated menu data enter?** | The existing conversation path: `hubly-conversation` → capability registry → a capability that calls the commerce API. Not a new surface. |
| **2. Which backend should own the write?** | **`supabase/functions/commerce-api`**. Its own comment states the contract: *"the customer storefront and the owner Store admin share commerce_products as SSOT."* `POST /products/import` (bulk) and `POST /products` (single) already exist. |
| **3. Should AI write directly to `commerce_products`?** | **No — never to the table.** Through `commerce-api`, so authorisation, `slugify`, cents coercion and defaults happen in exactly one place. |
| **5. How are IDs assigned?** | Server-side `gen_random_uuid()`. **The AI never supplies an id** — the same conclusion the Offering audit reached, for the same reason. |
| **6. How does it flow onward?** | `commerce_products` → `sfFetchProducts` → `sfBuildStorefrontAst` → the block-spec card with action `buy`. Already built. |
| **7. Does the backend already support this flow?** | Transport ✅, write endpoint ✅, render ✅. **The gap is one capability.** |
| **8. Which boundaries should be reused?** | `HublyAI.complete({ jsonMode: true })`, `commerce-api`, `callCommerceApi`, the capability registry, `sfBuildStorefrontAst`. |

**The measured gap:** the registry holds `sfFetchProducts`, `sfFetchCollections`,
`sfFetchVariants` — all **GET**. A search for `callCommerceApi(ownerToken, "POST"` returns
**zero hits**. **The AI can read the store and render it; it cannot add anything to it.** Products
are created only through the Store admin UI. That is the missing door, and it is one registry
entry over an endpoint that already exists.

### 6.3 Validation, duplicates, ambiguity, and the approval boundary

**4. How should generated data be validated before persistence?** Today `/products/import`
coerces rather than validates: `name` is required, everything else is cast. The validation that
matters here is Hubly's own standing rule, not schema checking — **never publish a fact the owner
did not state.** A generated row whose price cannot be grounded in the source the owner supplied
must be written **without a price**, never with a plausible one. The same rule that stopped a
phone number being lifted from an earlier turn applies to every dish on a menu.

**10. How do we prevent duplicates?** The backstop already exists and is the right one —
`unique (business_id, slug)`. Two things must change before it is usable for menus: the import
must **stop swallowing its insert errors** (4.1), and the writer should match on name within the
business first, then **update or ask** rather than insert-and-fail.

**11. Ambiguous or incomplete items?** The existing rule governs: *a capability invoked without a
value ASKS.* A dish with no legible price is created priceless or not at all. A section heading
misread as a dish must be askable, not guessed. Note 3.3: *MP* has no representation today.

**12. AI-generated vs owner-approved — this boundary already exists and already defaults
correctly.** `POST /products/import` sets `status: raw.status || "draft"`, and draft products are
excluded from purchase by checkout (`status !== "active"` → `product_unavailable`) and from the
storefront. That is exactly the ruling in CLAUDE.md:

> **SEEDED CONTENT MAY LIVE IN THE EDITOR. IT MAY NOT REACH A CUSTOMER BEFORE HE HAS LOOKED AT IT.**

The one thing worth adding later is **provenance** — e.g. `metadata.source = 'ai'` plus the source
artefact — so the owner can see what was generated versus what he typed. `metadata jsonb` already
exists to hold it; no schema change is required.

---

## 7. THE FIVE LISTS

### What already works
- `commerce_products` as the menu-item record; `commerce_collections` (+ join `sort_order`) as
  menu sections; `commerce_product_variants` as sizes; `commerce_bundles` as combos;
  `commerce_product_images` as photos
- pickup and local delivery, already first-class in `shipping_defaults` and
  `commerce_shipping_profiles`
- the full ordering path: cart → order → checkout → refund → inventory logs
- order lines that **snapshot** title and unit price, so a menu edit never rewrites history
- **OpenAI already wired**, with JSON mode, vision, retries and metering
- **`commerce-api` already the SSOT write boundary**, including `POST /products/import`
- **the draft/published boundary already defaults to draft**

### What can be reused unchanged
- the block spec card and the freeform generator — a menu is a storefront, not a new renderer
- `HublyAI.complete({ jsonMode: true })` as the structuring call
- `callCommerceApi` as the registry→backend boundary
- `gen_random_uuid()` server-side identity, and `unique (business_id, slug)` as the duplicate
  backstop
- `status: draft` as the AI-suggestion boundary; `metadata jsonb` for provenance

### What is missing
- **modifier groups** with constraints, attachable to Product *or* Offering, and a place to record
  the selection on cart/order lines
- **per-item availability windows**
- a Product-side equivalent of `quote_required` ("market price")
- **one capability that POSTs** to `commerce-api` — the missing door
- PDF text extraction on the OpenAI path

### What would need to be built later
1. The POST capability (smallest unit of value; makes the whole flow real)
2. Import that **reports** duplicate-slug rejections instead of swallowing them (4.1)
3. Food-sensible defaults on import — `track_inventory: false` unless the owner counts (4.2)
4. Modifier groups, designed generically and justified by two trades, never by restaurants alone
5. Provenance on generated rows
6. Per-item availability windows
7. Allergen/dietary fields — **only** with an explicit owner-confirmation step

### What should NOT be built
- **A restaurant system.** No `menu_items`, no `menu_sections`, no menu renderer, no
  restaurant-specific generator. Every one of those is a second representation of something that
  already exists.
- **A `MenuItem` entity.** It is a Product.
- **A new OpenAI endpoint or a second AI transport.** `hubly_ai.ts` is the one door.
- **AI writing directly to commerce tables**, bypassing `commerce-api`.
- **Restaurant-specific `product_type` values.** `physical` carries a dish today; adding `food`
  buys nothing and splits the enum.
- **Modifiers built as a restaurant feature.** Build them once, generically, or not yet.
- **AI-generated allergen or dietary claims.**

---

## 8. WHAT THIS AUDIT DID NOT MEASURE

- **No restaurant data exists in the system**, so nothing here was verified against a real menu.
  This is a structural audit of tables and code paths, not an observation of a working restaurant.
- The duplicate-slug and inventory-default findings (4.1, 4.2) are **read from the code**, not
  reproduced against a live import. They should be reproduced before being fixed.
- Whether any existing business uses `addons` in a modifier-like way was not counted.
