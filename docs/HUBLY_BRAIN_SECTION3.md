# Section 3 — AI Expert Framework (Release Gate)

**Status: Proven only when `node scripts/check-section3-expert-framework.mjs` exits 0.**

Do not begin Section 4 until this section passes.

## Objective

Build an extensible AI Expert Framework so Hubly Brain dynamically discovers, registers, and orchestrates experts.

Adding Growth, Finance, Workspace, Marketplace, SEO, etc. must require **only**:

1. Implement the expert interface  
2. Register the expert  

**Hubly Brain must not be modified** when a new expert is introduced.

## Expert interface

Every expert declares:

| Field | Role |
|-------|------|
| Name / Version / Purpose | Identity |
| Responsibilities | What it owns |
| Inputs / Outputs | Contract |
| Required Memory | Memory surfaces needed |
| Allowed Tools / Allowed Actions | Capability Registry |
| Confidence / Reasoning | Decision quality |
| Execution Priority | Run order (lower first) |
| Failure Behavior | skip / ask / fallback_local |
| Dependencies | Experts that must run first |
| Intents / alwaysInclude | Routing metadata |

## Registration flow

```
Expert module → registerExpert(def, handler)
        ↓
Registry (in-memory)
        ↓
discoverExperts()  ← Hubly Brain
selectExpertsFromRegistry(intent, request)  ← routing
runExpert(id, ctx)  ← execution
unregisterExpert(id)  ← clean removal (Demo Expert)
```

## Demonstration — Demo Expert

Temporary expert `demo_expert`:

1. Register  
2. Brain discovers it  
3. Brain routes + executes it  
4. Unregister cleanly  

**No changes to Hubly Brain** (`think.ts` / `hubly_ai.ts`) for this expert.

## Release Gate

| Requirement | Proven by |
|-------------|-----------|
| Framework exists | `hubly_brain_expert_framework.ts` v1.0.0 |
| Experts self-register | `registerExpert` + initial experts module |
| Brain discovers automatically | `discoverExperts()` in think + proof |
| Brain routes using registry | `selectExpertsFromRegistry` — no `PIPELINE_ORDER` |
| New experts without Brain changes | Demo Expert lifecycle |
| Automated evidence | `docs/HUBLY_BRAIN_SECTION3_PROOF.json` |

## Verify

```bash
node scripts/check-section3-expert-framework.mjs
```
