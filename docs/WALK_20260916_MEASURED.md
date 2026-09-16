# The walk of 2026-09-16, measured — items 1 to 4

Read-only measurement first, then what was fixed. Every timestamp is UTC and comes from the row,
not from a recollection. Two businesses, both `account_kind = 'test'`:

- `hubly-classic-fixture` (`5ebedc20-1061-46b9-b393-a6ef57225910`, **claimed**) — seq 30–47
- `apollo-weeds` (`6b293f34-a996-4d6b-a8c7-b21712dd4b7a`, unclaimed draft) — seq 1–11

**The client running during both sessions was `fb25916`, pushed 2026-09-16 02:04:23Z.** Every turn
below is after that, so the no-silence floor and the envelope display guard were both live. The
`hcPersist` envelope fix (`3dabd73`, pushed 02:39:16Z) was **not** — which is why seq 47 stored.

---

## The record, in full

| seq | who | at (UTC) | what |
|---|---|---|---|
| 32 | owner | 09-15 20:24:48 | "show me my schedule this week" |
| 33 | Hubly | 09-15 20:25:00 | `{"action":"reply","message":""}` — **stored raw** |
| 34 | owner | 09-15 20:27:52 | "change the driveway job to 3 PM" |
| 35 | Hubly | 09-15 20:28:00 | "I couldn't find a job matching "driveway job."" |
| 36 | owner | 09-15 20:28:10 | "change the driveway to 3 PM" |
| 37 | Hubly | 09-15 20:28:23 | "Driveway is now set for September 17 at 3:00 — 14 Maple St, $180." |
| 38 | owner | 09-16 02:23:36 | "show me my schedule this week" → **no assistant row** |
| 39 | owner | 09-16 02:24:35 | "change the driveway job to 3 PM" → **no assistant row** |
| 40 | owner | 09-16 02:25:01 | "chage the job at 3 pm on sept 17 to 4 pm" → **no assistant row** |
| 41 | owner | 09-16 02:26:54 | "add a job for window washing at 8:00 PM on sept 17 at 2:00 PM" |
| 42 | Hubly | 09-16 02:27:02 | "I see two times there — should the window washing job … be at 8:00 PM or 2:00 PM?" |
| 43 | owner | 09-16 02:27:25 | "i meant 8" |
| 44 | Hubly | 09-16 02:27:32.467109 | "Window washing is saved for September 17 at 8:00 PM." |
| 45 | Hubly | 09-16 02:27:32.467109 | "I didn't get those down — say them again?" |
| 46 | owner | 09-16 02:27:46 | "now show me my schedule" |
| 47 | Hubly | 09-16 02:27:55 | `{"action":"reply","message":""}` — silenced on screen, **stored** |

