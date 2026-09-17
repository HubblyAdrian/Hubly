# The `memberships` table cannot hold Graef's pricing — evidence, not a redesign

**Ordered by Adrian, 2026-09-16, after he answered: "Graef's memberships are run in real life but
he wants to add them."** So there is no membership DATA to model from. We model from how his
business actually works, and the nearest evidence we have is how his SERVICES are priced.

> **DO NOT BUILD ON THIS TABLE'S SHAPE. DO NOT WRITE ROWS TO IT.**
> Adrian: *"Somebody shaped that table with no real example in front of them."*

## The table as it stands

`memberships` — **0 rows**:

`id · business_id · customer_id · plan_name · service_name · cadence · price · default_duration ·
status · next_due_date · includes · source_plan_ref · created_at · updated_at`

## What Graef already has, read-only

All 8 of his catalog services are `pricing.mode = "variable"` — **priced per vehicle size**:

| service | base | sedan | coupe | crossover | suv | truck | van |
|---|---|---|---|---|---|---|---|
| Full Detail | $85.00 | $85 | $85 | $90 | $95 | $100 | $115 |
| Premium Detail | $130.00 | $130 | $135 | $140 | $150 | $155 | $165 |

*(the remaining six follow the same shape)*

## THE MISMATCHES

| what he has | what the table offers | consequence |
|---|---|---|
| **six prices per service**, keyed by vehicle size | **one `price` numeric** | it breaks on the first real customer. An SUV membership and a sedan membership are different money and the column cannot tell them apart |
| a **pricing MODE** (`flat` vs `variable`) | no mode column | nothing records *why* there is one number, so a reader cannot tell "flat $99" from "we lost five of the six prices" |
| `includes` as a **list** on the service catalog | `includes` (single column, type text) | a plan's contents are the thing a customer argues about; flattening a list to a string loses the per-item structure the service catalog already has |
| a service identified by **`service_id`** in the catalog | `service_name` **text** | the same free-text link that left `jobs.service_id` populated on 2 of 259 rows. A membership that cannot name its service by id cannot follow a rename |
| **cadence** — and this one FITS | `cadence` | the one column that lines up with the recurring engine we built this week (`recurring_schedules.frequency`) |

## And a question for Adrian that the two tables raise

Hubly has **two** half-built things called "membership", and Adrian listed *"memberships, recurring
memberships"* as if they were two things:

| | what it is | where | rows |
|---|---|---|---|
| **THE OFFER** | the plan on the website — "Gold Plan, $99/month" | `meta.membership_offers` | **0 businesses** |
| **THE MEMBERSHIP** | John Smith is on Gold, next due Oct 3 | `memberships` table | **0 rows** |

**Does that reading fit the shapes? Yes — and the shapes say so themselves.** `memberships` carries
`customer_id`, `next_due_date` and `source_plan_ref`: those are the columns of an *instance* that
points back at an *offer*. `meta.membership_offers` sits beside `service_catalog.services`, which is
where a *thing you sell* belongs.

**So the relationship is exactly SERVICE → JOB, one level over:**

```
what you sell          doing it for someone
service        ──►     job
membership offer ──►   membership (a recurring commitment)
```

**And that answers where TYPE lives**: on the thing you SELL. `service | membership` × `bookable |
quoted` belongs in the catalog beside the service, not on the instance — a job does not need to be
told it is "bookable", it already happened.

**Not built, not redesigned, no rows written.** This document is the evidence for the redesign when
a real example exists.
