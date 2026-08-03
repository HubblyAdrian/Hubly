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
6. **The Understanding mechanism** (generalized from what `hubly_business_understanding.ts` does today): patch-based accumulation — arrays replace wholesale, objects shallow-merge, absence means not-yet-known, never fabricated. This merge *mechanism* is engine infrastructure, exactly once. The *schema* of what's being accumulated is context-owned — Business Understanding Schema, Customer Understanding Schema, Marketplace Understanding Schema are three named instances of the same generic mechanism, not three implementations (see Section 7). The engine doesn't know or care which schema is active; it only knows how to accept, merge, and return patches against whatever schema the context supplied.
7. **Optional adapters a context can turn on**: persistence, rate limiting, tier gating. Each exists once, as engine infrastructure — a context enables it and supplies config (thresholds, identity scoping), it doesn't reimplement the mechanism.
8. **Loop-safety bounds** — max capability-invocation rounds per turn, max history length. Engine-owned defaults; a context may request different values, but doesn't own separate logic for enforcing them.

Nothing in this list mentions a business owner, a website visitor, or a marketplace consumer. That's the point — if a sentence describing the engine needs to say "and for Concierge it also..." it's describing a context, not the engine, and belongs in Section 3 instead.

---

## 3. What a Context is

A Context is **configuration and data, not a code fork.** It answers six questions for the engine; the engine asks the same six questions regardless of which context it's running:

1. **Audience & purpose** — who is this conversation for, and what is it trying to accomplish? (Framing text fed into the system prompt — not logic, just the persona/goal the prompt is built around.)
2. **Ground-truth knowledge** — what real, already-known data should answers be grounded in, and how is it loaded? (A reference to a knowledge-loading function, not embedded logic.)
3. **Understanding schema** — what does this context accumulate, patch by patch, about whoever it's currently talking to? (A field list, in the same shape `BusinessUnderstandingPatch` already is — see Section 5. Named per context: Business Understanding Schema, Customer Understanding Schema, Marketplace Understanding Schema — see Section 7.)
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
| Understanding schema | **Business Understanding** (`BusinessUnderstandingPatch`) — what's been learned about the business (industry, services, goals, ...) | **Customer Understanding** — what's been learned about this customer and their job (selected service, vehicle/property, address, timing, preferences, ...) | **Marketplace Understanding** (`JobUnderstanding` — **this type already exists**, independently, in `marketplace_job.ts`). Its authors reached for the same word, "Understanding," for the same reason, without this document existing yet — a real signal this generalization is natural, not imposed. |
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
- **Understanding** — a patch-based accumulation of what's been learned about *whoever the AI is currently talking to*, built up turn by turn, exactly like `BusinessUnderstandingPatch` already works. What's being accumulated differs by context — the business itself (Business Understanding), a customer and their job (Customer Understanding), a marketplace consumer's job spec (Marketplace Understanding) — but the mechanism accumulating it is the same one engine-owned thing (Section 7).

Dashboard is the unusual case where Ground Truth and Understanding collapse into the same thing: the business itself is simultaneously the ground truth being described *and* the subject of the accumulating Understanding, because in this context the business isn't yet fully known — describing it and learning about it are the same act. That's specific to Dashboard, not a property of the engine — and it's why the existing `hubly_business_understanding.ts` doesn't distinguish the two: it never needed to, because in its one context so far, there was nothing to distinguish. Concierge and Marketplace make the split real: their ground truth is already fully known before the conversation starts (a business's real data; multiple providers' real catalogs), and what accumulates is Understanding about the visitor/consumer instead.

| | Ground-truth knowledge (loaded) | Understanding (accumulated) |
|---|---|---|
| Dashboard | — (none fixed in advance) | **Business Understanding**: the business itself — industry, services, goals, brand, current tools |
| Concierge | One business's real services/pricing/hours/service-area/FAQ/reviews/website content | **Customer Understanding**: what this customer needs and their job — selected service, vehicle/property, address, timing, preferences, contact info once given |
| Marketplace | Multiple providers' real catalogs | **Marketplace Understanding**: the consumer's job spec — category, service, add-ons, scope, timing, preferences — i.e. `JobUnderstanding` |

---

## 6. What capabilities each context exposes

