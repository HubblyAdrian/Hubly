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

---

## Lesson 11 — a truth string may not claim a value is on the page unless the value is in the bytes

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
