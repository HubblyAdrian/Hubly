# ADR-0002 — Memory systems stay separate

- **Status:** Accepted  
- **Date:** 2026-07  
- **Milestone:** 1 · Sections 5, 6, 10  

## Context

Chat logs, business facts, and UI preferences solve different jobs. Merging them creates wrong answers (“what’s my sidebar order?” pulling from a transcript) and unsafe overwrites.

## Decision

Maintain three Brain-owned systems:

1. **Business Memory** — facts  
2. **Workspace Memory** — how the owner works  
3. **Conversation Intelligence** — structured working memory of the engagement (not raw turns)

Never combine DNA (interpretive) into Business Memory either.

## Consequences

- Clear retrieval APIs per question type  
- Isolation tests in Section 16  
- Slightly more plumbing; far fewer class of bugs  

## Related

`docs/architecture/MEMORY_GUIDE.md` · Sections 5, 6, 7, 10
