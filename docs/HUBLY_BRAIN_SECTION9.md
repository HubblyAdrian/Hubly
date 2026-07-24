# Section 9 — AI Decision & Confidence Engine (Release Gate)

**Status: Proven only when `node scripts/check-section9-decision-engine.mjs` exits 0.**

Section 9 accepted. Do not begin Milestone 2.

## Objective

Decide whether Hubly should **act**, **ask**, **research further**, or **wait**.

Confidence is one dimension — never the only signal.

## Decision Score (every recommendation)

| Dimension | Question |
|-----------|----------|
| Confidence | How certain is Hubly? |
| Evidence Quality | How strong is the support? |
| Business Alignment | Fits goals, Memory, DNA, strategy? |
| Customer Impact | Trust / conversion / revenue / retention / simplicity |
| Experience Impact | Easier or harder to use Hubly? |
| Risk | Low → Very High |
| Requires Approval | Safe to auto-apply, or owner must approve? |
| **Overall Decision Score** | Weighted judgment across dimensions |

## Decision Matrix

| State | When |
|-------|------|
| **Proceed** | High score, low risk, no approval needed |
| **Recommend** | Strong case; owner approval required |
| **Ask** | Information missing |
| **Research More** | Evidence insufficient |

## Decision Objects

Stored per recommendation: scores, risk, approval, final decision, timestamp, explanation.

## Why didn't you act?

> Why didn't you make that change?

Answered from the **stored Decision Object** — not regenerated.

## Demonstration

1. `Rewrite my homepage.` → Decision Engine scores dimensions and routes (typically **Recommend** for a rewrite).
2. Store the Decision Object.
3. `Why didn't you make that change?` → explain from store.

## Verify

```bash
node scripts/check-section9-decision-engine.mjs
# or
npm run check:section9
```

Evidence: `docs/HUBLY_BRAIN_SECTION9_PROOF.json`
