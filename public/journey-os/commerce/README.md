# Commerce Engine (Hubly Runtime)

Commerce is a **runtime engine**, not a separate app. It sits beside Auth, Website, Customers, Jobs, Messaging, Calendar, AI, and Payments.

## Layout (Hubly-native)

Operate UI is vanilla JS (`public/journey-os`), not React `/src`. Module map:

```
commerce/
  types.js                 Product / Order / Cart models
  api.js                   REST client → commerce-api + create-store-checkout
  events.js                HublyEvents publishers
  permissions.js           Owner / Manager / Employee capabilities
  components.js            ProductCard, CartDrawer, StorePreview, …
  storefront-renderer.js   /store page from Store settings + catalog
  checkout/checkout.service.js
  ai/                      Product coach + merchandising helpers (Stage 2 honest)
  index.js                 window.HublyCommerce
```

Owner UI shell: `store-commerce.js` (nav label **Store**).

## Boundaries (Rule #15)

| Owns | Does not own |
|------|----------------|
| Products, collections, bundles, carts, product orders, inventory logs, store settings | Customers (Customer Engine), Stripe ledger (Revenue / Payments), Website service catalog |

## Enable / disable

Per business via `commerce_store_settings.enabled`. Business types without retail can leave Store off.

## Production-First

Checkout reuses Stripe Connect (`create-store-checkout`). Missing credentials → Provider not configured. No fake payments.
