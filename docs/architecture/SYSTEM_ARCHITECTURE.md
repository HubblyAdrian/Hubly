# System Architecture Guide

**Version:** 1.0.0  
**Purpose:** Definitive map of Hubly as a platform — not a single app.

## Overall system

Customers only meet **Hubly** — one calm business partner.  
Behind the scenes, **Hubly Brain** is the sole AI entry point. Nothing calls OpenAI/Anthropic/other LLMs except through Brain (`HublyAI` / `hubly_ai.ts`).

```
Owner UI / Experiences
        ↓
   Hubly Brain (sole AI gate)
        ↓
 Memories · DNA · Registries · Experts · Reasoning · Decision · Identity · ED
        ↓
   One Hubly response + memory writes + Mission Control Replay
```

### Hard boundaries

| May | Must not |
|-----|----------|
| Call Brain APIs | Call model providers directly |
| Suggest memory updates | Commit Business Memory (Brain only) |
| Read DNA / registries | Bypass Experience Director on owner-facing text |
| Register experts/modules | Hardcode expert lists into `think` |

---

## Hubly Brain

| | |
|--|--|
| **Purpose** | Orchestrate intelligence; own memory commits; sole provider gate |
| **Responsibilities** | Intent → load context → select experts → merge → decide → ED → respond → persist → flight log |
| **Inputs** | Owner request, businessId, optional memory/DNA seeds |
| **Outputs** | `response`, experts, decisions, reasoning, confidence, flight id |
| **Data flow** | `runThinkPipeline` / `think` in `hubly_brain_think.ts` |
| **Extension points** | Experts, capabilities, DNA packs, Feature Manifests — **register only** |

---

## Expert lifecycle

1. **Define** — metadata + handler (`HublyExpertDefinition`)  
2. **Register** — `registerExpert` / Platform `registerPlatformExpert`  
3. **Discover** — Brain `discoverExperts` / `selectExpertsFromRegistry`  
4. **Execute** — `runExpert` (timeout + retry via Reliability)  
5. **Merge** — Brain merges outputs; experts never call each other  
6. **Unregister** — clean removal for demos / deprecated modules  

| | |
|--|--|
| **Purpose** | Specialized intelligence behind one Hubly voice |
| **Responsibilities** | Suggest; reason; score confidence; never write memory or call models |
| **Inputs** | Request, memory, DNA, workspace, priorOutputs (via Brain) |
| **Outputs** | summary, reasoning[], confidence, structured output |
| **Data flow** | Brain selects → `runExpert` → merge → Decision / ED |
| **Extension points** | New expert = interface + register (Section 3/15) |

---

## Memory architecture

Three **separate** systems (never merge):

| System | Question it answers |
|--------|---------------------|
| Business Memory | What is true about the business? |
| Workspace Memory | How does this owner like to work? |
| Conversation Intelligence | What are we working on right now? |

| | |
|--|--|
| **Purpose** | Durable context without tribal chat logs |
| **Responsibilities** | Isolate facts / preferences / working memory; Brain-only commits |
| **Inputs** | Owner turns, expert suggestions (via Brain) |
| **Outputs** | Versioned memory snapshots for experts + Replay |
| **Data flow** | Load before experts → commit after response |
| **Extension points** | New fields via Brain APIs + MEMORY_GUIDE — never merge stores |

See [MEMORY_GUIDE.md](./MEMORY_GUIDE.md) and [ADR-0002](../adr/0002-memory-separation.md).

---

## Decision Engine

| | |
|--|--|
| **Purpose** | Multi-dimension proceed / recommend / ask / research |
| **Responsibilities** | Score decisions; require approval when needed; answer “Why?” from stored objects |
| **Inputs** | Expert outputs, confidence, business context |
| **Outputs** | Decision Object (action, score, missing info) |
| **Data flow** | After experts → Decision Object → ED → response |
| **Extension points** | New decision dimensions via Decision Engine APIs — not ad-hoc prompts |

---

## Reasoning Engine

| | |
|--|--|
| **Purpose** | Durable Reasoning Objects + Decision Graph |
| **Responsibilities** | Record why Hubly chose a path; support “Why?” / “Why didn’t you?” from **stored** objects |
| **Inputs** | Expert reasoning chains, build steps |
| **Outputs** | Reasoning Object ids, graph edges |
| **Data flow** | Expert reasoning → stored objects → Mission Control Decision Graph |
| **Extension points** | New reasoning fields declared in expert metadata |

---

## Business DNA

| | |
|--|--|
| **Purpose** | Interpretive industry knowledge (not facts) |
| **Responsibilities** | Teach Hubly how a *kind* of business works; evidence-backed claims |
| **Inputs** | Industry, region, registered packs |
| **Outputs** | Knowledge pack for experts to **read** |
| **Data flow** | Brain loads pack → experts read-only → never mutate DNA |
| **Extension points** | `registerDnaIndustryPack` — no app code for new industries |

---

## Conversation Intelligence

| | |
|--|--|
| **Purpose** | Working memory of the active engagement (not chat logs) |
| **Responsibilities** | Threads, deferred ideas, commitments, pending decisions |
| **Inputs** | Turns via Brain |
| **Outputs** | Structured CI state + retrieval answers |
| **Data flow** | Load with memories → update after response (Brain) |
| **Extension points** | Query APIs; never store raw turns as CI |

---

## Mission Control

| | |
|--|--|
| **Purpose** | AI headquarters for engineering |
| **Responsibilities** | Live activity, Replay, Trust Score, Quality Score, Platform Inventory, docs index |
| **Inputs** | Flight recorder, registries, reliability, quality |
| **Outputs** | Snapshot for Brain Console / ops |
| **Data flow** | `recordFlightRecorder` per think → `getMissionControlSnapshot` |
| **Extension points** | New surfaces added to snapshot + guide |

---

## Capability Registry & Knowledge Registry

| | |
|--|--|
| **Purpose** | Never guess — know what Hubly can do and where knowledge comes from |
| **Responsibilities** | `whoOwnsCapability`, route plans, knowledge access modes |
| **Inputs** | Registered tools / knowledge sources |
| **Outputs** | Matches, ownership, Feature Manifest inventory |
| **Data flow** | Bootstrap registries → discover → plan → execute via owners |
| **Extension points** | Register tool, knowledge, integration, workflow via Platform

---

## Module map (code)

```
supabase/functions/_shared/
  hubly_ai.ts                    ← sole provider gate + public Brain API
  hubly_brain_think.ts           ← think pipeline
  hubly_brain_expert_framework.ts
  hubly_brain_experts.ts
  hubly_brain_experience_director.ts
  hubly_brain_memory.ts
  hubly_brain_workspace_memory.ts
  hubly_brain_conversation_intelligence.ts
  hubly_brain_dna*.ts
  hubly_brain_reasoning.ts
  hubly_brain_decision.ts
  hubly_brain_registries.ts
  hubly_brain_mission_control.ts
  hubly_brain_identity_system.ts
  hubly_brain_reliability.ts
  hubly_brain_platform.ts
  hubly_brain_quality.ts
  hubly_brain_docs.ts            ← documentation index (Section 17)
```
