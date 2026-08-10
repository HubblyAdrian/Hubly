# Known Issues

Real, identified, not-yet-fixed defects — each with enough detail that someone
with no prior context on the investigation could act on it directly. Not a
backlog of ideas; only things that were actually found and traced to a cause
while working on something else. See `docs/HUBLY_RENDERING_STANDARD.md` §4.7
for the general debugging pattern that catches this class of bug.

---

## Jobs list: `renderJobsBulkBar()` can still trigger the destroy/rebuild-cascade bug

**File**: `public/journey-os/journey.js`
**Function**: `renderJobsBulkBar(root)`, line 17647 — specifically the early return at line 17650:
`if (!ids.length) return '';`
**Called from**: `renderJobsPage(root)`, line 18040 (`renderJobsBulkBar(root) +`)

### Background — same bug class as the one just fixed

`docs/HUBLY_RENDERING_STANDARD.md` §10 ("The actual root cause of 'Jobs still
renders on every click'") documents a bug where `positionJobsComboPop()`
reparents Jobs' Status/Service dropdown popover out of its rendered DOM
position for CSS positioning reasons. Because that popover used to render
*before* several other elements in the same container (the drawer, two
popover-menu placeholders, and the FAB button), reparenting it caused the next
render's diff to see a structural mismatch and destroy-and-rebuild every
sibling positioned after it — including the open drawer, which has a CSS
entrance animation that replayed every time, producing a visible flash. That
specific instance was fixed by moving the popover to be the *last* sibling in
its container (commit `58489be`).

### Why this one is still open

`renderJobsBulkBar()` has the identical shape of problem: it conditionally
returns an empty string vs. a real `<div class="jos-ld-bulk-bar">` block
depending on whether any rows are bulk-selected (`if (!ids.length) return
'';`). It still sits *before* the drawer, both popover-menu placeholders, and
the FAB button in `renderJobsPage`'s concatenated HTML string (same container,
`.jos-jobs-shell`). Toggling bulk-select on/off (checking or clearing the last
selected row) changes whether this block contributes a node to the tree — the
same class of length-mismatch-on-next-render that the combo-pop fix
addressed, just triggered by a different element and a different user action.

**Concretely**: if a user has the Jobs drawer open (viewing/editing a specific
job) *and* also has one or more rows bulk-selected in the table behind it, and
then selects/deselects a row to make the bulk-selected count cross the
`0 ↔ 1+` boundary, the next render could destroy and rebuild the open drawer
the same way the combo-pop reparenting used to.

### Why it wasn't fixed alongside the combo-pop bug

Not because it's harmless — because it wasn't confirmed live the way the
combo-pop bug was (DOM-identity tagging + a real reproduction). It was found
by re-reading the render structure after the actual fix, not independently
verified. It's also a much rarer real-world combination of state: bulk-select
is a table-browsing action, the drawer is a single-record-focus action: most
users aren't doing both at once. Given the investigation's own hard-won
lesson (§4.7: verify, don't infer), it's listed here as a suspected-but-
unconfirmed instance of the same bug, not claimed as a proven one.

### How to confirm and fix it, if picked up

1. Reproduce: open the Jobs drawer on one job, then in the table behind it,
   check a row's bulk-select checkbox (going from 0 to 1 selected).
2. Confirm with the same technique used for the original bug: tag the live
   `.jos-jobs-drawer` DOM node (`node.__tag = 'x'`) immediately before
   checking the box, then check whether the tag survived after. `undefined`
   means it was destroyed and rebuilt, not patched — that's the bug,
   reproduced.
3. If confirmed, the fix is the same shape as the combo-pop fix: move
   `renderJobsBulkBar(root)` to be the last element in `renderJobsPage`'s
   concatenated HTML string (after the FAB button, alongside where
   `renderJobsComboPop(root)` now sits — see the comment directly above it in
   the source for the full reasoning). Confirm no CSS selector or JS code
   depends on the bulk bar's current sibling position before moving it.
4. Re-run the fix's own regression set: bulk-select still opens/closes
   correctly, the bulk actions (delete, clear selection) still work, drag-to-
   reschedule/resize on Calendar are unaffected (different container, but
   worth a sanity check since Calendar shares `renderJobsPage`).
