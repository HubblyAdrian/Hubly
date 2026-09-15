# One design for B, C and the no-refresh rule

**Status:** design only. No code written. 2026-09-15.

> "when people change something they shouldn't have to refresh to see it. it should auto do it."
>
> "if they want to just add it here we need to help them by letting them add it from here. or
> change it or add event recurring etc. some people might not want to go to the tab you know?"
> — Adrian

**THE LAW.** A write that succeeds updates every surface showing the thing it changed, in the same
turn. If a surface cannot update, we say so in words. We never leave a stale value on screen
looking correct, and **we never tell an owner to refresh.**

These are one design because they are one missing thing: **nothing in the shell knows what is
currently on screen.** B is that gap on the way out of a write; C is the same gap on the way in —
a view that cannot be told to re-read also cannot be told to accept an edit. Solving them apart
means two registries of the same fact.

---

## 0. What was measured first

Counted in `public/platform-home.html`, not recalled.

**Three of the four thread views load from one place.**

| view | loader | card | grouped |
|---|---|---|---|
| `day` | `hcLoadJobs(biz.id, today, today+7)` | `hcRecordCard` | no |
| `jobs` | `hcLoadJobs(biz.id, null, null)` | `hcRecordCard` | no |
| `week` | `hcLoadJobs(biz.id, weekFrom, weekTo)` | `hcRecordCard` | **yes** |
| `customers` | `get_business_customers` | `hcRecordCard` | no |

`HC_THREAD_VIEWS` already gives every view the same four-part shape — `load` / `parts` / `open` /
`empty`. **So "thread views are live" is one build at that declaration, not four builds at four
renderers.** This is the single most load-bearing measurement in the document.

**A job can be on screen in five places at once.**

`hcAppendJobCard` (a card in the thread) · `hcRenderWeekGrid` (a row in the week grid) ·
`HC_THREAD_VIEWS.day` / `.jobs` (rows in a day or jobs view) · `hcRenderPlanner` (the My Day
canvas) · `hcRenderJobs` (the Jobs room canvas). Adrian hit exactly this: he changed the driveway
job, the confirmation was correct, and the **week grid three lines above still read 2:00 PM.**

**The greeting/chip pair is the same bug with a different record.** Both already consult one
reader — `hcRenderIdentity` calls `hcOwnerFirstName()`, the chip calls `hcOwnerLabel()`. And
`hcAcceptOwnerName` already re-renders **two** surfaces on success:

```
if(v === 1){ try{ hcRenderRail(); hcReflectAuthState(); }catch(e){} }
```

`hcReflectAuthState` redraws the chip. **`hcRenderIdentity` is not in that list.** That is item G
in full: not a stale reader, not a caching bug — a hand-written list of surfaces to refresh that
was missing one. Which is precisely why the list must stop being hand-written per writer.

**Every writer the client calls today:** `create_task`, `set_task_status`, `update_business_job`,
`set_owner_display_name`, `add_business_place`, `mark_business_events_seen`,
`mark_owner_welcomed`. Plus the talk lane's `business.addJob`, `business.updateJob`,
`business.setServices`, `business.setHours`, `business.name`, `business.logo`. **Fourteen writers,
and not one of them knows what is on screen.**

---

## 1. The registry: what is on screen, and what it is showing

One module-level array. No framework, no observers, no reactive layer. This is one HTML file and a
set of render functions, and the design must stay that size.

```
hcLive = [
  { id, kind, key, el, redraw, describe }
]
```

- **`kind`** — the RECORD KIND, not the view. `'job' | 'task' | 'customer' | 'ownerName' | 'place'`.
  This is the whole reason the mechanism generalises: a job changes, and every surface registered
  as showing `'job'` is told, whether it is a week grid, a day list or a single card. The greeting
  and the chip both register `'ownerName'` and G disappears as a special case.
- **`key`** — which records, when a surface shows a subset. `{ from, to }` for a week grid,
  `{ id }` for a single job card, `null` for "all of this kind". Lets us skip a surface that
  provably cannot be showing the changed record, and — more importantly — **prevents us silently
  skipping one we are not sure about. An unknown key means refresh it.** Asymmetric costs: a
  needless re-read costs one query, a skipped one leaves a lie on screen.
- **`el`** — the DOM node the surface owns. **The liveness test is `el.isConnected`.** A surface
  whose node has left the document is dropped at the next pass. No unregister discipline to
  forget, no leak, no stale handle. This single choice removes the entire class of "I forgot to
  deregister" bugs that a registry usually brings.
- **`redraw(rows)`** — re-render **in place**, into `el`, from freshly loaded rows.
- **`describe()`** — a human phrase for this surface ("the week of Sept 14", "your day"), used
  only when we have to tell the owner in words that it could not update.

Registration happens where a surface is drawn, in one line, next to the drawing. A surface that
forgets to register is simply not live — it does not break, and the omission is visible to a
check that asserts every renderer in a known list registers.

---

## 2. After a write that succeeds

```
hcAfterWrite(kind, key)
```

1. **Read the table, not the writer.** One load per `kind`, shared by every surface of that kind —
   not one per surface. A writer's own `ok` is not the record (prohibition 3); the checkbox
   already works this way and it is the pattern being generalised, not invented.
2. **For each live surface of that kind**, in registration order, call `redraw(rows)`.
3. **A surface that throws, or whose `el` has left the document mid-pass, is not silently skipped** —
   it is collected and reported in step 4.
