# The two service stores — measured, with a recommendation and nothing merged

**Measured 2026-09-16.** Re-run: `supabase db query --linked -f scripts/sql/export-service-stores.sql`
**`graefs-autocare` was read only.** Nothing was written to any business.

## The two stores, and the unit that is one out

| | |
|---|---|
| **the TABLE** `public.services` | predates the catalog. `price` is **NUMERIC DOLLARS**, `duration_hours`, `is_popular`. **No status column.** No variable pricing. |
| **the CATALOG** `businesses.meta.service_catalog.services` | `pricing.mode` (`fixed`/`from`/`variable`/`quote_required`), `price_cents`, `variable_prices`, `show_price`, `status` |

The export converts the table to cents so the two can be compared at all — *"the table says 85 and the
catalog says 8500" is not a conflict*, and a detector that reported it as one would be measuring the
unit.

## The whole picture: 320 rows, 202 businesses

| | |
|---|---|
| rows in **both** stores | **8 businesses** |
| **catalog only** | **3** — `bucket-mobile-detailing` (market), `cotter-aviation` (internal), `hubly-classic-fixture` (test) |
| **table only** | **80** — 75 test, **4 market**, 1 internal · **263 rows** |

**Neither store is safe alone.** A catalog-only reader sees nothing for 80 businesses; a table-only
reader sees nothing for 3 and a fragment for Graef.

## graefs-autocare — the catalog is true, and why

| store | contents |
|---|---|
| **CATALOG** | **8 services**, every one `variable`, each with all six vehicle prices. Full Detail $85 base (coupe 85 · crossover 90 · sedan 85 · suv 95 · truck 100 · van 115) … up to 2 Stage Paint Correction $400 |
| **TABLE** | **one row**: `clay and seal`, price **0** |

**The catalog is what his page renders**, and it matches his real prices. The table's single row is
the artifact — and it is *the* artifact: `clay and seal, price 0` is the exact sentence a one-store
reader produced about him on 2026-09-15 (Lesson 86), and the `get_public_business_services` migration
records that a UNION reader would have offered a stranger "clay and seal" at $0, *"a service his page
has never shown"*.

So the rule is already written down and already implemented in the right places. What was left was the
readers that never got it.

### Every reader that preferred the table for him — and the two that were the bug

| reader | verdict |
|---|---|
| `hubly_conversation_context_loader.ts:141` | **correct.** Catalog first, table only when the catalog is empty. For Graef it never falls back. |
| `public/hubly.html:15428` `loadServicesFromDb` | **correct, and I was wrong about it — see below.** |
| `public/platform-home.html:9490` counts | **WAS THE BUG.** `hcHomeCounts.servicesAny` counted `from('services')`. For the 3 catalog-only businesses that is **0 while their page shows services** (one of them **market**); for Graef it was **1**. Either way the door was decided by the wrong store. **Fixed:** counts `get_business_services` (the union reader), so the question is about the CONTENT, not our bookkeeping. |
| `public/platform-home.html:9941` `hcReadRecord` | **WAS THE BUG, and it is the 2026-09-15 report.** The manage panel read `from('services')` only, so it showed a market owner **one $0 service he does not sell** and none of the eight he does. **Fixed:** reads `get_business_services`, and a row the two stores disagree about now **says so on the row** — *"two different prices on file for this one — saving sets both"*. Hiding that would leave him editing one of two prices with no way to know the other exists. |

### A theory I had, and the measurement that voided it

Reading `loadServicesFromDb` I concluded that Graef's eight **variable** services were being flattened
to **fixed** on every page load — the mapping is
`pricingType:'flat', varPrices:{}, showPrice:true` — and that the next editor save would persist the
flattened catalog and destroy his per-vehicle pricing. On the code alone that reads as a
market-facing data-loss path.

**It is not happening.** Loaded his live public site in a browser and read the state a visitor's app
actually holds: all 8 services present, `pricingType:"variable"`, **all six vehicle prices set**, and
`_serviceCatalog` still `mode:"variable"` with 6 `variable_prices` keys.

The reason is the **first three lines of the function**, six lines above the mapping I was worried
about:

```js
if(S._serviceCatalog && ... .services.length) return;   // "never clobber"
if(S.editorSvcs && S.editorSvcs.length && ...) return;
```

`applyBizMeta` runs **before** `loadServicesFromDb`, so the guard is already satisfied. This is the
sweep lesson again in a new costume: *a grep window around a branch structurally cannot see the
surface around it*, and the surface here was six lines up. **The correction came from trying to use
the finding, not from re-reading it.**

**What I have NOT ruled out:** the signed-in owner path in the editor. I cannot sign in, so that is
unverified rather than clear — and it is the state where a save actually persists.

## adrians-lawn-service — both stores, and my recommendation

**The conflict is not prices. It is a different trade.**

| CATALOG — 5 services, landscaping | TABLE — 9 rows, window cleaning |
|---|---|
| Lawn Mowing **$55** | Interior Window Cleaning $149 ×2 |
| Garden Maintenance **$95** | Exterior Window Cleaning $179 ×2 |
| Seasonal Cleanup **$275** | Screen Cleaning $49 ×2 |
| Fertilizer Boost **$85** | Hard Water Spot Removal $89 ×2 |
| Landscape Design Consult **$150** | Storefront Glass $199 |

