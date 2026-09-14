# The manual `+` — stopping before writing, as instructed

**2026-09-13. Nothing written.** The condition was: *"If the insert path turns out to need
something not in your costing, stop and say so before writing it."* It does, and the surprise
runs in both directions.

## 1. The `+` already exists for freeform, end to end

`hcMountAddService()` — `public/hubly.html:54739`, mounted by `wireHcEditingSurface` at `:54209`:

- `hcServicesGrid()` finds the grid **structurally** — walk up from a `data-hubly-service`
  anchor to the level whose siblings also hold services; that level is the card, its parent the
  grid. (Its own comment records a first version that climbed past the card to the section and
  therefore "mounted on no page at all".)
- It appends a dashed tile: **`+ Add service`**, with name / price / one-line description, and
  **refuses an empty name** rather than sending and guessing.
- `post({type:'hcFreeformAddService', …})` → `hcAddServiceFromCanvas` →
  `hcRecordEdit({kind:'service', op:'add'})` → `applyOwnerRecordEdit` → a `services` row, then
  **`applyServicesToFreeform`** — the donor-clone placement path.

| v1 scope item | state |
|---|---|
| one affordance on the page in edit mode | **ships** (freeform only — see §3) |
| inserts a service block, styled by cloning its neighbours | **ships** — `placeServicesInFreeform` |
| editable in place: name, price, action button | **ships** — the form collects the three before insert; per-field edit afterwards is `directFreeformEdit`; the Book button is `ensureServiceCardCtas` |
| a row on every branch including the no-op | **ships** — `notePlacement` fires on every branch inside `applyServicesToFreeform` |
| no code branches on "is this a storefront" | **holds** — nothing does |
| byte-verified placement, `verifiedPlaced` carried | **NO** — §2 |
| both stores | **NO** — §3 |

## 2. `insertFreeformNode` is NOT needed, and my costing was wrong to name it

I costed it as *"the one new object, same rule as `get_business_jobs`"*. **It is not needed for
v1.** The `+` does not insert a generic node — it adds a SERVICE, and the service placement path
already clones a donor entry into the grid. A generic node-insert object would be built and
then not used by the thing it was built for.

**Correcting my own costing is the point of the stop condition**, so: the one new object is
**nothing**. What v1 needs is two wirings and one unknown.

## 3. What it actually needs

### (a) The classic store is not wired — ~15 lines, no new object

`applyOwnerRecordEdit`'s service branch calls **only** `applyServicesToFreeform`. Tonight's
`applyServicesToClassic` (and `set_business_service_catalog`) was wired into **`setServices`
alone**. So the `+` on a classic page would write the `services` row and nothing the page reads
— the exact defect of this morning, in a second path. This is the sibling-bug rule: the class was
"an owner adds a service and the classic store never hears about it", and it was fixed in one of
its two places.

### (b) `verifiedPlaced` is not carried — ~10 lines

The branch composes its reply from `placement.status`:

```ts
const landed = placement.status === "placed" || "partial" || "no_prices";
summary: landed ? `Added ${name} on your page, in the services section.` : …
```

`verifiedPlaced` — what is actually in the saved bytes — is computed by
`applyServicesToFreeform` and **dropped here**, and `composeServicesTruth` is never called.
That is precisely the shape that told an owner three prices were on a page containing none of
them (Lesson 11). **`raw.services` does carry the placement, so the fix is to compose from it.**

### (c) THE UNKNOWN — the affordance has no mount point on a classic page

`hcServicesGrid()` needs a `data-hubly-service` anchor. **The classic renderer never emits one.**
All six occurrences of `data-hubly-service` in `hubly.html` are READERS; the classic cards are
`.ws-svc-card` / `.ws-svc-name`, painted from `meta.service_catalog`. So on a classic page the
grid-finder returns `null` and `hcMountAddService()` returns before doing anything.

**This is the piece that was not in my costing**, and it is not a line count — it is a choice:

| option | cost | consequence |
|---|---|---|
| **A. Stamp `data-hubly-service` in the classic renderer** where it paints each card | ~5 lines in `renderWebsite` | one anchor convention across both stores; `hcServicesGrid`, the price placer and the selection code all start working on classic for free. **My recommendation** |
| **B. Teach `hcServicesGrid` a second selector** (`.ws-svc-card`) | ~3 lines | two matchers for one concept — the thing `markServiceAnchorsInFreeform` exists to prevent (*"a matcher per shape, and the model invents new shapes every rebuild"*) |
| **C. Ship v1 freeform-only** | 0 | breaks "both stores", and Graef is classic |

**A is one line of markup in the renderer and it is the same decision the freeform generator
already made.** But it is a change to what every classic page emits, so it is yours to rule on
rather than mine to assume.

## What I would build once ruled

1. **(a)** the classic branch in `applyOwnerRecordEdit`, mirroring `setServices` exactly.
2. **(b)** `composeServicesTruth` on this path, `verifiedPlaced` carried.
3. **(c)** option A: stamp the anchor in the classic renderer, so the existing affordance mounts.
4. Then prove it by clicking, on `evergreen-yard-care` and both fixtures, public page reloaded,
   screenshot after it settles.

**A menu of block types stays out of v1, deferred with its condition:** it earns a menu when
there is a second block type specified to the standard the service block is specified to.
Reviews and FAQ are arrays with add/remove semantics — a different problem wearing the same
button.
