# Hubly Table Standard v1

**Status: Frozen.** The Leads page (`public/journey-os/journey.js` — `renderLeadsPage` and
everything it calls — plus `public/journey-os/operate-pixel.css`, the `.jos-ld-*` rules) is
the reference implementation of every rule below. No further redesigns or feature
experiments land on Leads' table/interaction layer without a specific bug or a new rule
being added to this document first. Every other table in Hubly is judged against this
checklist, not against its own taste.

Reference the live implementation, not this document, for exact CSS values and code —
this file is the checklist and the reasoning, not a spec to re-derive the numbers from.

**Correction pass (post-freeze):** a full reverse-engineering audit of Leads' rendering
behavior (`docs/HUBLY_RENDERING_STANDARD.md`) found two places below had drifted from the
live code since this doc was frozen — the double-click behavior described in the checklist
was removed in a later commit, and the morph-engine function names were never what this doc
said. Both are corrected below, with a note at each spot. "Frozen" still means no further
redesign without a new rule — it doesn't mean this file gets to describe behavior that no
longer exists. See `HUBLY_RENDERING_STANDARD.md` for the exhaustive, line-cited trace behind
every correction.

## The checklist

- Sentence-case headers ("First name", not "FIRST NAME")
- Dense row spacing (44px rows, 32px header — not padded like a marketing page)
- Inline editing: click a cell, it edits, no separate "edit mode" for the row
- Dropdowns save immediately on selection — no Save/Cancel/Apply for a single field
- The record's name opens the detail panel. **(Corrected.)** A plain click elsewhere on the
  row only selects/highlights it. Double-click used to also open the panel as a power-user
  shortcut — that was removed (commit `2f5b73b`, "Remove double-click everywhere..."); on
  Leads today double-click has exactly one job, renaming a column header, and only the name
  cell opens the panel. Table view is currently the only view this works from at all — List
  view's cards have no click path to the panel (`HUBLY_RENDERING_STANDARD.md` §1.6)
- Side panel for full record details, not a separate page navigation
- Drag to reorder columns
- Drag the column edge to resize — **(known regression, not a design change)**: the resize
  handler currently references an undeclared variable and throws on the first drag tick, so
  live resize is non-functional right now (`HUBLY_RENDERING_STANDARD.md` §1.5, bug #1). The
  rule stands — this is a bug to fix, not a rule to drop.
- Per-user table preferences (column order/width/hidden state), synced via
  `tablePreferences.load/save/normalize` — never localStorage-only
- Business-wide custom fields, typed (text/number/date/checkbox/select/phone/email/url),
  added via an inline popover — never `window.prompt()`, never a settings sub-page
- Floating bulk-action bar, appears only once rows are actually selected
- Search leads the page — full-width, first row, not one dropdown among several
- No unnecessary page header/title — the table starts almost immediately
- Soft hover states on rows, header cells, and every clickable control
- Consistent typography — one type scale, no page-specific font sizes invented ad hoc
- Smooth animations (100–220ms) on panel open/close, popover open, drawer slide-in
- No Save buttons for inline edits, ever — click, change, done

## Cursor states (the detail that makes it feel alive)

Cursor must always describe what a click on that exact spot does — this was audited and
fixed on Leads (`operate-pixel.css`, the `.jos-ld-name-cell` / `.jos-ld-select-cell` /
`.jos-ld-status-pill` rules) and should be treated as load-bearing, not decorative:

| Cursor | Means |
|---|---|
| `text` | Click edits inline as free text (phone, email, custom text/number/date fields, tags) |
| `pointer` | Click opens a dropdown/picker (status, service, assigned, checkbox toggle) or opens the record (the name cell) |
| `col-resize` | Hovering a column's resize handle |
| `text` (on the header label) | Double-click renames the column |
| `grab` | Dragging a column header to reorder |

## Empty states

Never collapse the table structure away when there are zero rows — headers, column
drag/resize, and the "+" add-column button all stay real and usable. Only the body
changes. And the *reason* it's empty changes the copy:

1. **No records exist at all** → "No leads yet — Create your first lead or connect a
   form." + a primary action button.
2. **A specific tab is empty by design** (e.g. Lead Recovery with nothing to recover) →
   copy specific to that tab, not the generic message.
3. **Search or a filter matched nothing, but records exist** → "No matches — Try a
   different search or clear your filters." Never tell someone to "create their first
   record" when they already have some and just filtered past all of them.
4. **A tab is empty with no active search/filter** → "No leads in this view — Try a
   different tab."

## Persistence — the part that isn't visible but matters most

Every mutation goes through one of two centralized functions
(`mutateLead`/`mutateLeadById` on Leads) that call the real persist function themselves.
This was a real, shipped bug: individual click handlers used to be trusted to remember to
call the persist function after mutating state, and several of them didn't — edits looked
saved, then reverted on refresh. **Whatever the next table's mutate function is called,
persistence belongs inside it, not scattered at each call site.** Verify this by testing
the boring way, every time: edit a field, refresh, confirm it stuck; delete a record,
refresh, confirm it's still gone.

## Reusable pieces (don't rebuild these per table)

- `tablePreferences.load(scope, tableKey, onRemote)` / `.save(scope, tableKey, data)` /
  `.normalize(schema, saved)` — generic column-preference persistence, keyed by
  `tableKey`. A new table passes its own key; the engine itself needs no changes.
- `rendererRegistry` — one entry per field type (text/phone/email/url/number/date/
  checkbox/tags/select), each with `display()`/`edit()`/optional `readValue()`/
  `writeValue()`. A new table's schema columns reference these by `type`; the renderer
  itself is shared.
- The DOM-morphing render path — **(corrected: the function names above were never real)**.
  The actual functions are `morphTableInto`/`morphTableAttrsAndProps`/`morphTableNode`/
  `morphTableKeyedChildren`/`morphTableChildren` (`journey.js:9012-9127`), keyed by
  `data-jos-record-id` (rows) / `data-jos-col-key` (cells/headers) — generic names because
  they're not Leads-exclusive: Jobs' list view (not its Calendar view) morphs through this
  exact same engine. This is what makes edits and drag-reorder flicker-free; it does *not*
  currently make resize flicker-free, since resize doesn't call it at all — see the resize
  bug above. Full guarantees (node identity, focus, selection, edit-mode, scroll — what's
  preserved and why) are in `HUBLY_RENDERING_STANDARD.md` §4, not re-derived here.

## What "compare against the standard" means in practice

When auditing another table (Jobs, Customers, Storefront Orders, Invoices) against this
document, produce a gap analysis, not a redesign proposal:

- **Interaction differences** — does clicking a cell do what this checklist says it
  should?
- **Visual differences** — typography, spacing, hover/cursor states vs. the checklist.
- **Missing capabilities** — drag/resize/reorder columns, custom fields, bulk actions,
  search, the side panel.
- **Missing polish** — animations, empty states, loading states.
- **Technical blockers** — anything that needs fixing before the table can even reach
  this standard (e.g. a persistence bug, a data-shape mismatch) — call these out
  separately since they're often higher priority than any visual gap.

Then build only what's necessary to close the real gaps. The target is already defined —
the work is closing the distance to it, not re-deciding what "good" looks like table by
table.
