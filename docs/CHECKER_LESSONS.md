> ## ⛔ READ FIRST — `supabase db push` IS UNSAFE ON THIS PROJECT
>
> The migration ledger diverged on 2026-08-23. **Thirty migrations are applied to the
> database and unrecorded in `supabase_migrations`**, so `db push` tries to re-run all
> thirty. One of them sets `account_kind = 'real'` — a value the constraint now rejects —
> and that rejection is the only reason a re-run stopped where it did on 2026-09-08.
> That is luck, not safety: the database and the repo disagree about what reality is.
>
> **Until the ledger is repaired, apply SQL with `supabase db query --linked -f <file>`
> and keep the migration file in sync by hand.** Repair is the next thing scheduled:
> establish which thirty, whether each is already applied, and what a repaired ledger
> looks like — reported before anything is changed.

# Checks that report a result they did not establish

One class, three instances in a single day (2026-09-08). Kept together because the fix is
different each time and the failure is identical: **a check told us something it had not
actually determined.**

## The class

> A check must distinguish three outcomes, not two: it passed, it failed, or **it did not
> run**. A check that can only say pass/fail will eventually say one of them when the true
> answer was "I could not look" — and it will say it at the worst moment, because the
> conditions that break a checker (a bad install, a missing key, a renamed symbol) tend to
> arrive alongside the conditions that break the product.

The three instances, in the order they were found:

### 1. A checker that failed open
`scripts/check-places-seeded.mjs`'s subject — `seed_business_places()` — swallows its own
failure by design (a signup that 500s is worse than a business with the wrong rail). The
swallow was correct; the silence was not. A `raise warning` goes to a Postgres log nobody
reads, so a failed seed and a successful one were the same observable event. Fixed by
giving the swallow a counter that anyone can re-run.

### 2. A checker blind to a whole capability
`check-owner-id-invariant.mjs` matched `/^\s{4}name: "..."/` and reported "6 declared, 6
reachable" while completely blind to a SEVENTH capability: `storefront` is added by
`HUBLY_CAPABILITY_REGISTRY.push({ … })` after the array literal, at a different indent. The
checker was not wrong about what it looked at; it was wrong about what it looked at being
everything. Fixed by parsing structurally — an object whose own keys include `name` and
`actions` — with no indent assumptions.

### 3. A checker silently disarmed by an unrelated install
`npm install --save-dev esbuild` (needed for two unrelated tests) reset Playwright's browser
cache, and `check-graefs-page.mjs` — the gate standing between us and Graef's live page —
stopped being able to launch a browser. The symptom was a stack trace that read like a hang.
It was neither passing nor failing. It was not looking, and nothing said so.

Fixed by a third exit state: **0 = PASS, 1 = FAIL, 2 = COULD NOT RUN**, with output that
says in words "Graef's page has NOT been checked. Do not read this as safe." Proved against
the real missing-browser condition, not a synthetic break.

## What this costs if you get it wrong

The tempting fix for #3 is to point Playwright at the system Chrome and move on. That is
re-baselining a safety check to make it pass: a different engine can count text runs
differently, so the gate would then either fail falsely or, worse, pass while no longer
detecting the thing it exists to detect. **Re-baselining a safety check to make it green is
how safety checks stop meaning anything.** If the check cannot run, the honest output is
that it cannot run, and the honest action is to wait for it.

## Related

- `scripts/check-destructive-confirm.mjs` carries the sibling lesson: a safety check that
  measures what the SYSTEM OVERWRITES rather than what the USER LOSES will fail precisely on
  the users with the most to lose.
- CLAUDE.md, "ENUMERATE THE HARMLESS SIDE — never the valuable one" is the same family: a
  list of shapes that omits the valuable one reports a number nobody can check.

## 4. A red suite hides the explanation for complaints you already have

Added 2026-09-08, and it is the sharpest version of the class.

The suite had been red for months. Inside it, `record-extraction.test.mjs` was failing on
this:

```
extractPricedServices('Sweep and inspection $189, cap replacement from $340, ...')  ->  []
```

