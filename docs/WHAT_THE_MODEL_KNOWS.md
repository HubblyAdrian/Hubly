# What the model is told, where it comes from, and where it is wrong

**Established 2026-09-14. Read-only. Nothing built.** Adrian asked how we teach the model what
Hubly is and does. The mechanism already exists in three layers; this is what is actually in
them, and where tonight showed them failing.

**The principle this document exists to serve, stated first:** *the assistant's problem has
never been ignorance. It is being confidently told things that are not true — and every one of
those was written by us, not hallucinated by it.* Section 3 measures that claim. It holds: **4
of 4.**

---

## 1. What reaches the model in one owner turn

Assembled by `buildSystemPrompt()` (`hubly-conversation/index.ts:647`), in this order:

| # | block | source | size | present |
|---|---|---|---|---|
| 1 | intro + TONE + PRIORITY ORDER + the three responsibilities | literal in `buildSystemPrompt` | ~4,600 chars | **always** |
| 2 | `learningSection` | literal, varies by context | ~700 chars | **always** |
| 3 | ABSOLUTE RULE — honesty over appearing intelligent | literal | ~700 chars | **always** |
| 4 | `capabilityKnowledgeBlock` | `hubly_capability_knowledge_base.ts` — **29 entries, 23,037 chars total**, filtered per conversation | variable | **always** (filtered) |
| 5 | `capabilitiesBlock` | `buildCapabilitiesPromptBlock(allowed)` over the registry — **7 capabilities, 33 actions, 18,473 chars of description** | variable | **always** (gated by context + `withDocumentGenerationGate`) |
| 6 | `buildSelectionBlock(selection)` | what the owner has clicked on the canvas | small | conditional |
| 7 | `buildOperationalStateBlock(operational)` | `hubly_operational_state.ts` — **16 slices** | variable | **owner + authorised only**; omitted entirely on failure |
| 8 | understanding adapter: label, description, schema | literal | ~1,200 chars | **always** |
| 9 | `knownSoFar` — the accumulated understanding | per-business | variable | **always** |
| 10 | conversation history | `messages[]` | variable | **always** |

**Roughly 12–15k characters of instruction before a single word of the business's own data.**

---

## 2. Where the descriptions come from

**Every one is hand-written beside the code, and none is derived from it.**

| | count |
|---|---|
| capabilities | **7** |
| actions | **33** |
| `description` fields in the registry | **156** |
| …derived from the implementation | **0** |
| capability-level description text | 2,682 chars |
| action-level description text | 15,791 chars |

**156 hand-written descriptions, 0 derived. That number is the answer to Adrian's question:**
every one is a sentence about behaviour that lives next to the behaviour and is not checked
against it. Each is a drift risk, and drift has no failure mode — the code changes, the sentence
does not, and nothing goes red.

---

## 3. The drift, measured — and the distinction that decides the fix

| # | what the owner was told | **model-told or code-composed?** | where |
|---|---|---|---|
| 1 | *"that's edited in Edit details"* | **CODE-COMPOSED** | three composers: `hcClassicScopeLine` (`platform-home.html`), `refuseIfClassicSite` (`registry:1225`), `classicScopeReply` (`owner_replies`). **Not in any prompt.** |
| 2 | *"moving whole sections isn't something I can do on this page, and that isn't a temporary problem"* | **CODE-COMPOSED** | `hcClassicScopeLine(lead)` at `platform-home.html:6365`. `moveFreeformSection` ships — it is simply unreachable on a classic page |
| 3 | *"your services are on your page now"* | **CODE-COMPOSED, then SPOKEN by the model** | `applyOwnerRecordEdit` built its `summary` from `placement.status`; that summary is handed back as the action result, and the model repeats it. The model was told a false thing by us and relayed it faithfully |
| 4 | the new-signup script to a claimed business with a live site | **CODE-COMPOSED, and no model call happened at all** | `DETERMINISTIC_OPENING`, returned at `index.ts:1094` before the provider check |

**4 of 4 were written by us. 0 were hallucinated.**

**This is the distinction that matters and we have been treating these as one problem.** A
*prompt* problem is fixed by changing what the model is told. A *composer* problem is fixed by
changing what our own code says, and **no amount of prompt work touches it** — case 4 never
reaches a model at all. Every case tonight was the second kind.

The corollary, which is uncomfortable: **the honesty rules in the system prompt are aimed at the
wrong actor.** "Never say or imply a capability ran unless you actually invoked it" governs the
model. Every false statement tonight came from a `hcAppendMessage` or a `summary:` field.

