# Builder Engine Specification

**Version:** 1.12.0  
**Status:** Milestone 1.5 — Epic 1–12 ✅ (Business Deployment Engine completes the platform)  
**Target:** Milestone 1.5 (12 epics · one release gate each)

**Specification only** — do not implement Builder mutations outside this engine and its epics.

Epic 1–5: Intent → Change Plan → Preview → Collaboration → Versions. Epic 6–10: Business / Booking / Workspace / Automation / Media Intelligence. Epic 11: **Hubly Chat OS**. Epic 12: **Business Deployment Engine** — the only path that mutates the business (validate → dry run → progressive deploy → verify → version → memory → Mission Control), with real rollback.

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
- Automation Intelligence Builder (`automation`) — conversation → workflow, simulation, discovery  
- Media Intelligence Engine (`portfolio_builder`) — understand + organize + multi-surface media  
- Hubly Chat OS — single conversation OS (Ask Hubly); Conversation Canvas  
- Business Deployment Engine — sole mutation path after approval  
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

## Automation Intelligence Builder (Epic 9)

1. Owner describes an outcome in plain English (never trigger/action settings)  
2. Hubly builds workflows with explained steps  
3. Workflow preview graph before activation  
4. 30-day simulation (volumes, nothing sent yet)  
5. Automation Health + estimated time saved  
6. AI recommendations + **Automation Discovery** (proactive)  
7. Multi-system workflows from one conversation  
8. Mission Control records workflow evolution  
9. Still requires Collaboration/Approval — **no execute / no apply**  

## Media Intelligence Engine (Epic 10)

1. Owner uploads media in conversation (never “where do I put this?”)  
2. AI analyzes quality, kind, and business context  
3. Auto-organization into gallery / before-after / archive candidates  
4. Multi-surface publishing proposals (website, marketplace, portfolio, quotes, social, Google, hero)  
5. Portfolio Health + missing content detection  
6. Creative premium pass (reorder, captions, hero)  
7. **Business Memory Through Media** — visual timeline of the business story  
8. Mission Control tracks media lifecycle  
9. Still requires Collaboration/Approval — **no publish / no apply**  

## Hubly Chat OS (Epic 11)

Not support. Not Copilot. Not “Website AI / Booking AI / CRM AI.”

1. **Ask Hubly** — single entry on every screen  
2. One personality (`separateAIs: false`) — one memory, one business partner  
3. Routes every builder (Business, Booking, Workspace, Automation, Media) through one thread  
4. Trusted external tools (weather, Stripe, calendar, CRM, documents) when appropriate  
5. Conversation Intelligence keeps multi-turn projects; owners return weeks later  
6. Proactive starters open with business ideas (not notification dumps)  
7. Coaching lives in the same conversation  
8. **Conversation Canvas** — talk left · live surface right (preview, booking sim, automation, portfolio, workspace, revenue, calendar)  
9. Voice-ready architecture: typing | voice | phone | receptionist share one session model  
10. Mission Control records Chat OS orchestration  
11. Still **no apply** until Epic 12 Deployment  

## Business Deployment Engine (Epic 12)

The only part of Hubly allowed to modify the business.

1. Nothing deploys until Brain → Experts → Preview → Collaboration → Approval → Validation  
2. Validation: capabilities, ownership, business rules, conflicts, integrations, dependencies, safety, rollback readiness  
3. Every deployment starts with a **Dry Run** (Deployment Preview)  
4. Each builder deploys only its own surface  
5. Multi-builder requests deploy **progressively**; failure stops + rolls back + explains  
6. Live deployment feed (not a spinner)  
7. Post-deployment verification (nothing assumed)  
8. AI summary + **Deployment Health**  
9. Rollback is real (restore prior Business Version live)  
10. Mission Control records the full lifecycle  

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

### Approval Flow

1. Preview opens collaboration with **What do you think?**  
2. Hubly recommends (never neutral)  
3. Owner refines; Hubly updates the living preview  
4. Alternatives + AI negotiation when needed  
5. Partial approval updates Change Plan scope  
6. Approval summary + partner CTA (**Let's launch this.**)  
7. Owner confidence captured for Experience Director  
8. Mission Control records the full collaboration history  

Nothing is applied until a later Apply epic. Preview must never mutate live business state. Explicit approval is required — never silent apply. Rejection returns to the Change Plan without mutation.

## Version & Rollback (Epic 5)

### Rollback Flow

1. Approved collaboration proposes a **Business Version** (Git for a business)  
2. Surface versions: Website, Booking, Workspace, Automations, Portfolio, Packages  
3. Compare versions with diffs  
4. Generate full / partial / single-change **rollback plans** (never executed here)  
5. AI restore suggestions — always owner-approved, never auto  
6. **Business Timeline** — milestones + builder changes + achievements + recommendations  
7. Mission Control: Current → History → Diff → Rollback availability → Restore suggestions  

Rollback is real (restore prior Business Version live) — not a soft undo toast. Try it. You can always go back. Apply / execute is a later epic.

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
