# Section 16 — Validation & Quality Assurance

**Status:** Pass (pending Founder Approval)  
**Release Gate:** Milestone 1 · Section 16 of 18

## Rename

Formerly “Tests.” Unit tests are not enough for an AI operating system.  
This section **validates intelligence**.

## Objective

Prove Hubly Brain behaves correctly under real-world business scenarios — with automated validation for every major AI behavior.

## Validation suites

| Suite | What it proves |
|-------|----------------|
| Brain | Routing · memory loading · expert execution · decision · reasoning · identity |
| Experts | Execute · reasoning · confidence · permissions · graceful failure · no Brain bypass |
| Memory | Business / Workspace / Conversation Intelligence — isolated, persist, retrieve |
| Business generation | Pressure washing · lawn care · window cleaning · HVAC · photography · house cleaning |
| Multi-industry | DNA outputs measurably different across industries |
| Identity | Hubly Constitution compliance on every response |
| Capabilities | Discovery · permissions · execution · failure recovery |
| Security | Isolation · permissions · audit log · safe errors |
| Performance | Parallel AI · 1000 memory lookups · DNA loads · timeouts · degradation |

## Scenario Library

Permanent regression scenarios (founder-shaped requests). Every future release must pass them.

Examples: starting lawn care, recurring memberships, move Dashboard, portfolio photos, no same-day bookings, arrival windows, rewrite homepage, hate my logo, business expanding.

## Founder Benchmark Suite

Real founder requests that define what Hubly must remain capable of — including future Builder Engine work.

Examples: “I liked two things about my old software…”, “Make my website feel more premium.”, “Should I raise my prices?”, “I just hired my first employee.”

## Quality Score (Mission Control)

Engineering health score (not customer-facing):

- Overall AI Quality  
- Routing · Memory · Reasoning · Identity · Business DNA · Decision Engine · Capabilities · Builder Readiness  

## Architecture

| Module | Path |
|--------|------|
| Quality engine | `supabase/functions/_shared/hubly_brain_quality.ts` |
| Node binding | `scripts/lib/quality.mjs` |
| Mission Control | `qualityAssurance` surface |
| Sole AI gate | `HublyAI` / `HublyQuality` |

## Prove

```bash
npm run check:section16
# or
node scripts/check-section16-quality.mjs
```

Evidence: `docs/HUBLY_BRAIN_SECTION16_PROOF.json`
