# Known Issues

Real, identified defects — each with enough detail that someone with no prior
context on the investigation could act on it directly. Not a backlog of
ideas; only things that were actually found and traced to a cause while
working on something else. See `docs/HUBLY_RENDERING_STANDARD.md` §4.7 for
the general debugging pattern that catches this class of bug, and §4.8 for
the specific "conditionally-present block" bug class below.

---

## CONFIRMED AND FIXED — Jobs drawer/bulk-bar destroy/rebuild cascade

**File**: `public/journey-os/journey.js`
**Functions**: `renderJobsBulkBar(root)`, the `drawer` variable in
`renderJobsPage(root)`, plus new `stableSlot()` / `warnDestructiveMorph()`
helpers next to `morphTableInto`.

This entry used to describe an unconfirmed, suspected instance of the
combo-pop bug class (§10 in the rendering standard). It has since been
independently found, confirmed live, and fixed — as a third, distinct
trigger of the same underlying mechanism, not a variant of either of the
first two fixes (combo-pop reparenting, `drawer.replaceWith()` on tab
switch).

### What was actually happening

`renderJobsBulkBar(root)` returns `''` when nothing is bulk-selected and a
real `<div class="jos-ld-bulk-bar">` once 1+ rows are selected. The `drawer`
variable is `''` when closed and a real `<aside id="jos-jobs-drawer">` when
open. Both used to sit *before* the always-present statusMenu/rowMenu/FAB
placeholders in `renderJobsPage`'s concatenated string. Toggling either
one's presence shifted every later sibling's index, and `morphTableNode`'s
non-keyed tag-mismatch fallback (`parent.replaceChild`) destroyed and rebuilt
all of them — confirmed via DOM-identity tagging + MutationObserver on every
real trigger:

| Interaction | Result (before fix) |
|---|---|
| Bulk-select checkbox toggle | FAB destroyed, 17 mutations |
| Bulk-select while drawer open | FAB **and** drawer destroyed, 9 mutations |
| Open the drawer fresh | FAB destroyed, 11 mutations |
| Close the drawer | FAB destroyed, 13 mutations |
| Table-level Status/Service edit, drawer-to-drawer job switch | clean (not affected) |

Opening/closing the drawer and bulk-selecting rows are the two most common
actions on the page — a far better match for a "flashes after every click"
report than either of the two previously-fixed spots.

**One extra wrinkle simple reordering doesn't cover**: `renderJobsBulkBar()`
returns a `<div>`, the drawer is an `<aside>`. If both were just moved to sit
adjacent to each other at the tail (matching the combo-pop fix's pattern
exactly), they could still mismatch *each other's* tag whenever only one of
the two was present on a given render — the drawer could get spuriously
destroyed by a bulk-select toggle even after "fixing" the ordering. Confirmed
this compound case live (bulk-select a second row while the drawer is open,
then clear the selection while the drawer stays open) before treating the
fix as complete.

### The fix

1. Moved the always-present elements (statusMenu, rowMenu, gcalCreatePop,
   FAB) ahead of both conditional blocks, so they never sit downstream of
   something that can vanish.
2. Wrapped each conditional block in a new `stableSlot(className, html)`
   helper — an always-present `<div>` container whose own tag never changes,
   so only its *contents* are ever diffed, never its siblings. This also
   resolves the drawer-vs-bulk-bar mutual-interference case, since neither
   block can shift the other's position anymore.
3. `renderJobsComboPop(root)` stays last, unchanged — its own fix (commit
   `58489be`) already covers it independently via reparenting-safety.

### Verified live (DOM-identity tag + MutationObserver, same standard as the prior two fixes)

Re-ran all four broken interactions above against the fix, plus the compound
case and a full regression of both earlier fixes:

| Interaction | FAB | statusMenu | rowMenu | drawer | mutations |
|---|---|---|---|---|---|
| Bulk-select toggle | survived | survived | survived | n/a (closed) | 5 |
| Open drawer while bulk bar showing | survived | survived | survived | n/a* | 9 |
| Bulk-select 2nd row while drawer open | survived | survived | survived | **survived** | 6 |
| Clear bulk selection, drawer stays open | survived | survived | survived | **survived** | 7 |
| Close the drawer | survived | survived | survived | correctly removed | 9 |
| Status edit (combo-pop mechanism, regression check) | survived | survived | survived | survived | 42 |
| Tab switch (replaceWith mechanism, regression check) | survived | survived | survived | survived | 31 |

(*that specific check tagged before the click that opens it, so "n/a" means no prior tag to compare — the drawer's presence itself was confirmed correct separately.)

Zero destructive replaces on any Jobs interaction tested. Zero regression on
either prior fix.

### Preventing a fourth instance

Sweeping for this bug class by hand three times is enough — added two
permanent guardrails instead of relying on the next person to remember:

1. **`stableSlot()`** (next to `morphTableInto`): the documented, structural
   way to include any block whose HTML can legitimately be `''` on one
   render and real markup on the next, inside a non-keyed morph target. Using
   it prevents this bug class by construction — the wrapper's tag never
   changes, so nothing downstream can be perturbed by what's inside it.
2. **`warnDestructiveMorph()`**: fires the first time (deduped per parent +
   old-tag/new-tag pair, per session — not spammy) `morphTableNode` hits its
   destructive `replaceChild` fallback on a non-keyed parent, with a
   `console.warn` naming the parent and both tags. Always on, not a dev-mode
   flag — a flag only helps if someone remembers to enable it before the bug
   reappears. One known-legitimate case is explicitly exempted: a table
   cell's display-span swapping for its edit-input/select/textarea on the
   same `data-jos-field`/`data-jos-record-id` pair, which is intentional
   (see `rendererRegistry`) and would otherwise fire on every routine
   cell-edit.

This means the next accidental instance of this bug — on Jobs or anywhere
else the morph engine is used — surfaces as a console warning the first time
it happens, not as a support ticket weeks later.

**Already paying off**: running the warning live during normal navigation
(not a targeted Jobs test) surfaced destructive-replace warnings on Home
(`jos-home-customize`), Customers (`jos-cm-shell`), and Leads (`jos-ld-page`)
during boot. These have **not** been investigated — they may be one-time
legitimate loading-stub-to-content transitions on first paint rather than a
recurring per-click bug, and confirming which requires the same live,
DOM-identity-tagged reproduction used for every fix in this file, not
inference from a console line. Flagged here for whoever picks it up next;
out of scope for this fix.
