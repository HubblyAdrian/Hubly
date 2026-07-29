# Store (Commerce Engine)

**UI label:** Store  
**Internal name:** Commerce Engine (`S.storeOs`, `HublyStoreCommerce`)

## What it is

Owner surface to sell **products** (gear, kits, gift cards, digital) alongside Hubly services — not Shopify branding, not the customer Marketplace, not Website Storefront (service catalog).

## Nav

`Home → … → Memberships → Store → Revenue → …`

## Tabs

| Tab | Owns |
|---|---|
| Products | SKUs, price, status, type |
| Collections | Groupings for site / van / upsells |
| Orders | Product orders + fulfillment |
| Inventory | On-hand stock, low-stock |
| Discounts | Promo codes for store catalog |

## Boundaries

- **Storefront / Website editor** — services & booking packages only
- **Apps** — Connected Apps marketplace
- **Marketplace** — customer find-a-pro (hidden)
- **Marketing coupons** — campaign discounts stay in Marketing until an explicit migrate

## Production-First

v1 is Operate UI + local commerce state with honest Stage-2 toasts for live publish / Stripe product sync. Done for paying customers = Provider + credentials for checkout (follow Capability → Provider pattern when wiring payments).
