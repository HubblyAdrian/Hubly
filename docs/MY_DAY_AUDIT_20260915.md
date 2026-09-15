# My Day — audit against the approved design, before a line is built

`docs/design/my-day-2026-09-15-approved.png` · spec `docs/MY_DAY.md` · required by MY_DAY.md §2.

**Six near-misses this week from building what already existed. This is the sixth chance not to.**

Verdicts: **EXISTS** (built and working) · **RENAME** (built, wrong words or wrong shape, no new
mechanism) · **NEW** (genuinely does not exist).

---

## LEFT RAIL — Home · My Day · Website · Settings

| element | verdict | what is there |
|---|---|---|
| the rail itself | **EXISTS** | `hcRenderRail`, `HC_PLACE_SURFACES`, `hcWorkspaces()` |
| "My Day" as a rail item | **RENAME** | the surface is `planner`; the *label* in `HC_PLACE_SURFACES` says **"Planner"**. The design says **My Day**. One string. |
| appears when the owner ENTERS it | **EXISTS** | `business_places` + the screen-2 offer/announce shipped today (`d46cf68`) |
| Settings in the rail | **RENAME** | Settings exists as a **gear popout** (`hcStripeApi` / the account menu), not a rail row |
| nothing else in the rail | **RENAME** | `HC_PLACE_SURFACES` also holds `jobs` and `customers`. The design says four items. **This is a ruling to confirm, not a bug** — jobs and customers become thread views, which they already are. |

## LEFT PANEL — "Ask Hubly" beside the day

| element | verdict | what is there |
|---|---|---|
| a conversation panel | **EXISTS** | the whole Home thread — composer, messages, cards |
| greets by name | **EXISTS** | `hcOwnerFirstName` → `hcOwnerLabel`, one reader, checked |
| one sentence of what it can do | **EXISTS** | the arrival's intro line |
| **five fixed openers** | **NEW** | `hcRenderSuggestions` renders chips, but they are **state-gated promises** (`HC_HOME_PROMISES`), not these five. The mechanism exists; this list does not. |
| composer at the bottom | **EXISTS** | |
| **"Hubly uses your real data. I won't make up information."** | **NEW** | nowhere in the product. One permanent line. |

## CENTRE — the day is the hero

| element | verdict | what is there |
|---|---|---|
| date heading | **EXISTS** | `hcDateUS` / `hcDayLabel` |
| "Good morning, Adrian" | **EXISTS** | `hcTimeGreeting()` + the name reader |
| **dynamic context line** ("You have 2 things that really matter…") | **NEW** | must be computed from real bands; §9 forbids inventing urgency |
| **"Add a task…" composer with examples** | **RENAME** | `hcDayAddRow` exists and **writes and reads back** (`create_task` → `get_business_tasks`). It is a time/what/where row, not a one-line composer with examples. |
| **"Move something…" composer** | **NEW** | `update_business_job` moves a JOB; **nothing moves a TASK.** `roll_task` exists and **has no caller** |
| **A/B/C bands, always rendered** | **NEW** | `hcRenderPlanner` groups by DAY, not by band. The data is there (`tasks.band`) and the grouping is not. |
| band words, disc, tinted strip, count | **RENAME** (words) + **NEW** (chrome) | `hcBandLabel` shipped today; the disc/strip/count are new markup |
| **empty band lines** | **EXISTS as of today** | `HC_BAND_EMPTY`, Adrian's three sentences verbatim |
| row = checkbox · time · icon · title · detail · lane pill · chevron | **RENAME** | `hcRoomRow` renders when/title/sub/tail and opens a panel. **No checkbox** (`set_task_status` exists, uncalled), **no icon**, **no chevron**. The row is not a coloured card today — that part is already right. |

## RIGHT — context, not a second dashboard

| element | verdict | what is there |
|---|---|---|
| Today at a glance — Jobs · Personal · Total | **RENAME** | `hcLoadHomeCounts` counts jobs/customers/sales/bookings. Not these three splits. |
| **Day complete ring** | **NEW** | and §4 binds it: a glance, **never "7/10"** |
| **Today's schedule, plain 12-hour list** | **RENAME** | `hcRenderPlanner`'s day rows are exactly this, grouped by day; `hcTimeUS` is the formatter |
| **AI Suggestions, each with its reason** | **NEW** | nothing generates them. §9 + the README bind every reason line to the record. |

---

## THE ONE THING THE AUDIT CHANGES

**The centre and the right are two projections of one set of items** (Adrian, 2026-09-15) — the
centre filters to "needs a decision" and groups by band; the right filters to "has a time" and
orders by it. `Full Detail — John` is one item rendered twice.

**Today there is exactly one loader that returns both kinds:** `hcRenderPlanner` already calls
`hcLoadJobs` **and** `get_business_tasks` and merges them. **That is the single source the ruling
asks for, and it already exists.** What it lacks is the two projections over it.

**So do not write a second loader.** Extract `hcRenderPlanner`'s merge into one reader; give it
two filters. If a second `load` appears, that is the two-store mistake in a new costume.

---

## WHAT IS GENUINELY NEW — the honest short list

1. A/B/C grouping over the existing merged reader (the data exists; the projection does not)
2. Checkbox / icon / chevron on the row — and **wiring `set_task_status`, which is built and has
   no caller**
3. The "Move something…" composer — and **wiring `roll_task`, built, no caller**
4. The dynamic context line, from real bands
5. The day-complete ring
6. AI Suggestions with grounded reasons
7. The five fixed openers
8. The honesty footer line

**Three of those eight are wiring something that already exists and nothing calls**:
`set_task_status`, `roll_task`, and (parked) `get_task_progress`. That is the seventh, eighth and
ninth instance of built-and-doorless inside this one screen.

---

## WHAT THE AUDIT SAYS ABOUT ORDER

Confirming the ranking already ruled, with the reason from the audit:

- **The bands are cheap** — the data is in `tasks.band`, the merged reader exists, the empty
  sentences are in. This is a projection, not a feature.
- **The right column is expensive and not because of code** — it is empty for 39 of 41 businesses
  (`docs/MY_DAY_TIMELINE_MEASURED.md`). Recurrence and import fill it; polish does not.
- **The checkbox is the highest-value single wire on the screen.** A day you cannot tick is a
  report. `set_task_status` is already written, tested by its own migration, and called by nothing.
