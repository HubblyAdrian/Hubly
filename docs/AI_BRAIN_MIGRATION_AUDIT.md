# Hubly AI Capability Audit — Brain Runtime Migration

**Source of truth for AI migration.** Architecture remains frozen: do not invent new Brain layers.

**Target path (every AI interaction):**

```
Conversation → Understanding → Business Memory → Business DNA
  → Planner → Orchestrator / Runtime → Capability → Executor → Connector
```

**Hard rule:** Product features must not call Anthropic/OpenAI directly.  
All model calls go through `HublyAI` (`supabase/functions/_shared/hubly_ai.ts`).  
Prefer Runtime capabilities over one-off edges.

**Providers in HublyAI:** OpenAI (`gpt-5.5` reasoning / `gpt-5-mini` lightweight) with Claude Haiku fallback (`claude-haiku-4-5-20251001`).

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ Production | Live on Brain Runtime path (or HublyAI + Memory/DNA as documented) |
| 🟡 Partial | Uses some Brain surfaces (Memory/DNA/Daily/Health) but no full Runtime model path, or deterministic “AI” surface |
| ❌ Legacy | Direct model call outside HublyAI / Brain Runtime |
| ⬛ Dead / stub | UI or API exists; edge missing, skill `executable:false`, or never invoked |

---

## Capability table

| Feature | Model / provider | Entry point | Memory | DNA | Planner | Runtime | Connectors | Status |
|---|---|---|---|---|---|---|---|---|
| **Business Build** | OpenAI `gpt-5.5` (website task) via HublyAI; Claude fallback | Edge `hubly-build-business` → `Hubly.buildBusiness` · client `HublyAI.buildBusiness` | ✅ | ✅ | ✅ | ✅ | 🟡 Domain/Payments/Calendar providers when configured | ✅ Production |
| **Website Runtime (executor)** | HublyAI `generateWebsite` | `runWebsite` in `hubly_brain_executors.ts` | ✅ | ✅ | ✅ (planned step) | ✅ | ❌ (DB publish) | ✅ Production |
| **Website Builder (legacy)** | Claude Haiku direct | Edge `generate-site` · Instant Site / editor invoke | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Creative Director (live talk)** | Claude Haiku direct | Edge `creative-director` · Instant Site / editor Claude chat | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Creative Director brief** | None (deterministic) | `buildCreativeDirectorBrief` after `buildBusiness` | ✅ | ✅ | ❌ | 🟡 post-run surface | ❌ | 🟡 Partial |
| **Photo analysis** | Claude Haiku direct | Edge `analyze-photos` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Import offers / catalog AI** | Claude Haiku direct | Edge `import-offers` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Storefront chat / booking assistant** | Claude Haiku direct | Edge `chatbot-message` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Draft customer message** (review / win-back / weather / chat follow-up) | HublyAI `customer_support` (OpenAI `gpt-5.5` / Claude fallback) | Edge `draft-customer-message` | ✅ when `business_id` | ✅ when `business_id` | ❌ | ❌ (HublyAI gateway; not Orchestrator) | 🟡 Resend send separate | 🟡 Partial (gateway migrated) |
| **Send customer email** | None (Resend only) | Edge `send-customer-email` | ❌ | ❌ | ❌ | ❌ | ✅ Resend | ✅ Production (non-AI) |
| **Marketplace intake** | Claude Haiku direct (+ heuristic fallback) | `_shared/marketplace_intake.ts` via `marketplace` | ❌ (customer facts) | ❌ | ❌ | ❌ | ❌ | ❌ Legacy |
| **Marketplace matching** | None (deterministic DNA-fit score) | `marketplace` match · `Hubly.findPro` | 🟡 customer memory | 🟡 DNA-fit | ❌ | 🟡 progress bus | ❌ | 🟡 Partial |
| **Customer Runtime (`findPro`)** | None on path (match may use prior intake) | Edge `hubly-find-pro` → `Hubly.findPro` | 🟡 customer | 🟡 DNA-fit | ❌ | 🟡 | ❌ | 🟡 Partial |
| **Hubly Daily** | None (deterministic) | Edge `hubly-daily` → `Hubly.daily` · dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | 🟡 Partial |
| **Business Health** | None (rule score + summary) | `assessBusinessHealth` · Daily | ✅ | ✅ | ❌ | ❌ | ❌ | 🟡 Partial |
| **Business Timeline** | None | `buildLaunchTimeline` | 🟡 | ❌ | ❌ | 🟡 | ❌ | 🟡 Partial |
| **Business Identity / Maturity** | None | `buildBusiness` post-steps | ✅ | ✅ | ❌ | 🟡 | ❌ | 🟡 Partial |
| **Understanding** | None (heuristics) | `Hubly.understand` / ingest | ✅ writes | 🟡 DNA patches | feeds Planner | ✅ first step | ❌ | 🟡 Partial |
| **Planner** | None (rule-based; HublyAI `planner` task unused) | `Hubly.plan` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ Production (rules) |
| **Coaching capability (Runtime)** | None (scaffold) | `runCoaching` executor | ❌ | ✅ goals | ✅ | ✅ | ❌ | 🟡 Partial |
| **AI Coach FAB (setup)** | None | Client coach checklist | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Partial (non-AI UX) |
| **Dashboard Ask AI** | — | `askAI()` → `ai-advisor` | — | — | — | — | — | ⬛ Dead (edge missing) |
| **SEO generation** | Via legacy `generate-site` (+ local templates) | Instant Site / website meta | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ Legacy / 🟡 templates |
| **Marketing generation** | HublyAI `generateMarketing` stub | Never invoked · skill `executable:false` | — | — | — | — | — | ⬛ Dead / stub |
| **Smart Quotes** | None (rule engine) | `/smart-quote/engine.js` | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Partial (non-AI) |
| **Social media generation** | — | — | — | — | — | — | — | ⬛ Dead (none found) |
| **CRM assistant** | Same as draft-customer-message | CRM review / win-back UI | 🟡 | 🟡 | ❌ | ❌ | 🟡 Resend | 🟡 Partial |
| **Owner Feed** | None (event aggregate) | `renderOwnerFeed` | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Partial (non-AI) |
| **Timeline summaries (AI)** | — | — | — | — | — | — | — | ⬛ Dead |
| **Health explanations (LLM)** | — | Rule `summary` only | ✅ | ✅ | ❌ | ❌ | ❌ | 🟡 Partial |
| **Weekly Learning** | Foundation only | `hubly_brain_weekly_learning.ts` | — | 🟡 | — | — | — | ⬛ Stub (V2) |
| **Hubly AI status** | Via build dry path | Edge `hubly-ai-status` | ✅ | ✅ | ✅ | ✅ dry | ❌ | ✅ Production (diag) |
| **Instant Site wizards (live)** | Claude edges + optional dry `buildBusiness` | `public/hubly.html` Instant Site | 🟡 dry | 🟡 dry | 🟡 dry | 🟡 dry | ❌ | ❌ Legacy + 🟡 dry Brain |

