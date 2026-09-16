# The sweep: doors closed by mutual assumption

**The shape, named 2026-09-16** (see `docs/CHECKER_LESSONS.md`):

> **Two entrances to the same working feature, each removed because the other existed. Neither
> removal is wrong on its own. The feature is intact and unreachable.**

Distinct from **built-and-doorless**, which is a feature that never had an entrance. This one had
two, and is harder to see because every commit involved is individually correct and carries a
written rationale.

---

## Method, and what it cannot see

Commit-message archaeology was tried first and was useless — the phrasing ("duplicated",
"already", "instead") is too common. **This sweep is structural instead**, which is also derived
rather than a hand-kept list:

1. Find every `<button|a|div|span>` in `public/*.html` carrying an `onclick="fn()"` **and** either a
   `hidden` attribute or a class a stylesheet sets to `display:none !important`.
2. For each `fn`, count callers across all shipped HTML.
3. Flag where **the only caller is the hidden control**.
4. Then the discriminator that separates a defect from correct behaviour: **does anything ever
   un-hide it?** A "Clear" button hidden until a file is attached is correct. A control nothing can
   ever reveal is a closed door.

**The limit, stated:** step 4 traces un-hiding by element id. Where a control is revealed through a
local variable (`btn.classList.remove('hidden')`), the trace cannot follow it, so **a control listed
below as never-revealed is high-confidence, not certain**. Every entry says which evidence it rests
on.

**Scope:** `public/hubly.html`, `public/platform-home.html`, `public/get-done.html`,
`public/enter.html`, and `public/journey-os/operate-pixel.css`. 40 hidden controls with a named
handler; 7 where the only caller is the hidden control; **3 confirmed, 1 of a related shape,
3 cleared.**

---

## CONFIRMED — the feature works and nothing can reach it

### 1. `openJobsNew()` — the New Job drawer. The original instance.

| | |
|---|---|
| control | `public/hubly.html:11179`, `class="nav-jobs-new" hidden aria-hidden="true"` |
| hidden by | **`ead44be`, 2026-07-27** — *"It only appeared in Jobs & Calendar and duplicated the header CTA … Keep New Job in the page header only."* |
| the other door | `public/hubly.html:11290`, `.jos-legacy-bar` — set `display:none !important` by the Journey OS pixel redesign as legacy chrome |
| evidence | `openJobsNew()` is defined at `:41418`, **its only caller is the hidden button**, and `nav-jobs-new` is referenced **zero times** in JS, so nothing can un-hide it |

**Both rationales were right. The header CTA did duplicate it; the legacy bar was legacy.** Each
removal assumed the other door was open.

### 2. `openServiceQuiz()` — "Not sure what you need? Answer one question"

| | |
|---|---|
| control | `public/hubly.html:12377`, `id="ws-quiz-entry" class="ws-quiz-btn hidden"` |
| evidence | `getElementById('ws-quiz-entry')` appears **zero times**; no `remove('hidden')` targets it by id |

A service-picker quiz on the customer-facing site, built, styled, and permanently `hidden`. **No
second door was found for it at all** — so this may be built-and-doorless rather than this shape.
Recorded here because it surfaced in the same sweep; the distinction needs the commit that added
the class, which is not yet traced.

### 3. `pickContactInto('customer')` — "From phone"

| | |
|---|---|
| control | `public/hubly.html:12916`, `id="nc-pick-contact" class="btn btn-out btn-sm hidden"` |
| evidence | `getElementById('nc-pick-contact')` appears **zero times** |

Pull a customer's details from the device's contact picker instead of typing them. **This is
directly relevant to A2's carry-forward** — "he should not type a phone number twice" — and it is a
door that already exists, hidden.

---

## A RELATED SHAPE — the opener still runs, the stylesheet overrules it

### 4. `openSmartQuote()` — Quick Quote

| | |
|---|---|
| control | `public/hubly.html:11291`, `id="bar-qq-btn" class="btn btn-out btn-sm jos-legacy-bar"` |
| JS | **still manages it**: `getElementById('bar-qq-btn')?.classList.toggle('hidden', v==='quotes')` |
| CSS | `.jos-legacy-bar { display:none !important }` under `jos-pixel` |

Not two doors — **one door whose opener is still wired and still runs, nailed shut by a later
stylesheet.** The JS toggling it is dead code that looks alive, and anyone reading only the JS would
conclude the control is reachable. Worth naming as a sibling: the same end state (feature intact,
unreachable) reached by CSS outliving JS rather than by two removals.

---

## CLEARED — hidden until state, which is correct

| control | why it is fine |
|---|---|
| `jd-map-link` / `openJobMapsById()` | hidden at render time only when the job has no address: `` class="jd-map-link${addr?'':' hidden'}" `` — correct by construction |
| `ws-chat-teaser` / `wsChatTeaserClick()` | `wsChatShowNudge()` calls `teaser.classList.remove('hidden')` at `:17070` after real preconditions |
| `ed-share-image-clear` / `clearShareImage()` | managed by `syncShareImagePreview()`; a Clear button for an image that may not exist yet |

---

## What to do with this

**None of it is built in this round.** Items 1 and 3 are on Adrian's list already — A ("reopen
`ead44be`: unhide the New Job drawer. The feature is intact. This is the cheapest real win on the
list") and A2 (carry-forward). Item 2 needs its own ruling: a customer-facing quiz is a product
decision, not a door to open because it happens to exist.

**And the standing check the shape implies:** when a control is removed with a rationale that names
another control, **that other control is now a dependency**. Say so in the commit, or the next
removal is free to take it.
