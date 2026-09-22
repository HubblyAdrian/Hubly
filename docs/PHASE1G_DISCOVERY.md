# Phase 1G — discovery. No code was changed.

Traced 2026-09-22 against the repo, the live database and the deployed site. Every claim below
was read out of the code or measured; where something is inferred it says so.

**The finding that reorders everything else: the AI menu import and the product editor are in
two different shells, and the one the owner lands in has no catalog surface at all.**

---

## A. CURRENT OWNER COMMERCE EXPERIENCE

### Two shells, and which one an owner is actually in

Measured against the live site, not read from the router:

| route | file | bytes | what it carries |
|---|---|---|---|
| `myhubly.app/` (and `/home`, `/platform`, `/platform-home`) | `public/platform-home.html` | 1,029,882 | the claimed-owner conversational shell — **and the AI menu import** |
| `myhubly.app/app` (and everything else) | `public/hubly.html` | 3,130,988 | the classic Operate app — **and the entire Store admin** |

`api/router.js:448-462` decides this. The owner lands in `platform-home.html`.

**`platform-home.html` touches Commerce in exactly three places, all writes**, all inside the
menu-approval handler (`:7282`, `:7300`, `:7318`). There is **no catalog read, no product list,
no product editor, and no Store workspace**. The shell's own map says so in a comment:

```js
var HC_PLACE_SURFACES = { planner, website, jobs, customers, leads, quotes };
//   store — pending: the storefront workspace          ← platform-home.html:8285
```

`store` has a `business_places` kind and a hand-drawn rail icon (`HC_RAIL_ICONS.store`), but
`hcWorkspaces()` ignores any place whose kind has no surface — so a Store row can never be
earned, and nothing in the shell links to `/app` either (grepped; no such link).

### Where each owner action lives today

All of it is `public/journey-os/store-commerce.js` (1,027 lines), rendered at hubly.html view
`store` (`hubly.html:42347` → `HublyStoreCommerce.render()`). Tabs: Overview · Products ·
Collections · Bundles · Orders · Inventory · Discounts · Analytics · AI · Settings.

| # | owner action | where |
|---|---|---|
| 1–5 | create/edit product, name, description, price | `renderProductModal` (`:509`) → `HublyCommerceApi.createProduct` / `updateProduct` |
| 6 | variants | `renderVariantsSection(pid)` (`:486`), inside `detailSections` |
| 7 | visibility | Status select (`active`/`draft`) in the same modal; `setProductVisibility` by chat |
| 8–9 | collections + membership | Collections tab → `createCollection` / `setCollectionProducts` |
| 10 | **add-ons / options** | **nothing.** No surface anywhere |
| 11 | view the storefront | `/store` on the business subdomain (`store-page.js`) |
| 12 | store settings | `renderSettings` → `commerce-api /settings` |

### Answers

- **A1.** `public/journey-os/store-commerce.js`, at hubly.html view `store`, served only at
  `myhubly.app/app`. The owner's own landing shell has no Commerce management UI.
- **A2. Yes.** `renderProductModal` is a real editor (name, sku, price, stock, type, status,
  category, description) and is extensible.
- **A3. Yes.** `renderVariantsSection` — one row per variant with inline name/price/stock, a Save
  and a ✕ per row, one `is-new` row and an "Add variant" button.
- **A4. Yes, and it is already a container.** `detailSections` is literally
  `renderImagesSection(editId) + renderVariantsSection(editId)`, and it only renders once the
  product has an id ("Save the product to add images and variants"). **A modifier section is a
  third sibling in that container.** Nothing needs restructuring.
- **A5.** The pattern to follow: a `jos-store-subsection` with a `<strong>` heading, a row per
  record carrying inline inputs, per-row Save/✕, an `is-new` row, an Add button, and every
  control dispatched by `data-jos-act` through the single `handleAct` switch (`:760` onward — `store-variant-add` is the nearest example).
- **A6.** `HublyCommerceApi` (`public/journey-os/commerce/api.js`) → edge function `commerce-api`
  with the owner's JWT. The modifier routes built in Phase 1F are already on it.
