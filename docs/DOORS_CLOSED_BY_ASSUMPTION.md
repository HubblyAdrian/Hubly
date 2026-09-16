# The sweep: doors closed by mutual assumption

**The shape, named 2026-09-16** (see `docs/CHECKER_LESSONS.md`):

> **Two entrances to the same working feature, each removed because the other existed. Neither
> removal is wrong on its own. The feature is intact and unreachable.**

Distinct from **built-and-doorless**, which is a feature that never had an entrance. This one had
two, and is harder to see because every commit involved is individually correct and carries a
written rationale.

---

## CORRECTED 2026-09-16 — two of the three "confirmed" entries in the first version were WRONG

**The first version of this sweep reported three confirmed instances. Only one survives.** The
method was the defect, and it is worth keeping the wreckage visible rather than quietly editing it.

Step 4 — *does anything ever un-hide it?* — was implemented as a grep for
`getElementById('<id>')` and `remove('hidden')`. **That greps a CALL SHAPE, not the id.** It cannot
see a reveal through:

- a **helper**: `wsPageEl('ws-quiz-entry')`
- an **array literal**: `['nc-pick-contact'].forEach(id => document.getElementById(id))`
- a **variable**: `btn.classList.remove('hidden')`

**I wrote that limit into this file** — *"a control listed below as never-revealed is
high-confidence, not certain"* — **and then listed three as CONFIRMED anyway. Stating a limit and
then reporting past it is the same defect as not stating it.** It is Lesson 89's direction, too: the
reassuring finding here is "I found three doorless features", and nobody re-greps a good story.

| first version said | actually |
|---|---|
| `openServiceQuiz()` — CONFIRMED closed | **WRONG.** `hubly.html:40229` — `quizBtn.classList.toggle('hidden', !hasTaggedServices \|\| isEditorViewOpen())`. It is revealed when the business **has tagged services**, which is a correct content gate — the very "gate on the content, never on our bookkeeping" rule |
| `pickContactInto('customer')` — CONFIRMED closed | **WRONG.** `refreshContactImportButtons()` toggles it on the Contacts Picker feature test, and is called from `openM('m-new-lead')` and `openM('m-new-cust')`. It is correctly gated: offered only where the browser supports it. **And I told Adrian it was "a door that already exists for not typing a phone number twice" — it exists and it is already open** |

**The corrected discriminator** is to search for the id **as a string, anywhere**, and then read
every hit. Re-run with that, plus a fix to the CSS extractor (the first pass read `.ni[hidden]` as
"`.ni` is hidden", which is a different claim and produced 27 false positives):

> **43** hidden controls with a handler · **1** conditional at render · **33** referenced by id
> somewhere · **9** never referenced at all.

---

## CONFIRMED — after the correction

### 1. `openJobsNew()` — the New Job drawer, and the third door is worse than no door

| | |
|---|---|
| door A | `hubly.html:11179` `class="nav-jobs-new" hidden aria-hidden="true"` — plus **six** CSS rules in `operate-pixel.css` (`:171`, `:4471`, `:4474`, `:4475`, `:4476`, `:6066`), **none of which ever shows it** |
| door B | `hubly.html:11290` — the header CTA `ead44be` deferred to. `.jos-legacy-bar` → `display:none !important` under `jos-pixel` |
| door C | `hubly.html:49447` — **`+ Add a job`, and it is LIVE** |

**Door C is the finding.** It is rendered inside the dashboard's *empty bookings* state:
`if(!pending.length){ … onclick="openDashNewJob()" … }`.

**So the only surviving way to create a job by hand disappears the moment the owner has a pending
booking** — that is, exactly when they are busy enough to need it. A door that is open only while
the business is idle is not a door; it is a tutorial.

`openJobsNew()` itself remains defined at `:41418` with its only caller the hidden button.

### 2. `openBlockTimeModal()` — no live door at all

| | |
|---|---|
| door A | `hubly.html:11292`, `.jos-legacy-bar` → `display:none !important` |
| door B | `openDashBlockTime()` at `:49835` — **defined, and never called by anything** |

Blocking out time has **no reachable entrance** in that shell. (In `platform-home.html` the day's
add row can create a block, so the capability is not lost to owners who live there — but the shell
that has the modal cannot open it.)

---

## A SEPARATE SHAPE — DEAD CODE THAT LOOKS ALIVE

**A closed door is honest about being closed. This lies to the next reader.**

Named by Adrian, 2026-09-16, and distinct from everything above: **the JS still manages the
control's visibility, and a stylesheet has permanently overruled it.** Anyone reading the
JavaScript concludes the control is reachable and conditional; it is neither.

**Swept:** 13 classes carry an unconditional `display:none !important` in `operate-pixel.css`;
cross-referenced against every `id`-bearing control whose id is manipulated for visibility in JS.

### The one instance

| | |
|---|---|
| control | `hubly.html:11296` — `#bar-qq-btn`, **Quick Quote**, `class="… jos-legacy-bar"` |
| the JS | `getElementById('bar-qq-btn')?.classList.toggle('hidden', v === 'quotes')` — still runs, every time |
| the CSS | `#p-app.jos-pixel .jos-legacy-bar { display:none !important }` — unconditional |

The toggle is live code maintaining a state nobody can observe. **Nothing deleted**, per
instruction — recorded so the decision is made deliberately: either the stylesheet stops hiding it
and the toggle means something again, or the toggle goes and the control is honestly retired.

**Why only one:** the sweep requires an *unconditional* hiding rule. A rule guarded by `:not()` or
an extra state class is a real conditional, and JS toggling against it is ordinary behaviour, not a
lie. That distinction is what separates this list from noise — and it is the same distinction the
first version of this document got wrong when it read `.ni[hidden]` as "`.ni` is hidden".

---

## RETIRED ON PURPOSE — not this shape

`hubly.html:11211, 11243–11246` — nav items `marketing`, `opportunities`, `activity`, `growth`,
`marketplace`, all `class="ni jos-nav-hidden" hidden aria-hidden="true"`. The class name *says* it:
these are deliberately retired destinations, not doors closed by accident.

---

## What to do with this

**None of it is built in this round.** Items 1 and 3 are on Adrian's list already — A ("reopen
`ead44be`: unhide the New Job drawer. The feature is intact. This is the cheapest real win on the
list") and A2 (carry-forward). Item 2 needs its own ruling: a customer-facing quiz is a product
decision, not a door to open because it happens to exist.

**And the standing check the shape implies:** when a control is removed with a rationale that names
another control, **that other control is now a dependency**. Say so in the commit, or the next
removal is free to take it.
