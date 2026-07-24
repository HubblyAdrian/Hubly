# ADR-0004 — Capabilities are registry-driven

- **Status:** Accepted  
- **Date:** 2026-07  
- **Milestone:** 1 · Sections 11, 15  

## Context

Hardcoding “who owns arrival windows?” into prompts or `think` branches does not scale across builders, industries, and integrations.

## Decision

Tool / Capability Registry + Knowledge Registry answer ownership and routing. Platform Feature Manifests inventory installed modules. New capabilities **register**; Brain discovers via `whoOwnsCapability` / route plans.

## Consequences

- Extensibility without core rewrites  
- Validation for conflicts and versions  
- Mission Control Platform Inventory  

## Related

`docs/architecture/CAPABILITY_GUIDE.md` · Section 15 Platform Extensibility
