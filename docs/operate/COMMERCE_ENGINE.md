# Commerce Engine

**UI label:** Store  
**Internal:** Commerce Engine (`S.storeOs`, `HublyCommerce`, `HublyStoreCommerce`)  
**Runtime slot:** sibling to Auth, Website, Customer, Jobs, Messaging, Calendar, AI, Payments

## Architecture (Hubly-native)

Operate is vanilla JS under `public/journey-os`, not a React `/src` app. Commerce modules live at:

`public/journey-os/commerce/` — types, api, events, permissions, components, storefront renderer, checkout, AI.

Backend:

| Piece | Path |
|-------|------|
| Schema | `supabase/migrations/20260729120000_commerce_engine.sql` |
| Owner API | `supabase/functions/commerce-api` |
| Checkout | `supabase/functions/create-store-checkout` |
| Webhooks | `supabase/functions/stripe-webhook` (commerce order + inventory) |
| Shipping | `supabase/functions/_shared/hubly_provider_shipping.ts` |
| Inventory | `supabase/functions/_shared/hubly_commerce_inventory.ts` |
| Merchandising cron | `supabase/functions/commerce-merchandising` |

## Boundaries (Rule #15)

- **Store owns** products, collections, bundles, carts, product orders, inventory logs, store settings, commerce documents.
- **Customers** remain Customer Engine SSOT — orders reference `customer_id`, never duplicate people.
- **Revenue / Payments** own Stripe ledger; Store creates Checkout Sessions via existing Connect.
- **Website Storefront** owns service catalog; Commerce owns `/store` product storefront (`website_pages.page_type = store`).

## Checkout flow

Cart → `create-store-checkout` → Stripe Checkout Session → webhook `checkout.session.completed` → order `paid` → inventory deduct + log → cart converted.

Also handled: `payment_intent.succeeded`, `payment_intent.failed`, `charge.refunded`.  
`invoice.paid` / `customer.subscription.updated` acknowledged for Memberships/Revenue.

## Permissions

| Role | Pack orders | View orders | Edit pricing | Refund |
|------|-------------|-------------|--------------|--------|
| Owner | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✓ |
| Employee | ✓ | ✓ | ✗ | ✗ |

## Shipping V1

Interface `ShippingProvider`: pickup, flat_rate, local_delivery, free (`hubly_builtin`). Shippo stub fails honestly until keys exist.

## Enable / disable

`commerce_store_settings.enabled` — Commerce can be off for business types that do not sell products.

## Stage 2 (honest)

- Live CSV import / AI product generate when Hubly AI + embeddings configured
- Stripe refund money movement (status mark exists; money via Payments)
- Full customer timeline / email / analytics subscribers on commerce events
