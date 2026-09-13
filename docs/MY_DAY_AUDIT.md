# My Day — audit (2026-09-13)

**Audit only. Nothing built. No UI coded.**

> **THE SPEC ITSELF IS NOT ON DISK, and that is the first thing to fix.** The instruction was
> to write Adrian's specification to `docs/MY_DAY.md` verbatim before anything else. **The spec
> body did not arrive** — sections 9, 11 and 17 are referenced but their text was not included.
> Nothing here invents it. `docs/MY_DAY.md` is deliberately NOT written rather than written
> from a paraphrase, because a paraphrased spec is worse than no spec: it reads as the
> requirement. **Paste the spec and it goes on disk first.** What Adrian gave in his own words
> IS recorded — `docs/SETTLED.md` #10, #11, #12.

---

## 1. The design already exists — partly, and closer than expected

**Searched:** `public/`, `public/journey-os/`, every file by name, and `git log --all -S` for
each distinctive string. **The screenshot's UI does not exist in the codebase.** Zero hits,
current or historical, for *Must do*, *Nice to do*, *really matter today*, *Today at a glance*,
*Plan my day*, *Add a break*, *Plan tomorrow*, *Day complete*, *Move something*, *Show my week*.

**But the MODEL underneath it does exist, and the first search missed it because I searched for
the screenshot's labels rather than the product's vocabulary.** The repo's own planner
screenshot (`docs/shots/owner-rooms/desktop-planner.png`, 2026-09-08) shows
**"Band C — nothing breaks if it slips"** already rendering.

`public.tasks` carries the whole band model:

| column | what it is |
|---|---|
| `band` | A / B / C |
| `band_source` | who decided — `owner` vs inferred |
| `band_reason` | **why** it is in that band, in words |
| `lane` | work vs personal |
| `rolled_from`, `roll_count` | how many times it has slipped |

`platform-home.html:4781` already renders `Band C — you set this` / `Band C — <reason>`.

**So the gap is the SURFACE, not the model:** the greeting, the "2 things that really matter"
line, the quick actions, the band *labels* (Must do / Important / Nice to do), the glance tiles,
the AI suggestions panel and the week strip. The current room is `hcRenderPlanner` — "Your day",
TODAY / TOMORROW / TO DO, jobs from `hcLoadJobs` plus tasks from `get_business_tasks`, with an
overlap warning. **Closeness: the data is there, roughly a third of the surface is there, the
framing is not.**

**Three builds have already been queued this week for things that existed. This is a fourth
near-miss** — caught only because the repo's own screenshot was read rather than the code
searched for the words in a picture.

## 2. Section 9's rule belongs at `hubly_capability_registry.ts:2360`

That line is already the hard line, and it is already a list of nouns:

> *"NEVER write a price, a customer name, a review, a testimonial, a star rating, a review
> count, 'trusted by N', years in business, a licence, insurance, a certification, an award or
> a guarantee unless it is in the record."*

Adrian's rule **extends it from invented FACTS to invented REASONS** — no fake urgency, no
fabricated norms, no "customers usually expect this". It goes **in that same line**, not a new
one, because a second rule about the same thing in a different place is how the first gets
read as exhaustive.

**And it must be a check, not a comment** — a rule that lives only in a prompt is a preference
(Lesson 42). The check shape: **a reason sentence Hubly gives for a suggestion must trace to a
record value or be absent.** It is the same predicate as `verifiedPlaced` and the same rule as
`servicesTruth` — composed from what actually happened — pointed at *why* rather than *what*.
**Not written yet; it is part of the build, not the audit.**

## 3. Two defects in the current Planner

### (a) The reply repeats itself — CAUSE FOUND

`hcClassicScopeLine()` builds *"I can't change the page text from here — that's edited in Edit
details, and your live site is unchanged at ‹host›."* It is appended **twice in one turn**:

- `platform-home.html:6355` — bare, guarded by `hc._saidClassicScope`
- `platform-home.html:6365` — again, inside the `r.failed` branch, with a lead sentence
  prepended. **This second call is not guarded by `_saidClassicScope`.**

On a classic page where the upgrade also failed, both fire and the owner reads the same
paragraph twice. The guard covers the first call only.

### (b) "Moving whole sections isn't something I can do" — NOT a false claim, but a false REMEDY

**It is client-composed, not model output** — `platform-home.html:6365`, appended by
`hcAppendMessage`. (CLAUDE.md: confirm the model is the one speaking before editing a prompt.
It is not.)

**Its gate is correct.** It fires only when `hc.hasDocument === false`, and
`hcLoadHasDocument` sets `null` — not `false` — on any read failure, with a strict `=== false`
test. So it cannot fire on an unknown. When it fires, the business genuinely has **no
`business_documents` row**, which means it is on the CLASSIC renderer, where
`moveFreeformSection` truly cannot help: that function edits freeform HTML in
`business_documents`, and there is none.

