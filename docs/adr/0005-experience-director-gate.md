# ADR-0005 — All owner-facing AI passes through Experience Director

- **Status:** Accepted  
- **Date:** 2026-07  
- **Milestone:** 1 · Sections 2, 13  

## Context

Specialized experts optimize for their domain. Without a final CX gate, owners get question floods, settings dumps, multi-agent voice, and Constitution violations.

## Decision

**Experience Director** is a first-class expert with veto power, always last (`executionPriority` 100). It enforces simplicity caps, one Hubly personality, and (Section 13) Identity System + Constitution evaluation.

## Consequences

- Consistent character across chat, Builder previews, Daily, Home  
- Some expert verbosity is intentionally delayed/hidden  
- Think pipeline throws if ED did not review customer-facing paths  

## Related

`docs/HUBLY_BRAIN_SECTION2.md` · `docs/architecture/CONSTITUTION_GUIDE.md` · `AI_LIFECYCLE.md`
