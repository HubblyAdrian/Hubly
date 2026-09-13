# My Day — architecture audit and plan (2026-09-13)

**Responds to `docs/MY_DAY.md` (Adrian's spec, verbatim). AUDIT ONLY — no UI written, no
production behaviour changed, no migration executed.** Section 18 says stop; this stops.

---

## 1. CURRENT ARCHITECTURE

### A. Planner — real, not placeholder, and narrower than the spec

| | |
|---|---|
| **UI** | `hcRenderPlanner(canvas, biz)` — `platform-home.html:4661`. Heading **"Your day"**, sections TODAY / TOMORROW / TO DO |
| **Route** | `hc.mode = 'planner'` → `data-mode="planner"` on `#hcApp` → CSS shows the right pane → `HC_ROOMS.planner` renders into `#hcCanvas` |
| **Jobs it shows** | `hcLoadJobs(biz.id, today, tomorrow)` — **a direct `from('jobs')` read**, not an RPC |
| **Tasks it shows** | `get_business_tasks(p_business_id, p_owner_id, p_from, p_to)` |
| **Band rendering** | **already there** — `:4781` renders `Band C — you set this` (`band_source='owner'`) or `Band C — <band_reason>` |
| **Overlap** | already detects and says *"Two of these overlap. Ask me to move one and I'll find the next free slot."* |
| **Recurring** | `jobs.is_recurring`, `jobs.recurring_schedule_id`, table `recurring_schedules` — exists, not surfaced in the planner |
| **Calendar relationship** | none in the planner UI; the link lives on the job row (below) |
| **AI relationship** | none — the planner does not call the assistant, and the assistant has no plan-my-day action |

**Real vs placeholder: entirely real.** Every row shown comes from `jobs` or `tasks` through an
owner-scoped path. **`tasks` has 0 rows for every business**, so the TO DO section is empty
everywhere today.

### B. Jobs

| | |
|---|---|
| **Where** | `hcRenderJobs` `:4767` (claimed shell room) · the operator view in `hubly.html` (`data-v="jobs"`, 3 inbound call sites) |
| **Storage** | `public.jobs`, **42 columns** |
| **→ customers** | `jobs.customer_id` → `customers.id`; plus denormalised `customer_name`, `phone`, `email` |
| **→ calendar** | on the job row itself: `google_event_id`, `google_etag`, `sync_status`, `sync_origin`, `last_synced_at`, `last_google_update`, `last_hubly_update`, `hubly_push_at`, `hubly_job_id` |
| **→ bookings** | `jobs.booking_request_id`, `jobs.from_booking` |
| **Detail UI** | `hcJobPanel(j, biz)` — opens in the right-hand record panel, **beside** the conversation |
| **Personal/blocked time** | **`jobs.is_block`** — already modelled. The repo's own planner screenshot shows *"Dentist appointment — Blocked, not a customer"* |
| **Reusable by My Day** | `hcLoadJobs`, `hcJobPanel`, `hcRoomShell`, `hcRoomRow`, `hcRoomEmpty`, `hcOpenPanel` — the whole row/panel vocabulary |

### C. Calendar — **the job IS the calendar event**

Eight deployed edge functions: `google-calendar-oauth-start`, `-oauth-callback`,
`-connection`, `-sync`, `-inbound-sync`, `-push-job`, `-maintain`, `-webhook`.

**There is no separate event store for jobs.** Two-way sync state lives on `jobs`. Tables
`google_calendar_connections`, `google_calendar_events` and `google_calendar_oauth_states` all
have **0 rows** — nobody has connected a calendar yet.

**Source of truth: `jobs`.** My Day must not create a second calendar; for jobs there is
nothing to merge, because the job already carries its Google identity. `google_calendar_events`
exists for events that are *not* jobs and is empty.

### D. Tasks — the band model is already exactly A/B/C

`public.tasks`: `id, business_id, title, notes, due_date, due_time, duration_minutes,`
**`band, band_source, band_reason, lane,`** `status, done_at,` **`rolled_from, roll_count,`**
`created_at, updated_at`.

**Seven RPCs already exist:** `create_task`, `get_business_tasks`, `set_task_status`,
**`roll_task`**, `get_task_progress`, `capture_planner_item`, `record_planner_fallback`.

| spec need | existing column | needed |
|---|---|---|
| A = Must Do · B = Important · C = Nice to Do | **`band`** | a label map only. **Do not add a second priority model** |
| "why is this an A" | **`band_reason`** | already the honest-reason field §9 requires |
| owner set it vs Hubly inferred it | **`band_source`** | already renders as "you set this" |
| work vs personal (§7) | **`lane`** | already there |
| "move it to tomorrow" (§8) | **`roll_task`** + `rolled_from`/`roll_count` | already there |
| "nice work, you got your A's done" (§4) | `get_task_progress` | a band-aware read |

**One genuine gap: nothing writes `band`.** There is no `set_task_band` RPC and no capability
action for it, so *"Make ordering supplies an A"* has no writer today.

### E. AI — the inputs exist; the actions do not

`operations.read` (capability `operations`, `registry:5731`) gives the assistant **16 slices**:
`bookings, jobs, orders, chat_leads, traffic, customers, sales, service_stats, services, hours,
notifications, page_records, catalogue, payments, tasks, leads` — each through an owner-scoped
RPC.

**§9's rule is already half-written in that layer.** The tasks slice's empty line reads:

> *"TASKS: none open. **Do not invent one, and do not suggest he must be forgetting
> something.**"*

and the slice renders `[BAND] title`, so the band is already in the assistant's context.

| §8/§10 capability | exists? |
|---|---|
| read jobs, tasks, bookings, customers, payments for today | **yes** — `operations.read` |
| honest empty states in that context | **yes** — per-slice `emptyLine` |
| "Plan my day" as an action | **no** |
| write a band ("make that an A") | **no** — no writer |
| move a task to tomorrow | **yes** — `roll_task` (no capability action wired) |
| mark done | **yes** — `set_task_status` |
| `hubly_brain_planner.ts` | **not a day planner** — it plans CAPABILITY sequences (`HublyPlanStep.skill`), unrelated |

---

## 2. EXISTING REUSABLE COMPONENTS

`hcRoomShell` · `hcRoomRow` · `hcRoomEmpty` · `hcOpenPanel` · `hcJobPanel` · `hcCustomerPanel` ·
`hcLoadJobs` · `hcRenderRail` · `hcOpenWorkspace` · `hcSetView` · `HC_ROOMS` · the band renderer
at `:4781` · `get_business_tasks` / `create_task` / `roll_task` / `set_task_status` /
`get_task_progress` · `operations.read` · the eight Google Calendar functions · `jobs.is_block`.

**Nothing in My Day needs a new data model.**

---

## 3. WHAT MUST CHANGE — the minimum

1. **Rename, user-facing only:** rail label, room heading and every spoken sentence say **My
   Day**. `hc.mode`, `data-mode` and `HC_ROOMS` keep the key `planner` — renaming the internal
   key touches the URL hash, the rail, the CSS and `business_places.kind`, and buys nothing.
2. **One writer: `set_task_band(task, band, source, reason)`** — the only new backend object.
3. **One capability action** for the assistant: plan-my-day (read-only proposal) plus band
   writes routed through (2).
4. **One predicate change in `hcWorkspaces()`** (section 4 below).
5. **`hcRenderPlanner` gains the spec's surface** — greeting, the "what matters" line, quick
   actions, A/B/C sections with labels, the right-hand context column.

---

## 4. NAVIGATION — how both rulings hold

**Today:** `hcWorkspaces()` (`:4412`) returns any `business_places` row whose `kind` is in
`HC_PLACE_SURFACES`. **A row exists ⇒ the tab is painted.** No other condition.

**The columns to express the new rule already exist** — `added_by` and `earned_by`. No schema
change.

> **A place is painted on the rail when `added_by = 'owner'` — the owner ENTERED it.**
> **A place that is only earned (`earned_by` set, `added_by` system/backfill) is NOT painted;
> it becomes a door on Home,** and walking through that door sets `added_by = 'owner'`.

- New signup: no `owner` rows ⇒ **Home · Website · Settings**. My Day is not on the rail.
- Owner clicks through from Home ⇒ the entry writes `added_by='owner'` ⇒ **Home · My Day ·
  Website · …** and My Day is the primary workspace item.
- No second navigation system, no fixed list, no schema, and `business_places`, the trigger, the
  backfill and prohibition 5's stable positions all stay.

---

## 5. DATA MIGRATION — proposed, NOT executed

**Correction to the number first:** "the 51" is `added_by IN ('system','backfill') AND
earned_by IS NULL`. It is **not** the set that would lose visibility.

| | rows |
|---|---|
| total in `business_places` | **75** |
| visible today | **75** |
| `added_by = 'owner'` | **0** |
| system/backfill, `earned_by` null | 51 |
| system, `earned_by` set (`booking` 16, `customer` 6, `order` 1, `lead` 1) | 24 |
| businesses affected | **51** |

**Under the new predicate all 75 would stop painting, not 51.** Preserving current visibility
means migrating **75**. (The 51 equalling the business count is a coincidence — one unearned
row per business from the insert trigger — and it is what made 51 look like the whole set.)

**Table:** `public.business_places` · **Column:** `added_by` (text, default `'system'`)

| | current | proposed |
|---|---|---|
| `added_by` | `backfill` (34), `system` (41) | **`owner`** for all 75 existing rows |
| `earned_by` | unchanged — `null` (51), `booking`/`customer`/`order`/`lead` (24) | **unchanged** |
| `visible` | `true` (75) | **unchanged** |

```sql
-- REVERSIBLE: the prior value is preserved in config before the update.
update public.business_places
   set config   = coalesce(config, '{}'::jsonb) || jsonb_build_object('pre_2026_09_13_added_by', added_by),
       added_by = 'owner',
       updated_at = now()
 where added_by in ('system', 'backfill');
-- expected: 75 rows

-- ROLLBACK
update public.business_places
   set added_by = config->>'pre_2026_09_13_added_by',
       config   = config - 'pre_2026_09_13_added_by'
 where config ? 'pre_2026_09_13_added_by';
```

**Why `owner` and not a new flag:** `added_by` already means *who put this here*, and the
migration's claim is precisely "treat these as if the owner had entered them" — which is true,
because they have been using them. Rollback is exact because the old value is carried in
`config`, a jsonb column that already exists and is otherwise `{}`.

**Effect:** every current owner keeps every tab. The new rule applies only to places created
after the migration. **Nobody re-enters anything.**

**NOT RUN. Awaiting approval — it touches production data.**

---

## 6. MY DAY ARCHITECTURE — the smallest that satisfies §5, §6, §13, §14

**My Day is a READ-ONLY UNION plus one writer.** It owns no data.

```
                 ┌─ jobs (today)      via hcLoadJobs ──────────┐
  My Day  ───────┼─ jobs.is_block     the same read ───────────┼─→ one time-ordered list
  (execution)    ├─ tasks (today)     via get_business_tasks ──┤   grouped A / B / C
                 └─ google events     only when connected ─────┘
                        │
                        └─ writes ONLY: set_task_band · set_task_status · roll_task
```

- **Jobs:** read, never re-implemented. Clicking one opens **`hcJobPanel`** — the existing
  panel, beside the conversation. §12 satisfied: the owner does not leave My Day.
- **Calendar:** for jobs there is nothing to merge — the job *is* the event. Non-job events
  come from `google_calendar_events` **only when a connection exists** (0 today), so My Day
  ships with no calendar merge and gains one when someone connects.
- **Tasks:** `band` groups them; `lane` separates work from personal.
- **Personal:** `tasks.lane` for to-dos, `jobs.is_block` for blocked time. Both exist.
- **AI:** reads through `operations.read`; writes only through the three task RPCs.

**The A/B/C rule for items that are not tasks:** a job with a time today is an **A** — not
because Hubly decided, but because a customer is expecting someone. That reason is real and
printable. **A job never gets an invented band_reason.**

---

## 7. HOME → MY DAY → WORKSPACE

```
booking arrives → business_events 'booking.created'
  HOME (centre)      "New booking tomorrow at 10:00 — John, Full Detail"
  HOME (right)       customer · service · time · location · price      [existing event panel]
  CTA                "Open My Day"  ── first click writes added_by='owner' for planner
  MY DAY             A — Must Do    10:00  Full Detail — John
  click the job   →  hcJobPanel, in the right-hand panel. Still in My Day.
```

Home gains **one CTA**, not a dashboard. My Day gains **no job functionality**.

---

## 8. UI STRUCTURE — the exact screen

```
┌─ RAIL ───────┬─ CENTRE: My Day ──────────────────────┬─ RIGHT ─────────────┐
│ Home         │ Good morning, Adrian                  │ TODAY               │
│ My Day   ◀   │ You have 2 things that really matter  │ 08:00  Supplies     │
│ Website      │ today. Start with your A's.           │ 10:00  Full Detail  │
│ Settings     │                                       │ 12:00  Lunch        │
│              │ Plan my day · Add a task ·            │                     │
│              │ Move something · Show my week         │ AI SUGGESTIONS      │
│              │                                       │ (only when it has   │
│              │ A — Must Do                           │  something real)    │
│              │   A  10:00  Full Detail — John        │                     │
│              │   A  Send Sarah's invoice             │ [selected item      │
│              │ B — Important                         │  detail replaces    │
│              │   B  Call two leads                   │  this column]       │
│              │ C — Nice to Do                        │                     │
│              │   C  Gym · you set this               │                     │
└──────────────┴───────────────────────────────────────┴─────────────────────┘
```

- **The letter carries the emphasis, not the card.** One weight/size step per band; **no
  coloured cards, no KPI row, no slogans, no motivation tiles** (§4, §8, §10).
- **No "7 of 10".** When every A is done: one quiet line, *"Nice work today. You got your A's
  done."* — and nothing when they are not.
- **Right column is context, not a second screen** (§11), and is replaced by the selected
  item's detail — the existing panel pattern.
- **Empty states are truthful and specific** (§17): "No jobs today" · "Nothing scheduled" ·
  "Add something to your day". **A module with nothing in it is not rendered** (§16).

---

## 9. AI INTEGRATION

| step | how |
|---|---|
| inputs | `operations.read` slices `jobs`, `tasks`, `bookings`, `customers`, `payments` — owner-scoped, with the honest empty lines already written |
| proposal | the assistant returns a band per item **with a reason drawn from a record value** |
| apply | `set_task_band(task, band, source='hubly', reason)` — `band_source` records that Hubly chose it |
| the owner overrides | same writer, `source='owner'` → the UI already renders "you set this" |
| "move to tomorrow" | `roll_task` |
| "what should I do next?" | a read, no write |

**§9 enforced, not hoped.** `registry:2360`'s hard line is **extended in place** from invented
facts to invented reasons, and a check asserts **every `band_reason` Hubly writes traces to a
record value** — the `verifiedPlaced` / `servicesTruth` pattern pointed at *why* instead of
*what*. A reason that cannot be grounded is **omitted**, never softened.

---

## 10. RESPONSIVE

Existing: `@media (max-width:900px)` already collapses rooms to full-screen with the
conversation a tap away, and the bottom bar caps at 4 places (prohibition 5).

My Day on a phone is **the same content in the spec's order** (§15): **A items → today's jobs
and appointments → B → C**. The right column becomes a section *below* the A's, not a drawer.
**Not a shrunken desktop.** Per CLAUDE.md this cannot be verified here — no true 390px viewport,
no soft keyboard — so **mobile must be checked on a real phone before it is called done.**

---

## 11. RISKS

1. **A second calendar.** Mitigated structurally: jobs carry their own Google identity; there is
   nothing to merge for them.
2. **A second task/priority model.** The band columns exist; the only addition is a writer.
3. **Jobs rebuilt inside My Day.** Mitigated by opening `hcJobPanel`, not a new panel.
4. **AI inventing reasons** — §9. The highest-severity risk, because a fabricated reason is
   persuasive. Mitigated by grounding `band_reason` and by the check.
5. **The migration over-reaching.** 75 rows, reversible, `visible` untouched.
6. **`tasks` has 0 rows everywhere.** My Day will look empty for every business on day one,
   including Graef. That is correct (§17) and it must not be "fixed" with samples.
7. **Mobile unverifiable here.**
8. **Personal data in a business record.** `lane='personal'` puts gym and family in
   `business_records`. Where the visibility preference lives is **§7's open question** and is not
   decided here — but the A/B/C decision stays next to the task, never in Settings.

---

## 12. VERIFICATION PLAN

| # | test | pass |
|---|---|---|
| 1 | **New business** — fresh signup, no places | rail = Home · Website · Settings. **No My Day** |
| 2 | **Existing business after migration** | every tab visible before is visible after — checked per business, 51 businesses, 75 rows |
| 3 | **Activation** | Home CTA → My Day opens → `added_by='owner'` written → tab appears and persists |
| 4 | **Jobs are real** | each row's `jobs.id` is shown/attributable; `select * from jobs where id='…'` matches; clicking opens `hcJobPanel` |
| 5 | **No duplicated job system** | `grep` shows no second job renderer; the click path resolves to `hcJobPanel` |
| 6 | **Calendar** | with 0 connections: no calendar module renders. After a connection: events come from the existing integration; **no new table, no new sync** |
| 7 | **Tasks / bands** | bands come from `tasks.band`; labels are a display map; **no second priority column** |
| 8 | **AI plan** | every proposed band has a `band_reason` traceable to a record value; a reason that cannot be grounded is absent |
| 9 | **AI cannot invent** | ask on a business with 0 tasks and 0 jobs → it says it does not know; **no fabricated deadline, urgency or statistic** |
| 10 | **Natural language** | "make that an A" → `set_task_band` with `source='owner'`; "move to tomorrow" → `roll_task`; "what next" → read only |
| 11 | **Navigation** | inserting a `booking`-earned place does **not** paint a tab; it offers a Home door |
| 12 | **Mobile** | desktop/tablet verified here; **phone on a real device** |
| 13 | **No fake data** | rendered against **Graef** (4 customers, 2 jobs, **0 tasks**) and **`hubly-paging-fixture`** (250/250/250). Graef's My Day shows 2 jobs and an empty task state; the fixture's differs correspondingly. **A screen that looks the same against both is not reading rows.** |

**How a reviewer checks "real rows" without reading code** (§17, and the rule we have already
broken in the other direction — our whole corpus is test data): every item traces to an id they
can query; the screen differs between two businesses with different data; the empty state names
the table; the band label traces to `band_source`; no aggregate is summed from a paginated
reader (D-024).

---

## 13. IMPLEMENTATION PHASES

| phase | contents | deploys? |
|---|---|---|
| **0** | the migration (75 rows), approved separately | data only |
| **1** | `hcWorkspaces()` predicate + the Home door + activation write | shell |
| **2** | rename to My Day, user-facing only | shell |
| **3** | `set_task_band` RPC + the §9 check | one migration |
| **4** | the My Day surface — greeting, context line, quick actions, A/B/C, right column | shell |
| **5** | AI: plan-my-day, band writes, natural language | edge function |
| **6** | calendar module — **only when a business connects one** | shell |

Each phase is independently revertible and phases 1–2 change no data.

---

## 14. TWO PLANNER DEFECTS (audit item 3)

**(a) The reply repeats itself — cause found.** `hcClassicScopeLine()` is appended at
`platform-home.html:6355` guarded by `hc._saidClassicScope`, and **again at `:6365`** inside the
`r.failed` branch with a lead sentence prepended. **The second call is unguarded**, so on a
classic page whose upgrade also failed the owner reads the same paragraph twice.

**(b) "Moving whole sections isn't something I can do" — the capability gate is CORRECT; the
remedy is false.** The line is **client-composed** (`hcAppendMessage`), not model output —
CLAUDE.md's rule to confirm who is speaking before editing a prompt applies, and it is not the
model. It fires only when `hc.hasDocument === false`; `hcLoadHasDocument` sets **`null`** on any
read failure and the test is strict, so it cannot fire on an unknown. When it fires the business
genuinely has no `business_documents` row — the CLASSIC renderer — where `moveFreeformSection`
truly cannot help, because it edits freeform HTML that does not exist.

**What is false is "that isn't a temporary problem."** A rebuild turns the page into a document
and every freeform capability applies from that moment. **The defect is a missing route, not a
wrong gate.**

**Separately recorded (§13 of the spec — kept out of My Day scope):** 11 claimed businesses have
no `business_documents` row, including **`graefs-autocare`**, the only live customer, and
`adrians-lawn-service`. Everything built this week for freeform pages does not reach them. See
`docs/OPEN_FINDINGS.md`.
