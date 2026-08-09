# Rendering Architecture Audit

Report only — nothing below has been implemented or changed. Goal: understand, with real call-stack traces (not guesses), how each major page renders today, before touching any rendering code. Every claim below is a file:line citation into the actual code, verified live in this repo.

Scope: Home, Jobs, Leads, Customers, Calendar, Quick Quote, Inbox, and Analytics (mapped to Reports + Revenue — see that section for why).

## Headline finding: three rendering paradigms coexist in this app

1. **A real, hand-rolled DOM-diffing engine** (`morphTableInto`/`morphTableChildren`/`morphTableNode`/`morphTableKeyedChildren`/`morphTableAttrsAndProps`, journey.js:9018-9140) — keyed on `data-jos-record-id` (rows) and `data-jos-col-key` (cells/headers), preserves scroll position, focus, and mid-edit inputs across a render. **Confirmed via grep: `morphTableInto(` is called in exactly two places in the entire codebase** — Leads (journey.js:9314) and Jobs' list view only (journey.js:18007). This is not a library (no morphdom, no virtual-DOM package anywhere in the repo — confirmed, zero hits) — it's custom code, and it is currently a two-page feature, not an app-wide one.
2. **Plain `root.innerHTML = fullHtmlString` full teardown/rebuild** — the default for every other page (Home, Customers, Calendar's own grid, Inbox, Reports, Revenue) and for Jobs' Calendar sub-view specifically. Some of these (Home, Customers) do it **twice per render** — an unconditional loading-stub replace, immediately followed by the real-content replace — which is strictly worse than the single-replace pattern Jobs/Leads/Inbox use.
3. **A third, independent paradigm inside Quick Quote** (`public/smart-quote/ui.js`) — not part of the Journey OS pixel-UI system at all. No `bindRoot`, no `ownPixelView`, no `rendererRegistry`, no morph engine. Three independently-targeted DOM roots (`#sq-main`, `#sq-sidebar`, `#sq-list`), each rebuilt via direct `document.getElementById(...).innerHTML = template()` calls wired to inline `onclick`/`oninput` handlers rather than a delegated listener.

So: **yes, multiple rendering architectures exist today**, and the divide isn't "old page vs. new page" — it's "did this specific page get the morph-engine treatment when the Jobs/Leads flash bug was fixed, or not."

## Why Leads feels smoother than Jobs

It mostly doesn't, anymore, for the table itself — Jobs' list view was migrated onto the exact same `morphTableInto` engine as Leads (journey.js:18007), specifically to fix "every click renders" flash (see the comment at journey.js:17998-18005, quoted in the Jobs section below). Both tables' inline-edit commit paths (table cells **and** the Jobs drawer's fields) call `mutateJobField`/`mutateLeadById` then a full page-render call that resolves to the same morph.

