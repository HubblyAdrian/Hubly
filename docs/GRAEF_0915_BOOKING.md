# Graef's "clay and seal on 9/15" — CLOSED. Not an incident.

> **CLOSED BY ADRIAN, 2026-09-15.** The 9/15 clay and seal **was never a real booking**, and he
> has already spoken with Austin about *"how come everything is different."* **Nothing is
> outstanding on this customer.**
>
> This file stands as the record of **a question answered honestly** — not an open incident. The
> measurement below is kept because it is the evidence for that, and because of what survives it.

## What survives, and it is the point

**The paste-a-job door is right, and here is the reason, on the record:** a home-service owner's
work arrives by **phone, text and Instagram**. Austin uses all three. Until 2026-09-14 the product
could accept **none** of it — a job could only enter Hubly through the booking widget or by being
typed into the operator app, neither of which is where his work actually comes from.

That is why `business.addJob` exists, and this is the customer evidence for it: the one time a
real owner told us about a real job, the job had arrived somewhere we could not hear.

---

**Read-only throughout. Nothing of his was changed.**

## The report

Stored in `business_conversations`, 2026-09-08 19:30:07:

> **Austin Graef:** *"Someone booked me for a clay and seal on 9/15 and im not able to see it?"*

## (a) Does the booking exist? **No. Nowhere.**

| where I looked | result |
|---|---|
| `booking_requests` for graefs-autocare | 11 rows, newest **2026-09-05**. None on 9/15, none named clay or seal. |
| `jobs` for graefs-autocare | **2 rows**, both `completed`, Aug 5 and Aug 6 |
| `marketplace_bookings` | 0 |
| `google_calendar_events` | 0 |
| **`booking_requests` across the ENTIRE database, `service_name ilike '%clay%' or '%seal%'`** | **0 rows** |

No booking for that service exists for any business, at any time. Nothing was deleted either —
`superseded_by` is null on all 11 of his rows.

## (b) Can he see it now? There is nothing to see.

Not a surface problem. His day, his jobs list and his booking list are all correct: they show what
he has, and he has no 9/15 booking.

## (c) What Hubly told him — **verbatim, and it was TRUE**

> *"I don't see a 9/15 clay and seal booking in the records I have. I can see six bookings: Austin
> has two pending bi-weekly memberships with no date, Alexandria has a Full Detail on Aug 10,
> Leslie has Premium Details on Aug 5 at 11:00 and 3:00, and Austin has a Full Detail on Aug 6 at
> 10:00 — but nothing for clay and seal on 9/15."*

**Checked row by row against the table: every claim is correct.** Six bookings is right, the names
are right, the dates and times are right — and it correctly **excluded the five abandoned
"Test Customer" rows** from 2026-09-05 rather than padding the count with them.

**We did not answer a real support question with something false or empty.** It said what it could
see, said plainly what it could not, and did not invent a reason. This is the system working.

His first question got an equally honest answer — *"a full rebuild can make the whole thing look
and read different; small edits should only change the specific words or item you asked for. What
changed that you didn't want changed?"* — and **he never replied**, so we do not know what he
meant. That thread is unresolved, not mishandled.

## (d) Is this a live incident? **No.** (Confirmed by Adrian: never a real booking.)

The booking never entered Hubly through any path. His site had 1–2 visitors on 6–8 September and
no booking flow was started (the abandonment path demonstrably works — it recorded five test
abandons on 2026-09-05). So the most probable account is that **the customer booked him
off-platform** — phone, text, or Instagram (`@Graef.Autocare`), all of which he uses — and he
expected Hubly to know.

**That is not lost data. It is a missing intake path**, and it is the exact one we built six days
too late:

> `business.addJob` — *"Jobs arrive in a text message. 255 job rows exist and every one came
> through the booking path or was typed into the operator app; an owner holding a text has no way
> in."* Shipped 2026-09-14/15. On 2026-09-08 it did not exist.

**RESOLVED:** there was no such job. The reasoning below was the right reasoning on the evidence
available, and the conclusion it reached — "not lost data, a missing intake path" — is the part
that turned out to matter.

## What I did not do, and what I would need

- **Changed nothing.** Read-only, as instructed.
- I **cannot** rule out that a booking was attempted and the write failed leaving no trace. What
  would settle it: a failed-write counter on the booking path. There is none — a booking that
  throws before its INSERT is invisible to us, which is its own finding and is not measured
  anywhere.
- I did not contact him or write a job on his behalf. **Creating a job from a customer's
  recollection is inventing a record** — the same rule as an invented price, and it is his to
  confirm.

## The one thing worth offering him

He can now paste it. *"clay and seal for [customer], 9/15 at [time], [address], $75"* creates the
job, and the card opens in his thread. That capability is live and he has never been told it
exists — which is a separate gap: **a capability nobody announced is a capability nobody has.**
