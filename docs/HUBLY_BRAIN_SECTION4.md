# Section 4 — Initial Experts (Release Gate)

**Status: Proven only when `node scripts/check-section4-initial-experts.mjs` exits 0.**

Do not begin Section 5 until this section passes.

## Objective

Prove the first generation of Hubly experts are fully operational and participate in real AI workflows through Hubly Brain.

This section does **not** add more experts. It validates:

| Expert | Structured output |
|--------|-------------------|
| Experience Director | Experience Review |
| Research Expert | Research Report |
| Strategy Expert | Business Strategy |
| Creative Director | Creative Plan |
| Critic | Quality Report |

## Orchestration

Hubly Brain is the only coordinator. Experts never call each other.

```
Research Expert
    ↓
Strategy Expert
    ↓
Creative Director
    ↓
Critic
    ↓
Experience Director   ← customer-experience gate (Section 2)
    ↓
Hubly Brain merges
    ↓
Customer (one Hubly response)
```

Registry priorities drive order (Research 10 → Strategy 20 → Creative 30 → Critic 40 → Experience Director 100). Experience Director runs last so every customer-facing reply is reviewed.

## Structured expert return

Every expert returns:

- expert name
- execution time
- reasoning
- confidence
- output (typed report)
- status (`ok` | `failed` | `skipped` | `retried`)

Hubly Brain merges these into `mergedExpertRecords` plus one customer response.

## Expert Transcript (internal)

For every execution, Hubly Brain stores (never customer-visible):

- What each expert received
- What each expert concluded
- Why it made that conclusion
- What changed from the previous expert
- How the final answer was assembled

## Failure handling

- Retry when `failureBehavior` allows
- Skip / soft-fail and continue when safe
- Report failures on the Brain result
- Never expose internal errors to customers

## Demonstration

Request:

> I'm starting a pressure washing company.

Prove all five experts execute with reasoning + confidence, and Brain returns one unified response.

## Verify

```bash
node scripts/check-section4-initial-experts.mjs
```

Evidence: `docs/HUBLY_BRAIN_SECTION4_PROOF.json`
