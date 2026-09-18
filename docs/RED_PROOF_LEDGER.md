# The red-proof ledger — GENERATED, DO NOT EDIT

Written by `scripts/redproof-run.mjs` from `docs/red-proof-ledger.json`. Edit the declarations in
the checks, not this file.

**This exists because the evidence used to evaporate.** A break happens in a terminal and survives, if
at all, as prose in a commit message — so *"has this leg ever been shown red alone"* was a question
with a memory instead of an answer. On 2026-09-17 the repo held **252 negative assertions and zero
recorded red-proofs**, which is not 252 unbroken legs; it is a repo with nowhere to put the evidence.

**Ratchet date: 2026-09-18.** A purely-negative leg whose line was last changed on or after
that date MUST declare a break, and `check-negative-legs-declare-a-break.mjs` fails if it does not.
Legs older than that date are grandfathered — there were 78 of them and failing all at once would
have made the rule the first thing anyone switched off.

**Last run: 2026-09-18T01:47:05.194Z** · 22 run(s) recorded.

| status | n | what it means |
| --- | --- | --- |
| **RED ALONE** | 17 | the break fired exactly this leg and nothing else. **This is a red-proof.** |
| COMPOUND | 1 | the break turned this leg red along with others. **Proves nothing about this leg** (L98) — it needs a narrower break |
| NOT RED | 3 | the break was applied and this leg stayed green. **The leg is vacuous, or the break misses it** |
| SKIPPED | 2 | the break could not be applied (text not found, or a db break without `--allow-db`). **Not evidence of anything** |

## Every declared break

