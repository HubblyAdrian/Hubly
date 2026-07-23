# Section 2 — Experience Director (Release Gate)

**Status: Proven only when `node scripts/check-section2-experience-director.mjs` exits 0.**

Do not begin Section 3 until this section passes.

## Objective

The Experience Director is a first-class Hubly Brain expert. It does **not** generate websites, strategies, or CRM actions. It protects the customer experience and is the guardian of Hubly’s one personality.

## Release Gate

| Requirement | Proven by |
|-------------|-----------|
| Experience Director exists | Registered `experience_director` expert + `hubly_brain_experience_director.ts` |
| Every customer-facing response passes through it | think invariant + weather/workspace + `CUSTOMER_FACING_TASKS` in `HublyAI.run` |
| Can simplify responses | Fixtures B/D — settings dump & technical jargon rewritten |
| Can reduce unnecessary questions | Fixture A — **10 → 3** |
| Can veto overly complex interactions | Fixtures B/C — settings & 18 widgets vetoed |
| Enforces one Hubly personality | Fixture D — no multi-AI / robotic / technical voice |
| Automated evidence | `docs/HUBLY_BRAIN_SECTION2_PROOF.json` + interception logs |

## Authority (examples)

| Expert output | Experience Director |
|---------------|---------------------|
| Research proposes 10 questions | Reduces to **3** |
| Creative exposes 25 website settings | Converts to a **conversation** (no settings wall) |
| Operations wants 18 dashboard widgets | Shows **1** recommendation, hides the rest |

## Personality

Every response should feel like **one** business partner: calm, confident, proactive, conversational, helpful — never robotic, never overly technical, never like multiple AI systems.

## Architecture

```
Other experts → draft outputs
        ↓
Experience Director (evaluate → veto/simplify → personality → log interception)
        ↓
One Hubly response → customer
```

## Verify

```bash
node scripts/check-section2-experience-director.mjs
```

Writes human-readable evidence to `docs/HUBLY_BRAIN_SECTION2_PROOF.json` including **before → after interception logs**.
