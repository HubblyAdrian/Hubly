# Business Type Architecture

How Hubly supports many industries without hard-coding any of them into the
shared application.

## Core principle

**Hubly Runtime = generic capabilities. Business Blueprint = industry-specific
configuration.**

The runtime (`journey.js`, `hubly.html`) never asks "what industry is this
business?" It only ever asks "what does this business's Blueprint say?" and
falls back to a fixed, generic default when the answer is "nothing."

A new industry should be addable by creating a new Blueprint file and
registering it — not by adding `if (businessType === 'x')` branches to
shared code. **The 20th industry should be easier to add than the 2nd.**

## Where this lives today

```
public/business-blueprints/
  registry.js       HublyBlueprints — loads, validates, indexes every blueprint
  validator.js       HublyBlueprintValidator — schema + fail-closed validation
  detailing.json
  lawn-care.json
  house-cleaning.json
  hvac.json
  photography.json
  pressure-washing.json
  window-cleaning.json
  spa.json
```

`registry.js` fetches every file listed in its `BLUEPRINT_FILES` manifest on
boot, validates each one, and indexes the survivors by `id`. An invalid
blueprint is rejected and logged — it never silently half-loads.

`S().businessType` (set during onboarding, stored on the `businesses` row) is
the only signal the runtime uses to pick a blueprint:
`HublyBlueprints.get(S().businessType)`. `HublyBlueprints.get()` also
resolves a handful of slug aliases (e.g. `lawn-care` file → `landscaping` id) —
see `registry.js`'s `get()`.

## Blueprint schema

