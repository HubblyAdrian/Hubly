# List surfaces — one engine, one row spec per kind

**Status:** built and checked, 2026-09-16. `npm run check:list-surfaces`
**Rule source:** Adrian, 2026-09-16 — "THEY SHARE THE MECHANISM, THEY MUST NEVER LOOK ALIKE …
ONE LIST ENGINE. SIX SURFACES THAT ARE NEVER CONFUSED … one row spec per kind with per-kind
status words." And: "print the current rail and surfaces before adding any row."

## What was there, printed first

**`public/platform-home.html` — the claimed-owner shell, the one Adrian uses.**

| | |
|---|---|
| `HC_PLACE_SURFACES` (a place can exist) | `website`, `jobs`, `customers` — and two comments: *"leads — pending: the unbooked-lead list"*, *"store — pending: the storefront workspace"* |
| `HC_RAIL_DEFAULT` (shown to a new business) | `website` only |
| `HC_ROOMS` (an earned rail row opens something) | `jobs`, `customers` |
| `HC_THREAD_VIEWS` (asking reaches it inline) | `day`, `jobs`, `week`, `customers` — each with `title` / `words` / `load` / `parts` / `open` / `empty` |
| The list engine | `hcRoomShell` + `hcRoomRow` (SETTLED 29 — Adrian was right that there was one) |
| Home | renders My Day; `planner` is a destination, not a surface |

**`public/hubly.html` — the classic app.** 24 `data-v` views, including `quotes` (4 refs), `jobs`
(4), `leads` (2), `memberships`, `pipeline`, `opportunities`. These are the old SaaS shell's views,
not the claimed-owner rail, and they are not what this work touches.

So: **`HC_THREAD_VIEWS` already was the row spec per kind.** What it lacked was status words, a
`leads` kind, and a room that is the *same* spec rather than a second implementation.

## The status vocabulary, and why two kinds are missing from it

Measured against the live database, 2026-09-16, via the admin connection:

| column | values |
|---|---|
| `jobs.status` | `scheduled` 174 · `completed` 85 — **nothing else** |
| `jobs.paid` | `false` 259 — **nothing is ever marked paid** |
| `booking_requests.status` | `abandoned` 141 · `accepted` 130 · `pending` 10 |
| `memberships` | the table exists and holds **no rows** |
| `quotes` | **no such table** |

The counts are corpus-wide and mostly ours. What they establish here is the **vocabulary**, which is
all a word table needs from them.

```
HC_STATUS_WORDS = {
  job:  { scheduled: 'Booked',          completed: 'Done' },
  lead: { pending:   'Waiting on you',  abandoned: 'Didn’t finish booking' }
}
```

**A lead is not "pending" the way a job is.** A pending lead means *someone is waiting for you to
answer*; a scheduled job means it is on the calendar and nobody needs anything. One shared word
across both lists would flatten the only difference that matters to him — and the whole reason the
lists exist separately is that they demand different actions. Leg 2 fails if any word appears under
two kinds.

**`accepted` is deliberately not in the lead vocabulary.** An accepted request is a job. The reader
filters it out rather than giving it a word, so one record never looks like two pieces of work.

**There is no `quote` entry and no `membership` entry, and leg 3 asserts the absence.** Words for a
record that has never existed are invented words — the enumerate-the-valuable-side mistake, written
down in advance. Adrian's own ruling: *do not build on it until we have one.* When the first
membership lands, its real values decide its words.

**An unrecognised value is echoed, never renamed.** `hcStatusWord('job', 'snoozed')` returns
`"snoozed"`, not a friendly guess. Echoing what the table says is honest; inventing "In progress"
for a token we have never seen is not.

## The room is a projection of the spec

`hcRoomFromView(key)` renders a kind's spec full-width instead of in the thread. Before this,
`hcRenderJobs` and the `jobs` thread view each computed their own `tail`, so **the same job read
differently in two places for no reason anyone chose** — and the room was printing `j.status ||`
raw, putting `scheduled` / `completed` in front of the owner. That is the band-words defect: our
storage vocabulary reaching a person.

They still never look alike, because the differences live in the **spec**: the leads list leads with
whether you can reach them, the jobs list leads with when it is. Engine shared; vocabulary per kind.
That is the distinction Adrian was drawing.

## Leads: the surface was missing, not the data

`booking_requests` holds `pending` rows (they asked, nobody answered) and `abandoned` rows (they
started the form and stopped, contact details already written by `writeAbandonedBookingRequest`).
SETTLED 28 corrected the premise that this path leaves no trace.

- `leads` is now in `HC_PLACE_SURFACES`, which is what makes it **earnable** — `hcWorkspaces`
  ignores a `business_places` row whose kind has no surface, so a place that is not in that map can
  never be earned no matter what the owner asks for.
- It is **not** in `HC_RAIL_DEFAULT`, so it appears only once he has asked and said yes to keeping
  it. Same as Jobs and Customers; progressive navigation unchanged.
- It has **its own icon**. Jobs and Store both fell back to the website drawing once, and a new tab
  arrived wearing the wrong picture — undercutting the exact moment the mechanic exists for.
- The row's sub-line is **whether you can reach them**, and says *"no phone or email on this one"*
  when you cannot, rather than leaving the space blank. That is the lead-gate problem stated at the
  surface: the booking form requires a name **AND a phone**, so it collects nothing from someone who
  would have left an email. **The gate itself is not fixed here** — that is Adrian's item 6 and a
  separate change.
- `hcLeadPanel` shows every field the record holds, plus call and email. **It invents no action** —
  no "send a quote", no "mark as won", because neither has anywhere to write.
- The count is **his own rows in his own words** ("3 people"), never a corpus figure. The corpus
  number is unusable: 141 abandoned rows of which 125 are the paging fixture and 13 of the remaining
  16 fall inside one 13-minute window across three businesses.

## Not built, and why

| kind | why not |
|---|---|
| **QUOTE** | No `quotes` table. A row spec would describe a record that cannot exist, and a list would be a door to nothing. Adrian's item 5 builds the quote itself; its row spec belongs with it. |
| **MEMBERSHIP** | The `memberships` table has never held a row, so there are no real status values to name. The membership **offer** half is fully built (see `docs/OFFER_TYPE.md`) — it is the *instance* that has no data. |

## The check

`scripts/check-list-surfaces.mjs` — **14 legs, `[RULE]`.** No leg asserts a count of kinds or a
layout: adding a fifth list goes green as long as it brings its own words, its own icon and a
destination, which is the cost this check exists to impose.

**Red-proofed, six breaks, each run:**

| break | went red |
|---|---|
| leads says "Booked" like jobs | 2, 6 |
| `hcStatusWord` invents "In progress" | 4 |
| a `quote` vocabulary is added | 3, 4 |
| leads added to `HC_RAIL_DEFAULT` | 9 |
| `HC_ROOMS.leads` removed | 7 |
| leads reuses the jobs icon | 8 |

Leg 8 first went red as **"4 places, 1 distinct icons"** against four genuinely different drawings:
the probe had sliced each icon to 60 chars and was measuring the shared `<svg viewBox="0 0 24 24"
fill="none" stroke="currentColor" st` boilerplate. A probe that cannot tell identical from
same-prefixed is measuring its own truncation.