---

## 4. What the model does not know that it should

`docs/CAPABILITIES.md` has 215 rows; the registry exposes **33 actions**. Things the product can
do that the assistant **cannot be asked to do**, because no action declares them:

| capability in the code | reachable by the model? | how it reaches the owner today |
|---|---|---|
| `moveFreeformSection` | **no** | only a `body.sectionMove` POST from a canvas control |
| `deleteFreeformNode` | **no** | only `body.nodeDelete` |
| `applyOwnerNodeMove` | **no** | only `body.nodeMove` |
| `applyServicesToClassic` / `set_business_service_catalog` (shipped tonight) | **no** | a side effect inside `setServices` and `applyOwnerRecordEdit` |
| the manual `+` (shipped tonight) | **no** | a canvas control only |
| `applyOwnerDesignEdit` | **no** | `body.designEdit` from the Design panel |

**Six capabilities the product has and the model has never been told about.** Ask Hubly to move
a section and it will decline — correctly, by its own rules, because nothing in its list says it
can. The four found "built and switched off" tonight were switched off *for the model too*.

---

## 5. What it knows about the business — and one live falsehood

**16 slices.** 13 load on every authorised owner turn; **3 are `onDemand`** and load only when
asked for: `page_records`, `catalogue`, `payments`.

| always in context | bookings · jobs · orders · chat_leads · traffic · customers · sales · service_stats · services · hours · notifications · tasks · leads |
|---|---|
| **on demand only** | **page_records · catalogue · payments** |

**For Graef, every turn, the model is told:** 11 bookings, 2 jobs, hours present
(`meta.hours` — the slice reads both stores, deliberately), a services list… and here is the
defect:

> **`services` reads `get_business_services`, which selects from the relational `public.services`
> table only. Graef has 1 row there — `"clay and seal", price 0, no description`. His page
> renders 8 services from `meta.service_catalog`. No slice reads the catalogue at all.**

