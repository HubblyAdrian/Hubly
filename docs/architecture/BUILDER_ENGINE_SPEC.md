# Builder Engine Specification

**Version:** 1.8.0  
**Status:** Milestone 1.5 — Epic 1–7 ✅ · Epic 8 ✅ (Workspace Intelligence Builder) · Epic 9+ locked  
**Target:** Milestone 1.5 (12 epics · one release gate each)

Epic 1–5: Intent → Change Plan → Preview → Collaboration → Versions. Epic 6 is **Business Builder**. Epic 7 is **Booking Intelligence Builder**. Epic 8 is **Workspace Intelligence Builder** — the workspace evolves around how each owner works (conversation, not settings), with adaptive homepage/nav, contextual quick actions, Workspace Health, multi-device layouts, and Focus Mode. Apply / remaining builders are later. Do not implement them ahead of Founder Approval.

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

Builder modules register via Platform Extensibility (`builder.*` Feature Manifests). Customer-facing experience is always **Business Builder**. Internal modules reserved for 1.5:

- Business Builder (orchestrates creative sessions; owns the customer promise)  
- Website module (`website_builder`) — one canvas inside Business Builder  
- Booking Intelligence Builder (`booking`) — scheduling concepts, health, simulator  
- Workspace Intelligence Builder (`workspace_builder`) — adapts around how the owner works  
- Automation Builder  
- Portfolio Builder  
- Package Builder  

## Business Builder (Epic 6)

1. Owner describes the business in plain English  
2. Creative Session explains multi-surface changes + why  
3. Creative Directions shape Website + Booking + Packages + Portfolio  
4. Business Score measures business quality (not SEO/Lighthouse)  
5. Creative Memory learns preferences for the next build  
6. Creative Workspace: conversation left · live business right  
7. Still requires Collaboration/Approval — no silent apply  

## Booking Intelligence Builder (Epic 7)

1. Owner describes how they operate (no settings page)  
2. Concepts: travel buffers, arrival windows, notice, capacity, service rules, seasonal, weather, skills  
3. Industry DNA influences scheduling defaults  
4. Booking Health scores the experience  
5. AI recommendations suggest improvements  
6. **AI Schedule Simulator** — next 7 days before approve (jobs moved, drive saved, conflicts, slots, revenue)  
7. Mission Control records rules, health, recommendations, versions/timeline  
8. Still requires Collaboration/Approval — no silent apply  

## Workspace Intelligence Builder (Epic 8)

1. Owner describes how they work (no settings / drag-and-drop)  
2. Workspace Memory: favorites, workflows, time-of-day patterns, hidden tools, landing page  
3. Adaptive homepage + navigation from behavior and industry  
4. Contextual quick actions (morning / afternoon / Friday / rainy day)  
5. Workspace Health + explained AI recommendations (never silent moves)  
6. Multi-device: desktop / tablet / phone adapt independently  
7. **Focus Mode** — Job / Sales / Admin / Growth Day reorganizes the day  
8. Mission Control records workspace evolution  
9. Still requires Collaboration/Approval — no silent apply  

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
