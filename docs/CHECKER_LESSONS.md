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

> ### THE INDEX, AND WHY IT IS HERE
>
> **This file holds 35 lessons.** Lessons **1–3** are the three instances described
> narratively in the opening section below — they have no `## Lesson N` heading, which is
> why a later count read the file as starting at 4. Numbered headings run **4 → 33**, with
> **11 and 11b** both present: two distinct lessons were written with the same number on
> different days and neither noticed.
>
> Renumbering 12–33 would invalidate every citation made in commit messages since, so the
> second became **11b** rather than shifting the rest. Before adding a lesson, take the
> next number above the highest heading here and update this count.
>
> A lessons file that miscounts its own lessons undermines the method it documents —
> caught 2026-09-12 because Adrian's notes said 15 and the file held 31 headings.

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

---

## Lesson 11b — a truth string may not claim a value is on the page unless the value is in the bytes

**THE RULE.** A truth-composing function may not tell an owner that a value is on their
page unless that value has been verified present **in the rendered output**. Not that the
writer returned `ok`. Not that the write path was entered. Present in the bytes that ship.

Written 2026-09-09, from a defect that nearly shipped *inside the fix for a different one*.

The guess-row inserter overwrote a placeholder row with a real service. On the row shape a
generated page most often has — a title and a blurb, with **no price element** — the name
landed, the price had nowhere to go, and the function returned `ok: true`. `servicesTruth`
composes its read-back from that result, so an owner who had just typed "1st Flight, 250"
would have been told:

> *"1st Flight $250 is on your page now."*

about a page with no `250` anywhere in it.

That is the same fabrication class as a green checkmark nobody earned, an invented business
hour, and a count over a truncated list — and it appeared in the fix for the "we can't find
your services section" defect, written by someone (me) who had spent the day removing
exactly this.

**It survived only because the check asserted the price was VISIBLE, not that the function
returned ok.** The assertion was one line:

```js
t("(b) THE PRICE LANDS", /250/.test(h), "ok was reported but no price reached the page");
```

Had the check asserted `r.ok === true`, it would have passed, the fix would have shipped,
and the first owner to type a price would have been lied to about it.

**So the discipline is not "test the writer", it is "test the page".** A write path that
reports success is a claim; the rendered output is the fact. Where the two can disagree,
only one of them is allowed to reach a sentence an owner reads.

---

## Lesson 12 — a contrast check that reads CSS is measuring a form, and mine was wrong in both directions

2026-09-09. We insert server-built blocks into pages the model designed. The first
services block inherited `color` from `body` and painted no background of its own, so on
a page whose ground is a radial gradient it landed dark-on-dark: factually perfect,
visually invisible, and passing every check that existed.

I wrote a contrast check. It read `getComputedStyle().backgroundColor`, walked up the
ancestors for the first non-transparent one, and computed a WCAG ratio.

**It reported 14.3:1 for the block that was unreadable** — it walked straight past a
`background-image: radial-gradient(...)` because the element's `backgroundColor` was
transparent. **And 1.33:1 for a contact block that looks perfect** — it read a
transparent background as black.

Wrong in both directions on the same night. That is worse than being wrong once: a
number that errs both ways cannot even be trusted as a conservative bound. And the
instinct to "add background-image handling" is the exact failure the rule warns about —
it makes a longer list of the things the check remembers to look at, and the next page
will use something else. Opacity, blend modes, a `::before` overlay, an image.

**The pixels are the fact. Everything upstream of them is a form.** So the check now
screenshots the region and reads the rendered bytes (`scripts/lib/pixel-contrast.mjs`).

It took three more attempts to get even that right, and each error was caught by looking:

1. `element.screenshot()` renders an element with no background on a TRANSPARENT ground,
   and transparent decodes as black — 1.25:1 for a block that is plainly readable. Fixed
   by clipping the PAGE to the element's box, which captures what is actually behind it.
2. Darkest-5% vs lightest-5% over a whole section fails when the text is under 5% of the
   pixels — a cloned section carries the page's own generous padding, so the 5th
   percentile is still background. Fixed by clipping tight around each text element,
   where the true min and max ARE the ink and the ground.
3. **Before blaming the page, check what we added to it.** Once it was measuring
   correctly it found a defect I had introduced myself:
   `.hubly-sv-desc { opacity: .85 }` — our own dimming pushed the description below AA
   on pages whose pair was already marginal. Three of the first five failures were that
   one line.

We dimmed our own text and then measured whether it was too dim. Every failure looked
like a property of the owner's page until the line we wrote was removed from the middle
of it.

**The screenshot beat the metric four times in one night.** That is the whole argument
for looking at the thing, and for treating any measurement that disagrees with a picture
as guilty until proven otherwise.

---

## Lesson 13 — an instruction inside a refusal branch is invisible to every test of the path that succeeds

2026-09-09. Ruling 3 said: never construct a business name, ask instead. Three
instructions were found telling the model otherwise and two were fixed. The fix still
failed on the first sentence anyone typed at it.

The one that survived was in `business.startDraft`'s **no-name branch** — the code path
that runs *only when the model has correctly declined to invent a name*:

> *"**Derive a name** from what they told you (their trade and town is enough, e.g.
> 'Mobile Dog Grooming in Lehi')… **do not stop to ask** unless you truly have nothing to
> work from."*

Read the shape of that. It cannot fire on the happy path. It fires **exactly and only**
when the new rule is being obeyed — so every test of a working signup passes while the
fix is dead, and the failure appears only for the behaviour you were trying to create.

Three general points fall out of it:

1. **Grepping the prompt is not enough.** Instructions live in argument schemas, in
   handler refusals, and in the summary strings a refusal hands back — all of which are
   prompt, and none of which reads like prompt.
2. **When you change a rule, search the branches that the NEW behaviour reaches**, not
   the ones the old behaviour reached. The old code never took that branch, which is
   precisely why it had been sitting there unexamined.
3. **This is why the check drives the live endpoint.** A source-text assertion that the
   two known instructions were deleted would have gone green. Only sending
   "I do mobile detailing in los angeles" at the deployed function and reading the row it
   created could have found the third.

And the corollary that made the fix trustworthy: **test both sides of a two-way rule.**
Checking only "it asks when no name was given" turns the fix into "always ask", which
breaks the person who told you their name in their first sentence. ASK, EXTRACT, and the
awkward middle are all asserted.

---

## Lesson 14 — a parallel path inherits none of the original's guards, and the guards are invisible in the diff because they are the code you did not write

Asked to let signup proceed without a business name, I wrote a second function
(`start_business_unnamed`) beside `start_business_in_progress`, and an early return in the
`startDraft` handler that took the new path when `name` was empty. Both halves looked
correct in isolation, and both were correct about the one thing I was thinking about: a
row got created, with a `site-<hex>` slug, and no invented name.

