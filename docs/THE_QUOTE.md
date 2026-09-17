# The quote — built from his own prices, and it shows its arithmetic

**Status:** built and checked, 2026-09-16. `npm run check:the-quote` · `npm run check:quote-mode`
**Ruling:** Adrian, 2026-09-16. The mode it lives in is `docs/QUOTE_MODE.md`.

## Where a price may come from — exactly two places, and the record stores which

| `source` | means |
|---|---|
| `offer:<name>` | **his own catalogue**, read through `get_business_services` — the **union** reader that already knows both stores |
| `said` | **a number he typed in this message** — the same grounding rule as `priceGrounded` |
| `unpriced` | **we do not know**, and Hubly **asks** |

It never averages, never guesses, and **never reaches back into the transcript for a number.** That
last one is the evergreen-yard-care defect — a phone number lifted from an earlier turn — and money is
the version of it that ends with him honouring a price he never set.

**A line with no `source` is refused by the database.** `create_quote` rejects it outright: a number
whose provenance we did not keep cannot be shown to a customer honestly later.

## It works identically on classic and freeform, and that is structural

**Ruled 2026-09-16: classic is a supported path.** The quote reads `get_business_services` — the
**record**, never the page — and touches no renderer, no document and no page kind. There is therefore
nothing for a classic page and a freeform page to differ about. That is not a retrofit; keeping the
quote out of the renderer is what makes it work on both.

## The arithmetic, because he reads it aloud

> **Quote for Dana:**
> • Premium Detail — $130
> • Full Detail — $85
> **Usual price $215. 10% off is $21.50 off. That comes to $193.50.**

**His phrase, not our word.** The discount row says *"10% off"* because that is what he typed —
`discount_words` keeps his phrasing, and the check has a leg for the **spoken** line as well as the
printed one. (Leg 9 originally covered only the numbers, so swapping his phrase for our generic
"Discount" in the sentence he reads aloud went undetected. Leg 9b covers the half that reaches a
customer's ear.)

**Three figures, never one.** `subtotal_cents`, `discount_cents` and `total_cents` are all stored. A
quote that cannot show its own arithmetic cannot be read aloud, and a total a second reader
recomputes is the two-readers defect pointed at money.

**The database computes the money and the client shows it, and they must agree.** `quote_money()` is
the answer; `hcQuoteMath()` is what he sees. If the saved total differs from the one he was just read,
**he is told, in that sentence** — *"careful: the saved total is $X, which is not what I just read
you."* Two numbers disagreeing about money is the one case where saying nothing is worst.

Clamps, verified against the live database: a discount cannot exceed the subtotal, a percentage over
100 clamps to 100, and a line with no price contributes 0 rather than breaking the sum.

## One ask at a time

`hcQuoteNextAsk` returns **one** question or null:

1. nothing on the quote → *"What are you quoting them for?"*
2. a line with no price → *"What do you charge for Paint Correction?"*
3. no customer name → *"Who is this quote for?"*

A price he then types answers the question **before anything else is considered** — a question on the
floor gets answered first.

## A one-off is first-class and never becomes a public offer

*"headlight restoration for $60"* becomes a line named from **his own words** (the money and the
filler stripped, nothing composed), priced only by what he said, and the reply says so:

> *"That one isn't on your list, so it stays on this quote only."*

It lives on the quote and nowhere else. It is never written to the catalogue.

## What it refuses to do

- **Save a quote with an unpriced line** — *"I can't send it yet — Paint Correction has no price."*
- **Overwrite a price his catalogue already has** from a number in a passing sentence. A stated number
  fills a line that has **no** price of its own; it never replaces one he has entered.
- **Report an empty catalogue when the read failed** — *"I couldn't read your own prices just now, so
  I'm not going to quote off guesses."* That is the empty-reader rule: our failure is never reported
  as his missing data.
- **Invent a line from a sentence it could not use.** An unrecognised message produces a question and
  lists his own service names; **never a number**.

## The turn time, reported every time

Every reply ends with `(N ms)`. Not telemetry — **a sentence he can read while a customer waits.** A
quoter that is fast is worth having on a phone call and a slow one is worth knowing about, and the
only way to know is to publish it every time. Measured in the rig: **0–2 ms** for a turn that reads a
cached catalogue, and the catalogue read is the only thing in the path that can be slow (it is cached
for the life of the quote, because re-reading between two lines of one quote is how two lines come to
disagree about one price).

## The PDF — the browser's own, and the cost is stated

*"a PDF he can text or email."* `hcQuotePrint` opens a print-ready document and calls `print()`.

**Why not a PDF library:** ~200KB from a CDN, and every byte is a dependency on a network that may be
the thing failing while he is standing in a driveway. This works offline. It also uses **the same
`hcQuoteMath`** he just heard — a second renderer could format a number differently, and a quote that
prints a different total from the one he said is the worst defect this feature could have.

**The cost, said in words rather than implied:** *"Opened a printable copy — use your browser's 'Save
as PDF', then text or email it."* One extra gesture. A blocked popup is a failure and **says so**.

**Nothing is invented on it.** The business name and contact come from the record; a field we do not
have is **absent**, never a placeholder. There is no *"valid for 30 days"* — he never said that, and
leg 19 fails if one appears.

## The pipeline — what is built and what is not

`quotes` carries `lead_id`, `customer_id`, `became` (`booking`|`job`), `became_job_id` and
`became_booking_id`, so **Leads → Customers → Jobs** is a link and not a coincidence of names. One
reader — `get_business_quotes` — serves both the chat and the tab, which is what makes *"one record,
two views"* structural rather than a hope that two queries agree.

**NOT BUILT, and named rather than implied:**

- **The `quotes` tab's contents.** `data-v="quotes"` exists in the classic shell and still opens the
  old Quick Quote; the new record has no list surface yet. The row spec belongs with it
  (`docs/LIST_SURFACES.md` deliberately left QUOTE out until the record existed — it exists now).
- **Accepting a quote into a booking or a job.** The columns are there; the transition is not.
- **Sending it to the customer.** `status='sent'` can be set; nothing sends.
- **The 177KB** (`public/smart-quote/{engine,ui,booking}.js`) is **still in place**, as instructed: it
  comes out only after this works, in its own commit — and "works" includes the tab and the accept
  path above.

## The check

`scripts/check-the-quote.mjs` — **20 legs, `[RULE]`.** The catalogue fixture is shaped exactly as the
RPC returns it (**dollars**, plus `source` and `conflicts`), so the unit conversion is exercised too —
which is where a units bug would live, and the red-proof confirms it is loud: breaking the conversion
turns **eight** legs red.

**Red-proofed, eleven breaks, each asserted to have applied and each run.** Two problems that pass
found were in the **check**, not the product: leg 9's blind spot above, and `__rig.writes` accumulating
across cases so that leg 16 failed against a correct product while leg 14 passed only because it ran
first. *A probe that shares state between cases is measuring the order it ran in.*
