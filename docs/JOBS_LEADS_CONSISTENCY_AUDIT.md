# Jobs vs Leads Consistency Audit

Report only — nothing below has been implemented. Goal: identify everywhere Jobs and Leads still feel like two separately designed pages instead of two views of the same table engine, across the twelve dimensions requested. Where something can be shared, that's called out as a **Unify** recommendation; where a difference is justified, it's marked **Keep, documented** with the reasoning.

Both tables already share the real foundation: `.jos-ld-table`/`.jos-ld-trow`/`.jos-ld-th` CSS, the `rendererRegistry`/`tableCellHtml` cell-editing engine, click-to-edit + Escape-to-cancel + blur-to-commit, and (as of this session) a parallel bulk-select/delete system. The gaps below are everywhere that shared engine stops and each page goes its own way.

## Headline finding: Leads' table headers are a full grid; Jobs' are static labels

Leads' `<th>` elements (`renderLeadsTable`, journey.js:8633-8648) carry: a drag handle (`draggable="true"`) for column reordering, a resize handle (`data-jos-col-resize`, live-tracked via a `mousedown`/`mousemove` listener at :10088-10116), double-click-to-rename, and a `▾` column options menu (`leads-col-menu`). Jobs' `<th>` elements (`renderJobsTable`, journey.js:16893-16896) are a bare `<span>` — none of the above. A user who's learned to resize/reorder/rename columns in Leads has no reason to expect it won't work in Jobs, and no indication why not.

**Unify.** This is the single largest interaction gap between the two tables and the most valuable one to close — it's already-built, tested code in the Leads path; Jobs' column schema (`JOBS_DEFAULT_COLUMNS` + `tablePreferences.load('user','jobs',...)`) already supports persisted width/order/hidden per column, same shape as Leads'. The header markup and the resize/reorder/rename event handlers just never got extended to cover Jobs' `data-jos-col-key` elements too.

## Keyboard behavior

Leads has full roving-tabindex ARIA-grid navigation (journey.js:10062-10083): arrow keys move the active cell, Tab is a single stop into/out of the grid, Enter opens edit on the focused cell. Jobs has none of this — no `role="gridcell"` keydown listener, no active-cell state, no arrow-key handling at all. A keyboard user (or anyone used to Sheets/Attio-style navigation, which Leads explicitly imitates per its own comments) gets a materially worse experience on Jobs for no product reason.

**Unify.** Same underlying `tableCellHtml`/`findLeadsColumnDef`-vs-`findJobsColumnDef` split as everything else here — the grid-nav logic operates on `role="gridcell"`/`data-jos-col-key` generically enough that porting it to Jobs is mechanical, not a redesign.

## Row actions

Leads table rows have **zero** trailing action affordances — no open arrow, no per-row "⋯" menu. The only way to open a lead from the table is clicking the name cell (`openOnClick`). Jobs rows have both: an explicit ↗ arrow and a "⋯" menu in a dedicated `col-act` column (journey.js:16980-16983).

This one **cuts both ways** and isn't obviously a bug in either direction:
- Jobs' arrow is genuinely useful because Jobs' primary column is Customer, but the record's "identity" arguably reads more naturally through Service/Status — an explicit "open" affordance removes ambiguity about what a click on a non-name cell does.
- Leads relying on name-click-only is *simpler*, and matches the "arrow = open, everything else edits" rule from your original design note — but that rule was written for Jobs, and Leads never got an arrow at all, so Leads' simplicity looks more like it predates that rule than a deliberate choice to omit the arrow.

**Recommendation: Unify toward Jobs' pattern** (add the ↗ arrow to Leads) rather than removing Jobs' arrow — you already confirmed the arrow-to-open pattern explicitly in the last round of feedback ("I LOVE this. Keep it."). Leads' per-row "⋯" menu is a separate question: Leads doesn't currently have ANY row-level actions beyond open/edit (no duplicate/delete-from-row today outside bulk mode) — whether it needs one is a product call, not a consistency fix, so left unrecommended here.

