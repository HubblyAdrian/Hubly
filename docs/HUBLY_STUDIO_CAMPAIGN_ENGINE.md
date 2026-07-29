# Hubly Studio — Campaign Engine

**Status:** First-class backend service (knowledge + plans)  
**Role:** Marketing brain for Studio. Canva (when connected) is the visual renderer only.

## Three layers

```
Hubly Studio (UI)
────────────────
Campaign Engine (business logic)  ← this doc
────────────────
Knowledge Engine (playbooks, calendar, triggers, templates)
```

AI is the **writer**, not the strategist. Strategy comes from the database.

## Knowledge sources

1. **Industry playbooks** — proven campaign types per trade (pressure washing, HVAC, photography, …)
2. **Seasonal calendar** — month → recommended playbooks
3. **Marketing triggers** — IF no Facebook posts / new 5★ review / open slots → suggest playbook
4. **Business data** — jobs, photos, reviews, services, offers (facts from Memory / Operate)
5. **DNA** — tone / personality as separate `dna_inputs` on the plan (never merged into Memory)

## Tables

| Table | Purpose |
|-------|---------|
| `campaign_industries` | Industry keys + aliases |
| `campaign_goals` | Owner-facing goals |
| `campaign_playbooks` | Proven campaigns (channels, CTA, AI brief, templates) |
| `campaign_playbook_assets` | Required assets per playbook |
| `campaign_seasonal_calendar` | Month × industry → playbook |
| `campaign_triggers` | Proactive rules |
| `campaign_plans` | Per-business structured **Campaign Plan** instances |
| `studio_project_versions` | Version history |
| `studio_project_exports` | Export history |
| `studio_projects.canva_design_id` | Link to Canva design (optional) |
| `studio_projects.campaign_plan_id` | Link to plan |

Migration: `supabase/migrations/20260729210000_hubly_campaign_engine.sql`  
Engine module: `supabase/functions/_shared/hubly_campaign_engine.ts`

## Campaign Plan object

`POST /campaign/plan` returns a structured plan (not freeform marketing prose):

- objective, channels, required_assets, messaging_strategy, cta
- timing / schedule hints, template_refs, offer, audience
- `ai_brief` — instruction for the writer/renderer
- `business_inputs` (facts) vs `dna_inputs` (identity) — kept separate
- `package` — captions, headlines, hashtags, email, SMS, GBP post, schedule suggestions

Studio may also create a `studio_projects` row linked to the plan.

## API (studio-api)

| Route | Purpose |
|-------|---------|
| `GET /campaign/goals` | Goal catalog |
| `GET /campaign/suggest` | Ranked suggestions from context + triggers |
| `POST /campaign/plan` | Build + persist plan (+ optional project) |
| `GET /campaign/plans` | List plans for business |
| `GET /projects/:id/workspace` | Project Workspace payload |
| `POST /projects/:id/customize` | Canva edit — **Provider not configured** until OAuth |

## UI mapping

| Screen | Behavior |
|--------|----------|
| AI Creator | Campaign goals first → `generateCampaign` → Project Workspace |
| Project Workspace | Preview + metadata + **Customize Design** (not a local canvas editor) |
| Templates | Hubly / AI / Design library sources |
| Publish | Hubly-owned channels only |
| Analytics | Business outcomes (reach, clicks, quotes, jobs, revenue) |

## Production-First

- Do not simulate Canva success.
- Do not invent live social metrics.
- Playbook seed data is product knowledge, not fake customer results.