`PRICE_LINE_RE` required a delimiter — a colon, an em/en dash, or ` - ` — between the
service name and the price. `"Full Detail: $180"` matched. `"Full Detail $180"` did not.
The second is how people actually write prices.

**That failing test was the explanation for a complaint already on record.** CLAUDE.md
carries the scar in full: Summit Auto Detail's owner wrote "Prices: Express Wash $60, Full
Detail $180, Ceramic Coating $600" in his first message, his page shipped priceless, and
Hubly's next turn asked him what he charged. We diagnosed that as a missing `setServices`
call. It was also this: the extractor returned `[]` for his exact sentence, and a test in
our own repo had been saying so the whole time.

So the cost of a permanently red suite is not only the defects it stops catching. It is:

> **A red suite hides the explanation for complaints you already have.** The failure was
> not undiscovered — it was sitting in the output, indistinguishable from nineteen other
> red files nobody could triage. Noise does not just delay detection; it buries diagnosis.

This is why "make it green, then keep it green" is not tidiness. A suite nobody can read is
a suite that can hold the answer to a live customer complaint for months without anyone
seeing it.

## 5. Source removed but deployment live (and its mirror)

Two failures with one shape, both on 2026-09-08, in opposite directions:

- **Deployed but uncommitted** — the `operations.read` fix was live on the edge function
  and existed only as an uncommitted diff. Any deploy from HEAD would have silently
  reverted it, and nothing would have reported that.
- **Source removed but deployment live** — `ai-advisorsuper-handlerai-advisor` was deleted
  from the repo while the function stayed ACTIVE on the platform, still able to call
  `api.anthropic.com` directly and still billable.

The class: **what is running and what is written must be reconciled explicitly, in both
directions.** Neither state announces itself, and a deploy list is not the same artefact as
a source tree. Deleting a function means deleting it from the platform, not from the folder.

## 6. Never claim to recognise someone whose identity cannot be established

Recorded 2026-09-08 from `docs/CUSTOMER_DIRECTION.md` §2. This is the **customer-facing**
version of the rule the rest of this file enforces on the owner side, and it is the one
with the higher cost.

> **Hubly must never claim to recognise someone whose identity it cannot establish.**

Everything else here is about not telling an OWNER something we did not establish — a
checkmark we did not earn, a count that meant two things, a "Saved" for a value nothing
reads. This is the same rule pointed at the person on the other side of the conversation,
and the asymmetry matters:

> An owner shrugs at a bad number. A customer greeted as the wrong person leaves, and tells
> the business owner why.

**Why it is live now, not theoretical.** Visitor conversations are stored as of 2026-09-08,
and a conversation that ends without a booking surfaces to the owner as a lead. The moment
anything greets a returning visitor by name, this rule binds. What we can actually establish
today:

- `resolveOrCreateCrmCustomer` matches on **phone, then email, then nothing**. Name is
  deliberately never a match key — two people called "John Smith" are not one customer, and
  merging them is silent and unrecoverable (lesson: `check-customer-identity-invariant.mjs`).
- Chat leads frequently carry **neither** phone nor email. The lead card already says so
  truthfully: *"They didn't leave a phone or email, so there's no way to reach them from
  here."* That sentence is the correct shape — it reports the absence rather than papering
  over it.

So recognition is not a rendering problem, it is an identity problem, and it is unsolved.
There are no cookies and no magic link on a public site with no login.

**The failure mode to guard against** is the one this codebase produces repeatedly: a
greeting that renders *something* because a slot exists. "Welcome back, {name}" with a
plausible name in it is the same defect as a score of 72 for a business with no data — a
shape drawn for a value we do not have, except this one is shown to a stranger.

**Fails safe:** no established identity → no greeting → the ordinary first-visit
conversation, which already converts a cold anonymous visitor into a booking.

Direction only. `docs/CUSTOMER_DIRECTION.md` is explicitly not a roadmap, nothing in it is
scheduled, and its §5 lists what must not be built yet. This entry records the RULE, which
binds now, not the work, which does not exist.

