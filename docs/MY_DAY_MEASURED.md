# What My Day would actually render today — measured before a line of UI

**2026-09-13/14, from the live database.** Adrian's instruction: *"Before you propose a single
line of UI, measure what the screen would actually show today, for real businesses… Measure
first, propose second."*

## The answer for the only paying customer: three empty bands and an empty calendar

| | graefs-autocare (**market**) | evergreen-yard-care | adrians-lawn-service | hubly-classic-fixture |
|---|---|---|---|---|
| tasks, all time | **0** | 0 | 0 | 0 |
| tasks due today | **0** | 0 | 0 | 0 |
| tasks with an A/B/C band | **0** | 0 | 0 | 0 |
| jobs, all time | 2 | 0 | 1 | 0 |
| **jobs scheduled today** | **0** | 0 | 0 | 0 |
| bookings, all time | 11 | 0 | 2 | 0 |
| bookings today | **0** | 0 | 0 | 0 |
| Google Calendar connections | **0** | 0 | 0 | 0 |
| Google Calendar events | **0** | 0 | 0 | 0 |

**Graef's two jobs are dated 2026-08-05 and 2026-08-06** — five weeks ago. Nothing of his is
scheduled for today, and nothing ever has been since.

## Corpus-wide, and the numbers are starker

| | count |
|---|---|
| `tasks` rows **in the entire product** | **0** |
| tasks carrying an A/B/C band | **0** |
| businesses with any task at all | **0 of 197** |
| `google_calendar_connections` **in the entire product** | **0** |
| `google_calendar_events` | **0** |
| `jobs` rows | 255 |
| businesses with any job | **4 of 197** — and **250 of the 255 jobs are `hubly-paging-fixture`**, seeded by us this session |
| jobs scheduled for today, anywhere | **2** — both `canyon-ridge-tree-care` (test) |

**Real, non-fixture jobs across the whole product: 5.** Two Graef (August), two
canyon-ridge-tree-care (test, today), one adrians-lawn-service (August).

## What this means for the design question

**The spec's central screen — A/B/C bands filled with today's jobs, tasks and calendar events —
has no data behind it for anyone, and never has.** Not "sparse". Zero. The A/B/C model exists as
three columns on a `tasks` table that has never held a row, and `capture_planner_item` is its
only writer.

So the design question the spec assumes — *how do we lay out a busy day* — is not the question
in front of us. **For every business that exists, including the one that pays, My Day on day one
and My Day today are the same screen: empty.**

Three consequences, stated before any UI is proposed:

1. **The empty state is not an edge case, it is THE state.** It deserves the design attention the
   spec gives to the full day. "Progressive complexity" (§16) is not a nicety here; it is the
   entire first release.
2. **The first job of My Day is to CREATE the first item, not to arrange existing ones.** A
   screen that renders three empty bands and waits is a guilt machine with no input — the exact
   thing §4 warns against, arrived at from the opposite direction.
3. **Jobs and calendar cannot carry the screen.** Google Calendar has zero connections product-wide,
   so §6's "if Google Calendar is already connected, use the existing integration" resolves to
   "never, today". And a job appears in a day only if it is scheduled for that day, which has
   happened twice, for a test business.

**This is tonight's pattern once more, in both directions at once:** the plumbing is further
along than expected (a `tasks` table with `band`, `band_source`, `band_reason`, `lane`,
`rolled_from`, `roll_count` — a considered schema, and a `capture_planner_item` writer), and the
data is emptier than expected (not one row). The capability is built and unlit, and the screen
that would light it has nothing to show.

**Measured. No UI proposed yet.**
