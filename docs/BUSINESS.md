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

**WHAT "TRAININGS" ACTUALLY MEANS — reported by Bucket via Adrian, 2026-09-05.
REPORTED BY PROSPECT, not measured by us. It collapses the hard half of the job.**

Asked directly, it turned out to be two ordinary things and neither is a gated digital
product:

1. **Teaching people to detail, in person or over a video call.** That is a **bookable
   service with a price** — a service card whose delivery is a call rather than a driveway.
   Hubly already books services.
2. **"Available content" / clickable content.** That is **content on the page**, and what
   makes it good is video that plays instead of a bare link. That is the rendering half of
   `OPEN_FINDINGS` #19, where `<video>` and the origin allowlist already exist.

**So private storage, entitlements and buyer authentication are all OUT OF SCOPE.** The
storefront job is now: **sell physical goods, plus play video on a page.**

**Worth writing down because it nearly cost a fortnight:** on the strength of the word
"trainings" we had scoped a course platform — private buckets, signed expiring URLs, an
entitlement table, customer-side auth — to sell **a service and a video embed.** One
question to the customer removed all of it. The lesson is not "ask more questions" in the
abstract; it is that **a noun in a requirement is not a specification**, and the cheapest
moment to find that out is before the estimate, not after the schema.

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

### Stripe is in TEST MODE as of 2026-09-05 — and getting back to live is a sequenced job

Adrian swapped both secrets himself. **Names and prefixes only, never values:**
`STRIPE_SECRET_KEY` is now an `sk_test_…` key; `STRIPE_WEBHOOK_SECRET` is the signing
secret of a **new test-mode event destination**. All five Stripe functions were redeployed
against it: `stripe-webhook`, `create-store-checkout`, `create-booking-checkout`,
`stripe-connect-onboard`, `stripe-connect-connection`.

**The destination as configured:**

| setting | value | why |
| --- | --- | --- |
| scope | **Your account** | every event we handle is a platform event — destination charges settle on the platform and carry `payment_intent_data[transfer_data][destination]`; there is no `Stripe-Account` header anywhere in the codebase, so "Connected accounts" would deliver events we have no handler for |
| payload | Snapshot | what the handler parses |
| API version | `2026-06-24.dahlia` | the preselected default; the handler reads only long-stable fields |
| events | six | checkout + payment_intent + the Connect account lifecycle |
| `account.updated` | **deliberately skipped** | see the consequence below |

**The `account.updated` consequence, stated so nobody is surprised by it:** an owner's
Connect status (`charges_enabled`, `payouts_enabled`, `details_submitted`) refreshes when the
**Store screen loads** and calls `stripe-connect-connection` — not the instant Stripe finishes
verifying them. So an owner who completes onboarding and stares at a stale screen sees the old
status until they reload. That is a real, if small, instance of prohibition 2's neighbourhood:
the status shown is one we fetched, never one we assumed, but it can be *behind*. Acceptable
for now because the fetch is honest and cheap; revisit if an owner ever reports "I finished
Stripe and Hubly still says I haven't."

**THE HARD SEQUENCING CONSTRAINT — read this before touching Bucket:**

> **No Stripe onboarding for Bucket Mobile Detailing until we are back in live mode AND the
> mode column is built.** A Stripe Connect account exists in **exactly one mode**. The live
> account already on `adrians-lawn-service` does not exist in test mode; a test account
> created now will not exist in live mode. `stripe_connect_accounts` has **no column recording
> which mode an account belongs to**, so the two are indistinguishable in our own data — which
> means an account onboarded in the wrong mode has to be redone from scratch by the owner, and
> we would be asking a paying customer to do identity verification twice.

Order of operations, therefore: (1) finish the test-mode purchase walk; (2) add a mode column
to `stripe_connect_accounts` and make the Store screen read it; (3) swap back to live keys and
a live destination; (4) only then onboard Bucket.


### The first store dollar did NOT move on 2026-09-05 — and why (measured)

The test-mode purchase walk was attempted and **stopped at step zero**. Recording it here
because "we tried to sell something and couldn't" is a business fact, not a code note.

