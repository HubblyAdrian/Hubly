# Graef's AutoCare — what is on the page vs what is in the records

Counted 2026-09-08 against the live database (`supabase db query --linked`) and the
page fingerprint baseline (`scripts/baselines/graefs-autocare.json`, PASS on the day).

**This document is the input to a decision, not a proposal.** Nothing here recommends
extraction; it establishes the size and shape of the gap so the decision can be made
against numbers instead of an impression.

`graefs-autocare` · `account_kind = market` · claimed, `draft_token IS NULL` · classic
path (no `business_documents` row, so the page renders from `businesses.meta`).

---

## 1. The gap, in one table

| Thing | On the page | In the records | |
|---|---|---|---|
| Services | **8**, all priced, 7 with written descriptions | **1** — `clay and seal`, **price 0**, no description | 1 of 8, and the one disagrees |
| Memberships | **2** cards, priced $60/mo and $50/2wk, with inclusions | **0** rows in `memberships` | 0 of 2 |
| Reviews | **2**, five-star, named (Glenda Diaz, Katelyn) | **0** rows in `review_submissions` | 0 of 2 |
| "Why choose us" | **5** items | no table for these | — |
| Trust pills | **2** (Relationship, Premium Products) | no table for these | — |
| FAQ | **6** questions | no table for these | — |
| Social links | **2** (Instagram, TikTok) | `businesses.ig_handle` / `tiktok_handle` | on the record |
| Own photos | page shows work | `portfolio_photos` **0**, `placed_images` **0**, `gallery_items` **0**, `service_photos` **0** | 0 |
| Opening hours | shown | `settings_business_hours` **0**, `businesses.meta.hours` **present** | on the record, in the meta shape only |
| Phone / email / city | shown | `661-546-2662` · `austinjgraef@gmail.com` · Bakersfield | on the record |
| Site versions | — | `business_documents` **0** | classic page, no document |
| Sidebar rooms | — | `business_places` **0** | fail-open to the full rail; backfill parked |

**Everything a customer reads about what Graef sells, and what it costs, exists only as
text on a page.** Contact details and hours are the exception — those are real columns.

---

## 2. The eight services on the page, in full

Every one carries a price and a duration; six carry a description he wrote himself.

| Service | Page price | Duration | Description on page |
|---|---|---|---|
| Full Detail | from $85 | 2 hrs | — |
| Premium Detail | from $130 | 3 hrs | yes (steam cleaning, chlorine dioxide) |
| Shampoo Detail | from $120 | 3.5 hrs | yes |
| Clay & Seal Package | from $75 | 1.5 hrs | yes |
| Paint Enhancement | from $150 | 4 hrs | yes, incl. an explicit scope caveat |
| All-in-One Paint Correction | from $200 | 4 hrs | yes ("cut away 40%–70% of scratches") |
| Single Stage Paint Correction | from $275 | 4 hrs | yes |
| 2 Stage Paint Correction | from $400 | 8 hrs | yes |

The single `services` row is **`clay and seal`, price `0`, no description, not popular** —
lower-cased, differently named, and unpriced against the page's "Clay & Seal Package,
from $75, 1.5 hrs". So the record is not a subset of the page; where they overlap they
disagree.

---

## 3. What this costs today, measured rather than argued

**Bookings already reference services that are not records.** 11 `booking_requests`,
grouped by what the customer chose:

| Service chosen | Status | n | Is it a record? |
|---|---|---|---|
| Full Detail | abandoned | 5 | **no** |
| Full Detail | accepted | 2 | **no** |
| Premium Detail | accepted | 2 | **no** |
| Bi-Weekly Membership | pending | 2 | **no** (0 rows in `memberships`) |

**11 of 11 bookings name something Hubly has no record of.** Four were accepted and two
memberships are still pending — those are real transactions against strings.

**Every reader built on 2026-09-08 returns almost nothing for him.** Run against his
business: `services` 1 (wrong price), `memberships` 0, `reviews` 0, `page_records` all
zero, `catalogue` 0, `payments` 0. `hours` works only because it reads `meta.hours`.
`customers` 4, `jobs` 2, `sales` $275 across two completed jobs.

**And the 4 customers are not the public.** Named: `Austin Graef` (himself),
`Leslie Graef`, `Alexandria Graef` (family), and `Dentist Appt` — a calendar entry, not
a person. Under the standing rule that a row is not evidence of a person, his real
customer count as far as records go is **zero**, and the four should not be described as
customers in any number we report.

---

## 4. What is NOT knowable from here

- **Whether the page prices are current.** They are what the page says; nobody has
  confirmed with him that $85 is still $85. Extraction would move them into records,
  which makes the booking flow able to quote them — and makes a stale price an
  operational error rather than a display one.
- **Whether the two reviews are real submissions.** They are text on a page with names
  attached. There is no `review_submissions` row and therefore no capture date, no
  source, and no consent record for either name.
- **Whether "from $85" means $85.** Every page price is prefixed "from". A record has a
  single `price` column and no notion of a floor, so extraction has to decide what
  "from" becomes — and that decision changes what a customer is quoted.
- **What he would want.** None of this has been discussed with him.

---

## 5. The shape of the decision (stated, not taken)

The move on the table is reading his page content into records — services with prices,
memberships, reviews — so the rest of the product can see it. It is the conversion that
was withdrawn on the morning of 2026-09-08, arriving from the other side and much
narrower: **not rebuilding his page, and not touching it at all.** Read-only extraction
into tables.

The considerations that belong in that decision, and which this document exists to
supply:

1. It is 8 services, 2 memberships and 2 reviews. That is the entire scope.
2. The page is untouched by definition — his live site is the source, not the target.
   The fingerprint (`scripts/check-graefs-page.mjs`) proves that after the fact.
3. Where page and record disagree today (`clay and seal` at 0), extraction has to pick,
   and the safe direction is the page — it is what his customers are reading and acting
   on, and it is the one he wrote.
4. "from $X" needs a ruling before a number is written, because a price a customer is
   quoted is real money (the standing pricing rule).
5. Reviews carry two named people. Moving a name from page text into a `review_submissions`
   row makes it a record about a person, which is a different thing from a testimonial he
   typed, and it should not ride along with the services just because it is on the same page.
6. **Not decided here.** Adrian rules on it.
