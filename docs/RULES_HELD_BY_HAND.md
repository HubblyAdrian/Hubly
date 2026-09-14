# Rules we are holding by hand — the unchecked half of CLAUDE.md and SETTLED

**Swept 2026-09-14**, after the red-proof audit found that *"Hubly never points at a control it
cannot see"* — a hard prohibition — was followed everywhere and **checked nowhere**. It had been
held by care, and care is what runs out at 2am.

**Method, so the number can be argued with:** every rule stated as a prohibition or an invariant
in `CLAUDE.md` and `docs/SETTLED.md` is listed. A rule counts as **CHECKED** only if a named
script fails when it is broken — not if a script merely touches the same area. **PARTLY** names
exactly which slice is covered. Rules about how the work is *run* (verify as the owner, measure
before fixing, grep for siblings) are listed separately: no repo check can enforce them, and
pretending otherwise would be its own false green.

---

## The count

| | product rules | how-we-work rules |
|---|---|---|
| **checked** — a script fails when it is broken | **11** | 0 |
| **partly** — one slice enforced, the rest by hand | **7** | 0 |
| **held by hand** — nothing fails | **13** | 12 |
| total | 31 | 12 |

**13 product rules have no check at all.** Two of them are prohibitions in the numbered list that
opens CLAUDE.md.

---

## CHECKED (11)

| rule | what fails |
|---|---|
| `supabase db push` is banned | `check-no-db-push` (red-proofs its own detector every run) |
| A layout that cannot be read is a defect | `check-block-legibility` (pixels, mounted the way the product mounts) |
| Any rate describing users/adoption/value states its `account_kind` split | `check-denominator-rule` + `rateLine()` throws rather than formats |
| A claim about "pages" names its store (SETTLED #2) | `rateLine()` throws without `{ store }` |
| `hubly-paging-fixture` / `hubly-classic-fixture` are not the corpus (SETTLED #10) | `rateLine()` throws on a denominator containing them |
| One ask at a time | `check-one-ask-not-a-list`, `check-one-voluntary-addition` (the gate is executed) |
| A question Hubly asks has exactly one writer | `check-one-writer-per-question` |
| Don't ship copy offering an action with no working path | `check-home-promises` |
| A sentence may not outlive the inability it describes | `check-classic-claim` (3 legs) |
| Hubly never points at a control it cannot see | `no-directives.check.ts` **net 3, added 2026-09-14** — server-composed sentences only |
| An authorisation an action depends on is derived, not listed (D-053) | `check-owner-id-invariant` + the boot derivation refuses to serve |

## PARTLY (7) — one slice enforced, the rest held by hand

| rule | enforced | NOT enforced |
|---|---|---|
| **Prohibition 3** — no step assumes a previous step succeeded | `check-recording-on-success` (a recording call fires on the success path), `check-verification-carried` (a computed verification reaches the caller) | every other postcondition in the product; and *"every distinct failure gets a distinct, human message"* is checked nowhere |
| **Prohibition 6** — silence after a request is a failure | the two above, on the write side | the owner-visible half: nothing asserts that a successful state change produces a confirmation the person can see |
| **Prohibition 5** — earned places, stable positions, mobile cap 4 | `check-nav-targets-exist` (no code drives a nav item that does not exist), `check-mobile-nav-drawer` (required markup present), `check-places-seeded` (the seed trigger's misses) | **stability** — that a position never reshuffles — and the cap of 4, which Claude Code cannot verify anyway (no true 390px viewport) |
| A default that destroys work is never acceptable | `check-destructive-confirm` (four website actions consult the live-page gate) | every other destructive default; the gate's *correctness* is explicitly not asserted, only that it is called |
| Every fact is reached by an explicit question, and the capture is confirmed | `check-name-is-asked` — **the name only** | services, prices, hours, service area, phone: the facts the product actually depends on |
| Never state what you weren't told | `check-classic-claim`, `servicesTruth`'s composer | every other composer; and the **ask** side (*never ask for what you were told*) has no check |
| Two website stores, read both (SETTLED #2) | `check-two-store-readers` — hours and services readers, markers now access paths | the WRITE side, and the other facts (logo, service area, contact) |

## HELD BY HAND — product rules with no check (13)

1. **Prohibition 1** — no cleanup/validation/post-processing pass may cause a second generation.
2. **Prohibition 2** — no status indicator shows success unless that surface confirmed it. *The most-cited rule in the repo and nothing fails when it is broken.*
3. **Prohibition 4** — the interface may not change shape silently.
4. **Never publish a fact the owner did not state.** `addressGrounded` / `phoneGrounded` / `emailGrounded` exist in `hubly_grounding.ts` and **no check asserts a writer calls them.** This is the rule that produced the 2026-09-01 phone-number scar.
5. **The notification standard** — name the event, say who, link straight to the thing, never invite a reply to an unmonitored address.
6. **A notification may not report a fact the system never recorded.**
7. **Never reveal a live secret to the terminal.** No check greps for `--reveal` or a key prefix in scripts or CI.
8. **A category that describes people may not default to the flattering value** (`account_kind`, `owner_identified`).
9. **A row is not evidence of a person** — no check ties a claim about who someone is to the classification.
10. **A generated page is patched by an anchor stamped at build time, never re-recognised afterward.** Enforced for service prices by construction; nothing fails if the next fact ships a matcher instead.
11. **Pricing advice is information, not instruction, and every price traces to real retrieval.** The search backend does not exist yet; the rule will bind the moment it does.
12. **A verification screenshot may never contain fabricated content** — including fabricated STATE.
13. **The rig's click witness has no assertion of its own.** `window.__rigClicked` is what decides whether anything happened at all, and the covered-control assertion is satisfied by Playwright's own actionability error before the witness is ever read. Every browser measurement this week rests on it. *(Found by the red-proof audit; recorded here rather than left in prose.)*

## HELD BY HAND — how-we-work rules (12), and no script can hold these

Verify by using it as the owner on the real thing · test the experience, not the code · a bug is a
CLASS, grep for its siblings · Claude Code cannot verify mobile · measure before fixing when a
failure is unnamed · business facts go in `docs/BUSINESS.md` the moment they are stated · record
how a fact was established · enumerate the harmless side, never the valuable one · know which of
the two deploy paths a change took · confirm the model is the one saying it before editing a
prompt · look for the missing door before building the room · a scar note is a memory of a
measurement, not a measurement.

These are the ones the repo cannot help with. They are also the ones that have produced most of
the scars — which is an argument for turning the checkable edges of them into checks (which of
the two deploy paths a change took is decidable; whether a fact reached `BUSINESS.md` is
decidable), not for trusting them harder.

---

**Not written here: any of the missing checks.** The ruling was to see how many rules we are
holding by hand, not to close them. The list is ordered so that the first four in the
held-by-hand section are the ones I would build first — three numbered prohibitions and the
grounding rule that has already cost a scar.