## 7. A number can be accurate and still be a lie about what it counts

Found 2026-09-08 and the subtlest defect of the day.

The traffic slice reported *"Four people looked at your page yesterday."* The integer was
correct. The query was correct. `page_loads` genuinely held those rows. And the sentence was
false, because the rows were not people.

Measured across the whole corpus: of 135 `page_loads` rows, **54 were `device_class='bot'`**
and 49 were owner previews — only 32 were real visits. The slice filtered owner previews and
not bots, so **63% of what it called "people" were crawlers, link unfurlers and uptime
pingers.** On 2026-09-05 it would have said **43 people against a real 9** — wrong by 4.8x.

> **A fabricated sparkline is visibly fake. A real integer describing the wrong population
> has nothing about it to notice.**

That is why this class is worse than the drawn-shape class it sits next to. Nobody reviewing
"43" asks what a page load is. The defence is not scepticism about the number; it is naming
the population in the same breath as the count — *distinct non-bot, non-owner `visitor_hash`
per day* — so that a mismatch between the label and the filter becomes visible in the code
rather than only in the sentence.

Same family as CLAUDE.md's "when a heuristic reports N things have X, it is still counting a
FORM, not the fact — state which form". This is that rule applied to a population instead of
a shape.

## 8. The recurring defect is not missing code — it is code nobody connected

Counted on 2026-09-08. In one day, **six** things were found already built, already correct,
and simply never wired to anything:

| built and unused | how it surfaced |
|---|---|
| `operations` capability | shipped 2026-09-05, absent from `CONTEXT_CAPABILITY_ALLOWLIST`, dead until found |
| `places` capability | unreachable for the whole session that built it, same cause |
| `set_business_hours_in_progress` | a real owner-authorised RPC with 2 call sites and **no capability action** — hours still cannot be set by talking |
| `chatbot_conversations` / `chatbot_messages` | correct schema, written by a legacy function, never written by the concierge — so visitor conversations were discarded |
| `business_timeline_events` | correct-ish shape, 0 rows, never written, and its only reader selected a column that did not exist |
| `page_loads.device_class` | a working bot classifier writing `'bot'` on every row, **never read by anything** — see lesson 7 |

The instinct this should produce is the one CLAUDE.md already states and which keeps paying:
**when something does not work, the first hypothesis is that the capability exists and only
its entry point is missing.** Rebuilding what is already there is the more expensive mistake,
and it buries the real one-line fix under a new system.

The corollary, which is what lesson 7 adds: this applies to *data* as much as to features. A
populated column nobody reads is the same defect as a deployed function nobody calls — and
it is more dangerous, because the column will happily be read one day by something that does
not know what it means.

---

## Lesson 9 — a harness measuring the product is subject to every rule the product is

Written 2026-09-08, during the home-screen rebuild. The harness in question is
`scripts/shot-owner-home.mjs`. In one sitting it produced three false readings, and each
one is a rule we already enforce on Hubly, turned back on our own instrument.

**1. Every assertion passed on a completely blank screenshot.**
`.hc-app` is revealed by an `.is-active` class that sets *both* `display` and `opacity`.
The harness set `style.display = 'flex'` and left `opacity:0`. Every element then had a
real, non-zero bounding rect — sidebar 260px, four cards, panel 380px, composer in place —
and the picture was an empty cream field with one chip floating in the corner. **A rect is
non-zero at opacity 0.** The fix was not a better selector; it was adding the question a
person asks first, and which no rect can answer: *is it painted?* That check now runs
before the others at every width.

