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
> **THIS COUNT IS DERIVED, NOT TRANSCRIBED — 2026-09-17.** It read *"this file holds 35
> lessons … numbered headings run 4 → 33"* while the file carried **89 headings running to
> Lesson 96**. A hand-kept number in a file about hand-kept numbers, and it had been wrong for
> weeks. It is not maintained by hand any more:
>
> ```
> grep -c '^## Lesson' docs/CHECKER_LESSONS.md        # headings
> grep -o '^## Lesson [0-9b]*' docs/CHECKER_LESSONS.md | tail -1   # the highest, for the next number
> ```
>
> **89 headings, running 4 → 96**, plus lessons **1–3**, which are the three instances described
> narratively in the opening section and have no heading — which is why a later count read the file
> as starting at 4. **11 and 11b** are both present: two lessons written with the same number on
> different days, and renumbering would invalidate every citation in the commit history since, so
> the second became 11b. Gaps in the sequence are real and deliberate for the same reason.
>
> Before adding a lesson, run the second command above and take the next number. Do not write a
> total here again.
>
> A lessons file that miscounts its own lessons undermines the method it documents — caught the
> first time on 2026-09-12 (notes said 15, the file held 31), and the correction itself then went
> stale, which is the whole argument for deriving it.

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

## Lesson 43 — a gate built from the failures we have seen catches the failures we have seen

Assertion 1 asked: *does every `href="#…"` resolve to an element that exists?* It was written
the day we found a dead anchor, and it answers the only question a dead anchor raises.

On 2026-09-12 Adrian clicked "See how the quote works" on a live page and nothing happened.
The gate had passed that page — because `#process` **does** exist. The link resolves perfectly
and the click navigates the frame to the site root, because a `srcdoc` document has no URL of
its own and resolves a fragment against its PARENT's. Target exists, click is wrong, check
green.

Measured across 40 stored pages, clicking every fragment link: **0 of 119 scrolled.** 55
navigated the frame away, 64 did nothing. Not one in-page link in the corpus worked, and the
gate written to guard in-page links said they were fine.

**The rule: a gate asserts the OUTCOME a person needs, not the precondition the last bug
happened to violate.** "The target exists" is a precondition. "Clicking it brings the target
into view" is the outcome. The first is cheap and static and was what the previous failure
made obvious; the second is what a customer experiences, and it is only measurable by doing it.

The assertion now clicks. Before the fix it reports:

```
RED  1. every in-page href="#…" resolves AND scrolls to its target
        #process — the click navigated the frame to another document
```

The uncomfortable part, worth keeping: **every check in this file is vulnerable to the same
thing.** Each was written from a failure we had already been shown, and each therefore encodes
that failure's shape. The defence is not cleverness at design time — it is that when a person
finds something a green suite missed, the FIRST question is "what precondition was this check
asking instead of the outcome?", and the check is widened before the bug is fixed.

## Lesson 44 — you may correct a check's definition of success; you may not widen it until a known-bad case passes

The same edit is either discipline or self-deception, and the difference is one question.

On 2026-09-12 assertion 1 was taught to click fragment links and require the target to come
into view. It then reported three permanent failures: `lugnutz #book`,
`rell-okonjo-photography #contact`, `weekly-lawn-care-…-b2041 #quote`. Each targets the LAST
section of its page. The page scrolls to its maximum — `scrollY === maxScroll` — and the target
settles a few hundred pixels down, fully on screen. The browser has done everything available
to it. The check was demanding "at the top", which that page can never give.

So the check was changed, AFTER it went red, to ask whether the target is ON SCREEN. That is
the shape of every bad decision in testing: a check goes red, the check gets edited, the red
goes away.

**The line: a correction changes what success MEANS; a tune changes what success INCLUDES until
the failure you are looking at stops failing.** And there is one test that tells them apart:

> **Does the check still go red on the defect it was written for, in the same run?**

Here it does. With the loosened condition, `ironwood-fence` still reports:

```
RED  1. every in-page href="#…" resolves AND scrolls to its target
        #process — the click navigated the frame to another document
```

A navigation still fails. A page that does not move still fails. What no longer fails is a link
that did its job on a page that had no more scroll to give.

**The rule for every future loosening: show the original defect going red in the same run, in
the report, next to the loosening.** If it cannot be shown, the change is a tune and does not
ship — and the honest alternative is to leave the check red and record the known exception by
name, which is what `KNOWN_UNREADABLE` does in the legibility suite.

The reason to be strict about this: a check that fails permanently on a correct outcome trains
people to ignore it, and an ignored check is worse than no check, because it still reports
green on the days it matters.

## Lesson 45 — Re-run THE report, not A report over the same data (2026-09-12)

The chain clone's headline number was `inset match 103/127`. Re-running it after the contrast
work produced `19/127`, and it was reported in a table cell labelled **unmoved** — a word that
resolved the contradiction instead of raising it. Adrian caught it; the instrument had changed,
not the product.

Two reporters read the same `inset-rows3.jsonl` under near-identical headers:
- `report4.mjs` uses `block.textStart` — the block's FIRST text left. 37 → 103 (81%).
- `report-v3.mjs` uses `block.textMedian` — the MEDIAN text left. 34 → 19 (15%).

Both are correct arithmetic. Only one asks the question the work was for. A multi-column card
grid — exactly what the chain clone produces — must fail textMedian, because half its text sits
in columns two and three: 93 of 127 blocks start at the page's content column and have a median
that does not. Verified on both corpora with the same code; the numbers are identical, so
neither the corpus nor the re-injected runtime was involved.

Three rules out of it:
1. **A number is a (measurement, reporter) pair.** Re-running the measurement and reading it
   with a different reporter is a different number. Record which reporter produced a headline
   figure at the moment it is quoted.
2. **Never attach a resolving word — "unmoved", "stable", "unchanged" — to a number that
   differs from the one reported before.** The contradiction leads the report; the explanation
   follows it. A cell is not the place to settle a discrepancy.
3. **When two reporters exist over one dataset, the one that does not answer the question is a
   trap with a plausible header.** Delete it or rename it to say what it measures.

## Lesson 46 — A dry run on a convenience sample is a smoke test, not a rate (2026-09-12)

`repair-fragment-links.mjs` was dry-run with `--limit=6`. Five pages passed the inverse byte
proof and one, `hearth-iron`, was refused. That went into the plan as "hearth-iron refused" —
a named exception, as if the picture were complete.

The real run: **18 of 163 refused**, `crestview-window-cleaning` — the walk gate's own default
page — among them. The rate was 1-in-6 all along; the sample was too small to show it and the
first six pages were whatever the query returned first, which is not a sample at all.

- A limited dry run answers "does this run without crashing", never "how many will it affect".
- Carry the SAMPLE SIZE with any number taken from a limited run, and say what it cannot tell
  you. "1 of 6 refused" would have prompted the question; "hearth-iron refused" ended it.
- If the number will shape the plan, run the full pass in report mode. It costs one more run
  and it is the difference between a named exception and a class.

The same run also nearly produced the opposite error: the 18 refusals were first classified as
losing real content (−11 to −96 bytes), because the normaliser used to test "is it only
whitespace" collapsed runs but left a leading space, so `\n   </div>` still differed from
`</div>`. Normalising whitespace BETWEEN TAGS showed all 18 identical in substance. Check the
normaliser before reporting what the diff means.

## Lesson 47 — Every branch of a placement decision writes a row, including the branch that is nothing (2026-09-12)

`placeContactHoursInFreeform` reads:

```
if (hoursAnchorExists)      { update in place; record updated / alreadyPresent }
else if (hoursSectionExists){ missed.push("hours") }
```

There is no `else`. A page with no anchor and no hours section — **135 of 172 stored pages** —
takes neither branch: hours are not inserted, not recorded as `missed`, not recorded as
`alreadyPresent`, and no `rebuild_outcome_events` row is written. The owner's hours vanish
without a trace, and the telemetry that exists precisely to catch this reports nothing,
because nothing is exactly what it was told.

**THE THIRD TIME THIS WEEK the instrument was not watching the branch that mattered:**

1. the placement recorder that lived INSIDE the save-failure branch, so a successful
   placement recorded nothing;
2. `verifiedPlaced`, computed correctly and discarded one function later, so the reply was
   composed from a value that never arrived;
3. this missing `else`.

Same family, three disguises. So:

**A path that does nothing is a DECISION, and an undocumented decision is indistinguishable
from a bug that never ran.** Every branch of a placement decision — including the one where
the code does nothing at all — writes a row saying what it decided and why. When a decision
tree is written, the branch count and the recorded-outcome count are the same number; if they
are not, the missing one is the branch nobody will find.

## Lesson 48 — A how-it-works section keeps being read as a content section. Recognise the class, not the incident.

Twice this week, a recogniser that identifies a section BY ITS HEADING WORDS took a process
sequence for the content it names:

- the services donor cloned a **"How it works"** section instead of **"What we offer"** on 44
  of 127 pages — both are short headed items in a row, and by markup shape they are identical;
- `hasHoursHeading`'s `/^(listed )?schedule\b/` read a how-it-works step headed **"Schedule the
  installation"** as an existing schedule, and refused to place five real days of hours.

These are not two bugs. **Anything that recognises a section by its heading words must exclude
sequences explicitly**, and the predicate already exists: `describesASequence()` in
`hubly_services_block.ts`, built for the donor case, reading four markup and word facts
(step/process/timeline class, "how it works" heading text, a step-number class or CSS counter,
a step class on the item). Every new heading-word recogniser consults it, or it inherits this
bug on its first week.

## Lesson 49 — When the product already contains a correct example, READ IT. Do not build a mechanism to re-derive it. (2026-09-13)

Two days went into inferring what a services block should look like on a page we did not
design: a donor census, a chain clone that walks section → wrappers → item container, a
`describesASequence()` predicate to stop it cloning "How it works", an item-shape measurement,
an inset measurement against the page's content column, a box-match comparison against the
page's own items. Every one of those answers the question **"how do we infer this page's
design?"**

We never had to ask it. `evergreen-yard-care` has had the right services block the whole time —
a card, an image tile, the name, a baseline-aligned price with its unit beside it, a
description, and a full-width book button on the card's floor — and Adrian had been pointing at
that page as the reference. The answer was not a better inference mechanism. The answer was to
open the page and transcribe it (`docs/BLOCK_SPEC.md`).

**The rule:** before building anything that RECOGNISES, SCORES, or INFERS a design, ask whether
a correct example already exists in the product. If it does, read it and render it. An
inference mechanism has to be right on every page forever; a transcription has to be right
once. This is the same asymmetry as every other lesson here, pointed at design instead of data.

**The tell we missed:** the mechanism kept needing new exceptions — a sequence predicate, then
a heading-word exclusion, then a false-positive list. A rule that needs a new exception every
week is usually answering a question that did not need to be asked.

### The second tell, added 2026-09-13 after the fourth instance: **A COSTING THAT CONTAINS A NEW OBJECT.**

Four times now, in one week:

| we were about to build | what was already there |
|---|---|
| a design-inference mechanism | `evergreen-yard-care`'s block, and Adrian pointing at it |
| Jobs and Customers screens | both built, on the operator app, with no door |
| structural editing of a page | the whole `ws-pe-*` system, gated on being inside `/dashboard` |
| **`insertFreeformNode`, "the one new object"** | **the `+ Add service` affordance, shipping, wired end to end** |
| a `moveDesignKnob` action beside the four being wired | **`website.setDesignKnob`, already calling `applyOwnerDesignEdit` from a model-invocable handler — the model has had it all along** |

### The shapes of "unlit", and shape 7 is the worst

Eight instances in, they are not one failure. They fail differently and they present identically
to the owner as *"it doesn't work"*:

| # | shape | example |
|---|---|---|
| 1 | **built, no door** — the capability works and nothing reaches it | Jobs and Customers on the operator app; `moveFreeformSection` |
| 2 | **built, door present, switch off** — a gate keyed to a condition that is never true | `hcBust`'s `hasDocument !== false`; the classic editing surface |
| 3 | **built, described nowhere** — the model refuses correctly because its list does not say it can | `sectionMove`, `nodeMove`, `nodeDelete` |
| 4 | **built, reachable, invisible** — the door exists and something covers it | the Design button under the account chip |
| 5 | **built and reached, then undone** — it works and something removes the result | the `+` mounting, then the grid re-rendering |
| 6 | **UNREACHABLE BY THE CALLER IT WAS OFFERED TO** — the capability is described and wired, and its arguments cannot be constructed by the caller | `applyOwnerNodeMove` / `applyOwnerNodeDelete` take a `NodeAddress` carrying a fingerprint of a rendered element; the model has no DOM |
| **7** | **WIRED, DESCRIBED, REACHABLE — AND REFUSED BY AN AUTHORISATION IT WAS NEVER HANDED** | `website.moveSection`, 2026-09-13: wired, announced to the model, invoked correctly, and absent from `DRAFT_INJECTED_ACTIONS`, so it read a null owner and every claimed business refused it |
| 8 | **imported, re-exported, never called** — the import graph says live, the call graph says dead | `hubly_brain_experience_layer`; see Lesson 80 |

**Shape 6 is the worst to ship**, and it is the one we nearly did. The others fail as an absence
— nothing happens, and somebody eventually asks why. Shape 6 fails **as a product defect**: the
capability is advertised, the model invokes it confidently, and it errors on every single
attempt. An owner watching that does not conclude "this isn't built"; they conclude the product
is broken. **Before wiring anything, ask whether the caller can construct the arguments.**

**Shape 7 is worse, and we DID ship it** — for a day, on 2026-09-13.

`website.moveSection` was wired, described to the model, and reachable. The model picked it
correctly. It then read an owner uid that was never injected, saw `null`, and every claimed
business refused the write. **It failed for exactly the people it was built for** — a draft
owner has no sections to move; only a signed-in owner does — and it worked in no real case at
all.

