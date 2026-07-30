# Hubly Commerce Capability

**Status:** First-class Hubly capability (not a standalone storefront SaaS)  
**Filter:** Does this feel like one intelligent business partner — or another software module?

---

## Principle

Commerce is how Hubly **sells** — products, services-as-SKUs, collections, orders — inside the same conversation and Live Workspace as Website, Customers, Media, Studio, and Analytics.

The storefront editor controls **presentation only**:

- Layout · branding · navigation · sections · colors  

All **business data** comes from one shared **Commerce Runtime** connected to Business Context.

---

## Shared engine (one catalog)

| Area | Status |
|------|--------|
| Products | Live (Postgres `commerce_products` + API) |
| Services (sellable SKUs) | Live path via product_type / service add-ons; booking packages remain Service Engine |
| Collections | Live |
| Categories | Architecture → Runtime cache (`storeOs.categories`); table next |
| Orders | Live (Stripe checkout when configured) |
| Customers | Refs into Customer Engine |
| Discounts | Table + UI; checkout apply completing |
| Gift Cards | **Architecture ready** (`commerce_gift_cards`, product_type) |
| Digital Downloads | **Architecture ready** (product_type=digital) |
| Print Sales | **Architecture ready** (Media × Commerce print SKUs) |

Missing credentials → **Provider not configured** (never fake checkout).

---

## Who uses it

Retailers · photographers · creators · service businesses — **same Commerce engine**.  
AI recommends layouts, organizes catalog, prepares launch — inside Building Mode.

---

## AI Workspace surfaces

| Conversation | Center becomes |
|--------------|----------------|
| “Build my storefront” | Storefront Builder (presentation + live catalog) |
| “Add products” | Product editor (Runtime) |
| “Launch shop” | Launch checklist over Commerce + Website |

---

## Code hooks

| Layer | Path |
|-------|------|
| Runtime | `public/journey-os/commerce/runtime.js` → `HublyCommerceRuntime` |
| API | `commerce-api` + `HublyCommerceApi` |
| Operate UI | `store-commerce.js` (must sync via Runtime → API) |
| Types | `commerce/types.js` — product types include gift_card, digital, print |
| Schema | `supabase/migrations/20260729120000_commerce_engine.sql` |

---

## Will not build

- A separate Shopify-like product brand inside Hubly  
- Dual SSOT forever (`meta.storeOs` vs `commerce_*`) — Runtime sync is the bridge  
- Fake gift-card balances or digital delivery without providers  

---

*Commerce plugs into Talk → Recommend → Build → Show — it is not a destination you “navigate to.”*
