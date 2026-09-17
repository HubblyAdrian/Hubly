# Privacy Notice — DRAFT · **FOR LEGAL REVIEW** · NOT PUBLISHED

> **This is a draft written by reading the code and the database, not by filling in a template.**
> Every factual claim below was checked against the schema or the running product on **2026-09-16**,
> and the places where the code does something a template would not have guessed are marked
> **⚠ REVIEW**. Nothing here has been reviewed by a lawyer. It must not be published, linked, or shown
> to a customer in this state.
>
> **Where this draft says "we do not", that is a statement about the code as it stands today.** If a
> feature lands that changes it, this document is wrong until it is edited — the list at the end names
> the ones already planned.

---

## 1. Who is who

Hubly has **two kinds of people in it**, and almost every question below has a different answer
depending on which one is asking.

- **The business owner** — the person who signs up, builds a site, and runs their business in Hubly.
  Hubly is their software.
- **Their customer** — a member of the public who visits the business's site, sends a booking request,
  or joins a membership. **Hubly is not their software.** Hubly holds their details *on behalf of the
  business*, the way a paper appointment book would.

**⚠ REVIEW:** this is the controller/processor split and it needs the right words for the right
jurisdictions. The structure is accurate to the code; the labels are not chosen.

---

## 2. What Hubly stores about a **business owner**

| what | where | note |
|---|---|---|
| Name, email, and the account itself | Supabase Auth + `businesses.owner_id` | |
| Business name, tagline, slug, phone, email, city, about, brand colours, logo, banner, social handles | `businesses` | These are **published on their site by design** |
| Opening hours | `settings_business_hours` and `businesses.meta` | two stores, one fact |
| **Every message in the Hubly conversation** | `business_conversations` (`role`, `content`, `seq`, `created_at`) | see §5 |
| Their services and prices | `services` and `businesses.meta.service_catalog` | |
| Jobs, tasks, customers, memberships | `jobs`, `tasks`, `customers`, `memberships` | |
| Every published version of their page | `business_documents` (`rendered_html`) | **633 versions across 179 businesses** today |
| When Hubly asked for a fact and did not get it | `capture_miss_events` (`asked_for`, `outcome`) | a product-quality record, no personal content |
| Stripe Connect account reference | `businesses` | Hubly never sees card numbers |

## 3. What Hubly stores about **a customer of a business**

| what | where |
|---|---|
| Name, phone, email | `customers`, `booking_requests` |
| What they asked for, when, and where | `booking_requests` (service, addons, date, time, **address**) |
| Vehicle details, where the business asks for them | `customers`, `booking_requests` (type, year, make, model, colour) |
| Free-text notes they typed | `booking_requests.notes`, `customers.notes` |
| Messages sent to a business's site chatbot | `chatbot_messages` |
| Membership enrolment and next due date | `memberships` |
| Payment references — **never card details** | `stripe_checkout_session_id`, `stripe_payment_intent_id`, amounts |

### 3a. **⚠ REVIEW — a booking that was never submitted is still stored**

If someone starts a booking and leaves without finishing, **what they had already typed is kept** and
shown to the business as a lead. This is deliberate, and the visitor is told so **on the screen where
they type it**, in these words:

> *"If you don't finish, whatever you've filled in goes to {business} so they can follow up."*

The values are stored **exactly as typed** — not normalised, not corrected, not completed. A row is
written only when there is a **name, or a phone number, or an email address**; a row with none of
those is refused outright.

Also stored on that row: **how far they got** in the booking form (which of four steps), and whether
they left a way to be reached. **Not stored:** anything about who the visitor is beyond what they
typed, no browsing history, no page views.

### 3b. **⚠ REVIEW — a per-browser identifier for deduplication**

One opaque random value (`visitor_key`) is kept in the visitor's own browser storage so that **one
person starting a booking three times becomes one lead instead of three.** It is not linked to any
identity, is never joined to anything else, carries no device or browser information, and exists only
so the business is not shown the same person three times. A visitor who clears their browser storage
gets a new one.

**⚠ REVIEW:** whether this needs cookie-banner treatment where the visitor is in the EU/UK. It is
`localStorage`, not a cookie, and its purpose is arguably strictly necessary — that is a legal
judgement, not ours.

### 3c. **⚠ REVIEW — SMS consent is recorded with the exact words shown**

When a customer ticks the SMS box, Hubly stores the tick, **the timestamp**, and **the exact sentence
that was on screen when they ticked it**. Consent is **optional** — declining does not block a
booking, and the business reaches them by phone and email instead.

**Marketing consent is a separate flag and is never inferred from the booking box.** "Text me updates
about my booking" cannot authorise promotional messages. Today that flag is **`false` on every row**.

**Measured 2026-09-16:** 8 booking requests and 1 customer record carry SMS consent.

---

## 4. IP addresses — one place, one purpose, **24 hours**

