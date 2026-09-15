# Nothing in Hubly renders squeezed — the measurement, and what it found

`npm run measure:squeeze` (report) · `npm run check:squeezed` (the standing check)
Measured 2026-09-15.

## The rule

Adrian, 2026-09-15: *"the check my sales edit my website things on this view are too squeezed. i
know those things will be fixed because they are not supposed to be there, but we should not have
squeezed things like that, it doesn't look good."*

**Not a fix for two cards.** Removing them does not satisfy this — whatever stands there next has
the same rail and the same widths. At every width a surface can reach: text does not break inside
a word, labels do not crush, controls do not overlap, nothing clips. A thing that cannot be shown
properly at a width **changes shape** — stacks, truncates at a word boundary, or is not shown —
but it is never rendered mangled.

## The real widths, measured from rendered boxes

| | rail | left (thread) pane | right pane |
|---|---|---|---|
| viewport 1440 | 260 | **380** | 800 |
| viewport 1280 | 260 | **380** | 640 |
| viewport 1024 | 260 | **380** | 384 |
| viewport 920 | 260 | **380** | 280 |

**The thread pane does not narrow with the viewport.** `.hc-app-left` is `flex:0 0 380px` in every
mode that shows a right pane — home-with-site, website, planner, jobs, customers — and the rail is
`flex:0 0 260px`. The *right* pane absorbs all the change. Below 900px a mobile breakpoint takes
over and the left pane is hidden entirely.

So the answer to "what is its true minimum" is: **380px, in every mode, today.**

## What broke, and why the nominal width was not the whole story

At exactly 380px the probe found **no mid-word breaks** — yet Adrian photographed *"Chec k my
sales"* and *"Edit my webs ite"*. Both are true, and the gap between them is the finding:

| pane width | label box | words broken mid-word |
|---|---|---|
| 380px | 84×39 (**2 lines**) | 0 |
| 340px | 69×39 | **1** |
| 300px | 51×78 (4 lines) | **3** |
| 280px | 39×78 | **5** |
| 260px | 28×117 | **7** |

His effective label box was narrower than the nominal one — a larger system font, browser zoom,
or a narrower window all do that, and **none of them is a state we control.** A layout that holds
only at exactly 380px is one font setting away from breaking again. That is why the check tests
down to 220px rather than stopping at the width the CSS nominally produces.

**And at 380px it was already wrong**: `"Check my sales"` over two lines in an 84px box is the
"squeezed" he objected to, with or without a split word.

## Two independent causes

**1. The enabling rule was inherited.** `.hc-msg{overflow-wrap:anywhere}` exists for a good
reason — a pasted URL must wrap inside a chat bubble rather than overflow it. But the action
cards (`hc-msg hubly hc-acts`), the suggestion chips and the record cards are **all `.hc-msg`**,
so every label inherited permission to split a word. A label has no unbreakable token to rescue.
Labels now set `overflow-wrap:normal;word-break:normal;hyphens:none`; the chat bubble keeps
`anywhere`.

**2. Two columns at any width was the crush.** `repeat(2, minmax(0,1fr))` is two columns in a
380px pane whatever that costs — 168px cards, 84px labels. It is `repeat(auto-fit,minmax(190px,1fr))`
now, so the row **stacks** instead of crushing: one full-width card, one line of label.

Result: **one line at every width from 380px down to 160px**, zero breaks, zero clipping.

## The check, and what it refuses to accept as evidence

`scripts/check-nothing-squeezed.mjs`, red-proofed by restoring each cause separately:

- restoring two fixed columns → leg 2 goes red with `"Check my sales"=3ln/63px` — **the
  screenshot, reproduced by the check**
- restoring the inherited `overflow-wrap` → leg 3 goes red

**It measures geometry, not presence.** An assertion that the label is *there* passes happily on
`"Chec k my sales"`: the string is intact and the rendering is broken. `squeezeProbe` puts a
`Range` around each word and asks the browser where that word landed; a word whose rects sit on
two different lines was split. That is Lesson 83 applied to layout.

**Leg 0 exists because the first run of the measurement reported "0 findings" while looking at
nothing.** `#hcApp` was never revealed, every pane measured 0 wide, and a clean result read like
success. The check now fails to run rather than pass when nothing rendered.

## Ordering, as instructed

The empty-collection rule was settled and shipped first (`a836ad3`), so this laid out **what
survives** rather than styling a card about to be deleted. On an account with nothing behind them,
`View my schedule`, `See my customers`, `Check my sales` and the collection chips are no longer
rendered at all.

## Not covered

- **`public/hubly.html`** — the public site and the booking wizard. Same rule applies; not
  measured. This sweep is the owner shell only.
- **Mobile.** Claude Code cannot verify a true 390px viewport or a soft keyboard; the sub-900px
  breakpoint is untested here and must be checked on a real phone.
- **Overlap.** The probe finds mid-word breaks and clipping. Overlapping controls are in the rule
  and are *not* yet detected — stated rather than implied by a green check.