---

## Direct model calls (must die)

| File | Call |
|---|---|
| `supabase/functions/generate-site/index.ts` | Anthropic messages |
| `supabase/functions/creative-director/index.ts` | Anthropic messages |
| `supabase/functions/analyze-photos/index.ts` | Anthropic messages |
| `supabase/functions/import-offers/index.ts` | Anthropic messages |
| `supabase/functions/chatbot-message/index.ts` | Anthropic messages |
| `supabase/functions/draft-customer-message/index.ts` | ✅ Migrated to HublyAI (2026-07-22) |
| `supabase/functions/_shared/marketplace_intake.ts` | Anthropic messages |

**Allowed model gateway only:** `supabase/functions/_shared/hubly_ai.ts` (used by Website Runtime executor today).

---

## Migration plan (one by one)

Order prioritizes **First Customer / V1 Finish Line** revenue loop, then Instant Site parity, then marketplace, then V2 stubs.

| # | Feature | Move to | Done when |
|---|---|---|---|
| **1** | Draft customer message | HublyAI `customer_support` + Memory/DNA voice; keep edge as thin Runtime façade | ✅ Done — no Anthropic in edge; Memory/DNA when `business_id` |
| **2** | Storefront chat (`chatbot-message`) | HublyAI `customer_concierge` + Business Memory/DNA; later Customer Runtime | Booking chat never calls Anthropic directly |
| **3** | Website Builder (`generate-site`) | Delete/redirect to Website Runtime (`Hubly.buildBusiness` / `runWebsite`) | Instant Site copy comes from Brain website capability only |
| **4** | Creative Director talk | HublyAI `creative_director` + DNA; wire to `buildCreativeDirectorBrief` context | Editor talk uses HublyAI, not raw Claude |
| **5** | Photo analysis | HublyAI `photo_analysis` + Memory write via executor | Skill `analyzePhotos` executable through Runtime |
| **6** | Import offers | HublyAI lightweight/catalog path → Memory services | No direct Anthropic; services land in Memory |
| **7** | Marketplace intake | Customer Runtime understanding via HublyAI (customer memory/profile) | Intake not a parallel brain |
| **8** | Dashboard Ask AI | Remove dead `ai-advisor` **or** implement as HublyAI coach through Memory/DNA | No orphan invoke |
| **9** | Coaching / Daily LLM (optional) | Only if V1 needs it — prefer deterministic Daily until First Customer proven | Do not expand AI surface pre-beta |
| **10** | Marketing / social / weekly learning | **V2 only** — keep stubs `executable:false` | Explicitly out of V1 |

### Definition of migrated

A feature is ✅ Brain-migrated when:

1. Zero direct Anthropic/OpenAI fetches outside `hubly_ai.ts`  
2. Calls go through HublyAI (gateway) **and**, for business-changing work, through Planner → Orchestrator → Capability  
3. Memory (facts) and DNA (identity) injected separately — never combined  
4. Side effects (email, calendar, payments, publish) use Connectors / providers — never simulated  

---

## Progress log

| Date | Change |
|---|---|
| 2026-07-22 | Audit published. Migrated `draft-customer-message` off direct Anthropic onto HublyAI + optional Memory/DNA. |

---

## Related

- Constitution: `docs/HUBLY_CONSTITUTION.md`  
- V1 Finish Line: `docs/V1_FINISH_LINE.md` (AI expansion still frozen for product scope; this doc is **capability migration**, not new AI products)  
- Craft: extend `scripts/check-hubly-ai.mjs` as each edge loses direct model calls  
