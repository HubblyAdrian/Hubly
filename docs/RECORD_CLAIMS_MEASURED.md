# The record-claim class — measured, and the shape of the cure

**Read-only, 2026-09-16. Nothing built.**

> **THE CLASS:** when Hubly reports what is in the record — how many, which ones, what state, who,
> when — those figures come from a **reader**, not from the model's recollection.

The week, through that lens: *"clay and seal, price 0"* · *"there is no services area on your page
yet"* · *"the 1 service you priced"* · *"your schedule isn't set up on this account yet"* ·
*"one paid store order — Store Walk, $24.99, paid"*. Five sentences, five days, one act.

## Hand-checked first, the crudest way

Five assistant rows printed whole and read by eye before any detector existed. That read is the
reason the numbers below are usable:

- `dawn-patrol-coffee` seq 23: *"The **8 earlier edits** we talked about didn't carry across."*
- `dawn-patrol-coffee` seq 17: *"Cold brew $8, Pour-over $9 and Breakfast tacos $4 are on your page
  now… I couldn't find Cortado on the page as it's built."*
- `ironwood-fence` seq 11: *"this is your site, and it's **live** at ironwood-fence.myhubly.app."*
- two rows with no record claim at all (a question; a "opening it now").

**And it immediately caught my first detector undercounting.** My count regex required the noun
adjacent to the digit, so *"8 earlier edits"* did not match and the sweep reported **1** count claim
across the whole corpus. Widened to allow up to two words between: **15**. The row that exposed it
was one I had already read with my own eyes — which is the entire argument for reading rows before
writing queries.

## 1. How many turns claim something about the record

**284 assistant turns. 89 make a record claim — 31%. Across 28 businesses.**

| marker | turns |
|---|---|
| a **state** (`is live`, `on record`, `on your page`, `marked paid`, `pending`, `not set up`, `isn't showing`) | 79 |
| **money** (`$…`) | 32 |
| a **count** (a number within two words of a record noun) | 15 |
| a **date** (`September 17`, `09/17/2026`) | 4 |

*(markers overlap; 89 is the union)*

**This is a FLOOR.** It is form-based, and enumerating forms is the thing CLAUDE.md warns
undercounts — my own count marker was wrong by 15× on the first attempt. A claim phrased without any
of these shapes ("everything you added is showing") is invisible to this sweep.

## 2. Composed by our code, or narrated by the model?

The composed-truth family, from source:

| composer | paths |
|---|---|
| `composeServicesTruth` (+`Core`, `servicesTruth`) | services |
| `composeContactHoursTruth` | contact / hours |
| `photoTruth` | photo |
| `changeTruth` | the change narration in `hubly-conversation` |

**Four composers.** Meanwhile the capability registry returns **284 `summary:` strings** that the
model reads and re-narrates in its own words.

So: **a handful of paths compose their truth; the overwhelming majority is narrated.** The exact
split per stored turn is not recoverable — a stored reply does not record which composer produced
it — and I am not going to estimate it. What is recoverable is the code answer above, and it is
lopsided enough to act on.

## 3. Spot-check against the record — 4 checked, and I say 4

| claim | record | verdict |
|---|---|---|
| `mobile-detailing`: *"those **five** services are on the site now"* | `services` = 5 | **correct** |
| `site-aa7537`: *"**No** bookings on record this week."* | 0 booking rows | **correct** |
| `hubly-classic-fixture`: *"**$180** in job sales… hasn't been marked paid"* | `jobs.amount` = 180, unpaid | **correct** |
| `evergreen-yard-care`: *"**one paid** store order… **Store Walk, $24.99**, paid"* | **two** orders, `[TEST] Pin Check` $12.34 and `[TEST] Mode Filter` $9.99, both **pending** | **wrong — 4 of 6 fields fabricated** |
| `dawn-patrol-coffee`: *"Cold brew $8, Pour-over $9, Breakfast tacos $4 are **on your page**"* | `services` = 7 | **unverifiable** — it claims about the *rendered page*, and we established no single store answers "what does a visitor see" |

**4 checked, 3 correct, 1 wrong; 1 more unverifiable.** That is a sample of four out of eighty-nine
and it supports **no rate**. I am not extrapolating 1-in-4 to the corpus, and the one wrong answer is
on a `test` business.

## The shape of the cure

**My recommendation is NOT `composeServicesTruth` generalised to every path.** The measurement argues
against it:

- **79 of 89 are state claims**, and the most common state is *"on your page"* — which **no reader
  can answer today**, because the two service stores disagree on 23 of 41 claimed businesses and
  neither is the page. Composing that truth means building the reader that does not exist. A composer
  per capability is ~40 composers, and the expensive ones are the ones nobody can write yet.
- **The four composers that exist were each written for a specific scar.** They are good, and they
  are the *expensive* form of the cure.

**The cheaper thing that covers most of it: one assertion at one choke point.**

> Every figure in an owner-facing reply — number, name, state — must appear in the **capability
> result** that produced that turn. If the model says a number the handler did not return, the turn
> is wrong and we can *see* it.

Why this is the right trade:

- **One place, not forty.** It sits where `decision.message` already passes through the guard added
  for the envelope, next to `sayableText`.
- **It is countable before it is enforced.** The same comparison can run in report-only mode and
  write a row per mismatch — the `envelope_suppression_events` pattern, which earned itself within
  hours. That turns "does the prompt hold" into a number for every record claim, not just prices.
- **It fails safe in the honest direction.** A figure the handler *did* return but the model rephrases
  is fine; a figure that appears from nowhere is exactly the `Store Walk, $24.99` defect.

**Its limit, stated: it only works when a capability ran.** A purely conversational turn has no
result to check against, and `evergreen-yard-care` seq 38 may well be one of those — it reads like a
summary composed from context, not from a handler. So this covers the capability-driven claims and
leaves the free-narration ones, which is a *smaller* remaining problem than today's but not zero.

**Not built. The measurement is the deliverable; the mechanism awaits the ruling.**
