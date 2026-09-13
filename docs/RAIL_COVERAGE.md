# The nine retired surfaces vs the claimed rail (2026-09-13)

Established by reading `platform-home.html` and counting rows for the only live customer.
**Correcting myself first:** I reported that Graef's open leads were reachable only because
the redirect fix was partial. That was wrong. They are on Home already.

## surface → does the rail cover it → cost

| surface | covered today? | evidence | cost to cover |
|---|---|---|---|
| **Leads / open bookings** | **YES** | `get_business_events` returns **7 `booking.created` + 5 `booking.abandoned`** for graefs-autocare, and Home renders them — `'Booking'` / `'Unfinished booking'` (`platform-home.html:5130-5131`), filtered at `:5383`, fresh counts at `:5675-5677` | **none.** Already shipped |
| **Chats** | partly | `chat.asked` is an event kind and Home handles it (`:5062`). Not a browsable surface | Graef has 0 chatbot_conversations — no data, no loss today |
| **Calendar** | no | — | Graef: calendar NOT connected, 0 `google_calendar_events`. No data, no loss today |
| **Money** | no | `renderRevenue` owns no table; `DS()` is `HublyDS`, the DESIGN SYSTEM, not a data source. It renders from client state derived from jobs + bookings | a VIEW problem, not a second merge. No migration |
| **Reports** | no | `renderReportsPageInner` → `ensureReportsOsState()` + `DS()`. Same: no own table | a VIEW problem. No migration |
| **Reviews** | no | `review_submissions` exists | Graef: 0 rows |
| **Memberships** | no | `memberships` exists | Graef: 0 rows |
| **Pipeline** | no | `ensurePipelineOsState()` → `st.pipeline = {manual:[], stages:{}, edits:{}}` — LOCAL edits, owns no table | Graef: no data |
| **Media / photo-projects** | no | `photography_project_invoices` exists — a vertical-specific table | Graef: not a photographer |

**So: closing the other five doors costs the live customer nothing measurable today.** Every
surface with rows behind it for graefs-autocare is already on his rail — bookings and
abandoned leads through Home's event feed, `customers` and `jobs` as earned rooms. That is the
answer to which doors can close and in what order: all of them, once the two defects below are
fixed, because neither Money nor Reports nor Pipeline owns data to lose.

## Two defects found while establishing this

1. **`hcHomeCounts.openBookings` is computed and never rendered.** `platform-home.html:5561`
   sets it from a live `booking_requests` count (`status='pending'`); no `countKey` consumes
   it — the suggestion cards use `jobsToday` and `customerCount` only. Same shape as
   `verifiedPlaced`: computed correctly, dropped one layer later. For Graef that is **2 pending
   bookings** the query finds and the screen never shows.
2. **`hcHomeCounts.openLeads` reads the wrong thing for its name.** It counts
   `chatbot_conversations` where `resulted_in_booking = false` — chat conversations, not
   abandoned bookings. Graef's 5 abandoned bookings are not what it measures, and he has 0
   chats, so it is 0 for him either way. Also never rendered.

Both are in the claimed shell, and both are **direct table reads** (`c.from('booking_requests')`,
`c.from('chatbot_conversations')`, `c.from('jobs')`) rather than reads through a shared RPC —
the exact pattern the merge ruling forbids. They are already the second reader of a fact
`get_business_events` owns.

## Numbers, so the next reader does not re-derive them

graefs-autocare `booking_requests` by status: **abandoned 5 · accepted 4 · pending 2** (total 11).
My earlier "7 open" was `status <> 'accepted'` — 2 pending plus 5 abandoned, which are two
different things and should not have been added together.
