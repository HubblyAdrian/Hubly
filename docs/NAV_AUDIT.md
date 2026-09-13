# The 25 operator nav destinations — audit (2026-09-13)

Report only. Nothing changed, nothing proposed here.

**Three instrument corrections before any number below is quoted** (Lesson 51: when a
measurement changes and the product did not, suspect the instrument). v1 of the audit script
reported 0 renderers and 0 inbound links for all 25 — it was reading the wrong file. v2 walked
one level and reported that NO destination touches a database — `renderCustomers()` is a
12-line wrapper and every read is two or three calls deeper. v3 walks the call graph to depth
4 across both files. **The numbers below are from v3, and what v3 still cannot see is stated
at the bottom.**

## Reachability — the answer is the same for all 25, and it is in the code

`public/hubly.html:13790` redirects an owner arriving at the operator app to `/` when the
restored view is `dashboard`, with a comment that calls it **"the retired view"**, "the card
wall", "the screen that was inventing things". `location.replace`, not assign, *"an owner
pressing Back should not bounce into the retired view."*

- **Confirmed by navigating:** `https://myhubly.app/hubly.html` on Adrian's signed-in session
  lands on `https://myhubly.app/` — the claimed shell. The operator nav never appears.
- **BUT the retirement is partial.** The redirect fires only when the restored view is
  `dashboard`. `readPersistedOwnerAppView()` restores whatever view the owner last used, and
  `persistOwnerAppView` is written from the editor and settings paths — so an owner whose last
  view was anything else still lands inside the operator shell with all 25 items.

## The table

| destination | view container | renderer (journey.js map) | data reached from the render path | inbound links |
|---|---|---|---|---|
| jobs | yes | `renderJobs` (26 fns walked) | `recurring_schedules` | **3** |
| calendar | yes | `renderCalendar` (27) | `recurring_schedules` | 0 |
| customers | yes | `renderCustomers` (17) | `recurring_schedules` | 0 |
| photo-projects | yes | inline fn | — | **2** |
| projects | **NO** | — none mapped | — | **2** |
| ask | yes | `renderAskHubly` (10) | — | 1 |
| leads | yes | `renderLeads` (20) | — | 0 |
| settings | yes | `renderSettingsHub` (15) | — | 0 |
| reports | yes | `renderReportsPage` (18) | — | 0 |
| reviews | yes | `renderReviews` (14) | — | 0 |
| money | yes | `renderRevenue` (13) | — | 0 |
| memberships | yes | `renderMemberships` (10) | — | 0 |
| pipeline | yes | `renderPipeline` (10) | — | 0 |
| dashboard | yes | `enhanceDashboard` (8) | — | 0 |
| chats | yes | `renderInbox` (2) | — | 0 |
| editor | yes | `restoreWebsiteEditor` (2) | — | 0 |
| activity · growth · opportunities · marketing · store · studio | yes | mapped, 1 fn walked | — | 0 |
| apps · marketplace · quotes | yes | **none mapped** (legacy `v==='x'` branch only) | — | 0 |

**21 of 25 are mapped to a renderer; 17 have a real function body; 3 reach a database read
from the render path; 4 have an inbound link.**

## What the operator shell actually reads, asked the other way round

Every `.from()` / `.rpc()` in both files, which is the honest measure of what is wired:

`businesses` 31 · `booking_requests` 18 · `jobs` 15+5 · `review_submissions` 5 · `customers` 4 ·
`recurring_schedules` 3 · `business_memories` 2 · `services` 1 · `google_calendar_events` 1 ·
`memberships` 1 · plus chatbot, booking and public-document RPCs. **20 distinct tables/RPCs.**

**`journey.js` — which renders all 25 views — touches only `jobs` and `recurring_schedules`.**
Everything else is read by `hubly.html` into client state and rendered from memory. That is why
the render path shows almost no reads, and it is the single most important structural fact
here: **these views do not own their data.**

## What this audit CANNOT see, said plainly

- **Real vs demo vs abandoned is NOT established for the 18 destinations that reach no data
  from the render path.** A view that renders from client state looks identical, statically, to
  one that renders from a constant. Deciding that needs each screen opened with a real business
  behind it — and the operator shell is not reachable from the apex for an owner whose restored
  view is `dashboard`, which is the default.
- The four with inbound links are the retirement risk, and they are the answer to the question
  that prompted this: **`jobs` has 3 inbound links, `photo-projects` 2, `projects` 2, `ask` 1;
  `customers` has none.** Retiring the operator Customers view breaks no in-app link. Retiring
  the operator Jobs view breaks 3 — every one is a `.ni[data-v="jobs"]` click, i.e. code that
  drives the nav item rather than a URL, so they fail silently if the item is gone.
- `projects` has **no view container at all** and two inbound links. That one is already broken
  today, independent of anything we do next.