## Bulk actions

Both tables now have the same underlying mechanism (checkbox column, header select-all, shift-click range select, floating bulk bar) — built to be identical this session. But the **bar contents** differ sharply:

| | Leads | Jobs |
|---|---|---|
| Actions | Assign, Change Status, Add Tag, Export, Delete | Delete only |

**Keep, documented — for now.** Jobs' bulk bar was scoped to Delete deliberately this session because that was the explicit, literal ask ("a way to delete leads and multiple leads and jobs") — building bulk Assign/Status/Tag/Export for Jobs wasn't requested and would have been scope creep at the time. It's a real gap worth closing, but as a follow-up task, not silently expanded into this audit.

## Filters

Two different UI paradigms for "more filters":
- **Leads**: inline dropdowns (Source/Service/Owner) always visible, plus a slide-out **drawer** (`renderLeadsFilterDrawer`, `leads-filter-open`) for anything beyond that.
- **Jobs**: inline dropdowns, plus an inline **expandable section** (`jos-jobs-filters`, `jobs-filters-toggle`) that pushes content down rather than sliding in, *plus a second, separate* "Advanced" `<aside>` (`jos-jobs-adv`) with a different field set (Revenue Range, Travel Radius, Customer Type).

**Unify.** Jobs effectively has two tiers of "more filters" where Leads has one; a user has to learn two different disclosure patterns (expand-in-place vs. a whole separate advanced panel) to find everything. Collapsing Jobs' inline section + Advanced aside into a single drawer matching Leads' pattern removes both the extra UI paradigm and the "which one has the filter I want" ambiguity.

## Pagination

- **Leads**: "Load More Leads" — cumulative reveal, no page numbers, no page-size control.
- **Jobs**: numbered pager (Previous / 1 2 3 / Next) + a 25/50/100-per-page `<select>`.

**Keep, documented, but worth a product call.** These are two legitimately different pagination philosophies (infinite-reveal vs. discrete pages), not a bug in either — but there's no evident reason Jobs needs page numbers while Leads doesn't (both are the same kind of flat, sortable/filterable list). If there's no data-volume or workflow reason for the difference, it should converge on one pattern; flagging rather than picking one, since this is a real product preference, not a clear correctness issue.

## Responsive behavior

- **Jobs**: has a dedicated `max-width:1023px` breakpoint that hides the table entirely and swaps in `.jos-jobs-cards` (a purpose-built mobile card layout, `mobileCards` in `renderJobsPage`).
- **Leads**: no equivalent breakpoint exists for its table. Below whatever width the table stops fitting, it presumably just overflows/scrolls horizontally, unless the user has manually switched to "List" view (a permanent user choice, not a responsive one — List stays List at 1600px wide too).

**Unify — this is a real gap, not a style choice.** A narrow-viewport Leads user gets a horizontally-scrolling table; a narrow-viewport Jobs user gets a purpose-built card layout. Leads either needs the same auto-swap Jobs has, or (cheaper) needs its existing List view to auto-activate below the same breakpoint Jobs uses, so neither table leaves a mobile user staring at a table wider than their screen.

## Drawers / detail panels

Structurally different by design, not by accident:
- **Leads workspace** (`renderLeadWorkspace`): a single scrolling panel — header (avatar/name/status), a row of quick-action icon buttons (Call/Text/Email/...), then content sections. No tabs.
- **Jobs drawer** (`renderJobDrawer`): tabbed — Overview / Photos / Checklist / Invoices.

**Keep, documented.** Jobs has content types (before/after photos, a checklist, an invoice) that Leads genuinely doesn't have equivalents for — tabs earn their place here. This isn't recommended for unification; forcing Leads into tabs it doesn't need, or collapsing Jobs' tabs into one long scroll, would both make things worse. Two caveats worth a closer look (out of scope for this audit, flagged for awareness): `docs/JOBS_DRAWER_AUDIT.md` already found the Jobs drawer's Photos/Checklist/Invoice tabs are mostly non-persisting stubs — so today's "difference" is partly a real feature gap dressed as a design difference, not a settled architecture worth defending as-is.