**Where it stopped:** Stripe refuses `POST /v1/accounts`, which is how
`stripe-connect-onboard` creates an Express account. No connected account means
`create-store-checkout` refuses (503, honestly), which means no checkout, which means no
order. Reproduced against both test businesses; nothing written either time. Full detail and
the two exits in `OPEN_FINDINGS` #34.

**Why this matters beyond the walk:** the same code runs in live mode. The live account on
`adrians-lawn-service` exists only because it was created when v1 was still accepted.
**Bucket would hit this wall today.** This moves ahead of the mode column in the sequencing
above — there is no point being ready to onboard Bucket in live mode if onboarding itself
returns a 500.

**What was proven along the way:**

- Stripe is genuinely in **test mode**, read back rather than assumed:
  `stripe-connect-connection` reports `configured: true, livemode: false` for both test
  businesses. All five Stripe functions were redeployed against the new secrets.
- `create-store-checkout` refuses cleanly without a connected account — **no fake payments**,
  which is the behaviour we want.
- The public `/store` route is live and honest for any business
  (`evergreen-yard-care.myhubly.app/store` → *"No products to show here yet."*).
- The sale notifier is built, wired into the only path that flips an order to `paid`, and
  deployed. **It has still never sent an email**, and it cannot be proven until an order
  exists. Its recipient logic was exercised against a stub across all four cases (business
  email → owner auth email → loud operator alert when neither exists); the send itself is
  unproven.

