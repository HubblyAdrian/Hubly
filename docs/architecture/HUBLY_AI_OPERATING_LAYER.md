# Hubly AI Operating Layer — Intent Router Specification

**Status:** proposed · awaiting approval · **no code written**

> **Today:** UI surface → context → allowlist → AI
> **Target:** user request → intent router → capability set → *the existing capabilities*

This is a **conductor**, not a new orchestra. Every engine referenced below already
exists. The router changes only *selection*: which capabilities are permitted and
sequenced for a turn. It never executes.

---

## 0. Principles this spec is accountable to

1. **The user's words are the authority.** The open tab is a prior, never a decision.
2. **Build-first.** If Hubly can act, it acts. A question is a failure state, not a step.
3. **At most one question per turn**, and it must name the requirement it unblocks.
4. **Decision and execution stay separate.** The router returns a plan; the executor runs it.
5. **Business identity before inspiration**, always (see `hubly_business_dna.ts`).
6. **Nothing is hidden.** A capability a business could have is *offered*, not removed.
7. **The registry is the source of truth** — for the router, the executor, and the landing page.

---

## A. Router input schema

```ts
type RouterInput = {
  utterance: string;
  history: Turn[];                    // trimmed; the router sees the same thread the user does
  actor: Actor;
  business: BusinessContext | null;   // null only before a draft exists
  surfaceHint?: SurfaceId | null;     // 'store' | 'website' | 'sessions' | 'calendar' | 'landing' | null
  intentSeed?: IntentId | null;       // landing-page capability prompt click (§J)
};

type Actor =
  | { kind: 'anonymous'; draftToken?: string }
  | { kind: 'owner'; userId: string }
  | { kind: 'customer'; businessId: string };

type BusinessContext = {
  id: string;
  draftToken?: string;                 // anonymous draft (businesses.draft_token)
  identity: { name: string|null; businessType: string|null; accent: string|null; city: string|null };
  dna: BusinessDna | null;             // _shared/hubly_business_dna.ts — null means UNKNOWN, never a default
  entitlements: { tier: 'starter'|'pro'; capabilities: Record<string, boolean> };  // businesses.tier / .capabilities
  state: BusinessState;                // what actually EXISTS today
};

/** Cheap, cached once per turn. This is what makes build-first possible:
 *  the router asks the database, not the owner. */
type BusinessState = {
  hasWebsiteDocument: boolean;   hasStorefrontAst: boolean;
  serviceCount: number;          productCount: number;
  photoCount: number;            hasLogo: boolean;         hasBrandColor: boolean;
  hasStripeConnect: boolean;     hasGoogleCalendar: boolean;
  openSessionCount: number;      upcomingJobCount: number;
  customerCount: number;         unbookedLeadCount: number;
  marketplaceProvider: 'none'|'draft'|'pending'|'live';
};
```

**`surfaceHint` is a prior with a bounded weight.** It may break a tie between
equally-scored intents. It may never select an intent the utterance doesn't support.
This is the single line that fixes `if (S._edHubTab === 'store')`.

---

## B. Router output schema — a plan, never an execution

```ts
type CapabilityPlan = {
  intent: IntentId;
  confidence: number;                    // 0–1
  capabilities: string[];                // registry names, EXECUTION ORDER — may be >1
  steps: PlannedStep[];                  // resolved actions + data flow (§G)
  preconditions: PreconditionResult[];   // every one evaluated, satisfied or not
  missing_requirements: MissingRequirement[];
  requires_confirmation: boolean;
  confirmation?: { summary: string; consequences: string[] };
  ask: Ask | null;                       // AT MOST ONE. null when build-first applies.
  rationale: string;                     // internal only, never shown
  fallback?: 'converse' | 'clarify' | 'decline';
};

type Ask = {
  question: string;
  resolves: string;                      // MUST name a missing_requirements[].id
  because: string;                       // why no default/inference was possible
};

type MissingRequirement = {
  id: string; capability: string;
  blocking: boolean;                     // false ⇒ a default was applied, state it, don't ask
  defaultApplied?: { value: unknown; source: 'dna'|'state'|'convention' };
};
```