## Empty states

Both tables' in-table empty row (`.jos-ld-empty-table`, shown when the filtered list is empty) follow the same shape: bold heading, one line of copy, a primary "New X" button. Consistent.

**One piece of dead code found along the way:** Jobs has a second, larger empty-state block (`jos-jobs-empty`, journey.js:17068-17072, with its own decorative `-art` element) that's built but never referenced anywhere else in the file — `emptyTable` is assigned and never used. Not a design inconsistency (nothing renders it), just leftover code from an earlier version of the empty state. **Recommend deleting it** the next time anyone's in this area, same spirit as `JOBS_DRAWER_AUDIT.md`'s dead-code findings.

## Spacing & typography

**Consistent — verified, not just assumed.** Both tables render through the exact same CSS classes (`.jos-ld-table`, `.jos-ld-th`, `.jos-ld-trow`, `.jos-ld-td`), and a live computed-style comparison (header: 12px/600/18px line-height; body cells: 13.5px/400/18.9px line-height; cell padding: 0 16px) came back byte-for-byte identical between the two pages. The visual-weight difference flagged in earlier feedback predates this session's redesign work (fewer columns, no Job # column stealing focus, "—" instead of repeated "Click to add") — no residual font/spacing token mismatch exists today.

## Hover states

**Row hover: consistent** — both use the shared `.jos-ld-trow:hover`/`.jos-ld-trow.on` rules. **Column header hover: inconsistent**, but that's a direct consequence of the headline finding above (Leads' headers have resize/drag/menu affordances to hover; Jobs' don't) — not a separate issue, folds into the "Unify column header interactions" recommendation.

## Loading states

**Consistent — neither table has one.** Both render synchronously from already-loaded local state (no fetch-on-render, no skeleton, no spinner) — a shared gap rather than a difference between the two. Not flagged as a fix, since introducing one is a bigger architectural conversation (would need an actual async-load boundary that doesn't exist today) and wasn't part of what broke consistency between the pages.

## Editing interactions

**Consistent at the mechanism level** — same `rendererRegistry`/`tableCellHtml` dispatch, same click-to-edit → blur/change-commits → Escape-cancels flow, same `showPicker()` fix (this session) for date/time fields on both. The only material difference is Enter-to-edit, which is really the keyboard-behavior gap above (Leads' grid-nav keydown handler is what wires Enter to `openLeadsCellEdit`; Jobs has no equivalent listener at all, so Enter does nothing on a focused-but-not-editing cell).

## Summary of recommendations (not yet implemented)

1. **Unify column header interactions** — port resize/drag-reorder/double-click-rename/column-menu from Leads' `<th>` onto Jobs'. Highest-value item; infrastructure already exists.
2. **Unify keyboard grid navigation** — port the roving-tabindex arrow-key/Enter handler from Leads onto Jobs.
3. **Add the ↗ open arrow to Leads' rows**, matching the confirmed-good Jobs pattern, rather than removing it from Jobs.
4. **Unify filters into one disclosure pattern** — collapse Jobs' inline-section + separate Advanced aside into a single drawer matching Leads'.
5. **Give Leads a responsive card/list fallback** at the same breakpoint Jobs auto-swaps at, so neither table leaves mobile users with a horizontally-scrolling grid.
6. **Delete dead code**: Jobs' unreferenced `jos-jobs-empty`/`emptyTable` block.
7. **Product call, not a fix**: reconcile Load More vs. numbered pagination (Leads vs. Jobs) — no technical reason found for the difference, but not overriding a product preference unprompted.
8. **Deliberately not recommended**: Jobs' tabbed drawer vs. Leads' single-scroll panel, and Jobs' bulk bar having only Delete vs. Leads' five actions — both are justified today (real content-shape difference; explicit scope from this session's ask), documented rather than changed.