- **A7. Do NOT reuse the Offerings surfaces.** They are a different store with a different write
  boundary:
  - `hcRecordEdit({kind:'service'})` (`platform-home.html:13796`) and the contextual top editor —
    these write **`businesses.meta.service_catalog`** through the `set_business_service_catalog`
    RPC, not Commerce.
  - `_shared/service_engine.ts` (`HublyService`, `HublyAddon`, `addon_ids`) — Offerings.
  - Smart Quote's `modifiers` step — a per-trade priced questionnaire for bookings.
  Reusing any of them would put Commerce product data in the Offerings store, which is the
  two-stores disease `SETTLED` #2 already records.

---

## B. CURRENT AI MENU / PRODUCT PIPELINE

### The flow, end to end

```
owner drops a photo/PDF into the chat        platform-home.html hcMenuExtractFromFile (:7111)
  → import-offers  { mode: "menu" }          supabase/functions/import-offers/index.ts
      · HublyAI, PDF routed to Claude natively
      · buildMenuSystemPrompt(businessName)  (:104)
  → normalizeMenuExtraction(parsed)          _shared/menu_extraction.ts  (pure, no DB)
  → hc.menuDraft                             ONE TAB, ONE PAGE, NEVER PERSISTED
  → review card in the transcript            hcMenuReview (:7186) — editable rows, tick boxes
  → owner presses "Add"                      hcMenuApprove (:7243)
      · reads the SCREEN, not the extraction (owner corrections count)
      · POST /products/import                → drafts, metadata {source:'ai'}
      · POST /products/:id/variants          ← sizes
      · POST /collections + /:id/products    ← sections, published:false
  → "Tell me when you have checked them and I will publish them."
  → hc.menuDraft = null                      THE REVIEW CARD IS GONE
```

### What the AI actually produces

`MenuItem` (`menu_extraction.ts:30`): `name · section · sectionConfidence · price · priceText ·
desc · sizes[{label,price}] · priceFromSizes · sizesUnusable · needsReview · issue · confidence`.

**B9 — the concept mapping that exists today:**

| Commerce concept | present in AI output? |
|---|---|
| products | **yes** — `items[]` |
| variants | **yes** — `sizes[]`, and only when *every* size is priced |
| collections | **yes** — `section` + `sectionConfidence` |
| **modifier groups** | **NO** |
| **modifier options** | **NO** |

- **B7.** The AI never writes a table. `import-offers` has never had a database client. The write
  is done by the **browser**, with the owner's own JWT, against `commerce-api`.
- **B8.** Yes — capability group `storefront` in `_shared/hubly_capability_registry.ts:9399`, 12
  actions: `listCatalog · createProduct · importProducts · updateProduct · setProductVisibility ·
  addVariant · updateVariant · createCollection · addProductsToCollection · configureStore ·
  generateStorefront · patchStorefront`. All go through `callCommerceApi` with `_ownerToken`
  injected server-side from the verified owner context and never shown to the model.

### Existing limitations, stated precisely

1. **A modifier group is currently read as a collection, and its options as products.** The
   prompt says *"A menu heading above a group of items is that group's section"*
   (`import-offers/index.ts:121`). So a menu printing

   ```
   TOPPINGS    Bacon $2    Mushrooms $1    Extra Cheese $2
   ```

   yields a collection "Toppings" containing three **sellable products** priced $2/$1/$2. That is
   not a defect in the extractor — it is faithful to a contract that has no modifier concept —
   but it is the wrong Commerce shape and it is what 1G must change.
2. **The owner cannot review what was written.** The card is destroyed on approval
   (`hc.menuDraft = null`), the shell has no catalog surface, and the only way to see the drafts
   is to *ask* — `listCatalog` answers in prose. The product said "check them" and then offered
   nowhere to check.
3. **Menu mode is reachable only from the chat file-drop.** `HC_FILE_ROUTES` + `hcResolveHeldPhoto`.
4. `importProducts` sends `price` only; **`sizes` are posted per product afterwards in a loop**,
   so a variant failure is silent to the count (the product count is reported, the variant count
   is reported, but a rejected variant is not named the way a rejected row is).

