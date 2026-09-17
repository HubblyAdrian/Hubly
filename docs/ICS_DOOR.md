# The .ics door — no Google, no OAuth, no policy

**Status:** built and checked, 2026-09-16. `npm run check:ics-door`
**Ruling:** Adrian, 2026-09-16 — *"No Google, no OAuth, no policy. Same door as the screenshot,
`HC_FILE_ROUTES` routes it. Verify the empty-state offer picks the clause up BY ITSELF."*

## Why there is nothing to authorise

A calendar export is a **file**, and Hubly already has a door for files. He exports his calendar and
sends it, exactly as he sends a photo of a paper schedule.

**It is parsed in his own browser.** `FileReader` reads it, `hcParseIcs` parses it, and it is never
uploaded, never sent to a model, and never leaves the page. That is not a privacy feature bolted on
afterwards — it is why this door needs no consent screen, no OAuth flow and no policy text. The
Google Calendar path still exists for people who want live two-way sync; this is the one for people
who just want their week on the screen.

## The route declares what it takes

```js
day: { send: …,                        // a photo or a PDF of a schedule
       acceptsPdf: true,
       acceptsIcs: true, ics: … }      // a calendar export
```

`hcRouteAccepts(route, kind)` is the one reader, and `hcFileKind(file)` decides what arrived —
**by type or by extension**, because a `.ics` comes through as `text/calendar` on some systems,
`text/plain` on others, and `''` from a few Android pickers. The extension is not a fallback here, it
is a co-equal test.

**The refusal is derived too.** `hcHandleIncomingFile` used to say *"I can work with images and
PDFs"* as a literal. The day the ics route landed, that sentence would have been a lie in the other
direction — refusing a file it can now read and telling him so. The list comes from the routes:

> I can work with images, PDFs and calendar files (.ics) — that one I can't read.

And the attach picker's `accept` gained `text/calendar,.ics`, because a door the file picker will not
open is not a door. That attribute is markup the router cannot reach, so the check asserts the two
agree rather than pretending it is derived.

## What the parser does, and what it refuses to guess

| the file says | what lands |
|---|---|
| `DTSTART:20260917T140000` | 2026-09-17, **14:00** — his own clock, as written |
| `DTSTART:20260918T190000Z` | **converted to his clock.** Showing 19:00Z as "7:00 PM" would put a 1pm job on his evening — the 24-hour-clock defect, one timezone further out |
| `DTSTART;VALUE=DATE:20260920` | 2026-09-20, **no time.** Midnight would be a time nobody put in the file |
| a VEVENT with no `DTSTART` | **listed as unreadable, with its own words** — never dropped. A silently skipped event is a commitment he thinks Hubly has and it does not |
| a folded `LOCATION` line | **unfolded.** RFC 5545 wraps long values and continues them with a leading space; a parser that skips unfolding truncates exactly the long addresses that matter |
| `Maple Street\, Building C` | `Maple Street, Building C` — escapes unwound, so his address is not full of backslashes |

**An imported calendar event is HIS time, not a customer job.** `is_block: true`, and no customer
name is invented — a name in a calendar SUMMARY is the event's title, not proof a customer exists.
That is the standing "a row is not evidence of a person" rule applied to a file.

**Nothing is written.** It proposes through the same `hcProposeImportedJobs` the photo path uses, so
the review step and the *"nothing is on your day yet"* promise are identical in both doors — and
every row carries the words it came from, so he can check it rather than trust it.

## The empty-state offer picked the clause up by itself — verified

No copy was written for the calendar. `HC_WAYS.calendar.wired` asks the router whether **this
subject's** route takes an `.ics`:

```
before:  Tell me what’s coming up, send me a screenshot of it, or add it yourself.
after:   Tell me what’s coming up, send me a screenshot of it, send me your calendar file,
         or add it yourself.
```

The only change that produced that sentence was `acceptsIcs: true` on the route. Unwiring the flag
removes the clause again and rewiring restores it, which is leg 13 — the clause is **derived, not
typed**. It is the same mechanism that made the screenshot clause appear when the `day` route landed,
and it is why `check-ways-are-derived` keeps passing without being edited.

## The check

`scripts/check-ics-door.mjs` — **15 legs, `[RULE]`.** The fixture is a real `.ics` and it is awkward
on purpose: CRLF endings, a folded `LOCATION`, a UTC timestamp, an all-day `VALUE=DATE` event, and a
VEVENT with no `DTSTART` at all.

**Red-proofed, eight breaks, each asserted to have applied and each run:**

| break | went red |
|---|---|
| line unfolding removed | 5 |
| a UTC timestamp treated as local | 7 |
| an all-day event given `00:00` | 8 |
| an undateable event dropped | 9 |
| a customer name invented | 10 |
| an imported event marked a job | 10 |
| escape-unwinding removed | 6 |
| **the ics route unwired** | **1, 12, 13, 14** |

That last row is the shape of the whole thing: unwiring one route flag turns the offer clause off
**and** the refusal sentence back to "images and PDFs", because neither was written by hand.

One break initially reported no red and the reason was recorded rather than read as coverage: the
replacement string did not match the file (escaped backslashes in a regex literal), so nothing
changed. Re-applied by slicing the function body instead, and leg 6 went red as it should.
