# Jobs vs. the Hubly Table Standard — Gap Analysis

Audited against `docs/HUBLY_TABLE_STANDARD.md` (the Leads page, frozen as of commit
`92e4df8`). This is an audit, not a redesign proposal — Leads already defines what Jobs
should become; this document lists the distance between them.

Scope: `renderJobsPage` / `renderJobsTable` (the `col-*` table in
`public/journey-os/journey.js`, roughly lines 16521–17330) and its CSS
(`.jos-jobs-table*` rules in `operate-pixel.css`). The Jobs Calendar view and the Jobs
detail drawer's tabs (Overview/Photos/Checklist/etc.) are out of scope — this is about
the table specifically, mirroring what the standard document covers for Leads.

## Technical blockers (fix before anything else)

1. **Already fixed this session**: `jobs-start/pause/resume/complete/cancel/delete`
   mutated local state and re-rendered without ever writing to Supabase. This is why
   customers reported status changes and deletes reverting on refresh. Fixed via
   `persistJobPatch`/`persistJobDelete` (commit `18dbdbf`) — confirm this is holding in
   production before layering more work on top of Jobs.
2. **No `tablePreferences` integration at all.** Every other capability gap below
   (reorder, resize, hide, custom fields) depends on this existing first — it's the
   foundation, not one gap among many. Leads' `loadLeadsColumns`/`saveLeadsColumns`
   wrapping `tablePreferences.load/save/normalize('user'|'business', 'jobs', ...)` is the
   pattern to copy; the engine itself needs no changes, only a Jobs-specific schema
   object and table key.
3. **No schema object exists.** Leads' entire interaction model (renderer registry
   dispatch, click-to-edit, dropdowns-save-immediately, search/filter/sort) is driven by
   `LEADS_DEFAULT_COLUMNS`. Jobs' table is hand-built HTML per column with no equivalent
   schema. This is the second foundational piece — most of what's listed below as an
   "interaction difference" falls out for free once a `JOBS_DEFAULT_COLUMNS` schema
   exists and the table renders through the same `rendererRegistry` Leads already built.

## Interaction differences

| Leads (standard) | Jobs (today) |
|---|---|
| Cell displays as text/pill; click reveals an input, blur/select commits | Customer, Phone, Service, Date, and Time render as **permanently-live `<input>` elements** — every cell is always in edit mode, all the time |
| Status is a dropdown that opens on click | Status **is** already a `<select>` inline — this one already matches |
| Clicking the record's name opens the detail panel; renaming happens via double-click | Opening the job requires clicking a small circular avatar button (`data-jos-act="jobs-open"`) next to the customer name — the name itself is just another always-editable input, not a link to the record |
| Single click elsewhere selects the row (no side effect) | No row-selection concept exists — there's no bulk-select mode, so nothing to select into |
| KPIs are ambient text, non-interactive | Job KPI chips (`jobs-kpi-all`, `jobs-kpi-scheduled`, etc.) **are** clickable and act as filters — not wrong, just a different pattern than Leads uses; worth a product decision (keep as a deliberate Jobs-specific affordance, or align with Leads' plain KPI line) rather than silently picking one |
| Search is the dominant, full-width, first control | Search shares a row with two dropdowns and a "More Filters" button — this is exactly Leads' toolbar shape *before* the P1 polish pass, not after |

## Visual differences

- Table headers are tracked uppercase (`text-transform:uppercase;letter-spacing:.05em`),
  48px tall — Leads moved to sentence case, 32px, no letter-spacing.
- No header hover state defined at all (Leads: subtle background tint on hover).
- No cursor-state differentiation — everything is a plain text input, so the whole
  question of "does this cursor match what a click does" doesn't yet apply the way it
  does on Leads, but once cells stop being permanently-live inputs, this becomes
  relevant.
- Row density: need to confirm actual row height in the live DOM; the always-visible
  `<input>` fields likely force taller rows than Leads' 44px regardless of any CSS
  `height` rule, since inputs carry their own vertical padding/line-height.
- No visible "+" add-column affordance — consistent with there being no column schema
  to add to yet.

## Missing capabilities

- Drag to reorder columns — none.
- Drag to resize columns — none.
- Hide/show columns — none.
- Business-wide custom fields — none.
- Per-user column preferences — none (see Technical Blockers above).
- Floating bulk-action bar / bulk row selection — none. (Bulk status-change or
  bulk-delete for jobs doesn't exist as a concept yet.)
- Side panel pattern — Jobs actually **has** an equivalent: `renderJobsDrawer` /
  `.jos-jobs-drawer`, a right-side panel with tabs (Overview/Photos/Checklist/Messages/
  Invoice/Timeline). This is structurally close to what the standard asks for; it needs
  a comparison pass against Leads' panel (open/close animation timing, header layout,
  typography) rather than being built from scratch.

## Missing polish

- Empty state (`.jos-jobs-empty`, "No jobs yet.") needs the same audit Leads just went
  through: does it collapse the table structure, or keep headers real? Does it
  distinguish "no jobs exist" from "filters matched nothing"? (Given the toolbar's
  filter surface is larger than Leads' — date/service/location/source/tag — this
  distinction matters more here, not less.)
- No loading-state animation confirmed one way or the other — needs the same quick pulse
  Leads got if it's using a similarly bare "Loading…" string.
- Animation timing on the Jobs drawer open/close vs. Leads' panel — not yet compared.

## Suggested sequencing

Not a redesign — closing the real gaps in the order that unblocks the most other gaps:

1. Confirm the persistence fix is solid in production (already shipped, needs real-world
   confirmation, same as the Leads "+" button fix needed).
2. Build `JOBS_DEFAULT_COLUMNS` + wire `renderJobsTable` through the existing
   `rendererRegistry` and `leadTableCellHtml`-equivalent dispatch. This alone converts
   the "always-live inputs" problem into click-to-edit for free, and gives Status (already
   a dropdown) a consistent home.
3. Wire `tablePreferences` for the `'jobs'` table key — unlocks reorder/resize/hide/
   custom fields in one pass, same as it did for Leads.
4. Typography/cursor/hover pass — mechanical once the schema exists, since it's the same
   CSS classes Leads already has, applied to Jobs' markup.
5. Empty-state and bulk-bar — smaller, can land independently once 2–3 are done.
