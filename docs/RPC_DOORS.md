# Every database function we ship, and whether anything can reach it

`node scripts/measure-rpc-doors.mjs` · measured 2026-09-15

## Why this exists

**"Look for the missing door before building the room" has now been the right diagnosis five
times.** The photo upload, the inline image editing, the trade-aware booking wizard and Stripe
Connect — all four built, all four unreachable, all four found in one night. Then on
2026-09-15, `update_business_job`: written, applied and live-tested the night before, refusing
`not_owner` / `no_job` / `no_change` correctly, and appearing **nowhere** in
`supabase/functions`. The owner typed *"change the driveway job to 3 PM"* twice and got
silence both times.

`measure-capability-doors.mjs` could not have caught it. It scans exported **functions** in
`_shared`. An RPC lives in a **migration**, and a migration that ships a working function
nothing calls was invisible to every check we owned. Five instances is a class, and a class
gets a measurement instead of a sixth anecdote.

## What counts as a door

A caller anywhere that names the function: an edge function, the browser monolith, a script, or
a `cron.schedule` in a migration. **The name match is deliberately generous** — it over-counts
doors and under-counts the problem, which is the safe direction for a list whose whole purpose
is "these have nothing".

## The numbers

```
database functions defined in supabase/migrations: 135   (migrations scanned: 230)

  REACHABLE (named by edge, client, a script or cron)   80
     scheduled in pg_cron (a cron is the caller)         5   <- maintenance, correctly has no UI
     edge                                               46
     client (public/)                                   39
     a script only                                       2   <- measured, never used by the product
  TRIGGERS (correctly have no caller)                    20
  CALLED FROM SQL ONLY (an internal step)                 3
  NOTHING NAMES THEM, ANYWHERE                           32   <- the missing-door list
```

**26 of the 32 are `_debug_*` and one-off repair functions from July** — `_debug_tier_grants_check`,
`_resync_todds_gen_content`, `_backfill_apply_meta` and so on. They were written to answer a
question once and they are correctly dead. They are not the finding; they are the noise the
finding sits in, and they are named here so nobody re-derives that.

## The six worth reading

| function | migration | what it is |
|---|---|---|
| `get_task_progress` | `20260909160000_tasks.sql` | **the same shape as `update_business_job`** — shipped with the tasks work, never called. My Day has no progress read. |
| `hubly_derive_slug` | `20260910080000_derive_slug_minimal.sql` | slug derivation |
| `hubly_slug_available` | `20260909200000_name_and_slug.sql` | is this slug free |
| `set_business_name_unset` | `20260909200000_name_and_slug.sql` | clear a name |
| `mark_business_test` | `20260823140000_mark_test_accounts.sql` | `account_kind` tooling — plausibly deliberate, an operator action |
| `names_corroborate` | `20260806160000_supersede_abandoned_bookings_on_resume.sql` | booking supersede helper |

**And two reached only by a script**, which means the product cannot use them:
`seed_business_places`, and `append_business_conversation` — the latter is **correctly dead**,
superseded by `append_my_business_conversation` / `append_draft_business_conversation` when the
conversation write moved from the edge to the client. Verified by grep, not assumed.

## Two corrections this sweep made to itself, recorded because both are the usual failure

1. **`pg_cron` is a caller and it lives in the database, not the repo.** The first run listed
   `purge_model_calls`, `purge_placement_outcomes`, `purge_first_turn_text` and
   `sweep_stalled_document_builds` as dead. All four are scheduled — `select * from cron.job`
   shows them running daily, and the sweep every two minutes. A detector that reports four
   working maintenance jobs as dead is a detector that gets muted, and a muted list is worse
   than no list.
2. **The fix for (1) was then too greedy.** Splitting on `cron.schedule` and keeping everything
   after it meant any function defined lower in a migration containing a schedule was read as
   scheduled — it silently rescued `append_business_conversation`, which a grep proves has no
   caller at all. Over-matching is not "the safe direction" here: it turns a missing door into
   a green row. The match is now the `cron.schedule(...)` call itself and nothing else.

Both are the same mistake in opposite directions, and both were caught by cross-checking one
row against a grep rather than by reading the output and believing it.
