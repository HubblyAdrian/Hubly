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

**Six bookings, all his own testing.** `booking_requests` holds 6 rows for him,
2026-08-05 → 2026-08-15. **Reported by him, 2026-09-05: those are him testing his own
site.** No stranger has booked. Corrects an earlier line in this file that said "zero
bookings, ever" — see the corrected zeros below for why that was wrong and what the habit
was.

**Reported by Austin Graef, 2026-09-05 — reported by the owner, NOT measured by us:**
when a booking comes in he *does* get an email, so that rail works for him. **The Hubly
assistant inside the platform does not tell him. He finds out from email only.**
That second half is the more important half and it is corroborated by code: the
assistant is operationally blind (`OPEN_FINDINGS` #27). On the email half, the ledger
holds no `notification_deliveries` row for his business — but the ledger only begins
2026-08-20 and his bookings are 2026-08-05 → 2026-08-15, inside the lifetime of an
older, noisier trigger that was dropped on 2026-08-17. His account and the record are
consistent; there is simply no ledger row from that era to confirm it with.

**On 2026-09-04 we found that Hubly had been silently discarding his work.** He used the
click-to-edit editor on his own section headings; the edits saved to a field
(`sectionCopy`) that no renderer read, so they appeared instantly, vanished on reload,
and never reached his page. Three of his four edits were stranded, including a real
pricing term his customers should have been seeing:

> *"(Some Higher Level Services may require Deposits and Quotes)"*

It had never worked for anyone. It was fixed the same day, reader-side, without writing
to his record — his words were already there, our reader was looking at the wrong field.
**Adrian told him.** Full account in `OPEN_FINDINGS` #23.

**Told about the seeded claim, 2026-09-05.** His booking sidebar carries
`"5-star rated service"` — written into his record by Hubly from a template, never said
by him. Adrian spoke to him about it; **he said he would update the value himself.** No
write to his data by us, and that stays the rule: these are owner-editable fields and the
owner has been told. The code path that created them is closed (`OPEN_FINDINGS` #25).

His page is protected by `scripts/check-graefs-page.mjs` — one command, PASS or it names
what changed.

### Bucket Mobile Detailing — customer, prospect, and the live comparison

**`bucket-mobile-detailing` · `account_kind = market` · detailing · classic renderer, no
stored `business_documents` row.** Full commercial entry under **Prospects** below; this
is the record side.

4 services in his catalog, **none of them rendering** on his page — his layout is the
tabbed profile and the service cards do not appear. 1 booking, 2026-07-20.

**One of the four seeded businesses from `OPEN_FINDINGS` #25.** His record carries
`"Fully insured mobile service"` and `"Insured & background-checked"` — claims **Hubly
wrote into his record from a template, which he never said.** For a mobile detailer
entering customers' driveways, an insurance claim is not decoration.

**Told, 2026-09-05.** Adrian spoke to him; **he said he would update the values himself.**
No write by us. The code path that created them is closed.

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

### Bucket Mobile Detailing — PAYING, and an explicit head-to-head against Base44

**Recorded 2026-09-05, stated by Adrian. `bucket-mobile-detailing`, `account_kind =
market`, detailing, classic renderer, no stored document.** This is the fact this whole
file was created to stop losing.

**What he is paying for.** He is paying Hubly to build **his site and his store**. He
wants our AI to build it the way Base44's did.

**What he is selling.** Two kinds of thing, and the second is the hard one:

- **Physical goods** — detailing product, kits.
- **Trainings** — digital. Access after purchase, not a shipped box. **This is the larger
  unknown**, and as of 2026-09-05 Hubly cannot do it at all: `product_type='digital'`
  exists but means only "skip the stock check", there is no entitlement, no gated
  delivery, and every storage bucket that could hold a video is public
  (`OPEN_FINDINGS` #19).

**He already has a Base44 site.** Sleek, and it does everything a website does. **This is
an explicit comparison: he runs both and picks the winner.**

**DECISION — build it as a product feature, not bespoke work, even under deadline.**
Adrian's call, recorded so nobody quietly reverses it when the date gets close. What
Bucket needs — a store, digital products, gated delivery — every Hubly business needs.
**Losing that discipline to win one bake-off is the failure mode**, because the bespoke
version wins the demo and leaves us with a customer-shaped fork to maintain and no
product.

**STRATEGIC POSITION — we do not win a page-aesthetics contest against a Wix-funded
specialist, and should not try to.** Base44 builds beautiful pages. What Base44 will not
do is sell his courses, book his details and bill his memberships off one customer list.
**The comparison has to be fought on capability, and the demo has to make capability the
question the customer is asking.** If he judges on how the hero looks, we lose to a
better-funded design tool; if he judges on whether the thing runs his business, we are
playing our own game.

**Consequence for the roadmap — `OPEN_FINDINGS` #16 is now commercially blocking.**
Every site opens in the same shape; 128 of 128 generated headlines are left-aligned.
That was filed as unhurried generator work. It now has a buyer attached: **if our
generator hands Bucket a page with the same skeleton as every other Hubly page while
Base44's looks made-for-him, the aesthetics half is lost before the capability half gets
heard.** We do not need to win on looks. We do need to not lose on looks so badly that
nobody listens to the rest.

**STILL TO FILL IN — Adrian:**

- **How much, and what shape** — one-off, monthly, per-transaction? A number he said, or
  a number we proposed?
- **By when** — a date he gave, or a date we hoped for. Mark which.
- **State of the conversation** — has he been quoted? Is anything owed by us, and since
  when?

Until those three are filled in this is a committed customer with no commercial terms
recorded, which is better than nothing and is not a pipeline entry.

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

### Notifications: does an owner find out? (2026-09-05, measured)

The rail exists and is configured: a trigger `booking_request_completed_notify` is live on
`booking_requests` (fires when status becomes `pending`, i.e. completion, never on a lead
row), the `hubly_cron_secret` Vault entry is set, and `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
are configured in production. Provider is **Resend** for email; Twilio credentials exist for
SMS.

**But `notification_deliveries` — the ledger of every attempt — says this, in full:**

| when | business | role | recipient | status |
| --- | --- | --- | --- | --- |
| 2026-08-20 | calder-vane-roofing (test) | **owner** | adriansmithee@gmail.com | **sent** |
| 2026-08-20 | calder-vane-roofing (test) | **owner** | `not-a-valid-address` | **failed** |
| 2026-08-20 | calder-vane-roofing (test) | customer | adriansmithee@gmail.com | sent ×2 |
| **2026-09-01** | **lugnuts-regulators (MARKET)** | **owner** | *null* | **SKIPPED — "no recipient address"** |
| 2026-09-01 | lugnuts-regulators (market) | customer | kaptn.awesome@gmail.com | sent |

**Exactly one owner booking email has ever been sent, and it went to Adrian, on a test
business.** The only time a real market business received a booking after the rail was
built, **the owner was never told** — `lugnuts-regulators` has no email address on file, so
the notification was skipped while the customer's confirmation went out fine. **2 of the 7
businesses that have ever received a booking have no owner email on record.**

So the rail is not another "the code exists" case — it demonstrably sends. It is a
**"nothing downstream catches a missing address"** case, which fails silently in exactly
the direction that costs a customer. See `OPEN_FINDINGS` #27.

---

## WHAT HAS NEVER HAPPENED YET

*The honest zeros. These say what Hubly is and is not today, and every one should be easy
to re-check — a zero that nobody can verify is just a comfortable story.*

- **Zero rows in `review_submissions`, across the whole database. MEASURED 2026-09-05**
  via `supabase db query --linked` (admin connection, sees past RLS). No customer has ever
  submitted a review through Hubly; every review on every site was typed in by the owner.
  This file previously hedged this number because it had been re-checked with the
  publishable key, where an empty set means "nothing visible to anon" rather than "nothing
  there". The hedge was right for that method and unnecessary once the right method was
  used — **quote a count only from a method that could have seen a non-zero.**
- **Zero products in Commerce at all. MEASURED 2026-09-05.** Not "zero active" — the table
  is empty: `commerce_products` **0**, `commerce_orders` **0**, `commerce_order_items` **0**,
  `commerce_product_variants` **0**, `commerce_store_settings` **0**. One
  `stripe_connect_accounts` row exists — `adrians-lawn-service`, `account_kind = test`,
  Adrian's own, `charges_enabled` and `payouts_enabled` true since 2026-07-23. So the payment
  rail has completed onboarding once, on a test business, and **no dollar has ever moved
  through Commerce.**
- **Bookings: 17 real rows, not zero. CORRECTED 2026-09-05.**
  Counted via `supabase db query --linked`, which goes through the admin connection and sees
  past RLS: `booking_requests` holds **17 rows**, 2026-07-20 → 2026-09-01 —
  **10 against market businesses** (4 accepted, 6 pending), 6 test, 1 internal. Seven
  businesses have received at least one: `graefs-autocare` 6, `calder-vane-roofing` 4,
  `adrians-lawn-service` 2, `aquaspeed` 2, `bucket-mobile-detailing` 1,
  `lugnuts-regulators` 1, `lugnutz` 1.
  Graef's six are him testing his own site (reported by him, 2026-09-05).
  **The habit is the point, not the number.** This file first said "zero public bookings,
  ever" because that figure was quoted from a scar note in `CLAUDE.md` — a note *about* a
  measurement taken months earlier — and repeated rather than re-run. A remembered
  measurement is folklore with a citation attached. Re-count before quoting.
  *(A further 13 rows dated 2026-09-05 named "Test Customer" were written by a verification
  harness, not by a person — see the STATE entry on walks that write. They are excluded from
  every count above.)*
- **Zero transactions on Graef's site**, our best customer. Eight services, two membership
  tiers, real prices, real photos, and nothing has ever been bought.

Read together these say something worth being blunt about: **Hubly today is a site builder
that a handful of real businesses have used to build a site.** It has never taken a booking,
never taken a payment, never received a review. Any sentence that implies otherwise is
ahead of the evidence — and the storefront prospect above is the first thing that could
change it, which is exactly why losing their details mattered enough to create this file.