The worked examples from the brief, unchanged:

```json
{ "intent":"create_website", "capabilities":["website"], "confidence":0.98,
  "missing_requirements":[], "requires_confirmation":false }

{ "intent":"create_one_off_session", "capabilities":["sessions","calendar","payments"],
  "confidence":0.97, "missing_requirements":[], "requires_confirmation":false }

{ "intent":"promote_session", "capabilities":["sessions","website"],
  "confidence":0.99, "missing_requirements":[], "requires_confirmation":false }
```

**`ask` is a single nullable object, not an array.** A questionnaire is
unrepresentable in this schema. That is deliberate and load-bearing.

---

## C. Intent model

Intents are a **closed, versioned enum** — because the landing page renders them (§J)
and the tests assert them (§O).

```ts
type IntentDef = {
  id: IntentId;
  label: string;                    // landing-page prompt text
  capabilities: string[];           // ordered
  primary: string;                  // owns the outcome, writes the reply
  consequential: boolean;           // publishes / charges / emails ⇒ requires_confirmation
  actorKinds: Actor['kind'][];      // who may even attempt it
  composite?: IntentId[];           // 'build_my_business' fans out
};
```

| Domain | Intents |
|---|---|
| Website | `create_website` · `refine_website` · `apply_design_reference` |
| Product Store | `enable_commerce` · `create_product` · `design_product_store` · `refine_product_store` |
| Business Storefront | `create_storefront` · `refine_storefront` |
| Booking | `configure_booking` · `book_appointment` · `reschedule_appointment` |
| Sessions | `create_one_off_session` · `modify_session` · `publish_session` · `promote_session` · `session_status` |
| Marketplace | `find_pro` · `join_marketplace` |
| Automation | `create_followup` · `create_reminder` · `daily_briefing` |
| Reporting | `revenue_report` · `business_status` |
| Diagnostic | `grow_demand` · `build_my_business` (composite) · `unclear` |

`unclear` is a first-class outcome that routes to conversation, **not** to a coin-flip.

---

## D. Capability model — additive to the existing registry

`_shared/hubly_capability_registry.ts`'s `Capability` type gains three optional
fields. Nothing existing changes; unspecified capabilities behave exactly as today.

```ts
type Capability = {
  name: string; description: string; actions: CapabilityAction[];   // unchanged
  requires?: PreconditionId[];        // NEW
  entitlement?: 'starter'|'pro';      // NEW
  enablement?: {                      // NEW — how a business gets this capability
    flag: string;                     // businesses.capabilities key
    tradeSupports?: (dna: BusinessDna|null) => boolean;   // e.g. tradeSellsProducts
    enableIntent: IntentId;           // what the router offers instead of hiding
  };
};
```

---

## E. Capability precondition model — three states, exactly

```ts
type PreconditionResult =
  | { id; status: 'satisfied' }
  | { id; status: 'resolvable'; missing: MissingRequirement }
  | { id; status: 'unavailable'; reason: string; enablePath?: IntentId };
```

**The build-first rule is enforced by the type, not by prompt wording:**
a `resolvable` precondition must supply **either** `defaultApplied` **or** an `Ask`.
If a default exists it is applied and *stated*; only a genuinely defaultless,
un-inferable requirement may become the turn's single question.

| Capability | Preconditions |
|---|---|
| `website` | `identity.name` · `identity.businessType` **or** enough content to infer · `content.minimum` (services ≥1 **or** DNA `exampleServices` as a *draft* to confirm) |
| `storefront` (Product Store) | `commerce.enabled` (→ `enable_commerce`) · `product.exists` for design intents |
| `sessions` | `session.date` · `session.window` · `session.duration` (DNA `durationHint`) · `session.capacity` (default 1) · payments only if a price is set |
| `payments` | `stripe.connected` — *never blocks the booking*; degrades to pay-at-service (already implemented) |
| `calendar` | none — Google is best-effort, Hubly block always works |
| `marketplace` | consumer: none · provider: identity + services + service area + lifecycle state |
| `automation` | `audience.nonEmpty` (a real count) · `channel.configured` (Resend/Twilio) |