---

## C. CANONICAL ARCHITECTURE

```
        owner hands over a menu / price list / product sheet
                          │
                    import-offers          ← reads a file, NEVER a database
                          │ structured proposal (normalizeMenuExtraction)
                          ▼
                    OWNER REVIEW           ← in the transcript, held in one tab, never persisted
                          │ the owner's corrections are read off the SCREEN
                          ▼
                    commerce-api           ← THE write boundary. Owner's own JWT.
                          │                  Validates, owns ids/slugs/business_id, refuses.
                          ▼
              commerce_* tables            ← drafts. status='draft' is the publication gate.
                          │ owner publishes (chat: setProductVisibility, or the Status select)
                          ▼
           GET /public/storefront          ← active + website-visible only
                          ▼
              store-page.js / cards        ← variants + modifier controls (Phase 1F)
                          ▼
        guest cart (localStorage)   ·   persisted cart (commerce_cart_items)
                          │ line_items = ids + qty ONLY
                          ▼
        create-store-checkout → computeAuthoritativeOrder   ← server re-prices everything
                          ▼
        Stripe Connect destination checkout → stripe-webhook → finalizePaidCommerceOrder
                          ▼
        commerce_orders + commerce_order_items (frozen snapshot) → commerce_notify
```

- **C1.** `commerce-api` (the edge function), called with the owner's JWT. It is the only thing
  that writes `commerce_*`, and `scripts/check-the-ai-writes-commerce-only-through-the-api.mjs`
  already enforces that for the AI path by executing the real handler with `fetch` stubbed.
- **C2.** Two ways, both already built: (a) the browser calls it directly after the owner
  approves a review card; (b) a capability handler calls it via `callCommerceApi(ownerToken, …)`.
- **C3.** Validation lives in `commerce-api` and in `_shared/commerce_modifiers.ts` /
  `commerce_checkout.ts`. **Not in the model, not in the browser.** The browser's checks are a
  courtesy so the customer is told early; the server is the authority.
- **C4.** Three things already do this and need no new mechanism: the model never receives
  `businessId` or a token; `commerce-api` derives `business_id` from the verified owner and owns
  ids and slugs; `planProductImport` accounts for every row and names each rejection. Modifier
  writes must join that list rather than get a new one.
- **C5.** **The existing product direction is already "AI proposes, owner approves, drafts, owner
  publishes."** Phase 1D built it, and `status='draft'` is the gate. 1G must not invent a second
  review model — it must give the existing one a place to happen.
- **C6.** Reusable as-is: `import-offers` transport and its PDF rule; `normalizeMenuExtraction` as
  the normalisation seam; the review-card markup and "read the screen, not the extraction"
  handler; `planProductImport`; `commerce-api` and all Phase 1F modifier routes; the
  `sfOwnerCtx`/`callCommerceApi` capability pattern; `renderVariantsSection` as the editor
  template; `HublyCommerceComponents.ModifierGroups` for rendering.

---

## D & F. GENERIC COMMERCE MAPPING

The primitives are: **Product** (the thing bought) · **Variant** (a sellable version of it, with
its own price/sku/stock) · **Modifier group + options** (a constrained choice applied to the line)
· **Collection** (a named, ordered grouping for browsing).

### The mapping rules

1. **If choosing it changes *which thing* you receive and it has one price per choice → VARIANT.**
2. **If choosing it *adjusts* the thing you already chose → MODIFIER OPTION.**
3. **If it is a heading whose children are things you buy on their own → COLLECTION.**
4. **If it is a heading whose children are only meaningful attached to something else → MODIFIER
   GROUP.**
5. A choice printed with **one price per option and no base item** is a variant set.
   A choice printed with **`+$n`, or no price at all**, is a modifier group.
6. `min_select`/`max_select` come from the printed words: "choose one" → 1/1; "choose up to three"
   → 0/3; "add any" → 0/(count); nothing printed → 0/(count). **A rule nobody printed is never
   invented as required** — the same discipline as a price.

