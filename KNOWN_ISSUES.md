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

---

## FOLLOW-UP — `jos-home-customize` traced to its real cause, fixed at the shared root instead of per-page

New evidence (screenshots) showed the `jos-home-customize` warning firing on sign-in and on a Jobs
page load, which raised a real question worth re-checking rather than trusting the prior "one-time,
harmless" conclusion at face value: was Home actually re-rendering on every navigation, not just once
at boot?

**Traced with code + DOM-identity tagging, not assumption**: `jos-home-customize` is produced by
`renderHomeDashboard(root)`, called from exactly one place, `enhanceDashboard()` — which itself
starts with `if (!isHomeViewActive()) return;`, and every one of its own call sites (a delayed
weather-load callback, six Home-only widget click handlers, and `refreshDashboardIfOpen()` in
`hubly.html`, which separately gates on `viewIsOpen('v-dashboard')` before ever calling it) is
already guarded to never fire while another page is active. Not a shared/global component — Home-
specific, single call site, double-guarded.

Confirmed live: tagged `#jos-home-customize`'s DOM identity right after Home's first paint, then
navigated to Jobs, Leads, Customers, Calendar, and Pipeline in sequence (no return to Home). The
tag survived unchanged after every single navigation — the element was never destroyed or rebuilt.
The warning itself fired exactly once, during boot, and did not reappear on any of the five
subsequent navigations. **The screenshots' Jobs-page console showing this warning was stale,
preserved console history from the boot-time Home render** ("Preserve log" was on in that
DevTools panel) — not a live re-fire triggered by viewing or clicking within Jobs. This directly
refutes the "flash after every click is Home re-rendering on navigation" hypothesis: it provably
does not re-render on navigation at all.

