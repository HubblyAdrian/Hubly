# Hubly Conversation — Multi-Context Migration Plan

**Status:** Design only. No code changed. Supersedes the "which system wins" question from `docs/AI_CONCIERGE_DESIGN.md` Section 6, Item 1 — that decision is now made: **AI Concierge is not a new system. It is Hubly Conversation, given a second context.** This document is the "how," not the "if."

**Direction, as given:** one conversation engine, three contexts —
- **Hubly Dashboard** — helps the business owner (exists today: `hubly-conversation`)
- **AI Concierge** — helps the business's customer, on the business's own website
- **Marketplace** — helps a consumer choose a provider

Same engine. Same Capability Registry. Different context. No duplicated conversation logic, no duplicated AI orchestration, existing backend reused wherever possible.

> **Update:** the canonical Context model referenced throughout this plan (Parts 1 and 3 especially) is now formally defined in `docs/HUBLY_CONVERSATION_CONTEXT_MODEL.md` — read that first. It settles the engine/context boundary and the ground-truth-vs-Session-Understanding split this document's tables were already gesturing at.

---

## Part 1 — What actually exists today (three implementations, not one)

Before this task, there wasn't one conversation engine with one context — there were three separately-built systems that each independently solved a version of "have an AI conversation and do something useful with it." Direct source comparison:

| | `hubly-conversation` (Dashboard, today) | `chatbot-message` (candidate: Concierge) | `marketplace_intake` / `runMarketplaceIntake` (candidate: Marketplace) |
|---|---|---|---|
| **Audience** | Business owner (authenticated) | Anonymous website visitor | Anonymous marketplace visitor |
| **Persistence** | None — explicitly stateless, client resends full history every turn | Real: `chatbot_conversations` + `chatbot_messages`, service-role-only writer | None — client resends full history every turn (same stateless shape as Dashboard) |
| **Rate limiting** | None | Real: 30 msgs/conversation, 20 conversations/hour/business, checked before the AI call | None |
| **Tier gating** | None (concept doesn't apply) | Real: Starter = aggregate stats only; Pro = full lead capture, transcript access | None (concept doesn't apply) |
| **Response contract** | `{action, message, understanding:{patch}}` — JSON action-schema, dispatches through the Capability Registry | `{reply, topics, handoff:{type, service_id, service_name, customer_*}}` — its own bespoke shape, no Registry | `{reply, ready_to_confirm, confidence, job:{...}, need:{...}, booking:{...}, confirmation, follow_ups}` — a third, much heavier bespoke shape, no Registry |
| **Ground truth (Context Loader)** | Business Understanding patch (what's been learned about the business, accumulated from the owner) | Hand-assembled per turn from 5 scattered locations: `service_engine.ts` catalog, `meta.website.faq`, `meta.hours`, `service_area_cities` — this is exactly what the Context Loader replaces | Heuristic job-understanding engine (`marketplace_job.ts`, `marketplace_industry_knowledge.ts`) + AI, seeded but not backend-data-grounded — no per-business catalog/hours/FAQ involved, by design (it's pre-match) |
| **Capability dispatch** | Real — `findAction()` against `HUBLY_CAPABILITY_REGISTRY` | None — booking handoff is done client-side in `hubly.html` (`tryChatbotBookingHandoff`), matching against the live catalog by id/name, then just opening a UI page | None — this function only produces a structured recommendation; actual matching/booking happens elsewhere in `marketplace/index.ts` |
| **Model/task route** | `task: "chat"` (gpt-5.5, 1200 tok) | `task: "customer_support"` (gpt-5.5, 1536 tok) | `task: "customer_concierge"` (gpt-5.5, 1400 tok), with a full non-AI heuristic fallback path when no provider is configured |
| **Honesty discipline** | Explicit rule in the system prompt ("never imply analysis happened unless it did") | Explicit rule in the system prompt ("never invent a service, price, hours... the SERVICE list is the source of truth") — independently written, same spirit, different words | Implicit only — no equivalent stated rule found |

**Reading this table straight:** `chatbot-message` is architecturally the closest of the two candidates to what Hubly Conversation already does — same "one JSON response, structured fields, honesty-first" shape, just without persistence/rate-limiting or Registry dispatch. `marketplace_intake` is a much bigger structural departure — a bespoke state machine (job/need/booking/confirmation) with its own heuristic fallback engine, built for a fundamentally different job (build a structured job spec to match against multiple providers, not answer questions about one already-known business). That difference drives the sequencing recommendation in Part 4.

---

## Part 2 — The four production features, and what they become