The remaining, still-real gap is **Jobs' Calendar view**, which was deliberately left on full-replace (journey.js:18006, `if (mainView === 'calendar') root.innerHTML = jobsPageHtml;`) because its drag-and-drop scheduling logic manipulates live DOM nodes directly and hasn't been checked against a mid-drag morph. If "Jobs rerenders visibly" is still being seen today, it is very likely being seen on the **Calendar tab**, not the Jobs list/table — see the Calendar section for the exact mechanism, plus a distinct, confirmed realtime gap (Calendar's grid is never refreshed by an external realtime change at all — see below).

## Why Home appears to rerender periodically

Confirmed, not inferred: Home has a live, unconditional 30-second polling timer.

```js
// journey.js:14787-14805
if (!root._josLiveTimer) {
  root._josLiveTimer = setInterval(function () {
    if (!document.body.contains(root)) { clearInterval(root._josLiveTimer); root._josLiveTimer = null; return; }
    if (document.hidden) return;
    if (root.classList.contains('jos-customize-on')) return;
    if (root.querySelector('.jos-wmenu-pop:not([hidden])')) return;
    if (el('jos-home-cc-input') && document.activeElement === el('jos-home-cc-input')) return;
    if (!isHomeViewActive()) return;
    // Lightweight pulse: re-render on a gentle cadence for live feel
    if (!root._josLiveTick) root._josLiveTick = 0;
    root._josLiveTick += 1;
    if (root._josLiveTick % 2 === 0) enhanceDashboard();
  }, 30000);
}
```

That's a full `enhanceDashboard()` call — a complete Home rebuild — **every 60 seconds**, regardless of whether anything actually changed, on top of:

- **Every realtime write to jobs/customers/booking_requests anywhere in the business** also triggers a full Home rebuild: `refreshOpenAppViews()` (hubly.html:15686) calls `HublyJourneyOS.enhanceDashboard()` whenever `viewIsOpen('v-dashboard')` (hubly.html:15727-15734) — this fires for another tab's edit, another user's edit, or this tab's own unsuppressed writes.
- **Nearly every micro-interaction on Home also triggers a full rebuild**, not a local state update — toggling one widget's visibility, saving the layout, changing the revenue-range picker, and expanding a score card all call `enhanceDashboard()` directly (journey.js:14666, 14672, 14701, 14723, 14733, 14748) rather than patching just the affected widget.
- And `enhanceDashboard()` → `renderHomeDashboard(root)` does the same **double full-replace** pattern as Customers: an unconditional `root.innerHTML = '...Loading Home…'` stub (journey.js:14216) on literally every call — including every 60-second poll tick — followed by the real content (journey.js:14625). There is no `if (!root.firstChild)` gate the way Jobs/Leads have.

Net effect: Home is architecturally the "rerenders periodically" page by design (a timer, explicitly labeled as intentional in the code's own comment), and every one of those rerenders is a full double-teardown, not a patch — which is exactly what makes it visible.

## The master table

| Page | Render Trigger | Render Boundary | Shared Renderer | Needs Work |
|---|---|---|---|---|
| **Home** | User interaction (every widget/layout/range action) · realtime (any job/customer/booking write, via `refreshOpenAppViews`) · **30s poll timer, fires full rebuild every 60s** (journey.js:14789-14804) | Whole page, **double full replace** every single call (loading stub then real content, journey.js:14216 → 14625) | `ownPixelView`, `bindRoot` only — **no morph engine used** | Yes — remove/lengthen the poll timer or make it patch instead of rebuild; stop double-replacing (gate the loading stub behind `if(!root.firstChild)` like Jobs/Leads); most single-widget interactions (toggle visibility, range picker) don't need a whole-Home rebuild |
| **Jobs (list/table + drawer)** | User interaction (inline edit, drawer edit, filters, bulk actions) · realtime (jobs/customers/booking_requests writes) · nav switch | List view: **table morph** via `morphTableInto` (journey.js:18007), keyed on row/cell. Drawer fields: same morph pass (drawer HTML is part of the same string) | **Shares** the Leads morph engine (`morphTableInto`, journey.js:9018-9140) — one of only 2 call sites in the app | Low — already fixed for the flash issue. Verify drawer sub-elements are correctly keyed inside the morph (not explicitly confirmed) |
| **Jobs (Calendar view)** | User interaction (nav, prev/next/today, view toggle, drag-create, drag-resize, drag-drop-reschedule) · realtime (see gap below) | **Whole page full replace** on every committed change (journey.js:18006); **direct DOM style manipulation** (no render at all) during an active pointer-drag (journey.js:18919-18931, 18428-18435) | Shares `renderJobsPage(root)`, `bindRoot`, `wireJobsRoot`, `handleJobsAct` with Jobs-list — same file, same functions, branches on `mainView` | Yes — (1) deliberately excluded from the morph engine, this is where "Jobs visibly rerenders" is most likely still seen; (2) **confirmed gap**: `refreshOpenAppViews()` has no `v-calendar`/`jos-calendar-root` branch at all — an external realtime change never refreshes the Calendar grid while it's open; (3) confirmed double-render on nav switch (both `HublyJourneyOS.renderCalendar()` and `onSwitchView('calendar')` fire on the same switch) |
| **Leads** | User interaction (inline edit, filters, bulk actions, CSV import) · realtime (jobs/customers/booking_requests writes only — **not** the `businesses` table Leads itself is stored in) · nav switch | **Table morph** via `morphTableInto` (journey.js:9314), single replace, gated behind `if (!root.firstChild)` (journey.js:8991) | Owns the morph engine Jobs-list borrows | Low, but note: Leads' own writes (`persistPipelineSoon`, hubly.html:43103) never go through `markLocalWrite`/realtime suppression at all — not because it's unneeded, but because the realtime subscription (hubly.html:15668-15671) never listens on the `businesses` table in the first place, so lead edits are **not realtime-synced across tabs/users** the way jobs/customers are |
| **Customers** | User interaction (every act in `handleCustomersAct`, ~35 call sites) · realtime (jobs/customers/booking_requests writes) · nav switch | Whole page, **double full replace** every call (loading stub always painted first, journey.js:11865, then real content at 11910 or 11942) — no `if(!root.firstChild)` gate | `ownPixelView`, `bindRoot` only — **no morph engine used at all**, no `rendererRegistry`/`tableCellHtml` either | Yes — same double-replace pattern as Home; **confirmed double-fire bug**: `data-jos-cust-tab`/`data-jos-cust-row` clicks are matched by both `bindRoot`'s generic dispatch and Customers' own separate `wireCustomersRoot` listener, neither stops the other, so a single click re-renders twice; **confirmed broken persistence**: inline customer-edit-save writes only to in-memory state — `saveCustomerDetail()` (hubly.html:42516) reads a legacy DOM id (`cd-name`) that doesn't exist in the Journey OS Command Center form, so it silently no-ops and the edit is lost on the next realtime refresh |
| **Calendar** | *(see "Jobs (Calendar view)" above — Calendar is not a separate rendering system; `renderCalendar()` calls the exact same `renderJobsPage(root)` as Jobs, on a different root)* | | | |
| **Quick Quote** | User interaction only (every mutation calls a render function directly) — **no realtime, no polling** at all in `smart-quote/ui.js` | Three independent whole-component replaces (`#sq-main`, `#sq-sidebar`, `#sq-list`), each own its own full-string `innerHTML=` on its own trigger — no morph | **None** — doesn't use `bindRoot`, `ownPixelView`, `rendererRegistry`, or the morph engine; a fully separate module (`public/smart-quote/ui.js`) that only calls into hubly.html/journey.js for cross-cutting utilities (`toast`, `S`, `waitForDb`, `createLead`, etc.) | Architecturally isolated by design (loosely coupled), which is defensible — but it's a third rendering paradigm to maintain, and every keystroke on a text/range answer or customer field is the one exception that patches `#sq-sidebar` alone rather than the whole workspace |
| **Inbox** | User interaction only (tab switch, conversation select, send, sort, etc.) — **confirmed zero realtime subscription and zero polling for messages** | Whole page, single full replace (journey.js:15950-15969), gated correctly (no double stub) | `ownPixelView`, `bindRoot` — **no morph engine used**; `bindRoot` itself has Inbox-specific branches baked in (journey.js:21049-21056), duplicating logic Inbox's own `wireInboxRoot` also has | Yes — **confirmed real gap, not just a style issue**: there is no live-message-arrival path at all. `S().conversations` is only ever mutated by the user's own actions or a one-time demo seed; an inbound message from a real customer would never appear without a full page reload, and even then only if wired to a real fetch (`conversations()` currently only reads a field a legacy, now-unreachable function used to populate) |
| **Analytics → Reports** (`v-reports`, `renderReportsPage`) | User interaction (tabs, filter drawer open/apply, export menu) · nav switch · **no realtime at all** | Whole page, single full replace (journey.js:6994) | `ownPixelView`, `bindRoot` only — no morph engine, no canvas/chart library (charts are static inline SVG path strings, not data-plotted) | Yes — **confirmed real gap**: `refreshOpenAppViews()` has no `viewIsOpen('v-reports')` branch; the only realtime call aimed anywhere near "reports" targets a legacy `#reports-body` element that physically lives inside the Money page's DOM, not `v-reports`. Reports never repaints on a realtime change. Also: the filter drawer's "Apply" button closes the drawer and toasts but never reads the filter fields' values — filtering doesn't actually filter |
| **Analytics → Revenue** (`v-money`, `renderRevenue`) | User interaction (tabs, actions) · nav switch · **no realtime reaching the visible page** | Whole page, single full replace (journey.js:6165) | `ownPixelView`, `bindRoot` only — no morph, no chart library (KPI deltas are hardcoded demo strings) | Yes — same gap as Reports: `refreshOpenAppViews()` does gate on `viewIsOpen('v-money')`, but calls only the legacy `renderMoneyView()`/`renderReports()` globals, never `HublyJourneyOS.renderRevenue()`; and `ownPixelView` strips the legacy DOM those globals target the first time Revenue is opened, so even that fallback becomes a permanent no-op after first visit |

## Per-page detail

### Home (`v-dashboard` / `jos-dash-root`, `enhanceDashboard()` journey.js:14009)

**Render pipeline — the 60-second poll tick:**
```
setInterval fires (journey.js:14789, every 30s)
  → tick guard passes (not hidden, not customizing, no open widget menu, input not focused, Home is active view)
  → root._josLiveTick incremented; every 2nd tick:
  → enhanceDashboard() (journey.js:14009)
    → ownPixelView('v-dashboard','jos-dash-root') (journey.js:13748)
    → renderHomeDashboard(root) (journey.js:14215)
      → root.innerHTML = '...Loading Home…' (journey.js:14216)   ← 1st full replace
      → build full HTML string from jobs()/customers()/homeScores()/etc.
      → root.innerHTML = <full string> (journey.js:14625)         ← 2nd full replace
      → bindRoot(root), widget drag listeners, live-timer re-arm (journey.js:14646-14805)
  → paint
```

**Render pipeline — a widget-menu action (e.g. "Refresh" on one widget):**
```
click [data-jos-act="wmenu-refresh"] (journey.js:14670)
  → toast('Widget refreshed')
  → enhanceDashboard()   ← same full pipeline as above, for one widget's refresh button
```
No widget is patched independently — every Home action, however small, re-runs the entire dashboard build.

### Jobs — list/table (`v-jobs` / `jos-jobs-root`, `renderJobs()` journey.js:17233)

**Render pipeline — inline field edit (table cell or drawer field):**
```
User commits an edit (change/blur event)
  → wireJobsRoot's change listener (journey.js:18541-18567)
    → mutateJobField(jobId, col, value) (journey.js:19770)
      → col.set(job, value) — local mutation
      → persistJobPatch(job, patch) (journey.js:19730)
        → realtimeWrite({table:'jobs', id: job.dbId, write: ...}) (journey.js:19717)
          → global.realtimeAwareWrite(...) (hubly.html:15788) — includes markLocalWrite(table,id) to suppress the echo
          → Supabase .update(patch).eq('id', job.dbId)
    → rerenderJobsOsFrom(root) (journey.js:19878/17226)
      → renderJobs() → renderJobsPage(root) (journey.js:17233→17273)
        → mainView is 'list' → morphTableInto(root, jobsPageHtml) (journey.js:18007)
          → diffs new HTML against existing DOM by data-jos-record-id/data-jos-col-key
          → only changed nodes/attrs are patched
        → bindRoot(root), wireJobsRoot(root) (journey.js:18009-18010)
  → paint (only the changed cell/row actually repaints)
```
Matches the user's example shape exactly, confirmed via code — this is the "already fixed" path.

### Jobs — Calendar view (`v-calendar` / `jos-calendar-root`, `renderCalendar()` journey.js:17259)

`renderCalendar()` is a thin wrapper: it calls the same `renderJobsPage(root)` Jobs-list calls, just with a different root and `mainView==='calendar'`, which flips the `if` at journey.js:18006 to a full replace instead of the morph.

**Render pipeline — drag-to-create:**
```
pointerdown on .jos-gcal-board (journey.js:18342) → create a .jos-gcal-draft div via document.createElement, append it
  → NO render call
pointermove (journey.js:18410) → gcalPaintDraft() (journey.js:18919) sets draftEl.style.top/.height directly
  → NO render call, every frame
pointerup → endGcalPointer(e, true) (journey.js:18294) → openGcalCreatePop(...) — a DOM popup insert, still no full render
User clicks Save → handleJobsAct('jobs-gcal-create-save') (journey.js:20453)
  → saveGcalCreate(root) (journey.js:19374) → createJobAtRange(...) (journey.js:19270) — mutates S().jobs, fires createJob() insert async
  → rerenderJobsOsFrom(root) (journey.js:19427) → renderCalendar() → renderJobsPage(root) → root.innerHTML = jobsPageHtml (journey.js:18006)
  → paint — the ENTIRE calendar grid is torn down and rebuilt for one new event
```

**Confirmed gap — realtime never reaches Calendar:** `refreshOpenAppViews()` (hubly.html:15686-15735) checks `viewIsOpen('v-jobs')` to decide whether to refresh the Jobs page, but contains no `viewIsOpen('v-calendar')` branch and no reference to `renderCalendar`/`jos-calendar-root` anywhere. `S().jobs` itself is still refreshed in memory (the `loadJobs()` call is unconditional), but if the user is looking at the Calendar tab when an external change lands, the grid does not repaint until the user's next local interaction.

### Leads (`v-leads` / `jos-leads-root`, `renderLeads()` journey.js:8981)

Same morph pipeline shape as Jobs-list, via `morphTableInto` (journey.js:9314) — this is the origin of the shared engine, ported to Jobs afterward (see the explicit comment at journey.js:8999-9011 explaining the mechanism, and journey.js:9977-9982 recalling the pre-morph behavior it replaced: *"Used to hand-patch a count label instead of calling renderLeads() here, back when any render tore down and rebuilt the whole table... Now that renderLeads() morphs instead of replacing, a real render is safe."*).

One real asymmetry vs. Jobs: Leads persists through `persistLeadsSoon()` → `persistPipelineSoon()` (hubly.html:43103), a plain 450ms-debounced write to `businesses.meta` with **no `markLocalWrite`/realtime-suppression involvement**. This isn't a bug in the suppression logic — it's that the realtime subscription (hubly.html:15668-15671) only listens on `jobs`/`booking_requests`/`customers`, never `businesses`. Practical effect: a lead edit in one tab/by one user is invisible to any other open tab/session until that person does something that triggers their own refetch. Jobs and Customers don't have this gap.

### Customers (`v-customers` / `jos-customers-root`, `renderCustomers()` journey.js:11860)

**Render pipeline — inline edit-and-save:**
```
Click [data-jos-act="cust-edit"] → handleCustomersAct (journey.js:12328) → root._josCustEditOpen=true → renderCustomers()
  → double full replace, edit form painted (journey.js:11865 stub, then 11910/11942 real content)
User edits fields, clicks Save → [data-jos-act="cust-edit-save"] → handleCustomersAct (journey.js:12338-12362)
  → mutates c.name/phone/email/... directly on the in-memory object only (12342-12349)
  → pushCustActivity(...) (12354)
  → global.saveCustomerDetail(c) (12358) — hubly.html:42516, reads document.getElementById('cd-name'),
    an id that only exists in the LEGACY hubly.html customer-detail template, not in the Journey OS
    Command Center form → name resolves to '' → early-returns via "Name is required" → never calls
    upsertCustomer → THE EDIT IS NEVER WRITTEN TO SUPABASE
  → renderCustomers() repaints the (unsaved) edited values from memory
  → next realtime refresh's loadCustomers() fully replaces S.customers from the DB, silently discarding
    the edit
```
This is a genuine, confirmed data-loss bug sitting directly in the render-trigger chain — flagged here because it was found while tracing renders, not because it's a rendering-strategy issue per se.

**Confirmed double-fire:** `data-jos-cust-tab` and `data-jos-cust-row` clicks are matched by both `bindRoot`'s generic dispatcher (journey.js:21048) and Customers' own separate `wireCustomersRoot` listener (journey.js:12022) — neither calls `e.stopPropagation()` or returns early to block the other, so a single click on a customer row or a tab fires `renderCustomers()` twice.

**Render pipeline — realtime:** identical shape to Home/Jobs (`onRealtimeBizChange` → `refreshOpenAppViews` → `loadCustomers()` full replace → `if (viewIsOpen('v-customers')) HublyJourneyOS.renderCustomersPage()`, hubly.html:15710-15714) — Customers is one of the pages `refreshOpenAppViews` correctly reaches, unlike Reports/Revenue/Calendar below.

### Calendar — realtime gap, restated

Already covered under "Jobs (Calendar view)" above since Calendar is not architecturally separate — `renderCalendar()` is a thin wrapper around the same `renderJobsPage(root)` Jobs-list uses. The two confirmed findings worth restating here since they answer "why does this feel different": (1) the full-replace-not-morph choice for the calendar grid, made deliberately for drag-and-drop safety; (2) `refreshOpenAppViews()` has no `v-calendar` branch, so an external realtime change never repaints the grid while it's open.

### Inbox (`v-chats` / `jos-inbox-root`, `renderInbox()` journey.js:15597)

**Render pipeline — sending a message:**
```
Click [data-jos-act="inbox-send"] or ⌘/Ctrl+Enter → handleInboxAct('inbox-send', t) (journey.js:16254-16269)
  → mutateInboxConv(fn) (journey.js:16091) — pushes {dir:'out', text, at:'Just now'} into the in-memory
    conversation's .messages array — NO Supabase write, no Twilio/SMS call, nothing persisted anywhere
  → renderInbox() (journey.js:16103) → renderInboxPage(root) → single root.innerHTML= (journey.js:15950-15969)
  → stream.scrollTop restored manually (journey.js:15974-15977)
  → paint
```

**Confirmed real gap — no live inbound messages:** Inbox has zero realtime subscription (`_realtimeChannel` only listens on `jobs`/`booking_requests`/`customers`) and zero polling. `S().conversations` is only ever mutated by the user's own UI actions or a one-time demo seed. A message from a real customer arriving while Inbox is open would never appear without a full page reload — and the reload path itself (`conversations()`, journey.js:13757) only reads a field (`S.chatConversations`) that's populated by a legacy function (`renderChatsPanel()`, hubly.html:42946) which is no longer reachable while Journey OS owns the page. This is a data/live-update gap, not just a rendering-strategy one.

### Quick Quote (`v-quotes`, `public/smart-quote/ui.js`)

Confirmed as a fully separate rendering system — no `bindRoot`, `ownPixelView`, `rendererRegistry`, or morph engine anywhere in the file. Three independently-targeted roots (`#sq-main`, `#sq-sidebar`, `#sq-list`), each driven by direct `document.getElementById(id).innerHTML = template()` calls wired from inline `onclick`/`oninput` attributes rather than one delegated listener.

**Render pipeline — toggling a package on an open quote:**
```
Click a package tile → inline onclick="HublySmartQuoteUI.togglePackage(id)" (ui.js:560)
  → togglePackage(id) (ui.js:363-371) — sets st.packageIds, clears the cached quote snapshot
  → renderWorkspace() (ui.js:520-658) — recomputes live pricing, root.innerHTML = <full step HTML> (ui.js:634-656)
  → renderSidebar() (ui.js:657→479-506) — recomputes totals, side.innerHTML = <estimate card HTML> (ui.js:494-505)
  → paint — both #sq-main and #sq-sidebar fully rebuilt for one tile click
```
No realtime, no polling anywhere in this module — quotes are `localStorage`-only (`persistQuotes`, ui.js:978-983) until explicitly saved/sent, at which point `createQuickQuote()` (defined locally, ui.js:826-834) hands off to hubly.html's creation engine.

### Analytics → Reports (`v-reports` / `jos-reports-root`, `renderReportsPage()` journey.js:6989)

**Render pipeline — Filters → Apply:**
```
Click "Filters" → handleReportsAct('rpt-filter-open') (journey.js:7113) → root._josRptFilterOpen=true → renderReportsPage()
  → whole-page replace, drawer visible
Click "Apply" → handleReportsAct('rpt-filter-apply') (journey.js:7114) → root._josRptFilterOpen=false; toast('Filters applied')
  → renderReportsPage() — but the drawer's own <select>/<input> values (date range, service, source,
    membership) are never read anywhere — no state write happens — so "Apply" only closes the drawer
    and shows a toast; the underlying data (rptAggregates(), journey.js:6625) is completely unaffected
```
The header's date-range button is an explicit stub: `toast('Date range picker is Stage 1 demo'); return;` (journey.js:7122) — no render at all.

**Confirmed real gap — no realtime path reaches Reports.** `refreshOpenAppViews()` (hubly.html:15686) has no `viewIsOpen('v-reports')` branch. There's a legacy `renderReports()` (hubly.html:45938, target `#reports-body`) that superficially sounds like a match, but that element physically lives inside the Money page's DOM (hubly.html:11415-11439), not inside `v-reports` — so even the fallback is aimed at the wrong page. Reports never repaints on an external jobs/customers/booking change; it only ever repaints on a direct user interaction.

Charts are static inline `<svg><path d="...">` strings (journey.js:6748, 6759-6763) — decorative, not data-plotted from real aggregates, and just regenerated as markup on every full render along with everything else. No canvas, no chart library anywhere in the file.

### Analytics → Revenue (`v-money` / `jos-revenue-root`, `renderRevenue()` journey.js:6170)

Same shape as Reports: whole-page single replace (journey.js:6165), no morph, no chart library (KPI deltas like `+18.6%` are hardcoded demo strings, journey.js:5925-5929, with an explicit comment that Stage 1 doesn't keep prior-period aggregates to compute a real delta from).

**Confirmed real gap, slightly different mechanism than Reports':** `refreshOpenAppViews()` *does* gate on `viewIsOpen('v-money')` and *does* call something — but only the legacy `renderMoneyView()`/`renderReports()` globals (hubly.html:44985/45938), never `HublyJourneyOS.renderRevenue()`. Worse: `ownPixelView('v-money','jos-revenue-root')` strips every sibling of `#v-money` the first time Revenue is opened as the Journey OS page — permanently removing the legacy DOM (`#money-invoice-list`, `#m-total`, etc.) those fallback functions target. So after a business's very first visit to Revenue, even that fallback becomes an inert no-op (`document.getElementById` returns null, function early-returns). **The visible Revenue page never repaints on a realtime change, ever, after first load.**

## Bugs found while tracing (not the point of this audit, but real)

Tracing render triggers surfaced several concrete bugs unrelated to rendering *strategy* — listed here so they aren't lost, not acted on:

1. **Customer edits are never persisted.** `saveCustomerDetail()` (hubly.html:42516) reads a legacy DOM field (`cd-name`) that doesn't exist in the Journey OS Command Center edit form — every inline customer edit-and-save silently fails to write to Supabase and is lost on the next refresh.
2. **Customers double-renders on click.** `data-jos-cust-tab`/`data-jos-cust-row` clicks are handled by both `bindRoot` and Customers' own `wireCustomersRoot`, neither stopping the other.
3. **Calendar never repaints on realtime change**, and **Reports/Revenue never repaint on realtime change at all** (Revenue only until first visit, via a stale legacy-DOM fallback that then permanently no-ops). Jobs/Leads/Customers/Home are the only pages `refreshOpenAppViews()` actually reaches.
4. **Reports' filter drawer doesn't filter.** "Apply" closes the drawer and toasts without reading any of the drawer's own field values.
5. **Inbox has no live-message path at all** — not a rendering gap, a data gap: nothing external ever pushes into `S().conversations` while the app is open.
6. **Leads' own edits aren't realtime-synced across tabs/sessions** — an artifact of the realtime subscription only covering `jobs`/`booking_requests`/`customers`, never `businesses` (where lead data lives).
7. **Calendar double-renders on nav switch** — both `HublyJourneyOS.renderCalendar()` (hubly.html:38577) and `onSwitchView('calendar')`'s own map entry fire on the same switch.

## Answering the three questions directly

**Why does Leads feel smoother than Jobs?** It mostly no longer should, for the table/drawer — both now morph. The residual difference is almost certainly Jobs' **Calendar** view, which still does a full teardown/rebuild by deliberate, documented choice (drag-and-drop risk), plus a confirmed realtime gap that leaves Calendar stale until a local interaction forces a repaint.

**Why does Home appear to rerender periodically?** Because it does, on purpose: a 30-second timer forces a full double-replace rebuild every 60 seconds, on top of a full rebuild on every job/customer/booking write anywhere in the business, on top of nearly every small widget interaction also triggering the same full rebuild instead of a local patch.

**Do multiple rendering architectures exist?** Yes, three: (1) the shared morph engine (Leads + Jobs-list only), (2) plain full-`innerHTML`-replace (Home, Customers, Jobs-Calendar, Inbox, Reports, Revenue — several of these double-replacing), and (3) Quick Quote's fully independent, multi-root, non-`bindRoot` system. They didn't evolve for good technical reasons across the board — the morph engine was built once (for Leads) and manually ported once more (to Jobs-list) to fix a specific reported flash; nothing systematic decided who gets it and who doesn't.

**Should we standardize on one rendering pipeline?** That's the natural next question once this audit is read, but per the ask, no migration decision or recommendation is being made in this document — this is the trace, not the plan.
