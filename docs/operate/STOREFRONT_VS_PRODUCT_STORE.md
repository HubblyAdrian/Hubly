# Product Store vs Business Storefront

Hubly has **two** public commercial surfaces. They are not interchangeable, and
conflating them is what put an automotive product-store interview in front of a
non-automotive business.

| | **Business Storefront** | **Product Store** |
|---|---|---|
| Route | `/` (the business's site) | `/store` |
| Sells | services | physical / digital products |
| Vocabulary | services, pricing, gallery, reviews, booking, about, service area, FAQ | products, variants, stock, collections, shipping, pickup, best sellers |
| Schema | `website-ast.js` `SECTION_KEYS` + blueprint `website.sections` / `homepage.priority` | `storefront_ast.ts` `STOREFRONT_BLOCK_CATALOG` (11 product blocks) |
| Defined in | `STOREFRONT_PLAN.md`, `STOREFRONT_MISSION_CONTROL.md` (Module 7) | Storefront Builder, `COMMERCE_ENGINE.md` |
| AI | `creative-director` | `hubly-conversation` (`context:"operate"`) |

`COMMERCE_ENGINE.md` already stated the split:

> **Website Storefront** owns service catalog; Commerce owns `/store` product storefront.

The word "Storefront" is unfortunately used for both. When it matters, say
**Business Storefront** or **Product Store**.

## Which surface a business belongs on

Answered from the **Business Type Engine**, never by interviewing the owner —
`tradeSellsProducts()` in `_shared/hubly_business_dna.ts` reads the blueprint's
own capability flags:

```
inventory | printStore | giftCards   →  the Product Store is legitimate
```

* **Detailing** — all three false. Services business. The Product Store is not their surface.
* **Photography** — `printStore: true`. Photographers genuinely sell prints, so a Product Store *is* legitimate for them.

So it is **not** "service business ⇒ no store". It is per-trade, from the blueprint.

## What the AI must never do

* Ask what industry the business is. It is in `businesses.business_type` and reaches the model as the identity block.
* Ask "physical products, digital products, or a mix". That question came from `createProduct.type`'s enum leaking into conversation.
* Run a product-store discovery interview at a business whose catalog is empty and whose trade doesn't sell products.
* Adopt an industry from an example in its own instructions.
* Let a reference site the owner admired ("build it like X") override the business's own trade.

Enforced by `tests/one_off_ai_industry_neutrality.ts` (47 assertions, no API key needed).

## Business DNA reaches the model

`public/business-blueprints/*.json` → `scripts/generate-business-dna.mjs` →
`supabase/functions/_shared/business_dna.json` → `hubly_business_dna.ts`.

Same pattern as `connected_apps_catalog.json`. Regenerate with
`npm run generate:business-dna`; a conformance test fails if the copy drifts.

**There is deliberately no default blueprint server-side.** An unresolved industry
returns `null` and the model is told the trade is unknown. The client's
`registry.js getDefaultId()` returns `'detailing'` — that reflex is precisely how
a non-detailer inherits automotive language, and it is not repeated here.