`business_type` is `landscaping`; the slug is `adrians-lawn-service`; the live page renders the five
landscaping services. **The nine table rows are a window-cleaning seed from another trade**, and five
of the nine are exact duplicates of each other — the apollo-weeds burst pattern, one store over.

### EXECUTED 2026-09-16 — Adrian gave the call, and all nine were deleted

**What I did:** deleted all nine rows from `public.services` for `adrians-lawn-service`, scoped by
slug. **Why:** every one is explained, and none is ambiguous.

**The evidence, which is what made them explainable:**

- All nine were written on **2026-07-17 in two bursts eight seconds apart** — `18:02:44` wrote five
  rows (`sort_order` 0–4), `18:02:52` wrote the same four again (`sort_order` 0–3, identical prices and
  identical descriptions, stopping before sort 4). The first burst is at **the same second the business
  was created**. So they were written by the creation path and then partially re-written by a retry —
  **not by a person editing a lawn service's offers.**
- Every one is window cleaning. The business is `landscaping`, the slug is `adrians-lawn-service`, the
  catalog holds five lawn services.
- **Nothing was ambiguous**, so there was nothing to leave behind and name. There is no row here that
  could be a lawn service.

**Verified by use on both sides of the delete.** Loaded the live page in a browser before and after:
`S.services` and `getBookingServices()` both returned exactly the five lawn services, the page
mentioned no window cleaning, and **the two readings are identical**. The nine rows reached neither the
page nor the booking wizard, so deleting them could not change anything a visitor sees — established by
loading it, not by reasoning about it.

**The original recommendation, which stands as the reasoning:** the catalog is the business; the nine
table rows should be deleted. Not merged:
there is nothing to merge. A lawn service does not sell Storefront Glass, and keeping the rows means
any future table-preferring reader will offer window cleaning to a landscaping customer. It is a
**test** account, so the cost of deleting is zero and the cost of keeping is a contaminated corpus
that has already produced wrong findings twice.

They were seeded content sitting in a store a reader can prefer — the exact class of the ruling made
the same day. Any table-preferring reader would have offered **Storefront Glass to a lawn customer**.
They had also already produced a wrong measurement: they are half of the "two real store conflicts"
count.

## The other six, and a finding about what "$0" means

| business | catalog | table | verdict |
|---|---|---|---|
| `evergreen-yard-care` (test) | 6 | 6 | **agree exactly**, all six prices |
| `hubly-paging-fixture` (test) | 2 | 2 | **agree exactly** |
| `apollo-weeds` (test) | `WEED PULLING` **quote_required**, no price | `WEED PULLING` **0** | *not a conflict* |
| `site-133756` (test) | `mobile detailing` quote_required | same name, **0** | *not a conflict* |
| `site-8f5146` (test) | `lawn care` quote_required | same name, **0** | *not a conflict* |
| `site-f32967` (test) | `lawn care` quote_required | same name, **0** | *not a conflict* |

**`services.price` has no way to say "unpriced".** It is NUMERIC, and a quote-required service becomes
**`0`**. So *"the table says $0"* and *"the catalog says quote required"* are **the same fact in two
vocabularies** — and a reader that prefers the table turns **"ask me for a price"** into **"free"**.

That reframes the count: of 8 businesses with both stores, **2 agree exactly**, **4 are that
vocabulary artifact**, **1 is a fragment** (Graef: 1 row of 8), **1 is a different trade**
(adrians-lawn). **Two real conflicts, and they are not conflicts of the same kind.**

## The drift check

`scripts/check-page-price-drift.mjs` — **5 legs.** Adrian: *"a check that goes RED when a page's baked
prices disagree with the store."*

A freeform page is a single generation with no update path, so the price a customer reads is HTML
written at build time and the record can move underneath it. The pairing is **exact**: the product
writes `<span data-hubly-price="SERVICE NAME">$85</span>`, so the span names its own service — no
guessed window.

**It imports the product's own formatter.** `fmtServicePrice` is now exported from
`hubly_capability_registry.ts` and run under Deno. The 2026-09-15 scar was two detectors agreeing
because they shared a broken formatter; a checker that re-implements it compares the page against a
second opinion rather than against the product.

**Measured today: 54 baked price spans on the latest version of every page. 6 comparable, all
agreeing. ZERO drift. All 54 on test businesses; none on market.**

**48 of the 54 are on 15 businesses with no catalog at all**, so "no matching catalog service" there is
our store split and not a page lying to anybody. They are **counted and named, never counted as
drift** — a check that reported 48 findings would be the six-wrong-findings sweep again: plausible,
flattering, and about us rather than about them.

Red-proofed on three mutated exports: a moved page price → leg 2; a store flipped to `quote_required`
while the page shows a number → leg 3; a store price of 4050 cents (`$40.50` ≠ `$40`) → leg 2, which
also proves the formatter path is live.

## One unrelated thing found on the way

`supabase/functions/_shared/hubly_brain_builder_expert.ts` **fails `deno check` on main** — 15 errors,
starting with `Cannot find name 'BuilderConfidenceExplanation'`. Confirmed pre-existing by stashing
this round's change and re-running. Not fixed here; recorded so it is not rediscovered.