| check | leg | status | break | also went red |
| --- | --- | --- | --- | --- |
| `check-address-change-is-said.mjs` | 5 the sentence exists and names the address | **SKIPPED** | make the sentence point at a control — Hubly does not render the page and cannot know what is on screen, so naming a button is claiming a capability it has not verified | — |
| `check-address-change-is-said.mjs` | 5 the sentence exists, names the new address | **RED ALONE** | make the sentence point at a control — Hubly does not render the page and cannot know what is on screen, so naming a button is claiming a capability it has not verified | — |
| `check-arrival-in-dom.mjs` | 2c the arrival IS in the thread | **RED ALONE** | speak a second time while the name question is on the floor — a page-view count beside the arrival, which is two composers talking over each other | — |
| `check-baseline-before-schema.mjs` | schema_mode is read from the call | **RED ALONE** | put the literal "json_object" back in place of the value reported by the AI layer — which is what would make every row say json_object after the flag is flipped, and the whole before/after comparison silently wrong | — |
| `check-chain-acknowledgement.mjs` | 7 a real job write was read | **RED ALONE** | add `business.addJob` to the writers that can close the priced-services gap — one wrong entry in HC_GAP_WRITERS, which is how a job write comes to be announced as a price change | — |
| `check-conversation-is-the-surface.mjs` | 12 the name reader answered | **COMPOUND** | manufacture a name out of the credential — the email local-part heuristic, which passes off 'Adriansmithee' as something the owner told us | FAIL  11 with NO name anywhere, the email is the fallback and is not passed off as a name — label="Adriansmithee+ever" f<br>FAIL  12a with no name on record the greeting drops it rather than using his email — "Good evening, Adriansmithee+ever." |
| `check-conversation-is-the-surface.mjs` | 6 a day holding rows RENDERS | **NOT RED** | make the day render nothing at all — the vacuous version passed on exactly this | FAIL  1 'show me my day' renders the day IN THE THREAD — rows=0 (expected the 2 real rows, in bands or under Later this <br>FAIL  2 each row is a real record carrying its own fields, in 12-hour time — "s and prices is what makes it bookable. Vi<br>FAIL  4 a day row and a job card open the SAME panel — one mechanism, not two — no day row<br>FAIL — TypeError: Cannot read properties of undefined (reading 'slice') |
| `check-conversation-is-the-surface.mjs` | 6 the day's rows were COUNTED | **RED ALONE** | RESTORE LESSON 86's OWN DEFECT — gate hcGoToPlace on business_places ROWS instead of on content, so a day holding a driveway job and a doctor's appointment is told it 'isn't set up on this account yet'. That sentence was said to a real owner on 2026-09-15 | — |
| `check-conversation-is-the-surface.mjs` | 7 the door reported an outcome | **NOT RED** | make the client announce the action before the outcome is known | — |
| `check-conversation-is-the-surface.mjs` | 7 the door returned a receipt | **RED ALONE** | announce the action before the outcome is known — the premature 'Adding X' class, which claims a placement before it has landed | — |
| `check-conversation-is-the-surface.mjs` | 9 the promises rendered | **RED ALONE** | offer a door to an empty room — drop the needs(ctx) gate so every card renders whether its room holds anything or not, which is prohibition 5 inverted | — |
| `check-day-controls-work.mjs` | 2 there IS add-copy | **RED ALONE** | put the dead gesture back in the add-row copy — instruct a double-click, which does not exist on touch, on the surface Adrian was actually looking at | — |
| `check-doors-open-when-needed.mjs` | 1 the scan found creation actions | **RED ALONE** | make the delegation test blind, so every empty-state entry point counts as idle-only — the condition leg 1 exists to detect, without touching the door leg 2 asserts | — |
| `check-editable-set-is-derived.mjs` | 1 [RULE] the markers were found | **RED ALONE** | remove one marker's editor branch — `footer-tag` — so a marker the page renders has nowhere to be edited: the affordance painted over a capability that is not there | — |
| `check-every-check-is-runnable.mjs` | 6 both sides of the comparison were read | **RED ALONE** | make the glob miss a check that a convenience entry names, so a check is reachable ONLY by its hand-written name — the route-list disease, whose failure mode is silent | — |
| `check-navigation-destinations.mjs` | 1 the surface registry was read | **RED ALONE** | delete the `quotes` renderer from HC_ROOMS, so a place that can appear in the rail has nothing to render it — a rail row that opens an empty canvas | — |
| `check-navigation-destinations.mjs` | 2 the room registry was read | **RED ALONE** | add a room nothing can reach — a renderer for `store`, which is not a surface, so it is built and doorless: the diagnosis that has been right four times this month | — |
| `check-navigation-destinations.mjs` | 3 [SHAPE] the destinations were resolved | **RED ALONE** | route an existing destination to Home instead of to its own surface, so something lands on a screen that cannot answer for it | — |
| `check-navigation-destinations.mjs` | 3 every destination opens its OWN surface | **SKIPPED** | route an existing destination to Home instead of to its own surface, so something lands on a screen that cannot answer for it | — |
| `check-navigation-destinations.mjs` | 3 the destinations were resolved | **NOT RED** | make the resolver hand back an unknown place instead of falling back to Home, so a sentence can offer a door that opens onto nothing | FAIL  3b the destinations were resolved, and nothing is quietly routed to Home — 5 destination(s) resolved · -> home: st<br>FAIL  4 the count keys were read, and every door can count what is in the room before offering it — no countable view fo |
| `check-navigation-destinations.mjs` | 3b the destinations were resolved | **RED ALONE** | route an existing destination to Home rather than to its own surface, so something lands on a screen that cannot answer for it | — |
| `check-navigation-destinations.mjs` | 4 the count keys were read | **RED ALONE** | make the planner door count by a key no thread view answers — `planner->planner` instead of `planner->day`. THIS IS THE EXACT SHAPE of 'your schedule isn’t set up' said about a room with two jobs on it: the door counts by a different key than it navigates by | — |
| `check-navigation-destinations.mjs` | 5 the default rail was read | **RED ALONE** | offer a place by default that no surface renders — `store: true` in HC_RAIL_DEFAULT, so every new business is given a rail row that opens nothing | — |
| `check-no-mailto-reaches-a-customer.mjs` | no latest stored page carries a mailto | **DECLARED, PROVEN BY HAND** | plant a mailto anchor in a stored page and confirm this leg alone goes red | — |

## Runs

- **2026-09-18T01:23:54.901Z** — 3 break(s) applied · 0 red alone · 0 compound · 3 not red · 1 skipped
- **2026-09-18T01:26:16.711Z** — 3 break(s) applied · 0 red alone · 0 compound · 3 not red · 1 skipped
- **2026-09-18T01:27:40.871Z** — 2 break(s) applied · 1 red alone · 1 compound · 0 not red · 2 skipped
- **2026-09-18T01:28:51.267Z** — 4 break(s) applied · 2 red alone · 1 compound · 1 not red · 0 skipped
- **2026-09-18T01:30:06.548Z** — 4 break(s) applied · 3 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:31:32.325Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 2 skipped
- **2026-09-18T01:32:51.035Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T01:33:36.757Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:34:54.798Z** — 3 break(s) applied · 2 red alone · 1 compound · 0 not red · 1 skipped
- **2026-09-18T01:36:17.473Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 1 skipped
- **2026-09-18T01:36:47.012Z** — 2 break(s) applied · 1 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:37:04.568Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:38:24.295Z** — 6 break(s) applied · 3 red alone · 3 compound · 0 not red · 0 skipped
- **2026-09-18T01:39:23.110Z** — 5 break(s) applied · 4 red alone · 0 compound · 1 not red · 1 skipped
- **2026-09-18T01:40:34.278Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 3 skipped
- **2026-09-18T01:40:56.949Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T01:41:16.647Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:41:36.573Z** — 16 break(s) applied · 15 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:45:10.265Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:45:39.544Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:46:22.260Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:47:05.194Z** — 17 break(s) applied · 16 red alone · 1 compound · 0 not red · 0 skipped
