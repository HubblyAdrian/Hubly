# ADR-0003 — Experts cannot write directly to memory

- **Status:** Accepted  
- **Date:** 2026-07  
- **Milestone:** 1 · Sections 3–6  

## Context

If every expert wrote memory, races, contradictory facts, and missing audit trails would follow. Owners would not get a single accountable “Hubly decided.”

## Decision

Experts may **suggest** updates. **Hubly Brain alone commits** Business Memory, Workspace Memory, and Conversation Intelligence.

## Consequences

- Centralized versioning and changelog  
- Experts stay replaceable modules  
- Builder Engine (1.5) will likewise propose Change Plans; Brain applies  

## Related

`docs/architecture/EXPERT_DEVELOPMENT.md` · `BUILDER_ENGINE_SPEC.md`
