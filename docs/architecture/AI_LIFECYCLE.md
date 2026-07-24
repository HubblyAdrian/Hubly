# AI Lifecycle Guide

**Version:** 1.0.0  
**Purpose:** Every stage of an AI request — from owner words to Replay.

## Lifecycle diagram

```
User Request
      ↓
Hubly Brain
      ↓
Load Memories          (Business · Workspace · Conversation Intelligence)
      ↓
Load Business DNA      (industry knowledge pack)
      ↓
Select Experts         (registry · intent · priorities)
      ↓
Execute Experts        (timeouts · retries · parallel waves where safe)
      ↓
Reasoning              (Reasoning Objects recorded)
      ↓
Decision Engine        (Proceed / Recommend / Ask / Research)
      ↓
Experience Director    (last gate · Identity · Constitution · simplicity)
      ↓
Response               (one Hubly voice)
      ↓
Memory Updates         (Brain commits only)
      ↓
Mission Control Replay (flight recorder)
```

## Stage details

### 1. User Request

Owner-facing surfaces (chat, onboarding, Business Home, Builder later) send natural language into Brain — never into a raw model client.

### 2. Hubly Brain

Entry: `Hubly.think` / `runThinkPipeline`. Brain owns orchestration. No expert is “the AI.”

### 3. Load Memories

| Memory | Loaded for |
|--------|------------|
| Business Memory | Facts about the business |
| Workspace Memory | UI / workflow preferences |
| Conversation Intelligence | Active project / threads / promises |

Isolation is mandatory — see [MEMORY_GUIDE.md](./MEMORY_GUIDE.md) and [ADR-0002](../adr/0002-memory-separation.md).

### 4. Load Business DNA

Brain loads a knowledge pack by industry/region (built-in or registered). Experts **read**; they never mutate DNA.

### 5. Select Experts

`selectExpertsFromRegistry(intent, request)` + execution priority. Experience Director is always included last (`priority` 100).

### 6. Execute Experts

Each expert runs through `runExpert` with Reliability timeouts/retries. Failures degrade gracefully; owners never see stacks.

### 7. Reasoning

Expert reasoning arrays become Reasoning Objects. “Why?” answers come from **stored** objects — not regenerated prose.

### 8. Decision Engine

Produces a Decision Object with score, action, missing info, approval needs.

### 9. Experience Director

Final customer-experience gate:

- Cap questions / widgets / settings dumps  
- Enforce Hubly Identity System + Constitution  
- Veto software-feeling complexity  

See [ADR-0005](../adr/0005-experience-director-gate.md).

### 10. Response

One Hubly voice. Builder/coaching/celebration/correction voices applied as needed.

### 11. Memory Updates

Brain commits suggested patches. Experts only suggest. See [ADR-0003](../adr/0003-experts-cannot-write-memory.md).

### 12. Mission Control Replay

`recordFlightRecorder` captures the full path for engineering Replay, Trust Score, and Quality Score.

## Invariants

1. Sole AI entry = Hubly Brain  
2. ED runs last on owner-facing output  
3. Why? from storage, not improvisation  
4. Identity/Constitution on every response  
5. Failures continue safely whenever possible  
