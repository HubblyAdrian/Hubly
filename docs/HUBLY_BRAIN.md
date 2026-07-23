# Hubly Brain — Milestone 1 Foundation

Hubly should never feel like software that calls AI.

Customers only ever meet one personality: **Hubly**.

Behind the scenes, Hubly Brain coordinates specialized experts, remembers the business, reasons through decisions, and returns one voice.

## Hard rule

Nothing in Hubly may call OpenAI, Anthropic, or any model provider directly.

Every AI request flows through **Hubly Brain** (`Hubly.think` / `HublyAI.complete`).

## Architecture

```
User → Hubly Brain → Experience Director · Memory · Expert Framework
                         ↓
              Research → Strategy → Creative → Critic
                         ↓
                   Hubly Brain → User
```

Experts never talk to each other. Everything routes through Hubly Brain.

## Think pipeline

1. Intent detection  
2. Load Business Memory + Workspace Memory + Business DNA  
3. Experience Director review (always on customer-facing output)  
4. Run required experts (Capability Registry drives routing)  
5. Critic review  
6. Confidence check  
7. Final Hubly response  
8. Update memories + store reasoning  

### Confidence bands

| Score | Behavior |
|------:|----------|
| 95%+ | Proceed automatically (where appropriate) |
| 80–95 | Proceed but explain |
| 60–80 | Ask one clarifying question |
| &lt;60 | Research more before acting |

## Expert Framework + AI Capability Registry

Experts register themselves. Adding an expert never requires changing the orchestrator.

Each expert declares:

- **can** — what it can do  
- **tools** — tools Brain may run on its behalf  
- **reads** — memory surfaces it may read  
- **actions** — actions it may propose  

### Initial experts

- Experience Director  
- Research Expert  
- Strategy Expert  
- Creative Director  
- Critic  

## Memory surfaces

| Surface | Purpose |
|---------|---------|
| Business Memory | Facts about the business (owner, services, goals, approvals…) |
| Workspace Memory | How the owner uses Hubly (sidebar, pins, hidden modules) |
| Conversation Memory | Turns, tone, pending tasks, summaries across sessions |
| Business DNA | Interpretive knowledge (psychology, seasonality, objections…) |
| Reasoning events | Why + confidence + expected impact for each decision |

Migrations: `supabase/migrations/20260723010000_hubly_brain_milestone1_memory.sql`

## Entry points

| Surface | Path |
|---------|------|
| Edge Brain | `supabase/functions/hubly-brain` |
| Runtime API | `Hubly.think(request)` / `Hubly.experts()` |
| Client facade | `window.Hubly.think(request, opts)` in `public/hubly.html` |
| Brain Console (internal) | `/brain-console` → `public/brain-console.html` |

## Definition of Done (Milestone 1)

- [x] Every AI interaction flows through Hubly Brain / HublyAI  
- [x] Experience Director reviews customer-facing think responses  
- [x] Experts are modular and register with the Expert Framework  
- [x] AI Capability Registry declares can / tools / reads / actions  
- [x] Business + Workspace + Conversation memory persist  
- [x] Business DNA exposes a centralized knowledge block  
- [x] Decisions store reasoning + confidence  
- [x] Internal Brain Console inspects runs  
- [x] Future experts can register without changing the orchestrator  

## Local checks

```bash
npm run milestone1
node scripts/check-section1-hubly-brain.mjs
node scripts/check-section2-experience-director.mjs
```

Tracker: `docs/MILESTONE1.md`  
Section 1 proof: `docs/HUBLY_BRAIN_SECTION1.md`  
Section 2 proof: `docs/HUBLY_BRAIN_SECTION2.md`
