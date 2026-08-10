# Hubly Rendering Standard v1

**Status: Frozen, same as `HUBLY_TABLE_STANDARD.md`.** The Leads page (`public/journey-os/journey.js` —
`renderLeads`/`renderLeadsPage` and everything they call, plus the morph engine at
`journey.js:9012-9127`) is the reference implementation of the rendering behavior documented
below. This is the companion document to `HUBLY_TABLE_STANDARD.md` — that one governs *what
the table looks like and how you interact with it*; this one governs *exactly when and how
much of the DOM changes in response*. Every other page's rendering is judged against this
document, not against its own precedent.

This is not a checklist like `HUBLY_TABLE_STANDARD.md` — it's an exhaustive reverse-engineering
trace. Every claim below is a direct file:line citation into the live code, verified by reading
the actual functions, not inferred from behavior or assumed from naming. Where something could
not be verified from static reading alone (mostly: exact browser-native popup behavior), that is
stated explicitly rather than guessed.

## Known drift from the existing docs — corrected in place

Three things this reverse-engineering pass found that contradicted `HUBLY_TABLE_STANDARD.md`/
`JOBS_LEADS_CONSISTENCY_AUDIT.md` at the time this document was written. **Both of those docs
have since been corrected in place** (their own text now notes the correction and points back
here) — kept below as the historical record of what was wrong and why, not as an outstanding
to-do:

1. **`HUBLY_TABLE_STANDARD.md:86` names the morph functions `morphLeadsInto`/`morphLeadsChildren`.
   Those identifiers don't exist.** The real, current names — used identically by both Leads and
   Jobs — are `morphTableInto`, `morphTableAttrsAndProps`, `morphTableNode`,
   `morphTableKeyedChildren`, `morphTableChildren` (all `journey.js:9012-9127`). This document
   uses the real names throughout.
2. **`HUBLY_TABLE_STANDARD.md:19-20` says "double-click anywhere else on the row is the
   power-user shortcut to [open the detail panel]." This is no longer true.** Commit `2f5b73b`
   ("Remove double-click everywhere...") removed it after the table standard doc was frozen.
   Today `dblclick` does exactly one thing on Leads: rename a column header
   (`journey.js:9782-9802`). Opening the detail panel is **click-the-name-cell only** — see
   §1.6.
3. **`docs/JOBS_LEADS_CONSISTENCY_AUDIT.md:64` says the Leads workspace panel has "no tabs."**
   It has four: Timeline / Notes / Tasks / Appointments (`LEADS_WS_TABS`, `journey.js:7604-7609`).
   That audit's line-number citations for the resize handler (`10088-10116`) and the
   roving-tabindex handler (`10062-10083`) have also drifted from the code's current line
   numbers — corrected citations are used throughout this document.

---

## 0. Architecture at a glance

- **One root, acquired once, reused forever.** `ownPixelView('v-leads', 'jos-leads-root')`
  (`journey.js:13748-13755`) creates `#jos-leads-root` on first call and returns the same DOM
  node on every subsequent call. It is never destroyed for the lifetime of the session.
- **One render function.** `renderLeads()` (`journey.js:8981-8997`) → `renderLeadsPage(root)`
  (`9210` onward, builds the entire page as one HTML string) → `morphTableInto(root, html)`
  (`9314`). There is no narrower "just re-render this cell/row/section" function anywhere in the
  Leads code — every single interaction, from a keystroke to a bulk delete to opening the
  detail panel, calls this exact same full-page render function. The appearance of narrow,
  targeted updates is produced entirely by the morph engine (§4) sitting underneath it, not by
  the app calling smaller render functions.
- **State lives on the root DOM node itself**, as plain JS properties (`root._josLeadsQ`,
  `root._josLeadId`, `root._josLeadsEditCell`, `root._josLeadBulkSelected`, etc.) — not in a
  separate store, not in React-style component state. It survives across renders for the
  mundane reason that `root` is a real, persistent DOM node that render calls mutate the
  children of, never replace.
- **Two listener-binding functions, both idempotent, both bound once.** `bindRoot(root)`
  (`journey.js:21039-21040`, app-wide, dispatches any `data-jos-act` prefixed `leads-` to
  `handleLeadsAct`) and `wireLeadsRoot(root)` (`9604-9606`, Leads-specific — click/change/
  keydown/input/mousedown/dragstart/dragover/drop/dblclick/scroll/blur, all delegated to
  `root`). Both guard themselves (`root._josBound`, `root._josLeadsBoundV3`) and are called on
  every render (`renderLeadsPage`), but their setup bodies run exactly once per root, ever —
  every subsequent call is an O(1) flag check.
- **No realtime subscription exists for Leads at all.** Confirmed independently twice (once in
  the prior rendering-architecture audit, once by this pass's agents): the app's one Supabase
  realtime channel (`hubly.html:15668-15671`) subscribes to `jobs`, `booking_requests`,
  `customers` — never `businesses`, which is where Leads data (`S().pipeline.manual`) actually
  lives. See §5.
- **Persistence is centralized, not scattered.** `mutateLead(mutator)` (`journey.js:10297-10306`)
  and `mutateLeadById(id, mutator, opts)` (`10308-10316`) are the only two functions that mutate
  a lead — both call `persistLeadsSoon()` (`10294-10296`, wraps `hubly.html`'s
  `persistPipelineSoon()`, a 450ms-debounced write of the whole `businesses.meta` blob) and then
  `renderLeads()` internally. No call site is trusted to remember persistence itself — this is
  the exact discipline `HUBLY_TABLE_STANDARD.md`'s "Persistence" section already documents,
  restated here because it's equally a rendering-pipeline fact: every mutation's render call is
  guaranteed to happen (inside these two functions), not something each of the ~40 call sites
  has to remember to trigger.

---

## 1. Rendering — exactly when it rerenders

Format per the brief: **User action → Functions called → Render boundary → DOM changes → State
preserved.** All eleven requested interactions.

### 1.1 Inline edit

```
User clicks a text/phone/email/tags cell
  ↓
click listener (journey.js:10121-10159) finds [data-jos-field], resolves col via
findLeadsColumnDef, falls through checkbox/openOnClick/select special cases
  ↓
openLeadsCellEdit(root, leadId, key)  (journey.js:8607-8619)
  → sets root._josLeadsEditCell = {leadId, field: key, originalValue}
  → sets root._josLeadsActiveCell = {leadId, colKey: key}
  → renderLeads()
  ↓
renderLeadsPage(root) → morphTableInto(root, html)
  → the cell's <span data-jos-field> is replaced with an <input data-jos-field
    class="jos-ld-editing"> (tag changed → morphTableNode does a real
    replaceChild, journey.js:9059-9063)
  ↓
openLeadsCellEdit's own post-render code explicitly re-finds and focuses the new
node (journey.js:8614-8619) — necessary specifically because the replaceChild
above destroyed the old node, so nothing focuses itself automatically
  ↓
User types, then blurs (click away / Tab / Enter→blur — see §6)
  ↓
native 'change' fires if dirty → the change listener's data-jos-field branch
(journey.js:9928-9962) → fieldRenderer.readValue → mutateLeadById → tableColFieldSet
→ pushLeadActivity → persistLeadsSoon() (450ms debounce) → renderLeads()
  ↓ (in parallel, same tick)
deferred (setTimeout 0) blur-close listener (journey.js:10168-10180) →
root._josLeadsEditCell = null → renderLeads()
  ↓
Render boundary: row + cell — the edited lead's <tr> (matched by
data-jos-record-id) and the specific <td> (matched by data-jos-col-key) are the
only nodes that receive DOM writes; every other row is diffed and no-ops (see §3, §4)
  ↓
State preserved: scroll position, every other row's data/selection/edit state,
bulk-checkbox selection, search/filter/sort state, column widths/order — all
untouched, none of them live inside the field being edited
```

Select-type cells (Status/Source/Service/Assigned) diverge at step 1: the click
handler special-cases `col.type === 'select'` *before* `openLeadsCellEdit` ever
runs, calling `openLeadsComboPicker(root, leadId, key, inPanel)`
(`journey.js:10152-10156`) instead — a custom `.jos-combo-pop` popover, not a
native `<select>`. See §6 for the full divergence, including a confirmed bug
where the roving-keyboard-grid's Enter key opens a *different*, semi-deprecated
native-`<select>` editor than the mouse click does.

Checkbox-type custom fields diverge even further: there is no edit-mode step at
all. Click toggles and commits in the same synchronous handler
(`journey.js:8505-8512`, `10129-10137`) — `mutateLeadById` runs immediately on
click, no `openLeadsCellEdit`, no `_josLeadsEditCell` ever gets set.

### 1.2 Search

```
User types in #jos-leads-search
  ↓
input listener (journey.js:9814-9820):
  root._josLeadsQ = e.target.value        ← written synchronously, every keystroke
  root._josLeadsLimit = 25                ← pagination reset, every keystroke
  clearTimeout(root._josLeadsSearchT)
  root._josLeadsSearchT = setTimeout(renderLeads, 140)   ← only the render is debounced
  ↓
after 140ms of no further typing: renderLeads() → renderLeadsPage(root) →
filterLeadsList(root) re-derives the filtered set from the now-current
root._josLeadsQ → morphTableInto(root, html)
  ↓
Render boundary: whole table body (the set of visible rows can change
completely), but every row that's still in both the old and new filtered set is
matched by data-jos-record-id and only attribute/text-diffed, not replaced
  ↓
State preserved: the search input itself never loses focus or caret position —
morphTableAttrsAndProps (journey.js:9023-9058) explicitly skips syncing .value
on document.activeElement (9048), and since #jos-leads-search's parent structure
is static across renders, the same live <input> DOM node is matched and reused
every time (non-keyed positional path, but tag-stable so never replaced)
```

Filtering itself is entirely client-side, every time, against an already-resident
array — no fetch anywhere in this path (`filterLeadsList`, `journey.js:8210-8224`
→ `leadsOsList()` → `allLeadsRaw()` → `S().pipeline.manual` directly, the live
in-memory array).

### 1.3 Filter

```
Inline dropdown (Source/Service/Assigned):
User picks an option
  ↓
change listener (journey.js:9852-9861) — native select 'change' fires on commit,
no debounce needed
  ↓
root._josLeadFilters.{source|service|assigned} = e.target.value
root._josLeadsLimit = 25
  ↓
renderLeads()  (immediate, synchronous, same tick)
  ↓
Render boundary: whole table body, same mechanism as search
  ↓
State preserved: same as search — scroll, other filters, sort, selection all untouched

Filter drawer (renderLeadsFilterDrawer, journey.js:8247-8279):
Open/close via leads-filter-open toggling root._josLeadFilterOpen → renderLeads()
(the drawer itself is inserted/removed by the non-keyed positional morph, same
mechanism as the detail panel — see §1.6)
Apply/Reset/Save Filter buttons — NOT commit-on-every-change like the inline
dropdowns; requires an explicit Apply
```

### 1.4 Sort

```
User picks Newest/Oldest in #jos-ld-sort
  ↓
change listener (journey.js:9862-9865): root._josLeadsSort = e.target.value → renderLeads()
  ↓
filterLeadsList (journey.js:8222) re-sorts via tableSortBy(list, createdCol, dir)
— always sorts by the 'created' column's sortValue (lastContacted||createdAt),
never a display-truncated date; tableSortBy never mutates in place, returns a
fresh sorted copy every time
  ↓
Render boundary: table body — but the DOM effect is row MOVES, not
replace-and-recreate. morphTableKeyedChildren (journey.js:9072-9099) matches
each new <tr> to its existing DOM node by data-jos-record-id and calls
parent.insertBefore(match, ref) only when a row's position actually changed —
insertBefore on an already-attached node MOVES it (per DOM spec), it does not
detach/reattach with side effects
  ↓
State preserved: every row's own DOM node identity, including any independently
mid-edit cell in a row that just changed position, plus scroll position on the
now-differently-ordered table
```

There is no column-header-click-to-sort anywhere in the Leads code — the
`#jos-ld-sort` `<select>` is the only sort control that exists.

### 1.5 Column changes (resize, drag-reorder, rename, hide/show, add field)

Five distinct interactions, each with its own trigger and — critically — very
different render behavior. **Resize is the one exception to "everything renders
through `renderLeads()`" in this entire document.**

```
RESIZE — journey.js:10243-10271
mousedown on [data-jos-col-resize] → delegated root listener → attaches
document-level mousemove/mouseup for the drag's duration
  ↓
mousemove: onMove(ev) directly sets col.style.width on the live <col> element —
pure DOM style write, ZERO render calls, every tick
  ↓
mouseup: onUp() reads col.offsetWidth, writes it into root._josLeadsColumns,
calls saveLeadsColumns — persistence only, STILL no renderLeads() call
  ↓
Render boundary: none at all for this interaction — the live <col>'s style is
the only thing that changes, directly
  ↓
CONFIRMED BUG: LEADS_COL_MIN_WIDTH (referenced journey.js:10256, inside onMove)
is never declared anywhere else in the file. Reading it throws ReferenceError on
the very first mousemove of every resize drag — onMove's col.style.width write
never executes. mouseup still fires (separate listener) and persists whatever
col.offsetWidth already was, i.e. the pre-drag width, unchanged. Net effect:
dragging the resize handle currently does nothing visible and saves nothing new.
```

```
DRAG-TO-REORDER — journey.js:10048-10111
dragstart: captures root._josLeadsColDragKey, snapshots
root._josLeadsColDragOriginalOrder (for abandon-drag revert), sets is-dragging class
  ↓
dragover (fires continuously while hovering the same cell — deduped via
overKey === root._josLeadsColDragOverKey so this only re-fires once per NEW
column boundary crossed): splices root._josLeadsColumns in place →
renderLeads() — a FULL renderLeads() call on every crossed boundary, by
deliberate design (comment at 10039-10044: morphTableInto makes this cheap
enough to call live, not just on drop)
  ↓
drop: root._josLeadsColDropCommitted = true → saveLeadsColumns (persist — only
here, not on every dragover) → renderLeads()
  ↓
dragend (if no drop happened): reverts root._josLeadsColumns to the dragstart
snapshot → renderLeads() — so an abandoned drag never leaves an unsaved reorder
visible
  ↓
Render boundary: table headers + body — morphTableKeyedChildren moves the real
<th>/<td> DOM nodes to their new positions (same insertBefore-is-a-move
mechanism as sort), which is what makes the reorder look animated rather than jumpy
  ↓
State preserved: same as sort — node identity, any mid-edit cell, scroll
```

```
DOUBLE-CLICK RENAME — journey.js:9793-9802 (open), 10386-10399 (commit),
10011 (cancel)
dblclick on .jos-ld-th-label → root._josLeadsColRenaming = colKey → renderLeads()
(swaps <span> for <input id="jos-ld-th-rename-input">, tag change → real replace,
same as edit-mode open) → focus+select the new input
  ↓
Enter → e.target.blur() (routes through the shared "Enter blurs the .jos-ld-editing
control" handler, journey.js:10201-10215)
  ↓
blur (deferred setTimeout 0) → commitLeadsColRename(root) (journey.js:10386-10399)
— only writes+persists if the trimmed new label is non-empty AND differs from
the current label; always clears root._josLeadsColRenaming and renderLeads()
  ↓
Escape → journey.js:10011 → root._josLeadsColRenaming = null; renderLeads() —
does NOT call commitLeadsColRename, so typed text is discarded, original label
reverts because it was never mutated
  ↓
Render boundary: one <th>'s child node (span↔input)
```

```
HIDE / SHOW / ADD CUSTOM FIELD — journey.js:10670-10768 (all via handleLeadsAct,
the leads-col-menu/leads-col-hide/leads-col-show/leads-col-add-menu/
leads-col-add-field-open/-save/-cancel acts)
Every one: mutate root._josLeadsColumns or root._josLeadsCustomFields → save via
tablePreferences (§ persistence below) → renderLeads() (full call every time,
including opening/closing the popover itself and switching the add-field
type dropdown — there is no narrower "just the popover" render path; the
morph makes each of these cheap by only patching the one affected <th
class="jos-ld-th-add"> subtree in practice)
  ↓
Render boundary: one <th> subtree (the "+" column's popover)
```

**Persistence timing for all column changes**: `tablePreferences.save(scope, tableKey, data)`
(`journey.js:7321-7267` area) → `queueTablePrefsSync` — the **in-memory cache updates
synchronously** on every call, but the **network write is debounced 450ms** per
`scope_tableKey` timer key, so rapid column edits (resize-then-hide-then-rename) coalesce into
one network write, not one per action. Failed writes retry up to 3× with backoff, then give up
and toast rather than looping forever.

### 1.6 Drawer open

```
User clicks a name cell (First name / Last name — the only two columns with
openOnClick: true)
  ↓
click listener (journey.js:10121-10159), col.openOnClick branch →
openLeadDetailPanel(root, leadId)  (journey.js:9195-9208)
  → root._josLeadId = leadId
  → root._josLeadPanelOpen = true
  → root._josLeadWorkspace = 'timeline'   ← ALWAYS resets to Timeline tab, even
    if a previous session left a different lead open on Notes/Tasks/Appointments
  → clears root._josLeadCtx (any open context menu)
  → marks the lead read (lead.unread = 0, markLeadSeen)
  → eagerly adds .ws-open to the EXISTING .jos-ld-shell node (belt-and-suspenders
    against a flash before the morph lands)
  → renderLeads()
  ↓
renderLeadsPage computes wsOpen = true, panelJustOpened = true (this lead's
panel wasn't already open) → emits <section class="jos-ld-main"> (no is-open
class yet) as a new sibling of <section class="jos-ld-inbox">
  ↓
morphTableInto → morphTableChildren on .jos-ld-layout's children: SECTION tags
aren't TR/TH/TD, so this is the non-keyed positional path — old had 1 child,
new has 2 → the second (.jos-ld-main) is genuinely APPENDED as a brand-new node
(journey.js:9121-9123), not patched into anything existing
  ↓
renderLeads() calls animateLeadsPanelOpen(root) (journey.js:9395, since
panelJustOpened) → forces a layout read (void panel.offsetWidth) then adds
.is-open one tick later, so the browser has a 0→open state to transition from
  ↓
CSS: width .2s ease, opacity .16s ease, transform .2s ease (operate-pixel.css,
.jos-ld-main / .jos-ld-main.is-open) — respects prefers-reduced-motion via a
media query that nulls the transition
  ↓
Render boundary: whole page HTML rebuilt (as always), but DOM-wise this is
"append one new top-level section"; everything else (table, toolbar, KPIs) is
matched by key/tag and diffed as normal, unaffected
  ↓
State preserved: table scroll position (untouched node), bulk selection
(untouched state), any mid-edit cell elsewhere in the table (its blur commits
normally as part of the click that opened the panel — not silently discarded)
```

Opening the panel is **Table-view only**. List view's cards (`renderLeadCard`,
`journey.js:8363`) carry `data-jos-record-id` but no `data-jos-field`
(`openOnClick`), and the generic row-click handler for `[data-jos-record-id]`
(`9772-9779`) only sets `root._josLeadId` for row-highlight purposes — never
`root._josLeadPanelOpen`. There is no click, dblclick, or context-menu path that
opens the panel from List view. Switching to List view makes the detail panel
unreachable by click. (A dead, unreachable `data-jos-lead-row` handler exists in
`bindRoot`, `journey.js:21085-21088`, that *would* open the panel — but the only
markup that ever emitted that attribute lives in `design-system.js`'s
`leadCard()` helper, which has zero callers anywhere in the live render path.)

