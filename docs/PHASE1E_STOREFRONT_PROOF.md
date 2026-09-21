# Phase 1E — can the existing Storefront sell what the menu import produces?

**Answer: yes, and one writer of two could not.** Everything the phase asked about — Products,
Collections, Variants, prices, draft/active visibility, cart identity — was already built and
already generic. Nothing restaurant-specific was added, and nothing restaurant-specific was
needed. One real defect was found, in the cart Hubly persists rather than the cart it keeps in
the browser, and it is fixed and deployed.

Run: 2026-09-21. Fixture: `hubly-classic-fixture` (`5ebedc20-1061-46b9-b393-a6ef57225910`,
`account_kind` **test**, claimed, owner `adriansmithee+evergreen@gmail.com`).

---

## 1. The architecture, as discovered

```
commerce_products ─┬─ commerce_product_images
                   ├─ commerce_product_variants        (name, price_cents nullable, options)
                   └─ commerce_collection_products ── commerce_collections (published, sort_order)
        │
        ├─ READ (customer)  GET commerce-api /public/storefront?business_id=&surface=
        │      anon; service role server-side; returns ONLY status='active' AND
        │      visibility.website !== false; never cost_cents; collections filtered to
        │      published=true and their membership filtered to the public product set.
        │
        ├─ PROJECT  public/journey-os/commerce/storefront-renderer.js  payloadToOs()
        │      read-through cents→dollars. Holds no product data of its own.
        │
        ├─ RENDER  store-page.js (the /store route, AST-driven) and
        │          storefront-renderer.js render() (the website Store embed),
        │          both drawing cards with components.js ProductCard/CollectionCard.
        │
        ├─ CART (guest)  storefront-cart.js — localStorage, lines keyed product::variant,
        │      sends line_items = [{product_id, variant_id?, qty}] and NOTHING else.
        │
        ├─ CART (persisted)  commerce-api POST /cart — owner-auth, commerce_carts +
        │      commerce_cart_items. THE ONE THAT WAS BROKEN. No client calls it today.
        │
        └─ ORDER  create-store-checkout → _shared/commerce_checkout.computeAuthoritativeOrder()
               reloads the real product + variant, re-prices, refuses unavailable/out-of-stock,
               writes commerce_orders + commerce_order_items. Client prices are never trusted.
               Stripe Connect destination checkout; paid state lands via stripe-webhook →
               finalizePaidCommerceOrder (variant-aware inventory deduction).
```

There is exactly **one** public product reader and **one** purchasable-product reader, and both
gate on `status='active'` AND `visibility.website`. There is no second publication system.

## 2. What already worked — exercised, not read

