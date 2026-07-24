# ADR-0001 — Hubly Brain is the only AI entry point

- **Status:** Accepted  
- **Date:** 2026-07  
- **Milestone:** 1 · Section 1  

## Context

If every feature called OpenAI/Anthropic directly, Hubly would feel like many products with inconsistent memory, voice, and safety. Provider keys and prompts would scatter.

## Decision

**Nothing** may call model providers except through Hubly Brain (`hubly_ai.ts` / `HublyAI`). All product surfaces use `think` / Brain skill methods.

## Consequences

- One personality, one audit trail, one place for retries/failover  
- Experts and UI never import provider SDKs  
- Release gate Section 1 proves no stray provider URLs outside Brain  

## Related

`docs/HUBLY_BRAIN_SECTION1.md` · `docs/architecture/SYSTEM_ARCHITECTURE.md`
