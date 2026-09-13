# Three paths, one page — what exists today (2026-09-13)

Established read-only after Adrian corrected a foundational assumption: **Hubly is three paths
from the landing page, not one** (`docs/SETTLED.md` #1). Nothing built, nothing retired.

## surface → exists → reachable → has rows

### Path 2 — Storefront (selling things)

| surface | exists | reachable | rows |
|---|---|---|---|
| `commerce_products` | yes (24 cols) | `commerce-api` edge fn, 1 file in `public/` | **2** |
| `commerce_product_variants` | yes | `commerce-api` | 0 |
| `commerce_orders` | yes (25 cols, carries `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at`, `status`) | `commerce-api`, `create-store-checkout`, `stripe-webhook` | **2** |
| `commerce_order_items` | yes | same | **2** |
| `commerce_carts` / `cart_items` | yes | `commerce-api`, `create-store-checkout` | 0 |
| `commerce_collections` · `bundles` · `discounts` · `gift_cards` · `inventory_logs` · `merchandising_recs` · `shipping_profiles` · `store_settings` | **all exist** | `commerce-api`, `commerce-merchandising` | **0** |
| `commerce_documents` (the storefront AST) | yes | — | **0** |
| **Checkout** | **WIRED** — `create-store-checkout`, `create-booking-checkout`, `stripe-webhook`, `stripe-connect-onboard`, `stripe-connect-connection` | edge functions | `stripe_connect_accounts`: **2, both `charges_enabled`** |
| Entitlements (e.g. access to a training video after purchase) | **NOT FOUND** — no table matching entitlement/access/licence | — | — |

**So: products, orders, carts, variants, collections, discounts, gift cards, shipping, store
settings and a full Stripe Connect checkout all exist.** Two products and two orders are real
rows. **The gap is entitlements** — nothing found that grants a buyer access to a digital good
after payment, which is what "training videos, digital goods" requires.

### Path 3 — Marketplace (the demand side)

| surface | exists | reachable | rows |
|---|---|---|---|
| `marketplace_providers` (35 cols: `marketplace_status`, `marketplace_enabled`, `featured`, `verification_status`, `insurance_verified`, `license_verified`, `background_check_status`, `marketplace_score`, `accepting_new_jobs`, `instant_booking`, `travel_radius_miles`, …) | yes | `marketplace` edge fn, 1 file in `public/` | **40** — created by a trigger on every business insert |
| `marketplace_requests` | yes | `marketplace` | **6** |
| `marketplace_bookings` (35 cols) | yes | `marketplace`, `stripe-webhook` | 0 |
| `marketplace_customers` · `conversations` · `messages` | yes | `marketplace` | 0 |
| `marketplace_ops_flags` · `ops_notes` | yes | `marketplace` | 0 |

**Provider status, all 40:** `draft` **39** (0 enabled, 0 featured) · `verified` **1** (1
enabled, 0 featured). The 40 exist because `ensure_marketplace_provider_for_business` fires on
every business INSERT — they are a side effect of creating a business, not 40 providers.

### Which of the 24 nav destinations serve path 2 or 3

**This changes how the operator shell should be read.** These are not stray operator screens:

| destination | path | evidence |
|---|---|---|
| **store** | **2** | `#v-store`, `HublyStoreCommerce.setMode`, backed by the `commerce_*` tables |
| **marketplace** | **3** | `#v-marketplace` |
| **money** | 1 **and** 2 | `renderRevenue`; revenue comes from both bookings/jobs and orders |
| **memberships** | 1 or 2 | recurring plans; `memberships` table exists, 0 rows |
| quotes · photo-projects · studio | 1 | service quoting, the photography vertical, marketing/design |

## What this does to D-018 … D-022

Those were ruled on the assumption of **one** product. Each needs re-reading, and I have not
changed any of them:

- **D-018** (18 destinations deferred as unclassified) — **`store` and `marketplace` are now
  classified**: they are another path's rail, not unclassified operator screens. The deferral
  still holds for the rest.
- **D-019** (retired-shell exit) — the nine "unreachable" surfaces include **store** and
  **marketplace**, which are paths 2 and 3. *"The claimed rail has no equivalent"* is true and
  now means something different: the claimed rail is **path 1's rail**.
- **D-020** (Money/Reports/Pipeline own no data) — **still true for those three**, but the
  sentence "the retired shell is a view layer" is too broad: `store` and `marketplace` sit in
  that shell and are backed by 25 real tables and five edge functions.
- **D-021** (the two deleted Home counts) — unaffected.
- **D-022** (calendar merge cut) — unaffected.

## "Storefront" is used for two different things, and one of them is not a storefront

Asked for before changing anything. 153 lines across 26 doc files mention it. The split:

1. **`#p-storefront` — the CLASSIC RENDERER.** `STATE.md:66`, `BUSINESS.md:61`. This is the
   template page a business with no stored document falls back to — **the impostor site the
   booking Back defect landed customers on**. It has nothing to do with selling. **The name is
   the bug here**, and it is the single most confusing identifier in the repo.
2. **The commerce storefront** — products, orders, `commerce_documents`. `KNOWN_ISSUES.md:2323`,
   `PRODUCT_SHAPE.md:61`, `OPEN_FINDINGS.md:633`.

**Correct uses** (do not change): every reference to `#p-storefront` as the classic renderer is
accurate about what that element IS; every reference to the commerce surface is accurate too.
**The collision is the problem, not either usage.**

## The one place today's ruling and today's code disagree

`KNOWN_ISSUES.md:2323`, written before this ruling:

> *"Freeform editing applies to WEBSITES ONLY. Storefronts are unchanged and will need their
> own answer. Storefront ASTs live in `commerce_documents`, a separate tree… A storefront is
> still an AST, still re-rendered from its tree."*

**Adrian's ruling is the target, not the current state.** Today a storefront is a separate AST
in `commerce_documents` (0 rows) while a website is freeform HTML in `business_documents`. The
ruling says one page, one generator, one block mechanism with a different action. That is a
real change of direction and it should be recorded as a decision, not absorbed silently — the
0 rows in `commerce_documents` suggest the separate-AST path was never actually used, which
makes the direction cheap to adopt.
