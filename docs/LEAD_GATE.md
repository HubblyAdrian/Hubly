# The lead gate — reachable, not name-and-phone

**Status:** built, checked, and the server half verified against the live database, 2026-09-16.
`npm run check:lead-gate`
**Spec:** `docs/ABANDONED_BOOKING_TRACE.md` (written before the code, and it specified the two
discriminating test legs in advance). **Ruling:** Adrian, 2026-09-16.

## What was broken

Step 3 of the booking wizard refused to advance without a **phone**:

```js
if(!document.getElementById('bk-phone').value.trim()){toast('Enter your phone number');return}
```

and `writeAbandonedBookingRequest` refused on `!name || !phone`. Both labels said `*` while only one
was enforced.

So a visitor willing to leave an **email address** got past nothing and **we stored nothing**. The
lead did not arrive incomplete — *it never existed*. The row the leads list says "no phone or email on
this one" about is a different case entirely (an abandoned row written before an email was typed);
this item is about the people who never got a row at all.

## The gate now

**Reachable = phone OR email.** Name is enrichment — he cannot call "Mike".

One switch, `BK_LEAD_GATE` in `public/hubly.html`, exactly as the trace doc recommended: implement
reachable-only and make the other choice trivially switchable. The form, the writer and the server
all ask the same predicate rather than each testing fields, so they cannot disagree about who counts.

| where | what it does |
|---|---|
| `BK_LEAD_GATE` | `'reachable'` \| `'name_and_phone'` — one constant |
| `bkContactNow()` | reads the three fields **at the boundary**, one reader |
| `bkIsReachable()` | the predicate the form and the writer both ask |
| `bkReachedBy()` | `phone` \| `email` \| `both` \| `none`, in the column's own vocabulary |
| `record_booking_attempt` | asks it again server-side and **stores the answer** in `reached_by` |

The server asks independently and deliberately: a client-side gate is a convenience for the visitor,
never a guarantee, and `reached_by` being stored means no reader re-derives it.

## "Provided" means completed and moved past

Values are read from the form **at the step boundary**, not as keystrokes. The trace doc named the
two legs that separate this from a keystroke capture before either existed:

| | keystroke capture | this |
|---|---|---|
| type a phone, **clear it**, advance → nothing stored | passes | passes |
| type, advance, go back, **clear it**, advance again → stored phone **removed** | **fails** | passes |

The second is the discriminator, and it is why the upsert overwrites the contact fields
**unconditionally** while coalescing earlier-step choices — two different rules, on purpose: a field
not on screen at this boundary is not the visitor clearing it.

Verified against the live database: a second call with an empty phone moved `reached_by` from `both`
back to `email` **on the same row**, and the stored phone was gone.

## Name-only is a signal, never a leads row

A name with no contact is written with `became_lead = false` — **countable**, and kept out of the
list where it would look followable and send him to call someone he cannot call. Nothing at all
(no name, no phone, no email) is refused outright: writing a row would be recording that a browser
existed.

The list filter excludes only an **explicit** `false`. Every row written before 2026-09-16 has
`became_lead = null`, which means *"we did not capture this"* — treating a null as a false would have
silently emptied his list of 141 rows.

## A lead is someone who did not SUBMIT

Measured on the live table: `status` is `abandoned` 141 · `accepted` 130 · `pending` 10.

- `abandoned` → **a lead.** They started and stopped.
- `pending` → **a booking to work.** They submitted; he has not accepted yet. It has its own surface.
- `accepted` → **a job.**

The leads reader asks the database for `abandoned` rather than filtering "not accepted" afterwards —
the old filter quietly included the ten pending bookings and would have shown him one record in two
places with two different meanings. A save-and-exit row is `pending` **by design** (the original
writer's comment: *"Save & exit → pending so it shows under New bookings (not buried as
abandoned)"*), so it is a booking too.

Consequence for the vocabulary: `pending` has **no lead word**, and that is the rule rather than an
omission — a word for a state the list cannot show is a word for nothing. The row's tail carries
**how far they got** instead, which is what actually differs between two rows here and what makes the
phone call honest.

## Dedupe: a burst is one intention

`visitor_key` — an opaque per-browser id, **dedupe only**. Not a person, never joined to anything,
and it carries no device, browser or network fact. One visitor abandoning three times is **one** row:
the same disease as apollo-weeds renaming three times in 108 seconds.

**This had to be server-side, and the reason was already written down in the file.** From the comment
above `writeAbandonedBookingRequest`:

> *"sidestepping the RLS-under-RETURNING gap `booking_requests` has for anon (no SELECT policy,
> confirmed earlier tonight)"*

