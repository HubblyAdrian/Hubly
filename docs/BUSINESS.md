# Hubly — the business record

## WHY THIS FILE EXISTS

On 2026-09-05 a session was compacted and a machine reset, and everything technical
came through intact — the eight traps, the twenty-six findings, the line numbers, the
scars. `docs/STATE.md` and `docs/OPEN_FINDINGS.md` did their job.

What was lost was a prospect: someone who had said they wanted to pay for the
storefront. That fact had never been written anywhere, because this repo had no place
to write it. Engineering memory was excellent and business memory did not exist.

So: **a business fact goes here the moment it is stated.** A customer's name, a
commitment, a price, a date, the state a conversation is in. Same discipline as
recording a finding — and for the same reason, because a fact that only lives in a chat
is a fact that is already half gone.

**Every number here carries its date and its denominator, and says how it was
established.** There are three ways a line gets in:

- **Measured** — someone queried or rendered it, and the file says how, so it can be
  re-checked.
- **Stated** — Adrian said it. That is good enough to record and not good enough to
  present as measured. Lines like this say "stated" out loud.
- **Unverifiable from here** — the publishable key cannot see it. Said plainly rather
  than rounded to a confident number.

That distinction is the same one the product lives by: never state what you were not
told, and never dress up a claim as a measurement. It applies to us too.

---

## CUSTOMERS

*Who is actually on Hubly, what they have built, and what they have told us.*

### Graef's AutoCare — the anchor

**`graefs-autocare.myhubly.app` · Austin Graef · Bakersfield, California · mobile
detailing · `account_kind = market`.**

Our one real detailer, and the closest thing Hubly has to a working customer. Nearly
every product decision in this repo since 2026-09-04 was made by looking at his page.

What he has built, as measured on 2026-09-04 by rendering the live page against the live
record:

- **8 services**, all active and all on the site, priced $75–$400, most with variable
  pricing by vehicle size (sedan / SUV / truck / van / coupe / crossover). Seven carry a
  description he wrote; "Full Detail" does not, which is his to fill and not ours to
  invent.
- **2 membership tiers** — Monthly at $60, Bi-Weekly at $50.
- **2 reviews**, both entered by him, from Glenda Diaz and Katelyn.
- **A bio he wrote himself**, and it is the best thing on the site: a 20-year-old college
  student who found detailing therapeutic, failed at it once for lack of business
  knowledge, and came back eight months ago. That paragraph is why the "never invent
  content" rule is worth what it costs.
- Contact: 661-546-2662, austinjgraef@gmail.com. Instagram `@Graef.Autocare`, TikTok
  `@Graefs.autocare`. Hours Mon–Fri 8–5, Sat 8–3, Sun 9–5.

**He is on the CLASSIC renderer** (`#p-storefront`) and has **no stored
`business_documents` row** — `get_public_business_document('graefs-autocare','website')`
returns nothing while the identical call returns HTML for 24 other businesses. This
matters more than it sounds: **none of the freeform document editor work reaches his
site.** Anything built for the freeform path has to be checked separately against the
classic one, or it does not exist for him.

**Zero transactions.** No booking has ever come through his page. (Stated, and consistent
with everything measured — see the honest zeros below.)

**On 2026-09-04 we found that Hubly had been silently discarding his work.** He used the
click-to-edit editor on his own section headings; the edits saved to a field
(`sectionCopy`) that no renderer read, so they appeared instantly, vanished on reload,
and never reached his page. Three of his four edits were stranded, including a real
pricing term his customers should have been seeing:

> *"(Some Higher Level Services may require Deposits and Quotes)"*

It had never worked for anyone. It was fixed the same day, reader-side, without writing
to his record — his words were already there, our reader was looking at the wrong field.
**Adrian told him.** Full account in `OPEN_FINDINGS` #23.

