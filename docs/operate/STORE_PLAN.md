# Store (Commerce Engine)

**UI label:** Store  
**Internal name:** Commerce Engine (`S.storeOs`, `HublyStoreCommerce`, `HublyCommerce`)

See also [COMMERCE_ENGINE.md](./COMMERCE_ENGINE.md).

## What it is

Owner surface to sell **products** (gear, kits, gift cards, digital) alongside Hubly services — not Shopify branding, not the customer Marketplace, not Website Storefront (service catalog).

## Nav

`Home → … → Memberships → Store → Revenue → …`

## Tabs

| Tab | Owns |
|---|---|
| Overview | Live `/store` preview, revenue, top product, AI suggestions |
| Products | SKUs, price, status, type, Manual / Import / AI create |
| Collections | Groupings for site / van / upsells |
| Bundles | Kit prices + product sets |
| Orders | Product orders + fulfillment status |
| Inventory | On-hand stock, low-stock, adjust |
| Discounts | Promo codes for store catalog |
| Analytics | Revenue, AOV, top products, low stock |
| AI | Product coach + knowledge uploader |
| Settings | Enable store, `/store` path, hero copy |

## Boundaries

- **Storefront / Website editor** — services & booking packages only
- **Apps** — Connected Apps marketplace
- **Marketplace** — customer find-a-pro (hidden)
- **Marketing coupons** — campaign discounts stay in Marketing until an explicit migrate
- **Revenue** — Stripe payment ledger; Store does not duplicate invoices

## Production-First

Checkout: Capability → Stripe PaymentsProvider → Connect destination session.  
Missing credentials → Provider not configured.  
Live preview renders the real storefront component (not a mock image).
