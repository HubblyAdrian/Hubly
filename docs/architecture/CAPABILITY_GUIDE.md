# Capability Guide

**Version:** 1.0.0  
**Purpose:** Register capabilities, knowledge, integrations, and Feature Manifests without guessing.

## Philosophy

Hubly Brain should never guess. It should know:

- **What it can do** → Tool / Capability Registry  
- **Where it gets info** → Knowledge Registry  
- **What modules are installed** → Feature Manifests / Platform Inventory  

See [ADR-0004](../adr/0004-registry-driven-capabilities.md).

## Register a capability

Capabilities live on tools:

```ts
import { registerTool } from "./hubly_brain_registries.ts";
// or HublyPlatform.registerCapability(...)

registerTool({
  id: "maps_travel",
  name: "Maps Travel",
  version: "1.0.0",
  purpose: "Estimate travel time between jobs",
  responsibilities: ["Read maps", "Estimate travel"],
  category: "scheduling",
  capabilities: [{
    id: "estimate_travel_time",
    label: "Estimate Travel Time",
    aliases: ["travel time", "drive time"],
  }],
});
```

Discovery: `whoOwnsCapability("estimate travel time")` → owning tool id.

## Register a knowledge source

```ts
registerKnowledgeSource({
  id: "google_business_profile",
  name: "Google Business Profile",
  purpose: "Local listing insights and reviews",
  source: "Google",
  access: "read", // read | write | read_write
  domains: ["reviews", "local_listing"],
  aliases: ["GBP", "Google My Business"],
});
```

Unregister: `unregisterKnowledgeSource(id)` / Platform helper.

## Register an integration

Via Platform (auth, permissions, events, failure behavior):

```ts
HublyPlatform.registerIntegration({
  id: "mock_quickbooks",
  name: "QuickBooks (Mock)",
  version: "0.1.0",
  authentication: "oauth2",
  readPermissions: ["read:invoices"],
  writePermissions: ["write:expenses"],
  events: ["invoice.created"],
  capabilities: ["accounting_sync"],
  failureBehavior: "queue",
});
```

## Create a Feature Manifest

Every extension (expert, builder, industry, capability, knowledge, integration, workflow) should declare:

| Field | Why |
|-------|-----|
| id, name, version, kind, owner | Identity |
| capabilities, dependencies | Routing + install order |
| requiredPermissions | Security |
| configurationSchema | Config DX |
| health | Mission Control |
| documentationLink | Humans |
| minHublyBrainVersion | Compatibility |
| supportedCapabilities, migrationRequirements | Upgrades |

Validation rejects missing metadata, capability conflicts, bad deps, incompatible Brain versions.

## Workflows

`HublyPlatform.registerWorkflow` — automation modules register triggers/steps/capabilities. No workflow-engine rewrite to add one.

## UI extension points (reserved)

Dashboard cards, Business Home cards, Workspace widgets, AI actions — **architecture only** in Milestone 1 (`UI_EXTENSION_POINTS`).

## Prove it

```bash
npm run check:section15   # Platform Extensibility
npm run check:section11   # Registries
```