So on every turn the model is confidently told **the paying customer has one unpriced service**,
while his live page shows eight priced ones. It is the two-store split (SETTLED #2) reaching the
model's context — the fifth place it has surfaced — and it is the same class as §3: **we told it
something untrue.** It does not have to ask; it has been given a wrong answer and has no reason
to doubt it.

*(`hours` gets this right, and its comment says why — it was built after a reader on one store
alone "would have told Graef 'no hours' while his page showed them.")*

---

# PROPOSAL — can a capability describe itself?

**Asked, not built.** The question: if each capability declared what it does, which store it
writes and when it refuses — and its description were GENERATED from that — the model could not
be told something the code does not do.

## What it would look like

```ts
{
  name: "setHours",
  writes: [{ store: "settings_business_hours" }, { store: "businesses.meta.hours" }],
  refusesWhen: [
    { when: "no value in this message",      returns: "needs_value" },
    { when: "claimed and not the owner",     returns: "not_owner" },
    { when: "unclaimed and token mismatch",  returns: "not_an_open_draft" },
  ],
  surfaces: ["freeform", "classic"],
  // description is GENERATED from the above + a one-line human purpose
}
```

## What it buys

- **The four §3 cases become impossible in the one direction it covers.** A capability that does
  not declare `writes: classic` cannot have a description claiming the page changed.
- **§4 disappears structurally.** A declared capability is in the registry by construction; there
  would be no such thing as a capability the model has not been told about.
- **It is checkable.** `writes` can be verified against the RPCs the handler actually calls —
  that is a static read of the handler body, which this repo already does in
  `check-owner-id-invariant` and `check-computed-and-dropped`.

## Where it breaks down — and this is the honest half

1. **It cannot describe TONE, and tone is most of the description.** 15,791 characters of action
   description are overwhelmingly *when* to invoke, *how* to ask, *what not to say* — the
   `setServices` description is a paragraph about passing the complete list and not lifting a
   price from earlier in the chat. **None of that is derivable from the code.** Generation would
   replace a rich sentence with a thin one and make the model worse at the thing descriptions are
   actually for.
2. **The declaration is hand-written too.** `writes: ["classic"]` is a claim about the code
   exactly as the sentence was. It is a *smaller* claim, more mechanically checkable, but it is
   not self-evidently true — and a wrong declaration is worse than a wrong sentence because it
   would be trusted more.
3. **A third of the truth is not in the capability at all.** Case 1 ("Edit details") is in a
   client composer. Case 4 never reaches a capability. **Self-description fixes the registry and
   touches neither.**
4. **Reachability is not declarable.** Tonight's four unlit capabilities existed, worked, and had
   no door. A capability can honestly declare what it does and still be unreachable.

**My recommendation: the hybrid.** Declare the mechanical facts — `writes`, `refusesWhen`,
`surfaces` — and **generate a footer appended to the hand-written description**, not a
replacement for it. The prose keeps the judgement; the footer carries the facts; the footer is
checkable. Roughly **40 lines of generator, plus ~8 declared fields across 33 actions**.

## The smaller version — a check, and I would build this first

**"Fail when a capability's description is hand-written and its behaviour has changed."**

Checkable today, without any schema change:

1. **Hash the handler body**, store it beside the description in a committed manifest. When the
   handler changes and the description does not, **fail** with both diffs side by side. Does not
   know if the description is *wrong* — knows that a human last reconciled them at revision X and
   the code is now at Y. **~60 lines. Red-proofable by editing any handler.**
2. **Assert declared stores against called RPCs.** If a description says "on your page" and the
   handler calls no page writer, fail. Needs the `writes` field, so it follows the hybrid.
3. **Assert every capability the code exposes is in the registry** — a direct check for §4:
   every `body.<x>` structured branch in `hubly-conversation` must have a registry action or an
   explicit `notForModel: true`. **This one catches the six above and costs ~40 lines.**

**Order I would build them: (3), then (1), then the hybrid, then (2).** (3) is the largest real
gap and the cheapest check. (1) makes drift loud without asking anyone to restructure anything.

**Nothing built.**


---

# FIXED 2026-09-14 — the services slice, and the rule that should have prevented it

**`get_business_services` now reads both stores**, copied from `get_business_hours` line for
line: full outer join, `source`, `conflicts`. What the model is told about Graef went from

> `clay and seal · no price on record · no description`  — **1 service**

to

| name | price | dur | source |
|---|---|---|---|
| clay and seal | — | — | `services` **— on record only, NOT on their page** |
| Full Detail | $85 | 2h | `meta.service_catalog` |
| Premium Detail | $130 | 3h | `meta.service_catalog` |
| Shampoo Detail | $120 | 3.5h | `meta.service_catalog` |
| Clay & Seal Package | $75 | 1.5h | `meta.service_catalog` |
| Paint Enhancement | $150 | 4h | `meta.service_catalog` |
| All-in-One Paint Correction | $200 | 4h | `meta.service_catalog` |
| Single Stage Paint Correction | $275 | 4h | `meta.service_catalog` |
| 2 Stage Paint Correction | $400 | 8h | `meta.service_catalog` |

**The catalogue wins on price, deliberately** — it is what the page renders and what a customer
is quoted. His one relational row says `0` for a service the page prices at $75.

**Nine rows, not eight, and that is honest rather than tidy.** `"clay and seal"` and
`"Clay & Seal Package"` are almost certainly the same service under two names. The join is
exact — fuzzy-matching two stores is how two different services get silently merged — so the
stray record is reported as what it is: *on record only, NOT on their page*. That is a real
thing for the owner to know.

## The matrix, re-run against all 16 slices

| slice | reads | two-store fact? |
|---|---|---|
| **services** | `get_business_services` | **YES — fixed** |
| **hours** | `get_business_hours` | **YES — already correct** |
| catalogue · page_records | RPCs that already read `meta` | already both |
| service_stats | `jobs` + `booking_requests` by name | no — a TRANSACTION fact, not a catalogue one |
| bookings · jobs · orders · chat_leads · traffic · customers · sales · notifications · tasks · leads | single-store tables | no |

**2 of 16 slices read a fact that lives in two stores. Both now read both.**

## And the rule is enforced, because a comment is a preference

`scripts/check-two-store-readers.mjs` (`npm run check:two-store`) declares the two-store facts
explicitly — a fact is two-store because of a decision, not because of anything visible in a
query — finds each reader's **latest** definition across the 227-migration ledger, and requires
both store markers **plus** `source` and `conflicts`.

Red-proofed twice, and the second leg is the one that matters:

```
RED A  revert services to one store        → FAIL  reads 1 of 2 stores · missing: meta.service_catalog
RED B  read both but drop source/conflicts → FAIL  reads both but does not report which store a row
                                                    came from, or whether they disagree.
                                                    Picking a winner silently is how a two-store
                                                    fact becomes a one-store answer again.
