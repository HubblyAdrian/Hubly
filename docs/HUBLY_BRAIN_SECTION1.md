# Section 1 — Hubly Brain (proven)

Milestone 2 may not start until this section is green.

## Claims

| # | Claim | Proof |
|---|--------|--------|
| 1 | Hubly Brain exists | `HublyAI.name === "Hubly Brain"`; `Hubly` / `HublyBrain` aliases; `hubly-brain` edge function |
| 2 | Only Brain reaches LLMs | `api.openai.com` / `api.anthropic.com` appear only in `hubly_ai.ts` |
| 3 | Every AI interaction routes through Brain | Edge AI features + marketplace intake call `HublyAI.*`; pages never call providers |
| 4 | Brain determines experts | `selectExperts()` in `hubly_brain_think.ts`; empty expert set = Brain chose direct `complete` |
| 5 | Brain merges outputs into one response | Experience Director builds `ownerResponse`; `mergedResponse: true` on all Brain runs |
| 6 | Brain updates memory after every interaction | `appendConversationTurn` in think + complete; `persistBrainRun` when `businessId` present |
| 7 | Brain logs every execution | `hubly_brain_execution_log.ts` + `hubly_brain_executions` table; `Hubly.executions()` |

## Verify

```bash
node scripts/check-hubly-brain-section1.mjs
```

Produces `docs/HUBLY_BRAIN_SECTION1_PROOF.json` when green.

## Architecture note

`HublyAI.complete` is **not** a bypass. It is Hubly Brain’s sole model gate:

- Brain selects experts (`[]` for direct completion, or the think pipeline set).
- Brain owns the response (`mergedResponse`).
- Brain updates conversation memory when supplied.
- Brain logs the execution before returning.