What shipped was a generic template — "YOUR BUSINESS", "Quality service that comes to
you", navy-on-white, no photo. Worse than the bug it replaced.

The cause is the shape, not the code. Everything the original path does AFTER the row is
created — the palette, `section_order`, the identity patch, the draft grant that makes the
draft claimable, and the dispatch of the document build — sat below my early return. I did
not delete any of it. I never saw it. **A diff shows the lines you wrote; it cannot show
the lines you routed around.** Reviewing my own change, there was nothing on screen to
notice: the new function was complete and the new branch was complete, and the twelve
things they both skipped were somewhere else entirely, unchanged and therefore invisible.

The rate limit makes the point sharpest. `start_business_in_progress` refuses more than 10
drafts per IP per hour. My copy had no such clause — not because I decided the limit was
wrong, but because I was never in a position to have an opinion about it. A parallel path
does not inherit a guard; it silently opts out of every guard at once, and each one is a
decision you are recorded as having made without knowing you made it.

So:

1. **A variant is a nullable field, not a second function.** The correct fix here was one
   function whose `name` is nullable — the unnamed path is the named path with the name
   slot empty. Fewer paths is the fix; a new path is the defect.
2. **When you must fork, enumerate what the original does after the point you diverge**,
   line by line, and say for each one whether the fork needs it. The list is the review.
   Without it you are reviewing half a change.
3. **Assert the whole outcome, not the thing you changed.** My check asserted the name and
   the slug — the two things I was thinking about — and went green while the page was a
   template. Extended to assert that a build job was dispatched, the brand colour is not
   the column default, `section_order` was set, and a draft grant was issued, it goes red
   on all four. Everything downstream of your change is inside the blast radius, so it is
   inside the assertion.

## Lesson 15 — a detector that misses by one character reports the model's behaviour as zero

Measuring how often the new name question actually fires, my script reported `askedName
0/4` on both messages. I had a manual probe from ten minutes earlier whose reply read
`"I've started the site for your mobile detailing business in Los Angeles. What's the
business called?"` — the exact behaviour being measured, scored as absent.

The detector was `/what.{0,15}\bcalled\b/i`. Between "what" and "called" sits `'s the
business ` — sixteen characters. Off by one.

This is Lesson 12 again (a check that reads a form is measuring the form, not the thing),
but the failure mode is different and worse: Lesson 12's contrast metric was wrong in a
way that produced absurd numbers, and absurd numbers get investigated. `0/4` is not
absurd. It is a clean, plausible, actionable finding, and I was one step from reporting
"the model never asks for the name" — sending a whole diagnosis, and Adrian's next
decision, down a path that did not exist.

The rule: **when a measurement of model behaviour comes back at zero, print the raw
output before you believe it.** A regex over free text is a hypothesis about phrasing, and
the model's job is to vary phrasing. If the number will be reported to a person, the
sample it was computed from is part of the report — one printed reply would have cost
nothing and caught this instantly. Counting is cheap; counting the wrong thing is not.

---

## Lesson 16 — append each result as it lands, because the run that teaches you most is the one that dies before the end

The build-rate script held every result in memory and wrote its artifact after the last
run. The OpenAI account emptied on run ~33 of 40, the process exited, and all 33 results
went with it — results that had already been paid for in the exact resource that ran out.
Re-running them cost another top-up.

The rule is not "handle errors". It is that **a measurement's output is due the moment the
measurement exists, not when the batch completes.** Anything that runs N times against a
resource that can be exhausted — quota, rate limit, a flaky endpoint — writes result n
before starting n+1. The file is marked incomplete while it is, and the summary refuses to
present a truncated sample as the answer, which is the CANNOT RUN discipline applied to a
run that started fine and stopped early.

The corollary is that partial data is worth having. Thirty-three runs cut short still
answers "is it near 50%"; zero runs answers nothing. Discarding them to keep the artifact
tidy is throwing away the expensive half of the work to protect the cheap half.

## Lesson 17 — unwind through `finally`, because `process.exit` skips the cleanup

The same abort orphaned 53 draft businesses. The worker called `process.exit(2)` on the
outage, and `process.exit` does not run `finally` blocks — which is exactly where the
script deleted the rows it had created. The cleanup was correct, tested, and never
reached.

`process.exitCode = 2` followed by a normal return does the same job and runs the
unwinding. In a concurrent script the shape is: raise a flag, let the workers drain, let
`main` return, let `finally` do its work, set the exit code last.

The general form, and it is the same mistake as the parallel path in Lesson 14: **an early
exit is a branch around every guarantee the normal path makes.** `process.exit` skips
`finally`; `return` before a postcondition skips the assert; a second function skips the
rate limit. In each case the skipped code is invisible at the point you wrote the exit,
because it is somewhere else and unchanged. Ask what the normal path does after the point
you are leaving, every time you leave early.

---

## Lesson 18 — when the model marks its own invention, that mark is evidence, and throwing it away is a choice

The wordmark that shipped on 2026-09-09 read "LOS ANGELES AVIATION PILOT" for an owner
who had given no name. The record was correct — `name` null, `name_unset` true. The brief
was correct, and said so in as many words: *"Build a first website for an unnamed aviation
pilot… Do not invent a business name."* And the element itself carried the model's own
flag:

    <p class="brand-name" data-hubly-guess="provisional site identity">Los Angeles Aviation Pilot</p>

**The model told us it made this up, and we rendered it as the business's name.**

That is the second time in one day. The first was `data-hubly-guess` service rows — the
model's placeholder copy, addressed to the owner — shipping to customers on a live market
page. Same attribute, same disease: the generator is being honest about the boundary
between what it knows and what it proposed, and nothing downstream is listening.

The specific rule is now asserted: no identity element — wordmark, monogram, brand name,
`<title>` — may carry `data-hubly-guess`. A guess may be a proposed tagline; it may never
be who the business *is*.

The general rule is bigger than names and is **recorded, not built**: *anything the model
flags as a guess must never render as the business's own claim, anywhere.* That is a
statement about the whole generator and it deserves its own pass. What makes it urgent is
that the marking already works — the expensive part is done, the model reliably tells us
what it invented, and the cheap part (acting on it) is the part that is missing. We are
discarding a signal we asked for and got.

The transferable form: **a system that reports its own uncertainty has done the hard
half. Ignoring the report is not a gap in the model, it is a defect in the consumer.**

## Lesson 19 — assert at the layer the human sees

Three times in one day, a check passed while the thing it described was broken, and each
time for the same reason: it asserted one layer below the failure.

1. The contrast check read the CSS and not the rendered pixels. It reported 14.3:1 on
   unreadable text.
2. A truth string reported what a function returned and not what reached the page bytes.
3. The name check read the reply JSON and not the rendered HTML — so it went green on the
   exact build whose wordmark invented a business name, because the record was clean, the
   reply was fine, and the invention existed only in the page.

