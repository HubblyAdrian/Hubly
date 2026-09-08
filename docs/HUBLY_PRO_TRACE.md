# `hubly_pro` — hypotheses and findings, kept apart

Traces have been wrong three times today, so the trace below is written as **hypotheses** and
only the things I could see are written as **findings**.

---

## FINDINGS — observed

### F1. The rail's plan label is driven by `tier`, NOT by `hubly_pro`. Controlled, both arms seen.

`hubly_pro` held **constant (true)** in both arms; `tier` varied; the label varied.

| business | `hubly_pro` | `tier` | label on screen |
| --- | --- | --- | --- |
| Graef clone (his record) | `true` | **`pro`** | **"Pro plan"** |
| `evergreen-yard-care` | `true` | **`starter`** | **"Free plan"** |

Both signed in as the owner, label read off `#nav-plan` and **looked at** — "Evergreen Yard Care
/ Free plan" under the business name. **A business with `hubly_pro: true` displays "Free plan".**
The flag is ruled out as the source of that label.

### F2. `hubly_pro` is a denormalised copy of "has a `marketplace_providers` row". Zero exceptions.

| has provider row | `provider_kind` | `hubly_pro` | businesses |
| --- | --- | --- | --- |
| **no** | — | **`null`** | **145** |
| **yes** | `hubly` | **`true`** | **34** |

Every business with a provider row has it true; every business without one has it absent.
**Nothing else predicts it** — not `account_kind` (22 test / 7 market / 3 internal / 2 market-pro
all true), not `tier`, not claimed. It carries no information the join `businesses ⋈
marketplace_providers` does not already carry.

### F3. It is written by a live trigger, not by any product decision.

`sync_business_marketplace_capability` (migration `20260720060000`) fires on
`marketplace_providers` and sets

```sql
'hubly_pro', case when coalesce(new.provider_kind,'hubly') = 'marketplace_only'
                  then coalesce((capabilities->>'hubly_pro')::boolean, false)
                  else coalesce((capabilities->>'hubly_pro')::boolean, true) end
```

so it tracks `provider_kind`. **`provider_kind = 'marketplace_only'` occurs zero times in the
corpus**, which is why all 34 are `true` and the false branch has never been exercised.

### F4. Zero reads in application code. Exhaustive grep, collisions excluded.

Every occurrence of the literal `hubly_pro` outside `hubly_provider_*` / `hubly_proof_runs` /
`hubly_promo_`:

| site | kind |
| --- | --- |
| `public/marketplace-lite.html:374` | **write** — `hubly_pro: false` |
| `supabase/functions/marketplace/index.ts:1860` | **write** — `hubly_pro: false` |
| `supabase/functions/marketplace/index.ts:1803` | comment |
| `20260720060000_business_capabilities.sql` | the backfill + the trigger |
| 9 files in `docs/` | prose |

**No branch anywhere reads it.** Both writes set it `false`; the only thing that sets it `true`
is the trigger.

---

## HYPOTHESES — traced, not observed

- **H1. It was intended as the Lite→Pro upgrade switch.** The column comment says *"Upgrade
  Lite→Pro = flip hubly_pro"* and `docs/HUBLY_EXPERIENCES.md` describes enabling it to move a
  business from Marketplace Lite to the full `/app`. **Nothing implements that**, and the real
  `/app` gate is elsewhere. Recorded as intent, not behaviour.
- **H2. Nothing is gated on it anywhere.** Follows from F4, but "no read in the repo" is not the
  same as "no behaviour depends on it" — a database view, an RLS policy or an external service
  could read the column. I checked `schema.sql` (only the generated copy of the same trigger) but
  **did not enumerate every view and policy.** *Reading it as decorative is a hypothesis at ~F4
  strength, not a finding.*

---

## B4 — the verdict

**Decorative, and worse than `projects`.** `projects` at least has a reader that returns `true`
unconditionally; `hubly_pro` has no reader at all, and its value is a restatement of a foreign
key. **It is not a plan flag, not billing, and not a capability.**

> **Three of five capability keys do not do what their name implies** — `projects` (reader always
> true), `hubly_pro` (no reader, mirrors a join), `storefront` (moves the store, does not grant
> it). Two do something real but narrow: `website` picks a default surface, `marketplace` is
> directory membership.

**Consequence for the rail design: `hubly_pro` is RULED OUT of the model.** It is not a billing
gate to design beside, so there is no second system to disagree with. **The real plan field is
`businesses.tier`** (starter 176 / pro 2), which is a column, not a capability — and the new
mechanism must not absorb it. Whatever the rail list gates, **plan is a separate axis**: a
business can be entitled to a tab by plan *and* not have added it, or have added it on the free
tier. Conflating them is how the two systems Adrian is worried about would get built.

**Cleanup, not now:** `hubly_pro` should be dropped from `capabilities` and the trigger stopped
writing it — but only after the rail ships, because it is currently the only thing distinguishing
"has a provider row" in a corpus we are about to design against.