| business | Product | Variants | Modifier groups → options |
|---|---|---|---|
| **Restaurant** | Cheese Pizza | Small $14 · Medium $17 · Large $20 | Toppings (0–3): Bacon +$2 · Mushrooms +$1 · Extra Cheese +$2 · Sauce (1–1): Marinara +$0 · Alfredo +$0 |
| **Restaurant** | Burger $12 | — | Cheese (1–1): American +$0 · Swiss +$1 · Cheddar +$1 · Add-ons (0–2): Bacon +$2 · Egg +$1.50 |
| **Photographer** | Print Package | 8×10 $45 · 11×14 $80 · 16×20 $140 | Frame (0–1): Black +$25 · White +$25 · Oak +$40 · Finish (1–1): Matte +$0 · Glossy +$0 |
| **Detailer** | Full Detail | Sedan $180 · SUV $220 · Truck $250 | Extras (0–3): Pet Hair +$20 · Odor Removal +$15 · Engine Bay +$25 |
| **Retail** | T-Shirt $28 | S · M · L · XL (each $28) | Gift Options (0–1): Gift Wrap +$5 · Personalisation (0–1): Name +$8 |

Every row uses the same four tables. **Nothing above needs a restaurant-specific entity, and
"menu" is a word that appears only in the extraction contract — never in the schema.**

### The ambiguity that will bite, and the rule for it

"Small / Medium / Large" is a **variant** when each size is priced, and a **modifier group** when
it is not ("choose your size" with one price). Phase 1D already makes exactly this call —
`sizes` are promoted only when *every* size is priced, and the rest is reported as
`sizesUnusable`. **1G should extend that existing rule rather than write a second one:** an
unusable size list is a candidate modifier group, offered to the owner, never auto-promoted.

---

## E. OWNER UX RECOMMENDATION

**Modifiers belong in the product editor, as a third section beside Images and Variants.**

```
Edit product  ▸ Name · SKU · Price · Stock · Type · Status · Category · Description
              ▸ Images                         renderImagesSection(editId)
              ▸ Variants                       renderVariantsSection(editId)
              ▸ Options                        renderModifierGroupsSection(editId)   ← new
```

Why there and nowhere else:

- `detailSections` already exists as the container for per-product sub-sections, and already
  gates on "the product must be saved first" — which is exactly the constraint an attachment has.
- A modifier group is **business-level and reusable** (one "Gift Wrap" across forty products), so
  the section is *attach/detach + edit*, with a business-level list behind it. The Collections tab
  is the precedent for a business-level list of reusable things.
- The word on screen should be **"Options"**, not "Modifiers". Owners say options and add-ons;
  "modifier" is our word. The tables keep their generic names.
- `required` is never a checkbox. The control is **"Customers must choose"** (sets `min_select`
  to 1) and **"How many can they pick"** (sets `max_select`) — the UI derives, exactly as the
  server does.

**And the door, which matters more than the section.** The owner lands in `platform-home.html`,
which has no Store. Building a second catalog UI there would be two of everything again. The
recommendation is: **fix the door, don't duplicate the room** — give the shell a Store place that
opens the existing admin, and in the meantime make the drafts reviewable *in the conversation*,
which is where the owner already is (see 1G-A).

---

## F. IMPLEMENTATION PLAN

### 1G-A — Close the review loop in the shell the owner is in *(do this first)*

**Objective.** An owner who imports a menu can see what was created, correct it, and publish it
without leaving `platform-home.html`. Today the product says "tell me when you have checked them"
and offers nowhere to check.

- **Files.** `public/platform-home.html` (`HC_THREAD_VIEWS` — the existing pattern for
  day/jobs/leads/quotes/customers), `_shared/hubly_capability_registry.ts` (read-only use).
- **API changes.** None. `listCatalog`, `updateProduct`, `setProductVisibility` already exist.
- **UI.** A `products` thread view: the draft/active list with price and status, a row opening the
  existing edit affordances, and a publish action. Same markup and lifecycle as `quotes`.
- **Tests.** An import → review → publish round trip on the fixture; a leg asserting the shell
  reads the catalog through `commerce-api` and not a table; a leg asserting a draft is not
  publishable by the page alone (the server decides).