**What an owner sees when they try:** nothing. Clicking "Connect Stripe" in Settings shows
"Opening…", then goes back to "Connect Stripe", with no message at all — two empty
`catch(e){}` blocks (`OPEN_FINDINGS` #35). Every owner who tries to take payments right now
gets silence, and would reasonably conclude they mis-clicked.

**Businesses used:** `dawn-patrol-coffee` and `evergreen-yard-care`, both
`account_kind = 'test'`, both owned by `adriansmithee+evergreen@gmail.com`. No market
business, no Graef, no Bucket. **Nothing was created and nothing needs cleaning up** — every
commerce table visible to that owner was 0 before and 0 after.


### 2026-09-06 — THE FIRST END-TO-END PURCHASE THROUGH THE HUBLY STORE

A customer bought something, the business got paid, and the business was told. That had never
happened before through the store; `commerce_orders` had been zero all the way back.

**What was bought.** `[TEST] Spring Lawn Feed 10kg`, $24.99, one unit, from Evergreen Yard Care
(`account_kind = test`) at `evergreen-yard-care.myhubly.app/store`. Order **`STO-74536512`**,
`status: paid`, `total_cents: 2499`, `paid_at: 2026-09-06T06:07:02Z`, payment intent
`pi_3UCZEEEEmwNmC4XD14yUfH3z`. Adrian entered the Stripe test card; the account owner had
completed Connect onboarding himself minutes earlier.

**What the buyer saw.** A store page with the product at **$24.99**; a cart drawer showing the
same $24.99 line and $24.99 subtotal; Stripe Checkout branded *Hubly* with a **Sandbox** badge
showing **$24.99**; then a redirect back to the business's homepage with the cart emptied and a
confirmation banner. Six surfaces, one number, equal to what was charged — that closed
`OPEN_FINDINGS` #38. The confirmation banner itself was **unreadable** (#42).

**What the owner was told.** An email, subject **"You sold $24.99 — [TEST] Store Walk"**,
headline **"You sold $24.99"**, naming the business, listing the item and total, and giving the
buyer's email to reach them at. And in the product, asked "Has anything come in lately?", Hubly
answered:

> "No real bookings, jobs, or leads are on record right now. There is one paid store order
> showing, but it's marked as a test row: Store Walk, $24.99, pickup, paid Sep 6, 2026."

That is the operational-state read path (#27) proven against a real row for the first time — and
it declined to count a `[TEST]` row as real business, which is the `account_kind` discipline
holding at row level.

**WHAT THIS PROVES.** The full chain works: store page → cart → `create-store-checkout` →
Stripe Checkout → destination charge on the platform → `stripe-webhook` (signature verified
against the new test signing secret) → `finalizePaidCommerceOrder` → `commerce_orders.paid` →
CRM customer linked → inventory deducted → sale notifier invoked → the assistant can see it.

**WHAT THIS DOES NOT PROVE — read this before repeating the claim.**

1. **Not live mode.** Every part of this ran in Stripe **test mode**, against a **test-mode**
   Connect account, with a test card. No real money moved. Nothing here says the live rail
   behaves the same.
2. **Not that Bucket can onboard.** The Connect account only exists because Accounts v1 was
   re-enabled in the Stripe Dashboard on 2026-09-06 as a **legacy compatibility flag**, and only
   for test mode. Stripe says new integrations should use `POST /v2/core/accounts`. Whether
   Bucket can onboard in live mode is untested and gated on `OPEN_FINDINGS` #37.
3. **Not that the emails arrived.** The notifier was invoked and uses the same Resend
   configuration as the proven booking path, but `notification_deliveries` is admin-only
   (`42501` for an owner) and edge logs are unreadable from here. Delivery is confirmed by
   looking in the two inboxes, not by anything measured in this walk.
4. **Not a market customer.** The buyer was us. `account_kind = test`, `[TEST]` stamped
   throughout, and every row deleted afterwards.

**Cleaned up completely**, verified by re-counting rather than by trusting the deletes: every
commerce table back to baseline, `commerce_products` 1 → 0, `customers` test row removed. The
Stripe Connect account was **deliberately left in place** — Adrian did that verification by hand
and deleting it would cost him the work.


### 2026-09-06 — the store has now taken payment end to end TWICE

The second purchase completed the same night, and it is the more informative one because it ran
against the fixed code.

**Purchase 2:** `[TEST] Double-Delivery Check`, **$18.99**, one unit, Evergreen Yard Care
(`account_kind = test`). Order **`STO-75904418`**, `paid_at 2026-09-06T08:45:17.884Z`, payment
intent `pi_3UCbhOEEmwNmC4XD0oic1eZ4`.

| what had to be true | measured |
| --- | --- |
| order paid | `status: paid`, payment intent stored |
| **stock deducted exactly once** | one inventory log, **5 → 4**, delta −1 — after the purchase **and** a dashboard resend of the event |
| buyer told | Hubly confirmation to the buyer address |
| owner told | *"You sold $18.99"* to the business |
| CRM linked | one customer row, not two |

Purchase 1 (`STO-74536512`, $24.99, 00:07) is what proved the chain existed at all. Purchase 2
proves it survives the thing that broke it: **one sale removes one unit**, where the first
purchase removed two.

**WHAT THIS PROVES — unchanged from purchase 1, and worth repeating rather than quietly widening:**
**test mode**, on a **test-mode Connect account**, created under an **Accounts v1 compatibility
flag** re-enabled that day, **with us as the buyer**. It does not prove live mode, it does not
prove Bucket can onboard, and no market customer has bought anything.

**One correction belongs in the business record, not just the engineering one.** Between the two
purchases I reported that a payment had been taken with no order recorded, and escalated it. That
was false: I had read the database 61 seconds before the order was paid. Nobody was ever charged
without a record. The engineering finding it produced (`OPEN_FINDINGS` #45) survives only as a
latent code defect found by inspection — it must never be repeated as an incident, because if it
reaches a customer conversation it is a claim that Hubly loses payments, and that has not happened.

**Cleaned up completely**, verified by re-counting at `09:51:31Z`: all **eighteen** `commerce_*`
tables at **0**, no test CRM rows, the public store showing no products. The Stripe Connect account
is deliberately left in place.


### 2026-09-06 — Graef's and Bucket's services are invisible to the management UI (#54)

Found while tracing something else, and it is the kind of thing a customer reports rather than a
query finds.

**Graef's live page shows eight priced services. His management panel shows none.** His services
live in `businesses.meta.service_catalog` (a JSON blob in a text column); the panel reads the
`services` table, where he has zero rows. There is no empty state, so what he sees is the heading
"Services" followed immediately by a blank add-a-new-one form.

**The reasonable reading of that screen is "Hubly lost my services", and the reasonable response
is to retype them — which would make it worse**, creating eight rows that still do not appear on
his page while a second source of truth diverges from the first.

**Bucket is in the same position.** 4 services in the catalog, 0 rows in the table. Of nine market
businesses, these two are the only meta-only ones — our anchor customer and our paying customer.

Neither has reported it. That is not evidence it is fine; the panel is behind a button most owners
have not pressed.

**Not fixed.** Three homes exist for service data, nothing synchronises them, and choosing which
one wins is a product decision with a migration behind it (`OPEN_FINDINGS` #54).

**Related, and better news for the Store work:** goods do NOT have this problem.
`commerce_products` is the single home, all nine market businesses have zero rows, and there is no
legacy product data to reconcile (#55). The Store for Bucket can be designed against it directly —
but his *services* stay broken until #54 is decided.


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
  `stripe_connect_accounts` row exists — `adrians-lawn-service`, Adrian's own,
  `charges_enabled` and `payouts_enabled` true since 2026-07-23, **and it is a LIVE-mode
  account** (confirmed by Adrian 2026-09-05: Stripe test mode shows no connected accounts).
  **The store checkout path specifically has never produced an order** — that is what these
  zeros measure. It is NOT the same as "no money has moved through Stripe"; see the payment
  rail entry below.
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

**MEASURED ZEROS vs THINGS WE WERE TOLD — do not collapse these.** Everything above is a
count from a query. A statement from Adrian is a different kind of fact: good enough to
record, not the same as measured, and it must never be *overridden* by a measured zero from
a narrower query. That mistake has now been made twice in this file, both times in the same
direction — reading "this table is empty" as "this has never happened." The payment rail
below is the case in point: `commerce_orders = 0` is true and says nothing about whether
money has moved through Stripe.

### THE PAYMENT RAIL IS PROVEN WITH REAL MONEY — reported by Adrian, 2026-09-05

**Real money has been exchanged through Stripe. Adrian did it deliberately, to verify the
rail works end to end.** Reported by the owner; not measured by us, and not something a query
here can confirm, because Stripe holds it and `commerce_orders` is not where it landed.

**HE HAS SAID THIS BEFORE AND IT WAS LOST ONCE ALREADY** — to a compaction, before this file
existed. It was then re-lost from my own framing on 2026-09-05, when I wrote "no dollar has
ever moved" from a `commerce_orders` count. **This file exists to stop exactly that**, so the
history is recorded with the fact.

Both halves matter and neither implies the other:

- **The rail is proven.** Hubly is NOT pre-transaction on payments. Stripe Connect,
  onboarding, a live key, and a real charge have all happened.
- **The store checkout path has never produced an order.** `commerce_orders = 0`, measured
  2026-09-05. That path is unproven. The rail working does not make it work.

Read together, the honest sentence is: **Hubly is a site builder that a handful of real
businesses have used, whose payment rail has carried real money at least once, and whose
store checkout, bookings and reviews have not yet been used by a member of the public.** Any
sentence that implies otherwise is ahead of the evidence — and the storefront prospect above is the first thing that could
change it, which is exactly why losing their details mattered enough to create this file.

## Graef's AutoCare — the reference business (2026-09-07)

`graefs-autocare`, Bakersfield, detailing, `account_kind = market`, `tier = pro`, owner identified.
**The one real owner who has put sustained work in** — and therefore the specification the new
structure is designed against, not a migration to handle afterwards (see `docs/GRAEF_INVENTORY.md`
for the itemised checklist, and STATE for the framing).

- **Established:** measured — parsed from the live record, read-only, 2026-09-07.
- **8 services**, $75–$400, with **per-vehicle-class pricing** (coupe/sedan/suv/van) — a shape no
  single-price model can hold.
- **2 memberships** he priced himself: Monthly $60, Bi-Weekly $50.
- **3 real customers** with name, phone, email, address and message history — stored in
  `meta.pipeline.manual`, not in a table. Snapshot is gitignored for that reason.
- **35 images**, all live, all in `brand-assets`, zero base64.
- **Store is switched on with 0 products** (`meta.storeOs.seeded`, `enabled`, `showOnWebsite`) —
  the #66 gating case, in a real business.
- **Unknown, and NOT zero:** whether he has bookings, jobs or `services` table rows. The anon
  credential returns an empty array for both "none" and "RLS denied", so this is unmeasured until
  the export is re-run with the service role.