A deterministic fixture was created **through the real Commerce write boundary** (commerce-api,
with the fixture owner's own JWT from a live browser session — not direct SQL): collections
Pizza (`sort_order` 10) and Drinks (20); Cheese Pizza $14 with Small $14 / Medium $17 / Large
$20; Pepperoni Pizza $16 with Small $16 / Medium $19 / Large $22; Coke $3; and **Garlic Knots
$6 left as a draft**, deliberately placed in the Pizza collection.

Then `https://hubly-classic-fixture.myhubly.app/store` was opened as a customer — a different
origin with no session — and used.

| # | Asked | Result |
|---|---|---|
| 1 | Products render from Commerce | **yes** — three cards, names, descriptions, prices |
| 2 | Collections render | **yes** — "Pizza · 2 products", "Drinks · 1 product" |
| 3 | Correct prices | **yes** — `from $14`, `from $16`, `$3` |
| 4 | Variants render | **yes** — a `<select>` per product, `Small · $14 / Medium · $17 / Large · $20` |
| 5 | A customer can select a variant | **yes** — grid card and product detail both |
| 6 | The selected variant carries its price | **yes** — detail view repriced $14 → $17 on Medium |
| 7 | Cart stores the product id | **yes** — `6dab26bd-…`, not a name or slug |
| 8 | Cart stores the variant id | **yes** — `348857d5-…`; two sizes = two lines; subtotal $37 |
| 9 | Order preserves it | **not reachable live** — see §6 |
| 10 | Drafts hidden | **yes** — Garlic Knots absent, *and the Pizza count read 2, not 3* |

**Draft → published → draft, both directions, live.** `PATCH /products/:id {status:'active'}`
→ reload → Garlic Knots appears at $6 and the Pizza count becomes 3. Back to `draft` → the
anonymous public payload (fetched with only the publishable key) returns exactly
`["Cheese Pizza","Pepperoni Pizza","Coke"]` and the Pizza count returns to 2. No second
publication system was involved; `status` is the whole mechanism.

**Collection ordering is Commerce's.** Pizza before Drinks, because `sort_order` says so.

## 3. What did not work

**`commerce-api` POST `/cart` (action=add) dropped `variant_id` and priced every line from the
base product.** `commerce_cart_items.variant_id` has existed since the Commerce Engine
migration; `computeAuthoritativeOrder` reads it; the guest cart has always sent it. This writer
read neither the field nor the variant's price. A Large pizza went in and came back out as a
Small, silently, and the legacy `cart_id` checkout path would then have charged $14 for a $20
item.

**The class: a choice the customer made, discarded silently by one of two writers.** Hubly has
two carts; the fix had landed on one. Same shape as the edit queue and the booking exit.
`commerce_cart_items` was grepped for every other writer — there is exactly one, and the guest
cart was already correct.

Not reachable from the shipped UI today (`HublyCommerceApi.addToCart` has zero callers), which
is why it had never been seen. It is a live owner-authenticated endpoint regardless.

## 4. What changed

`supabase/functions/commerce-api/index.ts`, +35/−2, one handler. The add path now reads
`body.variant_id`, loads the variant **scoped to this product and this business**, prices from
`variant.price_cents` when it has one, titles the line `Product — Variant`, and stores
`variant_id`. A variant that is not this product's is **refused with 404 `variant_not_found`**,
never quietly downgraded to the base product.

**No storefront UI changed. No checkout changed. No schema changed. No new table, route or
entity.** The column, the reader and the client field all already existed.

Deployed to `rtwxxkxpkqdrhclkozma` and exercised against the deployed function:

| call | result |
|---|---|
| add Cheese Pizza + Medium, qty 2 | 201 · `variant_id=348857d5-…` · `1700`¢ · "Cheese Pizza — Medium" |
| add Cheese Pizza, no variant | 201 · `variant_id=null` · `1400`¢ · "Cheese Pizza" |
| add Cheese Pizza + a **Pepperoni** variant | **404 `variant_not_found`** — refused, not downgraded |
| read the cart back from Postgres | both rows persisted exactly as written |

## 5. Tests

`scripts/check-a-variant-survives-from-shelf-to-order.mjs` — **16 legs, 16 green, 16 RED ALONE
in `docs/red-proof-ledger.json`.** Every leg has been seen red, alone, for the reason it claims
to catch.

It runs the shipping code, not a copy: `_shared/commerce_checkout.ts` is esbuild-bundled and
executed (legs 1–7), and `money.js`, `components.js`, `storefront-renderer.js` and
`storefront-cart.js` are loaded into a sandboxed `global` (legs 8–14). The rows are declared —
there is no database — and leg 15 is a `[SHAPE]` leg over commerce-api's source because that
file calls `Deno.serve` at import and cannot be executed offline; its RULE-level proof is the
live run in §4.

Covered: variant price is the line price · qty multiplies the line's own price · an unpriced
variant inherits · the line carries stable ids · a foreign variant is refused · a draft cannot
be bought · a website-hidden product cannot be bought · the projection keeps ids and prices ·
collections project in Commerce order · option values are variant **ids**, never names · a
multi-price product is labelled "from" its lowest · two variants are two cart lines and the
same variant merges · checkout sends ids and quantities only · the persisted cart writer stores
the variant · no restaurant table, renderer or cart exists.

**Reused, not duplicated:** `tests/storefront_store_render.mjs` already proves all 11 AST blocks
render and that `/store` serves the published AST rather than the draft.

**Pre-existing suite state, unchanged by this work:** `npm test` has three failing files
(`book-now-hub-polish`, `quick-quote-contrast-images`, `quick-quote-drafts`) — confirmed failing
identically with this change stashed. `tests/commerce-engine.test.mjs`, `check:two-store` and
`check:formatter` pass.

## 6. Where testing stops, and why

**Checkout cannot be completed on this fixture.** `create-store-checkout` refuses at **503**
because `stripe_connect_accounts` holds **no row** for this business — the refusal fires before
any order is computed or written. The customer-facing message was exercised and reads *"Online
checkout isn't set up for this store yet."*, visible in the drawer. **No order row was
created** (`commerce_orders`, `commerce_order_items`, `commerce_carts` all confirmed 0 after).

So: **the cart → order hand-off was proven deterministically against the real pricing module,
not live.** Reaching it live needs a business with working Stripe Connect, and the only such
businesses are market ones with `graefs-autocare` READ-ONLY. This is the same wall recorded in
`OPEN_FINDINGS` at the end of Phase 1D, and it has not moved.

**Mobile is unverified.** Claude Code has no 390px viewport (standing rule).

**One automation caveat, stated rather than hidden:** macOS renders a native `<select>` popup
the extension cannot see, so variant *selection* was performed by setting the real select's
value and dispatching `change` — the same DOM mutation a human's pick produces. Every **Add to
cart**, card, collection and checkout click was a real click, and the price that resulted was
read back from storage and from Postgres.

## 7. Left open, deliberately

Two pre-existing storefront defects were found by having a store with collections for the first
time. Neither is about supporting Commerce data, both are UI, and this phase was told not to
redesign the storefront — so they are recorded here with line numbers rather than fixed. Both
also appear in `docs/OPEN_FINDINGS.md`.

1. **A collection filter with no way out.** `store-page.js:349` sets `state.collectionId` and
   nothing ever clears it. Once a customer taps "Pizza", `productGrid` stays filtered forever;
   there is no "All" chip, tapping the same card again does not toggle, and the only escape is
   a page reload. Verified by use, not by grep. The heading also still reads "Shop all" while
   filtered (`store-page.js:202`).
2. **A collection card the website embed does not listen to.** `components.js:105`
   `CollectionCard` emits `data-collection-id`, and `storefront-renderer.js:74`
   `renderCollections` renders a grid of them on the website Store embed — **nothing anywhere
   binds a click to that attribute** (grepped across `public/`). On the embed a collection is
   a decorative card naming a count you cannot open. This is the missing-door shape, not a
   missing feature. Established by grep; **not** verified by use, because it needs a business
   with a website Store section and the fixture is store-only.

## 8. Data

Snapshot before: `commerce_products/variants/collections/collection_products/images/orders/
carts/settings/bundles` = **0 across the board**. Snapshot after cleanup: **0 across the
board**. Every row created was deleted through the Commerce API (products, collections — the
FK cascade takes variants, images and membership) except the one probe cart, for which
`commerce_carts` has no DELETE route; that single row was removed by id with scoped SQL.

No unrelated business was touched: zero `commerce_*` rows anywhere in the database carry an
`updated_at` inside the test window.
