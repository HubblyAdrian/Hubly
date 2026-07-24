# Milestone 1.5 · Epic 2 — Change Plan DSL

**Status:** Pass (pending Founder Approval)  
**Release Gate:** Milestone 1.5 · Epic 2 of 12

## Objective

Turn Builder Intent into a **safe, structured, versioned, declarative Change Plan**.

Builders understand how to reach desired state later — Epic 2 only describes it.

## Philosophy

Declarative desired state — not procedural steps. No SQL, React, DB, or API payloads.

## Founder demos

| Demo | Request | Builder type | Result |
|------|---------|--------------|--------|
| website | Make my website feel premium. | website_builder | Pass |
| booking | Don't allow same-day bookings. | booking | Pass |
| workspace | Move Jobs above Customers. | workspace_builder | Pass |
| crm | Hide the unused CRM module and pin my leads widget. | crm | Pass |
| portfolio | Put these 12 photos into my portfolio. | portfolio_builder | Pass |
| automation | Send prep instructions after ceramic coating bookings. | automation | Pass |
| multi | Add arrival windows and update my website to explain them. | multi | Pass |

## Prove

```bash
npm run check:builder-epic2
```

## Stop

Epic 2 is the Change Plan foundation. Preview Engine (Epic 3) consumes these plans.