**What was actually conditionally present ahead of it**: nothing, in the `stableSlot()` sense.
This isn't the bulk-bar/drawer shape (two blocks in the *same* render competing for position) —
it's the *generic loading stub* (`<div class="jos-home-loading">Loading Home…</div>`, the same
exact marker Jobs/Calendar/Leads/Customers all use) colliding with the real first-paint content
one time, because the stub's wrapper and the real content's first element happen to both be a bare
`<div>` — `morphTableChildren` matches them by tag, recurses a level deeper, and finds the real
mismatch there (a lone text node vs. the real content's first real element).

**Fix**: not `stableSlot()` — that tool is for a block that's sometimes empty *within one render*,
which isn't what this is. Instead, `morphTableInto()` now checks whether `root`'s *current* content
is still the generic loading stub (`root.querySelector('.jos-home-loading')`) and does a plain
`root.innerHTML = html` instead of diffing, since a loading stub has no focus/scroll/edit-state
worth preserving. This is a single, shared fix at the one root cause — it silences the identical
coincidental-match warning that was also firing (once, at boot) for Jobs, Calendar, Leads, and
Customers' list view, not just Home, instead of patching each page's render function individually.

**Verified**: re-ran the full boot+5-page-navigation trace after the fix — zero `[hubly-morph]`
warnings anywhere, `jos-home-customize`'s identity still confirmed stable across every navigation.
Confirmed each page still renders its real content correctly (Home's customize grid, Jobs/Leads/
Customers' real rows) rather than getting stuck on the stub. Re-ran the full regression set for
all three earlier Jobs fixes (comboPop, tab-switch, bulk-bar/drawer) through this same shared
`morphTableInto()` — all still hold, zero destruction, zero new warnings from any of them.

**Found, not yet investigated, while re-running that regression**: three warnings unrelated to the
loading-stub pattern (`jos-kicker: DIV -> #text`, `jos-btn-row: DIV -> BUTTON`, `jos-kicker jos-mt:
DIV -> #text`) — present before this session's changes, not introduced by anything above. Traced
`jos-kicker jos-mt`'s markup to the Completed/Cancelled/Recurring job-list sections inside the
customer command-center/profile panel (`journey.js` ~12755-12757), which is plausibly connected to
the still-open #90 ("clicking customer on a job should open the sidebar"). Not confirmed live,
not fixed — flagged here rather than silently dropped or silently patched without checking, same
standard as everything else in this file.

---

## CONFIRMED AND FIXED — the actual root cause of "Jobs flashes after every click" (found on the fifth pass)

**File**: `public/journey-os/journey.js`
**Elements**: `.jos-jobs-layout`'s render template (~line 18077), the `animationend` listener in
`wireJobsRoot` (~line 18191)

This is the real explanation the first three Jobs fixes (comboPop reparenting, tab-switch
`replaceWith()`, bulk-bar/drawer destroy-rebuild) never fully accounted for — the symptom kept
being reported after all three shipped because this is a **completely different mechanism**, one
`warnDestructiveMorph()` (see the rendering standard's §4.8) is structurally unable to catch: it
watches for node destruction, and here nothing is ever destroyed. A node stays alive the whole
time; only one of its attributes gets silently toggled.

### What was actually happening

`.jos-jobs-layout` (the wrapper around the *entire* Jobs page content — header, search, table, KPI
panel; everything except the sidebar) has a one-time CSS entrance animation
(`animation: josHomeIn .28s ease both`). A real, separate fix exists for a genuine Chrome bug — an
element with an active `fill-mode:both` animation keeps acting as a `position:fixed` containing
block even after it visually settles, breaking popover positioning — by freezing the animation via
an inline `style="animation:none"` the moment it ends (`animationend` listener in `wireJobsRoot`).

The render template for `.jos-jobs-layout` never included a `style=` attribute of its own. So on
the *next* re-render, `morphTableAttrsAndProps` (the morph engine's attribute-sync — doing exactly
its real job of keeping the live DOM honest against the fresh template) saw the live node had a
`style` attribute the fresh template didn't, and removed it. Removing that override let the CSS
rule re-apply, which restarts the animation from `opacity:0` per spec. ~280ms later it finishes,
`animationend` fires again, the handler re-freezes it — priming the identical trap for the next
render. Any Jobs re-render landing more than ~280ms after the previous one retriggered it: a search
keystroke's debounced re-render, a field edit, opening or closing the drawer — which is why it
explained "flashes after every click" far better than any of the three fixes that came before it,
and visibly affected the *whole page*, not one element.

### Found on a fifth, evidence-driven pass

The first four rounds (comboPop, tab-switch, bulk-bar/drawer, plus re-confirming `warnDestructiveMorph()`
came back clean) all closed real bugs but didn't explain a persisting symptom. This one was found
from real video evidence — paused frames from a screen recording showing the entire Jobs content
pane visibly faded mid-search-typing — traced by extracting dense frame sequences (ffmpeg) around
the exact moment, then confirmed with a live `MutationObserver` scoped broadly to `document.body`
(not just the table, which is why three earlier live-tracing passes missed it — they were scoped
too narrowly to catch a change on an ancestor of the observed root).

### The fix

The template for `.jos-jobs-layout` now tracks whether the animation has genuinely finished once,
in the same `root`-scoped state bag every other stateful Jobs concern already uses:
```js
'<div class="jos-jobs-layout"' + (root._josJobsLayoutAnimDone ? ' style="animation:none"' : '') + '>'
```
and the `animationend` handler — its original unconditional freeze completely untouched, still
firing for any animated element exactly as before — additionally sets that flag specifically when
the target is `.jos-jobs-layout`. Once set, every subsequent render's fresh HTML already carries
`style="animation:none"`, so the attrs-sync has nothing to remove. Neither of the two things this
sits between gets reopened: the Chrome containing-block workaround is byte-for-byte unchanged: the
morph engine's attrs-sync isn't special-cased or weakened anywhere — it's just correctly syncing a
template that's now accurate.

### Verified

- `requestAnimationFrame` opacity poll on `.jos-jobs-layout` across a real search-triggered
  re-render: **post-fix, 51 samples, zero dips below `opacity:1`**.
- Negative control (identical probe, code reverted via `git stash`): opacity drops to **`0` at
  19ms**, climbs a textbook ease curve — 0.04, 0.14, 0.26, 0.40, 0.52, 0.63, 0.71, 0.78, 0.84,
  0.89, 0.92, 0.95, 0.97, 0.98, 0.999 — and reaches **`1` at ~298ms**, matching the declared
  `.28s` duration almost exactly. That confirms both the mechanism and that the probe is sensitive
  enough to have caught it if the fix hadn't worked.
- `.jos-jobs-layout`'s frozen style confirmed stable (unchanged) across three consecutive real
  re-renders.
- Attrs-sync's normal behavior confirmed untouched elsewhere: set an arbitrary stale inline style
  on an unrelated Jobs element, triggered a real re-render — still correctly cleared, element
  identity preserved (patched, not destroyed).
- Checked for the same `animationend` + inline-style-freeze pattern anywhere else in the app: exists
  in exactly one place (this listener). Within Jobs, `.jos-jobs-drawer` is separately immune (its
  own static `.open{animation:none}` CSS rule, baked into every render's template already, never
  touched by attrs-sync); `.jos-jobs-page` (same CSS animation pattern) is dead CSS, never applied
  to any current markup.

### One thing tested but not cleanly resolved either way

Tried to directly reproduce the original popover-mispositioning symptom the `animationend` handler
exists to prevent, in both the fixed and unfixed state, using the column add-field popover
(`.jos-ld-col-menu`) as the test case. Neither state showed a measurable positioning difference —
tracing why, that popover is synchronously reparented out of `.jos-jobs-layout`'s subtree
(`root.appendChild(menu)`) before its position is ever set or painted, which may make it
structurally immune to this specific concern for reasons unrelated to the fix. This doesn't
threaten the fix's safety — the imperative freeze this handler performs is byte-for-byte unchanged,
and the fix can only shrink the total time any animated element in Jobs is "live" (never grow it) —
but it's a reasoned guarantee, not a reproduced one, and is recorded as such rather than glossed
over. If the original Chrome positioning bug is ever suspected to have regressed, this is the place
to start: find a popover that is *not* reparented before paint (a native `<select>` inside the
Jobs drawer is the most likely candidate) and test that instead.