Every blueprint has a fixed set of required top-level sections (`identity`,
`knowledge`, `capabilities`, `booking`, `services`, `growth`, `dashboard`,
etc. — see `validator.js`'s `REQUIRED_TOP`), each covering one runtime
surface: public booking wizard intake, website builder sections/copy,
service catalog, AI system-prompt guidance, and so on.

**`jobMode` is the Jobs-specific section.** It's optional — a blueprint with
no `jobMode` just means that business type gets the Jobs engine's fixed
generic default. When present, it's validated (`validator.js`): each of its
three fields must be a string array if provided.

```json
"jobMode": {
  "defaultColumns": ["customerFirst", "customerLast", "vehicle", "service", "date", "time", "assignedTo", "amount", "status"],
  "recommendedFields": ["vehicle", "durationMin", "depositStatus"],
  "detailSections": ["customer", "job", "assignment", "financial", "activity", "notes"]
}
```

### How jobMode works

`jobMode` never introduces a new field or field type. It only **selects,
reorders, and labels** from the one fixed vocabulary the Jobs engine already
knows — every key in `defaultColumns`/`recommendedFields` must be a real
column key from `JOBS_DEFAULT_COLUMNS` or `JOBS_DRAWER_ONLY_COLUMNS`
(`journey.js`), and every key in `detailSections` must be one of the six
fixed Job Detail drawer sections (`customer`, `job`, `assignment`,
`financial`, `activity`, `notes`).

Journey.js reads it through one function, `jobModeForBusiness()` →
`HublyBlueprints.get(S().businessType).jobMode`, wired into three places:

1. **`jobsColumnSchema()`** — a business with no saved column preferences
   yet starts with `jobMode.defaultColumns` visible, in that order.
   Everything else starts hidden. This only affects a column's *starting*
   state: `tablePreferences.normalize()` only reads a column's hidden flag
   off the schema the first time a given user sees that key, so an
   already-customized layout is never reset by a jobMode change.
2. **The Jobs "+ Add column" menu** — hidden columns are split into
   "Recommended for your business" (`jobMode.recommendedFields`) and "More
   Hubly fields" (everything else), computed fresh on every render, never
   baked into the persisted column-prefs payload.
3. **The Job Detail drawer** — its six sections render in
   `jobMode.detailSections` order. An unrecognized key is dropped; any
   section left out of the list still renders, appended at the end, so a
   short or incomplete list never loses a section.

There is **zero `if (businessType === X)` logic anywhere in the Jobs code.**
A business with no jobMode, an unrecognized business type, or blueprints not
yet loaded all fall back to the exact same fixed order — see each of the
three call sites above for the specific fallback.

## Layers

```
Layer 1 — Hubly Runtime
  Generic primitives the app already knows how to render/persist:
  text, number, date, time, currency, select, phone, email, address,
  textarea, tags — plus domain objects like Job, Customer, Service.

Layer 2 — Blueprint
  Combines those primitives into one industry's model: which fields matter,
  what order they show in, what's recommended, what sections group them.

Layer 3 — New generic capability (only when genuinely needed)
  If an industry needs a concept Hubly doesn't have yet (e.g. "Pool
  Chemistry"), the runtime gains ONE new generic primitive (e.g. an
  "Inspection/Measurement" field type), not an industry-specific hack. Once
  it exists, any blueprint can use it — a later industry (HVAC readings,
  detailing paint-thickness checks) reuses the same primitive instead of
  inventing its own.
```

**The test for "is this a new primitive or an industry hack":** would a
second, unrelated industry plausibly want this too? If yes, it belongs in
Layer 1. If it's genuinely one industry's own vocabulary for something the
runtime already models generically (e.g. "Shoot Type" is just a Service
name), it doesn't need a new primitive at all — it's already expressible
through Layer 1 fields, and the blueprint just needs to reference them.

## How to add a new industry

1. **Create the blueprint file** — `public/business-blueprints/<slug>.json`,
   filling in every `REQUIRED_TOP` section (`identity`, `knowledge`,
   `capabilities`, `customerJourney`, `booking`, `services`, `gallery`,
   `growth`, `dashboard`, `performance`, etc. — copy the shape of an
   existing blueprint, e.g. `detailing.json`, and replace the content).
2. **Define its `jobMode`** — `defaultColumns`/`recommendedFields` chosen
   from the *existing* Jobs field vocabulary (see `JOBS_DEFAULT_COLUMNS` +
   `JOBS_DRAWER_ONLY_COLUMNS` in `journey.js` for the full list). Don't
   copy another industry's fields by default — pick what's actually
   relevant (a property-based trade wants `address`, not `vehicle`; a
   session-based trade leans on `durationMin`/`notes`).
3. **Register it** — add the filename to `BLUEPRINT_FILES` in
   `public/business-blueprints/registry.js`.
4. **Validate it** — run it through `HublyBlueprintValidator.validateBlueprint()`
   (`node -e` snippet below) before shipping; the registry itself also
   validates on load and silently drops anything that fails.
   ```js
   const bp = require('./public/business-blueprints/<slug>.json');
   global.window = global;
   require('./public/business-blueprints/validator.js');
   console.log(global.HublyBlueprintValidator.validateBlueprint(bp));
   ```
5. **Test it in isolation** — force `S().businessType = '<id>'` in a live
   session (CEO demo or a real account) and confirm: the Jobs page's default
   columns match `defaultColumns`, the "+ Add column" menu's Recommended
   group matches `recommendedFields`, and the Job Detail drawer's section
   order matches `detailSections`.
6. **Confirm isolation** — every other industry's blueprint, and any
   business with no jobMode at all, must render identically to before your
   change. This is the actual regression test: adding an industry should
   never require touching another industry's file or the shared runtime.

If the new industry needs a concept the runtime genuinely doesn't support
yet (see Layer 3 above), that's the one case where journey.js/hubly.html
changes are expected — but the addition should be a new *generic* capability
other blueprints can also use, not a hardcoded branch for the one industry
that asked for it.

## Isolation rule

A change scoped to one industry ("Detailing Jobs need a Vehicle section
first") means editing `detailing.json` — never touching `lawn-care.json`,
`photography.json`, or any other blueprint, and never adding a conditional
to `journey.js`. If a request sounds industry-specific, the default move is
"which blueprint does this belong to," not "which file needs an `if`."

## Fallback behavior

Every jobMode-aware call site in `journey.js` has an explicit fallback to
the pre-jobMode fixed order when:
- the business type isn't set or doesn't match a loaded blueprint,
- `HublyBlueprints` hasn't finished loading yet (`isReady()` false),
- the blueprint has no `jobMode` at all,
- or `jobMode` omits a specific field (e.g. no `detailSections` — falls back
  to the fixed six-section order, unaffected by `defaultColumns` being set).

No blueprint is required to implement every jobMode field. Partial
configuration degrades gracefully to the generic default for whatever it
leaves out — a blueprint should never need a "does nothing new" jobMode
block just to pass validation.

## Testing checklist for any Blueprint change

- [ ] `HublyBlueprintValidator.validateBlueprint()` passes.
- [ ] File is listed in `registry.js`'s `BLUEPRINT_FILES`.
- [ ] Jobs default columns match the new `jobMode.defaultColumns`, in order.
- [ ] "+ Add column" menu shows the right Recommended/More split.
- [ ] Job Detail drawer section order matches `detailSections`.
- [ ] Every OTHER blueprint's business type still renders exactly as before.
- [ ] A business with no jobMode at all still renders the original fixed
      order (regression check on the fallback path itself).
