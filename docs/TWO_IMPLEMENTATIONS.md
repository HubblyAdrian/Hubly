# Jobs and Customers exist twice. The honest comparison. (2026-09-13)

Established, not merged. Nothing changed.

| | claimed shell — `platform-home.html` "rooms" | operator shell — `hubly.html` nav |
|---|---|---|
| **how you get there** | rail item, only once the business has EARNED the place (`business_places`) | `<div class="ni" data-v="jobs" onclick="switchV(...)">` — always present, no earning gate found |
| **Jobs reads** | `hcLoadJobs` → `from('jobs').select(...)` over a date window | `S.jobs = [...pending, ...jobs, ...gcalJobs]` — the jobs table PLUS pending booking requests PLUS Google Calendar events |
| **Customers reads** | `rpc('get_business_customers', {business_id, owner_id, limit:200})` — **the same reader the assistant uses**, so the room and the chat answer cannot disagree | `from('customers').select(...)` → `S.customers`, mapped by `mapCustRow` |
| **what it shows** | a folded list; a row opens in the right-hand record panel beside the composer | KPI cards (total, active, range), tabs (`S.custTab`), range filters (`S.custRange`), drag-a-lead-into-Jobs |
| **empty state** | an honest sentence, and it distinguishes "I couldn't read your customers" from "none on record" | not established here |
| **which owner** | authorises by `p_owner_id` through the RPC | client-side query under RLS |

**Rows behind both, today:** `jobs` 5 · `customers` 17 · `booking_requests` 31 · `tasks` 0.
Both read real tables. Neither is a mock.

**Which is worth keeping — my reading, not a ruling.** The ROOMS are the right surface and the
operator views have the better content. The rooms live in the shell Adrian's spec is about,
they go through the same reader as the assistant (so the screen and the answer can never
disagree — that is the `servicesTruth` discipline applied to a list), they authorise by owner
at the RPC, and they open a record beside the conversation. The operator views are richer in
exactly the ways that matter to someone running a day: the KPI header, the merge of pending
booking requests and calendar events into one job list, and the drag-to-Jobs gesture. So:
keep the rooms, port the KPI header and the pending/calendar merge into them, and let the
operator views go. **That is a recommendation. The merge is Adrian's call and nothing has
been touched.**

## The disclosure question is wider than three rooms

`hubly.html`'s nav carries **25 destinations**:

`activity · apps · ask · calendar · chats · customers · dashboard · editor · growth · jobs ·
leads · marketing · marketplace · memberships · money · opportunities · photo-projects ·
pipeline · projects · quotes · reports · reviews · settings · store · studio`

The claimed shell's rail has **four** surfaces declared (`website`, `planner`, `jobs`,
`customers`) and shows only what a business has earned — on `evergreen-yard-care`, two.

**Leads, Calendar and Media are the three the partner named, and they do not appear in the
claimed rail at all.** Whether each of the 25 is real, demo, or abandoned is NOT established
here — that is the next question, and it is bigger than Planner/Jobs/Customers: every one of
them is either a capability an owner cannot find, or a nav item that lies. The two we did
check are real (they read real tables with real rows).