Hubly stores the caller's IP address in **one place**, `draft_creation_events`, for **one purpose**: a
rate limit of **10 new draft sites per IP per hour**, so a script cannot mass-create pages. The address
is taken from `cf-connecting-ip` (Cloudflare's single trusted client IP), falling back to the first hop
of `x-forwarded-for`. **It is never joined to a business, a person, or a conversation**, and nothing
else reads the table.

**It is deleted after 24 hours, and the deletion is structural rather than scheduled.** A database
trigger prunes expired rows on every insert — there is exactly one code path that writes this table, so
there is exactly one that prunes, and the two cannot come apart. It is not a job anyone has to remember
to run, and it cannot silently stop.

**This section used to be a ⚠ REVIEW flag.** The limit only ever looked at the last hour, but nothing
was ever deleted: **315 rows going back to 2026-08-21**, every one past its purpose. Fixed
2026-09-16 — the backlog was deleted in the same migration, because otherwise this paragraph would
have been false the moment it was written.

## 5. **⚠ REVIEW — conversations are sent to an AI provider**

Hubly's assistant is not a local program. Messages in the Hubly conversation — and the business facts
they contain — are **sent to a third-party model provider** to produce a reply. Today those are
**Anthropic** (`api.anthropic.com`) and **OpenAI** (`api.openai.com`).

This has to be said plainly, and it has to name what is sent: **the conversation, and the business
record it is about.**

A site visitor's chatbot messages are handled by the same machinery.

**⚠ REVIEW:** provider data-retention terms, whether business data is excluded from provider training,
and whether a sub-processor list is required. **Not asserted here, because it has not been verified in
this round.**

---

## 6. What Hubly does **not** do — each of these is a statement about today's code

- **Hubly never sees card numbers.** Payments go to Stripe; Hubly stores references and amounts.
- **A calendar file (`.ics`) you send is read in your own browser.** It is not uploaded, not sent to a
  model, and not stored — only the events you then choose to add are written to your own records.
- **Hubly does not store a device string, a user-agent, or a browsing history for site visitors.**
- **Hubly does not sell anything to anybody.**
- **Google Calendar:** where an owner connects one, Hubly stores the event's summary, description,
  location and times (`google_calendar_events`) so it can show their day. **⚠ REVIEW — this can
  include personal, non-business events**, and an owner should be told that before they connect. The
  table holds **0 rows** today.

---

## 7. **⚠ REVIEW — not written, because it is not built**

A template would supply these paragraphs and they would all be false.

- **Deletion and export.** There is no "delete my account" path and no data-export path in the
  product. Deletion today means a manual database operation. **A privacy notice must not promise a
  self-service right that does not exist**, and this draft therefore does not.
- **A retention schedule for everything else.** The IP table now expires its own rows (§4), and that
  is the only thing that does. **Conversations, page versions, booking requests and customer records
  are kept indefinitely.** That is stated rather than dressed up: there is no schedule, and a notice
  that implied one would be false.
- **A sub-processor list.** Supabase, Vercel, Cloudflare, Stripe, Anthropic and OpenAI are all in the
  path. That list is assembled from the code, not audited, and the contracts behind it have not been
  reviewed in this round.
- **Cookie/consent banner behaviour.** §3b is the only browser-storage item this draft is confident
  about.
- **Children.** Nothing in the product addresses age.
- **International transfer.** Not assessed.

---

# Terms of Service — DRAFT · **FOR LEGAL REVIEW** · NOT PUBLISHED

## A. What Hubly is

Hubly builds and runs a website, a booking flow and a customer record for a small business. The
business owner is the customer. **The site's content — its words, prices, photos and offers — belongs
to the business owner**, including the parts Hubly's assistant drafted.

## B. **⚠ REVIEW — what Hubly generates, and who is responsible for it**

Hubly's assistant writes copy and can place facts on a live page. **The owner is responsible for what
their site says**, and Hubly's design tries to make that possible rather than theoretical:

- **Hubly does not publish a fact the owner did not state.** A price, a phone number, an address or an
  opening time is written only from something the owner actually said in that exchange — never from a
  default and never from earlier in the transcript.
- Where the assistant cannot ground a value, **it asks instead of guessing**.

**⚠ REVIEW:** this is a genuine engineering commitment, not marketing, and it is enforced by checks in
the build. Whether to state it in a contract — and thereby be held to it — is a legal decision.

## C. Bookings are between the business and its customer

A booking request made through a business's site is **an agreement between that business and that
customer**. Hubly carries the message and keeps the record. **Hubly does not guarantee that a business
will honour a booking**, and Hubly is not the merchant of record for the service.

## D. **⚠ REVIEW — payments**

Where a business connects Stripe, the customer pays **the business**, through Stripe. Deposits and
payment rules are configured by the business. Refunds and disputes are between the customer, the
business, and Stripe.

## E. Acceptable use

A business may not use Hubly to publish content that impersonates another business or person, to
collect payment details under false pretences, or to send messages to people who have not agreed to
receive them. The SMS consent record (§3c) exists so that the second of those is checkable.

## F. **⚠ REVIEW — availability, and what is not promised**

No uptime commitment is made in this draft. **Delivery of notifications is best-effort**: the
in-product record is the source of truth, and where a notification fails to send, that failure is made
visible rather than hidden. That is how the product behaves; whether it belongs in a contract is a
legal decision.

## G. Ending

An owner can stop using Hubly at any time. **⚠ REVIEW — §7 applies: there is no self-service deletion
or export today**, so what happens to the data on termination cannot yet be stated truthfully in a
contract. **This needs to be built before this clause can be written.**

---

## What to do with this draft

1. **Build the two things §7 says are missing** — self-service deletion/export, and a retention
   schedule — or accept clauses that say plainly that they do not exist.
2. ~~Fix the IP retention gap in §4~~ — **DONE 2026-09-16.** Structural, not scheduled, and the
   backlog was deleted with it.
3. **Verify the §5 provider terms** before any sentence about training or retention is written.
4. **Then have a lawyer review it**, with the ⚠ REVIEW markers as the agenda.

**Until the remaining three are done this file stays in `docs/legal/` and is not linked from
anything.** The booking form's Privacy and Terms links no longer claim a notice exists — they say only
what is true and checkable, and when a reviewed notice exists, `openBookingLegal` is the one place
that links to it.
