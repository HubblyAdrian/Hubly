# The structural-editing bridge — reframed, established, and recommended (2026-09-13)

**The question we queued was the wrong one.** We asked *"can `add_node` / `move_node` /
`remove_node` reach a freeform page?"* — which assumes the AST path is the mechanism and
freeform is the destination. **We already mutate freeform pages structurally, in production,
today.** So the real question is whether the working mechanism should be generalised.

Read-only. Nothing built.

## 1. What the freeform path actually supports — from the code, not the names

| operation | function | size | reachable by an owner? |
|---|---|---|---|
| **insert** a service (cloned entry, price inside it) | `insertServiceIntoFreeform` | 113 lines | yes — `business.setServices`, and the extraction path |
| insert the business name into its slot | `placeBusinessNameInFreeform` | — | yes |
| insert/update contact + hours | `placeContactHoursInFreeform` | — | yes |
| insert an owner photo | `placeOwnerPhotoInFreeform` / `applyOwnerPhotoToFreeform` | — | yes — upload endpoint |
| **move a node** (reorder within its parent) | `moveFreeformNode` | 59 lines | yes — `applyOwnerNodeMove`, `hubly-conversation:1957` |
| **move a section** (reorder, and it fixes the nav) | `moveFreeformSection` | 162 lines | yes — `applyOwnerSectionMove`, `:1997` |
| **delete a node** | `deleteFreeformNode` | 14 lines | yes — `applyOwnerNodeDelete`, `:1976` |
| restyle an element | `applyFreeformStyle` / `applyOwnerStyleEdit` | — | yes — `:1878` |
| swap an image | `uploadAndPatchFreeformImage` | — | yes |
| address an element | `resolveFreeformSelection` → `NodeAddress {anchor, anchorKind, steps, fp}` | 57 lines | — |

**Insert, move, remove and restyle all exist and all ship.** The thing we queued a research
task to find out whether we could build is already running.

## 2. Where a freeform edit goes — one store, one writer, one reader

Every one of the four writers above ends in the **same call**:

```
create_business_document(p_business_id, p_draft_token, p_tag: "website",
                         p_document: latest.brief,
                         p_rendered_html: stripEditorChrome(html, "<what-changed>"),
                         p_created_by: "patch", p_format: "html", p_owner_id)
```

- **One store:** `business_documents.rendered_html`, `tag='website'`.
- **Versioned:** every edit is a new version row, `created_by='patch'` — evergreen has 162.
- **The visitor reads the same place:** `get_public_business_document(slug, 'website')` selects
  `rendered_html` from `business_documents` where `tag = 'website'` **order by version desc
  limit 1**. The editor writes the newest version; the visitor loads the newest version.

**No second store, no second writer on this path.** That was the thing to check before
generalising onto it, and it checks out.

## 3. What the freeform path CANNOT do — the limits, named

A comparison that lists only capabilities recommends whichever mechanism was read last.

1. **A node cannot move between parents.** `moveFreeformNode` refuses it *by design*, and says
   why: *"Moving a node into a different container relocates it into a different styling
   context, and the page can visibly break — so it is refused rather than attempted."* The UI
   matches: a drag with nowhere valid to land shows no drop line.
2. **An address is fingerprint-guarded and fails on a changed page.** `NodeAddress` carries
   `fp`; if the node's fingerprint no longer matches, the edit returns `changed` rather than
   mutating the wrong element. Correct, and it means a stale selection fails rather than works.
3. **Every element must be addressable from an anchor** — `anchorKind: "section" | "label"` plus
   an index path. A node with no stamped anchor above it cannot be targeted at all.
4. **No create-from-nothing for arbitrary structure.** It inserts *known* things (a service
   entry, a contact block, a photo) into *found* places. There is no "add an arbitrary new
   section here" operation.
5. **It is HTML string surgery, not a tree.** Indentation is preserved by hand
   (*"take the node with the whitespace in front of it, and put it back the same way"*), and
   correctness rests on matching, not on a parsed model.

## 4. Adrian's flow, step by step

| step | covered today? |
|---|---|
| **9 — "add services creates blocks"** (card, image tile, name, price, Book Now) | **the mechanism is there** — `insertServiceIntoFreeform` places a service with its price into a cloned entry, byte-verified by `verifiedPlaced`. What is missing is not structural editing, it is the **card spec** (`docs/BLOCK_SPEC.md`), which is a rendering change, not a bridge |
| **6 — "the owner can move photos around the page"** | **partly.** Insert a photo: yes. Reorder it **within its parent**: yes, `moveFreeformNode`. Move it **into a different section**: **refused by design** — limit 1 above. So drag-to-reorder works; drag-anywhere does not |

**Step 6 is the only real gap, and it is one limit — cross-container move — not a missing
mechanism.**

## 5. Cost, both ways

**Generalise the freeform path** — allow a cross-container move with a guard:
- `moveFreeformNode` already resolves both the node and its parent; the change is to accept a
  target container, verify the destination accepts the node (the styling-context worry is real
  and becomes a precondition rather than a blanket refusal), and re-run the existing
  whitespace-preserving splice. **~40-60 lines in 1 file** (`hubly_freeform.ts`), plus the drop
  targets in the editor UI.
- Everything else in step 6 and step 9 is already built.

**Teach the AST path to reach freeform** — `hubly_document.ts` is 1,827 lines with six ops
(`add_node`, `move_node`, `remove_node`, `replace_node`, `update_text`, `update_attrs`)
operating on a JSON document with a **fixed node vocabulary**.
- A freeform page is arbitrary HTML with its own `<style>`. Reaching it requires an
  **HTML → AST importer and an AST → HTML exporter that round-trip losslessly**, for markup no
  one designed and a vocabulary that does not contain it.
- That is not a feature; it is the re-recognition problem this repo has already lost twice —
  the services donor and the hours predicate (Lessons 48, 49). **Not costed in lines, because a
  lossless round-trip for arbitrary markup is not a bounded task.**

## 6. Is there any reason to prefer the AST path other than "it exists"?

One real one, and it is not enough: **a fixed vocabulary makes structural operations total.**
Every node is a known kind, so `add_node` can insert anywhere and the renderer will produce
valid output — no styling-context worry, no fingerprint, no string surgery. That is genuinely
better engineering.

**It is outweighed by the corpus.** Measured now: **173 of 174 stored pages are `html`
(freeform). One is `ast`.** Choosing the AST path means building a lossless bridge so that one
mechanism can serve the 1, or importing the 173 into a vocabulary that was not designed to hold
them.

## RECOMMENDATION

**Generalise the freeform path. Do not bridge the AST.**

- Insert, move, remove and restyle already exist there, are owner-reachable, and write through
  one store to one reader with a version row each.
- Adrian's step 9 needs a card spec, not structural editing.
- Adrian's step 6 needs **one** capability the path deliberately withholds — cross-container
  move — at roughly 40-60 lines in one file, with a real precondition to design (does the
  destination's styling context accept this node?).
- The AST path is better in the abstract and serves 1 page in 174.

**And the thing to carry out of this:** we queued a research task for a capability that was
already shipping. The tell was available — `insertServiceIntoFreeform` has been in the
services work all week. *When the product already contains a working example, read it before
designing a mechanism to replace it* (Lesson 49), and that applies to capabilities as much as
to designs.
