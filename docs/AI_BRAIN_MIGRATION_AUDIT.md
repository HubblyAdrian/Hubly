# Hubly AI Capability Audit — Brain Runtime Migration

**Source of truth for AI migration.** Architecture remains frozen: do not invent new Brain layers.

**Target path (every AI interaction):**

```
Conversation → Understanding → Business Memory → Business DNA
  → Planner → Orchestrator / Runtime → Capability → Executor → Connector
    → Response
```

**Hard rule:** Product features must not call Anthropic/OpenAI directly.  
All model calls go through `HublyAI` (`supabase/functions/_shared/hubly_ai.ts`).  
Prefer Runtime capabilities over one-off edges.

**Providers in HublyAI:** OpenAI (`gpt-5.5` reasoning / `gpt-5-mini` lightweight) with Claude Haiku fallback (`claude-haiku-4-5-20251001`).

---

## AI development freeze (post-migration)

**Migration of existing surfaces onto Hubly Brain / HublyAI is complete for V1 gateways.**

Until further notice:

- **No new AI capabilities**
- **No new prompts / agents / parallel brains**
- **No direct Anthropic or OpenAI calls** outside `hubly_ai.ts`
- Deterministic surfaces stay deterministic: **Hubly Daily · Business Health · Timeline · Owner Feed**

AI reasons **after** facts exist (e.g. Health = 87 → coach advice). Health/revenue/bookings/reviews are math and records — not LLM inventions.

Craft gate: `node scripts/check-hubly-ai.mjs` (asserts zero `api.anthropic.com` outside `hubly_ai.ts`).

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
| **Website copy edge (`generate-site`)** | HublyAI `generateWebsite` (same as Website Runtime) | Thin façade — **no duplicate builder** | ✅ when `business_id` | ✅ when `business_id` | ❌ | 🟡 same generator as Runtime | 🟡 writes `businesses.gen_*` | ✅ Gateway = Website Runtime path |
| **Creative Director (live talk)** | HublyAI `creativeDirector` | Edge `creative-director` · Instant Site / editor chat | ✅ when `business_id` | ✅ when `business_id` | ❌ | ❌ (HublyAI gateway) | ❌ | ✅ Gateway + DNA when business exists |
| **Creative Director brief** | None (deterministic) | `buildCreativeDirectorBrief` after `buildBusiness` | ✅ | ✅ | ❌ | 🟡 post-run surface | ❌ | 🟡 Partial |
| **Photo analysis** | HublyAI `photoAnalysis` | Edge `analyze-photos` | ✅ write extras when `business_id` | ✅ soft patches when row exists | ❌ | ❌ (HublyAI gateway) | ❌ | ✅ Gateway + Memory/DNA enrichment |
| **Import offers / catalog AI** | HublyAI `complete` (`reason` / `photo_analysis`) | Edge `import-offers` | ✅ services merge when `business_id` | ✅ when loaded | ❌ | ❌ (HublyAI gateway) | ❌ | ✅ Gateway + Memory services |
| **Storefront chat / booking assistant** | HublyAI `customerConcierge` | Edge `chatbot-message` | ✅ | ✅ | ❌ | ❌ (HublyAI gateway) | ❌ | ✅ Gateway + Memory/DNA |
| **Draft customer message** (review / win-back / weather / chat follow-up) | HublyAI `customer_support` (OpenAI `gpt-5.5` / Claude fallback) | Edge `draft-customer-message` | ✅ when `business_id` | ✅ when `business_id` | ❌ | ❌ (HublyAI gateway; not Orchestrator) | 🟡 Resend send separate | ✅ Gateway |
| **Send customer email** | None (Resend only) | Edge `send-customer-email` | ❌ | ❌ | ❌ | ❌ | ✅ Resend | ✅ Production (non-AI) |
| **Marketplace intake** | HublyAI `customerConcierge` (+ heuristic fallback) | `_shared/marketplace_intake.ts` via `marketplace` | 🟡 customer facts in-session | ❌ | ❌ | 🟡 Customer Runtime entry | ❌ | 🟡 Partial (gateway; full Customer Memory → Profile → Planner later) |
| **Marketplace matching** | None (deterministic DNA-fit score) | `marketplace` match · `Hubly.findPro` | 🟡 customer memory | 🟡 DNA-fit | ❌ | 🟡 progress bus | ❌ | 🟡 Partial |
| **Customer Runtime (`findPro`)** | None on path (match may use prior intake) | Edge `hubly-find-pro` → `Hubly.findPro` | 🟡 customer | 🟡 DNA-fit | ❌ | 🟡 | ❌ | 🟡 Partial |
| **Hubly Daily** | None (deterministic) | Edge `hubly-daily` → `Hubly.daily` · dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ Deterministic (by design) |
| **Business Health** | None (rule score + summary) | `assessBusinessHealth` · Daily · client hire metrics | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ Deterministic math (by design) |
| **Business Timeline** | None | `buildLaunchTimeline` | 🟡 | ❌ | ❌ | 🟡 | ❌ | ✅ Deterministic (by design) |
| **Business Identity / Maturity** | None | `buildBusiness` post-steps | ✅ | ✅ | ❌ | 🟡 | ❌ | 🟡 Partial |
| **Understanding** | None (heuristics) | `Hubly.understand` / ingest | ✅ writes | 🟡 DNA patches | feeds Planner | ✅ first step | ❌ | 🟡 Partial |
| **Planner** | None (rule-based; HublyAI `planner` task unused) | `Hubly.plan` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ Production (rules) |
| **Coaching capability (Runtime)** | None (scaffold) | `runCoaching` executor | ❌ | ✅ goals | ✅ | ✅ | ❌ | 🟡 Partial |
| **AI Coach FAB (setup)** | None | Client coach checklist | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Partial (non-AI UX) |
| **Dashboard Ask AI** | HublyAI `businessCoach` | Edge `ai-advisor` · `askAI()` + ops facts (Health/Feed/jobs/CRM) | ✅ | ✅ | ❌ | ❌ (HublyAI gateway) | ❌ | ✅ Coach after facts |
| **SEO generation** | Via `generate-site` HublyAI façade (+ local templates) | Instant Site / website meta | 🟡 | 🟡 | ❌ | ❌ | ❌ | 🟡 Partial |
| **Marketing generation** | HublyAI `generateMarketing` stub | Never invoked · skill `executable:false` | — | — | — | — | — | ⬛ Dead / stub (V2) |
| **Smart Quotes** | None (rule engine) | `/smart-quote/engine.js` | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 Partial (non-AI) |
| **Social media generation** | — | — | — | — | — | — | — | ⬛ Dead (none found) |
| **CRM assistant** | Same as draft-customer-message | CRM review / win-back UI | 🟡 | 🟡 | ❌ | ❌ | 🟡 Resend | 🟡 Partial |
| **Owner Feed** | None (event aggregate) | `renderOwnerFeed` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Deterministic (by design) |
| **Timeline summaries (AI)** | — | — | — | — | — | — | — | ⬛ Dead |
| **Health explanations (LLM)** | — | Rule `summary` only; Ask AI may interpret Health numbers | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ Facts first |
| **Weekly Learning** | Foundation only | `hubly_brain_weekly_learning.ts` | — | 🟡 | — | — | — | ⬛ Stub (V2) |
| **Hubly AI status** | Via build dry path | Edge `hubly-ai-status` | ✅ | ✅ | ✅ | ✅ dry | ❌ | ✅ Production (diag) |
| **Instant Site wizards (live)** | HublyAI façades + optional dry `buildBusiness` | `public/hubly.html` Instant Site | 🟡 | 🟡 | 🟡 dry | 🟡 dry | ❌ | 🟡 Partial (gateway + dry Brain) |

