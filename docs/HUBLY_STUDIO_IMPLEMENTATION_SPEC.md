# Hubly Studio — Implementation Spec

**Status:** In progress · replaces Operate **Marketing** tab  
**Design refs:** Figma (approved) — Studio Home · AI Creator · Projects · Template Gallery · Brand Kit · Publish Center · Analytics  
**Architecture:** Hubly owns workflow; Canva (Connect) owns visual editing when linked. Campaign Engine is the marketing brain.

## Product philosophy

- Customer feels **Hubly Studio** end-to-end.
- Visual editing is one step (**Customize Design** → return), not a separate product.
- Users should rarely start from a blank canvas — **campaign goals** first.
- No vendor branding in UI unless required by platform policy.

## Screens (unchanged IA)

| Screen | Notes |
|--------|--------|
| Studio Home | Recommendations, recent projects, queue |
| AI Creator | **Campaign goals** + prompt; generates Campaign Plan package |
| Projects | System of record list |
| Template Gallery | Hubly templates · AI campaigns · design library (when linked) |
| Brand Kit | Stored in Hubly; synced into designs when creating |
| Publish Center | Hubly-only publish (FB / IG / GBP / email / SMS) |
| Analytics | Business outcomes, not design vanity metrics |
| **Project Workspace** | Replaces Editor Workspace — preview + campaign meta + Customize Design |

## Project Workspace

Left: Campaign Overview · Assets · Versions · Comments (soon) · AI Suggestions · Export History  
Center: Large design **preview**, page navigation, export status, version context — **not** a graphics editor  
Right: Campaign metadata  
Primary CTA: **Customize Design** → create/locate Canva design → `edit_url` + correlation → return to same Hubly project

## Layers

```
Studio UI → Campaign Engine → Knowledge (playbooks / calendar / triggers)
```

See `docs/HUBLY_STUDIO_CAMPAIGN_ENGINE.md` and `docs/HUBLY_STUDIO_CANVA_INTEGRATION_PLAN.md`.

## Data ownership

- Studio owns: projects, pages, assets, brand kit, templates catalog, publish queue, social link rows, analytics snapshots, **campaign plans**, versions, exports.
- Reads: Jobs, Reviews, Business Memory (facts), Business DNA (identity) — does not merge Memory ↔ DNA.
- Canva design id stored on `studio_projects.canva_design_id`.

## Backend

- Migration `20260729200000_hubly_studio.sql` — Studio tables  
- Migration `20260729210000_hubly_campaign_engine.sql` — Campaign Engine + project Canva/version fields  
- Edge `studio-api` + `_shared/hubly_campaign_engine.ts`

## Stages

1. **Now:** UI + CRUD + Campaign Engine plans + Project Workspace shell  
2. **Next:** Canva Connect OAuth, edit_url return navigation, asset upload, export into Hubly storage  
3. **Later:** Live publish providers, outcome analytics, proactive trigger worker

## Success checks

- Open Studio → Home → AI Creator → pick goal → Project Workspace with package preview  
- Customize Design with Canva unset → honest **Provider not configured**  
- Publish stays in Hubly queue (no fake Connected accounts)
