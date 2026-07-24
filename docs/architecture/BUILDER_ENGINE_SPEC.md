# Builder Engine Specification

**Version:** 1.5.0  
**Status:** Milestone 1.5 — Epic 1–4 ✅ · Epic 5 ✅ (Version & Rollback) · Epic 6+ locked  
**Target:** Milestone 1.5 (12 epics · one release gate each)

Epic 1–4: Intent → Change Plan → Preview → Collaboration. Epic 5 is **Git for a business** — versions, diffs, rollback plans, and Business Timeline. Apply / surface builders are later. Do not implement them ahead of Founder Approval.

## Purpose

Turn Hubly conversations into **real business changes** — with preview, owner approval, and rollback — while Hubly still feels like one partner (never a settings panel).

## Builder Expert responsibilities

| Responsibility | Detail |
|----------------|--------|
| Interpret intent | Map owner language → Change Plan |
| Own capabilities | Via Capability Registry (`whoOwnsCapability`) |
| Propose, don’t force | Always preview before apply |
| Explain impact | Expected outcome in Hubly voice |
| Respect approval | No silent writes to production surfaces |
| Support rollback | Every applied plan has a reverse path |

Builder modules register via Platform Extensibility (`builder.*` Feature Manifests). Examples reserved for 1.5:

- Website Builder  
- CRM Builder  
- Booking Builder  
- Automation Builder  
- Portfolio Builder  
- Package Builder  
- Workspace Builder  

## Change Plans

A **Change Plan** is a structured, reversible proposal:

```
ChangePlan {
  id
  businessId
  builderId          // e.g. website_builder
  summary            // owner-facing (“I updated your booking rules…”)
  capabilities[]     // registry capability ids
  operations[]       // { op, path, before, after }
  risk               // low | medium | high
  requiresApproval   // boolean
  preview            // human-readable diff
  createdAt
  status             // draft | previewed | approved | applied | rejected | rolled_back
}
```

Rules:

- Operations are atomic where possible  
- `before` snapshots enable rollback  
- High-risk plans always require approval  

## Preview Engine

1. Change Plan Engine produces declarative desired state  
2. Preview Engine renders owner-readable before/after (Compare Mode)  
3. Progressive stages let the owner watch Hubly build  
4. Multiple options when the request is open-ended  
5. Preview conversation updates versions — still no apply  
6. Mission Control logs Intent → Change Plan → Preview → waiting for Approval  

Preview must never mutate live business state.

## Collaboration & Approval (Epic 4)

1. Preview opens collaboration with **What do you think?**  
2. Hubly recommends (never neutral)  
3. Owner refines; Hubly updates the living preview  
4. Alternatives + AI negotiation when needed  
5. Partial approval updates Change Plan scope  
6. Approval summary + partner CTA (**Let's launch this.**)  
7. Owner confidence captured for Experience Director  
8. Mission Control records the full collaboration history  

Nothing is applied until a later Apply epic. Preview must never mutate live business state.

## Version & Rollback (Epic 5)

1. Approved collaboration proposes a **Business Version** (Git for a business)  
2. Surface versions: Website, Booking, Workspace, Automations, Portfolio, Packages  
3. Compare versions with diffs  
4. Generate full / partial / single-change **rollback plans** (never executed here)  
5. AI restore suggestions — always owner-approved, never auto  
6. **Business Timeline** — milestones + builder changes + achievements + recommendations  
7. Mission Control: Current → History → Diff → Rollback availability → Restore suggestions  

Try it. You can always go back. Apply / execute is a later epic.

## Supported builders (1.5)

| Builder | Example capabilities |
|---------|----------------------|
| Website | publish_site, homepage_rewrite, brand_assets |
| CRM | pipeline_stages, lead_fields |
| Booking | arrival_windows, same_day_rules, calendar_sync |
| Packages | package_create, pricing_tiers |
| Automations | review_followup, reminder_workflows |
| Workspace | sidebar_order, dashboard_layout |
| Portfolio | gallery_upload, portfolio_order |

Each registers capabilities + Feature Manifest. Brain discovers via registries — no `think` rewrites.

## Safety rules

1. **No silent apply** — preview + approval for mutating plans  
2. **Brain executes writes** — Builder proposes  
3. **ED last** — owner-facing preview/apply copy  
4. **Constitution** — recommend, don’t pressure; explain impact  
5. **Reliability** — timeouts, retries, queue on Stripe/Calendar failure  
6. **Audit** — every apply/rollback audited  
7. **Isolation** — plans scoped to `businessId`  

## Interaction with Hubly Brain

```
Owner request
  → Brain think
  → Experts (Research/Strategy/Creative as needed)
  → Builder Expert (proposes Change Plan)     [1.5]
  → Decision Engine (approve needed?)
  → Experience Director (preview voice)
  → Owner approval
  → Brain applies capabilities
  → Memory updates + Replay
```

Until 1.5 ships, Mission Control `builderActions.available = false` and Platform may register builder manifests as **declared** modules only.

## Exit criteria for Milestone 1.5 (future)

- [ ] Change Plan schema implemented  
- [ ] At least Website + Booking + Workspace builders  
- [ ] Preview + Approve + Rollback proven  
- [ ] Section 16 Founder Benchmarks still green  
- [ ] No Brain rewrite to add a new builder module  
