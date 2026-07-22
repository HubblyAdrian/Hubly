# Revenue Proof — checkout lookup PASS (was 3A)

**Date:** 2026-07-22T22:37:06Z  
**After:** `./scripts/deploy-stripe-proof-edges.sh` (admin client fix)

| Business | HTTP | Body |
|---|---|---|
| Aquaspeed `64211e3a-…` | **409** | `code: not_ready` — “hasn’t finished connecting Stripe yet” |
| Devdetailing661 `172d4777-…` | **409** | same |

**PASS criterion for checkout lookup:** no longer `Business not found` for real ids.  
Next: Connect Stripe for Devdetailing661 until `charges_enabled`, then Checkout URL + pay + refund.
