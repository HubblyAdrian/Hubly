# The `+` belongs in the renderer — established before writing, and it is already there

**2026-09-13. Nothing written.** Adrian's ruling to establish first:

> *Do not re-add the + after every redraw. That is a race against the renderer and we lose it
> permanently… The likely right answer: whatever draws the service cards draws the + too, in the
> same pass, gated on edit mode. One renderer, one output, no reconciliation.*

## 1. What removes it — measured

The removal watcher, armed at document start and watching `#ws-page`'s PARENT (so a wholesale
replacement of `#ws-page` could not hide):

```
{"what":"DIV","from":"#ws-services","heldPlus":true,"t":1921}
{"what":"the + itself","from":".ws-svc-grid","gridChildrenAfter":3,"t":1921}
```

One event at **t=1921ms**: `#ws-services` — which *is* the `.ws-svc-grid` — has its children
replaced, and the `+` goes with them. Grid children after: 3, the cards, no `+`.

`#ws-page` is **not** replaced (`data-hc-wired` survives), so an observer on it is not detached.
The observer fires and re-mounts — into a grid whose new cards have not landed yet in the same
microtask, so `hcServicesGrid()` finds no anchors, returns null, and no further mutation ever
triggers a retry. **A race, exactly as ruled against.**

## 2. The renderer already draws an add tile, in the same pass, gated on edit mode

`renderWebsite()`, `public/hubly.html:40081`:

```js
const svcGrid = prefix ? document.getElementById(p+'-services') : wsPageEl('ws-services');
if (svcGrid) {
  const svcs = getBookingServices().filter(s => s.name);
  const addTile = isEditorViewOpen()
    ? '<button type="button" class="ws-pe-add-tile ws-pe-target" data-pe="add-service" ' +
      'data-pe-label="Add service"><span class="ws-pe-add-plus">+</span><span>Add service</span></button>'
    : '';
  if (svcs.length) svcGrid.innerHTML = svcs.map((s,i) => wsServiceCardHtml(s,i)).join('') + addTile;
  else svcGrid.innerHTML = isEditorViewOpen() ? addTile : `<div…>${t('wsServicesComing')}</div>`;
}
```

**One renderer, one output, no reconciliation.** It cannot be raced, because the `+` is written
in the same `innerHTML` assignment as the cards. Memberships use the identical pattern
(`data-pe="add-membership"`), so it is a convention rather than a one-off, and `.ws-pe-add-tile`
has full CSS including per-layout theming for `neon-nights`, `chrome-velocity`, `obsidian-gold`.

**This is Lesson 49 for the fifth time.** `hcMountAddService` is ~170 lines that bolt a `+` onto
a grid the renderer already draws a `+` into. We built a mechanism to re-derive something the
product already does correctly.

## 3. Can the renderer know whether editing is on? — yes, and it already asks

It asks `isEditorViewOpen()`, which is true only inside `/dashboard`. Canvas edit mode is
`hcEditableEnabled()` — `?hcEditable=1` — and both are plain functions on the same file.

**So the answer to the more interesting version of the question is: the renderer already knows
about one kind of editing and needs to be told about the second.** That is a shared predicate,
not an architecture problem:

```js
function wsEditingOn(){ return isEditorViewOpen() || hcEditableEnabled(); }
```

## What it costs

| piece | cost |
|---|---|
| `wsEditingOn()` and the two `isEditorViewOpen()` sites in the services grid | **~4 lines** |
| wire `data-pe="add-service"` on the CANVAS to post `hcFreeformAddService` | **~15 lines** — `/dashboard` handles it at `hubly.html:35446` through the ws-pe handlers, which are `isEditorViewOpen()`-gated; the canvas needs the same click to post to the parent instead |
| **delete `hcMountAddService` + `hcServicesGrid` + the observer** | **−190 lines** |
| migrations | **none** |

**Net: a smaller codebase.** And it disposes of gates 3 and 4 entirely — the observer and the
once-only guard were both scaffolding for a race that should not exist.

### The one thing to check before writing

`renderWebsite()` runs on the PUBLIC page too. The tile must be gated so a visitor never sees
it — `wsEditingOn()` is false without `?hcEditable=1`, and the public snapshots already confirm
no editor chrome leaks (`editorChrome: 0`, `data-hc-wired: false` for a visitor on both the
fixture and Graef). Worth re-confirming after the change rather than assuming.

**Not written. Ruling requested on the shape above.**
