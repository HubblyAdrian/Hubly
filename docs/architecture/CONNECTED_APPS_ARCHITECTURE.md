# Connected Apps Architecture — FREEZE

**Status:** ARCHITECTURE FREEZE · Milestone `v2-platform-foundation`  
**Scope:** Hubly Core integration platform  
**Rule:** Do not add new integration subsystems. Add providers as plugins.

---

## Guiding principle

Hubly is an AI operating system. Integrations are **plugins**, not features.

AI never says “Use Canva” or “Post to Meta.”  
AI says **Intent → Capabilities → Execution Plan → Execute.**  
Connected Apps resolve which vendor fulfills a capability.

---

## Canonical pipeline

```
Ask Hubly
    ↓
Intent Engine              recognize Intent (Promote Project)
    ↓
Planner                    required Capabilities
    ↓
Capability Resolver        Connected Apps that declare those capabilities
    ↓
Execution Plan (draft)     preview · edit · approve · cancel
    ↓
Event Bus                  typed business events + capability fan-out
    ↓
Providers                  connect / sync / createDesign / …
```

| Layer | Server | Client |
|-------|--------|--------|
| Intent | `hubly_intent_engine.ts` | `hubly-intent-engine.js` |
| Planner + Resolver | `hubly_action_engine.ts` | `hubly-action-engine.js` |
| Execution Plan | `hubly_execution_plan.ts` | (in Intent Engine client) |
| Connected Apps | `hubly_connected_apps.ts` | `connected-apps.js` |
| Catalog SSOT | `hubly-core/connected-apps-catalog.json` | generated → client |
| Creative | `hubly_creative_engine.ts` | via facades |
| Event Bus | `hubly_event_bus.ts` | `hubly-events.js` |
| Marketplace | — | `app-marketplace.js` |

**Naming:** “Action Engine” = Planner + Resolver. Not Hubly Brain’s Planner.

---

## Catalog — one source of truth

**Edit only:** `hubly-core/connected-apps-catalog.json`

Then run:

```bash
node scripts/sync-connected-apps-catalog.mjs
```

Syncs to:

- `public/journey-os/connected-apps-catalog.json`
- `public/journey-os/connected-apps-catalog.generated.js`
- `supabase/functions/_shared/connected_apps_catalog.json`

Tests fail if copies drift from SSOT.

---

## Lock rule (non-negotiable)

> If adding a new provider requires changing the **Intent Engine**, **Event Bus**, **Marketplace**, or **Creative Engine**, **stop**. The architecture has been violated.

**Allowed for a new provider:**

1. Provider implementation (`hubly_provider_*.ts` / future `providers/<vendor>/`)
2. OAuth Edge Function
3. Capability declaration in catalog SSOT
4. Provider registration / bootstrap
5. Optional provider-specific UI

See `providers/README.md` for the Provider SDK direction.

---

## Product language glossary

| Say | Do not say | Internal OK |
|-----|------------|-------------|
| Connected Apps | External Workspace | `photography_project_workspaces` |
| Connect Dropbox | Create an External Workspace | `ProjectWorkspace` |
| Execution Plan | “Run Canva now” | `providerId` on plan steps (executors only) |
| Intent / Capabilities | Vendor CTAs in Ask Hubly | — |

---

## ConnectedAppProvider contract

Implement + `registerConnectedApp` + catalog row + capabilities.  
Optional: `createDesign`, `webhook`, `version`, future `execute(capability, opts)`.

Freeze plugin test: `tests/connected-apps-architecture-freeze.test.mjs`

---

## Next milestones (after merge + smoke)

| Priority | Work | Notes |
|----------|------|--------|
| 1 | ~~Unify catalogs~~ | Done — `hubly-core/connected-apps-catalog.json` |
| 2 | Durable Event Log | Append-only store · replay · retry · audit (Stripe-webhook style) |
| 3 | Provider OAuth | Meta / Google / Adobe / Canva as Provider + OAuth + Capabilities |
| 4 | Provider SDK layout | `providers/<vendor>/` · future `hubly-provider-*` packages |

Do **not** start Meta/Canva/Adobe feature work until OAuth fits the plugin recipe.

---

## Freeze lift criteria

1. Plugin test passes.  
2. New real provider changes only provider + OAuth + catalog + registration.  
3. Durable event log exists (or consciously deferred with Stage-1 bus documented).  
4. Execution Plans are preview/approve before run in Ask Hubly.

Until then: **extend capabilities and providers; do not extend architecture.**
