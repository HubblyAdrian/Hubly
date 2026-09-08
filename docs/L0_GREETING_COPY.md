# L0 — the empty-day greeting. Copy only, nothing built.

Shown before building, as asked. States 1 and 2 only; **state 3 stays parked** until the
health reads exist.

Every sentence is followed by the rows it reads. A sentence with no rows under it does not
ship — that is the whole point of writing this before the code.

## What the reader can actually reach today

| slice | table it reads |
|---|---|
| `bookings` | `booking_requests` |
| `jobs` | `jobs` |
| `orders` | `commerce_orders` |
| `chat_leads` | `chatbot_conversations` + `chatbot_messages` (first customer line, last activity, idle minutes) |
| `traffic` | `page_loads` (14 days, `is_owner_preview = false`, distinct `visitor_hash` per day) |
| `leads` | `booking_requests` where `status = 'abandoned'` |

Plus `get_my_site_gaps(p_business_id)`: `has_phone`, `has_hours`, `own_photos`, `services`,
`services_no_desc`, `has_priced_services`.

**Not reachable, and therefore absent from every sentence below:** reviews (no Google
integration exists; `review_submissions` holds 0 rows), site reachability, booking-readiness.

---

## State 1 — quiet but active

**Most actionable first; absence is implied, not announced.** An unanswered lead outranks
page views, page views outrank "nothing happened". A greeting that opens with a negative
every quiet morning trains an owner to stop reading it, and buries the one person he could
still win.

> **"Someone asked about ceramic coating two hours ago and hasn't booked. Four people
> looked at your page yesterday."**

- *"Someone asked about ceramic coating two hours ago and hasn't booked"* — `chat_leads`:
  first `chatbot_messages.content` where `role='customer'`, `started_at` for the elapsed
  time, `resulted_in_booking = false`. **"hasn't booked", not "didn't book"** — they still
  might, and that is the entire reason he is being told.
- *"Four people looked at your page yesterday"* — `traffic`: distinct `visitor_hash` in
  `page_loads` for that day, excluding `is_owner_preview` AND `device_class = 'bot'`.

No "no new bookings today" clause. If bookings were empty, the sentences above simply are
what there is to say; the silence carries it.

**Ordering, when more than one thing is true (at most two clauses ship):**

1. A chat lead quiet 30+ minutes — `chat_leads.needs_action`. Most winnable, most perishable.
2. An abandoned booking form — `leads` (`booking_requests` where `status='abandoned'`):
   `service_name`, `created_at`, whether `customer_phone` is present.
3. A chat lead still live — `chat_leads` without the flag.
4. Page views — `traffic`.

**Variants, all from the same rows:**

> "Someone started booking a Full Detail yesterday and didn't finish — they left a phone
> number."
- `leads`. This one IS past tense: they stopped, and the form is not still open.

> "Three people looked at your page yesterday."
- `traffic` only, when there is no lead and no chat. One clause is a complete greeting.

**Rules this state obeys**
- Never a count of zero, and never an announced absence. "No new bookings today" is a
  negative opener; the same information is carried by not mentioning bookings.
- Never blends kinds. A visitor who asked and a visitor who half-booked are different
  sentences, and never one total.
- If a clause's rows are empty, the clause is dropped, not filled.

## State 2 — genuinely nothing

No bookings, no traffic, no chats, no history. The honest answer is that nothing has
happened, and the one thing that matters is that the site is up and can take a booking.

> **"Nothing's come in yet. Your site is at graefs-autocare.myhubly.app and it's set up to
> take bookings."**

- *"Nothing's come in yet"* — all six slices empty. The reader already returns
  "none on record" per slice; this is that, said once, in plain words.
- *"Your site is at <slug>.myhubly.app"* — `businesses.slug`. **"live" was cut.** It implies
  we checked reachability and we did not; there is no health read. "is at" states the address,
  which is a fact about a row. When the reachability read exists, "live" becomes sayable and
  this changes then — that is a reason to build state 3, not to borrow the word early.
- *"it's set up to take bookings"* — `services` from `get_my_site_gaps`, i.e. at least one
  bookable service exists. **"right now" was cut** for the same reason: it asserts a live
  capability at this instant, which is a reachability claim wearing different words.
  "set up to" describes the configuration, which is what we can actually see. **If `services`
  is 0 this clause is dropped entirely** — a site with no services cannot take a booking, and
  saying it could would be the false-green defect inside the greeting itself.

**When services are missing, the second half changes rather than lies:**

> "Nothing's come in yet. Your site is at graefs-autocare.myhubly.app — adding your
> services and prices is what makes it bookable."
- `get_my_site_gaps.services = 0`. This is the one place the greeting suggests an action,
  and it does so because the gap is real and the fix is reachable.

---

## What is deliberately NOT in either state

- **Reviews.** Not readable at all. No card, no sentence, no mention.
- **"live", "up", "right now".** No health read exists. State 2 says where the site *is*
  and that it *is set up* — never that it is reachable, and never that it works at this
  instant.
- **Bot traffic counted as people.** Measured across the corpus: 54 of 135 page_loads rows
  are `device_class='bot'`. The traffic slice now excludes them; on 2026-09-05 the
  unfiltered number would have been 43 "people" against a real 9.
- **Any percentage, score, trend arrow or sparkline.** No shape for a number we do not have.
- **A greeting identical every morning.** Both states are computed from rows that change,
  and each clause disappears when its rows are empty — so a quiet week reads differently
  from a busy one rather than becoming a banner owners learn to skip.
