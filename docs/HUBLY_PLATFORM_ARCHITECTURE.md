# Hubly platform architecture (locked)

One Hubly platform. Different experiences. Shared engines.

## Experiences

| Who | Experience | Surface |
|---|---|---|
| Customer | AI Concierge → Match → Booking Engine → Confirmed | `/get-done` |
| Provider | **Provider Experience** (packaged as Marketplace Lite) | `/marketplace-lite` |
| Hubly staff | Marketplace Ops | `/marketplace-ops` |
| Provider (full SaaS) | Hubly Pro | `/app` (hubly.html) |

## Shared engines (single implementation)

- Booking Engine
- Availability Engine
- Shared Services (Phase 6 catalog on `businesses.meta`)
- Messaging (marketplace booking threads)
- Payments (Stripe Connect)

Do not fork these per experience.

## Boundaries

**Marketplace Lite owns:** receiving bookings, services, availability, messaging, getting paid.  
**Hubly Pro owns:** CRM, customers, marketing, automations, memberships, AI coach, revenue suite, team, inventory.  
**Marketplace Ops owns:** marketplace quality, verification, trust, analytics, fraud, moderation, provider lifecycle.

Lite boundary test: *Does this help a provider receive and complete marketplace bookings?*  
If no → Hubly Pro.  
Hubly Pro must not leak into Ops.

## One Business

```
Business
├── capabilities.hubly_pro
├── capabilities.marketplace
├── marketplace_providers   (1:1 lifecycle — not a second business)
├── Services / Availability / Stripe / Verification
```

Lite → Pro upgrade = enable `hubly_pro`. No migrate / copy / import.