Two things about his site are still open and are **his** to decide, not ours to change:
his booking sidebar carries `"5-star rated service"`, seeded into his record from a
template before we stopped that (`OPEN_FINDINGS` #25), and it is his data now. Adrian is
handling it with him directly.

His page is protected by `scripts/check-graefs-page.mjs` — one command, PASS or it names
what changed.

### Everyone else on the market side

**9 of the 34 claimed businesses are `account_kind = market`** (measured 2026-09-04:
159 business rows in total, 34 publicly resolvable, of which 9 market / 22 test / 3
internal). "Market" means a genuine outside business; it explicitly excludes us, our
families and our test drafts, and any adoption number that does not state that
denominator is not checkable.

Graef's is the only one with a site anyone would call finished. The other eight:

| business | trade | renderer | what is on it |
| --- | --- | --- | --- |
| `aquaspeed` | detailing | classic | 3 services; still shows placeholder copy (#18) |
| `bucket-mobile-detailing` | detailing | classic | 4 services in the catalog, none rendering |
| `devdetailing661` | detailing | classic | no services; placeholder copy live on the page |
| `mobile-auto-detailing-in-los-angeles` | detailing | freeform | — |
| `detailing-chemicals-equipment-courses` | detailing | freeform | — |
| `window-washing` | windows | freeform | — |
| `modern-landscaping-business` | landscaping | freeform | no services; booking landing reads "Add services to show them here." |
| `lugnuts-regulators` | motorcycle rebuilds | freeform | the only market business in a trade with no blueprint |

The pattern worth naming: **six of nine market businesses are detailing or adjacent.**
Whatever we learn from Graef generalises further than one customer.

---

## PROSPECTS AND COMMITMENTS

*Anyone who has said they would pay. What for, how much, by when, and where the
conversation actually stands.*

Nothing here is inferred. If a line does not say who said it and roughly when, it does
not belong in this section.

### The storefront prospect — STUB, awaiting details from Adrian

Someone has expressed intent to pay for the storefront. That is the whole of what
survived; the specifics were lost in the compaction that caused this file to be written,
which is the point of it existing.

**Adrian to fill in:**

- **Who** — name, business, trade, city. Are they already on Hubly (a slug) or brand new?
- **What they want** — the Commerce storefront (`/store`, `commerce_products`), or
  something they are calling a storefront that is actually the booking site?
- **How much, and what shape** — one-off, monthly, per-transaction? A number they said,
  or a number we proposed?
- **By when** — a date they gave, or a date we hoped for. Mark which.
- **State of the conversation** — have they been quoted? Is anything owed by us? Is
  anyone waiting on a reply, and since when?

Until those are filled in, this is a reminder that a prospect exists, not a pipeline
entry, and it should not be counted in anything.

### Standing caution on this section

`account_kind` exists because a row that reads like a real customer is not evidence of
one. The same applies here with more force, because these lines describe money: **who
someone is and what they committed to is a claim, and it needs a source.** The honest
default when we cannot prove it is "unconfirmed", never the reading that makes the
pipeline look better. That rule cost a week when `account_kind` defaulted to `'real'`,
and it cost a booking forensics document its credibility when three test bookings were
written up as real people. It will cost more here, where the numbers are dollars.

---

## DECISIONS AND WHY

*Choices that would be expensive to re-litigate. Each one records what was decided, what
was rejected, and the reasoning — because the reasoning is the part that gets lost, and
without it the decision looks arbitrary in six months and gets quietly reversed.*

### Booking-frame credentials: clean the data and stop the seeding. No render-time blocklist. (2026-09-05)

The booking wizard was asserting credentials on businesses' behalf — "Licensed &
Insured", "Background-checked cleaners", "100% Satisfaction Guarantee", "Trusted by
homeowners in your area" — on the screen where a customer decides to let a stranger into
their home. Three fixes were on the table:

1. Clean `public/booking-frames/*.json` only.
2. Clean the JSON **and stop the seeding** — the templates no longer copy their claims
   into a business's own `meta.bookingWizard` record.
3. All of that plus a render-time refusal: the renderer inspects outgoing copy and
   suppresses anything that reads like a credential.

**Option 2 was chosen, and option 3 was explicitly rejected.** A render-time refusal is a
blocklist of credential strings, and this codebase has proved four separate times that a
blocklist of phrasings cannot be complete — the fact always turns up wearing a form
nobody listed. Building one would have felt like closing the class while leaving it open,
which is worse than leaving it visibly open.

The cost of option 2, accepted with eyes open: **four businesses seeded before the change
still hold the claims in their own records**, two of them market, and no code change
reaches them. Their values are owner-editable, and a write to a real business's record is
not ours to make. They are listed in `OPEN_FINDINGS` #25 so the class is not mistaken for
closed.

The half of this decision worth remembering: **cleaning the templates alone changed what
zero customers read.** The strings a customer could actually see came from
`smart-quote/engine.js` for the 30 unseeded businesses and from each business's own record
for the 4 seeded ones. A template edit proves nothing about a live page until someone
walks the live page.

### Ratings: clamp at 5. Never gate on `review_submissions`. (2026-09-05)

A market business had a stored rating of **6** on a five-star scale. Whoever typed it, the
six-out-of-five was our output, so we clamp it — at the editor field, writing the corrected
value back so the owner sees the correction, and again at all three render sites.

**The rejected alternative was gating: only show a rating if we hold matching rows in
`review_submissions`.** It sounds like the rigorous choice and it is the wrong one. That
table is empty for everyone (below), so the rule would have blanked out the rating of every
owner with genuine Google reviews — punishing real reputation because it was earned
somewhere we do not have a database table for. `reviewCount` is deliberately left free for
the same reason.

The line this draws: **we correct our own nonsense, and we do not require owners to prove
their reputation to us.** A six-out-of-five is our rendering error. A 4.9 from Google is
their business.

---

## WHAT HAS NEVER HAPPENED YET

*The honest zeros. These say what Hubly is and is not today, and every one should be easy
to re-check — a zero that nobody can verify is just a comfortable story.*

- **Zero rows in `review_submissions`, across the whole database.** No customer has ever
  submitted a review through Hubly. Every review on every site was typed in by the owner.
  *Stated by Adrian; consistent with the rating code, which has no path that reads a
  submitted review.* **Not independently verified here** — the publishable key returns an
  empty set for this table, and under RLS an empty set means "nothing visible to anon", not
  "nothing there". Confirm with the service key before quoting it outside.
- **Zero businesses with an active store product.** The Commerce storefront section
  (`#ws-sec-store`) only renders when `commerce-api` returns a product with
  `status = 'active'`; on every business walked it stayed hidden, and two booking-wizard
  fields (`store-title`, `store-sub`) could not be tested at all for want of a business
  with a store. *Consistent with everything measured 2026-09-04/05.* **Not independently
  verified** — anon is denied on `commerce_products` outright.
- **Zero public bookings, ever.** No member of the public has submitted a booking request
  through any Hubly site. This one has a scar: a forensics document once read the customer
  names in `booking_requests` and wrote up three test bookings as real people whose requests
  had been dropped. The names looked real. The count was zero then and is zero now.
- **Zero transactions on Graef's site**, our best customer. Eight services, two membership
  tiers, real prices, real photos, and nothing has ever been bought.

Read together these say something worth being blunt about: **Hubly today is a site builder
that a handful of real businesses have used to build a site.** It has never taken a booking,
never taken a payment, never received a review. Any sentence that implies otherwise is
ahead of the evidence — and the storefront prospect above is the first thing that could
change it, which is exactly why losing their details mattered enough to create this file.