4. **Say what happened.** The confirmation sentence is composed from what actually updated, the
   same discipline as `servicesTruth`. If every surface updated, the ordinary confirmation stands
   alone — no "and I refreshed the grid", because the owner can see the grid. If one did not, the
   sentence names it: *"Moved it to 3:00 PM. The week grid above didn't refresh — open it again to
   see the change."* Honest, specific, **and it still does not say "reload the page."**

**THE THREAD IS NEVER WIPED TO DO THIS.** `hcRenderHome` opens with `thread.innerHTML = ''` (line
4744) and that wipe ate the arrival once already. Re-rendering a surface means writing into that
surface's own `el` and nothing else. Concretely: **a surface's `redraw` may only touch nodes inside
its own `el`**, and a check asserts that a `redraw` pass leaves the thread's total message count
unchanged except within the redrawn element. The registry makes this enforceable because `el` is
recorded — without it, "re-render the week grid" has no boundary and reaches for the nearest
container, which is the thread.

---

## 3. After a write that FAILS

Optimistic where safe and reversible, exactly as the checkbox now works.

1. **Show it** — the row moves to 3:00 PM immediately, marked pending (`aria-busy`, a subdued
   state, never a green tick — prohibition 2, green is earned).
2. **Write it.**
3. **Read it back from the table**, never from the writer's `ok`.
4. **On success:** clear pending, run `hcAfterWrite`. The value on screen is now the value in the
   table, because it came from the table.
5. **On failure:** **put it back.** The row returns to 2:00 PM — the last value we actually read —
   and a sentence says what happened, with a distinct message per cause (prohibition 3): not
   signed in / not your job / couldn't be read back / something refused it. **Never a stale value
   left looking correct, never "refresh", never "something went wrong."**

The read-back is what makes optimism honest. Without it, step 4 is a guess wearing a tick.

---

## 4. A week-grid row becomes editable — and where recurrence lands

Every row in every view is already `hcRecordCard`, and pressing one already calls
`view.open(record)`. So the edit affordance goes **on the card, once, for all four views** — not on
the week grid.

A row carries, on press: **Change time · Change day · Remove**, and on the view's own header:
**Add** and, on a job row, **Make this recurring**.

- **Change time / change day** — the existing `hcEditDayJobLine` path, which already composes the
  sentence from what happened, through `hcAfterWrite('job', …)`.
- **Add** — the same controls the My Day add row already ships (`hcDayAddRow`: real `time`, `text`,
  `text`, `button`, every one aria-labelled). One mechanism, second caller.
- **Make this recurring** — **the door, not the engine.** The recurrence engine exists and already
  generates rows; this is a door onto it. A recurrence is a **RULE**, not a pile of rows. The
  control offers cadence **in words** ("every Tuesday", "every other week"), never a cron string;
  the AI **proposes**, never silently sets; stopping is as easy as starting; and edit-one vs
  edit-all is **asked when ambiguous and named afterwards.**

This is the meeting point Adrian named: he will want to set recurrence **from the week view**, and
the week view is a thread view. C is the thing that makes item 2 on the list reachable — which is
why C is designed now and recurrence is built next, in that order.

**Why the edit lives on the card and not the view:** Hubly has two of almost everything, and a
control written per-view is a control written four times and fixed three. The card is the single
place all four views already agree on.

---

## 5. The smallest honest first slice

**Ship:**

1. `hcLive` + `hcAfterWrite`, with `kind` and `el.isConnected` liveness. ~60 lines.
2. Two kinds registered: **`job`** and **`ownerName`**. These are the two Adrian actually hit.
3. Four surfaces registered: the week grid, the day view, the greeting, the chip.
4. `update_business_job` and `set_owner_display_name` routed through `hcAfterWrite`. **This closes
   B and G together** — G stops being a separate item the moment the greeting registers as an
   `ownerName` surface.
5. The check: **a write that changes a record while a surface shows that record leaves no stale
   value.** Red-proofed on today's transcript — job moved to 3 PM, grid still reads 2:00 PM, goes
   red. Plus a second leg asserting the thread is not wiped: message count outside the redrawn
   element is unchanged.

**Deliberately left out of slice one, and why:**

- **Editing from the grid (C's own controls).** Slice one makes the views **truthful**; slice two
  makes them **editable**. Truthful first, because an editable view that lies is worse than a
  read-only one that does not — and because the edit path's correctness is easier to judge once
  re-reads are proven.
- **`task`, `customer`, `place` kinds.** The mechanism is kind-agnostic; adding a kind is a
  registration line. No value in registering surfaces we have not seen go stale.
- **Cross-tab / cross-device.** Out of scope entirely. "Nobody refreshes to see their own change"
  is about the person who made it, on the surface they made it on.
- **The talk lane's writers** (`business.updateJob` via the model). Same `hcAfterWrite` call, but
  it lands in the response handler rather than at a button, and that handler is where the arrival,
  the floor and the chain receipts all already meet. One thing at a time in that function.
- **Recurrence.** Item 2 on the list, after this. The design above reserves its place on the card
  so it is not bolted on sideways later.

---

## 6. What this design does not know

- **Whether `hcRenderWeekGrid` can redraw in place today.** It is written as "build and append";
  redrawing may need it split into build-into-`el` and load, the way `hcRenderHomeFurniture` was
  split out of `hcRenderHome`. Cheap, but it is work, and it is not yet measured.
- **Whether any surface's `el` survives its own redraw.** If `redraw` replaces `el` itself rather
  than its contents, the registry entry goes stale on the first pass. The rule is that `redraw`
  fills `el`, never replaces it — assertable, but it has to be written down before the code, which
  is what this line is doing.
- **Mobile.** Claude Code cannot verify a 390px viewport or a soft keyboard. Anything in section 4
  that involves tapping a row to edit must be checked on a real phone before it is called done.
