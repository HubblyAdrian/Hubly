# Connected Apps Architecture — FREEZE

**Status:** ARCHITECTURE FREEZE  
**Scope:** Hubly Core integration platform (Intent → Capabilities → Connected Apps → Event Bus → Execution)  
**Rule:** Do not add new integration subsystems or vendor-specific feature APIs until this freeze is lifted. Add providers as plugins.

---

## Guiding principle

Hubly is an AI operating system. Integrations are **plugins**, not features.

AI never says “Use Canva” or “Post to Meta.”  
AI says **Intent → Capabilities → Execute.**  
Connected Apps resolve which vendor fulfills a capability.

---

## Canonical pipeline

```
Ask Hubly
    ↓
Intent Engine          recognize Intent (Promote Project)
    ↓
Planner                required Capabilities (Marketing Graphics, Social Publishing, …)
    ↓
Resolver               Connected Apps that declare those capabilities
    ↓
Event Bus              typed business events + capability fan-out
    ↓
Execution              provider methods (connect / sync / createDesign / …)
```

| Layer | Module (server) | Module (client) | Speaks |
|-------|-----------------|-----------------|--------|
| Intent | `hubly_intent_engine.ts` | `hubly-intent-engine.js` | Intent labels |
| Planner + Resolver | `hubly_action_engine.ts` | `hubly-action-engine.js` | Capability labels |
| Connected Apps | `hubly_connected_apps.ts` | `connected-apps.js` | Provider registry + catalog |
| Creative routing | `hubly_creative_engine.ts` | via Connected Apps | Capability `creative` |
| Event Bus | `hubly_event_bus.ts` | `hubly-events.js` | Event types |
| Marketplace UI | — | `app-marketplace.js` | Installed / Available |
| Project surface | — | `photography-projects.js` | First consumer |

**Naming note:** “Action Engine” = **Planner + Resolver** under the Intent Engine. Do not confuse with Hubly Brain’s Planner (`hubly_brain_planner.ts`).

---

## Product language glossary

| Say (product / AI) | Do not say | Internal OK |
|--------------------|------------|-------------|
| Connected Apps | External Workspace | `photography_project_workspaces` table |
| Connect Dropbox | Create an External Workspace | `ProjectWorkspace` type |
| Apps (Marketplace) | Integrations (for this surface) | Settings may still say Integrations for legacy OS cards |
| Intent / Capabilities | “Use Canva” | Provider `id` in executor bindings only |
| Creative | Canva tab | Canva as one Connected App |

Deprecated / transitional: `ExternalWorkspaceProvider`, `upsertExternalWorkspace` (alias → project app link), CSS class `pp-lr-twin` (layout only).

---

## ConnectedAppProvider contract

Every vendor implements:

```ts
interface ConnectedAppProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  connect(opts): Promise<HublyProviderResult<…>>;
  disconnect(opts): Promise<HublyProviderResult<…>>;
  sync(opts): Promise<HublyProviderResult<…>>;
  status(opts): Promise<HublyProviderResult<ConnectedAppStatus>>;
  health(opts?): Promise<HublyProviderResult<ConnectedAppHealth>>;
  permissions(): ConnectedAppPermission[];
  capabilities(): ConnectedAppCapability[];
  actions?(): ConnectedAppAction[];
  webhook?(req): Promise<HublyProviderResult<…>>;
  /** Creative-capable apps only */
  createDesign?(opts): Promise<HublyProviderResult<…>>;
}
```

Then:

1. `registerConnectedApp(provider)`
2. Add a row to `CONNECTED_APP_CATALOG` (and client catalog twin until catalogs unify)
3. Declare `capabilities` + `productCapabilities`
4. Done — Intent / Planner / Resolver / Event Bus / Creative Engine discover by capability

### Freeze test (must keep passing)

> Register a **fake** provider with only the interface + capabilities.  
> Intent `promote_project` / capability `creative` must resolve it **without** editing Intent Engine, Event Bus, or Marketplace UI code.

See `tests/connected-apps-architecture-freeze.test.mjs`.

---

## Event model

**Client** `HublyEvents` — Stage 1 in-process bus (Rule #17 / #18). Full Operate catalog.  
**Server** `HublyEventBus` — typed union + **capability subscriptions** for Connected Apps engines.

Shared Connected Apps events:

| Event | Capability hints |
|-------|------------------|
| `project.delivered` | creative, publishing, reviews, scheduling, messaging |
| `gallery.delivered` | creative, publishing, reviews, messaging |
| `project.editing_complete` | creative, assets_export, publishing |
| `app.connected` / `app.disconnected` | — |
| `creative.asset_planned` / `creative.asset_created` | publishing, scheduling |
| `ai.action.proposed` / `ai.action.executed` | from Intent plan |

Operate-only events (`membership.*`, `settings.*`, …) live on the client bus today. Do not invent a second Operate bus on the server during this freeze.

---

## How to add a provider (plugin recipe)

1. Create `hubly_provider_<vendor>.ts` implementing `ConnectedAppProvider`.
2. Call `registerConnectedApp` from `ensureHublyConnectedAppsRegistered()` (or self-register like Canva/Lightroom).
3. Add catalog entry (server + client) with `productCapabilities`.
4. Production-First: missing credentials → **Provider not configured** (never fake success).
5. Optional OAuth Edge Function later — same Google Calendar callback pattern.
6. **Do not** add Intent conditionals, Marketplace if-branches, or Creative Engine vendor switches.

### Still special-cased (honest gaps — fix before lifting freeze)

| Gap | Why it matters |
|-----|----------------|
| Client catalog duplicates server catalog | Drift risk (`google` vs `google_business`) |
| Photography `connectActionForProvider` | Only Canva / Adobe have client OAuth facades today |
| Client marketing create still prefers Canva facade | Facades must register into a map (in progress) |
| `ExternalWorkspaceProvider` on Lightroom | Deprecated dual API — keep until workspace cutover |
| No durable server event log | Stage 1 in-process only |

---

## What not to build during freeze

- New industry-specific integration subsystems
- Hardcoded “if Meta then…” workflows in Ask Hubly or Creative UI
- Parallel “integrations” frameworks beside Connected Apps
- Fake OAuth / fake Canva / fake Adobe success paths

---

## Freeze lift criteria

1. Plugin test passes (fake provider discovered by capability only).  
2. New real provider (e.g. Meta) lands as provider file + catalog + OAuth — no Intent/Event Bus edits.  
3. Client/server catalog unified or generated from one source.  
4. Photography connect actions driven by facade registry, not id switches.

Until then: **extend capabilities and providers; do not extend architecture.**
