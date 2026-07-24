# Section 8 — Reasoning Engine (Release Gate)

**Status: Proven only when `node scripts/check-section8-reasoning-engine.mjs` exits 0.**

Section 8 accepted. Do not begin Milestone 2.

## Objective

Answer one question for every AI action:

> Why did Hubly make this decision?

Hubly must never act like a black box. Every recommendation, website change, suggestion, and automation is explainable from a stored **Reasoning Object**.

## Reasoning Object (minimum fields)

| Field | Purpose |
|-------|---------|
| reasoningId | Stable id |
| decision | What Hubly recommends |
| explanation | Why |
| evidence | Facts that influenced it |
| evidenceSources | DNA, memory, experts, research… |
| confidence | 0–100 |
| expectedOutcome | e.g. higher trust, more bookings |
| expertsInvolved | Research → Strategy → Creative → Critic… |
| timestamp | When recorded |
| version | Decision lineage version |
| business / workspace / DNA versions | Context versions |
| influencedBy / influences | **Decision Graph** links |
| reusesReasoningId | Reuse across experts |

## Decision Graph

Reasoning is not isolated. Decisions link:

```
Industry → Brand → Homepage → Booking → Pricing / Trust
```

When the owner asks why the booking flow changed, Hubly can narrate the chain of prior decisions—not a single slogan.

## Why?

> Why did we choose this homepage?

Hubly answers from **stored** reasoning (and the Decision Graph). It does **not** regenerate a fresh explanation.

## Version history

If a recommendation changes (e.g. Luxury Branding → Family-Owned Branding), both records remain. Compare versions anytime.

## Reuse

Experts reference prior reasoning (e.g. Creative Director reuses Strategy’s trust objective) instead of inventing conflicting explanations.

## Demonstration

1. `I'm starting a pressure washing business.`  
   → Store reasoning for industry, homepage, booking, pricing, brand, trust.
2. `Why did we choose this homepage?`  
   → Answer from the stored homepage Reasoning Object + graph chain.

## Verify

```bash
node scripts/check-section8-reasoning-engine.mjs
# or
npm run check:section8
```

Evidence: `docs/HUBLY_BRAIN_SECTION8_PROOF.json`