### 1. Conversation persistence
**Today:** `chatbot_conversations` (`id, business_id, started_at, ended_at, customer_name, customer_phone, customer_email, consented_to_followup, resulted_in_booking, topics`) + `chatbot_messages` (`id, conversation_id, role, content, created_at`). Real tables, RLS locked down (no public policy at all — the edge function, using the service-role key, is the only writer; owner reads go through two security-definer RPCs that tier-gate and redact).

**Becomes:** an optional persistence layer on Hubly Conversation's request/response contract, not a new table design from scratch — this schema is already good (real ownership boundary, real tier-aware redaction) and should be reused, generalized only enough to stop being chatbot-specific (e.g. `role in ('customer','assistant')` → align with Hubly Conversation's existing `'user'|'assistant'` roles).

**The thing to name plainly:** Hubly Conversation is *deliberately* stateless today — its own header comment says so, and that was a considered architectural choice, not an oversight. Making it persistence-capable is a real extension to a piece that was previously declared frozen. It should be additive and opt-in per context (Dashboard keeps behaving exactly as it does today — no persistence, nothing changes for it) rather than a blanket change to the contract. Flagging this explicitly rather than treating it as implied — see Part 5.

### 2. Rate limiting
**Today:** two checks inside `chatbot-message`, before the AI call so a rejection never spends a token — `MAX_MESSAGES_PER_CONVERSATION = 30`, `MAX_CONVERSATIONS_PER_HOUR = 20` (per business).

**Becomes:** a small, standalone, reusable check (its own module, not copy-pasted) — takes a context + business/conversation identity, returns allow/deny before the orchestration loop runs. Applies to any anonymous/public-facing context (Concierge, Marketplace); not needed for Dashboard (authenticated owner, not public traffic). Config'd per context, not hardcoded per file — this is genuinely a clean extraction, no design tension.

