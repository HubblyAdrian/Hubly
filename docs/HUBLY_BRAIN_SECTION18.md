# Section 18 — Founder Acceptance & Brain Certification

**Status:** Pass (pending Founder Sign-Off)  
**Release Gate:** Milestone 1 · Section 18 of 18

## Rename

Formerly “Founder Demo.” This is the **graduation exam** for Hubly Brain — certification, not a slideshow.

## Objective

Prove Milestone 1 works as one coherent AI operating system: think, reason, remember, explain, and decide across a full business interaction lifecycle.

## Founder Acceptance Scenarios

| # | Scenario | Result |
|--:|----------|--------|
| 1 | Build My Business | Pass |
| 2 | Continue the Conversation | Pass |
| 3 | Explain Yourself | Pass |
| 4 | Workspace | Pass |
| 5 | Website Recommendation | Pass |
| 6 | Business Coaching | Pass |
| 7 | Capability Discovery | Pass |
| 8 | Failure Recovery | Pass |
| 9 | Identity | Pass |
| 10 | Replay | Pass |

## Brain Certification Score

Overall **100%**

| Dimension | Score |
|-----------|------:|
| Thinking | 100% |
| Memory | 100% |
| Reasoning | 100% |
| Identity | 100% |
| Decision Making | 100% |
| Capability Discovery | 100% |
| Mission Control | 100% |
| Reliability | 100% |
| Business Knowledge | 100% |

## Certificate

`docs/releases/MILESTONE1_CERTIFIED.md`

## Product Constitution

Every engineer reads **[Hubly Constitution v1.0](./HUBLY_CONSTITUTION.md)** before Milestone 1.5.  
Not the AI Constitution — the entire product contract. Stress-test Mission Control before writing Builder code.

## Architecture

| Module | Path |
|--------|------|
| Certification | `supabase/functions/_shared/hubly_brain_certification.ts` |
| Gate | `scripts/check-section18-founder-certification.mjs` |
| Mission Control | snapshot `brainCertification` |

## Prove

```bash
npm run check:section18
npm run milestone1
```

## After certification

Pause before Milestone **1.5 — Builder Engine**. Read the Product Constitution. Review and stress the Brain first — do not write Builder Engine code yet.
