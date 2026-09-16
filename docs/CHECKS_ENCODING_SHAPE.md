# The sweep: checks that encode a shape instead of a rule

**Ordered by Adrian, 2026-09-16, after `check-navigation-destinations` went red because the product
got MORE correct** and the cheapest way back to green was to restore the defect. Lesson 92.

**The test applied to each leg:** *is this the rule, or is this what the code looked like on the day
it was written?* An assertion passes the test if a legitimate improvement cannot turn it red.

**The method, and its limit, stated first.** 136 `check-*.mjs` files. This was not a line-by-line
read of all of them — it was a targeted search for the signature (an assertion about the current
*membership or count* of a registry, list or layout) plus a read of every hit. **A clean result
below means the signature did not appear, not that every leg was audited.** The signature is the
reliable tell and it is what Lesson 92 tells the next person to look for.

---

## 1. THE ONE THAT ACTUALLY FIRED — `check-navigation-destinations.mjs`, fixed

> *"every place a sentence can take someone to is a real **surface**"*

True only because every destination happened to be a rail row the day it was written. When Adrian
ruled that My Day is not a rail row, the leg went red against a correct product, and putting My Day
back in the rail was the cheapest green.

**Fixed:** it now asserts a destination **opens** something — a surface, or Home — and it
**executes the product's own resolver** (`hcResolvePlace`) rather than knowing where `planner` goes.
A second leg names which destinations resolve to Home, so an unbuilt place cannot be quietly routed
there and called reachable.

---

## 2. DELIBERATE TRIPWIRES THAT READ LIKE RULES — one found, now labelled

`check-live-surfaces.mjs` leg 2: *"and nothing else is claimed live yet"*, `kinds.length === 2`.

This **is** a shape assertion and it is **correct on purpose**: the live registry is a promise that a
write repaints what is on screen, so a third kind added without its repaint wired is a promise we do
not keep. It is *meant* to go red, and the right response is to wire the repaint and update the
number — never to delete the kind.

**The problem was that nothing said so.** A shape assertion that does not announce itself is
indistinguishable from one that encodes yesterday's layout by accident, and the two want opposite
responses. It now carries `[TRIPWIRE]` in its leg name and a comment saying which direction the fix
goes.

**This is the general remedy for the category: label the tripwire, in the leg name, where the person
staring at a red result will read it.**

---

## 3. THE SYSTEMIC ONE — 44 constant-length legs across the `check-m2-*` family

Twelve milestone-proof files carry **44** assertions of the form `X.length === N`:

| | |
|---|---|
| `check-m2-epic8` | 7 |
| `check-m2-epic0`, `epic4`, `epic10` | 5 each |
| `check-m2-epic11`, `epic9` | 4 each |
| `check-m2-epic2`, `epic6` | 3 each |
| `check-m2-epic12` | 2 |
| `check-m2-epic1`, `epic3`, `epic5` | 1 each |

Examples: *"Seven stages"* (`CREATIVE_BUILD_STAGES.length === 7`), *"Four weeks"*,
*"Categories" === 6*, *"Pipeline complete" === 7*.

**Every one of these is Lesson 92's shape.** Add a legitimate eighth stage and the check goes red;
the cheapest green is to delete the stage. They certify that a spec has the structure it had on the
day it was certified — which is a real and different job from guarding a rule.

**NOT CHANGED, and the reason is not laziness.** These are *milestone certifications*: their whole
purpose is to freeze a delivered shape so it cannot silently erode. That is legitimate, and
rewriting 44 legs into property assertions would dissolve the certification they exist to provide.

**What they need is the same labelling as §2** — so that a future session meeting a red
`"Seven stages"` knows it is looking at a frozen certification and not a broken rule, and updates it
deliberately rather than deleting work to get green. **Flagged for Adrian, not done**: it is 12
files of mechanical edits and it changes no behaviour, so it should be scheduled rather than
smuggled into a build round.

---

## 4. STALE FIXTURE DATA — one found, fixed

`check-nothing-squeezed.mjs` seeded `places: ["website", "planner", "jobs", "customers"]`. `planner`
stopped being a surface on 2026-09-16. Harmless today — `hcWorkspaces()` filters unknown kinds — but
it is a fake asserting a world that no longer exists, and `owner-rig.mjs`'s own stated principle is
that a fake must describe the world owners live in. **Fixed.**

This is the quieter cousin of the whole lesson: a fixture that encodes an old shape does not go red,
it goes **green about the wrong world**.

---

## What the sweep did not find

No other check asserted the composition of `HC_PLACE_SURFACES`, `HC_ROOMS`, `HC_GO_PLACES` or the
rail. `check-day-is-reachable` and `check-conversation-is-the-surface` both reference `planner`, but
as a *destination they ask for* — a request that still resolves — not as a claim about what the rail
contains. Those are rules, and they survived the ruling unchanged.

---

## 5. THE FIXTURE SWEEP — count and the worst three (2026-09-16)

**The rule Adrian set:** *a fixture that names a product surface DERIVES it from the product; it
does not restate it.* A fixture is a claim about the product, and it rots silently — **it does not
go red, it goes green about the wrong world.**

**Count: 7 files restate a surface, place or route name as a literal; 48 literal occurrences.**

`backfill-business-places.mjs` · `check-conversation-is-the-surface.mjs` ·
`check-nothing-squeezed.mjs` · `measure-squeeze.mjs` · `shot-owner-rooms.mjs` ·
`lib/personality.mjs` · `lib/owner-rig.mjs`

### The worst three, and why

| file | what it restates | why it is the worst kind |
|---|---|---|
| **`scripts/measure-squeeze.mjs:73`** | `const modes = ["home","website","planner","jobs","customers"]` | It **iterates** this list to measure every surface. `planner` is no longer a mode, so it now measures a surface that does not exist — and worse, **any surface added later is silently not measured at all.** A layout sweep that quietly skips a surface reports "clean" about a screen it never looked at |
| **`scripts/shot-owner-rooms.mjs`** | the same five, plus a hardcoded `places:[{kind:'website',…}]` seed | It produces the **screenshots we look at and judge design from**. A stale list here means the pictures show a world that no longer matches the product, and a picture is believed harder than a number |
| **`scripts/lib/owner-rig.mjs`** | `places` defaults to a literal `[{ kind: "website", … }]` | It is the **shared** fake — every check that installs it inherits the claim. Its own header argues that a fake which differs between checks is "a second opinion about what the product's world looks like"; a fake that differs from the *product* is the same defect one level up |

**Not rewritten, as instructed — the count and the three are the deliverable.** The fix shape for
all of them is the same and is already available: `window.hublyNavUI.surfaces` exposes the real
registry, so a fixture can derive the list instead of asserting one.