### 3. Lead capture
**Today:** consent-gated, tier-aware, inline in `chatbot-message` — only on Pro tier, only after the model asks and the customer explicitly answers, written directly onto the `chatbot_conversations` row (never into the real `customers` table — see `AI_CONCIERGE_DESIGN.md` Section 6, Item 5, which already flagged that AI-driven CRM writes don't exist anywhere in the codebase today).

**Becomes:** this is the clearest case of "the missing backend and the reusable feature are the same thing." Generalizing lead capture properly means turning it into a real Capability Registry action (e.g. `crm.captureLead`) that Concierge (and eventually Marketplace) invoke through the same dispatch path Hubly Conversation already uses for `website.analyze` — rather than porting chatbot-message's inline-write pattern as-is. This directly depends on the still-open gap from the prior design doc (no AI-driven write path to `customers` exists) and should be built once, as a Registry action, not twice.

### 4. Booking handoff
**Today:** two halves. (a) *Classification* — the model decides, as structured output, that this turn means "the customer wants to book X" (`handoff.type === "book_service"`, with `service_id`/`service_name`). (b) *Execution* — entirely client-side, in `hubly.html`: `tryChatbotBookingHandoff()` matches the handoff against the live service catalog by id-then-name, and either opens the booking page pre-filled or falls back to a generic booking flow if no exact match.

**Becomes:** the classification half maps directly onto Hubly Conversation's existing `{"action":"invoke", "capability":..., "capabilityAction":...}` pattern — "the model decided to invoke a capability" is already exactly what a booking decision is, once `booking.create`/`booking.getAvailability` exist as Registry actions (Part 3 of the prior design doc, Section 6 Item 2). The execution half — opening a UI page, pre-filling a form — is presentation-layer and stays context-specific; it was never conversation logic to begin with, so there's nothing to migrate there, just something to keep doing per-context after the Registry does the matching/dispatch instead of ad hoc client-side catalog lookup.

---

## Part 3 — Per-context differences (what "context" actually parametrizes)

| | Dashboard | Concierge | Marketplace |
|---|---|---|---|
| Who the model is helping | Business owner | Business's own customer | A consumer comparing providers |
| Persistence needed | No (keep stateless) | Yes | Open question — not needed today (current `marketplace_intake` is stateless), but worth revisiting once matched against real usage patterns; not deciding here |
| Rate limiting needed | No | Yes | Yes (currently absent — a real gap if this becomes public-facing through the same path) |
| Tier gating | N/A | Yes (Starter/Pro) | N/A today |
| Knowledge grounding | Business Understanding (what's been learned about the business from its owner) | The business's real, already-known data (services, hours, FAQ, area, reviews) as ground truth | Multiple providers' catalogs + a job-understanding model of what the consumer needs — structurally different from "ground truth about one business" |
| Capability subset exposed | `website.analyze`, `online_presence.analyze_*` (owner-facing analysis) | `storefront.getServices`, `booking.getAvailability`, `booking.create`, `crm.captureLead` (once built) | Matching/ranking-oriented — not yet mapped to Registry actions at all |

Dashboard and Concierge line up cleanly under one context-parametrized `buildSystemPrompt()` + orchestration loop. Marketplace is the outlier — its job (build a structured spec, then match across many providers) isn't just "the same prompt with different data," it's a different kind of task. That's reflected in the sequencing below, not glossed over.

---

## Part 4 — Migration steps (sequenced; each step needs approval before being built — nothing here is authorized by this document alone)

1. **Extract the Context Loader.** `chatbot-message` currently hand-builds its context from five scattered locations every turn. Pull that into one `_shared` Context Loader — the component that returns a Conversation Context (Ground Truth, Session Understanding, Capabilities, Policies) to the engine, so the engine itself never touches a data source directly. Used by `chatbot-message` during the transition *and* by the future Concierge context — this was already recommended in the prior design doc (Section 1) independent of this migration, and is now clearly a shared, no-regrets first step.
2. **Add an optional persistence adapter to Hubly Conversation's contract.** Context config says whether to persist; when it does, write through a generalized version of the `chatbot_conversations`/`chatbot_messages` schema (Part 2.1); when it doesn't (Dashboard), the contract is byte-for-byte what it is today. Needs explicit confirmation that extending the previously-frozen stateless contract is in scope now (see Part 5) — not assumed here.
3. **Add the rate-limit module**, config'd per context, applied to Concierge (and Marketplace, once it's public-facing through this path).
4. **Add the Capability Registry entries this whole plan depends on**: `storefront.getServices`, `booking.getAvailability`, `booking.create`, `crm.captureLead` — each wrapping already-real backend (`service_engine.ts`, `marketplace_availability.ts`, `marketplace`'s `booking_create`) rather than new business logic. (Same items as `AI_CONCIERGE_DESIGN.md` Section 6, Items 2 and 5 — this plan doesn't re-litigate them, just depends on them.)
5. **Parametrize `buildSystemPrompt()` and the orchestration loop by context** (`dashboard` | `concierge` | `marketplace`, extensible), each context supplying its own persona framing, knowledge source, and capability subset — through the one existing call shape (`buildSystemPrompt(context) → HublyAI.chat(...) → parse decision → dispatch via Registry → {reply, actions, interimMessages}`), not three files.
6. **Concierge cutover.** Once steps 1-5 exist, point the floating chat bubble (and, separately, whatever builds the Hero AI bar — UI, out of scope here) at the Concierge context instead of `chatbot-message`. Keep `chatbot-message` running, unmodified, until Concierge is verified at real parity (rate limiting, lead capture, booking handoff, tier gating all behaving the same or better) — do not delete it preemptively, same principle already applied to the frozen Legacy Brain.
7. **Marketplace is a separate, later decision — not part of this migration's first cut.** `marketplace_intake`'s heuristic job-understanding engine (`marketplace_job.ts`, `marketplace_industry_knowledge.ts`, `marketplace_booking_state.ts`) is real, valuable, industry-specific reasoning that doesn't collapse into "just a different system prompt" the way Concierge does. Recommend treating "how Marketplace becomes a context" as its own follow-up design pass once Concierge has proven the pattern — sequencing one real migration at a time, not three simultaneously.

---

## Part 5 — What this plan is explicitly not deciding, and needs confirmation on

1. **Extending Hubly Conversation from stateless to optionally-persistent is a real change to a previously-frozen contract.** The direction given ("AI Concierge is another context that uses the Hubly Conversation architecture") implies this is now in scope, but I'm naming it plainly rather than treating it as automatically authorized by this task: Dashboard's stateless behavior must not change, and the persistence adapter must be additive, not a rewrite of the existing contract.
2. **The chat widget's conversation id is memory-only today** (`S.chatbot.conversationId`, set at `public/hubly.html:16023`, never written to any client-side storage) — it doesn't survive a page reload today, let alone unify two entry points. Whatever replaces it needs real client-side persistence (e.g. `localStorage`, scoped per business site) regardless of which backend path is chosen. This is UI/client work, out of scope to build here, but it's a real prerequisite for the "one conversation, two entry points" requirement from the prior design doc's Section 4 — not something that falls out for free once the backend is unified.
3. **Marketplace's sequencing** (Part 4, Step 7) is a recommendation, not a decision — flagging it as its own future stop-and-report point rather than bundling it into this migration.
4. **Nothing in Parts 2-4 is authorized for implementation by this document.** Per Rule 6, each numbered step in Part 4 should get its own explicit go-ahead — this plan exists so that go-ahead can be given step by step, not as a single bundled yes.
