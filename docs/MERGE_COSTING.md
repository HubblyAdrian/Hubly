# One Jobs screen, one Customers screen — costed (2026-09-13)

**Base:** the dashboard rooms. `hcRenderJobs` (26 lines) and `hcRenderCustomers` (30 lines) in
`platform-home.html` survive; operator affordances move onto them. Rooms stay gated on the
earning rule reading `business_places`.

**Usage line, stated exactly once and carried into every row below:** *no usage measured; the
one live business's rows are our own test data* (`docs/SETTLED.md` #1 — all 11 of Graef's
booking_requests are ours, both his jobs are the owner and a relative). Nothing here is
justified by demand, because no demand has been observed.

---

## The finding that reshapes the costing

**There is no shared reader for jobs.** The `get_business_*` family covers customers,
customer_count, events, tasks, sales, payments, services, service_stats, traffic, hours,
notifications, catalogue, page_records and unlinked_jobs — **not jobs.** `hcLoadJobs` reads
`c.from('jobs').select(...)` directly.

So the rule *"every read through the shared reader"* is **already violated by the base we are
merging onto**, before a single operator feature moves. Customers is clean —
`get_business_customers` + `get_business_customer_count`. Jobs is not.

That makes the Jobs screen the expensive one, and it is a migration, not a UI cost.

---

## Customers — the cheap screen

| affordance | what it needs | cost | migration? | red-proofable? |
|---|---|---|---|---|
| the folded list (base) | already shipped, via `get_business_customers` | 0 | no | already is |
| **KPI: total** | `get_business_customer_count` already exists and Home already calls it | ~5 lines, 1 file | no | yes — count vs rendered number |
| **KPI: total billed / visits** | the RPC ALREADY RETURNS `visits`, `total_billed`, `merged_rows`, `last_seen` per row | ~15 lines, 1 file — sum over returned rows | no | yes |
| **KPI: "active in range"** | needs a count over a DATE WINDOW. `p_limit` defaults to **8**, so summing the returned page is wrong — it would report "active" over whatever 8 rows came back | ~10 lines + **extend `get_business_customer_count` with `p_since timestamptz default null`** | **YES — one migration** | yes |
| range filter / tabs | client-side over returned rows, once `p_limit` is raised | ~25 lines, 1 file | no | yes |
| a row opens in the record panel | already shipped (`hcOpenPanel`) | 0 | no | — |

**Customers total: ~55 lines, one file, one small RPC extension.** No second query anywhere;
every number comes from `get_business_customers` / `get_business_customer_count`.

## Jobs — the expensive screen

| affordance | what it needs | cost | migration? | red-proofable? |
|---|---|---|---|---|
| the list (base) | **currently a DIRECT TABLE READ.** To satisfy the rule it needs `get_business_jobs(p_business_id, p_owner_id, p_from, p_to, p_limit)` — owner-authorised, same shape as `get_business_customers` | ~60 lines SQL + ~20 lines client | **YES — one migration** | yes |
| **merge pending booking requests into the list** | `get_business_events` ALREADY unions `booking_requests` and `jobs`. Read the feed instead of a second query — `hcEvents.list` is in memory already | ~30 lines, 1 file | no | yes |
| **merge Google Calendar events** | `google_calendar_events` is read by `hubly.html` only and is **NOT** in the events union. Carrying it needs a fifth union in the `business_events` view | ~15 lines SQL | **YES — one migration** | yes |
| **drag-a-lead-into-Jobs** | a WRITE, not a read. The write path exists in `hubly.html`; `get_business_unlinked_jobs` suggests the linking concept is already modelled | ~40 lines UI + reuse the existing writer — **needs its own establish pass before costing properly** | unknown | yes |
| KPI header (today / this week / unpaid) | derivable from the same `get_business_jobs` rows | ~20 lines | no | yes |

**Jobs total: ~185 lines across 2 files, TWO migrations, and one affordance (drag-to-Jobs)
that is not honestly costed until its write path is established.**

---

## Which affordances Graef actually has data for

The only real usage signal in the corpus, and it is our own footprints:

| affordance | Graef's data |
|---|---|
| Customers list + folded count | **4 customers** |
| Customers KPI: total billed / visits | present in the RPC's return; not yet rendered |
| Jobs list | **2 jobs** — the owner and a relative |
| pending bookings merged into Jobs | **2 pending** |
| Google Calendar merge | **0 events, not connected** |
| drag-a-lead-into-Jobs | 5 abandoned bookings could be dragged |

**The calendar merge is the one to cut.** It costs a migration, it is the only affordance
requiring a fifth union in a view that currently reconciles row-for-row, and the single live
business has zero calendar events and no connection. Build it when a business connects a
calendar, not before.

---

## Where this stops rather than adds a second reader

**One place, and it is Jobs.** Every other affordance is satisfiable from
`get_business_customers`, `get_business_customer_count` or `get_business_events`. Jobs has no
shared reader, so the honest options are exactly two:

1. **Write `get_business_jobs`** — one migration, and the Jobs room stops being a direct table
   read for the first time; or
2. **Do not merge Jobs yet.** Merge Customers, which is clean, and leave Jobs on its direct
   read with the violation recorded.

**Recommendation: (1), and do Customers first.** Customers is ~55 lines and one small RPC
extension, it proves the pattern end to end, and it is the screen where the shared reader
already exists — so the merge starts by demonstrating the rule rather than by breaking it.
