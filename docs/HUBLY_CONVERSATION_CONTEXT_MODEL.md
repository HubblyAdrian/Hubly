# Hubly Conversation — The Context Model

**Status:** Design only. No code. This document defines the canonical model that `docs/HUBLY_CONVERSATION_MULTI_CONTEXT_MIGRATION.md`'s extraction steps will be built against. Nothing gets extracted until this model is agreed.

---

## 1. What a Hubly Conversation is

A Hubly Conversation is one thing, done the same way every time: **one LLM call per turn, using a JSON action-schema, that helps someone accomplish something by grounding its answers in real data and, when appropriate, invoking exactly one real capability.**

It is Hubly's one reasoning engine — the single place in the entire platform where free text becomes structured intent and action. This isn't new framing; it's the same principle already locked for the Planner ("one reasoning engine in the platform, everything after that is deterministic"), extended to cover the conversation layer itself: there is one place an LLM decides what to do, and everything downstream of that decision — dispatch, persistence, rate limiting, the Context Loader — is deterministic code, not a second model making a second judgment call.

Today, "Hubly Conversation" and "the Dashboard experience" are the same thing, because only one context exists. That's the conflation this document undoes: **Hubly Conversation is the engine. Dashboard is one context it runs in.**

---

## 2. What belongs to the conversation engine

The engine is everything that must exist exactly once, work identically regardless of who's talking to it, and never be reimplemented per surface. If a piece of logic would need to be copy-pasted (with small variations) to add a new context, it belongs here instead — that's the test.

1. **The orchestration loop.** Receive a turn → build the system prompt → call `HublyAI` → parse the JSON decision → if it's an `invoke`, dispatch through the Capability Registry and report exactly what happened → collect the reply → return it. One loop, one implementation.
2. **The response contract's core shape.** The `reply` / `invoke` duality, `actions`, `interimMessages`. This is the fixed vocabulary every context's model output is parsed against.
3. **The honesty rule, as a structural norm.** "Never imply something happened unless it genuinely did" isn't a Dashboard-specific instruction that Concierge happens to also have (recall: `chatbot-message`'s system prompt independently arrived at almost the same rule, in different words — see Section 4). It's an engine-level invariant every context's prompt inherits, not something each context re-authors from scratch.
4. **The LLM gateway and task routing** (`hubly_ai.ts`) — model selection, `TASK_ROUTES`, the provider call itself.
5. **Capability Registry dispatch**, including enforcement of which capabilities a given context is even allowed to reach (Section 6) — the *mechanism* of finding and invoking a capability, and of refusing one that's out of bounds, is one implementation the engine owns; which capabilities are in bounds is context data, not engine logic.
6. **The Session Understanding mechanism** (generalized from what `hubly_business_understanding.ts` does today): patch-based accumulation — arrays replace wholesale, objects shallow-merge, absence means not-yet-known, never fabricated. This merge *mechanism* is engine infrastructure. The *schema* of what's being accumulated is context-owned (Section 4).
7. **Optional adapters a context can turn on**: persistence, rate limiting, tier gating. Each exists once, as engine infrastructure — a context enables it and supplies config (thresholds, identity scoping), it doesn't reimplement the mechanism.
8. **Loop-safety bounds** — max capability-invocation rounds per turn, max history length. Engine-owned defaults; a context may request different values, but doesn't own separate logic for enforcing them.

Nothing in this list mentions a business owner, a website visitor, or a marketplace consumer. That's the point — if a sentence describing the engine needs to say "and for Concierge it also..." it's describing a context, not the engine, and belongs in Section 3 instead.

---

## 3. What a Context is

A Context is **configuration and data, not a code fork.** It answers six questions for the engine; the engine asks the same six questions regardless of which context it's running:

1. **Audience & purpose** — who is this conversation for, and what is it trying to accomplish? (Framing text fed into the system prompt — not logic, just the persona/goal the prompt is built around.)
2. **Ground-truth knowledge** — what real, already-known data should answers be grounded in, and how is it loaded? (A reference to a knowledge-loading function, not embedded logic.)
3. **Session Understanding schema** — what does this context accumulate, patch by patch, about whoever it's currently talking to? (A field list, in the same shape `BusinessUnderstandingPatch` already is — see Section 5.)
4. **Capability allow-list** — which Capability Registry actions can this context's model advertise and invoke? (A list of names, checked by the engine at both prompt-build time and dispatch time — see Section 6.)
5. **Session policy** — is persistence on, and under what identity scope? Is rate limiting on, and at what thresholds? Does tier gating apply, and how?
6. **Loop-safety overrides**, if any — otherwise the engine's defaults apply.

A new context (a fourth surface, a fifth) means answering these six questions once. It does not mean a new orchestration loop, a new response parser, a new Capability Registry, or a new honesty rule.

---

## 4. How Dashboard, Website, and Marketplace differ only by context

| | Dashboard (today's `hubly-conversation`) | Website / AI Concierge | Marketplace |
|---|---|---|---|
| Audience & purpose | Business owner, figuring out and describing their own business | The business's own customer, deciding whether to book | A consumer, deciding which provider to choose |
| Ground-truth knowledge | None fixed in advance — the business itself is what's being discovered | The business's real, already-known data: services, pricing, hours, service area, FAQ, reviews, website content | Multiple providers' catalogs — a different shape of "already known," spanning more than one business |
| Session Understanding schema | `BusinessUnderstandingPatch` — what's been learned about the business (industry, services, goals, ...) | A visitor-need schema — what's been learned about what this visitor is looking for | `JobUnderstanding` — **this type already exists**, independently, in `marketplace_job.ts`. Its authors reached for the same word, "Understanding," for the same reason, without this document existing yet. That's a real signal this generalization is natural, not imposed. |
| Capability allow-list | `website.analyze`, `online_presence.analyze_*` | `storefront.getServices`, `booking.getAvailability`, `booking.create`, `crm.captureLead` (per the migration plan — none of these exist as Registry entries yet) | Matching/ranking-oriented actions — not yet mapped to the Registry at all; a real open question, not resolved here |
| Session policy | No persistence, no rate limit, no tier gating (none of these needed — authenticated owner, not public traffic) | Persistence on (visitor conversations matter, need to survive across the bar/bubble), rate limiting on (public, anonymous traffic), tier gating on (Starter/Pro) | Rate limiting arguably should be on today and isn't (`marketplace_intake` has none) — flagged as a real gap in the migration plan, not decided here |

**A finding worth stating plainly:** once capabilities are properly registered, almost everything that looked like "this context needs its own response shape" dissolves.

`chatbot-message`'s `handoff.type === "book_service"` looks, on its surface, like a context-specific field the core contract would need to grow a new branch for. It isn't — it's an `invoke` decision (`{"action":"invoke","capability":"booking","capabilityAction":"create",...}`) wearing different clothes, because `chatbot-message` predates the Capability Registry and had nowhere else to put that decision. Once `booking.create` exists as a Registry entry, this collapses into the same shape Hubly Conversation already uses for `website.analyze` — no new contract field needed.

Marketplace's richer structured output (`job`, `need`, `booking`, `confirmation` — used to drive its "Building Your Booking" panel) looks like a stronger case for a genuinely different shape. But it's the same pattern as Concierge's "What I've Learned" panel: a UI rendering derived from an accumulated Understanding patch (`JobUnderstanding`, in this case), not a parallel concept that needs its own contract. The panel renders the patch; it doesn't need the engine to speak a different language to produce it.

**Net: the core response contract (Section 2, item 2) doesn't need to grow per context.** What differs is entirely captured by the six Context questions in Section 3 — which is the result this document set out to check, not assume.

---

## 5. What knowledge each context loads

Two genuinely different kinds of "knowledge" have been getting conflated under one name (`understanding`) so far, and separating them is most of what makes this model work:

- **Ground-truth knowledge** — real, already-known data, loaded fresh each session, never accumulated turn by turn. A business's services/hours/FAQ don't change because a visitor asked about them; they're read, not learned.
- **Session Understanding** — a patch-based accumulation of what's been learned about *whoever the AI is currently talking to*, built up turn by turn, exactly like `BusinessUnderstandingPatch` already works.

Dashboard is the unusual case where these collapse into the same thing: the business itself is simultaneously the ground truth being described *and* the subject of the accumulating Understanding, because in this context the business isn't yet fully known — describing it and learning about it are the same act. That's specific to Dashboard, not a property of the engine — and it's why the existing `hubly_business_understanding.ts` doesn't distinguish the two: it never needed to, because in its one context so far, there was nothing to distinguish. Concierge and Marketplace make the split real: their ground truth is already fully known before the conversation starts (a business's real data; multiple providers' real catalogs), and what accumulates is knowledge about the visitor/consumer instead.

| | Ground-truth knowledge (loaded) | Session Understanding (accumulated) |
|---|---|---|
| Dashboard | — (none fixed in advance) | The business itself: industry, services, goals, brand, current tools |
| Concierge | One business's real services/pricing/hours/service-area/FAQ/reviews/website content | What this visitor needs: which service, timing, any preferences, contact info once given |
| Marketplace | Multiple providers' real catalogs | The consumer's job spec: category, service, add-ons, scope, timing, preferences — i.e. `JobUnderstanding` |

---

## 6. What capabilities each context exposes

Two enforcement points are needed, not one, because a context that only *hides* out-of-bounds capabilities in the prompt (but doesn't refuse them at dispatch) isn't actually bounded — a model can still be induced to attempt something it was never told about. Both live in the engine, parametrized by the context's allow-list:

1. **Prompt-level advertisement.** The system prompt only describes capabilities on the context's allow-list — `buildCapabilitiesPromptBlock()` already takes an explicit registry array as a parameter today, so this is close to a non-change: a context supplies a filtered list instead of the full registry.
2. **Dispatch-level enforcement.** Even if a decision arrives requesting a capability outside the allow-list (malformed output, a prompt-injection attempt from within a conversation, anything), the engine refuses it before dispatch — never relies on the prompt-level omission alone as the actual boundary.

This is what makes "Concierge can never invoke `website.analyze`" a real guarantee rather than a prompt-writing convention: the enforcement is structural (a list the engine checks), not just an absence of instruction.

Per-context allow-lists, as currently understood (from Section 4's table): Dashboard keeps the two existing owner-facing capabilities; Concierge gets the storefront/booking/CRM actions once they're built as Registry entries; Marketplace's allow-list is a genuine open question — its job (matching across providers) doesn't map cleanly onto "invoke one business's capability" the way Dashboard and Concierge do, and this document isn't resolving that, only naming it.

---

## 7. Open questions this document deliberately leaves unresolved

- **Where does a context's configuration actually live** (one file per context vs. a registry of contexts, analogous to the Capability Registry)? A modeling question, not answered here — the six questions in Section 3 are settled; where the answers are stored is an extraction-time decision for the next document.
- **Marketplace's capability allow-list and session policy** — flagged, not resolved, per Section 4/6.
- **Whether Session Understanding needs a formal per-context schema registration mechanism**, or whether each context simply owns its own patch-type the way `BusinessUnderstandingPatch` does today, with no shared registration layer. Leaning toward the latter (simpler, and consistent with `JobUnderstanding` already existing independently) but not deciding it here.
- **Marketplace's persistence and rate-limiting gap** (real today, not part of this document — carried over from the migration plan, not re-litigated here).

---

## 8. What this unlocks

With the engine/context boundary and the ground-truth/Understanding split both named, the next step the migration plan already anticipated — extracting `chatbot-message`'s Context Loader into one shared component — has a clear target shape to be built against: a Ground Truth loader for the Concierge context, distinct from (and not accumulated into) whatever Concierge's Session Understanding schema turns out to be. That extraction is covered next, not in this document.

**Naming note:** the component described throughout this document as loading Ground Truth is the **Context Loader** (or "Conversation Context Loader") — not "Knowledge Assembly." The engine never touches a data source directly; it requests a Conversation Context and reasons over the four things a Context Loader returns: Ground Truth, Session Understanding, Capabilities, and Policies. The engine knows the *shape* of a Conversation Context, never *where* any piece of it came from — that's entirely the Context Loader's job, and is what makes "add a new experience = add a new Context Loader, never touch the engine" true in practice, not just in principle.