What makes it the worst shape yet is that **it looks correct in every diff.** Shape 6 is
visible if you ask "can the caller construct the arguments". Shape 7 is invisible to that
question and to every other one a reviewer asks about the change, because the defect is not in
the change — it is in a LIST SOMEWHERE ELSE that the change needed to be added to and was not.
The handler is right. The capability description is right. The writer is right. The only wrong
thing is an absence in a file nobody opened.

And it is silent in the worst way: the write is refused with the authorisation key **present
and null**, which is indistinguishable at the RPC from a deliberate pre-claim write. The
`p_owner_id` invariant structurally cannot see it.

**The rule: an authorisation an action depends on may not live in a list maintained beside it.**
Derive it from the action, or the omission will ship — this one shipped three times
(`places.add`, `business.setHours`, `website.moveSection`), and the first two were caught only
because someone happened to run a check. `DRAFT_INJECTED_ACTIONS` is now derived from the
handlers' own source at module load, and a derivation that cannot read that source refuses to
serve rather than yielding an empty list. See D-053.

## Lesson 79 — A resolved reference is a guess wearing a precise type

A `NodeAddress` carries a fingerprint. It looks exact — it *is* exact, downstream of the moment
it was made. But it was derived from a WORD somebody chose, and upstream of that derivation the
precision is invented.

> **The precision is real downstream of the resolution and invented upstream of it.**

Every resolver has this shape: a label → an element, a service name → a row, a slug → a
business, a customer name → a customer. The resolved value has a type, an id, a fingerprint —
all the furniture of certainty — and none of it is evidence that the right thing was chosen.

**The rule: anything that turns a NAME into an IDENTITY must report what it resolved, whenever
the consequence is hard to see.** Not a confirmation prompt — that costs a turn on every
operation to guard against a rare miss. **Report it, and name the reversal, in the same breath
after acting:**

> *"That's the Clay & Seal card — removed. Say put it back if I picked the wrong one."*

That closes the gap the rule exists for. The owner cannot notice what he does not know was
there; now he does, and undoing it is one sentence.

**"Whenever the consequence is hard to see" is the whole test.** A wrong move is visible and
reversible in a word — report it and move on. A wrong delete removes something the owner will
never notice is gone; that needs the resolution named. Same resolver, different duty, decided
by what the owner can see afterwards.

**Same family as the fuzzy-merge refusal** (`get_business_services`, 2026-09-14): two stores
matched by name similarity, and a label matched to an element, are both **identity inferred from
a string**. There we refused to infer at all and reported the divergence; here we infer and
report what we inferred. The difference is whether the owner can act on the report — he can
answer "is that the same service?", and he can say "put it back".


The fourth one is the sharpest because the costing was explicit and careful and still wrong. It
named one new object, justified it, and the feature that object was for **was already in the
product and already worked** — `hcMountAddService` at `hubly.html:54739`, finding the grid
structurally, refusing an empty name, posting through the donor-clone placement path.

**The rule: a costing that contains a new object is a prompt to look again.** If a build needs
something that does not exist, check FIRST whether the thing it is FOR already does. The new
object is the tell, because it is the moment you have stopped describing what is missing and
started describing what you intend to write — and the gap between those two is exactly where an
existing capability hides.

Cheap to check and expensive to skip: one grep for the FEATURE's name before writing the
OBJECT's. Three of the four above were found by Adrian hitting them; this one was found by
reading, which is the whole difference.

## Lesson 50 — A decision's cost is recorded where decisions are READ, not in the commit that made it (2026-09-13)

Commit **`c2ff42d`** (2026-08-20), the switch to freeform page generation, did the honest
thing. It listed what it was giving up, by name — no booking, no enquiry form, no reviews, no
map, no photographs, no logo in the header, no structural editing, no styling controls, no
design rationale — and it wrote down, in the same message:

> *"a freeform page renders in an iframe, so nothing the shell wires to `#hc-doc-root` can
> reach inside it — booking will need the wiring moved, bridged, or the frame removed."*

That is the fragment-link defect, foreseen a month before we found it by clicking, and the
reason booking needed a URL rather than a bridge. **The list was written once and never read
again.** Scored on 2026-09-13: **7 of its 11 recorded gaps were still open or partial** — four
fully open, three partial — so most of a week's work was foreseeable rather than unlucky.

The commit was not the failure. **The place was.** A commit message is addressed to whoever is
reviewing that diff, on that day; nobody greps `git log` for the bill of a choice made a month
ago. So:

**Every decision's cost goes in `docs/DECISIONS.md` — the choice, the date and commit, the
reason QUOTED not paraphrased, what it gave up, and what is still outstanding — and the
outstanding part is updated as items close.** A path taken with no recorded reason is entered
as exactly that, because the absence is a finding (see D-006: an owner-only guard added inside
a commit about something else, no reason given, four days of refusing every draft).

And, as Lesson 42 already establishes, **a rule that lives only in a document is a
preference**: `scripts/decisions-open.mjs` prints every open item across every decision in one
screen, newest first, and `--check` refuses a record whose entries are undated or have no
outstanding list. That is what gets run at the start of a session and put in the handoff — not
the document.

## Lesson 51 — Navigating to the URL you are already on is not a reload (2026-09-13)

After deploying the claimed-shell fix I "reloaded" the page by navigating the tab to
`https://myhubly.app/#home` — while that tab was already at `https://myhubly.app/#home`. A
navigation to an identical URL, hash included, is a SAME-DOCUMENT navigation: the browser
changes nothing and the document in the tab stays exactly as it was. That document predated
the deploy by minutes, so the fix "did not work", and a cache-busted URL "fixed" it.

**I reported that as a product finding** — "a returning owner may not see this today" — and it
was promoted to the front of the build order before anyone checked it. It was wrong:

- `cache-control: public, max-age=0, must-revalidate` with an ETag on every HTML surface
- a conditional request returns **304**; revalidation works
- no service worker exists anywhere in `public/`
- a FRESH TAB on the plain URL shows the new layout, no cache-buster

Three rules out of it:
1. **To verify a deploy, open a new tab on the plain URL.** Not a hash change, not the same
   URL, not a cache-buster — a cache-buster proves the server is right and tells you nothing
   about what a returning visitor gets, which is the only question being asked.
2. **A cache-buster that "fixes" something is a warning, not a result.** It changes the URL,
   which changes the navigation type, which changes whether a load happens at all. Two
   variables moved; the conclusion named one.
3. **Before reporting an infrastructure defect, read the response headers.** Thirty seconds of
   `curl -I` would have disproved this before it reached a ruling.

**THE CLASS, because three of these landed in one week:**

> **When a measurement changes and the product did not, suspect the instrument first.**

- the corpus denominator — a rate moved because the population was 96% our own test drafts;
- two reporters over one data file under near-identical headers — 103 became 19 because a
  different field was read, and the word "unmoved" was attached to it;
- the browser's own navigation — a fix "failed" because no load had happened.

Every one made a number move while the product stood still, and every one was caught by
asking what the TOOL did, not what the answer meant. The cost of asking is seconds. The cost
of not asking, three times in one week, was a ruling built on a phantom.

## Lesson 52 — A reachability instrument that walks one level measures imports, not behaviour (2026-09-13)

The 25-destination nav audit took three attempts, and only the third was measuring the product:

- **v1** searched `hubly.html` for renderers and inbound links. It reported **0 renderers and 0
  inbound links for all 25 destinations.** The renderers live in `journey-os/journey.js`'s
  `onSwitchView` map, and navigation-by-name is `.ni[data-v="x"].click()` — neither of which v1
  looked for. It was reading the wrong file and would have concluded the entire shell was dead.
- **v2** read both files and walked ONE level from each renderer. It reported that **no
  destination touches a database.** `renderCustomers()` is a 12-line wrapper: it sets a mode,
  paints a loading stub, and calls `renderCustomersPageInner`, which calls
  `ensureCustomersOsState` and `ensureRecurringSchedulesLoaded`. Every read is two to four calls
  down. A one-level walk measures what a function MENTIONS, not what it DOES.
- **v3** walks the call graph to depth 4 across both files and prints the depth each read was
  found at, so under-reporting is visible in the output rather than implied by its absence.

**The rule: any instrument that answers "can X reach Y" must traverse, and must report its
depth and its visited count.** A reachability number without a traversal depth beside it is a
statement about imports. And the giveaway both times was the same one Lesson 51 names — the
answer was implausible (a shell with 25 working screens and zero renderers), and the
implausible answer was the tool's, not the product's.

Corollary, learned the expensive way in v3: it still could not classify 18 of the 25, because
those views render from client state loaded elsewhere. **When a traversal comes back empty,
that is a result about the ARCHITECTURE, not a verdict about the code** — here, that the views
do not own their data — and it must be reported as that rather than as "no data".

## Lesson 53 — A redirect that removes access is a DELETION OF CAPABILITY. Count the users, not the code paths. (2026-09-13)

`5a21a1b` changed which owners get routed out of the retired operator shell. It was reviewed
as a routing fix, red-proofed as a routing fix, and shipped as a routing fix. Nobody asked the
only question that matters: **who was using the nine surfaces it removed?**

The check ran after the push. It should have run before, and it takes one query:

> `graefs-autocare` — a real business with a paying owner — has **11 booking_requests
> (7 still open), 4 customers, 2 jobs, 1 service.** Not empty.

