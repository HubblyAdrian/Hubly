# Every database function we ship, and whether anything can reach it

`npm run measure:rpc-doors` · guarded by `npm run check:rpc-doors` · measured 2026-09-15

## Why this exists

**"Look for the missing door before building the room" has now been the right diagnosis six
times.** The photo upload, the inline image editing, the trade-aware booking wizard and Stripe
Connect — four in one night. Then `update_business_job`: written, applied and live-tested the
night before, refusing `not_owner` / `no_job` / `no_change` correctly, and appearing **nowhere**
in `supabase/functions`. The owner typed *"change the driveway job to 3 PM"* twice and got
silence both times. Then `get_task_progress`, found by this sweep rather than by a person.

`measure-capability-doors.mjs` could not have caught any of it. It scans exported **functions**
in `_shared`. An RPC lives in a **migration**, and a migration that ships a working function
nothing calls was invisible to every check we owned.

**It is a check now, not a report.** Adrian's ruling: *"A function shipped with no caller should
fail a check on the day it lands, not be discovered six times by accident."*
`scripts/check-rpc-doors.mjs` holds the three current entries as a recorded baseline with a
reason each; the number may not go up without the new name being justified there.

## The numbers

```
database functions defined in supabase/migrations: 109   (migrations scanned: 230)

  REACHABLE (edge, client, a script or cron)           77
     scheduled in pg_cron (a cron is the caller)        5   <- maintenance, correctly has no UI
     edge                                             45
     client (public/)                                 39
     a script only                                     0   <- measured, never used by the product
  TRIGGERS (a create trigger is the caller)           22
  CALLED FROM SQL ONLY (an internal step)               7
  NOTHING NAMES THEM, ANYWHERE                          3   <- the missing-door list
```

Buckets are disjoint: 77 + 22 + 7 + 3 = 109.

## The three with no caller, read one by one

| function | what it does | verdict |
|---|---|---|
| `get_task_progress` | `N of M done today` for My Day — counts `tasks` for a day, owner-gated | **(i) an owner would want it and cannot reach it.** The sixth instance of the shape. **Deliberately not wired** — this list is for choosing from, not for me to pick. |
| `mark_business_test` | flips `account_kind` to `test` for a draft, authorised by its draft token | **(iii) dead.** Its own migration comment says "our test tooling calls this"; no such caller exists any more, and `account_kind` is set at claim time (`20260825130000`). |
| `append_business_conversation` | the original service-role writer for `business_conversations` | **(ii) superseded.** The write moved to the client: `append_my_business_conversation` (claimed) and `append_draft_business_conversation` (draft) are live and carry all the rows, including the 16 from the 2026-09-15 walk. Verified by grep. |

**Three more were on this list yesterday and should never have been.** `hubly_derive_slug`,
`hubly_slug_available` and `names_corroborate` are all called from SQL — two trigger functions,
`set_business_slug`, and the supersede statement respectively. `set_business_name_unset` was a
fourth, and it does not exist at all: it was dropped on 2026-09-10. A list of six "worth
reading" contained four already wired or gone.

## Four corrections this sweep made to itself

Recorded because every one is the same failure — a detector believed without being cross-checked
against a single row — and because the first report off this file was wrong.

1. **`pg_cron` is a caller, and it lives in the database, not the repo.** The first run listed
   four working maintenance jobs as dead. `select * from cron.job` shows them running daily.
2. **The fix for (1) was too greedy.** Splitting on `cron.schedule` and keeping the rest of the
   file marked any function defined below a schedule as scheduled — it silently rescued
   `append_business_conversation`, which a grep proves is dead.
3. **A `drop function` is by SIGNATURE; this tracking is by NAME.** Deleting the name on any drop
   made `update_business_job` — which exists in `pg_proc` and which the product calls — vanish
   from the sweep entirely. A sweep that forgets a live function is worse than one that lists a
   dead one: the dead entry is noise you read past, the missing entry is a door you are never
   told about.
4. **THE WORST ONE: the sweep silenced itself.** `check-rpc-doors.mjs` carries the doorless names
   in its BASELINE, with the reason each is tolerated. Because the sweep scans `scripts/`,
   writing that baseline gave every entry a "script" door, the list emptied, and the check went
   green while reporting nothing. **Naming a thing in order to say it is unreachable must never
   make it reachable.** Both files are excluded from the caller scan now.

An instrument that is silenced by being used reads exactly like success. All four were caught by
checking one row against a grep rather than by reading the output and believing it.
