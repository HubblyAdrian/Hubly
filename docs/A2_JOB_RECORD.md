# A2 — the job record

**Status:** built and checked, 2026-09-16. `npm run check:a2-job-record`
**Ruling:** Adrian, 2026-09-16.

> "Name, address, kind (dropdown from their offers, **CARRYING TYPE** — a quoted offer starts a quote,
> not a booking — or a one-off), price, phone, email, notes. The one-off is first-class and must not
> become a public offer. Leads → Customers → Jobs carries forward; `pickContactInto('customer')` is
> ALREADY OPEN — wire to it, do not build a second. Ground every field with the existing mechanism.
> A job created here appears on My Day with no refresh."

## The dropdown carries the type, and that is the whole point of the form

Every option is one of **his own offers**, read through `get_business_services` — the union reader — so
the form behaves identically on a **classic** and a **freeform** business (ruled 2026-09-16: it reads
the **record**, never the page). Each option carries its sale axis and **says which it is in words**:

| the option | what choosing it does |
|---|---|
| `Full Detail — $85` | a **job**, price pre-filled from his record, editable |
| `Paint Correction — you quote this` | **not a job.** The button becomes **"Start a quote"** *before he fills anything in*, and a line says why |
| `Something else (just this once)` | a **one-off**: a name and a price on this job, and **never** written to the catalogue |

**A quoted offer has no price he has stated**, so writing a job for one means writing an amount nobody
gave us — the fabricated-price defect arriving through a dropdown. The button changing *before* he
types is the point: a button that said "Add the job" and then started a quote would be the
silent-shape-change defect.

**The guard is in the writer as well as the form**, because a guard that lives only in the UI is one
code path away from being bypassed.

## Grounding

- **No default price.** A bookable offer's price is pre-filled **from his own record**; anything else
  starts empty and stays empty. There is no default duration and no invented customer name.
- **A job with no price is allowed** and stays unpriced. `0` is a number nobody states.
- **"abc" is not a price of zero.** `Number('')` is `0`, which is finite and not negative, so the first
  version of the writer turned a typo into a **$0 job**. The cleaned string must contain a digit. *This
  was found by the red-proof, not by reading.*
- Every field is what he typed or what his record held.

## One contact picker, two shells

`pickContactInto` lived in `hubly.html`; A2 is in `platform-home.html`, and two documents cannot call
each other's functions. Building a second `navigator.contacts.select` call would have been the
two-of-everything pattern, so the **capability** moved to **`public/contact-pick.js`** and both shells
load it. `hubly.html`'s `pickContactInto` now delegates to it.

**What is shared and what is not, deliberately:** asking the device and reading what it returns is one
behaviour and there is one of it. *Which fields to fill* stays per-shell — that is correct, not
duplication.

**The parser was rewritten during the build.** The first version split on newlines and treated each
line as one field, which works for a pasted block and **fails on the commonest real input**: a device
contact flattened onto one line (`"Dana Reeves 18015550134 dana@example.com"`) — the email branch
consumed the line and the phone and the name were both lost. It now extracts the two things that have a
recognisable form and treats what is left as the name. **Reachable or nothing:** a name with no phone
and no email returns `null`, because filling a form with a first name and nothing else looks like it
worked.

The "From my phone" button appears **only when the device offers the capability**. A button that cannot
work is worse than no button.

## The door, open in the state where it is needed

The form is part of the **Jobs room in every state — including the empty one**, which is the state
every business in the corpus is in. A jobs room whose only way in is "something else put it there" is a
report. Same reasoning as `hcDayAddRow` on the planner.

## No refresh to see his own change

On success the form **re-reads My Day from the record** (`hcRepaintDay`) rather than patching the DOM.

`hcRepaintDay` now **counts its own runs** and publishes the count on the seam. That is not
instrumentation for its own sake: leg 15 originally asserted only that the function *exists*, which is
true of every possible product **including one that never calls it** — and removing the call went
completely undetected. The counter costs one integer and makes the claim checkable.

## Every outcome says something

Nine distinct sentences, and **none of the refusals claims it was added**:

| | |
|---|---|
| quoted offer | *"You quote Paint Correction, so there's no price to put on a job. Say 'quick quote' and I'll price it with you."* |
| no kind | *"Pick what the job is first."* |
| no one-off name | *"Tell me what the work is and I'll put it on this job only."* |
| no name | *"Whose job is it? I need a name."* |
| bad price | *"I couldn't read that price, so nothing was saved."* |
| signed out | *"You're signed out, so I couldn't write that."* |
| **written but unreadable** | *"I saved that but couldn't read it back, so I'm not going to tell you it's on your day."* |
| success | *"Added — Today at 2:00 PM: Dana, Full Detail, $85."* |
| success, one-off | …*"That one stays on this job only — it isn't added to your services."* |

## Leads → Customers → Jobs

`quotes` already carries `lead_id`, `customer_id` and `became_job_id` (`docs/THE_QUOTE.md`). **NOT
BUILT and named:** A2 does not yet pre-fill from a lead row — the contact picker fills from the
*phone*, not from `booking_requests`. The link exists in the schema; the pre-fill from a lead is a
button on the lead panel and is not in this round.

## The check

`scripts/check-a2-job-record.mjs` — **17 legs, `[RULE]`.** Served over **HTTP**, because
`/contact-pick.js` is a root-absolute script that never arrives under `file://` — and the shared
capability is part of what is being checked.

**One harness bug this exposed:** `servePublic` mapped URL paths straight to filenames, so a request
for `/platform-home` (a real route, not a file) returned a **404 body** — and the check then reported
*"no seam on the page"*, which is a check failing to find a page and blaming the product. The server
now knows the router's extensionless routes.

**Red-proofed, ten breaks, each asserted to have applied and each run.**
