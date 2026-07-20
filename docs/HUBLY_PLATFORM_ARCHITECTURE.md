# Hubly platform architecture (LOCKED)

One Hubly platform. Different experiences. Shared engines.

We are **not** building one CRM + one Marketplace + one Website Builder as
separate products. We are building **one platform** with four experiences,
all powered by the same engines. Improvements to an engine benefit every
experience instead of creating four codebases to maintain.

## Four experiences

```
CUSTOMER                              PROVIDER                         HUBLY (staff)
─────────────────────────────────     ─────────────────────────────    ─────────────────────────────
AI Concierge                          Provider Experience              Marketplace Ops
        ↓                             (packaged as Marketplace Lite)
AI Matching                           Dashboard
        ↓                             Bookings
Booking Engine                        Messages
        ↓                             Services
Confirmed Booking                     Availability
                                      Profile
                                      Payouts
```

| Who | Experience | Surface | Packaging note |
|---|---|---|---|
| Customer | Customer Experience | `/get-done` | AI booking concierge |
| Provider (marketplace) | **Provider Experience** | `/marketplace-lite` | Product name = **Marketplace Lite** |
| Provider (full SaaS) | Hubly Pro | `/app` | Full business OS |
| Hubly staff | Marketplace Ops | `/marketplace-ops` | Internal control center |

**Phase 5 engineering name:** Provider Experience.  
**Phase 5 product packaging:** Marketplace Lite.  
The engineering goal is the best provider experience for receiving marketplace
bookings. Marketplace Lite is how we ship it.

## Shared engines (single implementation)

- Booking Engine
- Availability Engine
- **Service Engine** (Phase 6) — see `docs/SERVICE_ENGINE.md`
- Messaging Engine (marketplace booking threads)
- Payments Engine (Stripe Connect)

Do **not** fork these per experience.

```
Business → Service Engine → Marketplace / Website / Booking / AI / Lite / Pro / Reporting
```

One catalog. Many consumers. One edit updates everywhere.


## Product boundaries (do not cross)

### Marketplace Lite owns
Receiving bookings · Managing services · Availability · Messaging · Getting paid.

**Nothing else.**

Boundary test: *Does this help a provider receive and complete marketplace bookings?*  
If no → Hubly Pro.

### Hubly Pro owns
CRM · Customers · Marketing · Automations · Memberships · AI Business Coach ·
Revenue · Team · Inventory · everything about running a business.

### Marketplace Ops owns
Marketplace quality · Verification · Trust · Analytics · Fraud · Moderation ·
Provider lifecycle.

**Nothing else.** Not Lite. Not CRM.

**Hard rule:** Nothing from Hubly Pro should leak into Marketplace Ops.

```
Lite  ≠  Pro  ≠  Ops
```

| Temptation | Correct home |
|---|---|
| Customer list / CRM pipeline | Hubly Pro |
| Email campaigns / automations | Hubly Pro |
| Memberships / inventory / team | Hubly Pro |
| Accept / decline marketplace booking | Marketplace Lite |
| Stripe Express payout status | Marketplace Lite |
| Verify / suspend / flag a provider | Marketplace Ops |
| Marketplace conversion analytics | Marketplace Ops |
| Provider 360 (ops view of one business) | Marketplace Ops |

## One Business record (LOCKED)

Every company has **one** `businesses` row.

Not:

- Marketplace Provider **and**
- Hubly Business

Instead:

```
Business
├── Hubly Pro          capabilities.hubly_pro      true / false
├── Marketplace        capabilities.marketplace    true / false
├── Verification
├── Services
├── Availability
└── Stripe
```

`marketplace_providers` is a **1:1 lifecycle/listing extension** of that Business —
not a second business, and never a place to duplicate name/logo/packages/hours.

### Upgrade path

Marketplace Lite → Hubly Pro:

- Nothing migrates
- Nothing copies
- Nothing imports
- You **enable** `capabilities.hubly_pro`

Profile, services, bookings, availability, and Stripe stay on the same Business.
That is the no-duplication principle made concrete.

## Protect this forever

1. One platform, four experiences.
2. Shared engines only — no per-experience forks.
3. One Business + capability flags.
4. Strict Lite / Pro / Ops ownership.
5. Phase 5 = Provider Experience (Lite is packaging) — **FROZEN**.
6. Phase 6 = Service Engine — one catalog per Business. Never say “Package”.
