# A door open only while the business is idle is a tutorial, not a door

**Definition-of-done clause, added 2026-09-16.** A door must be reachable **in the state where it is
needed**.

**The case that names the rule:** `+ Add a job` at `public/hubly.html:49452`, rendered inside
`if(!pending.length)` — the dashboard's empty-bookings state. After `ead44be` hid the Jobs-tab
button and the pixel redesign hid the header CTA, this was the **only** surviving way to create a
job by hand. It disappears the moment the owner has a pending booking — that is, exactly when they
are busy enough to need it.

---

## Method, and its false-positive rate stated up front

Derived from the **shape of the condition**, not a list of known empty states: a branch whose test
is an emptiness check (`if(!x.length)`, `.length === 0`), scanned for control markup inside it.

**21 raw hits. Most are false positives** — my window reads 12 lines past the condition, and an
empty branch that `return`s is usually followed by the real rendering, which then looks like it is
inside the branch. **Only the hits I opened and read are listed as confirmed below.** (Lesson 93:
the method reaches "candidate", so the finding says candidate.)

---

## CONFIRMED — read in context

### 1. `+ Add a job` — `hubly.html:49452`, inside `if(!pending.length)`

The original. Job creation, available only with zero pending bookings.

### 2. `schedule one` — `hubly.html:44248` and `:44286`, inside `if(!jobs.length)` / `if(!monthJobs.length)`

**The same feature, twice more.** The Jobs day view and month view each render an empty state whose
button calls `HublyJourneyOS.openJobCustomerPicker()`. So on the day view, the way to schedule a job
exists **only on a day that has no jobs** — and on a day that already has one, there is nothing.

**Three of the four surviving entrances to job creation are idle-only.** Combined with the two that
`ead44be` and the pixel redesign closed, that is the whole picture of why an owner cannot add a job:
not one thing broke, six entrances each became unavailable for a locally sensible reason.

### 3. `Import my offers` — `hubly.html:33006`, inside `if(!list.length)`

**The most expensive one.** The packages editor's empty state offers three doors — *Use starters*,
**Import my offers**, *Add blank*. Import-a-price-list is the door we point owners at in
conversation ("send me a photo of your price list"), and in the editor **it exists only while the
owner has zero packages.** Add one service by hand and the bulk import is gone.

An owner with three services who wants to import twelve more has no way to do it from the editor.

### 4. `Something unique — let's build it` — `hubly.html:24596`, inside `if(!list.length)`

The industry picker's escape hatch, available only when no industry matched. Lower stakes and
arguably correct — an escape hatch belongs in the state you need escaping from — but recorded
because it is the same shape and someone should rule on it rather than assume.

---

## NOT instances — correctly empty-state-only

`approvePendingReview` / `rejectPendingReview` (`:50370`) and the marketplace `Accept` / `Decline`
(`:32173`) are inside branches that **`return` immediately**; the buttons belong to the populated
render below. My window mis-attributed them. The addon-draft seed at `:25484` is a default value,
not an empty state.

---

## The rule, stated so it can be applied

> **Ask of every control: in what state does the owner need this? Is it rendered in that state?**

An empty state is the right place to **teach** a door. It is never the right place for the door to
**live** — because the empty state is, by definition, the one moment the owner has the least use
for it.

**And an empty state is the best place in the product to OFFER THE WAYS** (Adrian, 2026-09-16) —
which is the positive half of the same rule, and why My Day's two empty states were rewritten from
descriptions of an absence into offers of the ways that actually work.