**So the sentence is true about the capability and false about the future.** It says *"that
isn't a temporary problem — reopening won't change it"*, which tells the owner it can never
happen. It can: the page becomes a document via a rebuild, and every freeform capability
applies from that moment. **The defect is a missing route, not a wrong capability gate.**

**AND THE FINDING THAT MATTERS MORE THAN EITHER DEFECT:**

**11 claimed businesses have no document — including `graefs-autocare`, the only live
customer, and `adrians-lawn-service`.** Everything built this week for freeform pages — the
block spec, the services placement, contact/hours placement, structural editing, steps 6 and 9
— **does not reach Graef at all.** He is on the classic renderer. This is already recorded in
`BUSINESS.md:61` and it did not surface in any of this week's planning.

## 4. How a reviewer verifies My Day shows REAL rows

Asked because "no fake data" is the rule we have broken in the other direction — our entire
corpus is our own test data (`SETTLED` #2).

**Not "the code reads from `tasks`". A reviewer must be able to check it without reading code:**

1. **Every row on screen traces to an id.** A task card carries its `tasks.id`, a job card its
   `jobs.id` — so any row can be looked up: `select * from tasks where id = '…'`.
2. **The screen is rendered against two businesses with different data** — `graefs-autocare`
   (4 customers, 2 jobs, 0 tasks) and `hubly-paging-fixture` (250/250/250) — and the numbers
   differ correspondingly. A screen that looks the same against both is not reading rows.
3. **An empty state is shown when a table is empty**, and it says which table. `tasks` has
   **0 rows for every business today**, so a My Day with any task on it before tasks are
   written is fabricating.
4. **The band label traces to `band_source`.** "Must do" must come from `band`, and its
   subtitle from `band_reason` — never from a client-side guess. `band_source='owner'` renders
   "you set this"; anything else renders the stored reason or nothing.
5. **No aggregate is summed from a paginated reader** (D-024), and `get_business_tasks` takes
   `p_from`/`p_to` — a count over a date window is a count over that window, and must say so.

## 5. The nav tension — how both rulings hold

**Section 11:** My Day is the primary workspace item. **Adrian:** a new signup sees only Home,
Website and Settings. **Both hold**, and the reconciliation is: *My Day is primary for an owner
who has clicked through from Home; it is not on the rail for a brand-new signup simply because
the capability exists in code.*

### How the shell decides visibility today

`hcWorkspaces()` (`platform-home.html:4412`) returns the rail's items. It reads `hc.places`,
loaded per business from `business_places`, and intersects with `HC_PLACE_SURFACES`
(`:4404` — `website`, `planner`, `jobs`, `customers`). **A place row exists ⇒ the tab is
painted.** There is no other condition. `hcRenderRail()` renders `[Home] + hcWorkspaces()`.

**How places are created today — and this is the crux:**

| `added_by` | `earned_by` | rows | meaning |
|---|---|---|---|
| `backfill` | null | 34 | a one-off migration |
| `system` | null | 17 | the INSERT trigger, one per business |
| `system` | `booking` | 16 | **a row existed** — a booking |
| `system` | `customer` | 6 | **a row existed** — a customer |
| `system` | `order` / `lead` | 1 each | **a row existed** |

**Every visible place today is painted because DATA EXISTS — which is exactly what Adrian's
layering rule forbids as the sole reason.**

### The smallest architectural change

**The columns to express it already exist. Nothing needs adding to the schema.**

`business_places` carries **`added_by`** (who put it there: `system` / `backfill` / `owner`) and
**`earned_by`** (what data justified it: `booking` / `customer` / `order` / `lead`). Today
`hcWorkspaces()` ignores both and paints anything present.

**The change is one predicate in one function:**

> A place is **painted on the rail** when the owner has ENTERED it — `added_by = 'owner'`, or an
> equivalent explicit "entered" marker. A place that is only **earned** (`earned_by` set,
> `added_by = 'system'`) is **not painted**; it becomes a **door on Home** — "you have 2 open
> bookings → open My Day" — and entering through that door is what sets `added_by = 'owner'`.

That is: `hcWorkspaces()` filters on `added_by`, and Home reads the earned-but-not-entered set
to decide what to offer. **Earned stops meaning visible and starts meaning offerable.**

- **It does not add My Day to the default signup rail** — a new signup has no `owner` rows, so
  the rail is Home, Website, Settings.
- **It does not delete the shell architecture** — `business_places`, the earning rule, the
  trigger and the backfill all stay; only the rail's read changes.
- **Prohibition 5 still holds**: positions stay stable, nothing reorders, and a place that
  appears is announced (prohibition 4) — the announcement is now the Home door, which is better
  than a tab silently appearing.

**One consequence to rule on, not decided here:** the 34 `backfill` and 17 `system` rows would
stop painting for existing owners. Either they are migrated to `owner` (everyone keeps what
they have, and the new rule applies only to new places), or existing owners re-enter through
Home once. **That is a product decision and it is the only genuinely destructive part of the
change.**