### 1.7 Drawer close

```
X button (the only real close trigger) — data-jos-act="leads-detail-close"
  ↓
handleLeadsAct → closeLeadsDetailPanel(root)  (journey.js:9167-9184)
  ↓
if prefersReducedMotion(): finish() immediately (skip animation entirely)
else:
  panel.classList.remove('is-open')
  panel.addEventListener('transitionend', settle, {once:true})
  setTimeout(settle, 260)   ← fallback in case transitionend never fires
  ↓
finish(): root._josLeadPanelOpen = false; root._josLeadPanelWasOpen = false;
renderLeads()
  ↓
wsOpen recomputes false → <section class="jos-ld-main"> is omitted from the new
HTML → morphTableChildren's positional trim (oldParent.childNodes.length >
newKids.length → removeChild the excess) removes it
  ↓
Render boundary: one top-level section removed; row stays highlighted (see §2)
```

**Escape does NOT close the drawer.** The single Leads Escape handler
(`journey.js:10004-10019`) is an explicit priority chain — Add-Lead modal → filter
drawer → bulk bar → overflow menu → column `▾` menu → column-rename input →
in-progress cell edit → add-column popover → context menu → (fallback) clear
search — **the workspace panel is not in this chain at all.** Escape has zero
effect on it. This is a deliberate ordering (most-transient-first, innermost UI
state wins), not an oversight in the sense that each *listed* item is handled
correctly — but the drawer's total absence from the list means there's no
keyboard way to close it.

