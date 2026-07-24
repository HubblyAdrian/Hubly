# Section 12 — Hubly Mission Control (Release Gate)

**Status: Proven only when `node scripts/check-section12-mission-control.mjs` exits 0.**

Do not begin Section 13 until this section passes. Do not begin Milestone 2.

## Objective

**Hubly Mission Control** is the AI Headquarters — not Admin, not a debug-only console.

One place to understand what Hubly is doing across experts, memory, decisions, registries, and (later) Builder actions.

## Surfaces

| Surface | Purpose |
|---------|---------|
| Live AI Activity | Brain / Research / Strategy / Creative / Critic / Decision / Builder |
| Expert Activity | Load, latency, failure/success, confidence, decision scores |
| Business Memory | Inspect · compare · restore |
| Workspace Memory | Inspect · replay · compare |
| Conversation Intelligence | Projects · threads · deferred ideas · promises |
| Decision Graph | Visual chain of AI decisions |
| Builder Actions | Milestone 1.5 — preview / applied / rejected / rollback |
| Capability Registry | Everything Hubly can do |
| Knowledge Registry | Everything Hubly knows |
| Brain Timeline | Git-like replay of a run |
| AI Health | Latency · errors · confidence · reasoning · costs · providers |

## AI Replay (flight recorder)

Click **Replay Execution** for any run and see:

1. Original user request  
2. Memories loaded  
3. Business DNA facts used  
4. Experts executed (order)  
5. Reasoning Objects created  
6. Decision Objects calculated  
7. Capabilities selected  
8. Knowledge sources accessed  
9. Final response  
10. What was written back to memory  

## Verify

```bash
node scripts/check-section12-mission-control.mjs
# or
npm run check:section12
```

Evidence: `docs/HUBLY_BRAIN_SECTION12_PROOF.json`
