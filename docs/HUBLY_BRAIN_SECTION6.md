# Section 6 — Workspace Memory (Release Gate)

**Status: Proven only when `node scripts/check-section6-workspace-memory.mjs` exits 0.**

Do not begin Section 7 until this section passes.

## Objective

| Memory | Answers |
|--------|---------|
| **Business Memory** | What Hubly knows about the business |
| **Workspace Memory** | What Hubly knows about how the owner likes to work |

This section builds the foundation for the future **Workspace Expert** (Milestone 10).  
It does **not** personalize the CRM.

## What it stores

- Sidebar order  
- Dashboard layout  
- Favorite pages  
- Hidden tools / modules  
- Pinned actions  
- Working style (default landing, density, tips)  
- Future AI workspace suggestions (stored, not auto-applied)

## Ownership

| Actor | Permission |
|-------|------------|
| Experts | Read + **suggest** |
| Hubly Brain | **Commit** |
| Customers | Never see internal changelog / fact meta |

Same discipline as Business Memory: versioned, reasoned, timestamped, attributable, with Memory Importance.

## Demonstration

1. `Put Jobs above Customers in the sidebar.` → sidebar updates  
2. `Hide the Marketing tools for now.` → hidden tools update  
3. `Pin Create Quote.` → pinned actions update  
4. `What does my workspace look like?` → answer from Workspace Memory  
5. `Why did we hide Marketing?` → answer from stored reasoning  
6. New session loads the same Workspace Memory  

## Verify

```bash
node scripts/check-section6-workspace-memory.mjs
```

Evidence: `docs/HUBLY_BRAIN_SECTION6_PROOF.json`
