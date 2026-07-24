# Expert Development Guide

**Version:** 1.0.0  
**Purpose:** Teach engineers how to add intelligence without rewriting Hubly Brain.

## Principles

1. Experts **suggest**; Brain **commits**.  
2. Experts never call model providers — Brain / `HublyAI.complete` only (if needed inside Brain).  
3. Experts never talk to each other — only via Brain `priorOutputs`.  
4. Adding an expert = **implement + register**. No `think.ts` edits.  
5. Every owner-facing string still passes Experience Director + Identity/Constitution.

See [ADR-0001](../adr/0001-hubly-brain-sole-ai-entry.md), [ADR-0003](../adr/0003-experts-cannot-write-memory.md).

## Create an expert

```ts
import { registerExpert, type HublyExpertDefinition, type HublyExpertHandler } from "./hubly_brain_expert_framework.ts";

const def: HublyExpertDefinition = {
  id: "seo_expert",
  name: "SEO Expert",
  version: "1.0.0",
  purpose: "Improve local search visibility",
  responsibilities: ["Suggest SEO improvements"],
  inputs: ["request", "memory", "dna"],
  outputs: ["seo_plan"],
  requiredMemory: ["business_memory"],
  capability: {
    can: ["seo", "local_search"],
    tools: [],           // ask Brain; never call tools yourself
    reads: ["business_memory", "business_dna"],
    actions: ["recommend_seo"],
  },
  executionPriority: 55,
  failureBehavior: "fallback_local",
  intents: ["website", "general"],
};

const handler: HublyExpertHandler = async (ctx) => ({
  expertId: "seo_expert",
  expertName: "SEO Expert",
  ok: true,
  summary: "I recommend tightening your homepage title around your main service and city.",
  confidence: 78,
  reasoning: [{
    reason: "Local SEO starts with clear service + city signals",
    evidence: [String(ctx.request || "").slice(0, 80)],
    confidence: 78,
    expectedImpact: "More qualified discovery traffic",
  }],
  output: { type: "SeoPlan", actions: ["title_tag"] },
});

registerExpert(def, handler);
```

Or via Platform (Feature Manifest + validation):

```ts
import { HublyPlatform } from "./hubly_brain_platform.ts";
HublyPlatform.registerExpert(def, handler);
```

## Register it

- Framework: `registerExpert(def, handler)`  
- Platform: `registerPlatformExpert` (adds Feature Manifest, version checks)  
- Boot path: call from your module’s `ensure*Registered` — **not** hardcode into Brain’s expert list  

## Declare permissions & capabilities

| Field | Meaning |
|-------|---------|
| `capability.can` | Routing keywords |
| `capability.tools` | Tools you may *ask Brain* to use |
| `capability.reads` | Memory surfaces you may read |
| `capability.actions` | Actions you may propose |

Permission enforcement: Reliability / Platform `assertExpertPermission`. Critic/ED have empty tool allow-lists.

## Return reasoning & confidence

Every successful output should include:

- `reasoning[]` with `reason`, `evidence`, `confidence`, ideally `expectedImpact`  
- numeric `confidence` 0–100  

Brain stores these for Decision/Reasoning “Why?” answers.

## Write tests

1. Register expert in a check script or unit test  
2. `discoverExperts()` includes it  
3. `runExpert` or `think` routes to it when appropriate  
4. Unregister cleanly  
5. Assert **no** changes to `hubly_brain_think.ts` / `hubly_ai.ts` for that expert  

Pattern: `scripts/check-section3-expert-framework.mjs` Demo Expert lifecycle.

## Validate against the Constitution

Before shipping owner-facing summaries:

- Run through Identity System / ED  
- No pressure language, no fake certainty, no robotic status labels  
- Prefer “I built / I think / because…” voices  

See [CONSTITUTION_GUIDE.md](./CONSTITUTION_GUIDE.md).

## Checklist

- [ ] Unique `id` + semver `version`  
- [ ] Handler never calls providers  
- [ ] Reasoning + confidence present  
- [ ] Permissions declared honestly  
- [ ] Failure behavior set  
- [ ] Register/unregister proven  
- [ ] Section 16 scenarios still pass  
