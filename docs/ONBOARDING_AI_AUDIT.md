# Onboarding AI Audit — Discovery Conversation

**Date:** 2026-07-24  
**Verdict (before fix):** Hardcoded / hybrid — **not** OpenAI-powered  
**Verdict (after fix):** Every Discovery turn calls `HublyAI.think` → `hubly-brain` → **OpenAI** (`task: chat`, reasoning model). Local gap tree is **fallback only**.

---

## What we found (before)

| Question | Answer |
|----------|--------|
| Is every user message sent to OpenAI? | **No** |
| Which endpoint? | None on Discovery turns. Optional unused `hubly-brain` fire during Thinking. |
| Which model? | N/A for Discovery |
| Hardcoded conversation logic? | **Yes** — `HUBLY_DISCOVERY` in `public/hubly.html` (`GAPS`, `MOMENTS`, regex `inferAll`, max 3 clarifications) |
| Predetermined question tree? | **Yes** — fixed `GAPS` map + `pickNext()` |
| Mock data? | Local industry packs for Thinking / Creative Build; Discovery typing was a fake delay |
| Silent failures? | Thinking called `HublyAI.think` with `Promise.race` vs immediate reject — UI ignored Brain |
| Frontend ↔ backend AI? | Discovery: **disconnected**. Later Instant Site build used `creative-director` → OpenAI |

### Message path (before)

`welcomeSubmit` → `startInstantSite` → `isTalkBoot` → `isDiscoveryBoot` → `isTalkSend` → **`isDiscoverySend` → `HUBLY_DISCOVERY.ingestDiscoveryTurn` (local only)**

---

## Fix (this PR)

1. **`hubly_brain_discovery_conversation.ts`** — OpenAI JSON turn via `HublyAI.complete({ task: "chat", provider: "openai" })`
2. **`think({ intent: "discovery" })`** — early Brain path; returns `discovery` payload (`source`, `provider`, `model`, facts, readyForThinking)
3. **`isDiscoverySend`** — awaits `HublyAI.think(..., { intent: "discovery", discovery: {...} })` for every owner message
4. **Boot from landing seed** — first turn is AI-driven from the seed (not `discoveryOpener` canned line)
5. Local `HUBLY_DISCOVERY.ingestDiscoveryTurn` only if Brain/OpenAI fails (logged to console)

### Expected network per message

```
POST {SUPABASE}/functions/v1/hubly-brain
  body.intent = "discovery"
  → HublyAI.complete → https://api.openai.com/v1/chat/completions
  model = GPT reasoning model (gpt-5.5 / OPENAI_REASONING_MODEL)
```

### How to verify live

1. Open DevTools → Network while onboarding  
2. Each Continue should show a `hubly-brain` request  
3. Console: `[Hubly Discovery] OpenAI turn <model> confidence=…`  
4. If you see `FALLBACK` / `OPENAI_API_KEY`, the edge secret is missing — fix Supabase `OPENAI_API_KEY` on `hubly-brain`

---

## Still local (not this PR)

- **Thinking canvas** / **Creative Build** stage scripts remain industry packs (visual choreography). Discovery Q&A is the AI conversation fix.
- Follow-up: drive Thinking explanations from Brain reasoning objects (already partially wired).