**It is three consecutive silent turns, not two.** seq 38 is a READ ("show me my schedule this
week"). The silence is not specific to writes, which rules out the writer as the sole cause.

---

## 1. THE SILENT SUCCESS — why a turn produced no assistant row with the floor live

**The floor spoke to the screen and never to the record.** `hcEnsureTurnSpoke` called
`hcAppendMessage` and `hcNoteSaid` and stopped. `hcAppendMessage` renders; `hcPersist` stores; they
are separate functions and the floor only ever called the first.

So the absence of a row **does not establish that he was told nothing.** It establishes that nothing
was stored. Those are different claims and `business_conversations` cannot tell them apart — the
empty reader telling you about itself, one more time.

**The knowledge was already in the file.** Three hundred lines above the floor, beside `hcViewCount`:

> *"neither this view's sentence nor the no-silence floor is persisted, so a turn that worked and a
> turn that died look identical in `business_conversations`."*

Written down, beside the code, and not fixed. See Lesson 90.

**AND THE FLOOR'S SENTENCE WAS WRONG FOR THIS EXACT CASE.** `hcSilenceLine` had three branches and
everything else fell through to *"I couldn't work out how to do that one, so nothing happened."* That
final branch covered `ran > 0 && failed === 0` — **every action succeeded and only the reply was
lost.** The floor built to end silence told the owner his change had not been made while the row sat
written. Red-proof B reproduces it verbatim.

**FIXED** (`public/platform-home.html`, Vercel path — needs a git push to be live):
- a fourth branch: a turn with at least one `ok && real` action says *"That's done and saved. Take a
  look and tell me if it isn't what you meant."* It does **not** name what changed — the actions log
  carries capability names, not a human sentence, and inventing one is the fabrication rule.
- `ok` without `real` is **not** a change. `proposeServices` returns `ok:true, real:false` precisely
  because nothing was published; it must not buy a "saved".
- the floor now calls `hcPersist`, so what it says reaches the record.

`scripts/check-no-silent-turn.mjs`: 16 assertions, was 11. New: **5b** (no sentence claims failure
over a change that landed), **5c**, **12–14** (a turn that writes and says nothing reaches both the
screen and the record, and they say the same thing). Leg 14 requires the row to exist so it cannot
pass vacuously.

**Red-proofed, twice:**
- remove `hcPersist` from the floor → 13 and 14 FAIL.
- disable the success branch → 5b, 5c and 14 FAIL, and 14 prints the sentence the owner actually got:
  *"I couldn't work out how to do that one, so nothing happened."*

---

## 2. THE TURN THAT SUCCEEDS AND FAILS AT ONCE — seq 44/45

Both rows carry `02:27:32.467109Z` **to the microsecond** because they went into one
`hcFlushPersist` batch. The window-washing job row was created at `02:27:29.951946Z`. The write
landed, Hubly said so, and Hubly then said the opposite.

**`capture_miss_events` dates the second sentence and names what it thought it had missed:**
`02:27:31.905919Z`, `asked_for = 'services'`. Not inferred — a row.

The chain, all three links required:

1. The seq-42 disambiguation question ("8:00 PM or 2:00 PM?") carried `askedFor: "services"`. Which
   of the two paths set it — the model's own `decision.askedFor`, or `proposedServiceOffer` — **is
   not recoverable**: nothing records a turn's response envelope. Stated as unknown, not guessed.
2. `answerLooksPresent` for services is `/\d/ || /,/`. **"i meant 8" contains a digit**, so the
   answer "looked present".
3. `attempted = relevant.length > 0`, where `relevant` is the turn's actions **filtered to the ones
   that write this fact** (`setServices`). The turn ran `addJob`. The filtered list was empty, and an
   empty list was read as *"the server never tried"*.

Link 3 is the defect. **An empty filtered list means "nothing I know how to look for", never
"nothing happened".** Lesson 86, inside a guard.

**FIXED.** The gate is no longer a list of action names — the next capability added would be missing
from it too. It is the closed set on the other side: **a turn that changed nothing real cannot have
consumed his answer.** `changed = actions.some(a => a.ok && a.real)`.

**And the silence that creates is counted, not assumed harmless** (Lesson 89 applied to my own fix,
so it does not become instance five of the no-trace shape). Migration
`20260916120000_capture_miss_outcome.sql`, **applied one at a time via `supabase db query --linked`**,
adds `capture_miss_events.outcome`:

- `reasked` — detected and asked again (all 3 existing rows, backfilled; provable from the code,
  which had no path that recorded a miss without also speaking)
- `quiet` — detected and deliberately unspoken. **A rising `quiet` count is a real fact going
  uncaptured behind a successful turn.** Nothing watches this yet; it is an instrument.

`scripts/check-no-contradicting-reask.mjs` — 6 assertions, executing the shipping guard. Red-proofed:
restore the old gate and legs 1 and 2 fail, leg 1 printing *"I didn't get those down — say them
again?"* against the walk's own turn.

Leg 6 closes a pre-existing blind spot on the way past: the **capped third miss** was silent *and*
unrecorded. It is now recorded as `quiet`.

---

## 3. "I COULDN'T DO IT" OVER A SUCCESSFUL WRITE — the business name. READ-ONLY.

**It is the same bug as item 1**, and `businesses` has the column `jobs` lacks, so this one is dated
rather than inferred.

| | |
|---|---|
| seq 10, owner, `03:08:48.547583Z` | "change business name to Apollo Weeds" |
| `businesses.updated_at` | **`03:08:52.101862Z`** |
| gap | **4.0 seconds** |
| `businesses.name` now | `Apollo Weeds` |
| assistant rows for seq 9, 10, 11 | **none** |

The write landed. The only sentence the shipping floor could produce for that receipt shape was
*"I couldn't work out how to do that one, so nothing happened."* — which is what Adrian reports
seeing. Those two agree and they share nothing (one is the database, one is his eyes), so it is
corroboration rather than one source counted twice (Lesson 85).

### The slug and the public URL both moved, and nothing said so — MEASURED ACROSS THE CORPUS

**The denominator first: `account_kind = 'market'` is ZERO.** Every case below is one of our own
test drafts. This is a defect count, not a customer count.

#### Every turn in which Hubly named an address that is not the address today

Searched `business_conversations` for any assistant turn containing `*.myhubly.app` and compared the
named slug with the business's slug now. **Three turns, in the whole corpus:**

| told | now | when | does the told address resolve today? | any turn mentioning the change? |
|---|---|---|---|---|
| `site-e888ea` | `bright-clear-window-care` | 2026-09-10 21:36 | **no — zero rows hold it** | **none** |
| `toms-clean-gutters` | `toms-gutters-more` | 2026-09-12 01:27 | **no — zero rows hold it** | **none** |
| `apollow` | `apollo-weeds` | 2026-09-16 03:07 | **no — zero rows hold it** | **none** |

All three said the same sentence: *"The address {slug}.myhubly.app is reserved for you. Making an
account takes about ten seconds and puts it live."*

**The only turn that ever mentions an address is the promise itself.** Across all three businesses,
every assistant turn matching `address|link|url|myhubly` is that one line. Not one turn, before or
after, mentions that the address changed.

#### `business_slug_history` — 12 rows, and it is not a complete record

| old | new | at | reconstructed? |
|---|---|---|---|
| `site-e93b28` → `crestview-window-cleaning`, and 5 more | | 2026-09-12 20:04:21 | **yes — all six, one timestamp, a backfill** |
| `site-92b962` | `ironwood-fence` | 2026-09-12 20:40 | no |
| `site-3d9849` | `canyon-ridge-tree-care` | 2026-09-13 02:05 | no |
| `site-f05bd8` | `payson-chimney` | 2026-09-13 02:38 | no |
| `site-9212f3` | `apollow` | 2026-09-16 03:07:04 | no |
| `apollow` | `apolloweeds` | 2026-09-16 03:07:20 | no |
| `apolloweeds` | `apollo-weeds` | 2026-09-16 03:08:52 | no |

**apollo-weeds was renamed three times in 108 seconds**, and the address we put in writing at
03:07:08 was already superseded twelve seconds later.

**THE TABLE IS NOT SUFFICIENT ON ITS OWN, AND THAT MATTERS FOR ANY CHECK BUILT ON IT.** It holds
`site-915f21 → toms-gutters-more` and nothing else for that business — but the conversation shows
Hubly naming `toms-clean-gutters.myhubly.app` on 2026-09-12. That intermediate slug **is not in the
history at all**: the six `reconstructed` rows are a two-point inference drawn after the fact, and
they demonstrably lose the states in between. A reconstructed row is a memory of a rename, not a
record of one (Lesson 91). The third case was only found because the conversations were read too.

#### The proposal, designed against Adrian's ruling — NOT BUILT

> *"If we change an address we told an owner to expect, WE SAY SO IN THE SAME TURN, IN WORDS."*

`syncDraftAddress` (`hubly-conversation/index.ts:1424`) is already the one place that notices. It
re-reads the slug on every turn, compares it with the one the client holds, swaps the new address
into `draftBusiness`, and `console.log`s the move. It is the right seam and it currently ends in a
log line.

The shape: it already knows `draftBusiness.slug` (old) and `live` (new). It should return that pair,
and the turn should carry one plain sentence — *"One thing — the address changed to
apollo-weeds.myhubly.app, and the old one won't work any more."* Composed client-side or as a
declared interim message, **not** left to the model, for the reason `hcPostBuildFollowup` already
records: a prompt edit cannot make a turn happen that the model was never asked to produce, and this
must fire on a mechanism, not on the model remembering.

**Stopped here deliberately** — the instruction was to bring the table before proposing a fix, and
the proposal is above rather than in the code.

#### Does the floor fix we shipped cover the "I couldn't do it" half? YES — and only that half.

**It does.** The rename runs through `business.updateDraft`, which returns `ok: true, real: true` on
a successful `patch_business_in_progress` (verified in source, `hubly_capability_registry.ts`). The
floor's new fourth branch fires on exactly that receipt, so the sentence for seq 10 is now *"That's
done and saved. Take a look and tell me if it isn't what you meant."* instead of *"I couldn't work
out how to do that one, so nothing happened."* The disease was the same one: **the turn's outcome
was not derived from what actually happened.** It is derived from the receipt now.

**It does not cover the address.** The floor says a change landed; it cannot say *which* change,
because the actions log carries capability names and not a human sentence — and it must not invent
one. So the owner is now correctly told his rename worked, and is still not told that the web
address he was promised has stopped resolving. That is the unbuilt proposal above, and it is the
half that reaches a customer.

## 4. MY DAY'S RAIL DESTINATION — the ruling is held; the check shipped anyway

**Open, for Adrian.** `my-day-2026-09-16-final.png` draws the rail as **Home · Website · Settings**
with the account at the foot. `my-day-2026-09-15-approved.png` drew **Home · My Day · Website ·
Settings**. The code today has `HC_PLACE_SURFACES = website, planner("My Day"), jobs, customers` with
`HC_RAIL_DEFAULT = website, planner`. Which of those is right is a design ruling, not a defect.

**`scripts/check-navigation-destinations.mjs` shipped regardless, and holds for either answer.** Five
registries decide where a person can be sent and none knows about the others:

| registry | decides |
|---|---|
| `HC_PLACE_SURFACES` | what may appear as a row in the rail |
| `HC_RAIL_DEFAULT` | what a new business is offered without asking |
| `HC_ROOMS` | what can actually be rendered when a row is clicked |
| `HC_GO_PLACES` | where a **sentence** can take someone |
| `HC_THREAD_VIEWS` | what can be **counted**, which the door does before it moves anyone |

Seven assertions, executing the real objects and the real door: every rail row opens something;
nothing renders a room the rail can never reach (both sides); every sentence-destination is a real
surface; **every door can count its room before offering it** (this is the leg that catches *"Your
schedule isn't set up on this account yet"* said to a man with two jobs on it — the door counts by a
different key than it navigates by, `planner → day`, exactly the seam a grep walks past); defaults
are a subset of surfaces; an unknown place is refused; and the refusal names no button.

Red-proofed by adding the two surfaces the source itself lists as *pending* — `leads` to the rail and
`store` to the doors — which fails legs 1, 3 and 4. That is the real future mistake, not a synthetic
one.

---

## FOUND ON THE WAY

*(The time grounding described under item 3's follow-up is now FIXED and deployed — see
`docs/TIME_GROUNDING.md`. The rest of this section is open.)*

### RESOLVED — the driveway job's 17:00 was Adrian's own hand edit. It is evidence of nothing.

**Adrian set that time himself, by hand, after the walk.** There is no defect here and no future
session should re-open it. What the row shows is exactly what he did to it.

The creation value was correct: `check-day-is-reachable.mjs`, written 2026-09-15, records the job
as `2026-09-17 14:00` — which is the "Thursday at 2" he typed. The walk then reported it set to
"3:00" (seq 37). The `17:00` came afterwards and came from him.

**Kept because the chain that produced the alarm is the thing worth remembering, not the time.**
An earlier session read `17:00` as *"the 4 PM seq 40 asked for"*. 17:00 is 5 PM. That reading was
never re-derived from the rows; it was carried forward as a premise, written into a report, and
became a headline. The data turned out to be fine, so nothing broke — **the mechanism is the
finding**, and it is Lesson 91.

### The class behind item 1: Hubly speaks and the record does not keep it

`hcAppendMessage('hubly', …)` appears **83 times** in `platform-home.html`; **10** are paired with
`hcPersist`. Most of the remaining 73 are transient chrome that should not persist ("One moment — I'm
still working on the last thing", file-format errors, drag hints). **These are answers, and they are
lost on reload** — left, with line numbers, rather than fixed in one sweep:

| line | sentence | why it matters |
|---|---|---|
| 5820 | "Got it — I've added {label} to your sidebar…" | prohibition 4's announcement, gone on reload |
| 3683/3686/3687 | the owner's-name capture replies | the only record that we asked and he answered |
| 7816–7818 | "One new booking came in." / "N people asked…" | the news, unrecoverable after a refresh |
| 8757 | "There's nothing on your {place} yet…" | an answer to a question he asked |
| 10120 | "Saved to your account — this page is yours now." | the claim confirmation itself |
| 4675 | "Welcome back — here's the page you built." | arrival, arguably transient |
| 3639 | "I'm having trouble connecting right now…" | **cannot** persist — the network it needs is the one that failed |

`public/hubly.html` has **no `hcAppendMessage` at all** — a different shell with different function
names. It has not been swept for this class.

### hcFlushPersist drops its buffer on unload

On a failed flush the batch is kept and retried only when a *later* `hcPersist` reschedules the
timer. If the owner says nothing else, the batch dies with the tab. No row records it.

---

## THE NEXT WALK IS THE DATA SOURCE — what to type to fill the audit

`record_claim_audit_events` only writes when someone uses the product, so the walk that proves these
fixes should also be the walk that fills it. The audit fires on turns where **Hubly states a count, a
name, a status or a date about his own records**, so the questions below are chosen to force exactly
that — and each one doubles as a proof of something fixed today.

Ask these, in this order, as the signed-in owner:

1. **"how many jobs do I have this week?"** — a COUNT about his records. Also exercises
   `OPEN_ITEM_COUNT_READERS` (handlers that return collections where the reply states a number).
2. **"who's my next customer and when?"** — a NAME and a DATE together.
3. **"what's the status of the driveway job?"** — a STATUS, on the row whose time is in question.
4. **"change the driveway job to 2 PM"** then, immediately, **"show me my schedule"** — the exact
   shape of items 1 and 3. *A reply must appear, and it must still be there after a refresh.*
   **Reload the page and check the thread** — that is the leg no harness here can run.
5. **"add a job for gutter cleaning friday at 9am"** followed by **"actually make it 10"** — a write,
   then a change to it, with an answer to a pending ask in the middle if one is on the floor. This is
   the seq 43–45 shape; nothing should contradict itself.
6. **"change my business name to …"** on a draft — watch whether the address changes under you and
   whether anything says so (item 3, unfixed by design).
7. **"take me to my customers"** and **"take me to my leads"** — one real place, one that is not a
   place. The second must refuse without naming a control.

Then read, in one go:

```sql
select outcome, count(*) from record_claim_audit_events group by outcome;
select outcome, asked_for, count(*) from capture_miss_events group by 1,2;
select outcome, count(*) from envelope_suppression_events group by outcome;
```

**And the thing to look at, not measure:** after step 4, reload. If his messages come back with no
reply under them, the fix did not take.