**The rule: before shipping anything that removes a route, count the ROWS behind the surfaces
it removes, for every live customer.** A code-path argument ("the operator side has no data
path to preserve") is a statement about code; this is a statement about people, and the two
are answered with different instruments. The row count takes seconds and is the only evidence
that distinguishes a retirement from a deletion.

Corollary: "nobody uses it" is a measurement, never an assumption — and its denominator is
live customers, not the corpus (Lesson: the corpus is 96% our own test drafts).

## Lesson 54 — A comment asserting a deliberate choice is a decision record filed where nothing reads it

The argument that `5a21a1b` overruled — *"Deliberately NOT a blanket /app redirect — jobs,
calendar, leads, customers, chats and the rest are working surfaces the front door does not
have yet, and removing them would cost more than the fabrications did"* — was correct, load
bearing, and sitting in `public/hubly.html:13777`, where nothing reads it. It surfaced only
because the change happened to touch those exact lines. Had the edit been three lines lower it
would have been overruled silently.

**Swept 2026-09-13:** comments containing *deliberately / intentionally / on purpose / by
design* — **329 across 123 files.** The heaviest: `hubly.html` 31, `hubly_capability_registry.ts`
28, `journey-os/journey.js` 28, `platform-home.html` 23, `hubly_document.ts` 14.

Every one is either **a decision that belongs in `docs/DECISIONS.md`** (it records a choice, an
alternative rejected, and a cost — e.g. `registry:354` *"Deliberately not merged into brief"*,
`platform-home:1584` *"Deliberately NOT the draft_token"*) or **a rule that belongs in a check**
(it states an invariant someone will break — e.g. `registry:225` *"the key is MANDATORY, and the
distinction is deliberate"*, which already HAS its check, which is why it survived).

Not moved yet — the list is the deliverable. The pattern to fix is that 329 arguments about why
the code is the way it is live in the one place a reader reaches only by accident.

**And one line in that sweep is the whole argument for enforcement over documentation:**
`registry:225` — *"the key is MANDATORY, and the distinction is deliberate"* — survived, and it
survived because it ALREADY HAS A CHECK (`check-owner-id-invariant.mjs`). Every other comment in
this list is an argument defended by nothing. The ones that hold are the ones something runs.

## Lesson 55 — A fix's scope claim must ENUMERATE the entry points, not the one you edited (2026-09-13)

`5a21a1b` was reported as "owners are routed out of the retired operator shell". It changes
`openOperateHome()`. That is **one door of six**, and the other five reach the same shell
without passing the new gate:

| entry | what it is |
|---|---|
| `openOperateHome()` | the one that was fixed |
| `hubly.html:13553` / `:13561` | a signed-in user hitting p-landing/p-signup/p-signin is pushed into `p-app`; `:13561` then calls `switchV(dash)` |
| `:18498` | session restored on boot → `showP('p-app')` |
| `:18696` | `goWebsiteSetup()` → `showP('p-app')` |
| `:14011`, `:14049` | the pixel-editor entries |

The instruction said "gate the redirect on the arriver", and the fix gated *the* arriver — as
though there were one. Nobody checked how many ways in there were, so a partial fix was
reported as a retirement, and the next step after it (closing the shell) would have been taken
on the belief that the shell was already unreachable.

**The rule: a claim about scope is a measurement.** Before saying "X is now routed away /
blocked / retired", grep for every call site that reaches X and list them — the fixed ones and
the unfixed ones. "I changed the function I found" is not a scope claim; "there are six entry
points, this changes one" is.

The accident worth noticing: because the fix was partial, the one live customer never lost
access to his 7 open leads. A correct-looking complete fix would have taken them away.

## Lesson 56 — A count over a mixed-status set is not a fact until the statuses are named (2026-09-13)

I reported "graefs-autocare has 7 open booking requests". The query was
`status <> 'accepted'`, and the 7 was **2 pending + 5 abandoned**.

Those are not the same event and cannot be added:

- **pending** — a real person sent a request and is WAITING FOR A REPLY. Two people.
- **abandoned** — someone opened the booking form and left. Nobody is waiting.

"7 people are waiting on Graef" is what a reader takes from that number, and it is wrong by a
factor of three and a half. The ruling that followed it ("closing the doors is an outage for a
paying customer") was built on the inflated reading.

**The rule: never report a count whose set spans statuses without naming the split in the same
line.** Exactly the denominator rule (`rateLine()` refuses a rate without its account_kind
split) pointed at a different column: `status`, `kind`, `role`, `account_kind` — any column
that changes what the row MEANS must appear beside the count, or the count is not yet a fact.

The tell was available and I did not look: I wrote `coalesce(r.status,'') <> 'accepted'` myself.
A query whose filter is a NEGATION is a count of "everything else", and everything else is
rarely one thing.

## Lesson 57 — Computed and dropped, three times. Now it fails the run. (2026-09-13)

| # | value | what it did |
|---|---|---|
| 1 | `verifiedPlaced` | computed correctly, dropped one function later; the reply was composed from a value that never arrived |
| 2 | `hcHomeCounts.openBookings` | a live `booking_requests` count on a real business, rendered by nothing |
| 3 | `hcHomeCounts.openLeads` | never rendered, AND counting `chatbot_conversations` while named leads |

Every one ran a real query against a real business and threw the answer away. **The cost is
never the wasted read — it is that the screen and the database disagree while the code looks
correct.** Two of the three were in the claimed shell as a SECOND READER of facts
`get_business_events` already owns, so repairing them in place would have produced a working
second reader, which is worse than a broken one. They were deleted, not fixed.

`scripts/check-computed-and-dropped.mjs` parses with **acorn** and fails when a property
written into a `*Counts` / `*Results` / `*Totals` / `*Stats` object is never read. Scoped to
those objects on purpose: a repo-wide unused-value scanner becomes noise, and a check everyone
exempts is a dead check.

**Two instrument failures while building it, both caught by an implausible answer:**
1. The first red-proof passed. `ROOT` was the script's own repo, so the mutated copy was never
   read — the check was measuring the real file both times. Absolute paths now bypass `ROOT`.
2. The second red-proof passed too. The "is it used as a string key?" escape hatch regexed the
   raw source, and was satisfied by **the deletion comment that named the very property it was
   meant to catch** (`` `openBookings` `` in backticks). String literals are now collected from
   the AST, which never sees comments.

The escape hatch exists because the consumer is `countKey:'jobsToday'` — an indirection no AST
can follow. **An AST alone would under-report here**, and that is stated in the check rather
than assumed.

## Lesson 58 — A red-proof that PASSES is a result about the instrument, not about the code (2026-09-13)

Sits next to "a check's first green is meaningless." Five instrument failures in one week:

| # | instrument | what it reported | what was true |
|---|---|---|---|
| 1 | nav audit v1 | 0 renderers for 25 destinations | it was reading the wrong file |
| 2 | nav audit v2 | 0 database reads, anywhere | it walked one level; every read is 2–4 calls down |
| 3 | the two inset reporters | 103 became 19, labelled "unmoved" | two reporters, one `.jsonl`, near-identical headers |
| 4 | check-computed-and-dropped | red-proof PASSED | paths resolved against the script's own repo, so the mutated copy was never opened — it parsed the real file twice |
| 5 | the same check | red-proof PASSED again | the string escape hatch regexed raw source and was satisfied by the DELETION COMMENT naming the property it was meant to catch |

**Every one was caught because a human thought the answer looked implausible.** That is
attention, not method, and attention does not survive a long night. Four and five are the
sharpest: the red-proof passing is what a working check looks like from the outside.

**THE MECHANICAL FIX — `scripts/lib/read-receipt.mjs`, shared, not per-script.**

- `receipt(path)` prints the **absolute path, byte count and content hash** of everything a
  check opens, before it reports anything. Failure 1 and failure 4 are both visible in that one
  line: the wrong file names itself, and a red-proof reading the baseline twice prints the same
  hash twice.
- `expectDifferent(mutated, baseline)` is a red-proof's own postcondition. It **exits 2 —
  CANNOT RUN, never a pass —** when the two are the same bytes. A red-proof may no longer
  silently test nothing.

Retrofitted into `check-computed-and-dropped`, `check-retired-shell-exit`,
`check-denominator-rule` and `decisions-open`. **The rule: a check states what it read before
it states what it found.** An unsourced finding is an opinion with an exit code.

## Lesson 59 — A value summed from a paginated result is not an aggregate (2026-09-13)

`get_business_customers(p_business_id, p_owner_id, p_limit integer DEFAULT 8)`. Summing
`total_billed` across the rows it returns gives the total for **a page**, not for the business.

It reads as correct today because the only live business has **4 customers**, which is under
every limit in the codebase. It would be silently wrong for a real one: no error, no empty
state, just a number that is too small — and too small in a way that looks plausible.

**The fix is not a bigger limit.** Passing `p_limit: 500` moves the failure to a size nobody
predicted and fails identically when it arrives. **Either the aggregate is computed
server-side, or it is not rendered.**

**SUMMED, NOT FOLDED — the distinction, in the lesson and not only in the check, because the
next person will hit the same false positive.** `list.reduce((a, e) => t > a ? t : a, 0)` over a
page is **legitimate**: it finds the newest event in the page in order to mark what was just
shown as seen, and "the newest thing I displayed" is by definition a property of the page. A
max, a min, a concat and a find are all fine. **Addition is not**, because addition claims to
describe a whole that the page does not contain. The check requires additive accumulation for
exactly this reason.

The page limits, established 2026-09-13: `get_business_customers` **8** · `get_business_events`
**30** · `get_business_notifications` **8** · client reads of `booking_requests` and `jobs`
**200** · one RPC with an internal `limit 80`.

**Building the check took three tries, and each failure is worth more than the check:**
1. It blew the stack. The `_parent` back-links it adds make the tree cyclic, and the walk
   followed them back up forever.
2. Its red-proof PASSED. It tainted only the RPC result `r`, while real code extracts first —
   `var rows = (r && r.data) || []` — and sums `rows`. Taint now propagates through
   derivation until it stops changing.
3. Then it failed on the REAL file, at `platform-home.html:3679` — and that was a FALSE
   POSITIVE worth keeping: `list.reduce((a,e) => t > a ? t : a, 0)` is a MAX of timestamps,
   used to mark the events just shown as seen. Over a page that is not merely acceptable, it
   is the only correct thing. The class is a value **summed** from a page, not folded over
   one, so the check now requires additive accumulation — a max, a min, a concat and a find
   are all legitimate; addition is not, because addition claims to describe a whole the page
   does not contain.

**And the reason this class will keep arriving:** our only live business is smaller than every
one of those limits. Graef hides every paging bug we can write. That is what the seeded
paging fixture exists to stop — a business with more rows than the largest limit, rendered
beside Graef, where a number that differs between them for the wrong reason is a defect.

## Lesson 60 — A safety guard written as a negation fails open (2026-09-13)

Costing the notification guard, the obvious form was "don't notify unless this is a real
business":

```sql
if v_kind <> 'market' then return new; end if;   -- WRONG
```

That is a **deny-list of silence**, and it fails open on every value nobody thought of. A new
`account_kind`, a null from a business the backfill never reached, a typo in a seeder — each
one is "not market", so each one gets silenced, and the failure is invisible: an owner simply
stops being told about bookings and nothing anywhere reports it.

The correct form is an **allow-list of silence** — name the values that are allowed to be
quiet, and let everything else notify:

```sql
if v_kind = 'test' then return new; end if;      -- RIGHT
```

An unexpected value now falls through to the loud side. The worst case is a test business that
sends a notification we did not want; the worst case of the negation is a real owner who never
hears about a customer.

**The general rule: a guard decides which side an UNKNOWN value lands on, and that is the only
thing it is really for.** Write the condition so the unknown lands where it costs least. This
is the same asymmetry as never discarding an unfinished draft, and the same one as
`account_kind` itself — which cost a week by defaulting to the flattering value ('real'), and
then cost more when the claim trigger silently promoted unrecognised signups to 'market'. Three
instances now, one rule.

## Lesson 61 — Counting call sites with one call shape in mind is not counting (2026-09-13)

The nav audit reported **`customers: 0 inbound links`**, and a retirement was ruled safe on
that basis. **There were two**, and both drive the nav item directly:

```js
const custNav = document.querySelector('[data-v="customers"]');
if (custNav) switchV(custNav); else goDash();
```

The count came from a regex written for the shape I had happened to read first —
`.ni[data-v="..."]`. The real call sites use the bare attribute. The second attempt
over-corrected to **61** by matching the same call repeatedly. The verified number, which a
person can check with `grep -n`, is **32 across 9 destinations**.

**Three counts of the same thing; two of them wrong, in opposite directions.** Undercounting
would have retired a view with live callers. Overcounting would have blocked a safe retirement.

**THE READ RECEIPT DOES NOT COVER THIS, and nobody should read it as having closed it.**
`receipt()` answers *"did I read the right bytes?"* — the right file, the right hash, a
mutation that actually differs. Every one of those was correct here. The failure was
*"did my pattern match all the shapes?"*, which is a different class entirely: the bytes were
right and the regex was narrow. Receipts and coverage are two separate holes and only one of
them is plugged.

**THE RULE THIS EARNS: a count that gates a destructive action is produced TWICE, by two
independent methods, and they must agree.** Retiring a view, deleting a column, dropping a
function, removing a route — anything whose cost is paid by someone else if the number is
wrong. Here the second method was `grep -n` read by eye, and it disagreed with the regex
three times running. **If the two disagree, neither is the answer until they are reconciled.**
That is what happened, and it worked — this makes it standing rather than lucky.

Three supporting rules:
1. **A call-site count is only as good as the shapes you enumerated**, and enumerating shapes
   is the same losing game as enumerating fact forms (CLAUDE.md: the anchor count, the price
   scan, the hours detector, the extraction gate). Count with a pattern that is deliberately
   loose, then read every hit.
2. **Print the hits, not just the number.** `scripts/check-nav-targets-exist.mjs` lists every
   call site with its file and line, so the count is checkable rather than trusted.
3. **The check must be as suspect as the code.** Its first run declared `dashboard` an orphan
   because the declaration regex required `class="ni"` exactly while that nav item is
   `class="ni active"` — **the same one-shape assumption, made inside the check written to
   catch it.** Caught only because "the dashboard has no nav item" was implausible. A check
   that makes the assumption it was written to catch is the clearest possible statement of why
   one method is never enough.

**What the corrected column did to three rulings** (full audit in D-025): the Customers
retirement SURVIVED but its execution changed — 2 callers repointed instead of left to fall
through; the Jobs count was right by luck; and **"`projects` is already broken with two inbound
links" is VOID** — it has zero, and the two hits were one fallback selector,
`.ni[data-v="photo-projects"],.ni[data-v="projects"]`, resolving via the half that exists.

## Lesson 62 — A row created by a trigger is not a row created by a person (2026-09-13)

`marketplace_providers` has **40 rows**. Forty providers would be a marketplace. It is **40
businesses**: `ensure_marketplace_provider_for_business` fires on every `businesses` INSERT and
writes one row, so the count measures how many businesses exist, not how many providers do.
The tell was in the data — **39 `draft`, 0 enabled, 0 featured; 1 `verified`** — but the number
was quotable before anyone looked at the breakdown.

This is the row-is-not-evidence-of-a-person rule (CLAUDE.md) one level lower: that rule asks
*who* a row represents; this asks *what wrote it*.

**The rule: any count over a table with an INSERT trigger states whether the rows were AUTHORED
or GENERATED before the number is used.** Check `pg_trigger` for the table first — it takes one
query — and say which it is in the same line as the count, exactly as `rateLine()` says the
account_kind split in the same line as the rate.

Seeded fixtures are the same category and are already handled (`hubly-paging-fixture` is
excluded by `withoutFixtures()`). A trigger is the version nobody thinks to exclude, because
nobody ran it on purpose.

## Lesson 63 — A single-source claim is a claim about every writer AND every reader (2026-09-13)

Two "one store, one writer" claims failed in one day. **Neither failed loudly. Both were found
by checking.**

1. **`business_events`** was described as a projection of `booking_requests`. It is a **union of
   four sources** — non-abandoned requests, abandoned requests, **jobs** with
   `from_booking AND booking_request_id IS NULL`, and chat conversations. Found because 11 rows
   produced 12 events and the arithmetic was re-run per row.
2. **"One store, one writer, one reader"** for pages. True for `business_documents` — and the
   only paying customer's website is not in it. His page is built from **`businesses.meta`**
   (`meta.website` 11.8KB, `meta.service_catalog` 8 services, `meta.portfolioUrls` 26), read by
   `get_public_business`, written by many paths. Found by fetching the live URL.

**The rule: a single-source claim is only true once BOTH sets have been enumerated — every
writer and every reader.** "I found the writer" is half a claim. The `business_events` case was
a missing *reader* enumeration (a second source feeding one reader); the pages case was a
missing *writer* enumeration (a second store behind one URL).

**How to enumerate, cheaply:**
- writers — `grep` for the table/column across `supabase/functions` and `public/`, and read
  `pg_trigger` for the table (Lesson 62: a trigger is a writer nobody remembers);
- readers — `grep` the RPC and the table, then **fetch the live surface and ask where its bytes
  came from.** That last step is what found this one, and no amount of code reading would have.

It sits beside the two-writers rule (`applyExtractedFacts` and `setHours` racing on hours). One
fact, two writers; one URL, two stores. **Same family: the count of participants was assumed
rather than enumerated.**

## Lesson 64 — Offering to regenerate a live page over one missing service is the destructive default wearing a helpful face (2026-09-13)

A classic page has no update path, so every "I can't put that on your page" reply is one step
from "…but I could rebuild it." That offer sounds like service and is the same decision as
`start over` on an unfinished draft: **it trades a live, full, hand-built page for a generated
one, to solve a missing $75 card.** The costs are not symmetric — the page is unrecoverable and
the missing service is one write — so the tie does not go to the destructive option, and here it
is not even a tie.

The tell is that the offer is always the *biggest available* action rather than the *smallest
sufficient* one. Twice now the smallest sufficient action existed and nobody looked:
`ridgeline-pressure-washing` was offered a full rebuild when `addServicesBlock` was one call
away, and Graef's page was a candidate for the same offer while the store it renders from had
had a perfectly good writer (`service_engine.ts`) sitting unimported since Phase 6.

**So: before any reply offers to rebuild, the missing door has to have been looked for and not
found — and the refusal names what is missing, not what could be destroyed.** "It isn't showing
and I can't add it from here" is a complete, honest answer. It does not need a rescue attached.

This is the *reply-side* of "look for the missing door before building the room": there, the
cost of assuming greenfield is a rebuilt system; here it is a rebuilt customer page.

## Lesson 65 — Broken grammar in a composed sentence means the sentence is composed, not true (2026-09-13)

While red-proofing `check-classic-claim.mjs`, deleting the empty-list guard produced this,
verbatim, from the real composer:

```
 are on your site now — https://x.myhubly.app. Your other 7 services are exactly as they were.
```

A sentence with a hole where its subject should be is not a cosmetic defect. It is a **structural
confession**: the assertion was built by slotting a list into a template, and the template asserted
something the data did not support. Every previous instance says the same thing — the `"but Your
page doesn't have…"` splice (two fragments glued at an interpolation), the slot-filled sign-up
guidance, the post-build services question. In each case the grammar broke at exactly the seam
where a claim outran its evidence.

**The rule: any composer that slot-fills a list into an assertion must refuse to emit when the
list is empty.** Return `""` and let the caller say nothing — silence is a correct output, and a
composer that has nothing true to say must be able to produce it. This is the same discipline as
`servicesTruth` composing from what ACTUALLY happened rather than from what was requested; the
empty list is just the degenerate case, and it is the case that reaches a real person as gibberish.

Read it the other way too, as a diagnostic: **when Hubly's output is ungrammatical, do not fix the
grammar.** Find the composer, and ask what it was asserting that it did not know.

## Lesson 66 — A gate that only records SUCCESS retries forever on a permanent failure (2026-09-13)

`hcPageUpgradeDone` asked "have we upgraded this page yet this session?" by reading a
`sessionStorage` flag that `hcMarkPageUpgradeDone` set **only when the upgrade returned ok**.
On a classic business the upgrade can never return ok — there is no document to upgrade and
there never will be without a rebuild — so the flag was never written, the gate never closed,
and the work ran again on every visit, failing identically every time.

The flag was recording the **outcome** when the question it answers is about the **attempt**.
Once those two diverge, a permanent failure becomes indistinguishable from never having asked,
and "ask once" silently becomes "ask forever".

**The rule: a do-this-once gate records that it RAN, not that it WORKED.** Keep the outcome if
you need it — the fix here writes `'attempted'` rather than `'done'`, so the difference is still
readable — but the gate reads presence, not value.

**With one deliberate exception, and it is the exception that makes the rule usable:** a
TIMEOUT is not recorded. A slow network is not a permanent answer, and retrying it next visit
is correct. The distinction to hold is *permanent* failure versus *transient* failure — not
failure versus success.

## Lesson 67 — A retry driven by NAVIGATION runs as often as the owner moves (2026-09-13)

The same code had a second fault that the flag was masking: the retry's schedule was "whenever
`hcOpenWorkspace('website')` runs". Nothing about the work being retried had anything to do
with navigation — it was a one-per-session page upgrade — but its cadence was set by how often
the owner clicked a tab.

That is why the symptom was *four identical paragraphs in a row* rather than one: Adrian entered
the Website tab five times, and each entry printed the failure again. **The count was not a
constant to be found; it was however many times he moved.** We spent a round logging it as
"appears twice" and a second round correcting it to four, when the honest answer was *unbounded*.

**Two things follow.** First, when a repeated message is reported, ask what drives the
repetition before counting the copies — a count is only meaningful once the driver is known, and
"N times" invites a fix that caps N instead of removing the driver. Second, work whose natural
period is "once per session" or "once per business" must carry its own gate; hanging it off a
navigation handler means its frequency is a UI behaviour, not a decision anyone made.

Same family as Lesson 66 — both are a schedule that nobody chose — and they shipped in the same
twenty lines.

## Lesson 68 — The obvious cause that survives reading must still be TESTED before it is fixed (2026-09-13)

Graef's website navigation does nothing. Reading the page found **85 duplicate ids**, with the
invisible copy first in document order at `top: 0`, so `getElementById` and every native
`#fragment` lookup resolved to it. That is not a weak theory. It explains the symptom exactly,
it is visible in one query, and it is a genuine defect sitting right where the bug is.

**It is not the cause.** Stripping the ids — on his live page, in memory, holding uniqueness
through the click with a `MutationObserver` because the clone is rebuilt on many triggers —
left the nav just as dead. Real mouse click, unique id, target at `docTop 581`, `scrollTop`
0 → 0.

The second theory was as good and also wrong: *the page scrolls an inner container, so a
fragment link asks the document to scroll and the document has nothing to scroll.* It fits
every observation — the wheel works, `window.scrollY` never moves, nothing intercepts, no
`scrollTo` fires. Measured: **there is no inner scroller.** No ancestor of the section has
`overflow-y: auto|scroll`; a document-wide sweep for any scroller taller than 200px returns
zero; `document.scrollingElement` is `html` with `scrollHeight 7238` vs `clientHeight 848`;
and the wheel moves **that** element, 0 → 400. Both halves of the pair measured, both wrong.

**A page full of a plausible defect is a confession, and a confession is not evidence.** The
cost of the mistake is specific and nasty: ship the id fix, watch the bug persist, conclude
the area is cursed, and go looking somewhere else entirely — while the real cause sits
untouched and the customer's site is still broken.

**So: reproduce the FIX before proposing it, not just the bug.** Apply it in the running page
and check the symptom is gone. It costs one browser round-trip and it is the difference between
a fix and a plausible story. And when the state you are testing can be rebuilt underneath you —
as this clone is — hold it with an observer and verify it is still held at the moment of the
click, or the null result is worth nothing either.

Two corollaries earned the hard way tonight:
- **Scripted scrolling does not prove anything about scrolling.** `scrollTop = n` from the
  extension's evaluation context silently does not apply here, while a real wheel event does.
  Every scroll conclusion was re-taken with real input before it was believed.
- **State that a strip or a patch establishes can be rebuilt between the setup and the test.**
  The first in-memory id strip "failed" and the second one, held by a `MutationObserver`, also
  failed — but only the second one was worth reporting, and the difference was not knowable
  without checking.

## Lesson 69 — Receipts prove what you READ. Nothing yet proves what you WROTE (2026-09-13)

Every check in this repo prints a read receipt — path, bytes, sha256 — because a number you
cannot trace is not evidence. **There is no equivalent for a write.** A write that is accepted
and not performed reads exactly like a write that was refused, and every conclusion drawn
through that channel inherits the error silently.

It happened twice tonight, in the same hour, through the same channel.

**First, the false negative.** `document.scrollingElement.scrollTop = 600` on Graef's page,
read back synchronously: still 0. I concluded the evaluation context could not scroll and
re-took every scroll measurement with real wheel and mouse input. Sound instinct, wrong
diagnosis.

**Then the control, which was right and also misread.** The same write on Wikipedia, same
context: applies immediately. So it was not the context — it was his page. Also wrong.

**The actual mechanism, caught by a single line in a later dump:**

```
before: 616   targetDocTop: 581   immediately: 616   afterRawWrite: 616   after900: 1200
```

`afterRawWrite` is the synchronous read after `scrollTop = 1200`, and it is the OLD value.
`after900` is the same property 900ms later, and it is **1200**. The write was never refused.
`html { scroll-behavior: smooth }` — which that page sets and Wikipedia does not — makes a
`scrollTop` assignment an *animation*, so the synchronous read-back is guaranteed to return
the pre-write value. I had been reading the start of an animation and calling it a refusal.

**Three rules follow, and they are the write-side of the read-receipt rule:**

1. **Never confirm a write by reading it back in the same tick.** Any property that can be
   animated, deferred, batched or coalesced will lie to a synchronous read. Poll until stable,
   or wait for the event the platform gives you (`scrollend`, `transitionend`, a mutation).
2. **A write needs a receipt too: the value you asked for, the value you read, and WHEN you
   read it.** "It did not apply" without a timestamp is not a finding. Had I printed
   `t=0ms` beside every one of those zeros, the shape would have been obvious on the first pass.
3. **Prove the instrument on a known-good target before trusting a null result.** I did that —
   Wikipedia — and it produced a *second* wrong conclusion, because the control differed from
   the subject in the one property that mattered. **A control is only a control if it differs
   in the variable under test and nothing else.** Wikipedia does not set `scroll-behavior:
   smooth`; that single difference turned a valid instrument check into a false localisation.

Sits beside Lesson 68: that one says test the fix in the running product, this one says make
sure the thing you are reading is telling you the truth about what you did. Two theories died
last night to Lesson 68. A third died to this one — and unlike the others, this one killed my
own measurements rather than my hypothesis.

## Lesson 70 — A fixed timeout is a t=0 read-back with a longer fuse (2026-09-13)

Lesson 69 caught a scroll confirmed by a same-tick read-back. The same hour produced its
milder sibling: `await page.waitForTimeout(500)` before checking whether a fragment link
scrolled — the method behind **"0 of 119 before the fix, 37 of 40 after"**, the numbers that
justified repairing 142 stored pages.

500ms is not a stability check. Generated pages carry `html{scroll-behavior:smooth}`, so a link
to a distant section can still be in flight when the check looks. **Both numbers are therefore
FLOORS, not measurements** — the error runs toward false negatives, counting a slow success as
a failure. The repair was still worth doing and the direction of the finding still holds; the
two numbers are simply not the evidence they were presented as, and they should not be quoted
again until re-taken.

**The rule: never confirm an asynchronous outcome with a fixed delay.** Poll until the value is
stable, or wait on the event the platform gives you. A fixed delay encodes a guess about
duration into a result that reads like an observation, and the guess is invisible in the output
— which is exactly what made "37 of 40" quotable for a day.

And the tell to look for in our own scripts: **`waitForTimeout`, `sleep`, and any bare
`setTimeout` standing between an action and its assertion.** Each one is a number somebody
guessed once. The assertion above now settles — stable for 400ms, 4s ceiling — and says in a
comment why the old numbers cannot be reused.

## Lesson 71 — Naming a surface is a claim about that surface (2026-09-13)

Three times now Hubly has told an owner where to go, and been wrong in a different way each time:

1. **A control that could not be seen.** The model described buttons on a page it does not
   render. The rule that came out of it — *Hubly never names or describes a UI control* — reads
   as being about hallucination. It is not. It is about **claims**.
2. **A capability that could not be reached.** Suggestions offered actions with no writer behind
   them ("Set your hours" while no capability wrote hours). The rule that came out — *a
   suggestion is a promise* — governs **which** things are offered.
3. **A door that opens onto the wrong room.** *"I can't change the page text from here — that's
   edited in Edit details."* Edit details exists, opens, and edits **contact, hours and
   services**. It has no page-text field of any kind. The sentence was composed in three
   separate places and sent a paying customer to a real surface that could not do the thing.

The third is the worst of the three and it is the one that looked safest, because **the surface
was real**. Hallucination is caught by asking "does it exist". A misdescribed door passes that
test and fails the one that matters.

**The rule: naming a surface asserts what that surface DOES, and that assertion is checked the
same way a status indicator is.** Before writing "X is edited in Y", open Y and read its fields.
If you cannot state what Y writes, you may not name it.

**The corollary, which is what shipped:** "I can't do this yet" is a complete answer. A redirect
is a SECOND claim on top of a refusal, and it is optional. We had not earned it, so it is gone —
all three composers now say *"I can't change your page wording yet"* and point nowhere.

And the reason this one ran for weeks: **the sentence was true about the assistant and false
about the destination, and nobody reads a sentence in two halves.** The half that was checked —
*can I change the page text from here?* — was honest. The half nobody checked was the half the
owner acted on.

## Lesson 72 — A delay generous enough to be usually right is worse than one that is usually wrong (2026-09-13)

Adrian's sentence, and it is the sharpest thing to come out of the fixed-delay audit:

> **A delay generous enough to be usually right is worse than one that is usually wrong, because
> the eventual failure arrives disguised as a product defect.**

A `waitForTimeout(250)` that is too short fails often, visibly, and early — somebody notices on
day one and fixes it. A `waitForTimeout(4000)` is correct on almost every run, so it is trusted;
and the one run in fifty where the page was slow does not present as "the harness read too early".
It presents as **the business name is missing from the booking landing**, or **this block's text
is unreadable**, filed against a live page with a screenshot attached. The instrument's failure
wears the product's clothes, and the investigation starts in the wrong place.

That asymmetry inverts the usual instinct. **The delays worth converting first are the long
comfortable ones, not the short flaky ones** — and in the 2026-09-13 audit the two most dangerous
sites were `3500ms` and `4000ms`, both of which had never once failed.

**Two corollaries, both paid for in the same audit:**

- **The cost of a wrong reading, not the count, is the ranking.** 27 of the 36 sites were
  `e2e`/`smoke` step waits, and they are the LEAST urgent: their failure is a red test next to
  its own cause. Three chat-reply waits were the most urgent, because their failure is a
  confident wrong claim about how the product behaves — and behaviour claims are the ones we act
  on. A ranking by count would have started in exactly the wrong place.
- **Read the LOOP, not the LINE.** The first pass of this audit classified three
  `check-name-is-asked` hits as fixed delays. Two of them sit inside loops that re-read every
  pass — polls, the correct pattern. A grep sees `setTimeout(…, 5000)` and cannot see the
  `while` around it, and "fixing" a poll into something else is a regression dressed as
  diligence. Both are now labelled in the source, because the audit did this to ITSELF and the
  next grep will be no wiser.

## Lesson 73 — Leaving something alone is a decision, and it has to be written down where the next person looks

Kinds 4 and 5 of the audit — 43 fixed delays — were deliberately not converted. Without a record
that is indistinguishable from not having looked, and the next audit re-derives the same answer
from scratch in a month.

So each one carries a comment naming the audit, the kind, the reason, and the words **"do not
re-audit"**:

```js
// DELIBERATE FIXED DELAY (docs/FIXED_DELAY_AUDIT.md kind 5): a render settling before a
// SCREENSHOT. An early picture is a worse picture, not a wrong number — nothing is asserted
// across this line. Reviewed 2026-09-13; do not re-audit.
```

**The rule: a decision to leave something alone is recorded at the site, not only in the doc.**
A doc records what was decided; the comment is what the next person actually encounters, and it
is the difference between a codebase that accumulates judgement and one that accumulates
re-investigations. Same reasoning as naming the CLASS when a bug is fixed: the note is for the
person who arrives without the conversation.

## Lesson 74 — A tool that closes the page it was asked to watch reports silence indistinguishable from absence (2026-09-13)

The rig's first real use, and it lied in the same shape as everything else that night.

```js
rig.page.on("console", …)        // attach the listener
await rig.load(url);             // rule 1: a fresh CONTEXT per load — the page is replaced
// → zero console lines, forever
```

`load({fresh: true})` closes the page and opens a new one. That is the rig's most important
rule — a same-document repeat is not an independent trial — and it silently invalidates every
listener a caller attached to `rig.page` beforehand. The probe reported **zero console lines of
any kind**, which reads exactly like "the code never ran".

**It cost four structural gates.** Three were opened blind, chasing a `+` that the instrument
would have shown mounting successfully on the first run had it been able to hear the page at
all. The one line that settled it, once the buffer survived the reload, was:

```
[hc+] MOUNTED — grid now has 4 children; wrap in document: true
```

**This is not Lesson 69.** That one is about a value read too early — the instrument answers,
and the answer is stale. This is the instrument *not being present to answer*, and returning a
value that looks like a finding: **empty**. Stale is suspicious; empty is persuasive, because
empty is what a real absence looks like.

**The rule: a helper that replaces the thing it hands out must own every subscription to it.**
The rig now owns the console buffer and re-attaches on every page it creates
(`rig.consoleLines`, `consoleSince(mark)`). More generally, when a helper's API hands back a
live object — a page, a connection, a handle — and the helper is also entitled to REPLACE that
object, every listener on it is a bug waiting for the first caller who reads the docs and does
the obvious thing.

**And the tell, worth more than the rule:** *zero of anything is a claim, and it deserves the
same suspicion as a surprising number.* Any real page logs SOMETHING. "No console output"
should have been read as "my listener is not attached" long before it was read as "the code did
not run" — the same instinct that makes a 0% conversion rate or an empty result set worth
checking the query before believing the finding.

### Lesson 74, continued — the two shapes that defeated the click witness

Both were found by one real control, the `+ Add service` tile, which happened to be shaped
like both at once. Both reported a **working** control as dead. They are fixtures in
`check-browser-rig.mjs` now, and red-proofed in the order they were fixed: reverting to the
element witness fails both legs; reverting to document-capture-on-`click` fixes the first and
still fails the second.

**A. `stopPropagation()` during the CAPTURE phase means the element's own listener never fires.**
Capture runs document → target. A handler on `document` with `capture: true` that calls
`e.stopPropagation()` ends the journey before the target is reached, so a witness attached to
the ELEMENT sees nothing at all. The fix is to witness on `document` in capture too:
`stopPropagation` stops the journey *between* nodes, not other listeners *on* the same node.

**B. A handler that rewrites its own element detaches `e.target` before a later listener runs.**
`tile.innerHTML = ''` removes the very node the event was dispatched at. A later listener
evaluating `e.target.closest(sel)` walks a detached subtree and finds nothing — so even a
correctly-placed witness reports no hit. The fix is to witness `mousedown`, which fires before
any click handler and therefore before any mutation.

**Why this matters more than it looks:** the witness is the most load-bearing line in the
toolchain. *Everything it says did not happen is a claim about the product.* A false "did not
land" does not read as a broken instrument; it reads as a broken feature, and the investigation
starts in the product. That is Lesson 72's asymmetry — a failure disguised as a product defect —
pointed at the tool that decides whether anything happened at all.

## Lesson 75 — When a brand-new check fails everything, suspect the check

Three times on 2026-09-13:

1. `check-computed-and-dropped`'s new placement leg found **one** function where there are two —
   its regex saw `function NAME(` and every capability handler is `handler: async (args) => {}`.
2. `check-no-editor-chrome-in-public` failed **all 8** page/layout combinations on the untouched
   live site, by listing `[data-pe]` — an inert marker a visitor cannot see or press — as chrome.
3. `measure-fragment-links` reported 21 dead links; 19 were `<a class="skip-link" href="#main">`,
   the keyboard-only accessibility affordance, which the rig had correctly refused to press.

**A new check's first run is a test of the CHECK, not of the code.** The codebase was in
production yesterday; if a fresh assertion says everything is broken, the base rate strongly
favours the assertion being wrong. The instinct to fix twenty pages is the expensive one.

**And the diagnostic is the same each time: what is this actually counting?** A FORM, not the
fact (CLAUDE.md). `[data-pe]` counts a marker and calls it a control. `function NAME(` counts a
syntax and calls it a function. A refused click counts an instrument limit and calls it a page
defect. **Every one was fixed in the measurement, and the product was fine.**

Two of the three had a second property worth naming: they would have *stayed* wrong in the
quiet direction. Leg 1 silently checked half of what it claimed; a green from it meant less
than it looked. **A check that fails loudly gets fixed the same day. A check that passes for the
wrong reason is the one to fear** — which is why leg 1's count of functions is printed, and why
the chrome check prints its inert-marker tallies rather than dropping them.

## Lesson 76 — A guard is red-proofed by SIMULATING the condition, never by creating it

`check-no-editor-chrome-in-public` asserts that an owner-only control never reaches a visitor.
Red-proofing it the obvious way means shipping the leak: force the gate open, deploy, watch the
check go red, deploy the fix. That puts a `+ Add service` tile on a paying customer's live
website for as long as the round trip takes.

**`--redproof` appends the owner's own `?hcEditable=1` to the visitor URL instead.** That is the
one condition under which the control legitimately appears, so the detector must fire on all 8
combinations — which proves the detector detects, with nothing deployed and nothing on anyone's
page that should not be there.

**The rule: to prove a guard notices a bad state, ARRANGE the bad state in the test, never
produce it in production.** The generalisation is broader than red-proofing — it is the same
reasoning as never taking a verification screenshot of hand-set state and presenting it as the
product. Simulate to prove a detector; never simulate to prove a feature. The difference is
which direction the claim runs: a detector firing on a simulated condition is evidence about the
DETECTOR, and that is exactly what is being claimed.


## Lesson 77 — A guard without a take is the original bug with an extra step

Three voluntary composers could each append to one owner turn. Two shared a floor predicate;
the third yielded to nothing. Adrian got four composers stacked in one reply.

The fix was one gate — `hcMayAddVoluntary()` — and one counter, `hcTookVoluntary()`. Checking
it produced three red-proofs, and **the second is the one worth keeping:**

```
RED A  ungate a composer              → FAIL  no hcMayAddVoluntary() within 3 lines
RED B  gate it, but never take a slot → FAIL  gated but never calls hcTookVoluntary()
RED C  remove the gate's short-circuit → FAIL  the gate no longer refuses a second addition
```

**A guard without a take is the original bug with an extra step, and it is the shape a careful
future edit produces.** Someone adds a fourth composer, sees the pattern, copies the `if
(hcMayAddVoluntary())` — and stops there, because the guard is the part that *looks* like the
rule. The turn then emits two additions and every gate in the file still reads correctly.

**The general form: when a rule is "at most one of these", the check must assert the
DECREMENT, not only the test.** A budget that is read and never spent is not a budget. Red-proof
by removing the spend, not only by removing the test — the removed test fails loudly, and the
removed spend is the one that ships.

It generalises past composers to anything with a once-per-scope rule: a lock taken and not
released, a retry counter read and not incremented, a "seen" flag checked and not set. In every
case the test is the visible half and the write is the half that makes it true.


## Lesson 78 — The guard that looks right and does nothing. Twice in one night, so it is a pattern

Two checks were written hours apart, for unrelated subsystems. Both had a leg A that caught the
obvious regression and a **leg B that caught something better**, and the two leg Bs are the same
shape:

| check | RED A — the obvious one | **RED B — the one that matters** |
|---|---|---|
| `check-one-voluntary-addition` | a composer with no guard at all | **a composer that calls the guard and never takes the slot** |
| `check-two-store-readers` | a reader that queries one store | **a reader that queries both and picks a winner silently** |

**In both, the failing version contains the correct machinery and produces the original bug.**
The composer consults `hcMayAddVoluntary()` — the line looks exactly like the rule — and the
budget is never spent, so the next composer sails through. The reader joins both stores — the
query looks exactly like the fix — and then `coalesce`s them into one column with no `source`,
so the answer is single-store again.

**Neither is caught by a check that only asks "is the mechanism present?"** Both are caught by
asking "does the mechanism have its effect?"

**The rule: when reviewing a fix, find the version that keeps the new code and restores the old
behaviour, and make the check fail on THAT.** If no such version exists, the fix is structural
and the check can be simple. If one does — and there usually is, because the machinery and the
effect are separable — it is the version a careful future edit will produce, because it is the
one that looks correct in a diff.

## THE CATALOGUE OF SHAPES — add to this list as they turn up

A method is only usable by someone who has not lived through the failures if the shapes are
enumerated. Each entry is a way for a fix to keep its new code and restore its old behaviour.

| # | shape | what it looks like in a diff | found in |
|---|---|---|---|
| 1 | **the unspent budget** | a limit is consulted and never decremented — `if (mayAdd())` with no `took()` | `check-one-voluntary-addition`, 2026-09-14 |
| 2 | **the discarded distinction** | two sources are read and collapsed into one value — a `full outer join` whose result is `coalesce`d with no `source` column | `check-two-store-readers`, 2026-09-14 |

**When you find a third, add a row.** The catalogue is the part that transfers; the individual
stories are not.

Both are Lesson 75's other half. That one says a check failing everything is probably wrong;
this one says **a check passing everything may be asking the easier question.**


## Lesson 80 — "Is it imported" is not "is it used"

`hubly_brain_experience_layer.ts`: 762 lines, written 2026-07-24, one commit, **never touched
since and never called.** It passes every cheap liveness heuristic:

- it **is** imported — by `hubly_brain_experience_director`, `hubly_brain_chat_os` and `hubly_ai`;
- `hubly_ai` **re-exports** it as `HublyExperienceLayer`, in a namespace of thirty such exports;
- that namespace **is** imported by the conversation function.

An import-graph check would have drawn an unbroken line from the live edge function to this file
and called it live. **The only caller of `HublyExperienceLayer.*` anywhere is
`check-m2-epic0.mjs`, the test asserting it exists.** It is imported into a namespace, exported
from that namespace, and consumed by nothing but its own proof of existence.

**The rule: liveness is a property of CALL SITES, not of the import graph.** A re-export through
a barrel file launders dead code into apparently-live code, and the bigger the barrel the better
the laundering. Count invocations of the symbol, in the files that would invoke it, and say which
files you counted.

**And the tell, which is specific enough to grep for:** a module whose only caller is its own
test. That is not coverage; it is a file keeping itself alive. `check-m2-epic0.mjs` has been
green for 52 days about a layer no owner has ever read a word from.

This belongs beside the unlit shapes (Lesson 49) as **shape 8**, and it is the one that hides
best. (Numbered 7 when it was written; shape 7 is now the authorisation one — `website.moveSection`
— which was ruled the worse of the two, because it fails as a product defect rather than as an
absence.)

| 8 | **imported, re-exported, never called** | the import graph says live, the call graph says dead — and only the call graph is about behaviour |


## Lesson 81 — A check whose red you have never seen is a check you have never run

Fifteen checks that had each gated a real decision were mutated on 2026-09-14 — break the thing
the check asserts, in the real file, require it to say so. **Four were passing for the wrong
reason**, and each was a different way of measuring the shape of the code instead of its
behaviour:

| check | what it was actually measuring |
|---|---|
| `check-one-voluntary-addition` | that a LINE was present in the gate — `return true;` above it passed |
| `check-destructive-confirm` | that the gate's NAME appeared in the span — the comment naming it passed |
| `check-no-directives-to-owners` | backtick PAIRS in document order — one nested template hid half the file |
| `check-two-store-readers` | that the store's NAME appeared — the `source` label passed |

The common shape: **a name, a line, or a token standing in for a behaviour.** Where the fix was
possible, the check now RUNS the thing — the gate is executed, the invocation is required, the
source is lexed, the marker is an access path.

And two of the fifteen were **already red on main** and nobody had looked: a capability shipped
the previous day was dead for every claimed owner, and two rates were printed without their
denominator. Neither needed a mutation. They needed the check to be run.

The cost of the audit was about two hours. The cost of not running it was a capability that
shipped dead, a rule (`never point at a control you cannot see`) enforced nowhere at all, and
four instruments reporting on themselves.

## Lesson 82 — Mutate the code, not the comment that names it

Half of this codebase's checks scan source text, and the good ones carry long comments naming
the very symbol they assert. That makes the comment a decoy in BOTH directions:

- **For the auditor:** four of the first fifteen mutations landed in a comment — the line that
  says `// see refuseIfClassicSite()`, the two `p_owner_id:` mentions explaining the invariant,
  the header naming `composeServicesTruth`, an SQL `--` line. Each produced a confident
  "STAYED GREEN" verdict about a check that was fine. A mutation that does not change behaviour
  proves nothing, and it slanders a working instrument.
- **For the check:** `check-destructive-confirm` was doing the same thing in reverse — counting
  `// see refuseIfClassicSite()` as a call to it. The gate could have been deleted entirely and
  the check would have passed on the comment left behind.

So: anchors are resolved against **comment-masked source** (`swapInCode`), and a check that looks
for a call strips comments before it looks. **A comment that mentions a symbol is not that
symbol** — the mistake is easy enough that both the code and the person auditing the code made it
on the same afternoon.

### The addendum that matters more than the lesson: KNOWING A FAILURE MODE DOES NOT CONFER IMMUNITY FROM IT

This lesson was written on the afternoon of 2026-09-14. **Hours later, the first run of
`check-registry-knows-every-door`'s new door leg made exactly this mistake** — it looked for
`data-pe="add-service"` in `public/hubly.html` with a plain `includes`, and renaming every real
occurrence left it GREEN, because a comment three thousand lines away still contained the name.
I had just written the lesson. I wrote the check anyway. The red-proof caught it; the knowledge
did not.

**That is the whole argument for checks over lessons.** A lesson is a thing you know, and knowing
is not a mechanism — it decays under fatigue, context pressure, and the ordinary momentum of
finishing a task. A check is a thing that happens whether or not anyone remembers, and it happens
at the moment the mistake is made rather than the next time someone reads the file.

The corollary, and it is the reason the lessons file is not the safety system: **every lesson
here should be read as a candidate for a check, and a lesson with no check behind it is a rule
we are holding by hand** (`docs/RULES_HELD_BY_HAND.md`). Writing one down is the beginning of
the work, not the end of it.


## Lesson 83 — A check that reads the receipt instead of the goods

Four of the fifteen checks red-proofed on 2026-09-14 were passing for the wrong reason, and they
are one family: **each measured the SHAPE OF THE ANSWER rather than the answer.**

| check | the receipt it read | the goods it never inspected |
|---|---|---|
| `check-one-voluntary-addition` | the line `hcVoluntary > 0) return false` is present | whether the gate REFUSES — `return true;` above it passed |
| `check-destructive-confirm` | the string `refuseIfClassicSite(` is present in the span | whether it is CALLED — the comment naming it passed |
| `check-no-directives-to-owners` | backtick pairs in document order | the actual string literals — one nested template flipped the parity and hid half the file |
| `check-two-store-readers` | the substring `service_catalog` is present | whether the store is READ — the reader SELECTS `'meta.service_catalog'` as a literal label |

**The `service_catalog` one is the sharpest, and it is not a coincidence that it is about the two
stores.** `get_business_services` returns a `source` column saying which store each row came
from. That label is a string. A check that accepts the label as proof of the read is accepting
**a claim about provenance as evidence of provenance** — which is the two-store defect itself,
reappearing one level up, inside the instrument built to catch it. If the reader stopped reading
`businesses.meta` entirely, it would keep printing `'meta.service_catalog'` for rows it no longer
had, and the check would keep saying both stores are covered.

**This is NOT Lesson 78.** That one is about a FIX that keeps the machinery and loses the effect.
This is about a CHECK that reads the receipt rather than the goods — the machinery is intact and
correct, and the instrument pointed at it is looking at the wrong object.

**The rule: a check asserts a BEHAVIOUR or it asserts nothing.** Run the gate. Require an
invocation, not a mention. Lex the source, do not pair its delimiters. Match an access path, not
a name. Where the behaviour genuinely cannot be run — a rendered page, a live write — say so in
the check's own output, so the next person knows what its green is worth.

**And the tell, which is cheap:** ask what the smallest edit is that would break the product and
keep the check green. If you can name one in under a minute, the check is reading a receipt. All
four of these took under a minute.

---

## Lesson 84

**A SCANNER THAT READS THE FOLDER ITS OWN BASELINE LIVES IN WILL BE SILENCED BY ITS OWN BASELINE.**

`measure-rpc-doors.mjs` finds database functions nothing calls. It looks for each function's name
across `supabase/functions/`, `public/` and `scripts/` — a mention anywhere is a door.

`check-rpc-doors.mjs` turns that into a check. It holds the currently-doorless functions in a
`BASELINE` set, each with a written reason it is tolerated, so the number cannot go up without a
person naming the new entry. It lives in `scripts/`.

**So the act of recording "nothing calls `get_task_progress`" put the string `get_task_progress`
into a file the sweep scans, and the sweep concluded that something calls it.** All three
baseline entries acquired a "script" door. The missing-door list emptied. The check reported
zero and passed.

**It read exactly like success.** Not a crash, not an empty file, not a suspicious zero — a green
check saying "no database function has shipped with no caller", which was the sentence we wanted
to be true. It was caught only because the number had been 2 four minutes earlier and was now 0
with nothing in between that should have moved it.

**The shape, stated so it is recognisable elsewhere: A CHECK'S OWN TEXT BECAME EVIDENCE AGAINST
THE THING IT CHECKS.** It recurs anywhere a scanner reads the directory its own configuration,
baseline, allow-list or documentation lives in, and it is worst where the recorded item is a
NAME — because naming is how both the defect and the record are expressed, and the scanner cannot
tell a citation from a use. Watch for it in:

- a dead-code sweep whose exclusions file lists the dead symbols
- a "no TODOs" check whose own source contains the word TODO
- a banned-API scan whose allow-list spells the banned API
- a secret scanner whose test fixtures are secrets
- `check-no-db-push.mjs`, which must name `supabase db push` in order to ban it — already handled
  there by excluding itself, which is why that one has never bitten us

**The fix is one line and the principle is one sentence: NAMING A THING IN ORDER TO SAY IT IS
UNREACHABLE MUST NEVER MAKE IT REACHABLE.** The sweep excludes itself and its checker from the
caller scan, and says why at the exclusion.

**The tell is the same one Lesson 83 ends with, pointed at the instrument instead of the
product:** ask what the smallest edit is that would make this check green while the defect is
live. Here it was "write the check" — which is not an edit anyone would think to test, and is
precisely why this class survives. A stronger habit than the tell: **when a count you are
watching moves to zero, find the change that moved it before you believe it.** A number that
improves the moment you start measuring it has usually been measured wrong.

**Related and NOT the same:** Lesson 83 is a check reading the receipt instead of the goods — the
instrument looks at the wrong object. This is the instrument CHANGING the object by looking at
it. The first is a bad reading; the second is contamination.

---

## Lesson 85

**TWO DETECTORS AGREEING IS NOT CORROBORATION WHEN THEY SHARE A BUG.**

Measuring whether a freeform page shows the price the booking wizard quotes, two independent-
looking tests were run over the same corpus:

```
  test A   does the page text contain  '$' || price        ->  35 of 36 say NO
  test B   does the page text contain   price  anywhere    ->  36 of 36 say NO
```

Two tests, different questions, same answer, pointing the same way. That agreement was read as
confirmation and reported as **"nine businesses quote a price the page never shows — live and
customer-facing"**. It was false. The real answer is **zero of 36**.

Both tests formatted the price with `to_char(price, 'FM999999990.99')`, which returns `220.`
for a whole number — a trailing dot. Test A searched for `$220.` and test B searched for `220.`
and neither string is on any page. **The tests did not agree because the finding was solid. They
agreed because they shared a formatter.**

Worse, test B had been written specifically to CHECK test A — test A was suspected of being the
`$`-anchored price scan CLAUDE.md names as a recurring mistake, which it was. So the second test
existed to catch the first one's known failure mode, and inherited a different one from the
helper they shared. **A check written to verify another check is only worth the independence of
the parts they do not have in common.**

**THE HABIT: when two measurements agree, establish what they share before you treat agreement
as confirmation.** Walk the stack and name it — the formatter, the normaliser, the helper, the
query, the fixture, the corpus, the extraction step. Independent means independent all the way
down, and two tests over one source with one formatter are one test run twice.

**The cheap version**, when a full walk is not worth it: take one row and check it BY HAND,
end to end, in the crudest way available. `select position('$220' in page_text)` on one business
returned true in four seconds and killed the whole finding. One hand-checked row beats two
agreeing detectors, every time.

**And the tell:** if a second measurement was written to check a first, ask what it reuses. If
the answer is "the same helper", it has not checked anything.

### The reporting half of the same discipline — paid for the same day

That false number went to Adrian, who passed it to a customer as fact and had to correct it.

**WHEN A NUMBER IS ALARMING, SAY WHAT WOULD HAVE TO BE TRUE FOR IT TO BE WRONG — BEFORE YOU
REPORT IT.** The scepticism we spend on a green check is owed to a red one. A green check that
is wrong wastes a day; an alarming number that is wrong gets ACTED ON — reprioritised, escalated,
repeated to a customer — and the correction never travels as far as the alarm did.

For "nine businesses are quoting prices their pages never show", one sentence would have caught
it: *"this depends on the price being formatted into the page exactly as we format it for the
search; if either side formats differently the number is meaningless."* That is the whole
failure, stated in advance, in the time it takes to write it.

---

## Lesson 86

**WE REPORT OUR OWN MISSING SETUP AS THE OWNER'S MISSING DATA.**

Adrian's words, 2026-09-15, after the fourth instance in one week. The tell is consistent enough
to name, and once named it is recognisable in seconds.

**The shape.** Some piece of OUR machinery is absent, stale, or not yet ready — a reader that
only knows one of two stores, a canvas that has not finished mounting, a table nothing ever
seeded. The code asks it a question, gets back nothing, and converts nothing into a **confident
statement about the owner's business**. The sentence is always about HIM and the cause is always
about US.

**The four, this week, all shipped to a screen:**

| what we said to an owner | what was actually missing |
|---|---|
| "clay and seal, price 0" as Graef's only service | `get_business_services` read the `services` table; his eight live in `meta.service_catalog` |
| "the 1 service you priced" | `hcBookableServices`, the same one-store read, on the arrival |
| "there is no services area on your page yet" | the canvas answered before the frame was ready; his page renders six anchors |
| "your schedule isn't set up on this account yet" | `business_places` had never been seeded for that business — by `seed_business_places`, an RPC this repo's own sweep had already flagged as reachable only from a script |

The last one is the sharpest, because **the missing piece had already been found and written
down**. The sweep named `seed_business_places` as script-only days earlier; nobody connected that
to a sentence an owner would read.

**THE RULE.** A reader that comes back empty has told you about ITSELF. Before that becomes a
sentence, three questions:

1. **Did I ask everywhere it could be?** Two stores is the standing shape here — `services` and
   `meta.service_catalog`, `settings_business_hours` and `meta.hours`. One-store readers have
   produced two of these four.
2. **Was the thing I asked ready to answer?** Not-found and could-not-look are different values
   and must not share a branch (`check-unreadiness-is-not-absence.mjs`).
3. **Is the emptiness ABOUT HIM, or about a row WE were supposed to create?** A seeded table, a
   backfill, a places row, a stamped anchor — every one of these is our setup, and its absence is
   our defect wearing his name.

**If you cannot answer all three, the sentence is not "you don't have one." It is "I can't tell",
or there is no sentence.** Silence beats a confident wrong statement about someone's own
business — and it costs us nothing, because the owner already knows what he has.

**THE STRUCTURAL FORM, which is what actually fixed the fourth one:** gate on the CONTENT, never
on our bookkeeping about the content. `hcGoToPlace` asked "is there a `business_places` row" and
now asks "does this collection hold anything". The second question cannot be wrong about him,
because it reads the thing he owns rather than the thing we forgot to create.

**And it cuts both ways, which is easy to miss.** The same places-row gate that told him his full
schedule was missing ALSO hid "See my customers" from Graef, who has four. A bookkeeping gate is
not merely over-strict; it is uncorrelated with the truth in both directions.

## Lesson 87

**THIS CODEBASE'S RECURRING DEFECT IS A HAND-MAINTAINED SET THAT SILENTLY GOES STALE. The fix is
never "check your lists" — it is to DERIVE the set, or to make membership STRUCTURAL so a thing
cannot exist outside it.**

### What would make this tally wrong, stated before the number

The scepticism owed to an alarming count (Lesson 85). Three things would move it:

1. **The unit is arguable.** I am counting *"a set of things enumerated by hand, where the code's
   correctness depends on the set being complete, and an omission was found in production or by
   Adrian."* A looser unit (any incomplete list) counts more; a stricter one (only sets that
   shipped a user-visible defect) counts fewer.
2. **Some are one defect wearing two hats.** The extraction gate's two lists (fact SHAPES and
   assertion PHRASINGS) were found in one sitting on the same code path. Counted as two below
   because they were two independent enumerations that each lost real messages; counted as one, the
   total drops by one.
3. **The window.** "This week" is 2026-09-09 → 2026-09-15. Three of the entries predate it and are
   included because they are the same defect; if the tally is meant to be *this week only*, it is
   **6**, not 11.

**So: 11 by the unit above across the project, 6 inside this week.** Each line below cites
something I can point at. Anything I could not cite is not on the list.

### The tally

| # | The hand-maintained set | What the omission cost | Citation |
|---|---|---|---|
| 1 | `DRAFT_INJECTED_ACTIONS` — literal set of actions needing a draft token | a writer dead on a claimed site | now `deriveDraftInjectedActions()`; `scripts/check-owner-id-invariant.mjs:145` asserts it stays derived |
| 2 | The capability registry's **door list** | capabilities with no reachable door | `scripts/check-registry-knows-every-door.mjs` |
| 3 | The **voluntary-addition gate**'s composer list | six speakers walked past the gate; Adrian got ~11 things at once on arrival | `public/platform-home.html` — "the gate only ever guarded the four composers we remembered" |
| 4 | The **doorless-RPC baseline**, tracked by NAME | dropped a live function (`update_business_job`) from tracking; the sweep also silenced itself by scanning `scripts/` | Lesson 84 |
| 5 | The **message composer** list | `hcAppendMessage` was guarded, `hcRenderTranscript` was not — the envelope would have printed on every reload, permanently | `docs/OPEN_FINDINGS.md`, 2026-09-15, end 4 |
| 6 | The **refresh list** in `hcAcceptOwnerName` | `hcRenderRail(); hcReflectAuthState();` with `hcRenderIdentity` missing — the chip said "Adrian", the greeting said "Good afternoon." until he reloaded (item G) | this lesson's own fix; `scripts/check-live-surfaces.mjs:21` |
| 7 | The freeform **anchor count**'s shape list | a service is a heading one build, a `<li><span>` the next | CLAUDE.md, "enumerate the harmless side" |
| 8 | The **price scan**'s symbol list | counted `$`, missed every priced service rendered without it | CLAUDE.md, same |
| 9 | The **hours detector**'s format list | matched formatted times, missed "Closed", "Call for hours", "open daily" | CLAUDE.md, same |
| 10 | The **extraction gate**'s list of fact SHAPES | lost 52 of 125 real messages | CLAUDE.md, 2026-09-02 |
| 11 | The **extraction gate**'s list of assertion PHRASINGS | lost 28 more | CLAUDE.md, same sitting |

### Why "check your lists harder" is the wrong lesson

Every one of these was written by someone who believed the list was complete, and in most cases it
**was** complete on the day it was written. The defect is not carelessness; it is that a hand-kept
set has **no relationship to the thing it is supposed to describe**, so the two drift the moment
anyone adds a composer, a door, a surface or a page shape. A review cannot catch drift that has not
happened yet.

### The three shapes of the real fix, in order of preference

1. **DERIVE IT.** `DRAFT_INJECTED_ACTIONS` became `deriveDraftInjectedActions()` — the set is now
   computed from the registry it describes, so it cannot disagree with it.
2. **MAKE MEMBERSHIP STRUCTURAL.** The live-surface registry (2026-09-15) is this shape, and it is
   why the design chose it: **liveness is `el.isConnected`.** A surface is live exactly while its
   node is in the document. There is no list of live surfaces to maintain and no deregister call to
   forget, because *membership is a property of the DOM, not a record we keep about the DOM*. A
   deregister path must never be added back "for tidiness" — that would reintroduce the class this
   whole lesson is about.
3. **GATE ON THE CONTENT, NOT ON OUR BOOKKEEPING ABOUT THE CONTENT** (Lesson 86, restated because
   it is the same disease). "Does this collection hold anything" cannot be wrong about him the way
   "is there a places row" can.

And when none of the three is available — the extraction cases, where the thing genuinely has no
closed set of forms — **enumerate the HARMLESS side instead** (CLAUDE.md). A missing entry on the
harmless list costs one wasted pass; a missing entry on the valuable list costs a fact the owner
actually stated.

### The tell, for next time

You are looking at this defect whenever you find a literal collection — an array, a `Set`, a
sequence of hand-written calls, an `if/else` chain over names — whose **correctness depends on
completeness** and whose members are **discovered somewhere else**. Two of the four ends of the
envelope bug were found by asking one question of that shape: *where else does a string become a
bubble?* Ask it of the list, not of the instance, before fixing the instance you were handed.

### Lesson 87, addendum: WE READ SUCCESS OUT OF SILENCE

Four instances in a single turn, 2026-09-15, all mine, all caught in-session. One disease:
**a command whose target was missing produced a confident-looking result instead of an error.**

| What ran | What was missing | What it printed |
|---|---|---|
| A red-proof of the hand-written refresh list | my edit had broken the page, so the check couldn't parse it | **neither FAIL nor pass** — non-zero exit, no output, which reads like a clean run |
| `git stash` before a baseline comparison | my code was already committed, so the stash took **63 proof artifacts** the checks rewrite | a "baseline" that was running my own changes |
| `cd` into a worktree I had already deleted | the directory | `cd` failed, the `&&` chain carried on, and two `baseline=FAIL` readings described the current tree |
| `grep BASE_PASS` on a results file | the run had produced **zero lines** | `(none — every one was already failing)` |

And a fifth of the same family, one layer down: **three check legs that measured nothing and read
green.** `window.hcOfferSidebarTab` was stubbed, but those functions live in the file's single
closure and are not on `window`, so the stubs replaced nothing; a scroll leg watched
`#hcThreadBody` while the scroll targets the outer `#hcThread`; and both were taken against
`#hcApp` while it was still `display:none`, so every geometric measurement was against a
zero-height element and could not fail.

**THE HABIT: before reporting a count, assert the source produced any rows at all.** This is the
leg-0 discipline already applied to checks, turned on the shell. Concretely:

- A grep over a results file: assert the file has lines, and that the run finished, **before**
  reading a zero as an answer.
- A comparison against a baseline: assert the baseline is actually a different tree (a worktree at a
  named commit, verified by the absence of the thing being tested) — never a stash, which takes
  whatever happens to be dirty.
- A `cd` in a chain: `set -e`, or make the failure the result.
- A red-proof: require a **FAIL line**, not merely a non-zero exit. "No output" is not red.
- A leg that measures geometry: assert the element has non-zero size first, and add a **control leg**
  that would fail if the setup didn't take (leg 25b: "the thread WAS scrollable"; leg 27: "the
  redraw DID run").

The asymmetry is the argument, as always: a control leg costs one assertion, and a vacuous leg costs
a defect shipped behind a green check. **Every one of the five above looked like evidence.**

And the sibling on the data side is Lesson 86, which caught this same turn in real time: two SQL
queries returned empty, the obvious reading was "there are no driveway jobs", and the empty reader
was describing **itself** — a `503` maintenance window, not an absence. Same disease, different
surface: *silence is not a value.*

### Lesson 87, second addendum: TWO MORE SHAPES OF THE SAME DISEASE

**A SWEEP IS ONLY AS EXHAUSTIVE AS THE THING IT ENUMERATES, AND A FUNCTION NAME IS A PROXY FOR
BEHAVIOUR, NEVER THE BEHAVIOUR.** 2026-09-16: asked to find every check that installs a fake
backend, I grepped `installOwnerFake` and found 3 files — missing that three more checks carry
their own **inline** fakes. The sweep whose entire job was exhaustiveness enumerated one function
name instead of the behaviour. Enumerate what the thing *does* (here: replaces `window.supabase`),
and cross-check the count against something independent before reporting it.

**A REGEX WINDOW THAT REACHES PAST ITS SUBJECT FINDS THE NEXT ONE AND CALLS IT PROOF.** Same day,
the fourth window-too-wide no-op of the week: a leg asserting that the model's history is filtered
searched 200 characters forward from `hc.messages = rows` for `hcHiddenFromOwner` — and the
*render's* call to it sits six lines below, inside that window. With the defect restored the leg
matched a different line and stayed green. **Scope a window to its own subject** — here, the single
assignment expression, terminated at `.map(` — and red-proof it, because a window that is too wide
fails silently and looks exactly like a window that is correct.

Running tally of the hand-maintained-set family: **12 instances.** The newest is a *heuristic
standing in for a fact we already hold* — a content regex deciding which messages predate a claim,
when "written before the claim" is a timestamp comparison. Same fix as always: derive the set, or
make membership structural.

## Lesson 88

**A FIX PRESENT IN THE DATABASE AND ABSENT IN BEHAVIOUR IS NOT A FIX. A MIGRATION IS NOT A FIX — A
FIX IS THE WHOLE CHAIN FROM THE ROW TO THE BEHAVIOUR.**

This is *built-and-doorless* (the "look for the missing door" rule) pointed at a **fix** rather than
a feature, and it is more dangerous in that direction, because a fix comes with the conviction that
the problem is now solved.

**2026-09-16.** Replacing a content regex with a derived fact took **three migrations**, each one
applied, each postcondition asserted:

1. `businesses.claimed_at`, written by `claim_draft_business` in the same statement as `owner_id`.
2. `get_my_business_conversation` returning `created_at`.
3. `get_my_businesses` carrying `claimedAt`.

All three were correct and verified in the database. **And the derivation would never have fired
once**, because `hcOpenOwnedBusiness` did not put `claimedAt` on the business object the client
holds — so `claimedAt` was always `undefined`, the comparison was always skipped, and the regex went
on deciding which of an owner's own messages he was allowed to see. Three green postconditions, one
missing assignment, zero behaviour change.

### The habit

**After any schema change, assert the LAST LINK: the client actually reads it, and the behaviour
actually changes.** Not that the column exists. Not that the function returns it. That the thing a
person experiences is different.

`scripts/check-model-sees-what-owner-sees.mjs` legs 8–9 are the model for this:

```
8  the client carries claimedAt onto the business it holds     (grep the assignment)
9  the predicate compares the row's date against it            (grep the comparison)
```

Both are red-proofed by deleting exactly that one line. A check that asserts only the migration is a
check that would have passed on a fix that did nothing.

### And a note on red-proofing a multi-clause predicate

While red-proofing the narrowed regex, removing **one** of its three clauses fired only one leg, and
that looked at first like two vacuous legs. It was not: the other two clauses still matched those
rows, correctly. **A mutation that removes one branch of an OR is not a red-proof of the OR** — it
tests that branch. Remove the whole thing to prove the legs bite, and remove each branch separately
to learn which leg covers which. Both runs are useful; confusing them is how a sound leg gets
rewritten for no reason.

## Lesson 89

**WHEN AN INSTRUMENT CAN BE WRONG IN TWO DIRECTIONS, RED-PROOF THE DIRECTION THAT SAYS "THIS IS
FINE" FIRST AND HARDEST.**

Every detector failure this week was a **false positive**: the dollar-anchored price scan, the
`to_char` trailing dot that produced `220.`, the regex window that reached six lines past its
subject. A false positive is noise — it is loud, someone investigates it, and the investigation
finds the bug.

**2026-09-16 produced the other kind, in a safety instrument.** The record-claim audit's `supported()`
used a bare `includes()`, so:

- `includes("no")` matched inside the word **"note"** — in a sentence about opening hours. An
  invented `Store Walk, $24.99` therefore looked **supported** by a conversation that never mentioned
  it.
- `includes("5")` matches inside `"2500"`, so an invented `$5` looked supported by an unrelated
  `$2500`.

**A false negative in a guard is a green light over a real defect, and it is silent forever.** Nobody
investigates a clean report. The bug does not announce itself; it removes the announcement.

### The habit

For any instrument with a verdict, list every **cheap path to the reassuring answer** and put a leg
on each one *before* the legs that prove it catches things:

| the reassuring path | the leg |
|---|---|
| `if (!f) return true` — an empty figure is "supported" | 20: a state-only claim is still a claim |
| the empty string as evidence | 21: no evidence cannot support anything |
| an exception → no row at all | 22: a broken audit writes an `audit_error` row |
| no marker matched → whole audit skipped | named in the source as known false-negative surface #1 |
| any trivial summary → `had_reader = true` | named as surface #2 |

The last two are **named rather than fixed**, because fixing them properly needs what the instrument
exists to avoid (knowing which reader answers which claim). Naming them is the difference between a
known limit and a silent one: a spike in `unsupported_figure` with `had_reader = true` now reads as
surface #2 rather than as the model getting worse.

### And a third instance of the window bug, this time in a leg

A source leg asserting "the audit changes nothing" took **900 characters forward** from its anchor
and looked for a closing brace. Adding the `audit_error` branch made the block longer, the window ran
past the end of the audit, and the leg failed on an unrelated `decision.message` assignment further
down. **Anchor a region between two markers the file actually contains**, never a character count —
and note that this one failed *loudly*, which is the only reason it was cheap. The same mistake in
the reassuring direction would have passed.

---

## Lesson 90

**A GUARD ON DISPLAY IS NOT A GUARD ON THE RECORD — AND A FLOOR ON DISPLAY IS NOT A FLOOR ON THE
RECORD. THE SAME SEAM HAS TWO SIDES AND FIXING ONE IS NOT FIXING IT.**

Yesterday's fix closed one half: `hcAppendMessage` refused to *show* the raw envelope
`{"action":"reply","message":""}` and `hcPersist` *stored it anyway*, so the thing that was silenced
on screen came back on the next reload (seq 47, caught by `envelope_suppression_events` on Adrian's
own walk). The class was named then — *a guard on display is not a guard on the record* — and the
fix went into `hcPersist`.

**The other half of that same sentence was live in the same file and was not looked for.** The
no-silence floor, `hcEnsureTurnSpoke`, called `hcAppendMessage` and stopped. It spoke to the thread
and never to the record. So on Adrian's walk, seq 38, 39 and 40 are three consecutive owner messages
with **no assistant row under any of them** — while the floor had been live on that page for twenty
minutes (`fb25916`, pushed 02:04:23Z; the turns are 02:23–02:25Z).

Two consequences, and the second is the one that matters:

1. **The record could not answer the question being asked of it.** "He was told nothing" and "he was
   told something and we did not keep it" produce byte-identical rows. That is an empty reader
   telling you about itself (Lesson 86) — and it meant the walk's headline finding could not be
   established from the rows at the time it was reported.
2. **The thread IS the record on reload.** A turn the floor rescued came back as an unanswered
   message the moment he refreshed. The floor's promise held until F5.

**The knowledge was already in the file.** A comment three hundred lines above the floor reads:
*"neither this view's sentence nor the no-silence floor is persisted, so a turn that worked and a
turn that died look identical in `business_conversations`."* Someone saw it, wrote it down beside the
code, and did not fix it. **A defect recorded in a comment is not a defect that is handled** — it is
a defect with a witness. When the class question gets asked ("where else does a string become a
stored message?"), the answer includes every place the *inverse* is true, and the comments already in
the file are the cheapest place to find them.

**AND THE FLOOR'S OWN SENTENCE HAD LESSON 89 IN IT.** `hcSilenceLine` had three branches —
nothing-ran, all-failed, some-failed — and everything else fell through to *"I couldn't work out how
to do that one, so nothing happened."* That final branch covered `ran > 0 && failed === 0`: **a turn
where every action SUCCEEDED and only the reply was lost.** The floor built to end silence was, in
exactly that case, telling the owner his change had not been made while the row sat written in the
database.

The check above it asserted *"no sentence claims success"* and had never once asked whether a
sentence could claim **failure over a success**. One direction guarded, the other open, in the
instrument whose whole job is to tell the truth about a turn. That is Lesson 89 again and it is worth
restating in its most compact form:

> **Every assertion of the form "we never claim X" needs its mirror written the same day.** A false
> green wastes a day. A false red over work that landed makes him redo it, or stop believing the
> record — and it reads as a product being honest about its limits, so nobody investigates it.

`scripts/check-no-silent-turn.mjs` now carries leg 5b (no sentence claims failure over a change that
landed), 5c, and 12–14 (the floor reaches the record, and the record and the screen say the same
thing). All red-proofed by removal.

---

## Lesson 91

**A CLAIM ABOUT A SPECIFIC ROW CARRIES THE QUERY THAT PRODUCED IT, OR IT IS NOT A FACT. A SESSION
INHERITS A PREVIOUS SESSION'S CONCLUSION AND TREATS IT AS A MEASUREMENT.**

2026-09-15. A session read the driveway job's `scheduled_time` as `17:00` and wrote, in a commit
message: *"the driveway job now reads 17:00 — which is the 4 PM seq 40 asked for."* **17:00 is 5
PM.** The arithmetic was wrong in the sentence itself.

Nobody re-derived it. The next session inherited that line, and the line had by then stopped being
a reading of a row and become a premise: *the write landed*. It was built into a report, and it
became a headline — "the write landed and he was told nothing" — with an alarm attached.

**The data turned out to be fine.** Adrian had set that time by hand himself, after the walk. There
was no defect. Nothing broke, and that is exactly why this is worth writing down: **the mechanism
fired cleanly and produced a false headline, and only luck about the underlying data kept it
cheap.** The same chain over a real row produces a real false alarm, and a correction never travels
as far as the alarm did.

This is the folklore failure the booking-count scar already records — *"a scar note is a memory of a
measurement, not a measurement, and the moment it is repeated instead of re-run it becomes folklore
with a citation"* — arriving one level down, on a single row rather than a corpus count, and from
one session to the next rather than across months. It is not rarer down there. It is more common,
because a single row feels too small to be worth re-reading.

**The rule, checkable:**

> **A number or a value about a specific row, written in a doc or a commit message, carries the
> query that produced it. If a later session cannot re-run the line that produced it, it is a
> rumour and must be re-measured before anything is built on it.**

Two consequences that bind:

- **Quote the row, not your reading of it.** `scheduled_time = 17:00` is a fact. "which is the 4 PM
  he asked for" is an inference, it belongs in a separate clause, and it is the half that must be
  re-derived. The commit message above fused them into one sentence and the fused sentence was
  inherited whole.
- **An inherited conclusion gets the same scepticism as an inherited green.** We already refuse to
  trust a checkmark we did not earn. A previous session's conclusion is a checkmark we did not
  earn — written by someone with the same failure modes, working from context we can no longer see.

**And the cheap tell:** when a claim about a row does not name the table and column it came from, it
has already lost its provenance. Re-run it. Reading one row costs a second; the report built on a
misread one costs a day and reaches a customer.

---

## Lesson 92

**A CHECK CAN ARGUE FOR THE BUG. A CHECK ASSERTS THE RULE, NEVER THE CURRENT SHAPE.**

`scripts/check-navigation-destinations.mjs` shipped on 2026-09-16 with this leg:

> *every place a sentence can take someone to is a real **surface***

It was green, it was red-proofed, and it was **encoding the broken shape**. It was true only
because every destination happened to be a rail row at the moment it was written. The rule it meant
to assert is *a destination opens something*; what it actually asserted is *a destination is a rail
row*.

Hours later Adrian ruled that **My Day is not a rail row — My Day is what Home renders.** The
product got more correct and **the check went red.** And the cheapest way to green was to put My Day
back in the rail.

**That is the whole lesson. The check would have argued for the defect, from a green baseline, with
a red-proof behind it.** Every property we trust in a check — it fails on the broken version, it
executes rather than greps, it was seen red — was satisfied. None of them protects against encoding
the shape instead of the rule, because the broken shape *is* the shape it was written against.

**The tell, and it is reliable:** a check goes red on a change that made the product better. That is
not a regression; it is the check telling you what it actually believes. Read the leg and ask *"is
this the rule, or is this what the code looked like on the day I wrote it?"*

**The fix, in both directions:** the leg now asserts a destination **opens** something — a surface,
or Home — and it **executes the product's own resolver** rather than knowing where `planner` goes.
A second leg names which destinations resolve to Home, so nobody can quietly route an unbuilt place
there and call it reachable.

**And when it happens, sweep.** One check encoding a shape means the habit was present that week,
not that one file was careless — the sweep is in `docs/CHECKS_ENCODING_SHAPE.md`.

---

## The failure shape: DOORS CLOSED BY MUTUAL ASSUMPTION

Named 2026-09-16. **Not** built-and-doorless — that is a feature that never had an entrance. This is
worse to find and cheaper to fix:

> **Two entrances to the same working feature, each removed because the other existed. Neither
> removal is wrong on its own. The feature is intact and unreachable.**

The instance: `ead44be` (2026-07-27) hid the Jobs-tab **New Job** button with
`hidden aria-hidden="true"`, stating its reason plainly — *"it duplicated the header CTA … Keep New
Job in the page header only."* Correct de-duplication. The header CTA it deferred to is
`.jos-legacy-bar`, which the Journey OS pixel redesign later set to `display:none !important` as
legacy chrome. Also defensible in isolation.

`openJobsNew()` still works today and **its only caller in the entire codebase is the button that
`ead44be` hid.**

**Why it survives review:** each commit is individually right, each has a written rationale, and
neither author was wrong about the world at the time. Nothing was deleted, so no grep for a missing
function finds it. It is only visible by asking the question the rationale invites: *"the other one
covers it — is the other one still there?"*

**The check:** when a control is removed with a rationale that names another control, that other
control is a dependency. The sweep for existing instances is `docs/DOORS_CLOSED_BY_ASSUMPTION.md`.

---

## Lesson 93

**A STATED LIMIT DOES NOT LICENSE A CONCLUSION THAT EXCEEDS IT. WRITING THE CAVEAT IS NOT THE SAME
AS HONOURING IT.**

`docs/DOORS_CLOSED_BY_ASSUMPTION.md`, first version, said in its own Method section:

> *"a control listed below as never-revealed is high-confidence, not certain"*

and then listed **three** as **CONFIRMED**. Two of the three were wrong.

The caveat was accurate. It was also doing no work: it sat in a paragraph above a table whose rows
said CONFIRMED, and nobody — including the person who wrote both — read the table through the
caveat. **A limit stated beside a conclusion does not weaken the conclusion; it decorates it.**

**The rule: a conclusion must be inside the reach of the method that produced it.** If the method
can only support "probably", the finding says *probably* — in the finding, not in a note nearby. A
caveat is not a permission slip to state more than you know.

**The practical form:** when you catch yourself writing a limit, go back and re-read every claim the
limit touches. If any of them is stronger than the limit allows, the claim is wrong — not
"qualified". Either strengthen the method until the claim fits, or weaken the claim until it does.

---

## Lesson 94

**THE REASSURING FINDING IS THE ONE NOBODY RE-CHECKS. RE-DERIVE THE FINDING THAT FLATTERS THE
FINDER FIRST.**

"I found three doorless features" is a good story. It makes the sweep look productive and the
sweeper look sharp, so it got repeated — into a report, into a commit message, and back from Adrian
in capitals — instead of re-derived. **Two of the three were wrong, and the amplification travelled
further than the evidence ever had.**

This is Lesson 89 pointed at **findings** rather than instruments. There, the direction to
red-proof hardest is the one that says *"this is fine"*, because a clean report is never
investigated. Here the direction is the one that says *"look what I found"*, because a productive
report is never re-run either. **Both are the same asymmetry: the pleasant answer is load-bearing
and unexamined.**

**What actually caught it:** trying to OPEN the doors. Not a re-read, not a second grep — an
attempt to use the finding for something. A finding you act on gets tested; a finding you only
report does not.

**So: before a finding leaves the session, spend the scepticism on the flattering half.** The
finding that says we did badly will be investigated by whoever has to fix it. The finding that says
we did well has no such reader.

---

## Lesson 95

**THE ENVIRONMENT THAT MAKES A CHECK CONVENIENT IS THE ENVIRONMENT THAT MAKES IT VACUOUS. EASIER
THAN THE PRODUCT MEANS MEASURING A DIFFERENT PROGRAM.**

Twice in two rounds, and both times the rig was the comfortable choice:

1. **`authGetClient` caches its client.** `check-day-hours-derived` reinstalled its backend fake
   after the first render, so the product went on answering from the *previous* fake. A leg passed
   against the wrong fixture and printed a number that looked right.
2. **`file://` never loads `hubly.html`'s stylesheets.** That page links them root-absolutely
   (`/journey-os/operate-pixel.css`), which resolves to `file:///journey-os/…` and 404s in silence.
   `check-job-door-open` therefore asserted "the browser paints this button" **on a page with no
   stylesheet at all** — and the six CSS rules that hid the button were the entire subject of the
   check.

Neither failed. Both produced confident green output about a program that was not the product.

**NOT A RULE EACH CHECK REMEMBERS — A PRECONDITION NONE OF THEM CAN SKIP.** Both are now enforced in
`scripts/lib/browser-rig.mjs`:

- `load()` asserts that **every same-origin stylesheet the page asked for actually arrived**, and
  throws if not. Cross-origin sheets (fonts) are expected to be unreadable and are not counted — the
  question is whether OUR css is there.
- `settle()` asserts that a declared backend fake, if one is installed, **is still the one
  answering**. It is a no-op until a check installs one, and unskippable from then on.

It throws rather than warns. **A warning in a check's output is a thing nobody reads until after
they have quoted the green.**

**Measured honestly:** `platform-home.html` carries its CSS inline and links **zero** local
stylesheets, so the stylesheet precondition is a no-op for the 24 checks that load it. **Exactly one
check ever navigated to a page with local stylesheets — `check-job-door-open`, written this round.**
So this did not uncover a pile of rotten checks; it closed the hole that had just swallowed one, in
the only place where closing it is structural rather than remembered.

## Lesson 96

**THE ADVISOR IS PART OF THE CHAIN. A FINDING THAT ARRIVES WITH ITS OWN DISPROOF ATTACHED MUST NOT
BE REPORTED AS URGENT UNTIL THE DISPROOF IS CHECKED.**

**Recorded on 2026-09-17 by Adrian, about himself, and it is the second instance:**

> *"I AMPLIFIED YOUR CAVEATED FINDING AND IT WAS WRONG — second time (17:00, then lugnuts). You
> gave me the caveats; I led with the alarm."*

### The two instances

1. **17:00.** A job time was reported with the caveat that `jobs` has no `updated_at`, so "did this
   move, and when" could not be answered from the row. The caveat was dropped on the way up; the
   time was treated as evidence of a defect. It turned out Adrian had set it by hand after the walk.
2. **lugnuts-regulators, this round.** The finding was reported as *"the one eligible market booking
   … delivery `skipped`, no recipient address"* — with, in the same document, the sentence
   **"`owner_identified=false`, which is our own way of saying we have never confirmed who this
   is"**. That caveat was the disproof. It went up as *"A REAL MARKET BOOKING HAS BEEN SITTING
   UNACCEPTED AND NOBODY WAS TOLD… that is a real person."* The requester was **the owner, booking
   his own page on the day he built it** — `customer_email` byte-for-byte his own auth address.

### Why this is a checking lesson and not a manners lesson

Every other rule in this file guards the step where a MEASUREMENT becomes a CLAIM. This one guards
the step after it: where a claim becomes a PRIORITY. That step has the same failure mode and none of
the same defences —

- **the caveat is written down and travels separately from the number.** A sentence three paragraphs
  below the headline does not survive a re-telling, and the re-telling is what gets acted on.
- **the flattering direction is the alarming one.** *"I found a real customer we dropped"* is a
  better story than *"our own test booking did not notify us"*, so it gets repeated rather than
  re-derived — the same asymmetry as Lesson 94, one level up the chain.
- **the correction never travels as far as the alarm did.** Already in CLAUDE.md, and it is why the
  correction in `OPEN_FINDINGS.md` was put at the TOP of the file rather than beside the entry.

### The rule, both directions

**Down the chain (the measurer):** a caveat that could make the finding evaporate is not a footnote.
It goes **before** the number, in the same sentence, and the finding is not reported as urgent until
it has been CHECKED — not merely stated. *"This holds only if…"* is a task, not a disclaimer.

**Up the chain (the advisor, whoever that is):** a finding that arrives with its own disproof
attached gets the disproof checked before it is amplified. Amplifying is an ACT, and it is the act
that reprioritises a day, reaches a customer, and becomes the thing everyone remembers.

**The line that settles both, and it is already ours:** *a row is not evidence of a person.* The
whole lugnuts alarm rested on reading `customer_name` and an `account_kind` label. One query —
*is this address the owner's own?* — was the entire disproof, and it took eleven seconds.