---

## F. Entitlement model

Source of truth: `businesses.tier` (`starter`|`pro`) + `businesses.capabilities` jsonb —
the Phase 5 lock, *"One Business, multiple capabilities."* Three outcomes:

| Outcome | Meaning | Router behaviour |
|---|---|---|
| `enabled` | `capabilities[flag] === true` | proceed |
| `enable_on_demand` | trade supports it, flag not set | **offer to enable in this turn** — never hide |
| `gated` | requires a tier they don't have | explain plainly + upgrade path; never pretend |

> **A photographer asking to sell prints is `enable_on_demand`.** `printStore: true`
> in their blueprint, `capabilities.storefront` not yet set. The router enables
> commerce and creates the first product. It does not hide the Store, and it does
> not interview them.

---

## G. Cross-capability execution model

```ts
type PlannedStep = {
  capability: string; action: string;
  args: Record<string, unknown>;
  argsFrom?: { fromStep: number; path: string }[];   // data flow between steps
  optional?: boolean;                                 // failure degrades, doesn't halt
};
```

* Steps execute **in order**; each step's `raw` is addressable by later steps.
* A required step failing **halts** the plan and reports what did and didn't happen.
* `optional: true` degrades (the Google Calendar pattern already in the engine).
* **The allowlist becomes plan-scoped.** Only capabilities named in the approved plan
  are dispatchable that turn. This *replaces* `CONTEXT_CAPABILITY_ALLOWLIST` while
  preserving the existing two-point enforcement (advertise + dispatch).

**Precedent already shipped:** `sessions.addWebsitePromotion` performs two backend
operations and returns a `storefrontAst` through the storefront channel — one
owner-visible action, two capabilities, no second writer. That is the model.

---

## H. Anonymous → authenticated conversation

Reuses `businesses.draft_token` and `claim-draft-account`. **No second onboarding system.**

```sql
create table business_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  draft_token_hash text,          -- sha256; null once claimed
  thread jsonb not null default '[]'::jsonb,
  understanding jsonb not null default '{}'::jsonb,
  last_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

* **Anonymous writes** go through a SECURITY DEFINER function taking the raw
  `draft_token` — the exact shape `start_business_in_progress` already uses. No broad
  anon grant.
* **On claim**, `claim-draft-account` sets `owner_id` and nulls `draft_token_hash`;
  the thread becomes owner-owned under `owns_business()`.
* **RLS:** owner via `owns_business(business_id)`; **no anon policy** — anonymous
  access only through the definer function (the One-Off Session privacy pattern).

Result: *"I was talking to Hubly and now I'm inside Hubly."*

---

## I. Creative Director migration — three phases, never deleted

Creative Director keeps its specialised website-design behaviour. It stops being a
**parallel brain** and becomes an **execution engine the router chooses**.

| Phase | Change | Risk |
|---|---|---|
| 1 | Feed it the DNA block (it takes `blueprintIds` — a list of *names* — today; `buildBusinessIdentityBlock()` already exists) | very low, additive |
| 2 | Register it as actions under the `website` capability (`website.direct`, `website.applyReference`) | low — same function, new caller |
| 3 | Client stops calling it directly; the router invokes it | medium — behind a flag, both paths live |

```
Router → intent → capabilities
           ├── website  → Creative Director / Document AST engine
           ├── storefront → Storefront AST engine
           └── sessions → One-Off Session engine
