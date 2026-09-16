# The job record — measured and found, before any code (A2)

Adrian asked for three things before anything is designed. All three are answered here, and two of
them change what the work is.

---

## 1. THE COLUMN LIST — every field he named already exists

`jobs`, 259 rows, all 41 columns. Fill rates measured 2026-09-16:

| column | rows with a value | |
|---|---|---|
| `scheduled_date` | 259 | 100% |
| `service_name` | 259 | 100% |
| `status` | 259 | 100% |
| `amount` (price) | 255 | 98.5% |
| `customer_name` | 254 | 98.1% |
| `scheduled_time` | **9** | **3.5%** |
| `duration_hours` | 6 | 2.3% |
| `address` | **5** | **1.9%** |
| `notes` | 4 | 1.5% |
| `phone` | **4** | **1.5%** |
| `customer_id` | 3 | 1.2% |
| `email` | **3** | **1.2%** |
| `service_id` | **2** | **0.8%** |
| `vehicle` | 2 | 0.8% |
| `booking_request_id` | 1 | 0.4% |
| `assigned_to`, `deposit_cents`, `google_event_id`, `paid_at`, `recurring_schedule_id` | **0** | **null on every row** |

**Nothing needs adding.** Name, address, service (both free-text `service_name` and the link
`service_id`), price, phone, email and notes are all columns that exist today. The old SaaS's job
record is still the schema.

**And the fill pattern is the finding.** Four columns at ~100% and everything a human would type at
1–3% is the signature of a **bulk writer**, not a form — see §3.

---

## 2. THE REGRESSION — NAMED. `ead44be`, 2026-07-27

**`fix(operate): remove sidebar + New Job on Jobs tab`**, verbatim from the commit body:

> *"It only appeared in Jobs & Calendar and duplicated the header CTA, pushing the nav out of
> alignment. Keep New Job in the page header only."*

What it changed, one line in `public/hubly.html`:

```diff
-<button type="button" class="nav-jobs-new" onclick="openJobsNew()" title="New Job">+ New Job</button>
+<button type="button" class="nav-jobs-new" hidden aria-hidden="true" onclick="openJobsNew()" title="New Job">+ New Job</button>
```

**The form was never deleted. Its button was given `hidden`.**

### And the door it was hidden in favour of is also closed

The commit's reasoning was sound: keep ONE New Job entry point, the header CTA. That CTA is
`public/hubly.html:11290`:

```html
<button class="btn btn-brand btn-sm btn-newjob jos-legacy-bar" onclick="HublyJourneyOS?.openJobCustomerPicker?.()">+ New Job</button>
```

`public/journey-os/operate-pixel.css:28` — `#p-app.jos-pixel .jos-legacy-bar { display:none !important }`.

**Two doors, each closed for a reason that assumed the other was open.** One was hidden because the
header had it; the header's was then hidden by the Journey OS pixel redesign as legacy chrome.

### The proof that nothing else reaches it

`openJobsNew()` is defined at `public/hubly.html:41418` and **has exactly one caller in the entire
codebase: the button that `ead44be` hid.** It still works — it switches to the Jobs view and calls
`HublyJourneyOS.handleJobsAct('jobs-create')`, falling back to `openJobCustomerPicker()`.

**This is recovery, not replacement, and it is two attributes and one CSS rule wide** — in
`hubly.html`. The separate question is `platform-home.html`, the claimed-owner shell, which never
had a job form at all.

---

## 3. WHO IS WRITING THE 255 JOBS — a documented TEST FIXTURE, and the doorless list should say so

| business | `account_kind` | jobs | distinct create-seconds | from booking | timed |
|---|---|---|---|---|---|
| **`hubly-paging-fixture`** | test | **250** | 250 | 0 | 0 |
| `hubly-classic-fixture` | test | 3 | 3 | 0 | 3 |
| `canyon-ridge-tree-care` | test | 2 | 2 | 0 | 2 |
| **`graefs-autocare`** | **market** | 2 | 2 | **2** | 2 |
| `adrians-lawn-service` | test | 1 | 1 | 0 | 1 |
| `crestview-window-cleaning` | test | 1 | 1 | 0 | 1 |

**250 of the 259 rows are `hubly-paging-fixture`** — the paging instrument documented in
`docs/PAGING_FIXTURE.md`, created deliberately on 2026-09-13 at 250 rows per table because
"Graef hides every paging and empty-state bug we can write". Evenly spaced over exactly ten days,
250 distinct create-seconds, `account_kind = test`.

**So "the job creator — 255 rows, no writer" was counting our own fixture.** The real corpus of
jobs ever created by anything is **nine**:

- **2** by the booking wizard (`graefs-autocare`, `from_booking`, the only **market** rows)
- **7** by the model's `business.addJob` capability, on test businesses

**The job creator does have a writer** — `create_business_job`, reached by `business.addJob`. What
it does not have is a **form**. The doorless-list entry should be corrected: it is not a writer with
255 rows of evidence and no door; it is a writer with essentially no real use *because* the door is
missing, and 250 of its rows are ours.

---

## What this changes about the work

1. **Nothing to design in the schema.** Every field is there.
2. **The `hubly.html` job form is a recovery**: two hidden attributes and one `display:none` rule
   between an owner and a working drawer. Before un-hiding either, the question is which shell the
   owner is in — `platform-home.html` is where a claimed owner lives now, and it has no job form.
3. **The dropdown trap is real and unresolved.** "Kind of job, taken from their services" needs the
   service list, and `service_id` is populated on **2 of 259 rows** — so today's jobs are almost
   entirely free-text `service_name` with no link back to a service. Four read paths and 23 of 41
   businesses with disagreeing stores; the dropdown must read what the BOOKING path reads, proved
   through the booking path's own reader. **This is the item that may force the one-service-writer
   job to move up, and it is flagged for Adrian rather than decided here.**
4. **Carry-forward (lead → customer → job) is not answered yet** — `customer_id` is set on 3 of 259
   rows, which says the link is almost never made today, but not whether it ever existed. Open.