Clicking a *different* lead's name re-runs `openLeadDetailPanel` with the new id.
Since `wsOpen` was already `true`, `panelJustOpened` computes `false` — no
animation replays; the same `.jos-ld-main` section's content is just re-rendered
in place (positional morph patches its children to the new lead's data), an
instant content swap, not a close-then-reopen.

There is no backdrop/scrim element and no outside-click-closes-the-panel
listener anywhere (confirmed — `.jos-ld-main` is a flex sibling of the table in
desktop layout, `position:fixed` overlay only under `max-width:1023px`, with no
scrim either way).

### 1.8 Realtime update

See §5 in full. Summary for this table: **nothing renders, because nothing ever
fires.** There is no realtime subscription for the `businesses` table (where
Leads data lives), so an edit made to a lead in another tab/browser/user session
produces zero signal in this tab — no render call happens as a result, ever,
short of a full page reload.

### 1.9 Background save

```
Any mutateLead/mutateLeadById call
  ↓
persistLeadsSoon()  (journey.js:10294-10296)
  ↓
global.persistPipelineSoon()  (hubly.html:43103-43112)
  clearTimeout(_pipelineSaveTimer)
  _pipelineSaveTimer = setTimeout(async () => {
    db.from('businesses').update({meta: buildBizMeta()}).eq('id', currentBusiness.id)
  }, 450)
  ↓
Render boundary: NONE — this is a pure background network write, it never
triggers or is triggered by a render. renderLeads() already happened
synchronously inside mutateLead/mutateLeadById, before this timer even starts.
```

This write does **not** go through `markLocalWrite`/`realtimeAwareWrite` at all
— not a suppression gap, but moot: there is no realtime subscription on
`businesses` for it to echo into in the first place (§5).

### 1.10 Delete (single)

```
User right-clicks a List-view card (Table view has no equivalent — see below)
  OR clicks a name cell to open the panel, then clicks "⋯" → Delete
  ↓
contextmenu listener (journey.js:9804-9812, .jos-ld-card only) sets
root._josLeadId + root._josLeadCtx = {open:true,x,y}
  OR leads-more-menu handler (journey.js:10809-10815, only exists once the panel
  is open) sets root._josLeadCtx
  ↓
renderLeadsContextMenu(root) (journey.js:8954-8969) — 'leads-delete' entry
  ↓
click "Delete" → handleLeadsAct('leads-delete')  (journey.js:11096-11111)
  window.confirm('Delete this lead?')             ← plain, no "cannot be undone"
  mutateLead(l => {
    l.deleted = true                               ← effectively dead-code flag,
                                                       see note below
    st.pipeline.manual = st.pipeline.manual.filter(x => x.id !== l.id)  ← the
                                                       real removal
    st.pipeline.deleted.push(l.id)                 ← tombstone, only consulted
                                                       by abandoned-lead resync,
                                                       inert for manual leads
  })
  root._josLeadId = null; root._josLeadPanelOpen = false
  renderLeads()          ← handleLeadsAct's own explicit call
  ↓
CONFIRMED: mutateLead ALREADY calls renderLeads() internally (10304) — the
leads-delete branch's own extra renderLeads() call (11110) makes this a genuine
double-render on every single delete. Harmless (morph makes the second call
idempotent/cheap) but real, and inconsistent with bulk-delete/new-lead below,
neither of which double-renders.
  ↓
Render boundary: one <tr>/.jos-ld-card removed (morphTableKeyedChildren's
removal pass, journey.js:9093-9098 — the old key is simply absent from usedKeys)
  ↓
No exit animation — .jos-ld-trow's only transition is a .12s background-color
hover effect (operate-pixel.css), not an exit transition; the row disappears
synchronously on the next render's removeChild, no fade/slide
  ↓
State preserved: every other row untouched (matched by key, no-op if unchanged)
```

**Confirmed: right-click delete only works in List view.** The `contextmenu`
listener's selector is `.jos-ld-card[data-jos-record-id]` — Table-view rows are
`<tr class="jos-ld-trow">`, which never matches. In Table view, right-clicking a
row does nothing (no `preventDefault`, the browser's native context menu shows).
**The only way to delete a lead while staying in Table view is: click the name
(opens the panel) → click "⋯" → Delete.** There is no direct row-level delete
affordance in Table view at all.

**No undo mechanism exists anywhere** for delete (single or bulk) — one grep hit
for "undo" in the whole file, and it's just the word "undone" inside the
bulk-delete confirm string.

### 1.11 Bulk delete

```
Bulk-select checkboxes are ALWAYS visible (var bulkOpen = true, hardcoded,
journey.js:9239-9241 — "a checkbox next to each row is the fast, primary way to
delete one or many, not a 'Select' mode a user has to opt into first")
  ↓
User checks boxes (individually, or shift-click for range, or header
select-all) → root._josLeadBulkSelected[key] = true (or delete) →
renderLeads() per click
  ↓
Bulk bar (.jos-ld-bulk-bar) becomes visible once Object.keys(selected).length > 0
(renderLeadsBulkBar, journey.js:8766-8769) — matches HUBLY_TABLE_STANDARD.md's
"appears only once rows are actually selected" rule exactly
  ↓
Click "Delete" (jos-ld-bulk-bar-danger) → handleLeadsAct('leads-bulk-delete')
  (journey.js:10870-10893)
  window.confirm('Delete N leads? This cannot be undone.')   ← stronger wording
    than single-delete's, same actual irreversibility
  ONE Array.filter() pass over pipeline.manual drops every selected id at once
    (NOT N individual mutateLead calls)
  if the open panel's lead was among those deleted: close it too
  root._josLeadBulkOpen = false; root._josLeadBulkSelected = {}
  ONE persistPipelineSoon() call (direct, not through the mutateLead wrapper)
  ONE renderLeads() call            ← no double-render here, unlike single delete
  ↓
Render boundary: N <tr>/.jos-ld-card nodes removed in one morph pass — same
mechanism as single delete, just N unmatched keys instead of 1, still one
morphTableInto call
  ↓
State preserved: every non-deleted row's DOM node untouched
```

**Selection survives unrelated renders.** `root._josLeadBulkSelected` lives on the
persistent `root` node, is never touched by unrelated code paths (e.g. editing a
different cell elsewhere just calls `mutateLeadById`+`renderLeads`, which never
reads/writes the bulk-selection map), and since each checkbox is inside a keyed
`<tr>`/`<td>`, `morphTableAttrsAndProps` re-syncs `.checked` from the freshly-generated
markup (which itself reads the still-intact selection map) — checked boxes stay
checked across an unrelated edit. **Escape does not clear the selection** — the
Escape chain only ever touches `root._josLeadBulkOpen` (a now-vestigial flag,
since checkbox visibility no longer depends on it), never `_josLeadBulkSelected`.

There is dead code here worth flagging: a `leads-bulk-toggle` handler exists
(`journey.js:10661-10665`) to flip `root._josLeadBulkOpen`, and several other
branches still check/reset it — but no button anywhere in the rendered markup
emits `data-jos-act="leads-bulk-toggle"`. It's vestigial from an earlier
opt-in-bulk-mode design that was superseded by "always show checkboxes" without
the toggle machinery being removed.

### 1.12 New record ("+ New Lead")

```
Click any of 3 entry points (toolbar button / empty-state CTA / mobile FAB —
all data-jos-act="leads-add-open")
  ↓
handleLeadsAct: root._josLeadAddOpen = true; root._josLeadDraft = {} → renderLeads()
  ↓
renderLeadsAddModal(root) (journey.js:8281-8320) — a .jos-leads-modal-backdrop,
scoped inside #jos-leads-root (not a separate top-level app modal) — inserted
via the same non-keyed positional morph mechanism as the detail panel/filter drawer
  ↓
User fills Name (required)/Phone/Email/Address/Vehicle/Service/Source/Assigned/
Notes/Tags (or uses "Fill from paste" to auto-populate from pasted text), clicks
"Save Lead" or "Save & Quote"
  ↓
saveNewLead(andQuote)  (journey.js:9427-9469)
  validates only Name is required
  global.createLead({...}, {origin:'manual'})   ← always resolves to
    createLeadManual (hubly.html:43305-43311, 43354-43386), never the
    booking_requests-writing path, since origin is always 'manual' here
  ↓
createLeadManual (hubly.html) — SYNCHRONOUS body, but wrapped in an async
function (createLead), so saveNewLead's .then() resolves on next microtask, not
after a real network round-trip
  S.pipeline.manual.unshift(lead)     ← prepended to array index 0
  persistPipelineSoon()               ← creation persists itself, INSIDE
    createLeadManual — saveNewLead does not separately call persistLeadsSoon
  ↓
.then(): root._josLeadAddOpen=false; root._josLeadId=newId;
root._josLeadPanelOpen=true; root._josLeadsTab='all' (reset, so the new lead
isn't hidden by whatever tab filter was active) → renderLeads()  ← ONE call, no
double-render
  ↓
leadsOsList()/allLeadsRaw() return S.pipeline.manual by reference — the new
lead is visible on the very next call, no extra sync step
  ↓
filterLeadsList sorts by createdAt — under default "Newest" sort, the new
lead's just-set createdAt puts it first regardless of the unshift's array
position (same visual result, driven by the explicit sort, not array-order luck)
  ↓
morphTableKeyedChildren: new lead's data-jos-record-id has never appeared in any
prior render → oldByKey[key] is undefined → falls to the "no match" branch →
parent.insertBefore(newNode, ref) — a genuine fresh insert; under default sort,
this lands at index 0 (tbody.firstChild), and every existing row is
key-matched and left alone (not disturbed by the insert)
  ↓
Panel auto-opens for the new lead: panelJustOpened computes true (this is a
fresh open) → the same slide-in animation as §1.6 plays
  ↓
Row highlight (.on class) applies to the new row via selectedId === leadKey
  ↓
NO scrollIntoView anywhere in the file for this. If sort were "Oldest," or the
user were several "Load More" pages deep, the new row could land outside the
visible viewport with nothing scrolling it there — the detail panel opening is
the only guaranteed visual confirmation the lead was created.
```

---

## 2. State preservation — verified, not assumed

Every item from the brief, checked directly against the code (not inferred from behavior):

| State | Preserved? | Mechanism (verified) |
|---|---|---|
| **Scroll position** | Yes | No dedicated save/restore code exists anywhere (grepped `scrollTop` — the only Leads hit, `journey.js:10277`, only toggles a sticky-header shadow class, doesn't persist/restore). Survives because `.jos-ld-table-wrap` is a real DOM node whose tag never changes across renders — `morphTableNode` never replaces it, so the browser's own internal scroll offset for that node is never reset. |
| **Focused cell** (roving-tabindex "active cell") | Yes, for the tabindex/visual state; separately, focus itself can be lost when leaving edit mode | `root._josLeadsActiveCell` is JS state on `root`, survives trivially. Arrow-key movement (`moveLeadsGridFocus`, `journey.js:10416-10441`) is pure DOM/focus manipulation with **zero render calls** — flips `tabindex` on old/new cell directly, calls `.focus()`. When a render *does* happen for an unrelated reason, `restoreLeadsGridFocus(root)` (`10406-10414`) explicitly re-focuses the previously-active cell — but only when `root._josLeadsGridFocusPending` is set (an opt-in flag, set only on edit-commit/cancel/click events, deliberately **not** set for routine renders like search-as-you-type or a filter change, "so routine re-renders... never yank focus into the table"). |
| **Active edit** (mid-typed value in an open cell editor) | Yes, but by two different mechanisms depending on trigger | If the render is caused by something unrelated (e.g. a different row's edit committing): the cell's edit markup regenerates identically, tag doesn't change, `morphTableAttrsAndProps`'s `isActive` guard skips `.value` sync — node reused, caret/typed-value untouched, no code specifically "protects" this, it's emergent from unchanged-tag reuse. If the render is the edit *opening or closing itself*: this is a genuine tag change (span↔input) → real `replaceChild` → explicit `.focus()`/`select()` calls in `openLeadsCellEdit`/`restoreLeadsGridFocus` recover focus after the fact — not preservation, deliberate re-establishment. |
| **Selected rows** (bulk checkboxes) | Yes | `root._josLeadBulkSelected`, JS state on `root`, never touched by unrelated code paths; checkbox `.checked` re-synced from that same state on every render via `morphTableAttrsAndProps`. Only cleared by explicit bulk-action completion — **not** by Escape (confirmed the Escape chain never touches it). |
| **Open dropdown** (the custom `.jos-combo-pop` picker) | Yes, driven by state, not DOM focus | `root._josLeadCombo` (an object, not a boolean) drives whether the popover renders at all — persists across an unrelated re-render exactly like any other root-level state. For the rarer native `<select>` fallback (Status only, reached via the keyboard-Enter path — see §6), the morph's `SELECT` branch skips `.value` sync while it's `document.activeElement`, but whether that specifically preserves an *open OS-level popup* (vs. just the focused value) couldn't be verified from static code — browser-implementation-defined behavior, not something the source determines. |
| **Hover state** | N/A — nothing to preserve | 100% CSS (`.jos-ld-trow:hover`), zero JS state tracked for hover anywhere in the file. |
| **Expanded rows** | N/A | Leads' table has no row-expansion concept — not found anywhere in the code. |
| **Column visibility** | Yes | `root._josLeadsColumns[i].hidden`, persisted via `tablePreferences` (`scope: 'user'`), re-read via `loadLeadsColumns` on the next `renderLeadsTable` call — `cols.filter(c => !c.hidden)` is what excludes them from the next render. |
| **Column order** | Yes | Same `root._josLeadsColumns` array, order-preserving; drag-reorder physically moves DOM nodes to match (§1.5, §4). |
| **Filters** | Yes | `root._josLeadFilters` object, plain root state, re-applied by `filterLeadsList` on every render regardless of what triggered it. |
| **Search** | Yes | `root._josLeadsQ`, same mechanism; the input box itself also keeps literal focus/caret (see the "Active edit" row's `isActive` mechanism — applies identically to the search box). |
| **Sorting** | Yes | `root._josLeadsSort`, plain root state. |
| **Pagination** | Yes, but resets on most other actions | `root._josLeadsLimit` — survives across an edit/realtime/etc, but is explicitly reset to 25 on every search keystroke, every filter change, and every tab switch (by design — a filter/search change invalidates "how far you'd scrolled," so re-starting at the top of the new result set is intentional, not a bug). |
| **Drawer state** | Partially — open/closed and which tab, not always which lead | `root._josLeadPanelOpen` and `root._josLeadWorkspace` both persist as root state — but `openLeadDetailPanel` **always resets** `_josLeadWorkspace` to `'timeline'` on open, even if a previous session had a different lead's panel parked on Notes/Tasks/Appointments. Selection (`root._josLeadId`) is explicitly decoupled from panel-open (`journey.js:9249-9252`, "closing the panel keeps the row highlighted... it just hides the panel") — confirmed: `closeLeadsDetailPanel` never touches `root._josLeadId`. |

---

## 3. Render boundary — classification per interaction

| Interaction | Boundary | Why |
|---|---|---|
| Inline edit commit | Row + cell | `morphTableKeyedChildren` matches every other row by key and no-ops; only the edited `<tr>`/`<td>` receives writes |
| Search / filter / sort | Table body (rows may be added/removed/reordered) | Same render function as everything else, but the *set* of matched rows genuinely changes; unaffected rows still no-op individually |
| Column resize | **Nothing** — direct DOM style write, no render call at all (and currently broken — see §1.5) | Deliberately bypasses the render pipeline entirely for drag-smoothness (when it works) |
| Column drag-reorder | Table headers + body (node moves) | Full `renderLeads()` per boundary crossed, cheap because of the keyed morph |
| Column rename / hide / show / add field | One `<th>` subtree | Full `renderLeads()`, but only the affected header's markup actually changed |
| Drawer open / close | One top-level `<section>` inserted/removed | Non-keyed positional morph — new/removed section is appended/trimmed, everything else untouched |
| Realtime update | **Nothing, ever** | No subscription exists (§5) |
| Background save | **Nothing** | Pure network write, no DOM involvement |
| Delete (single) | One `<tr>`/card removed | Keyed removal pass; also a confirmed double-`renderLeads()` call (§1.10) |
| Bulk delete | N `<tr>`/cards removed, one render | Same keyed removal pass, N unmatched keys in one pass |
| New record | One `<tr>`/card inserted + one section inserted (the panel) | Keyed insert (new key) + non-keyed section append, same render |

No interaction on Leads is ever "entire app" or "entire page" **at the DOM-write level** — every
one of them is scoped down by the morph engine to some subset of nodes, even though the
JS-string-building step underneath always recomputes the whole page (see §7).

---

## 4. The morph engine — exactly what `morphTableInto()` guarantees

Five functions, `journey.js:9012-9127`. `TABLE_MORPH_KEY_ATTR = { TR: 'data-jos-record-id', TH:
'data-jos-col-key', TD: 'data-jos-col-key' }` (`9012`) — **only these three tags are ever
keyed.** Everything else (`SPAN`, `INPUT`, `SELECT`, `DIV`, `SECTION`...) is diffed positionally.

### 4.1 Node identity — preserved for keyed matches, destroyed on tag change

`morphTableKeyedChildren` (`9072-9099`) never `replaceChild`s a matched node — it calls
`morphTableAttrsAndProps(match, newNode)` (patches attrs/props onto the *old*, real node) and
`morphTableChildren(match, newNode)` (recurses), then repositions with `insertBefore` only if
order changed. The freshly-parsed `newNode` is discarded once its data has been copied onto
`match`. Node identity is destroyed only two ways: (a) the key disappears from the new tree
entirely (row/column removed — real `removeChild`), or (b) `morphTableNode`'s tag-mismatch
check fires (`9060-9063`) on the **unkeyed** path — this is how edit-mode transitions (span↔
input) genuinely destroy and recreate a node even though their parent `<td>` survives untouched.

### 4.2 Focus preservation — a side effect, not a feature

No explicit `document.activeElement` save/restore exists anywhere in the morph engine. The only
reference to `activeElement` is the `isActive` guard inside `morphTableAttrsAndProps` (`9043`),
and it exists to protect *values*, not focus itself. Focus survives when the focused element's
row/cell keeps its key (node never removed, browser never blurs it — nobody made this happen on
purpose, it's a consequence of the node staying in the document). Focus is genuinely lost when
the row is removed (deletion) — nothing refocuses anything after that. There's a **separate,
unrelated, opt-in mechanism**, `restoreLeadsGridFocus` (`10406-10414`), gated by
`root._josLeadsGridFocusPending` — it exists specifically for the edit-mode-tag-change case
(§4.1b), not for row removal, and is deliberately *not* triggered by routine renders.

### 4.3 Selection preservation (caret position) — same story as focus

No explicit caret save/restore exists. Relies entirely on the input node never being replaced
while its tag stays the same — native browser behavior for an untouched, still-attached
`<input>` keeps its own selection state automatically. The `isActive` guard reinforces this by
never overwriting `.value` on the focused element even if the freshly-built markup disagrees,
but that's a defensive backstop, not the actual preservation mechanism (which is "the node was
never touched").

### 4.4 Event listener preservation — there was never anything to lose

All 20 `addEventListener` calls in the Leads code region are on `root` itself (delegation, via
`wireLeadsRoot`/`bindRoot`), guarded to bind exactly once. Nothing in `renderLeadsTable`,
`tableCellHtml`, or `rendererRegistry` — the functions that actually build row/cell markup —
ever calls `addEventListener` on a row/cell node. So "the morph preserves listeners" is true, but
for a boring reason: replacing or reusing a `<tr>`/`<td>` is a non-event for the app's event
handling either way, since every interaction is handled at the root via delegation, not on
individual nodes.

### 4.5 Edit-mode preservation — two mechanisms, easy to conflate, kept distinct here

**Opening/closing an edit** for a given cell is a real tag change (span↔input) → genuine
`replaceChild` → explicit `.focus()` calls needed afterward (§4.2). **An unrelated render while
already mid-edit** regenerates *identical* edit-mode markup for that cell (same
`root._josLeadsEditCell`, same tag) → `morphTableNode`'s mismatch check doesn't fire → patched in
place, not replaced, and the `isActive` guard stops the regenerated `value` attribute from
overwriting what's currently typed. There is no code anywhere that says "this cell is mid-edit,
don't touch it" — the survival is an emergent property of (a) the HTML string always reflecting
current edit state and (b) the morph never replacing a same-tag node.

### 4.6 Scroll preservation — same mechanism as node identity, no dedicated code

Confirmed via grep — no Leads-specific `scrollTop` save/restore exists. `.jos-ld-table-wrap` is a
plain, unkeyed, but tag-stable `<div>` — never replaced, so the browser's internally-tracked
scroll offset for that specific node object is never reset.

### 4.7 Debugging pattern: "something flashes/rebuilds on X but not Y" — reparented elements vs.
non-keyed sibling order

**Read this section first if a bug report says a page visibly flashes, pops, or rebuilds on some
interaction, especially if a comparable page/interaction doesn't.** This is the methodology that
actually found the Jobs-drawer-flash bug (full incident write-up: §10, "The actual root cause of
'Jobs still renders on every click'"), after three earlier investigation angles — render-count
tracing, realtime-echo tracing with live production `console.log` instrumentation, and a
side-by-side Jobs-vs-Leads JS-level trace — all came back clean and were red herrings.

**The bug class**: this codebase renders by diffing a freshly-built HTML string against the live
DOM (`morphTableInto`, §4 above). Positioned popovers/combo-pops get *reparented* out of their
rendered position after each render, for CSS reasons (`position:fixed` measures wrong for its
first ~250ms when nested under a scrolled/sticky ancestor — see `positionJobsComboPop`/
`positionLeadsComboPop`). If a reparented element is not the *last* sibling in its rendered
container, the next render's diff sees a real length mismatch there (live DOM: element missing
from its expected slot; fresh HTML: element still described as present) — and the non-keyed
fallback (`morphTableChildren`, used for anything that isn't `TR`/`TH`/`TD`) does not reconcile a
mismatch like that with a targeted patch. It does `parent.replaceChild()`, which cascades through
*every* sibling positioned after the mismatch, destroying and rebuilding all of them from scratch
— even ones with no relationship to whatever actually changed. If one of those incidentally-
destroyed siblings has a CSS `animation` (not `transition` — an `animation` auto-plays on any
freshly-composited element; a `transition` only fires on an explicit property change on a
persisting node), that animation replays, and *that* is what a user sees as an unexplained flash.

**Why call-count and timing traces don't catch this**: the render count, call sequence, and timing
are all completely normal in this bug class — the JS logic did exactly what it was supposed to do.
The defect is purely structural (sibling order in a concatenated HTML string) and only manifests
as extra `childList` mutations you wouldn't expect for the interaction that triggered them. No
amount of counting `renderX()` calls or tracing realtime-echo suppression will surface it, because
neither tool looks at *what got mutated*, only *when* and *how often* something ran.

**The actual diagnostic technique, in order**:
1. Attach a real `MutationObserver` (`childList: true, attributes: true, subtree: true`) to the
   page's root element *before* the suspect interaction, and log every record with its target,
   added/removed node list — not aggregated, not sampled. Compare the record list for the same
   interaction on the page that doesn't exhibit the symptom (if one exists) — a structural
   difference in *what* gets added/removed, not how many renders fired, is the signal.
2. Tag the specific DOM node you suspect is being destroyed with a throwaway identity marker
   (e.g. `node.__tag = 'X'`) immediately before the interaction, then check whether that exact
   marker survives after — `undefined` means the node was destroyed and replaced, not patched.
   This is unambiguous in a way call counts and mutation summaries alone aren't, and it's what
   actually proved the fix worked (three repeated edits in a row, `.jos-jobs-drawer` tag survives
   every one, where before it was destroyed on the second edit specifically — see §10).
3. Reproduce at production-realistic data volume before ruling a render "cheap" — a handful of
   seeded records can hide costs/mismatches that only appear once a table/list has its real
   row count.

**Companion note — one symptom, two unrelated causes.** The Jobs-drawer flash actually had two
distinct root causes: the comboPop-reparenting bug above, and a completely separate hand-written
`drawer.replaceWith(fresh)` in the tab-switch handler (§10 has both write-ups in full). They share
no code path — one is a structural side effect of the morph engine, the other bypasses the morph
engine entirely.

The lesson: confirming a fix holds for the mechanism you *found* only proves you closed *that*
cause. It doesn't prove the symptom is gone, because a visible symptom like "this page flashes" is
just an observation — it's not evidence of a single mechanism, and nothing rules out a second,
unrelated trigger producing the identical visible result. That's exactly what happened here: after
the comboPop fix shipped, the flash was reported again. The instinct to reach for was either "the
fix regressed" or "the fix was incomplete, extend it" — both wrong, and both would have wasted time
patching a mechanism that was never broken.

The right move, in order: **(1) re-verify the original fix first**, against the actual live-served
code, using the same test that proved it worked the first time (production-file diff to rule out a
stale deploy, then the DOM-identity-tag test to rule out regression) — not against the code in the
editor, not against a mental model of it, against what's actually running. Only once that comes
back clean does the second symptom become **(2) a fresh investigation**, run with the same rigor
as the first — new MutationObserver capture, new DOM-identity tagging, no inherited assumption
about where in the code the cause lives. Treating "still broken" as automatic proof the first fix
was wrong would have sent the second investigation looking inside the comboPop code, where there
was nothing left to find.

### 4.8 The bug class itself: conditionally-present blocks ahead of stable siblings

Three separate real bugs in Jobs (§10's combo-pop, the tab-switch `replaceWith()`, and the
drawer/bulk-bar cascade below) all reduce to the same structural cause: `morphTableChildren`'s
non-keyed path compares children **by index**, not by identity. Anything that can legitimately be
`''` on one render and real markup on the next — a popover that gets reparented out from under its
expected slot, a bulk-action bar that only exists once something's selected, a drawer that only
exists while open — shifts every later sibling's index the moment its own presence changes.
`morphTableNode`'s tag-mismatch fallback (`parent.replaceChild`) then destroys and rebuilds
everything from that point on, including elements with no relationship to whatever actually
changed.

**The fix, generalized**: never concatenate a maybe-empty render block directly into a non-keyed
morph target. Wrap it with `stableSlot(className, html)` (next to `morphTableInto`) instead — an
always-present `<div>` whose own tag never changes, so only its *contents* are diffed, never its
siblings' positions. This also covers a subtler case two conditional blocks sitting next to each
other can hit: if block A is a `<div>` and block B is an `<aside>`, and only one of the two is
present on a given render, they mismatch *each other's* tag at that shared index — reordering
alone doesn't fix that, only giving each its own stable wrapper does.

**The permanent guardrail**: `warnDestructiveMorph()` fires a `console.warn` (deduped per parent +
old-tag/new-tag pair, per session) the first time `morphTableNode`'s destructive fallback actually
runs on a non-keyed parent. Always on, not a dev-mode flag — this is what turns the next instance
of this bug class into an immediate console line instead of another multi-day "why does this
still flash" investigation. One legitimate case is exempted: a table cell's display-span swapping
for its edit-input/select/textarea on the same field (`rendererRegistry`'s normal display/edit
toggle) — that's an intentional, expected tag change, not this bug class.

---

## 5. Realtime — what happens when another browser changes a Lead

**Nothing renders. Confirmed, not assumed, and confirmed independently three separate times
across this and the prior rendering-architecture audit.**

The app's one Supabase realtime channel (`hubly.html:15668-15671`) subscribes to exactly three
tables: `jobs`, `booking_requests`, `customers`. It never subscribes to `businesses` — and
`S().pipeline.manual`, the array every manually-created or CSV-imported lead lives in, is a JSON
blob inside `businesses.meta`, loaded once at initial business boot (`hubly.html:15039-15048`)
and never refetched on any timer or trigger afterward.

So: if a teammate in another browser edits a manually-created lead, that write goes through
`persistPipelineSoon()` → a plain `businesses.meta` UPDATE. This tab receives **zero signal** —
no realtime event fires (nothing subscribed), no polling exists, nothing refetches
`businesses.meta` outside of the very first page load. The change is invisible in this tab until
a full page reload.

**One partial exception**, worth stating precisely rather than rounding it off: if the *other*
browser's action touches a **booking-request-derived, abandoned-status lead**
(`S().abandonedLeads`, a genuinely different storage mechanism from `pipeline.manual`), the
`booking_requests` table *is* subscribed — `onRealtimeBizChange` fires, `refreshOpenAppViews()`
runs, which calls `refreshLeadsSources()` (`hubly.html:43627-43649`) — but that function only
refetches `booking_requests` rows with `status='abandoned'` into `S.abandonedLeads`, plus a
separate chatbot-conversations RPC. **It never touches `S().pipeline.manual`.** So even this path
only refreshes one specific, narrow slice of "leads" (abandoned bookings) — the majority of
records a user actually sees on the Leads page (manually-created, CRM-sourced, CSV-imported) are
never realtime-synced under any circumstance.

Practical consequence for anyone reasoning about multi-tab/multi-user correctness on this page:
**assume Leads data is only as fresh as the last full reload in each open tab.** This is not a
suppression bug (there's nothing to suppress) — it's an absence of the realtime plumbing that
Jobs/Customers have, on the table where you'd most expect a fast-moving sales team to be editing
concurrently.

---

## 6. Editing — every field type × every event

### 6.1 Field types actually present on Leads

`rendererRegistry` (`journey.js:8391-8556`) defines 11 types. Only these are reachable on Leads:

| Type | Built-in column? | Offered as custom field? |
|---|---|---|
| Text | Yes — First name, Last name | Yes |
| Phone | Yes — Phone | Yes |
| Email | Yes — Email | Yes |
| URL | No | Yes (custom-field only) |
| Number | No | Yes (custom-field only) |
| Date | No | Yes (custom-field only) |
| Checkbox | No | Yes (custom-field only) |
| Select | Yes — Source, Service, Status, Assigned | Yes |
| Tags | Yes — Tags (`hidden: true` by default) | **Not offered** at creation |
| Textarea | **Not used anywhere on Leads** (Jobs only) | Not offered |
| Time | **Not used anywhere on Leads** (Jobs only) | Not offered |
| Currency/Amount | **Does not exist as a distinct type.** `rendererRegistry.number` has an unused `col.format` hook explicitly reserved for this (e.g. a future `money()` formatter); no Leads column, built-in or custom, ever sets it. Leads has an "Estimated value" concept, but it's filter-only (min/max inputs), never a renderable/editable column. | — |

### 6.2 The matrix

For every applicable type: **Click → Blur → Escape → Enter → Realtime-during-edit.**

**Text (First/Last name), Phone, Email, URL*, Number*, Date*, Tags** (*custom-field only)
all share one shape, with only the parse/format step differing per type:

- **Click**: generic dispatch (`journey.js:10121-10159`) → `openLeadsCellEdit(root, leadId, key)`
  (`8607-8619`). Date additionally calls `sel.showPicker()` after focusing (`10344`), since
  `.select()` is a no-op on a date input with no visible affordance.
- **Blur**: native `change` fires first if dirty (browser default), committing via the shared
  pipeline (§6.3). A separate, deferred (`setTimeout 0`) blur-close listener
  (`10168-10180`) then always closes the edit state regardless of whether `change` fired.
- **Escape**: `cancelLeadsCellEdit(root)` (`10349-10380`) — full behavior in §6.4.
- **Enter**: the shared "Enter blurs the `.jos-ld-editing` control" handler
  (`10201-10215`) — since these are all `<input>` tags, Enter just calls `e.target.blur()`. It
  does **not** commit directly; it delegates to native blur → native `change` → the commit
  pipeline.
- **Realtime-during-edit**: `morphTableAttrsAndProps`'s `INPUT`/non-checkbox branch
  (`9044-9050`) — `.value` sync is skipped whenever `document.activeElement === oldEl`. Scoped
  correctly by construction: a different lead's row is a different `<tr>`, independently keyed
  and matched, so it patches freely with zero interaction with whatever's being edited elsewhere.

Per-type formatting divergence, all inside the shared shape above:
- **Phone**: `readValue` normalizes typed input to canonical digits (`phoneDigits`) before
  writing to `lead.phone`; on Escape, `writeValue` re-formats the reverted value back to display
  form (`8430`).
- **Email**: `readValue` is `trim().toLowerCase()` only; no `writeValue` defined, Escape falls
  back to a raw, unformatted revert.
- **URL / Number / Date**: no `readValue` defined (Number is the exception — `parseFloat`,
  non-numeric silently becomes `''`, not rejected), no `writeValue` — Escape reverts raw.
- **Tags**: `readValue` comma-splits/trims/drops-empty into an array; `writeValue` re-joins the
  reverted array with `', '` for Escape. Minor copy nit found: the display span's tooltip says
  "Click to change" (dropdown wording) even though the editor is free text, not a picker — cursor
  is correctly `text`, only the tooltip copy is borrowed from the select convention.

**Checkbox** (custom-field only) — no edit-mode step exists at all:
- **Click**: toggles and commits in one synchronous step
  (`8505-8512`, `10129-10137`) — `mutateLeadById` runs immediately, `_josLeadsEditCell` is never
  set.
- **Blur / Escape / Enter**: not applicable — there's no live focusable input to receive any of
  these; the display element is a `<span>`, not a real `<input type="checkbox">`.
- **Realtime-during-edit**: not applicable in the "active element" sense, but worth flagging as a
  latent trap: `morphTableAttrsAndProps`'s checkbox/radio branch (`9046-9047`) syncs `.checked`
  **unconditionally, with no `isActive` guard** — unlike every other input type. Currently inert
  for Leads' checkbox column (which never renders a real `<input>`), but would misbehave for any
  future Leads checkbox that *does* render as a genuine `<input type="checkbox">` mid-interaction.

**Select** (Source, Service, Status, Assigned, and any custom select field) — the type with real,
confirmed behavioral divergence:

- **Click**: **not** the fallback `rendererRegistry.select.edit()` native `<select>` — the click
  handler special-cases `col.type === 'select'` before `openLeadsCellEdit` is ever reached,
  opening `openLeadsComboPicker(root, leadId, key, inPanel)` (`10152-10156`), a custom
  `.jos-combo-pop` popover (shared markup-builder with Jobs' equivalent picker, but each page has
  its own separate open/position/close glue functions).
- **Option pick**: a delegated click on `[data-jos-combo-pick]` calls `mutateLeadById` directly
  (`9723-9737`) — no native `change` event involved at all for the normal mouse path.
- **Blur** (closing without picking): an explicit outside-click check (not a native blur event,
  since the popover isn't a focusable form control) — `closeLeadsComboPicker` just nulls
  `root._josLeadCombo` and re-renders; no value rollback needed because nothing was mutated until
  a pick actually happened.
- **Escape**: a dedicated, separate capturing keydown listener (`9848-9850`) closes the combo —
  distinct from the main Escape chain (§1.7), because opening a select cell sets
  `_josLeadCombo`, not `_josLeadsEditCell`.
- **Enter**: the combo's search input has no dedicated Enter handler at all — pressing Enter
  inside it does nothing beyond whatever native button-focus behavior the browser gives.
- **CONFIRMED BUG — roving-grid Enter opens a different editor than click does, and is broken for
  Assigned specifically.** The keyboard grid's Enter handler (`10223-10238`) hardcodes only two
  column keys: `field = colKey === 'status' ? 'status' : (colKey === 'assigned' ? 'assignedTo' :
  null)`, then calls `openLeadsCellEdit` **directly** — bypassing the combo picker entirely, opening
  the semi-deprecated native-`<select>` fallback instead. For Status, this works (the mapped
  field name `'status'` matches the real schema key). **For Assigned, it doesn't** — the schema's
  real key is `'assigned'` (`7474`), but the handler maps it to the string `'assignedTo'`, which
  `findLeadsColumnDef` can't resolve (returns `undefined`) — `openLeadsCellEdit` immediately
  early-returns (`10331`). **Pressing Enter on a keyboard-focused Assigned cell silently does
  nothing** — no editor, no error. And since custom select fields' generated `cf_...` keys never
  match either hardcoded string, **Enter never opens any select-type custom field's editor at
  all** — click is the only working entry point for every select type except Status.
- **Realtime-during-edit**: for the rare native-`<select>` fallback path (Status via Enter only),
  same `isActive`-guarded `.value` sync as any other form control (`9053-9057`); the `<option>`
  sync branch itself has no `isActive` guard, but is low-risk since the parent `SELECT`'s guarded
  value assignment is what actually drives selection in practice. For the real click path (the
  combo popover), the `isActive` mechanism doesn't apply at all — it's a `<div>`/`<button>` tree,
  not a focused form control; the popover's open state survives a realtime-triggered re-render
  purely because it's driven by `root._josLeadCombo` state, not DOM focus.

### 6.3 The shared commit pipeline (every field type, once `change` fires)

```
change event on [data-jos-field]  (journey.js:9928-9962)
  ↓
fieldRenderer.readValue(e.target)   ← per-type parse (phone→digits, email→trim+
  lowercase, number→parseFloat, tags→split, else raw e.target.value)
  ↓
root._josLeadsEditCell = null
root._josLeadsGridFocusPending = true      ← so the next render restores
                                              keyboard focus to the grid, not
                                              stranding it
  ↓
mutateLeadById(fieldLeadId, mutator)  (journey.js:10308-10316)
  → mutator: tableColFieldSet(fieldCol, l, fieldVal)   ← writes via the column's
    own set() (e.g. Status's set() also derives osStage/stage as a side effect)
  → mutator: pushLeadActivity(l, 'edit', label)         ← unshifts an activity
    entry, capped at 40
  → persistLeadsSoon()     ← the 450ms-debounced Supabase write
  → renderLeads()          ← unless opts.quiet, which this call site never passes
  ↓
toast(fieldActivityLabel + ' updated')
  ↓
Render boundary — confirmed definitively via the keyed-diff chain: rows keyed
by data-jos-record-id, cells within a row keyed by data-jos-col-key, diffing
recurses independently at each level. A commit on Lead A's firstName cell
results in DOM writes to (at minimum) Lead A's <tr> and its firstName <td>.
Every other lead's <tr> is matched by its own unchanged key, recursed into,
and produces ZERO DOM writes if its own markup is byte-identical (which it
will be, since no other lead's data changed) — morphTableAttrsAndProps's
attribute loop and morphTableNode's text-diff both explicitly no-op on
unchanged values. This is what makes "only that one cell visibly repaints"
true, with no code anywhere written specifically to target "just this cell."
```

### 6.4 `cancelLeadsCellEdit` — exact behavior, not paraphrased

```js
function cancelLeadsCellEdit(root) {
  var editing = root._josLeadsEditCell;
  if (!editing) return;
  var lead = findLead(editing.leadId);
  if (lead) {
    var col = findLeadsColumnDef(root, editing.field);
    if (col && col.type === 'select') {
      // A live <select> commits the instant an option is picked (native
      // 'change'), so by the time Escape is pressed the lead may already
      // hold the new value — roll it back for real.
      var currentValue = tableColFieldGet(col, lead);
      if (currentValue !== editing.originalValue) tableColFieldSet(col, lead, editing.originalValue);
    } else if (col) {
      // Every other type only commits on blur/'change', never per
      // keystroke — nothing has been written to the lead yet. But
      // removing this still-focused <input> below (via the renderLeads()
      // call) can itself synthesize a native 'change' event carrying
      // whatever was typed, which would silently save the just-cancelled
      // edit. Reset the live input back to its original value first so
      // that stray commit is a no-op.
      var renderer = rendererRegistry[col.type] || rendererRegistry.text;
      var liveEl = root.querySelector('[data-jos-field="' + editing.field + '"][data-jos-record-id="' + CSS.escape(editing.leadId) + '"].jos-ld-editing');
      if (liveEl) {
        if (renderer.writeValue) renderer.writeValue(liveEl, editing.originalValue);
        else liveEl.value = editing.originalValue == null ? '' : editing.originalValue;
      }
    }
  }
  root._josLeadsEditCell = null;
  root._josLeadsGridFocusPending = true;
  renderLeads();
}
```
`journey.js:10349-10380`.

**Exact answer to "DOM-only revert, or does it also revert already-mutated in-memory state?":
both, conditionally, for exactly one reason.** For every type except `select`, nothing has
actually been written to the lead object yet — commit only happens on `change`, which hasn't
fired — so there's no in-memory state to revert; the DOM-value reset exists purely to make sure
*removing the focused, still-dirty `<input>`* (which the trailing `renderLeads()` does) can't
itself synthesize a stray `change` carrying stale typed data. For `select`-type columns
specifically (reachable only via the keyboard-Enter-on-Status path — mouse-click select editing
never sets `_josLeadsEditCell` at all, it sets `_josLeadCombo`), the in-memory lead object **can
already be mutated** by the time Escape is pressed, because a native `<select>`'s `change` fires
the instant an option is picked, not on blur — so this branch does a real, explicit
`tableColFieldSet` rollback of the already-committed value.

### 6.5 Custom fields — verified identical to their built-in type counterpart

`customFieldColumnDef(f)` (`7548-7560`) builds a column-definition object with **the exact same
shape** (`type`, `get`, `set`, `options`, `editable`) as every built-in column.
`leadsColumnSchema` simply concatenates built-ins with mapped custom fields into one flat array
— no branch anywhere downstream (`tableCellHtml`, `findLeadsColumnDef`, the click dispatcher,
the commit listener, `cancelLeadsCellEdit`, the morph functions) distinguishes `col.custom ===
true` for rendering/editing purposes. The only place `custom` is checked at all is the column
menu's "Delete field" button. **Confirmed: a custom `text` field behaves identically to
First/Last name's row in this matrix; a custom `select` field behaves identically to Source's row
— including inheriting the same Enter-key bug, made even more total, since a custom field's
generated `cf_...` key never matches either hardcoded `'status'`/`'assigned'` string, so Enter
never opens any custom select field's editor at all, ever — click is the only path.**

Storage: every custom field, regardless of type, lives at `lead.customFields[f.id]` — one
generic `get`/`set` pair covers all 8 offered types (text/number/date/checkbox/select/phone/
email/url — notably `tags` and `textarea` exist in `rendererRegistry` but are not offered as a
creatable custom-field type).

---

## 7. Performance — skipped, always, deferred

**What work is skipped**: only at the DOM-write layer, never at the JS/string-building layer.
`renderLeadsPage` unconditionally does, on *every single call regardless of trigger*:
`leadsOsList()` (O(all leads in the account)) → `filterLeadsList()` (O(all leads)) →
`visible.map(...)` building full row+cell HTML for every visible row × column (O(visible rows ×
columns), default page size 25). A single-field edit to one row still rebuilds the complete HTML
string for all ~25 visible rows and every visible column, exactly as if every row had changed.
The *only* place work is actually skipped is inside the morph functions discarding rebuilt
markup for every node whose key matched and whose attributes/text turned out identical, rather
than writing it to the real DOM.

**What always happens**: the full string rebuild above, on every render, no exceptions. A full
attribute-diff pass over *every matched node in the tree*, not just changed ones —
`morphTableAttrsAndProps` runs unconditionally for every keyed match and every positionally-
matched pair, with no "is this node actually different" upstream short-circuit and no
memoization/byte-comparison fast path anywhere in the engine. `bindRoot`/`wireLeadsRoot`'s guard
checks (one property read each) run every render too, but their setup bodies execute exactly
once per root, by explicit design.

**What's deferred**, every `setTimeout`/debounce reachable from the Leads render/persist path:

| Location | Delay | Defers |
|---|---|---|
| `journey.js:9819` (search `input` listener) | 140ms | Search-as-you-type `renderLeads()` — only the last keystroke in a burst actually renders |
| `hubly.html:43106-43112` (`persistPipelineSoon`) | 450ms | The actual Supabase `businesses.meta` write, coalescing rapid successive edits into one network call |
| `journey.js:10172-10177` and 5 similar blur handlers | 0ms (next tick) | Deferred edit-close so a click on a *different* editable cell can claim the new edit state first, avoiding a focus-race with the just-closing one |
| `journey.js:10719-10729` (`leads-col-add-field-open`) | 0ms (next tick) | Avoids a same-click DOM-detachment race with the outside-click-closes-the-menu listener |

No other timer touches the Leads render or persistence path.

---

## 8. Consolidated bug/drift list found during this pass

Not fixed here — no code changes in this phase, per the brief. Listed together so nothing gets
lost between the sections above:

1. **Column resize is currently non-functional.** `LEADS_COL_MIN_WIDTH` (`journey.js:10256`) is
   referenced but never declared anywhere in the file — the drag handler throws on the first
   `mousemove` of every resize gesture, so live resize never visually updates and mouseup persists
   the unchanged pre-drag width.
2. **Single-lead delete double-renders** — `mutateLead` already calls `renderLeads()` internally;
   the `leads-delete` branch calls it again. Harmless (morph makes the second call cheap), but
   inconsistent with bulk-delete and new-lead, neither of which double-renders.
3. **Right-click-to-delete only works in List view.** Table-view rows don't match the
   `contextmenu` listener's `.jos-ld-card` selector — the only Table-view delete path is
   open-the-panel → "⋯" → Delete.
4. **The bulk-select "mode toggle" is dead code.** `leads-bulk-toggle` and
   `root._josLeadBulkOpen` still exist and are checked in several places, but no rendered button
   ever emits that act — checkboxes are hardcoded always-visible (`var bulkOpen = true`).
5. **Escape never closes the detail/workspace panel.** It's absent from the Escape priority
   chain entirely — the X button (or opening a different lead) are the only ways to close it via
   keyboard-adjacent interaction.
6. **New leads get no `scrollIntoView`.** Positive confirmation relies entirely on default
   "Newest" sort + the auto-opened detail panel; under a different sort or several "Load More"
   pages deep, a newly-created lead could render outside the viewport with nothing scrolling it
   into view.
7. **Keyboard Enter-to-edit is broken for Assigned and silently no-op for every select-type
   custom field.** The roving-grid's Enter handler hardcodes a `'assigned' → 'assignedTo'`
   mapping that doesn't match the real schema key (`'assigned'`) — `findLeadsColumnDef` fails,
   `openLeadsCellEdit` early-returns, nothing happens, no error surfaced. Status is the only
   select-type column where keyboard Enter works at all.
8. **Mouse-click and keyboard-Enter open two different editors for the same Status cell.** Click
   opens the modern custom combo popover (`openLeadsComboPicker`); Enter opens the older,
   explicitly-commented "fallback only... kept intact so a select-type column still degrades to
   something functional" native `<select>` editor.
9. **No realtime subscription exists for Leads data at all** (§5) — manually-created/CSV-imported
   lead edits from another tab/user are invisible until a full reload; only abandoned-booking-
   derived leads get any realtime refresh, and only that narrow slice.
10. **Leads' own writes never go through `markLocalWrite`/realtime-echo suppression** — not a
    suppression bug, moot: there's no subscription for a write to echo into in the first place.

## 9. What this means for other pages

Per the brief, no migration decision is made here — this is the trace, not the plan. But stated
plainly, since it's the direct output of this exercise: any page adopting this standard needs
(a) one root acquired once via `ownPixelView`, (b) exactly one render function that always
rebuilds the full HTML string, (c) that render function's final DOM write routed through
`morphTableInto`/the generic morph functions rather than a raw `innerHTML =`, (d) row/cell
elements carrying stable `data-jos-record-id`/`data-jos-col-key` attributes so the keyed path
engages, and (e) all mutation funneled through one or two centralized mutate functions that
themselves call persist-then-render, so no call site can forget either step. Everything else in
this document — state preservation, focus/scroll survival, cheap re-renders — falls out of those
five structural decisions for free; none of it is bespoke per-page code on Leads today.

## 10. Phase 3 migration status

Tracks each page's compliance with this standard as Phase 3 brings the rest of the app into
line. Updated as each page is migrated and verified, not written in advance.

### Home (`enhanceDashboard`/`renderHomeDashboard`, `journey.js:14009-14808`) — **Compliant**

Migrated: loading-stub `innerHTML` gated behind `if (!root.firstChild)` (was unconditional on
every render — the direct cause of the double-render symptom); final DOM write routed through
`morphTableInto(root, homeHtml)` instead of a raw `root.innerHTML =` replace (safe — verified
every Home listener is delegated to `root`, none per-widget, before making the change); the 30s
`setInterval` forcing a full rebuild every 60s removed entirely (traced what it repainted — every
value either already comes through the app's realtime pipeline via `refreshOpenAppViews`, or is
static state nothing else refetches on a timer either, so it bought no real freshness).

Verified live via Playwright: no leftover loading stub after first real paint; a widget-menu
action leaves every other widget's DOM node identity untouched; a focused input's focus, typed
value, and node identity, plus page scroll position, all survive an unrelated full re-render
byte-for-byte; no poll timer registered after boot; zero console errors.

**No remaining deviations.** Home does not use keyed (`data-jos-record-id`) diffing — but per §4,
keyed diffing only ever applies to `TR`/`TH`/`TD` on Leads too; Home's widgets, like Leads' own
detail panel and filter drawer, correctly use the same non-keyed positional path. This is
compliance, not a gap.

### Customers (`renderCustomers`/`renderCustomersPageInner`, `journey.js:~11860-11960`, plus the
Full Profile surface below) — **Compliant**

Customers turned out to be three distinct rendering surfaces, not one. The original P1 scope
(the two table-like surfaces reached from the Customers nav) is now migrated; the audit also
found a third surface — Full Profile — that is the app's actual customer-editing experience, and
brought that surface's compliance question to a real answer instead of assuming it out of scope.

**Level 1 ("Completed Customers" table) and Level 2 ("Command Center" single-customer view),
both inside `#jos-customers-root`:**

- Loading-stub `innerHTML` gated behind `if (!root.firstChild)` (was unconditional on every
  render, same double-full-replace symptom as Home).
- Both levels' final DOM write routed through `morphTableInto(root, …Html)` instead of a raw
  `root.innerHTML =` replace. Level 1's `<tr>` now also carries `data-jos-record-id` alongside
  its existing `data-jos-cust-row`, so the morph engine's row-keying actually engages.
- Removed a duplicate `data-jos-cust-row` / `data-jos-cust-tab` click-dispatch branch that lived
  directly in `bindRoot`'s generic delegated listener — near-identical logic already existed in
  `wireCustomersRoot`'s own listener, so every relevant click fired both, double-calling
  `renderCustomers()` per interaction. `wireCustomersRoot` is now the single owner of these
  clicks, matching the pattern already established for Leads/Inbox in this document.
- **Persistence bugs found and fixed** — three call sites mutated `S.customers` in place and
  called `renderCustomers()` without ever persisting: `cust-status-menu` (turned out to be dead —
  see below), `cust-favorite`, and `cust-archive` (both live, reachable from the more-menu). All
  mutation now funnels through one new centralized function, `mutateCustomerById(id, mutator,
  opts)` (mirroring Leads' `mutateLead`/`mutateLeadById`), which mutates, calls
  `upsertCustomer(...)` with only the fields that have a real `customers` table column
  (name/phone/email/vehicle/preferredService/customerType/statusOverride/recurringPlan/
  recurringAmount — confirmed against `mapCustRow`), syncs `S.jobs` + the Supabase `jobs` table
  when a rename happens, then renders. `favorite`/`status`/`archived` have no backing DB column
  at all (confirmed — `customers` table has none), so routing them through `mutateCustomerById`
  doesn't newly persist those specific fields to Supabase; what it fixes is the standard's actual
  requirement — one funnel, not scattered mutate-then-render call sites — and means any future
  field that does get a column is covered automatically.
- **Dead code removed**: `cust-edit`/`cust-edit-cancel`/`cust-edit-save` and `cust-status-menu`
  were all fully unreachable — no markup anywhere in Level 1 or Level 2 ever rendered
  `data-jos-act="cust-edit"` or `data-jos-act="cust-status-menu"`, and the `jos-ce-*` field ids
  the save handler read were never rendered either. This wasn't a working feature with a
  persistence bug, as the earlier read of the code suggested — it was an orphaned form that never
  existed in the live UI. Removed entirely rather than fixed in place, per this phase's rule
  against inventing new patterns to justify dead code.

Verified live via Playwright: single row click opens Level 2 cleanly with no double-dispatch
revert; `cust-edit`/`cust-status-menu` confirmed absent from the DOM and the handler now no-ops
safely if called; `cust-favorite`/`cust-archive` confirmed to call `upsertCustomer` exactly once
each; an unrelated re-render leaves an untouched node's identity intact; a focused, typed-into
search input keeps focus, value, node identity, and page scroll position across an unrelated
re-render; the realtime refresh entry point (`renderCustomersPage`) is callable without throwing;
zero console errors.

**Full Profile (`openFullCustomerProfile`/`renderProfileTab`/`profileTabHtml`, `journey.js:
~12586-12900`) — a separate, `document.body`-appended shell (`#jos-customer-profile`, created
once via `ensureProfileShell()` and reused for the app's lifetime), not part of
`#jos-customers-root`:**

This is the real, reachable customer-editing surface — the thing users actually open (via "Open
Full Profile" from Level 1/2's row menu) when they want more than the table view. Per this
phase's direction, it was audited against the standard on its own terms rather than ported to
`morphTableInto` by default:

- **Render boundary**: targeted DOM writes to named sub-elements (`#jos-cp-av`, `#jos-cp-name`,
  `#jos-cp-pill`, `#jos-cp-meta`, `#jos-cp-stats`, `#jos-cp-tabs`, `#jos-cp-body`), not a single
  full-shell replace and not the morph engine either. Switching tabs toggles `.on` directly on the
  tab buttons (no re-render of the tab bar) and calls `renderProfileTab(c, tab)`, which does
  `body.innerHTML = profileTabHtml(...)` — replacing only the body region's contents, leaving the
  avatar/name/pill/meta/stats/tabs regions completely untouched.
- **Verdict: should not be ported to `morphTableInto`.** The standard's underlying goal — cheap,
  targeted updates that don't destroy unrelated state — is already met by this surface's existing
  pattern. Porting it to the morph engine would add machinery (keyed diffing keyed on
  `data-jos-record-id`/`data-jos-col-key`) built for reorderable table rows, which this surface
  has none of. "Everything follows the Rendering Standard" is satisfied here by the existing
  implementation, not by making it use the same function name as Leads.
- **Intentionally different, and why**: clicking a job card inside the Jobs tab re-renders the
  *entire* tab body (`renderProfileTab`) just to update which card shows as selected, rather than
  patching one card's class. This is a full-region replace on a tab-relevant interaction — the
  same accepted pattern as Leads' own workspace-panel tab switching (§ referenced above). It's
  acceptable here for the same reason it's acceptable there: no keyed-row reordering or bulk
  selection is at stake, and nothing inside a job card is focusable or editable, so there's no
  focus-loss risk from the full-body replace.
- **Known gaps, documented rather than silently fixed (out of scope for a rendering-compliance
  pass, per Rule #1 — not something to build new UI for here)**:
  - Full Profile is not wired into `refreshOpenAppViews`'s realtime refresh path at all — if a
    customer's data changes elsewhere while their profile is open, it will not update live. Real
    gap, not fixed this phase.
  - **No inline editing of a customer's core profile fields exists anywhere in the live product
    today** — not Level 1, not Level 2, and not Full Profile's Overview tab either (it renders
    Name/Phone/Email/Address/City/etc. as plain read-only `<span>`/`<strong>` pairs, no
    `data-jos-field`, no click-to-edit). This was the real reason the original `cust-edit` form
    looked like a feature worth fixing — it was reaching for a gap that's real, just not reachable
    through the code that appeared to implement it. Building that editing UI is a product decision
    for a future phase, not something this compliance pass invents on its own.

Verified live via Playwright: shell created once and appended to `document.body`; header/avatar/
name/pill/meta/stats/tabs region node identities all survive a tab switch untouched; the tab
body's content genuinely changes between tabs; the correct tab is marked active; Overview
confirmed to contain zero inputs/`contenteditable` (matching the documented read-only gap above);
zero console errors.

### Jobs Calendar (`renderCalendar`/`renderJobsPage`'s calendar branch, `journey.js:~17301-18055,
18286-18420`) — **Compliant**

**Render boundary — CORRECTED after this was shipped and the user reported Jobs still visibly
rerendering.** This section originally concluded "keep the full `root.innerHTML =` replace for
Calendar" based on reasoning that was never actually tested against the code's real call timing —
that was the mistake, not the conclusion. What actually happened: opening the drawer from a
calendar job pill, and every Status/Date/Time edit made inside that drawer while on Calendar, hit
`renderJobsPage`'s `mainView === 'calendar'` branch and did a full `root.innerHTML =` replace of
the *entire grid* — a much larger, much more visible teardown than List view's morph — for
completely ordinary clicks that have nothing to do with dragging. That was the actual, still-live
cause of "Jobs rerenders, Leads doesn't" surviving the whole P0–P2 pass and the post-close audit
above; both of those investigations looked at the List view's edit pipeline (correctly cheap) and
never separately tested the Calendar view's.

Re-traced every place `render()`/`rerenderJobsOsFrom()` actually gets called relative to the drag
state, rather than reasoning about the drag code in isolation: `pointermove` — the *only* handler
that runs while a drag is actually in progress — touches inline styles and a temporary `draftEl`
directly and **never calls render**. Every render call (`pointerup`, `pointercancel`, HTML5
`drop`) fires *after* the drag has ended, by which point the temporary DOM is already removed
(`draftEl.remove()`) and the mutation is already committed. There is no code path where a render
lands mid-drag — the danger the full-replace was protecting against doesn't occur in this
codebase's actual control flow. **Corrected verdict: Calendar now morphs via `morphTableInto`,
same as List view and everywhere else.** Verified live: opening the drawer from a calendar pill
and editing Status inside it now preserve the toolbar/grid's node identity (morph, not teardown);
drag-to-reschedule, resize, and List view all independently reverified still work and still
persist correctly after the switch. Rule #1 holds either way — the standard wasn't wrong, the
verification of the exception was incomplete.

**Fixed to match precedent everywhere else in this phase:**
- Loading-stub `innerHTML` gated behind `if (!root.firstChild)` (`renderCalendar()`), matching
  Home/Customers/Jobs-list — was unconditional on every call, so every reschedule/resize/nav
  re-render flashed "Loading Calendar…" before the real content landed immediately after.
- **Realtime gap fixed**: `refreshOpenAppViews()` (`hubly.html:~15686`) checked `v-jobs` (via the
  legacy `renderCal`/`renderJobsPanel`), `v-leads`, `v-customers`, `v-money`, `v-quotes`,
  `v-dashboard` — no `v-calendar` branch existed at all. A realtime jobs/booking_requests change
  never reached an open Calendar page. Added a `viewIsOpen('v-calendar')` branch calling
  `HublyJourneyOS.renderCalendar()`, matching the `v-customers` branch's pattern.
- **Double-render-on-nav-switch fixed**: `switchV()` (`hubly.html`) had a direct
  `HublyJourneyOS.renderCalendar()` call in its own `if(v==='calendar')` block, and then
  unconditionally called `HublyJourneyOS.onSwitchView('calendar')` a few lines later — which
  *also* renders Calendar via its own `calendar: renderCalendar` map entry. Every nav click into
  Calendar rendered the whole page twice. Removed the redundant direct call; `onSwitchView`'s map
  entry is the single remaining path. (The same direct-call-plus-map-entry duplication exists for
  `dashboard`/`jobs`/`leads`/`customers` in `switchV` too — not fixed here, out of scope for a
  Calendar-specific pass, and lower-severity there since those pages' render functions are already
  gated/idempotent, so the second call is wasted work rather than a visible flicker the way
  Calendar's was before its own stub-gating fix above. Worth a dedicated cleanup pass if the team
  wants to eliminate the redundant work project-wide.)

**Persistence bugs found and fixed — the most significant finding of this pass**: dragging a job
to a new day/time, and resizing a job's duration, are the Calendar page's headline interactions
(the UI literally advertises "Drag & drop to reschedule"). Neither call ever persisted. Both
mutated `job.date`/`job.time`/`job.durationMin` in memory and re-rendered, with no call to
`persistJobPatch` anywhere in either path — a reschedule or resize looked real, then silently
reverted on refresh. Fixed by adding the missing `persistJobPatch` calls to both the drop handler
and the resize-commit branch of `endGcalPointer`, reusing the existing `date`/`time`/`durationMin`
column definitions' own `dbColumn`/`dbPatch` (`JOBS_DEFAULT_COLUMNS`) rather than hardcoding
`scheduled_date`/`scheduled_time`/`duration_hours` a second time. This is the same bug class (and
the same fix shape — funnel every mutation through the one function that persists) as Customers'
`cust-favorite`/`cust-archive` fixes and Leads' original `mutateLead` fix; it just hadn't been
found yet because drag interactions don't go through `mutateJobField`, the single place Jobs' own
schema-driven cell edits already commit through.

**Known gap, documented rather than fixed here (adjacent finding, not this phase's assigned
scope)**: `refreshOpenAppViews`'s `v-jobs` branch calls the *legacy* `renderCal()`/
`renderJobsPanel()` functions, not `HublyJourneyOS.renderJobs()` — meaning a realtime update while
a user is on the V4 Jobs *list* page may be refreshing DOM the user isn't actually looking at.
Same shape of bug as the Calendar gap just fixed, but on Jobs List, which was outside this P2's
scope (P2 was named "Jobs Calendar," not "Jobs List"). Flagged for the team to decide whether it's
real and worth a follow-up pass, not fixed unilaterally here.

Verified live via Playwright: no loading stub left after first real paint; a dashboard-then-back-
to-calendar nav round-trip leaves clean real content with no stale/duplicated stub; dragging a job
onto a bookable slot updates both in-memory state and calls `persistJobPatch` exactly once with
the correct `scheduled_date`/`scheduled_time` patch; resizing a job updates `durationMin` and
calls `persistJobPatch` exactly once with the correct `duration_hours` patch; the realtime refresh
path's new `v-calendar` branch runs without throwing; zero console errors.

*(This verification pass — like the "Post-P2 cleanup" and "visibly rerenders" sections below —
tested the List view's edit pipeline and the drag/resize mechanics; none of these passes tested
opening the drawer or editing a field from the Calendar view itself, which is what still full-
replaced. See "Calendar drawer/field-edit still full-replaced" further below for the fix and its
own live verification.)*

### Post-P2 cleanup: the two remaining split-brain/duplicate-render items

Two architectural inconsistencies were named explicitly during the Phase 3 P2 write-up rather
than fixed on the spot (the Calendar-specific instances of each were already fixed as part of
P2 itself). Both are now closed, plus the final "no legacy path still drives an active JourneyOS
page" audit requested alongside them.

**1. `refreshOpenAppViews()`'s `v-jobs` branch called the legacy renderer, not JourneyOS
(`hubly.html:~15699`).** `#v-jobs` is the same container the V4 Jobs list renders into
(`HublyJourneyOS.renderJobs`, mounted at `#jos-jobs-root`) — but the realtime refresh path was
still calling the legacy `renderCal()`/`renderJobsPanel()` unconditionally whenever `v-jobs` was
open. Concretely: realtime event → `refreshOpenAppViews()` → legacy renderer → user is looking at
JourneyOS. The two pages happen to share a container id, which is what let this go unnoticed —
the legacy calls weren't throwing, they just weren't reaching the DOM the user was actually
looking at. Fixed to call `HublyJourneyOS.renderJobs()` first (matching the `v-customers` branch's
existing pattern), with the legacy calls kept only as a fallback if JourneyOS isn't available.

**2. `switchV()` double-rendered on every nav switch into Dashboard/Jobs/Leads/Customers
(`hubly.html:~38588`).** Same root cause as the Calendar-specific case fixed in P2: each of these
views had a direct `HublyJourneyOS?.X?.()` call in `switchV()` itself, and then got rendered
*again* a few lines later by the unconditional `onSwitchView(v)` call, which renders the same page
via its own internal map (`dashboard: enhanceDashboard`, `jobs: renderJobs`,
`leads: renderLeads` — reached through `renderLeadsList()`'s one-line wrapper —
`customers: renderCustomers` — reached through the `renderCustomersPage` export alias). Every nav
click rendered the whole page twice. Fixed by gating the direct calls on function *availability*
rather than try-render-and-catch-fallback: `if(v==='dashboard'&&typeof
HublyJourneyOS?.enhanceDashboard!=='function'){ /* legacy fallback */ }`, same shape for
`jobs`/`customers`. This preserves the one behavior worth preserving — a legacy fallback if
JourneyOS genuinely isn't loaded — while eliminating the double-render in the normal (JourneyOS
loaded) case, where the page now renders exactly once, through `onSwitchView`'s map. `leads` had
no meaningful fallback to preserve (its original catch block was empty), so the direct call was
removed outright.

**Final audit — are any other legacy paths still driving an active JourneyOS page?** Traced every
remaining un-migrated legacy render call reachable from the two job-completion flows that still
call them (`completeJob()` and the mark-paid modal handler, `hubly.html:~41757` and `~45083`,
which each call `renderJobsPanel()`/`renderDashToday()`/`renderCustomersView()`/`renderLeadsBoard()`
after mutating a job) against the current static HTML for every JourneyOS-owned view container:

| Legacy function | Target DOM it needs | Exists in current HTML? | Result |
|---|---|---|---|
| `renderCal()` | `#cal-mon-lbl`/`#cal-days` | No — `#v-calendar` only contains `#jos-calendar-root` | Already self-redirects to `HublyJourneyOS.renderJobs()` via a `.jos-pixel-owned` check at its own top; the legacy body below is unreachable dead code, not a live conflict |
| `renderJobsPanel()` | (delegates before touching legacy DOM) | — | Same `.jos-pixel-owned` redirect shim as `renderCal()` |
| `renderDashToday()` | `#today-jobs` | No — `#v-dashboard` only contains `#jos-dash-root` | Self-guards (`if(!el)return`) — clean no-op |
| `renderCustomersView()` | `#cust-srch` and other legacy customers DOM | No — `#v-customers` only contains `#jos-customers-root` | Every DOM read is `?.`-chained — silently does nothing, clean no-op |
| `renderLeadsBoard()` | — | Function doesn't exist at all anymore | The `typeof renderLeadsBoard==='function'` guard around every call site already short-circuits it |

**Conclusion: no legacy rendering path is currently driving an active JourneyOS page.** Every
remaining legacy call site either already redirects to JourneyOS (`renderCal`/`renderJobsPanel`'s
`.jos-pixel-owned` shim, the same pattern this pass's `refreshOpenAppViews` fix now also uses) or
is inert today because its target DOM was already fully removed when JourneyOS took over that
view's static markup. These inert call sites (in the two job-completion flows above) were left in
place rather than deleted — they're dead, not dangerous, and removing them is a separate, smaller
hygiene pass than what was asked for here, not a rendering-correctness fix.

Verified live via Playwright: with JourneyOS loaded, navigating dashboard → jobs → customers →
back to dashboard calls the JourneyOS export functions zero times *through `switchV`'s own
direct-call sites* (the only remaining call is `onSwitchView`'s internal one) and calls none of
the legacy fallback functions; all three pages still render real content after the nav sequence;
`refreshOpenAppViews()` on an open Jobs page calls `HublyJourneyOS.renderJobs()` exactly once and
neither legacy `renderCal()` nor `renderJobsPanel()`; zero console errors.

### Post-close finding: Jobs visibly rerenders in normal use, Leads doesn't — empirically traced

Reported after the above was already "done on paper": Jobs visibly flickers during ordinary use;
Leads never does. Instrumented both pages' Status-edit pipeline directly (temporary
`performance.now()` + stack-capturing trace points at every render/mutate/persist function on
both pages, plus a `MutationObserver` on each root) rather than reasoning from source — the
architecture said the two pipelines should be identical, so the only way to find a real
difference was to measure, not read.

**Result: the interaction pipelines are not the problem.** For the identical action (open the
Status combo, pick a value, close) on both pages: Leads does 3 renders (open/commit/close) at
26 total DOM mutation records; Jobs does 2 (open, commit+close combined) at 23 — both morph, both
diffs are 2–5 nodes, both sub-10ms per render. Symmetric, comparably cheap, not the divergence.

**The actual divergence**: roughly 150ms after the Jobs interaction finishes — with *zero*
further interaction, confirmed by reproducing it with no click at all — `HublyJourneyOS.renderJobs()`
fires again, full page, unprompted. Captured call stack:
```
renderJobs (journey.js:17299)
  at renderJobsPanel (hubly.html:41078)
  at loadWeatherForecast (hubly.html:45254)
```
`loadWeatherForecast()` runs once per session at boot (`hubly.html:14390`) and awaits a real
network fetch — anywhere from a few hundred ms to a few seconds depending on latency — so its
completion lands at an essentially random moment relative to whatever the user is doing. Its
completion handler called `renderJobsPanel()` (→ `HublyJourneyOS.renderJobs()`, a full rebuild)
and `HublyJourneyOS.enhanceDashboard()` (a full Dashboard rebuild), **unconditionally, regardless
of which page was open**. Leads has no equivalent call anywhere — confirmed by grep. That's the
entire explanation: not a flaw in the rendering architecture, a leftover dependency from a
feature (a Jobs-page weather chip) that was never ported to JourneyOS and today has zero live UI,
still wired to trigger a full-page rebuild on completion.

**Fix — the dependency graph.** Checked where weather is actually displayed today: nowhere on
Jobs (the legacy day-detail weather chip that used it is unreachable — `renderJobsPanel()`
redirects to JourneyOS before ever reaching that markup); only on Home, via `.jos-home-weather`
inside `renderHomeDashboard`, driven by `homeWeatherSummary()`. Correct graph is `Weather API →
Home's weather widget`, not `Weather API → Jobs page`. Removed the `renderJobsPanel()` call from
`loadWeatherForecast()` entirely (no live consumer) and gated the Dashboard repaint behind
visibility.

**Broader audit, as requested**: before committing, searched every other async completion path
(Google Calendar sync/disconnect, auto-accepted bookings, review approval, job-detail-modal
actions, block-time submit, travel-buffer settings — geocoding/AI/photos/Quick Quote/analytics
were checked and were already correctly widget-scoped) for the same shape of bug — an async
completion, or a click handler reachable from a page other than Jobs, unconditionally calling a
full-page Jobs/Calendar/Dashboard renderer instead of checking whether that page was even open.

| Async/cross-page task | Trigger | Old render target | Correct target |
|---|---|---|---|
| `loadWeatherForecast()` | App boot; Editor city field | `renderJobsPanel()` (full Jobs) + `enhanceDashboard()` (unconditional) | Home weather widget only, gated on `viewIsOpen('v-dashboard')` |
| `syncGoogleCalendar()` | "Sync Now" (Editor or Jobs card); post-OAuth-return | `renderJobsPanel()` + `renderCal()` (unconditional) | Jobs/Calendar, each gated |
| `disconnectGoogleCalendar()` | "Disconnect" (Editor card) | same | same, gated |
| `autoAcceptSkipLeadBookings()` (×2 branches) | Runs inside every `loadJobs()` call — boot, realtime cascade, GCal sync, booking flows | `renderJobsPanel()` (unconditional); dashboard/nav-badge calls left as-is (self-guarding, some own a nav badge) | Jobs gated; dashboard calls unchanged (already safe) |
| `_acceptBookingRequestInner()` (silent branches) | Auto-accept, and direct Accept click | same | same, gated |
| `approvePendingReview()` | "Approve" on Dashboard's pending-reviews widget | `renderJobsPanel()` (unconditional) — updates a job-row review badge | Jobs, gated |
| Job-detail modal: `completeJob`, `saveJobAmount`, `cancelHublyJob`, `deleteHublyJob`, `rescheduleJob`, `saveJobDetailEdits` | `viewJob()` opens this modal from *any* page (Dashboard bookings widget, Customers job history, etc.), not just Jobs | `renderJobsPanel()`/`renderCal()` (unconditional) | Jobs/Calendar, gated |
| `submitBlockTime()` | Block-time modal, openable from Jobs *and* Dashboard's quick-action | same | same, gated |
| Travel buffer settings (`applyRecommendedTravelBuffers`, `onTravelBufferChange`) | Editor settings, not async but same cross-page shape — explicitly affects the Jobs calendar's travel blocks | `renderJobsPanel()` (unconditional) | Jobs, gated |

Fix shape, applied consistently everywhere in the table: three new shared helpers next to
`viewIsOpen` — `refreshJobsIfOpen()`, `refreshCalendarIfOpen()`, `refreshDashboardIfOpen()` — each
exactly matching `refreshOpenAppViews()`'s own already-correct per-branch logic (JourneyOS render
first, legacy fallback only if unavailable, no-op if the page isn't open). `refreshOpenAppViews()`
itself now calls these too, removing the duplication rather than leaving three copies of the same
logic. Every call site above now calls the helper instead of hand-rolling its own unconditional
render list — one canonical "refresh this page only if it's open" implementation, not eleven
slightly-different ones.

**Known, accepted residual**: `loadWeatherForecast()` can still call `enhanceDashboard()` twice
when it's invoked from Home's own `ensureHomeWeatherLoaded()` (which independently re-renders
Home after awaiting the same fetch) — both calls are cheap morphs now, so this is wasted work, not
a visible bug, matching the same lower-priority class as the `switchV` residuals already accepted
in the section above. Not fixed here.

Verified live via Playwright: weather resolving while Jobs (not Dashboard) is open now calls
`HublyJourneyOS.renderJobs()` zero times; weather resolving while Dashboard is open still updates
the `.jos-home-weather` widget correctly (no regression); the three new helpers independently
confirmed to fire exactly the right renderer (or none) in both visibility states; zero console
errors.

### Calendar drawer/field-edit still full-replaced — the weather fix wasn't the whole story

Reported after the weather fix above shipped and was live in production: clicking Status/Date/
Time (or anything) inside Jobs still visibly rerendered. It did — the weather fix was correct and
necessary but addressed a *different* render trigger (a background fetch) than what the user was
actually seeing on every click. The real, still-live cause: `renderJobsPage`'s calendar branch
(`journey.js:~18053`, see the corrected "Render boundary" note under Jobs Calendar above) did a
full `root.innerHTML = jobsPageHtml` on *every* render while on Calendar — not just drag/resize,
but opening the drawer from a job pill and every single field edit made inside it. That's the
common path for "touch anything in Jobs": open a job, click Status, click Date — three full grid
teardowns for three ordinary clicks, none of them a drag.

The original P2 pass (and the "visibly rerenders" investigation before the weather fix) both
specifically instrumented and measured the List view's Status-edit pipeline, confirmed it was
cheap and symmetric with Leads, and treated that as representative of "Jobs." It wasn't — Calendar
is a separate render path with its own write branch, and nothing in either prior pass opened a
job or edited a field while *on* Calendar specifically. That gap is why the bug outlived two
rounds of fixes: each one was correctly verified against the thing it tested, and neither one
tested this.

**Fix**: traced the actual call timing (not just read the drag code, which is what led to the
original "keep it full-replace" call) — `pointermove`, the only handler active *during* a live
drag, never calls render; it only touches inline styles and a temporary `draftEl` directly. Every
render call happens on `pointerup`/`pointercancel`/`drop`, strictly *after* the drag has ended and
that temp DOM is already removed. There is no code path where render and an in-progress drag
overlap, so the risk the full-replace existed to prevent doesn't occur. Switched Calendar to
`morphTableInto`, same as every other page.

Verified live via Playwright: opening the drawer from a Calendar job pill now preserves the
toolbar/grid's node identity (a targeted morph, not a teardown) instead of destroying it; editing
Status inside that drawer while on Calendar does the same and still calls `persistJobPatch`
exactly once; drag-to-reschedule and resize were independently re-run end-to-end after the switch
and still update state and persist correctly; List view re-checked and unaffected; zero console
errors.

**Lesson for next time a page is deliberately kept off the standard**: verify the exception
against every render trigger the page actually has (here: open-record, field-edit, drag, resize,
create — five triggers, only two of which were ever tested), not just the one the exception was
originally written to protect.

### The actual root cause of "Jobs still renders on every click" — found after three investigations that each came back clean, for a real reason

The two fixes above (weather callback, Calendar's full-replace) were both real, both correctly
verified, and neither one was it. The user kept seeing a flash on ordinary Status/Date/Time edits
after both shipped. Three separate investigation passes — render-count tracing, realtime-echo
tracing with live `console.log` instrumentation deployed to production, and a side-by-side
Jobs-vs-Leads trace — all came back clean, because all three were instrumenting the JS layer, and
the bug was one layer below it, in a structural HTML-ordering issue that only a live DOM mutation
diff (not a call-count or timing trace) could surface.

**Root cause**: `positionJobsComboPop()` reparents the Status/Service/etc. combo-pop out of its
rendered position — `if (pop.parentElement !== root) root.appendChild(pop);` — straight to
`#jos-jobs-root`, for the same reason `positionLeadsComboPop()` does the identical thing on Leads:
a `position:fixed` popover nested under a scrolled/sticky table cell measures wrong for its first
~250ms. Both pages do this. The difference is where the popover sits relative to its siblings in
the *generated HTML*, not in the reparenting trick itself:

- **Leads**: `renderLeadsBulkBar() + renderLeadsComboPop() + '</div>'` — combo-pop is the *last*
  child of its container. Reparenting it out just shortens that container by one, at the end.
  Nothing downstream to disturb.
- **Jobs (before this fix)**: `renderJobsComboPop() + drawer + statusMenu + rowMenu +
  gcalCreatePop + FAB button` — combo-pop sat *before* five other elements in the same container
  (`.jos-jobs-shell`), including the drawer. Once reparented out, the *next* render's diff
  compares the live DOM (pop missing from its expected slot) against the fresh HTML (which always
  describes the pop as present there) — a real length mismatch.
  `morphTableChildren`'s non-keyed fallback (§4, everything that isn't `TR`/`TH`/`TD`) doesn't
  reconcile a mismatch like that with a targeted patch — it does `parent.replaceChild()`, and that
  cascades through every sibling positioned after the pop's expected slot: the drawer, both
  popover-menu placeholders, and the FAB button all got destroyed and rebuilt from scratch, not
  patched.

**Why it was invisible almost everywhere**: the FAB button and the two popover placeholders are
`display:none`/`hidden` when inactive — destroying and rebuilding an invisible element produces
no visible change, which is exactly why the granular MutationObserver traces from the two earlier
fixes' verification passes didn't flag it as a problem. But the drawer is not hidden when it's
open, and `.jos-jobs-drawer` has `animation: josSlideIn .22s ease both` — a keyframe animation
that auto-plays whenever the browser sees the element freshly composited, which is exactly what
happens to a `replaceChild`'d node. Leads' equivalent panel (`.jos-ld-main`) uses a `transition`
on a node that persists across renders, not an `animation` on a node that gets recreated — a
second, independent reason it wouldn't have shown the same symptom even in the hypothetical case
where it *was* subject to the same cascade (confirmed live it isn't: a granular mutation trace on
a real Leads Status edit at 200+ leads touches nothing but the combo-pop node itself).

**Confirmed end-to-end with live DOM node identity, not inferred from the structural diff alone**:
tagged the live drawer DOM node, opened it, edited Status from inside it once (no effect — the
combo-pop hadn't been reparented yet this session), then edited a second time — the tag was gone;
a brand-new node had replaced it, replaying the slide-in animation. That's the flash. A parallel
edit on a plain inline-edited field (Date, which never touches the combo-pop system) left the
tagged node untouched, confirming the bug was specific to `type: 'select'` fields.

**Fix**: moved `renderJobsComboPop(root)` to be the last element in the concatenated HTML string,
after the FAB button — matching Leads' structure exactly, so there's nothing after it to disturb
when it gets reparented. Confirmed no CSS selector or JS code depends on its prior sibling
position.

**Also true, and flagged as a known but out-of-scope adjacent risk, not fixed here**:
`renderJobsBulkBar()` is *also* conditionally empty vs. present (`if (!ids.length) return '';`)
and still sits before the drawer/statusMenu/rowMenu/gcalCreatePop/FAB. Toggling bulk-select
selection while the drawer is simultaneously open could in principle trigger the same cascade via
a different element than the one just fixed. Real, same bug class, much rarer combination of
state in practice (bulk-selecting rows and having a single job's drawer open are usually
mutually exclusive user flows) — worth a follow-up pass, not folded into this fix. Tracked with
full reproduction/confirmation/fix steps in `/KNOWN_ISSUES.md` (repo root) rather than left as a
sentence here only.

Verified live via Playwright: the exact same drawer-identity-tagging test that caught the bug now
shows the drawer node survives a Status edit from inside it, repeated three times in a row (the
second edit was the one that always broke before — comboPop already reparented from the first);
the granular mutation trace for a repeat Status edit on the List view dropped from 19 mutation
records including FAB-button churn to 2, with zero FAB/popover churn; drag-to-reschedule and
resize on Calendar re-run end-to-end and still update state and persist correctly; the same
drawer-identity check re-run on Calendar's own drawer (opened via a job pill, not a table cell)
also now survives; List view filtering and row visibility re-checked and unaffected; zero console
errors across every test.

### Second, unrelated drawer-flash trigger, found after the above shipped: hand-written `replaceWith()` on tab switch

Reported after commit `bebc95e` (the combo-pop fix above) was confirmed live and correct in
production. Before assuming regression or a bad fix, re-verified against the exact live-served
bytes first: fetched `journey.js` directly from production, confirmed via response headers it was
freshly served (not a stale cache hit), diffed it byte-for-byte against the repo's committed
code — identical. Re-ran the exact drawer-identity-tagging test from the fix above against that
confirmed-live code: 5 consecutive Status edits, drawer survives every one. **The combo-pop fix
was not the problem and had not regressed.**

Per the same principle as §4.7 ("verify the exception against every render trigger, not just the
one it was written for"), treated this as a genuinely separate investigation rather than assuming
the same root cause. Tagged the drawer's DOM identity through a realistic sequence — switch tabs,
edit Service, edit Amount, edit Technician, edit Notes, toggle bulk-select — and every single one
showed the drawer destroyed. Isolating each interaction in a *fresh* session (no prior interaction
to contaminate the result) narrowed it to exactly one real trigger: **switching drawer tabs**
(Overview → Photos → Checklist → Invoice) destroyed the drawer on the very first click, with no
prior comboPop use needed. Service/Amount/Technician/Notes edits were all clean in isolation — the
earlier sequential test's later rounds showing them as "destroyed" were downstream of the drawer
already having been replaced by an *earlier* tab switch in that same sequence, not four more
separate bugs.

**Root cause — completely different from the comboPop bug, not a variant of it**: the
`data-jos-job-ws` (tab switch) click handler, `journey.js:~18259-18276` (pre-fix), had its own
hand-written DOM update, explicitly *not* going through `morphTableInto`/`rerenderJobsOsFrom` at
all:
```js
var next = renderJobDrawer(root, job, root._josJobWorkspace);
var wrap = document.createElement('div');
wrap.innerHTML = next;
var fresh = wrap.firstChild;
if (fresh) drawer.replaceWith(fresh);   // <- destroys and replaces the node
bindRoot(el('jos-jobs-drawer') || root);
```
The comment above it read *"Prefer in-place drawer update to avoid page flash"* — describing the
intended behavior, not what the code actually did. `replaceWith()` unconditionally destroys the
old `.jos-jobs-drawer` node and inserts a brand-new one on every tab click, which is exactly what
retriggers its `josSlideIn` entrance animation. The comboPop-reparenting bug required a *prior*
reparent to have happened before it manifested (clean on the first edit, broken on the second);
this one broke on the *very first* tab click, unconditionally, every time — a categorically
different failure, just producing the identical visible symptom.

**Fix**: deleted the special case entirely rather than patching it. `renderJobsPage` already reads
`root._josJobWorkspace` (set earlier in the same handler) to pick the active tab, and the general
render path morphs safely now that the comboPop fix landed — so the hand-rolled update was not
just buggy, it was unnecessary. The handler now just calls `rerenderJobsOsFrom(root)`, the same
call every other Jobs interaction already uses. The extra `bindRoot(el('jos-jobs-drawer'))` call
was removed too — confirmed live that the drawer's own click handling (including its close button)
was already covered by the outer root's existing delegated listener the whole time, so this was
attaching a second, redundant listener to a node that no longer gets destroyed and needs it.

**Third-bug check, done before calling this closed**: grepped the entire codebase for
`.replaceWith(` — exactly one other hit, in `hubly.html`, an `<img onerror>` broken-image
fallback, unrelated pattern (swapping a failed image for a placeholder icon, not a render-path
bug). Grepped for the same "avoid ... flash" comment language — one other hit, `hubly.html:~30293`,
a completely different and legitimate technique (rendering cached data immediately while a refresh
is in flight, not a node-destroying update). This was a genuinely isolated, one-off instance, not
a systemic pattern repeated elsewhere.

Verified live via Playwright: tagged the drawer's DOM identity through 6 consecutive tab switches
(Overview → Photos → Checklist → Invoice → Overview → Photos → Overview) — survived every one,
zero FAB-button churn on any of them (compare to the ~19-mutation cascade the original comboPop
bug produced); mixed a Status edit in between tab switches — drawer still survives, both mechanisms
confirmed safe in combination; confirmed the active tab's content is actually correct after each
switch, not just that the node survived; confirmed the drawer's close button and other click
handling still work correctly after several tab switches (validates removing the redundant
`bindRoot` call didn't break anything); zero console errors.