**Anon cannot SELECT from `booking_requests`.** A browser cannot look for the row it wrote last visit,
so dedupe across reloads is impossible on that side. It is not a preference for an RPC — it is the
only place the lookup can happen. And since the RPC is therefore the write path, it had to carry
**everything** the old insert carried (vehicle, addons, consent) or the move would have silently
dropped facts we already had. It also now carries `addons`, which the old partial insert **did not**.

A browser with storage blocked gets a per-load key, which still dedupes the burst within one sitting
(advance, go back, advance again) and degrades to the old behaviour rather than failing.

## Resolve into the booking — and the defect the gate would otherwise have created

`complete_abandoned_booking` matched the row on **phone digits**. An email-only row stores the marker
`email:someone@example.com`, which has **no digits**. Two consequences:

- Finishing *without* adding a phone: both sides reduce to `''` and the guard passed **by accident**.
- Coming back and **adding** a phone — the same field, one step later — `p_phone` has digits, the
  marker has none, the guard **rejects**, and the caller falls back to a fresh insert. The abandoned
  row stays abandoned and the owner has **two records for one customer**: a lead he chases and a
  booking she already made.

That is a duplicate-lead defect manufactured by the gate we just widened, so it is fixed in the same
round. The match is now: phone digits agree (non-empty), **or** the row is an email row and this
email is the one it holds (trimmed, case-insensitive). And if they added a real phone on the way back,
**the marker is replaced by it** — leaving `email:…` in the phone column of a confirmed booking hands
the owner a booking he cannot call.

**What would make the stricter rule a regression, checked before shipping it:** the "both empty"
accident used to open the door, and requiring non-empty digits closes it. Measured — of **141**
abandoned rows, **0** have a digit-less phone and **0** carry the `email:` marker. No existing row's
behaviour changes.

Verified against the live database, four cases: matching email resolves · wrong email refused
(`contact_mismatch`) · no contact at all refused · came back with a phone resolves **and** the marker
is replaced by the real number. All simulated rows were then deleted; `booking_requests` is back to
**281 rows, 0 with a visitor_key**.

## The visitor's sentence — option 1, and it refuses to say "this business"

> **"If you don't finish, whatever you've filled in goes to {business} so they can follow up."**

Rendered on step 3, with the fields it is about. `bkSetVisitorDisclosure()` **refuses to render at all**
without a real business name and warns instead: slot-filling a placeholder into the one sentence whose
entire job is honesty is the broken-grammar tell the standing rules name, and "goes to this business"
is a disclosure nobody can act on.

Option 3 (*"so they can help if you get stuck"*) stays **rejected permanently** — Adrian: *"a
euphemism in the one sentence whose entire job is honesty is the wrong instinct."* Leg 15 fails if that
wording ever returns.

## Verbatim

Values are stored as the field held them: no normalising, no completing, no "cleaning". There is no
model in this path, and a corrected phone number is a number nobody gave us.

**The one distinction worth stating precisely:** the input mask the visitor *watches* as they type is
part of typing — what they see is what is stored. A silent rewrite between the field and the row is
not, and there is none.

## The check

`scripts/check-lead-gate.mjs` — **18 legs, `[RULE]`, and it writes nothing.** The server half was
verified against the live database once and its rows deleted; a check that writes to a real table
every time anyone runs `npm test` is how a corpus gets contaminated.

**Red-proofed, seven breaks, each applied and each run:**

| break | went red |
|---|---|
| `BK_LEAD_GATE` → `'name_and_phone'` | 1, 3 *(the switch working, as designed)* |
| step 3 demands a phone again | 10 |
| the disclosure becomes the rejected euphemism | 14, 15 |
| the disclosure slot-fills "this business" | 13 |
| the writer sends the **remembered** phone | 8 |
| the partial label reads "Booking confirmed." | 11, 12 |
| the visitor key regenerated every call | 17 |

**An eighth attempt produced no red, and the reason is recorded rather than read as coverage:** the
break never applied. The source uses literal `’` and `—`, not `\u` escapes, so `str.replace` matched
nothing and changed nothing — and "no legs went red" would have read as "the check cannot catch
this". A red-proof now asserts its own break landed. *A break that leaves a leg green has not tested
it; a break that never applied has not tested anything.*

## And a probe bug this round surfaced, worth its own line

`bodyOf(src, "async function writeAbandonedBookingRequest(opts={}){")` returned a body of **two
characters** — `{}` — because it took the first `{` after the declaration and that is the brace of the
**default parameter** `opts={}`. Two absence legs passed vacuously against a window containing no code
at all. `scripts/lib/absence.mjs` now walks the parameter list to its matching `)` first. An absence
assertion over an empty window is the worst false green available: it is green for every possible
product.
