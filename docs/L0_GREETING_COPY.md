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

No bookings today, but something real happened. Hubly says the most recent true thing, then
at most one more. **Two items, never twelve.**

> **"No new bookings today. Four people looked at your page yesterday, and someone asked
> about ceramic coating two hours ago and didn't book."**

- *"No new bookings today"* — `bookings` + `jobs`, filtered to today. Says nothing happened
  in the one place an owner checks first, plainly, instead of drawing a zero.
- *"Four people looked at your page yesterday"* — `traffic`: distinct `visitor_hash` in
  `page_loads` for that day, owner previews excluded. If `visitor_hash` is null on a row it
  is counted as its own visit rather than collapsed, so this can over-count, never invent.
- *"someone asked about ceramic coating two hours ago and didn't book"* — `chat_leads`:
  first `chatbot_messages.content` where `role='customer'`, `started_at` for the elapsed
  time, `resulted_in_booking = false`.

**Variants, all from the same rows:**

> "No new bookings today. Someone started booking a Full Detail yesterday and didn't
> finish — they left a phone number."
- `leads` (`booking_requests` where `status='abandoned'`): `service_name`, `created_at`,
  and whether `customer_phone` is present.

> "Nothing new today, but three people looked at your page."
- `traffic` only, when there is no lead and no chat. Two clauses, not three.

> "No new bookings today. Someone asked on your site 40 minutes ago and hasn't been
> answered."
- `chat_leads` with `idle_minutes >= 30` — the `needs_action` flag. Urgency only; a lead
  that is still live is still reported, just without the nudge.

**Rules this state obeys**
- Never a count of zero. "No new bookings today" is a sentence; `0` is a gauge.
- Never blends kinds. A visitor who asked and a visitor who half-booked are different
  sentences, and never one total.
- If a clause's rows are empty, the clause is dropped, not filled. Two real items beat
  three with a hole in one.

---

## State 2 — genuinely nothing

No bookings, no traffic, no chats, no history. The honest answer is that nothing has
happened, and the one thing that matters is that the site is up and can take a booking.

> **"Nothing's come in yet. Your site is live at graefs-autocare.myhubly.app and it can
> take a booking right now."**

- *"Nothing's come in yet"* — all six slices empty. The reader already returns
  "none on record" per slice; this is that, said once, in plain words.
- *"Your site is live at <slug>.myhubly.app"* — `businesses.slug`. This is the address the
  public renderer serves, so it is a fact about a row, not a claim about uptime. **It does
  NOT assert the site is reachable** — we have no health read, and "live" here means
  published, not verified up. When the health read exists this sentence gets stronger; until
  then it must not be read as a status check.
- *"it can take a booking right now"* — `services` from `get_my_site_gaps`, i.e. at least
  one bookable service exists. **If `services` is 0 this clause is dropped entirely**, because
  a site with no services cannot in fact take a booking and saying so would be the
  false-green defect in the greeting itself.

**When services are missing, the second half changes rather than lies:**

> "Nothing's come in yet. Your site is live at graefs-autocare.myhubly.app — adding your
> services and prices is what makes it bookable."
- `get_my_site_gaps.services = 0`. This is the one place the greeting suggests an action,
  and it does so because the gap is real and the fix is reachable.

---

## What is deliberately NOT in either state

- **Reviews.** Not readable at all. No card, no sentence, no mention.
- **"Your site is up."** No health read exists. State 2 says *live* (published), never
  *reachable*.
- **Any percentage, score, trend arrow or sparkline.** No shape for a number we do not have.
- **A greeting identical every morning.** Both states are computed from rows that change,
  and each clause disappears when its rows are empty — so a quiet week reads differently
  from a busy one rather than becoming a banner owners learn to skip.
