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

---

## RESOLVED — the three `warnDestructiveMorph()` warnings flagged above (Home, Customers, Leads)

Investigated with the same rigor as every fix in this file: code-traced each warning's parent to
its render function, then confirmed live (DOM-identity tagging + repeated real interaction, not
inference from the console line alone). None of the three original warnings is the Jobs bug class.
One additional, different warning turned up during the investigation and is documented here too.

**Home (`jos-home-customize`, `<#3> -> <DIV>`) and Leads (`jos-ld-page`, `<#3> -> <SECTION>`) and
Customers list (`jos-cc-level-1`, `<DIV> -> <HEADER>`) — all three are the identical, one-time,
benign case**: each page's loading stub (e.g. `<div class="jos-home-loading">Loading Home…</div>`)
happens to share its outer `<div>` tag with that page's real first-paint content, so the morph
engine matches them by position and recurses one level deeper before finding the real mismatch (a
lone text node vs. the real content's first element) — which is exactly the loading-stub-into-
real-content swap that render is supposed to do on first paint, just resolved one level down the
tree instead of at the top. Structurally guaranteed to fire at most once per page load, since
`if (!root.firstChild)` gates the loading stub to true first paint only.

Confirmed live, not just reasoned about: DOM-identity-tagged a broad set of elements on each page
(Home's KPI cards/quick-action buttons/customize panel/FAB, Customers' header/toolbar/sort control,
Leads' title/toolbar) and drove heavy real interaction on each — toggling dashboard-customization
checkboxes, switching layout presets, opening the FAB sheet, searching and sorting Customers and
opening a profile, searching and changing a Leads filter. Zero destruction on any of it, and none
of the three warnings fired again post-boot. Confirmed one-time, not recurring — not the Jobs bug
class. No fix needed.

**New, different finding — Customers level-1 ↔ level-2 (list ↔ customer profile) switch**: this
one was *not* one of the three originally reported; it surfaced during the investigation above
when opening a customer's profile as part of testing Customers interaction. `renderCustomers()`
morphs two genuinely different top-level layouts (`renderCustomersPageInner`'s "list" branch vs.
its "command center" / profile branch) into the *same* `#jos-customers-root`, and they share
enough outer tag structure that the morph engine partially matches them before hitting a real
mismatch — same low-level mechanism as the other three, but a different trigger.

Unlike the Jobs bug, this **is** confirmed to recur — every list→profile and profile→list toggle
hits it, not just once on first paint (repeated the toggle three times: open a profile, back to
list, open a different profile; the same low, flat 8-mutation cost every time, no escalation).
But it is **not** the same bug class as the Jobs fix, for a concrete, checked reason: the Jobs bug
was a conditionally-present block destroying *unrelated* stable siblings that had nothing to do
with the interaction (editing Status destroying the FAB). Here, tagged elements *outside*
`#jos-customers-root` (the sidebar nav item, the topbar title) survived the entire sequence
untouched — the blast radius is fully contained to the one subtree that's genuinely supposed to
change when the user navigates from the customer list to a specific customer's profile, at a
small, flat, non-escalating cost. That's the same shape as the already-accepted Jobs Calendar
full-replace pattern (§10), not the anti-pattern `stableSlot()` exists to fix — `stableSlot()`
wraps a block that's sometimes empty among otherwise-stable siblings; there's no such block here,
the whole subtree is intentionally different between the two levels. Not fixed, because there's
nothing here to fix by the same mechanism — recorded as a real, understood, low-cost pattern in
case it's ever worth revisiting as its own architectural question (e.g. keyed/incremental morphing
between the two levels instead of a full swap), not because it was missed.