Each layer was a reasonable place to look, and each was one step short of where a person
would notice. A check that reads the input to a rendering step is testing the input, and
the defect lives in the output.

So: **find the layer the human actually experiences, and assert there.** Pixels, not CSS.
Bytes, not return values. The rendered page, not the API response. It is slower and it
needs the artifact to exist first — the name check now waits up to four minutes for a real
build before it can say anything — and that cost is the price of an assertion that means
what it says.

The companion rule, which is what makes this affordable: **assert positionally, not by
recognising content.** Banning the words "los angeles" and "aviation" anywhere on the page
would red-flag the eyebrow "PILOT · LOS ANGELES", which is true and is exactly what the
fix asks for. What separates the two is not the words but the slot they sit in and whether
they are contiguous — a name is contiguous, a descriptor is separated. Assert the slot.

## Lesson 20 — a rule proved on one phrasing is not proved

The name check went green on "I do mobile detailing in los angeles". The rule then failed
on the second sentence a real person typed: "Im an aviation pilot in Los Angeles I need a
website" got the packages-and-prices question and no name ask at all.

One sentence is not a rule. It is an anecdote that passed.

This is the enumeration problem again, and it has now cost us five times (anchors, prices,
hours, the extraction gate twice): a list written from the shapes we have already seen
always undercounts, because the next real input arrives wearing a form nobody listed. The
difference here is that the *check* was the list.

So a behavioural rule is tested across SHAPES, not wordings — how people actually open,
not synonyms of one opener: a stated need, a bare request with no trade, a trade with no
place, a trade with a place, prose with no assertion verb, a three-word first-person
opener. And both sides of the rule, always: without the EXTRACT and MIDDLE cases, "always
ask" passes and we break the person who told us their name in their first sentence.

Report **per shape, not as one aggregate.** If the ask survives four shapes and dies on
two, that names what to fix. One number would not.

---

## Lesson 21 — never bake a judgement into a write

The first-turn counter stores what the visitor said and what Hubly said back, and decides
nothing. Whether the reply was a menu, whether it asked for a name — those are read-time
questions, computed in SQL when someone asks.

The reason is asymmetric and total. **A detector in a write path poisons the data
permanently:** a wrong regex writes a wrong boolean, the text it judged is gone, and no
later insight can recover the truth. **A detector in a read path can be corrected any
time** — the raw rows are still there, so a better question can be asked of the same data
tomorrow.

This was not theoretical. On 2026-09-09 a detector deciding `asked = true` at the moment of
writing matched our OWN instruction text out of a capability result and would have reported
success on the exact failure that had just been watched happening in a browser. That
detector was in a check, so killing the run cost one signup. The same detector in a write
path would have cost the dataset.

The general form: **store what happened; decide what it means when you are asked.** The
storage cost of the raw text is trivial next to the cost of a number nobody can re-derive.

## Lesson 22 — `void builder` is not "fire and forget", it is "never fire"

Three writes were shipped as:

    void createAdminClient().rpc("record_endpoint_failure", { ... });

A supabase-js query builder is **lazy**: it constructs a request and sends it when `.then()`
is called. `void` evaluates the expression and discards it without ever calling `.then()`,
so the request is built and never sent. All three were dead code that type-checked, linted,
deployed, and did nothing.

Two of them mattered. One was the first-turn counter, caught within minutes because a
proof looked for the row and found none. **The other was the endpoint-failure writer behind
the outage alert — and that one had been reported as proved.**

It was "proved" by inserting five rows in SQL and watching the cron email arrive. That
tested the alert's read path perfectly and never touched the write path at all. Seeding a
pipeline's output and confirming the output appears is the same error as a screenshot of
hand-set state: it renders as evidence and it is a picture of something else.

So, two rules:

1. **Never `void` a lazy builder.** If a write is genuinely fire-and-forget, still attach
   `.then()` — and log the error rather than discarding it, because a write that fails
   silently cannot be counted, which defeats the purpose of writing it.
2. **Prove a pipeline end to end, from the event that triggers it.** If the thing being
   tested is "a refusal gets recorded", the test has to cause a refusal. If reaching the
   real trigger is impossible, say which part is unproved and why — never substitute a
   hand-made input at the midpoint and call the whole chain verified.

---

## Lesson 23 — a guard written against the wrong grammar cannot go red

