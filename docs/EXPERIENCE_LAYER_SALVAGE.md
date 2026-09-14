# `hubly_brain_experience_layer.ts` — read with suspicion, 2026-09-14

Read before Part 2 writes a greeting, on the ruling that it be read **with suspicion as well as
hope**. This file is the record so the **third** rediscovery does not start from zero.

## What it is

| | |
|---|---|
| Written | **2026-07-24**, one commit ("Milestone 2 Epic 0") |
| Size | **762 lines**, 11 voice builders |
| Touched since | **never** — 52 days |
| Callers | **none in production.** The only caller of `HublyExperienceLayer.*` anywhere is `scripts/check-m2-epic0.mjs`, the test asserting it exists |
| Imported by | `hubly_brain_experience_director.ts`, `hubly_brain_chat_os.ts`, `hubly_ai.ts` (line 205, re-exported line 303 as `HublyExperienceLayer`) — and `hubly_ai` IS imported by the conversation function |

That last row is why it looks alive and is not. See **Lesson 80 — "is it imported" is not "is it
used"**, which this file is the worked example for.

## Verdict: a shell to fill, not a thing to adopt

Two of its sentences would ship a defect in Part 2's **first line**:

- `buildGreeting.new_owner` — `"Hi 👋\n\nI'm Hubly.\n\nLet's build your business together.\n\n**What are we building today?**"` — the **stranger script**: it greets a returning owner as though no history exists, which is the exact defect Part 2 exists to fix.
- `buildGreeting.returning` — `"Welcome back, ${name}.\n\nI reviewed your business while you were away."` — **an unearned claim**. Nothing reviews anything while the owner is away. This is prohibition 2 (no green by default) wearing a warm voice, and it would have been the first sentence an owner read.

**The architectural claim in its header** — *"No feature writes its own customer copy — everything
comes through this layer"* — was the right question and is recorded as **D-052**, a decision to
make at Part 2. It failed not because it was wrong but because **nothing failed when it was
bypassed**.

## The three salvaged pieces — cite this file when you use them

Any use of these carries a provenance comment at the use site naming this document, so the fourth
reader knows the shape was salvaged and the file was not.

### 1. The empty-state two-beat — `buildEmptyState`, line 483

```
"No customers yet.\n\nLet's get your first booking."
"No jobs on the board yet.\n\nWant me to help fill the week?"
```

**What is true, then one offer.** Two beats, nothing else — no menu, no second ask.

This is **the recap test passing**: the first beat states the state without dressing it up
(nothing claimed that was not earned), and the second beat is a single offer (one ask at a time).
It is also exactly **the shape Part 3's empty planner needs** — My Day with no jobs must say what
is true and make one offer, never render an empty grid and never invent a day.

### 2. `buildCelebration.website_published` — line 397

```
"🚀 Website published. Your business is live."
```

Names the event and states the consequence in the owner's terms. Short enough to survive being
composed next to something else. The rest of that table is milestones we do not measure — do not
take them.

### 3. `buildHonestDisagreement`'s principle — line 434

*"I can absolutely do that. I don't recommend it because … Would you still like me to continue?"*
— logged as *"Partner, not a yes-machine."*

**The principle is salvaged; the implementation is not.** It ends in a confirmation prompt with
two buttons, and the standing ruling on destructive actions is the opposite shape — **do the
thing, report what it resolved, and name the undo in the same breath, after** (Lesson 79). Keep
the register: state the disagreement, give the reason, then proceed.

## What to do with the rest of the file

Nothing, for now. It is not deleted because D-052 may make it the layer it claims to be; it is
not called because every sentence in it must be re-earned before an owner reads it. A banner at
the top of the file says so, so the next reader finds the verdict before the 762 lines.
