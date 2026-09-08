# THE PLACES MECHANISM — spec, not code

One mechanism for "an owner asks for something and it appears". It has to serve **"add me a
store"** and **"add me a reviews section"** identically, or it is the wrong shape.

Written after: `hubly_pro` ruled out (`HUBLY_PRO_TRACE.md`), the four Store surfaces measured
(`OPEN_FINDINGS.md` #66), and the editor click-through (`GRAEF_EDITOR_CLICKTHROUGH.md`).

---

## 0. What this replaces, and what it must not absorb

**Replaces:** nothing today. `capabilities` looks like a permission system and is not one — three
of its five keys are decorative. This is the first real one.

**Must not absorb — three separate axes, deliberately kept apart:**

| axis | where it lives | question it answers |
| --- | --- | --- |
| **Plan** | `businesses.tier` (column) | what is this business *entitled to*? |
| **Places** (this spec) | `businesses.places` (new) | what has this business *asked for*? |
| **Content** | `meta`, `services`, `commerce_products` … | what is *in* it? |

A business can be entitled and not have added; can have added on the free tier; can have a place
with nothing in it. **Collapsing any two is how two systems that disagree get built** — which is
exactly what `hubly_pro` vs `tier` already is, on 32 rows.

---

## 1. The list

```jsonc
businesses.places  jsonb  not null default '[]'
[
  { "id": "pl_a1b2c3",           // stable, generated on add — never the type
    "type": "store",             // from a closed catalogue, below
    "scope": "tab",              // "tab" | "section"
    "order": 30,                 // sparse ints, gaps of 10
    "visible": true,
    "config": {},                // type-specific, opaque to the mechanism
    "added_at": "2026-09-07T…",
    "added_by": "assistant" }    // "assistant" | "owner" | "system"
]
```

**Why an ordered list of objects and not booleans:** a boolean can express *whether*; it cannot
express *where*, *which variant*, or *twice*. The moment "add me a reviews section" means
"below services" it needs position, and a second boolean per type is how the five decorative keys
happened.

**Why on `businesses` and not a table:** every read of it happens where the business row is
already loaded (`get_public_business` returns the whole row; the shell has `currentBusiness`).
A table means a second round trip on the hot path for ≤ ~12 rows. **Revisit if a place ever needs
its own history** — `added_by` is a stamp, not an audit log.

**Order:** sparse integers, gap 10. Insert = max+10. Reorder rewrites the list. `order` is
authoritative; array position is not.

### The catalogue (closed, versioned in code)

Each entry declares scope, surfaces, default config, and — critically — **whether the assistant
can fill it**.

| type | scope | fillable by AI today | note |
| --- | --- | --- | --- |
| `store` | tab | ✅ products via commerce | the first entry |
| `reviews` | section | ❌ **no action writes a review** | see §7 |
| `gallery` | section | ⚠️ photo upload exists, no section writer | |
| `faq` | section | ❌ | |
| `memberships` | section | ❌ | |
| `projects` | tab | ❌ | |

**A type whose `fillable` is ❌ may still be added** — but the writer must say so in its
announcement (§5). Granting an empty room silently is the #54 shape at a new scope.

---

## 2. Tab and section are the same kind of entry

`scope` is a field, not a different mechanism. Both are "a place this business has"; they differ
only in which renderer consumes them.

- **`scope: "tab"`** → the shell rail (`hcWorkspaces` / the 19 `data-v` entries)
- **`scope: "section"`** → the page renderer's section list

**This is the load-bearing change and it is not optional:** the classic renderer's sections are
a hardcoded five (`SECTION_DEFS`, `public/hubly.html:50388`; `S_sections.splice:50496` is
drag-reorder, there is no add). **Until `SECTION_DEFS` is seeded from `places` where
`scope='section'`, no gate design can add anything for a classic business — which is Graef and
every record-rendered site.** Ship this before or with the first section type.

---

## 3. Surfaces — one predicate, read everywhere

```js
hasPlace(biz, type) === (biz.places || []).some(p => p.type === type && p.visible !== false)
```

**Store's four, measured:**

| # | surface | file | today | with `places` |
| --- | --- | --- | --- | --- |
| 1 | page section | `hubly.html:39940` `renderWsStoreSection` | `enabled && (hasProducts \|\| inEditor)` | `&& hasPlace('store')` |
| 2 | nav link | `hubly.html:39950` | added when `caps.storefront===true` | `&& hasPlace('store')` |
| 3 | editor rail button | `hubly.html:11660–11693` | **static markup, ungated** | rendered from `places` |
| 4 | **the `/store` route** | `isStoreRoutePath():17348` | **URL path only — no check at all** | `&& hasPlace('store')`, else **redirect to `/`** |

Plus the shell rail (`data-v="store"`), which is surface 5 and also ungated today.

**Ungated `/store` redirects to the homepage** — not 404 (a dead link on a subdomain someone
shared reads as "this business is gone") and not an empty state (a true sentence nobody benefits
from, advertising an absence on the owner's own domain). Server-side, so a shared link resolves.

**Every surface reads `hasPlace`. No surface invents its own test.** That rule is the whole point;
`storefront` has four different tests today and that is why nobody could say what it controlled.

---

## 4. The write — one action, one RPC

**Registry action** (`hubly_capability_registry.ts`), the assistant's only door:

```
places.add     { type, scope?, after? }   -> { ok, place, announcement }
places.remove  { type }                   -> { ok, announcement }
places.reorder { type, after }            -> { ok, announcement }
```

**RPC**, `security definer`, `p_owner_id` — the same shape as every other owner-authorised write,
and the reason `applyOwnerRecordEdit` re-checks ownership rather than trusting the caller:

```sql
add_business_place(p_id uuid, p_owner_id uuid, p_type text, p_scope text, p_after text)
```

- asserts `businesses.owner_id = p_owner_id` and **fails loudly** if not
- rejects a `type` not in the catalogue
- **idempotent**: adding an existing type returns the existing place, `created: false`
- returns the **whole new list**, so the caller never guesses the resulting order
- **`p_owner_id` is not optional.** Five writers are already live without it
  (`claimed-owner-write-audit`); this one does not join them.

**Nothing else writes `places`.** Not the client, not a trigger. The `hubly_pro` trigger is
precisely the failure this avoids: a field maintained by a side effect that no product decision
ever made.

---

## 5. The announcement is emitted by the writer

The RPC returns, and the action passes through, a **fact about what happened** — not a sentence
the UI composes from what it assumes:

```jsonc
{ "event": "place.added", "type": "store", "scope": "tab",
  "created": true, "empty": true,          // nothing in it yet
  "fillable_by_assistant": true,
  "label": "Store", "where": "in your menu, after Services" }
```

Prohibition 4 (the interface may not change shape silently) and prohibition 6 (a state change the
owner asked for must be visibly confirmed) are both satisfied by the **writer**, because only the
writer knows whether it created, found, or moved. `servicesTruth` is the precedent: compose the
reply from what actually happened.

**`empty: true` obliges the reply to say so** — "Your Store is in the menu. There's nothing in it
yet; tell me what you sell and I'll add it." Granting a room and not mentioning it is bare is how
an owner finds an empty tab and concludes the product is broken.

---

## 6. Day one — nobody wakes up with fewer tabs

**Backfill every existing business so the rendered result is byte-identical to today**, then
change the surfaces to read `places`. Two deploys, in this order, never one.

| business has | seeded `places` |
| --- | --- |
| `commerce_products > 0` or `storeOs.settings.enabled` | `store` (tab) |
| a `business_documents` row | its rendered sections, as `section` entries |
| classic renderer | the five `SECTION_DEFS` it shows today, as `section` entries |
| nothing | `[]` |

**Grandfathering is explicit, not incidental:** 0 businesses corpus-wide have a product today, so
the honest seed for `store` is *"whoever has it switched on"*, and `meta.storeOs.seeded` is true
for Graef with 0 products. **He keeps his Store tab.** Anything removed from anyone is a decision
recorded here with a name against it, never a side effect of the migration.

**Verification gate:** `check-graefs-page.mjs --slug graefs-autocare` must PASS across the
backfill, and the editor click-through re-run on a clone. The backfill is the highest-risk step
in this spec — it touches 178 rows — and it gets the clone treatment: **run on a clone first,
never on the corpus.**

---

## 7. Adrian's four entry paths

| path | starts with | why |
| --- | --- | --- |
| **Website** ("build me a site") | the sections the generator produced, as `section` entries. **No `store` tab.** | asked for a site |
| **Store** ("I want to sell") | `store` tab. Website sections only if a site was also built. | asked for a store |
| **Provider-only** (marketplace) | **no tabs beyond the shell's own.** `marketplace` stays membership, not a place. | *designed-for-but-unobserved — no such row exists in the corpus* |
| **Both** | union, ordered by when each was asked for | |

**Path 3 remains unobserved.** Build the mechanism so it *can* express it; do not build rail
logic for it. **The first real provider-only signup is the test of whether the model holds** — and
finding out it does not, with one business, is cheap.

---

## 8. Does this serve "add me a reviews section"? — the question the shape has to survive

> **Owner:** "can you add a reviews section to my page?"

| step | store | reviews |
| --- | --- | --- |
| assistant calls | `places.add{type:'store'}` | `places.add{type:'reviews', scope:'section'}` |
| RPC | same | same |
| list gains | `{type:'store',scope:'tab'}` | `{type:'reviews',scope:'section'}` |
| surfaces read | `hasPlace('store')` | `hasPlace('reviews')` |
| announcement | writer-emitted | writer-emitted |
| **fillable** | ✅ products | ❌ **no action writes a review** |

**Same call, same RPC, same predicate, same announcement. The shape holds.**

It exposes exactly one gap, and it is a real one rather than an artefact: **the assistant can
create a reviews section and cannot put a review in it.** That is asymmetry 2 from the coverage
matrix, now blocking at a new scope. Two honest options, and the spec picks the second:

1. Refuse to add types that are not fillable — but the owner *has* reviews (Graef has 2, in
   `meta.website.manualReviews`); the section would render them. Refusing is wrong.
2. **Add it, and say plainly in the announcement that the assistant cannot write reviews yet and
   the owner can add them in the editor.** The place is real, the limit is stated, and
   `docs/AI_CANNOT_BUILD.md` is the queue for closing it.

**Conclusion: one mechanism serves both. It is not a store gate with a reviews escape hatch.**

---

## 9. What this spec deliberately does not do

- **Does not touch `tier`.** Plan is a separate axis (§0). Entitlement gating, if it ever exists,
  reads `tier` **and** `places` — never one standing in for the other.
- **Does not remove `capabilities`.** `website` and `marketplace` still do their narrow real jobs.
  `hubly_pro` and `projects` should be dropped, but **after** the rail ships — they are currently
  the only markers in a corpus being designed against.
- **Does not delete any test business.** 150 freeform examples and every state the rail work needs
  subjects in. Deletion comes after the rail ships.
- **Assumes nothing about the editor rail's 14 static buttons** beyond that they must be rendered
  from `places` for surface 3. That is a rewrite of `hubly.html:11660–11693` and should be its own
  change, verified by clicking, not folded into the backfill.