```

---

## J. Landing-page capability prompts

Rendered **from the intent registry**, filtered to
`actorKinds.includes('anonymous')` and executable given current state. Clicking one
sets `intentSeed` — a **prior into the same router**, not a separate flow.

> *Build my website · Set up booking · Create a One-Off Session · Start selling products · Join Marketplace · Automate my busywork*

If an intent is not executable, it does not appear. The list is never hand-written.

---

## K. Marketplace routing

| Utterance | Intent | Actor | Notes |
|---|---|---|---|
| "I need someone to detail my car." | `find_pro` | consumer/anonymous | no business context required |
| "I want to get jobs through Hubly." | `join_marketplace` | owner | provider lifecycle preconditions |
| "I need more customers." | `grow_demand` | owner | **diagnostic** — see §Scenario 8 |

`hubly-intent-classify` already classifies `business | marketplace | ambiguous` and is
**currently orphaned**. It becomes a **prior** feeding the router's actor resolution —
reused, not replaced, not run as a separate gate.

---

## L. Automation model

A new `automation` capability wrapping engines that already exist —
`hubly_campaign_engine.ts`, `recurring_schedule_engine.ts`,
`hubly_brain_automation_intelligence.ts`.

Actions: `createFollowup` · `createReminder` · `listAutomations` · `pauseAutomation` · `dailyBriefing`.

**Every send-to-humans automation is `consequential: true`** and must confirm with a
**real audience count** from the database — never "some customers".

---

## M. Migration path — five shippable phases

| # | Phase | Ships | Reversible |
|---|---|---|---|
| 1 | **Shadow mode** — router runs, logs its plan, changes nothing | telemetry on real traffic | trivially |
| 2 | **Plan-scoped allowlist** replaces context allowlist for `operate` | correct behaviour on one surface | flag |
| 3 | **One conversation endpoint** — client sends utterance + hint; the 9 orphaned `dashboard` actions come alive | the operating layer | flag |
| 4 | **Conversation persistence + claim** | continuity across sign-up | additive table |
| 5 | **Creative Director, Marketplace, Automation registered** | full surface coverage | per-capability |

Phase 1 is measurable before anything changes: log `(utterance, surfaceHint, plan)` and
compare the router's choice against what the UI would have chosen.

---

## N. Security & authorization

1. **Business id is never model-supplied.** Always the verified session or `draft_token`. Existing rule, now universal.
2. **Plan-scoped allowlist** keeps two-point enforcement: advertise, then re-check at dispatch.
3. **Anonymous actors get a restricted intent set** (`actorKinds`) — no payments, no customer data, no automation.
4. **Entitlements checked server-side**, after ownership, never from the plan.
5. **Consequential actions require an explicit confirmation token** echoed back next turn — the model cannot self-confirm.
6. **The router cannot execute.** It emits a plan; the executor validates it against the registry independently.
7. **Cross-business isolation unchanged** — `owns_business()` remains authoritative.
8. **Draft tokens stay hashed** at rest; anonymous conversation writes go through a definer function only.

---

## O. Tests required

| Suite | Needs a key? | Asserts |
|---|---|---|
| **Intent fixtures** (the 10 scenarios + adversarial) | no — stubbed classifier, real precondition engine | correct intent, capability set, ask/no-ask |
| **Precondition truth table** | no | every capability × every state → satisfied/resolvable/unavailable |
| **Build-first** | no | complete state ⇒ `ask === null` and ≥1 executed step |
| **One-question rule** | no | `ask` is null-or-one, and `resolves` names a real requirement |
| **No-questionnaire** | no | the same requirement is never asked twice in a thread |
| **Cross-capability ordering** | no | `promote_session` plans sessions→storefront with data flow |
| **Anonymous restriction** | no | anonymous cannot reach payments/customers/automation |
| **Entitlement gating** | no | `enable_on_demand` offers; `gated` explains; neither hides |
| **Continuity** | no (real DB) | thread survives claim; anon loses access post-claim |
| **Industry neutrality** | no | existing 47 assertions keep passing |
| **Live model** | **yes** | classification accuracy on the fixture set |

---

## The ten scenarios

Legend: **✓** satisfied · **→** default applied (stated, not asked) · **?** the one question

### 1. "Build my website."
`create_website` · caps `[business, website]` · conf 0.97
Preconditions: name ✓ · type ✓ · services ✓(3) · brand → DNA `recommendedStyles`, photos → gallery
Executes: `website.generateDocument(brief)` — brief composed from identity + DNA + real services
**Asks: nothing.** *"Building it now — it'll appear in a moment."*

### 2. "Make my website more premium."
`refine_website` · caps `[website]` · conf 0.96
Precondition: `hasWebsiteDocument` ✓ (if false → `create_website` instead, not an error)
Executes: `website.patchDocument("make it more premium")` → Creative Director / AST engine
**Asks: nothing.**

### 3. "I want to sell prints."
`enable_commerce` + `create_product` · caps `[storefront]` · conf 0.95
Precondition: `commerce.enabled` → **`enable_on_demand`** (photography `printStore: true`)
Executes: enable `capabilities.storefront` → `storefront.createProduct({name:"Print", status:'draft'})`
**Asks: ?price** — genuinely defaultless. One question. *Not* "physical, digital or a mix".

### 4. "I'm doing mini sessions August 20 from 8–2."
`create_one_off_session` · caps `[sessions, calendar, payments]` · conf 0.97
date ✓ · window ✓ · duration → DNA `durationHint` **20** · capacity → 1 · payment → none until priced
Executes: `sessions.create` (**draft**)
**Asks: nothing.** Replies with the §15 confirmation: *18 slots, blocks 8–2, ready to publish?*
`publish` is `consequential` → separate confirmed turn.

### 5. "Put my mini sessions on my website."
`promote_session` · caps `[sessions, storefront]` · conf 0.99
Precondition: *which* session — 1 open ⇒ inferred; >1 ⇒ **?which one**
Executes: `sessions.addWebsitePromotion` → flag + banner, one `storefrontAst` back
**Asks: nothing** (single open session).

### 6. "I need someone to detail my car."
`find_pro` · actor `consumer` · caps `[marketplace]` · conf 0.98
No business context. No owner capabilities reachable.
Executes: `marketplace_intake` → `marketplace_match`
**Asks: location/timing only if matching genuinely can't proceed.**

### 7. "I want to get jobs through Hubly."
`join_marketplace` · caps `[marketplace, business]` · conf 0.94
identity ✓ · services ✓ · **service area missing, not inferable**
Executes: provider draft via `marketplace_lifecycle`
**Asks: ?service area.** One question — the only genuine blocker.

### 8. "I need more customers." — the diagnostic case
`grow_demand` · conf 0.72 → **no blind capability pick**
Router reads real state and *reasons*:

| State | Recommendation |
|---|---|
| no website | `create_website` — "you don't have a site yet; that's the gap" |
| site, no marketplace | `join_marketplace` |
| both, `unbookedLeadCount > 0` | `create_followup` — **"you have 14 leads who never booked"** |

Returns **one** recommendation with rationale drawn from state, plus the alternatives.
**Asks: nothing** — it diagnoses instead.

### 9. "Follow up with people who didn't book."
`create_followup` · caps `[automation, crm]` · conf 0.96 · **consequential**
Precondition: `audience.nonEmpty` → real count (14)
`requires_confirmation: true` — *"This messages 14 people who requested a quote in the last 90 days and never booked. Send?"*
**Asks: nothing** — it confirms, which is different.

### 10. "Build my business." — composite, anonymous-safe
`build_my_business` → `[business.startDraft → create_website → configure_booking]`
Anonymous: `start_business_in_progress` creates the real row + `draft_token`
Executes progressively, **one visible outcome at a time**; conversation persists (§H) and survives claim.
**Asks: only what genuinely blocks the next step** — typically the business name, once.

---

## What this does *not* change

The Universal Business Core (identity · type · DNA · brand · people · offerings ·
communication · entitlements) stays the foundation; capabilities compose on top.
Navigation becomes a **projection** of `business + blueprint + enabled capabilities +
entitlements` — the sidebar stops being the source of truth for AI behaviour and
becomes a view of it.

And these remain **six distinct capabilities that cooperate, never merge**:
**Business Storefront** · **Product Store** · **Website** · **Booking** ·
**One-Off Session** · **Marketplace**.