Two enforcement points are needed, not one, because a context that only *hides* out-of-bounds capabilities in the prompt (but doesn't refuse them at dispatch) isn't actually bounded — a model can still be induced to attempt something it was never told about. Both live in the engine, parametrized by the context's allow-list:

1. **Prompt-level advertisement.** The system prompt only describes capabilities on the context's allow-list — `buildCapabilitiesPromptBlock()` already takes an explicit registry array as a parameter today, so this is close to a non-change: a context supplies a filtered list instead of the full registry.
2. **Dispatch-level enforcement.** Even if a decision arrives requesting a capability outside the allow-list (malformed output, a prompt-injection attempt from within a conversation, anything), the engine refuses it before dispatch — never relies on the prompt-level omission alone as the actual boundary.

This is what makes "Concierge can never invoke `website.analyze`" a real guarantee rather than a prompt-writing convention: the enforcement is structural (a list the engine checks), not just an absence of instruction.

Per-context allow-lists, as currently understood (from Section 4's table): Dashboard keeps the two existing owner-facing capabilities; Concierge gets the storefront/booking/CRM actions once they're built as Registry entries; Marketplace's allow-list is a genuine open question — its job (matching across providers) doesn't map cleanly onto "invoke one business's capability" the way Dashboard and Concierge do, and this document isn't resolving that, only naming it.

---

## 7. Understanding is generic; schemas plug in

This is the same insight Sections 2 and 5 already pointed at, made explicit as its own principle because it changes how every future context gets added:

**There is no "Business Understanding" and, separately, a "Customer Understanding." There is Understanding — one generic, engine-owned mechanism — and contexts plug in their own schema.** Business Understanding Schema, Customer Understanding Schema, Marketplace Understanding Schema are three schemas plugged into the same mechanism, not three features. A fourth context (a Dashboard-style customer portal, a future "manage my membership" experience, anything) means a fourth schema plugged into the same mechanism — never a new orchestration path, never a duplicated merge function.

### Entry Intent is Patch Zero, not a separate concept

A conversation doesn't always start from an empty Understanding. A customer who clicked "Premium Exterior Detail" before saying a word has already told the system `selectedService`, `serviceId`, `pricing`, `duration`, `add-ons` — that's not a different kind of input the engine needs a new concept for. It's the first patch against whichever Understanding schema is active, supplied by the entry point instead of emitted by the model. **Entry Intent = Patch Zero.** There's no separate "Entry Intent object" alongside Understanding; there's Understanding, and this is simply how it can begin non-empty.

This also means Patch Zero isn't limited to a UI click. A returning customer's *previously persisted* Understanding (once persistence exists per a context's policy — Section 2, item 7) is exactly as valid a source of Patch Zero as a service-page click. Both are "this conversation already knows something before turn one" — the mechanism doesn't care which.

### The conversation never assumes it's starting from zero or ending at a text reply

Two architectural commitments, already true today, worth naming so nothing built later accidentally violates them:

- **Never assumes zero.** Understanding can begin non-empty (Patch Zero, from a UI entry point or from persisted history) or empty (a cold Dashboard turn one) — the engine treats both the same way; it's just a starting accumulation, not a special case.
- **Never assumes the reply is the end.** The response contract's `invoke` path (Section 2, item 2) already means a turn can conclude by dispatching a capability, not just returning text — `booking.create` is not a special kind of turn ending, it's the same `invoke` shape every other capability already uses. Nothing about "Booking" needs new plumbing for the engine to transition into it rather than reply in prose.

Together these are why the architecture doesn't need to be redesigned for booking, for what comes after booking (appointment status, rescheduling, an invoice, a review request, a rebook), or for outcomes that aren't booking at all (a quote, a membership signup, a purchase, a follow-up). Each of those is either (a) a capability the engine invokes exactly like any other, or (b) content living inside whatever Understanding schema is active for that context. Neither requires the engine to know booking, or any other specific outcome, exists — that knowledge lives entirely in a context's schema and capability allow-list, never in engine code. This is what keeps "design for the complete customer journey" true without it becoming a new design task each time the journey grows.

---

## 8. Open questions this document deliberately leaves unresolved

- **Where does a context's configuration actually live** (one file per context vs. a registry of contexts, analogous to the Capability Registry)? A modeling question, not answered here — the six questions in Section 3 are settled; where the answers are stored is an extraction-time decision for the next document.
- **Marketplace's capability allow-list and session policy** — flagged, not resolved, per Section 4/6.
- **Whether Understanding needs a formal per-context schema registration mechanism**, or whether each context simply owns its own patch-type the way `BusinessUnderstandingPatch` does today, with no shared registration layer. Section 7 settles that these are all instances of one generic mechanism; whether "instances" means a literal registry (analogous to the Capability Registry) or just independently-typed schemas by convention (like `JobUnderstanding` already is) is still open.
- **Marketplace's persistence and rate-limiting gap** (real today, not part of this document — carried over from the migration plan, not re-litigated here).
- **Exactly how Patch Zero arrives on the wire** (Section 7) — as a field on the conversation request contract, pre-merged into Understanding before the first `HublyAI.chat()` call, or something else. A real implementation decision for whichever document extracts this next, not made here.

---

## 9. What this unlocks

With the engine/context boundary and the ground-truth/Understanding split both named, the next step the migration plan already anticipated — extracting `chatbot-message`'s Context Loader into one shared component — has a clear target shape to be built against: a Ground Truth loader for the Concierge context, distinct from (and not accumulated into) whatever Customer Understanding schema turns out to hold. That extraction is covered next, not in this document.

**Naming note:** the component described throughout this document as loading Ground Truth is the **Context Loader** (or "Conversation Context Loader") — not "Knowledge Assembly." The engine never touches a data source directly; it requests a Conversation Context and reasons over the four things a Context Loader returns: Ground Truth, Understanding, Capabilities, and Policies. The engine knows the *shape* of a Conversation Context, never *where* any piece of it came from — that's entirely the Context Loader's job, and is what makes "add a new experience = add a new Context Loader, never touch the engine" true in practice, not just in principle.