This is the 2026-09-02 editor lesson exactly ("invisible in every number collected and
obvious in one screenshot") — except the number here was collected by a harness written
that same hour to catch that class of defect.

**2. The label burned into the proof was itself clipping the product.**
The "SIMULATED CLAIMED STATE" banner is `position:fixed; bottom:0`, and it painted over
the bottom 26px of every frame — which on a phone is exactly where the bottom bar, the
composer and the record sheet's Call button live. It read as a clipped sheet. It cost a
CSS "fix" (`height:82vh` in place of `max-height`) that was reverted once the measurement
disagreed with the picture, and a red-proof that would not go red — the tell that the
defect was never there. **A proof that occludes the thing it is proving is not a proof.**
The banner now insets the app instead of covering it; the label sits beside the product.

**3. The clipping assertion measured the wrong box.**
Written to catch defect 2, it compared the last element against the *scroller's* rect. But
the scroller was the thing overflowing, and the box with `overflow:hidden` was its parent.
The element was inside the scroller and outside the panel, so the check passed on visibly
cut-off content. **Measure against the box that clips, not the box that scrolls** — and
the way this was caught is the only reason it was caught: the red-proof did not go red.

The general rule: **a check that will not go red is not passing, it is not running.** Two
of these three survived a green run and died at the red-proof. Run the red-proof even when
the check is obviously correct, and especially when you wrote it in the same breath as the
fix.

---

## Lesson 10 — the checker that catches your own new work is the one that paid for itself

2026-09-08. Three separate checks caught three real defects in code written that hour,
and none of the three would have been found by reading it.

**`check-owner-id-invariant.mjs` caught `business.setHours` before it shipped.** The new
capability read the injected owner uid and was not in `DRAFT_INJECTED_ACTIONS`, so it
would have seen `null` and had every write refused — on a claimed business, which is
every business that has hours to set. The suggestion "Set your hours" had been *removed*
days earlier for having no writer; a writer that silently refuses for every real owner
would have been worse than none, and it would have looked fine in review. This is the
second time that exact check has caught the exact same shape on the commit that
introduced it (`places.add` was the first).

**`check-backend-answerable.mjs` caught repo/production drift on its first green run.**
Three SQL functions had been applied to the database from a scratchpad file and never
added to the migration. The checker resolves a slice's tables *through* the function
bodies in `supabase/migrations/`, so a function that exists only in production is
unresolvable — and it said so, by name, rather than passing.

**And a red-proof that would not go red found a bug in a check, twice.** Once here (a
clipping assertion measuring the scroller instead of the clipping box) and once in the
hours work. A check that will not go red is not passing, it is not running — and the
only way to know is to break the thing on purpose.

The general form, and it is the argument for writing the check before the fix rather
than after: **the code most likely to contain the defect a checker guards is the code
being written in the same session as the checker.** Every one of these was found on the
commit that created it, not weeks later by Adrian clicking.

---

## Lesson 11 — the false green can arrive through the test fixture

2026-09-09, during the places backfill. Two of these in one sitting, neither in product
code.

**A foreign key made a trigger test look like a trigger failure.** The claim-time seed
trigger was tested by claiming an unclaimed draft: `update businesses set owner_id =
'00000000-…-aa'`. Nothing happened — no place row, no error visible in the output — and
the obvious reading was "the trigger did not fire". It had never run: `businesses.owner_id`
has a foreign key to `auth.users`, the fake uuid violated it, and the whole `do` block
rolled back. **A silent no-op from a rolled-back fixture is indistinguishable from a
feature that does not work**, and the instinct it should produce is the same one the
`row_now: 0` CTE artifact produced the day before: when a test shows nothing, ask whether
the test ran before concluding the thing is broken. Re-run with a real owner uid: the
trigger fired correctly on the first try.

**And a red-proof that would not go red, because the fixture was wrong rather than the
check.** The new assertion is "no claimed business has zero workspace places". Proving it
by deleting one business's `website` row did not go red — that business also had a
`customers` row, so it still had a workspace place. The check was right: *at least one*
row is exactly what unlocks `hcPlacesKnown()` and lets a rail respond to anything.
Re-proved on a business that had only the floor row: exit 1.

The temptation there is to weaken the assertion until the proof passes, and that is
backwards. **When a red-proof will not go red, the fixture is the first suspect, not the
assertion** — the check that is hardest to break on purpose is usually the one worth
keeping.