---

## Direct model calls (must stay empty)

| File | Call |
|---|---|
| `supabase/functions/generate-site/index.ts` | ✅ HublyAI `generateWebsite` only |
| `supabase/functions/creative-director/index.ts` | ✅ HublyAI `creativeDirector` |
| `supabase/functions/analyze-photos/index.ts` | ✅ HublyAI `photoAnalysis` |
| `supabase/functions/import-offers/index.ts` | ✅ HublyAI `complete` |
| `supabase/functions/chatbot-message/index.ts` | ✅ HublyAI `customerConcierge` |
| `supabase/functions/draft-customer-message/index.ts` | ✅ HublyAI |
| `supabase/functions/_shared/marketplace_intake.ts` | ✅ HublyAI `customerConcierge` |
| `supabase/functions/ai-advisor/index.ts` | ✅ HublyAI `businessCoach` |

**Allowed model gateway only:** `supabase/functions/_shared/hubly_ai.ts`.

**Verify:** `rg 'api.anthropic.com' supabase/functions --glob '!**/hubly_ai.ts'` must be empty.

---

## Final AI Migration Sprint — done checklist

| # | Priority | Done when |
|---|---|---|
| **1** | Storefront chat | ✅ `chatbot-message` → HublyAI + Memory/DNA |
| **2** | Creative Director | ✅ HublyAI + DNA when client passes `business_id` |
| **3** | Photo analysis | ✅ HublyAI + Memory extras / soft DNA |
| **4** | Import offers | ✅ HublyAI + Memory services merge |
| **5** | Marketplace intake | 🟡 HublyAI gateway (Customer Memory → Profile → Planner = later, no parallel brain) |
| **6** | Website builder legacy | ✅ No duplicate builder — `generate-site` is Website Runtime `generateWebsite` façade only |
| **7** | Dashboard Ask AI | ✅ `ai-advisor` + client ops (Health/Feed/jobs/unpaid/leads/CRM) |

---

## Progress log

| Date | Change |
|---|---|
| 2026-07-22 | Audit published. Migrated `draft-customer-message` off direct Anthropic onto HublyAI + optional Memory/DNA. |
| 2026-07-22 | Migrated remaining edges onto HublyAI façades. Created `ai-advisor`. Zero `api.anthropic.com` outside `hubly_ai.ts`. |
| 2026-07-22 | Client passes `business_id` + Ask AI ops context. AI development freeze declared. Craft asserts Anthropic ban. |
| 2026-07-22 | OpenAI transport → Responses API inside `hubly_ai.ts` (adapters + `OPENAI_TRANSPORT` rollback). Not a new capability. See `docs/OPENAI_RESPONSES_MIGRATION.md`. |

---

## Related

- Constitution: `docs/HUBLY_CONSTITUTION.md`  
- V1 Finish Line: `docs/V1_FINISH_LINE.md`  
- Craft: `scripts/check-hubly-ai.mjs`  