- **Done when.** A menu imported in the chat is visible in the same shell, and publishing it from
  there makes it appear on `/store`, read back from the storefront rather than assumed.

### 1G-B — Owner modifier editor

**Objective.** The owner can create, rename, reorder, price, activate and attach modifier groups
and options — *before* anything else can create them on their behalf.

- **Files.** `public/journey-os/store-commerce.js` (`renderModifierGroupsSection`, `handleAct`
  cases), `public/journey-os/commerce/api.js` (thin wrappers for the Phase 1F routes).
- **API changes.** **None.** Every route was built and live-verified in Phase 1F.
- **UI.** The `renderVariantsSection` pattern exactly; plus a business-level group list on the
  Products tab or a small picker for attach/detach.
- **Tests.** min/max coherence at the UI boundary; attach/detach replaces the set; an archived
  group disappears from the storefront but not from the editor.
- **Done when.** A group created in the editor appears on `/store` and prices correctly at
  checkout, verified on the live fixture.

### 1G-C — AI extracts modifiers, through the same boundary

**Objective.** The extractor can tell a *choice* from a *product*, and the owner reviews it.

- **Files.** `supabase/functions/import-offers/index.ts` (the menu prompt),
  `_shared/menu_extraction.ts` (a `modifierGroups` shape + normalisation), `platform-home.html`
  (review card renders groups), `_shared/hubly_capability_registry.ts` (add
  `createModifierGroup` / `addModifierOption` / `attachModifierGroups`, all via `callCommerceApi`).
- **API changes.** None — the routes exist.
- **UI.** The review card gains a group block: name, the printed rule, options with their
  adjustments, each editable and tickable exactly as items are today.
- **Tests.** Extend `check-a-menu-is-read-not-written.mjs`: a `+$2` list becomes a group, not
  products; an unpriced size list is offered as a candidate group and never auto-promoted; a rule
  nobody printed never becomes `min_select: 1`; no allergen or dietary claim, unchanged.
- **Done when.** A real photographed menu with a toppings list produces a product with a modifier
  group, reviewed and approved by hand, and nothing was written before approval.

### 1G-D — Real order verification

**Objective.** Close the hole Phases 1E and 1F both stopped at.

- See §H. No new code is expected; this is a verification task with a human in the loop.

---

## G. CUSTOMER JOURNEY STATUS

| # | step | status | evidence |
|---|---|---|---|
| 1 | AI structured output (products, sizes, sections) | **PASS** | Phase 1D, live |
| 1b | AI structured output (**modifiers**) | **MISSING** | no concept in the prompt or `MenuItem` |
| 2 | Owner review *before* the write | **PASS** | the transcript card; nothing persists before approval |
| 2b | Owner review *after* the write | **MISSING** | card destroyed; shell has no catalog surface |
| 3 | Commerce write | **PASS** | `commerce-api`, owner JWT, drafts only |
| 4 | Owner editing of products | **EXISTS BUT NEEDS EXTENSION** | real editor, but only at `/app`, not where the owner lands |
| 5 | Modifier configuration by the owner | **MISSING** | API-only since 1F |
| 6 | Storefront rendering (variants + modifiers) | **PASS** | live-verified 1E and 1F |
| 7 | Guest cart incl. modifier identity | **PASS** | live-verified 1F |
| 8 | Persisted cart incl. modifiers | **PASS** | live-verified 1F |
| 9 | Authoritative pricing incl. modifiers | **PASS** | live-verified 1F |
| 10 | Checkout | **BLOCKED** (see §H) | 503 on every fixture tried |
| 11 | Order creation | **BLOCKED** | never reached |
| 12 | Order snapshot | **BLOCKED** | column and writer exist; no row has ever carried one |
| 13 | Notification incl. modifiers | **BLOCKED** | renderer changed and checked; never run on a real order |
| 14 | Inventory deduction on a paid order | **EXISTS, WITH A KNOWN DEFECT** | see §I.1 |

---

## H. ORDER VERIFICATION PLAN

**Correcting the record from Phases 1E and 1F.** Those phases reported checkout as blocked because
*the fixture business I chose* had no Stripe Connect row. Measured now across the whole table,
that was too broad a statement:

| business | account_kind | mode | charges_enabled |
|---|---|---|---|
| `evergreen-yard-care` | test | **test** | **true** |
| `adrians-lawn-service` | test | live | true |

**`evergreen-yard-care` has a working test-mode Connect account**, is `account_kind = test`, and
is owned by the same owner as the fixtures used so far. `adrians-lawn-service` is in **live** mode
and must not be used for any test — that is real money.

### The path, named exactly

1. `create-store-checkout` (`index.ts`) — gates on
   `stripe_connect_accounts.charges_enabled` for `currentStripeMode()`, then calls
   `computeAuthoritativeOrder`, then inserts `commerce_orders` and `commerce_order_items`
   **including `selected_modifiers`** (`:137-152`), then opens a Stripe destination session.
2. `stripe-webhook` → `finalizePaidCommerceOrder` — marks paid idempotently, resolves the CRM
   customer, deducts inventory, and calls `commerce_notify`.
3. `commerce_notify.notifyCommerceSale` — reads
   `title,qty,unit_price_cents,total_cents,selected_modifiers` and renders the choices under each
   line from the frozen snapshot.

### What is required to test it

- The deployed platform `STRIPE_SECRET_KEY` must be a **test** key, so `currentStripeMode()`
  returns `test` and matches evergreen's row. **I cannot check this** — reading the key is
  forbidden — so it is the one fact to confirm first, and it can be confirmed without revealing
  the key (whether the dashboard is in test mode).
- A product with a variant and a modifier group on `evergreen-yard-care`, active.
- **A human to complete Stripe Checkout with a test card.** I am prohibited from entering card
  numbers, so this step is Adrian's and cannot be automated here.

### The minimum future test

Add a variant+modifier product on evergreen → add to cart on its `/store` → complete checkout with
`4242 4242 4242 4242` → then assert, from the database rather than the screen:
`commerce_orders.status = 'paid'`; one `commerce_order_items` row whose
`selected_modifiers` carries the **frozen names and adjustments**; `unit_price_cents` equal to
variant + adjustments; the notification ledger row; and that renaming the option afterwards does
**not** change the order row. Then delete the fixture and confirm counts return to baseline.

---

## I. OPEN FINDINGS

Carried forward, none fixed here:

1. **`/inventory/apply-order` drops `variant_id`** (`commerce-api/index.ts:996-1000`) — selects `*`,
   then maps the variant away before calling the variant-aware deduction, while the webhook caller
   passes it. Stock for a sold variant comes off the parent product.
2. **No real order has ever carried a modifier snapshot** — column, writer and renderer all exist
   and are checked; no row exists. Not claimed as passing.
3. **No owner modifier UI** — API-only since 1F.
4. **AI modifier extraction not implemented** — and today a toppings list becomes a *collection of
   products*, which is worse than absent because it looks like it worked.
5. **The owner shell has no Store surface** — `platform-home.html:8285`,
   `// store — pending: the storefront workspace`. The menu import ends with "tell me when you
   have checked them" and there is nowhere to check them.
6. **Mobile modifier UI unverified** — no 390px viewport here; the fieldset/checkbox layout in
   `store-page.js` has only been seen at desktop width.
7. **NEW, found in this discovery: the AI Product Coach reads a store the admin stopped writing.**
   `commerce/ai/product-coach.js:10` and `ai/merchandising.js` read `S.storeOs`
   (`businesses.meta`), while `store-commerce.js` states in its own header that it no longer reads
   or writes that blob. For any business whose catalog exists only in `commerce_products`, those
   two surfaces see an empty catalog. Two stores, one reader each — documented, not touched.

---

## Recommended sequence

**1G-A** (review loop where the owner already is) → **1G-B** (owner modifier editor) →
**1G-C** (AI modifier extraction through the same boundary) → **1G-D** (real order verification).

The order is deliberate: today the AI writes records the owner cannot see, and letting it also
create modifier groups nobody can edit would make that worse in a way a customer eventually finds.
Give the owner the room before handing the AI another key to it.