The unawaited-builder guard (Lesson 22's permanent form) was written to split source into
statements at paren depth 0. It passed on a file with two deliberately planted violations
sitting in plain sight.

The reason is specific and general at once. Almost every edge function is one expression:

    Deno.serve(async (req) => { ... the entire function ... });

Paren depth is never 0 inside that body, so a depth-0 splitter yields ONE statement per
file — the whole file. That statement contains an `await` somewhere, so it read as
"consumed", and every real violation in the codebase was invisible. The check was not
passing; it was not running, which is Lesson 9 in a new costume, and it took a planted
violation to reveal it.

The fix was a bracket STACK: a `;` ends a statement when the innermost open bracket is a
block `{` or nothing, which is true at any nesting depth inside an arrow body.

Then the corrected version produced FALSE positives, and the second bug is the mirror of
the first: it cut a statement at every `{`, which splits object literals, severing
`.update({ ... })` from the `.then()` on the following line and reporting correct
fire-and-forget code as a silent write. A brace only ends a statement when it is a BLOCK
brace — when we are already in statement position.

Two rules fall out:

1. **Plant a violation before believing a static check.** A source-scanning guard has no
   natural failure, so its green state is indistinguishable from its broken state. This one
   was written, run, and reported green while blind to the entire codebase.
2. **When a check parses code, it is a parser, and it will be wrong about the grammar it
   simplified.** Both bugs here were grammar assumptions — that paren depth returns to zero,
   and that a brace means a block. Test it against the real shapes in the repo, not against
   the shape you had in mind, and expect the first correction to introduce the opposite error.

## Lesson 24 — find a way to make the real thing fail, before accepting an inference

The endpoint-failure writer behind the outage alert had been reported as proved, then found
dead (Lesson 22). Fixed, it was still only *inferred* to work: the same code shape as a
writer that WAS proved, in the same file. The honest report said so.

"Wait for the next real outage" is a bad plan for the thing whose only job is catching
outages. So the question is whether the real trigger can be reached safely, and the answer
was yes on the second attempt.

- **Attempt 1 — oversized input.** 1.5MB of repeated characters, expecting a context-length
  400. It returned 200: a long run of one character tokenizes very efficiently, so it fit.
  Scaling it up was rejected on purpose — if the oversized request SUCCEEDS, we are billed
  for a million input tokens of the scarce resource we are protecting.
- **Attempt 2 — invalid message shape.** `content` as an object rather than a string.
  Rejected before any token is read or generated, costs nothing, cannot touch a visitor,
  and throws into the SAME catch block a quota exhaustion reaches. Two rows appeared in
  endpoint_failures with the right function and context. Proved.

The transferable form: **an error path is reachable by many errors, not just the famous
one.** When the dramatic trigger is expensive or destructive to reproduce, look for the
cheapest input that lands in the same handler. And state precisely what remains unproved —
here, `upstream_status`, which only a genuine provider HTTP error can populate.

---

## Lesson 25 — a harness changes the system it measures, and the second time it did so it blocked a real person

Twice in one day a measuring instrument altered the thing it was measuring.

**First, cheaply:** the build-rate script created 53 draft businesses. They were test rows
and they were cleaned up, but while they existed they were 96% of the corpus, and any
number computed over `businesses` during that window would have described our harness.

**Then, expensively:** at 20:37 the product refused Adrian on his phone —
*"I couldn't create the site draft right now"* — because the test scripts had already
spent all ten of that hour's drafts on the shared address. A real person, on the walk that
gates the release, was blocked by the instrument watching him.

Neither was a bug in the harness. Both are the same property: **a harness that drives the
real product consumes the real product's finite resources** — quota, rate-limit allowance,
rows in the tables the metrics read, slugs in a unique namespace.

So, before writing one:

1. **List what it consumes**, not just what it costs. Quota was obvious; the per-IP
   allowance was not, and it was the one that hurt.
2. **Make it declare itself** so its own rows can be excluded — `x-hubly-synthetic` exists
   for exactly this, and a declared flag beats sniffing (an unmarked harness should be a
   visible bug, not a quietly better number).
3. **Assume a real person may be behind the same key at the same moment.** On a shared
   address — and mobile carriers put thousands behind one — "my traffic" and "their
   traffic" are indistinguishable to any guard keyed on it.

The reason this deserves writing down rather than remembering: the next harness will do it
too. The one that blocked Adrian was written by someone who had spent the whole day being
careful about exactly this class of mistake.

---

## Lesson 26 — an instrument built to see failures must be wired on the failure path

`first_turn_outcomes` exists for one reason: a first turn that creates no draft writes
nothing anywhere, so it cannot be counted from any existing table. It was wired to the two
SUCCESS returns.

So a first turn that FAILED wrote no business row, no conversation row, and no counter row
either. The instrument built to make invisible turns visible was blind to precisely the
invisible turns. On the night it shipped, it recorded Adrian's session as one first turn
instead of two, and would have reported the build rate as 100% instead of 50%.

**A meter wired on the success path reads 100% forever, and looks healthy doing it.**

This is the third instrument in one day with the same disease, and the repetition is the
lesson rather than any one instance:

- the **rate limit** counted our own egress IP, not the visitor's;
- the **build-rate number** counted from `businesses`, a table only successful signups
  reach, so menu turns were invisible and 50-of-50 read as 100%;
- the **counter** counted only turns that succeeded.

Each was well built and pointed at a population that excluded the failures. The general
form: **when you build something to measure X, write down what X's failure looks like and
check the instrument can see THAT.** If the answer is "the row doesn't exist when it
fails", the instrument is measuring survivors.

The fix is one line on the catch path, and the assertion that guards it is cheaper still:
a deliberately malformed request reaches the real catch without any provider call, so
"a failing first turn produces a row" is asserted for free on every run of the signup check.

## Lesson 27 — before building a guard, enumerate what it is guarding

Three guards were built well and aimed at a fraction of their surface:

- The **per-IP rate limit** was pointed at `_caller_ip()`, which is our own edge runtime's
  rotating egress address. It capped nothing while reporting success.
- The **burn alert** counted drafts per hour — one consumer out of eighteen. Blind to a
  cron, a retry, the customer chat on every live site, and every open endpoint.
- Nobody had ever **enumerated which functions can reach the model** until asked. The
  first attempt, by grepping the source tree, was wrong in BOTH directions: it counted
  `scratch-freeform`, which is not deployed and therefore unreachable, and missed
  `hubly-document-build` and `marketplace`, which are.

Each was found by accident, and each time the code was fine — the aim was wrong.

So the first step in building a guard is not writing the guard. It is writing down the
complete list of what it must cover, and then checking that list against reality rather
than against the source tree: **an audit of the repository is not an audit of the running
system.** 52 functions were deployed; 53 directories existed; only the diff in both
directions tells you which is which.

The corollary for cost specifically: a guard on a PROXY for the expensive thing (drafts,
requests, rows) drifts away from the thing itself. Meter the expensive thing directly —
here, tokens — and let the proxy be a curiosity.

---

## Lesson 28 — "was it asked" and "was it noticed" are different measurements, and only one of them is the product

The fetch harness and a real browser disagreed FOUR times about whether signup asks for
the business name. The harness said it asked, 3 of 3. Three separate real-browser runs, by
the person walking the product, said it never asked and asked about pricing instead.

I diffed the request bodies, found them effectively identical, and concluded the harness
was right and the browser runs were variance. That conclusion was wrong, and four
disagreements should have killed it long before the fourth.

**Both were correct. They were measuring different things.**

The model DID ask — the counter shows `asked=true` on the owner's own runs. But the
question was the last sentence of a four-sentence design narration, and roughly two
minutes later, when the page landed, the client fired a SECOND model turn
(`event:"post_build"`) whose ask-gate read the services record and never looked at the
name. So a louder, fresher question about pricing arrived on top of it, and that is what
the owner was left looking at.

A question buried at the tail of a paragraph and superseded two minutes later **has not
been asked** in any sense the person experiences. The harness measured the API response;
the product is what is on screen after everything has settled.

Three things follow:

1. **When a harness and a human disagree, the human is measuring the product.** The
   harness is measuring an input to it. Reconcile toward the human, and do not spend an
   evening improving the thing the harness can see.
2. **Drive the real client.** Playwright loading the real page, typing into the real
   composer, and reading the screen removes the entire class of "is my request shaped like
   theirs" — the client sends it. It costs the same per run as the fetch harness.
3. **Wait for the conversation to finish.** The first version of this browser check waited
   20 seconds and passed, because the build takes 100-150s and the post-build turn had not
   fired yet. It measured the half that was never in dispute. Waiting 210 seconds showed
   both turns and the actual last thing on screen.

The narrow fix was one gate reading one more field. The expensive part was four rounds of
believing an instrument over a person.

---

## Lesson 29 — before writing normalisation, grep for the one that exists

"George's Window Cleaning Company" became george-s-window-cleaning-company, hours after
Graef's Auto Detailing was fixed to graefs-auto-detailing. The fix was real and it was in
`hubly_slugify`, which strips apostrophes before anything splits on them. The trigger that
renames a draft when its name lands, written the same afternoon, carried its own inline
`regexp_replace` and never called it.

I created the duplicate. Not by ignoring the existing function — by not looking for it.
Writing four lines of regex felt smaller than finding out what was already there, and the
result was two normalisers an hour apart, one missing a fix the other already had.

That is the third instance of the same shape in one day, alongside the two edit lanes and
the two signup paths, and it is the shape CLAUDE.md already names: **Hubly has two of
almost everything, so a defect written once is usually present twice.** The new part is
that this time both copies were written by the same person on the same day.

Normalisation is where it bites hardest, because a normaliser is small enough to feel
cheap to rewrite and central enough that a divergence corrupts data rather than just
behaving oddly — a slug is permanent, a person's web address.

So: **slugify, escape, truncate, canonicalise, format a phone number, parse a price — grep
first.** If one exists, call it. If it is wrong, fix it there, where every caller gets the
fix. A second implementation is a promise to keep two things in step forever, and today is
the evidence that nobody keeps that promise for even an hour.

## Lesson 30 — a write you intended and did not make must leave a trace

The wordmark stopped appearing on generated pages. The evidence available was: an anchor
correctly stamped in the page, a matcher proved offline to match that exact HTML, and no
second document version in the table. So the placement either never ran, or ran and its
save was rejected — and **nothing anywhere recorded which**.

The first cause was found: a CHECK constraint, `created_by IN ('ai','user','patch','system')`,
rejecting a value introduced an hour earlier to fix a cosmetic bug. The insert failed, no
version was written, and the feature underneath quietly stopped working. An hour passed.

The system was not silent, and that is the uncomfortable part: the turn's reply degraded
honestly to "the page itself still shows the old header for now", which is exactly what had
happened. It was reported, in words, to the person, and neither of us read it as a failure
report. **An honest degradation is not a signal if nobody is counting it.**

So the rule has two halves:

1. **Every branch of a write path says which branch it was**, by name, with the id — not one
   generic failure. "No anchor" and "an anchor exists and the matcher missed it" are
   different bugs and were indistinguishable from the outside.
2. **A failed write is countable, not just visible.** The reply telling one person is not a
   record. Ask of any write: if this silently stopped working, what row would appear? If
   the answer is none, the next hour of it not working is free.

---

## Lesson 31 — an honest degradation is not a signal if nobody counts it

A whole day was spent replacing false claims with honest ones: "saved but not showing",
"no open spot on the page", "the page still shows the old header for now". Every one is a
failure report, written in good English, delivered to exactly one person, and recorded
nowhere. The photo placer degraded honestly for months while the feature was dead, and the
only reason anyone found out is that Adrian happened to ask.

The wordmark stopped landing and the reply said so — accurately, to him — and neither of
us read it as a failure report. **A well-behaved failure is harder to see than a loud one,
precisely because it is well-behaved.**

`placement_outcomes` records every placement ATTEMPT, one row, branch only. Three things
make it work, and each was nearly got wrong:

1. **Successes are recorded too.** A branch count with no denominator cannot be read as a
   rate — the exact defect that made "94%" and "50 of 50" both mean something other than
   they said. `placed` costs one row and turns a count into a percentage.
2. **The name is not `degraded_outcomes`.** A table named for failures gets read as a list
   of problems, with its own denominator hidden inside it under a name denying it exists.
   Caught before shipping this time, unlike `asked_name`.
3. **The branch, never the sentence.** A branch is a stable enum the code chose; the
   sentence is model prose that varies every turn, and counting prose is a detector over
   free text.

**It paid for itself on the first row.** The wordmark bug had survived two runs of hand
forensics — anchor confirmed stamped, matcher confirmed matching offline, no second
document version, cause unknown. The first row the table ever wrote said:

    branch=failed  detail=create_business_document rejected: {"ok":false,"error":"invalid_created_by"}

One query, exact cause: `business_documents` CHECK allows `ai|user|patch|system` while
`create_business_document` validated against `ai|user|patch`. Two allowlists for one
concept, drifted — the third instance of "two of almost everything" in a day. The
difference between an instrument and an investigation is that the instrument answers in a
query, and it does so on the first failure rather than the fiftieth.

So, for any write path: **ask what row appears if this silently stops working.** If the
answer is none, the next month of it not working is free.

---

## Lesson 32 — measure the corpus for the SHAPE before choosing the scope of a fix

The layout net shipped on 2026-08-27 as `:where(li,dd,dt)>*:only-child{grid-column:1/-1}`.
Measured across 167 stored pages on 2026-09-12: **22 elements have exactly that collapse
and ZERO of them are li, dd or dt.** They are `div`, `article` and `section`, with tracks
like `48px 600px` and `58px 998px`.

The rule covered nothing. It had looked like a fix for sixteen days.

The reason is not carelessness, and that is what makes it worth writing down. The page that
prompted the fix used a LIST, so the rule was fitted to the single failing example rather
than to the shape. One instance produced a rule that covers exactly one instance.

**The measurement is not the expensive part; not doing it is.** Scanning the corpus for the
shape took about ten minutes, cost nothing, and ran on stored bytes — no quota, no live
traffic, no browser walk. Run in August it would have returned the same answer: zero li,
all div and article. The rule would have been written unscoped the first time and this
would never have been a bug.

So, mechanically, when fixing a defect on a generated page:

1. **Describe the shape** — a sole child in a multi-track grid, text squeezed to a fixed
   track — separately from the instance you are looking at.
2. **Count it across the stored corpus** before choosing the selector, the tag list, or the
   condition. The pages are already on disk.
3. **Let the count choose the scope.** If every instance is outside your intended scope,
   the scope is wrong — and you will only find that out from the number.

This sits under "a pass that enumerates is prompt guidance with extra steps": that lesson
says what goes wrong, this one says what would have prevented it. And the corollary is
sharper than either — **a fix fitted to one example is indistinguishable from a working fix
until somebody counts.**

---

## Lesson 33 — a scorer with a penalty list is an enumeration wearing a number

(Adrian called this Lesson 16; the file was already past 30, so it is 33 here. Same rule.)

`findServiceNameElement` ranks candidate elements — headings score 3, `dt`/`th` score 2,
everything else 1, plus a bonus for an exact text match and a **penalty of −5 for
`data-hc="hero|nav|footer|announce|cta"`**. It looks like judgement. It is a list of five
things somebody thought of, with arithmetic on top.

**It has now picked header furniture twice:**

- **2026-09-11** — stamping the business-name slot, it chose `<title>`. "Photography"
  appeared three times as a leaf and the scorer took the first. The business's name would
  have been inserted inside `<head>`.
- **2026-09-12** — stamping a service anchor, it chose a `<div class="service-label">`
  inside `.brand-slot` in the page `<header>`: a strapline, not a service entry. That one
  shipped, and produced two functions contradicting each other in front of an owner —
  "I couldn't get them onto the page" followed by "that page already has a services area."

`header` was not on the penalty list. Adding it would have been the fifth patch to the same
enumeration, and the model writes a new shape every build, so there would be a sixth.

**The failure mode is what makes it dangerous: an enumeration that MISSES returns nothing,
which is visible. A scorer that misses returns SOMETHING, which reads as success.** It
always finds a best candidate, because "best" is just the highest number in a list that may
contain no correct answer at all. There is no branch for "none of these qualify".

So: replace scoring with **structural constraints** — what must be TRUE of the thing, not
what we remember to exclude. For a service anchor: inside `<body>`, not inside `<header>`,
`<nav>` or `<footer>`, not inside any `.brand-*` container, and `findServiceEntryBounds`
succeeds on it. Same shape as `findNameSlotElement`, written when this scorer failed on the
name.

And keep the empty answer available. **A page with no valid anchor is a true fact we can
act on; a page with a wrong anchor is a false one we cannot.** Stamping nothing is a
result, not a failure.

---

## Lesson 34 — a harness that reimplements a production predicate is measuring its replica

The B3 corpus survey reimplemented `findServiceEntryBounds` in the measurement script
rather than importing it. It disagreed with the real function on one page out of 167 — a
number I reported before noticing, and only caught because a later run using the real
function returned a different count.

One page in 167 sounds like rounding. It is not: the number was being used to decide
whether a predicate change was safe to ship, and the threshold for "stop and tell me" was
"near zero". A replica that drifts by one page can put a real change on the wrong side of a
gate.

The timing is the point. This happened **on the night the duplicate-predicate bug was being
fixed in the product** — two functions holding two definitions of "does this page have a
services area", found and collapsed into one. The harness measuring that fix had quietly
made a third copy.

**Rule: a harness imports the production function, or it does not ship a number.** If the
function is not exported, export it — `allGuessServiceRows` was made exportable for exactly
this and cost one word. An unexported function is not a reason to reimplement; it is a
reason to export.

The tell is easy to miss because a replica is usually *written from* the original, so it is
right at the moment it is written and wrong the first time either side changes. That is the
same drift as any duplicated logic — it just happens in a file nobody thinks of as product
code.

## Lesson 35 — a constraint applied at write time but not at read time is not a constraint

`isStampableServiceElement` was introduced to stop the stamper marking header furniture as
a service anchor: inside `<body>`, not inside `<header>`/`<nav>`/`<footer>`, not inside a
`.brand-*` container, and joinable. It worked — the stamper stopped producing bad anchors.

But `allServiceAnchors`, which READS anchors for the inserter, required only
`findServiceEntryBounds`. So an anchor already sitting in header furniture — because an
older build stamped it, or a page arrived from anywhere else — was refused by the writer
and **accepted by the reader**.

Red-proved on the `site-f71f30` shape: a `<strong data-hubly-service>` inside
`.trade-label` inside `<header>`, joinable because an ancestor `<div>` qualifies. The
inserter cloned it and wrote **"Ceramic Coating, $600" into the page header**, beside the
business's branding. One owner asking for a price would have put a service in their own
logo area.

**The wrong value does not need the door you locked. It enters by the other one.** Guarding
creation while leaving consumption open protects only against futures, never against the
present — and the corpus is the present: two pages carried exactly this anchor tonight.

So: when a constraint defines what something IS, every function that asks "is this one?"
uses it — the writer, the reader, the checker, the repair script. One function answers, and
the answer cannot depend on which door you came through. This is the third pair of gates
tonight holding two definitions of one fact, after the two slugifiers and the two
"has a services area" tests.

## Lesson 36 — looking and measuring fail differently, and neither substitutes for the other

Both directions happened in one night on the same work, which is the only reason this is a
lesson and not a preference.

**A metric passed two pages the screenshots caught.** The services block was measured as
inserted, in the frame, and above 4.5:1 in pixel contrast — and two pages still looked broken
when rendered and looked at: the block sat at a different inset from everything around it, full
bleed on a page whose content sat in a column. No assertion in the suite asks "is this in the
same place as the rest of the page", because nobody had thought to ask it until they saw it.

**A measurement caught five pages the screenshots passed.** Then the inset was measured across
the corpus rather than sampled, and pages that *looked* fine in a screenshot were 300–900px out —
including the block's rows pushed to x=1038 on a 1280px page, which a fullpage screenshot at a
glance reads as "a right-aligned block", not as a defect. Five of those were never going to be
found by looking, because looking does not scale to 129 pages and the eye forgives what it can
explain.

And the same night, in the other direction: **a byte count said seven pages had no CSS, and one
screenshot said they were finished pages.** The count was right about the bytes and wrong about
the page, because the CSS was in the app shell. Looking is what disproved it; counting is what
found it worth checking.

**Rule: a finding about how something LOOKS is not closed until it has been both rendered and
counted.** Render it, because legibility, overlap, jumping and "this sits in the wrong place"
have no number until somebody names one. Count it, because a sample of 11 cannot tell you whether
you are looking at 1 page or 60, and because the eye stops seeing a defect it has seen twice.

The trap is that each method's blind spot is invisible from inside the other. A screenshot cannot
tell you how many pages share the defect. A metric cannot tell you it is measuring the wrong
thing — the inset metric's first version returned page medians of 670px on a 1280px page and
reported them without complaint; only rendering one page and reading the elements it had measured
showed it was averaging in inline `<span>` positions. The second pass was not a formality. It was
the pass that made the first one's numbers mean anything.

## Lesson 37 — a harness that renders stored content outside the shell the product mounts it in is measuring a document that does not exist

The style-byte sweep rendered `rendered_html` straight from the row: `setContent(html)`,
screenshot, count. Seven pages came back with 29 bytes of CSS and framework class names,
which reads unambiguously as "we generated and served a page with no stylesheet". It was
reported as a finding, and repeated to Adrian as fact.

The product does not mount a page that way. `hcMountDocumentHtml` in `public/hubly.html`
reads the format and mounts one of two ways:

- **full document** (starts with a doctype) → a same-origin `srcdoc` iframe, so every byte
  of CSS it needs must be inside it;
- **AST fragment** (no doctype) → `innerHTML` on `#hc-doc-root`, where the shell's own
  `journey-os/hubly-document.css` applies — 158,752 bytes of closed utility CSS scoped
  `#hc-doc-root .py-20{…}`.

The seven were all the second kind. Their 29 bytes are `#hc-doc-root{--brand:#c25a3a}`, the
brand hookup for that stylesheet — the mechanism working, not a stub. Rendered in the real
shell they are finished pages; rendered as the harness rendered them they are the unstyled
documents the byte count described. **The harness was rendering something no customer has
ever seen, and it was confident about it.**

Two ways this is worse than an ordinary wrong number. It produced a FALSE ALARM, which costs
more than a miss: a miss is silence, an alarm spends a night, reaches the person you report
to, and gets repeated as fact. And it was invisible from inside the measurement — every
individual step was right (the bytes were the bytes, the screenshot was of the HTML it was
given), so nothing in the run could go red.

**Rule: every page measurement mounts through the real path, both formats.** No script
decides for itself how to render a stored page; they all call
`scripts/lib/mount-as-product.mjs`, which reproduces `hcMountDocumentHtml` — iframe for a
full document, `#hc-doc-root` plus the shell stylesheets for a fragment — and hands back the
frame the page actually lives in.

The mount decision is one fact in two copies, because a browser file cannot import from a
harness. So it is checked rather than hoped: `scripts/check-mount-predicate.mjs` reads the
regex out of `public/hubly.html`, compares it to the harness's own, tests both against the
shapes the corpus contains, and confirms the shell still links the stylesheets an AST page
depends on. It goes red on a one-character change to either side.

That is the fifth pair of gates holding one definition of a fact in a week — after the two
slugifiers, the two "has a services area" tests, the writer/reader anchor pair, and the
harness that re-implemented `findServiceEntryBounds`. **This one was in our instruments, not
in the product, which is the reason to write it down: the discipline we apply to the code is
not yet applied to the things that measure the code, and a wrong instrument does not fail —
it reports.**

## Lesson 38 — never create a file with a redirect onto a path you have not checked is empty

Building the shared mount module, I needed a small tag walker and wrote it to
`supabase/functions/_shared/hubly_html_scan.ts` with `cat > … <<'EOF'`. That path already
held a 279-line HTML scanner — the one with byte-range element bounds, raw-text handling
for `<style>`, and the comment explaining why it never rebuilds a document. The redirect
destroyed it. The next `deno check` failed on a missing export and `git checkout` restored
it inside a minute.

It cost nothing only because the repo happened to be clean at that moment. It has not
always been, and it will not always be — half of tonight's work sat uncommitted for an hour
at a time.

**Rule: a redirect (`>`, `cat >`, `tee`) may only create a file at a path confirmed not to
exist.** Check first, or use the Write tool, which refuses to overwrite a file this session
has not read. The same applies to `mv` onto an existing path and to `cp` over one.

The deeper version is the one already written down for the product: **look at the target
before you overwrite it.** I have been applying that rule all week to generated pages —
never regenerate what you can patch, never discard a draft, never replace what you have not
read — while running commands that do exactly that to my own repository. A tool that
destroys silently is a tool that needs the check built in, not remembered.

And the restore is the other half of the lesson: it worked because the file was committed.
The instruments deserve the same discipline as the product — commit before a session of
file surgery, so `git checkout` is always available as the undo.

## Lesson 39 — a recording call must be proved to fire on the success path, not merely to exist

`notePlacement("addServicesBlock", "inserted", …)` was written, reviewed, correct, and
unreachable: it sat inside `if (!saved || saved.ok !== true) { … }`, two lines below the row
that records the failure. The services area went onto a real owner's page and
`placement_outcomes` had nothing to say about it, because the only row naming success fired
exclusively when the save had just failed.

Every test that existed passed. They would: the failure path DOES write its row, and nothing
asked whether the success path writes one.

**Rule: an instrument is verified on the path it is meant to observe.** For a recorder that
means the success path specifically — the branch least likely to be exercised by a test
suite, because tests are written about failures and reviews read the lines that are there,
not the lines that run.

Three things make it hard to see, all worth naming:

1. **The call is present.** Grep says the recorder covers this function. Presence is what a
   reviewer checks and presence is exactly what is not in question.
2. **The table looks alive.** `placement_outcomes` had rows — for other functions, and for
   this one's failures. A table with rows in it reads as a working instrument.
3. **The blind spot is in the instrument's own instrument.** The first version of the check
   written for this scanned for `notePlacement(` and found 9 call sites across 2 functions.
   The real answer is 17 across 3: one function records through a local `say()` wrapper — and
   it is the very function whose rows we were reading when the defect was found.

   That third one is the transferable part, so it gets its own sentence: **the count was
   wrong and the check was green, and the only thing that caught it was not believing the
   number.**

### The same failure, twice more, in text-scanning guards (2026-09-12)

**A guard that does not tokenise its input the way the compiler does reports coverage it
does not have** — and it inflates its own number while doing it, which is the worst failure
mode a guard has: it looks *stronger* than it is.

Two instances, one day apart, both mine:

1. **The directive net paired backticks naively.** It scans `` `…` `` template literals in
   `hubly_owner_replies.ts` for phrases addressed to a model. A closing backtick and the
   next opening one bound a "sentence" — so the COMMENTS between two literals were scanned
   as if an owner would read them. It reported **25 owner sentences checked when 21 were
   real**, and the four phantoms were comment text. The one live directive it existed to
   catch — *"Say that plainly — do not say the price is on the page"* — was inside the 21
   it mis-tokenised around. Fixed by stripping comments before the scan.

2. **The verification-carried check found the wrong `{`.** It located a function body as
   "the first `{` after the function name", and a TypeScript parameter can be an object
   type: `services: { name: string; price?: number }[]`. So it extracted parameter types
   as the body, found no `return {` inside them, and passed everything. It reported
   "2 verification values, all carried" — and did not move when the field it was written to
   catch was deleted from the product. Fixed by walking the parameter list to its balanced
   close first.

The tell is identical in both: **a count that looks plausible and a check that is green.**
Neither failed. Both reported. What caught them was removing the thing the check exists to
catch and watching it stay green — which is the only test of a guard that means anything, and
is why every check written in this run red-proofs itself against the real product and not
only against a fixture.

If you are writing a source-scanning check: strip comments first, walk brackets rather than
reaching for the next one, and prove it red on the real file before trusting a single number
it prints.

**And then stop writing them this way at all.** There were three of these in two days —
comments scanned as sentences, parameter types parsed as a function body, closing braces
counted as statements — and a fourth in the warn-then-proceed classifier. Each made a check
report coverage it did not have; each cost an investigation. That is not a run of bad luck, it
is the predictable cost of deciding code structure with line windows.

**RULE: a check that reasons about code structure walks an AST.** A parser is already in the
toolchain — the inline scripts of `public/hubly.html` are parsed on every commit to prove they
still compile ("inline scripts parsed: 7, failing: 0"), so `new Function(src)` and a real
tokeniser are both available with no new dependency. Regex is fine for FINDING a candidate
line. It is not fine for deciding what encloses it, what returns it, or what follows it —
those are parser questions, and every time they have been answered with a line window the
answer has been wrong.

Not a call to rewrite the existing five. New checks, and any check you touch.
 9 across 2 looked plausible; it was checked against the file (12 raw occurrences
   of `notePlacement(`, three functions named in the rows) and did not survive. A scanner
   reports what it can see, never what it cannot, and its silence about a wrapper reads
   exactly like an absence of wrappers. So a census from a new scanner is not a result until
   it has been reconciled against a second source — the raw grep, the table's own distinct
   values, the function names in the rows. Every instrument written tonight was wrong on its
   first run: the mount harness rendered the wrong document, the legibility harness measured
   an unsettled viewport and reported 15 of 132 as the whole corpus, the keepability pass
   compared unescaped URLs, and this one could not see a wrapper. None of them failed. They
   all reported.

The check that holds it (`scripts/check-recording-on-success.mjs`) red-proofs its own detector
on every run and exits 2 if it cannot tell a guarded call from an unguarded one. A detector
that cannot fail is the thing it was written to catch.

## Lesson 40 — a check's first green is meaningless; only a green that follows a red proved in the same run counts

Three source-scanning guards in two days passed their first run and were wrong. Each was
found the same way — by making the thing it exists to catch and watching it stay green:

| check | first green | what was actually true |
|---|---|---|
| the directive phrase net | PASS, "25 owner sentences scanned" | it was scanning comment text as sentences; 21 were real, and a live directive sat in the part it mis-tokenised around |
| `check-verification-carried.mjs` | PASS, "2 values, all carried" | it had parsed parameter TYPES as the function body; deleting the field it was written to catch did not move it |
| `check-mount-predicate.mjs` | PASS | true, but proved only by a one-off manual mutation in a session nobody will re-read |

None of them failed. **They all reported.** That is the whole problem: a broken check and a
satisfied check produce identical output, and the identical output is a pass.

**The rule: every check in `scripts/` red-proofs itself on every run.** It takes a known-good
input, mutates it into a known-bad one, asserts the detector says so, and exits 2 — CANNOT RUN
— if it cannot tell them apart. Then it says `(detector red-proofed this run)` in its own PASS
line, so the green is evidence rather than an absence of noise.

A check red-proofed once, by hand, in a commit nobody re-reads, is a check that was working on
the day it was written. A check that self-red-proofs announces the day it stops.

**Audit, 2026-09-12:** 97 checks in `scripts/`. **Two** self-red-proofed
(`check-recording-on-success.mjs`, `check-verification-carried.mjs`); one more proved the
GUARDED behaviour but not its own detector (`page-css-guard.check.ts`). Four have been
retrofitted — the phrase net, the mount predicate, the block-chain check, and the two that
already had it. The remaining ~90 are older and untouched; they are not all worth the work,
but any check that gates a decision is, and the ones that gate tonight's decisions now do it.

The cheapest version of this rule, if nothing else survives: **before trusting a number a new
check prints, break the thing it measures and watch it go red.** Every instrument written in
this run was wrong on its first run. None of them failed.

## Lesson 41 — a warning in a path that proceeds anyway is not a guard, it is a confession

`renderThemedBookingLanding` begins:

```js
if(biz==null||biz===''){
  console.warn('renderThemedBookingLanding called without biz — use renderBookingLanding(\'pub\')');
  ({biz,phone,city,email}=getBookingLandingFields('pub'));
}
```

…and then paints the booking page. On a customer load of a stale link that warning fired
**five times**, and the page rendered an empty business name, a hardcoded "BR" monogram,
"Professional business — clear packages, easy booking", and an instruction addressed to the
owner. The code detected the broken precondition, said so out loud, and rendered a stranger's
initials to a customer.

**The rule: if the condition is wrong enough to warn about, it is wrong enough to stop.** A
warning that does not stop the path is a note to a developer who is not there, on a screen
nobody is watching, about a page a customer is already looking at. Either recover to a state
that is true, or refuse and say so — the refusal is already written in that file ("This page
isn't live yet") and this path painted over it.

**The sweep, with its limit stated, because the limit is the interesting part.** 214
`console.warn`/`console.error` sites in `public/`. Asking a scanner "does it then render?"
does not work: in the known instance the warning is at the top of the function and the first
`innerHTML` is forty lines below it, past a dozen `getElementById` calls. Widening the window
until that one case appears would be tuning a check to pass, so `check-warning-then-proceed.mjs`
does not do it. What is decidable is narrower and still useful — a warning whose own MESSAGE
admits a broken precondition, outside a `catch`, with no stop after it:

| | |
|---|---|
| `hubly.html:33348` | `renderThemedBookingLanding called without biz` — **the instance. Fixed by the caller's guard.** |
| `hubly.html:13651` | `[Hubly CEO Demo] seed module missing — empty Operate shell` — behind a secret key, and the message names exactly what it renders. Diagnostic. |
| `hubly.html:17108` | `saveStorefront portfolio host failures` — recovers: it tells the owner ("Some photos need another Save on Wi-Fi") or reschedules the write. Diagnostic. |

One real, two honest. The value is not the count; it is that the list is three lines long and a
person can read it. A check that cannot decide should hand you a short list rather than a
confident number.

## Lesson 42 — a rule that only lives in a document is a preference; a rule that fails the run is a rule

`supabase db push` had been banned in `CLAUDE.md` and in the standing notes for three weeks,
with the reason written out: the ledger is unreconciled, so push replays history.

On 2026-09-12 it was run anyway — by me, to apply two additive migrations, reaching for the
normal tool without re-reading the prose that forbade it. It replayed 53 unrecorded files,
reached `20260823140000_mark_test_accounts.sql`, and failed on statement 6 because
`account_kind = 'real'` stopped being a valid value in August.

**Statement 5 was:**

```sql
update public.businesses set account_kind = 'test'
  where account_kind <> 'test' and id not in (…9 ids captured 2026-08-23…);
```

Every market and internal business created since August — Graef included — relabelled as a
test account, and every adoption, usage and value number computed from that column silently
wrong from that moment, with nothing in the product that would notice. The file ran in a
transaction and rolled back. **That was luck about transaction scope, not a safeguard**, and
the rollback was proved rather than assumed: four market businesses created after the
allowlist was written still read `market`, which they could not if the update had committed.

**The rule: if a prohibition matters, something has to fail when it is violated.** Prose in a
document is read by whoever is already being careful. The person about to run the dangerous
thing is, by definition, the person not reading it right then — they are reaching for a tool
they have used a hundred times elsewhere.

What changed after the incident, in the order that matters:

1. **A check that fails**: `scripts/check-no-db-push.mjs` scans every tracked command-carrying
   file and fails if `supabase db push` appears anywhere it could run. It red-proofs itself,
   and it allows the command to be NAMED inside a prohibition — a ban has to be able to say
   what it bans.
2. **It immediately found a loaded gun nobody knew about**:
   `scripts/deploy-adobe-oauth-edges.sh:55` ran `npx supabase db push --linked` as part of a
   deploy. Anyone running that script, for reasons having nothing to do with migrations, would
   have detonated the same file. Removed the same hour. *The prose ban had been in place the
   entire time that script existed.*
3. **The rule where the hand is**: restated at the top of `CLAUDE.md`, and in
   `supabase/migrations/README.md` — the directory someone is standing in when they decide to
   run it.

The generalisation, and it applies well beyond this command: **every standing prohibition in
this repo should be read as a question — what fails if someone does it anyway?** Where the
answer is "nothing", the prohibition is decoration, and the next violation is a matter of time
and tiredness rather than intent.
