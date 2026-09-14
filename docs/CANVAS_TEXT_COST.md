# Canvas click-to-edit for the classic store — what it costs

**Costed 2026-09-13. Nothing built.** Adrian ruled out linking to `/dashboard`: that editor is
complete and writes correctly, but it lives in the operator app we spent this morning closing
the door on, and sending an owner into a second application to change one sentence contradicts
*Home tells you what matters, My Day tells you what to do, Chat lets you ask anything,
Workspace lets you do the work.*

So the question is what it costs to drive the **same writes** from clicking the text on the
canvas, for the fields `/dashboard` covers and the canvas does not: **section titles, service
descriptions, about, FAQ.**

## What already exists on each side

**The write side is done, and there is no migration.** `patch_business_in_progress`'s
`p_website_meta` is a **free merge**, not an allowlist:

```sql
v_meta := jsonb_set(v_meta, '{website}', coalesce(v_meta->'website','{}'::jsonb) || p_website_meta, true);
```
— `20260910060000_patch_returns_post_update.sql:97`

Any `meta.website` key the classic renderer reads can be written through it today. Section
titles (`servicesTitle`, `gallerySub`, `reviewsTitle`, …), `ownerBio`, `faq[]`, `footerCtaTitle`
are all `meta.website` keys. **Zero migrations.**

**The edit side is done twice over, in the wrong places.**

| machinery | where | covers | gated by |
|---|---|---|---|
| the 2-field canvas editor | `hubly.html:53820-53990`, ~170 lines | `heroHeadline`, `heroSubhead` (its whole `TEXT_FIELDS` map) | `?hcEditable=1` — now set for classic too |
| the full `ws-pe-*` editor | `hubly.html` ~`34915-35400` | **17 inline text types** (`WS_PE_INLINE_TYPES`: headline, tagline, biz-name, owner-name, owner-bio, about-name, **sec-title, sec-sub**, footer-cta, footer-tag, promo, ticker, store-title, store-sub, **svc-name, svc-price, svc-dur**) plus ~208 `pe===` branches for non-text | `isWebsitePeEnabled()` → `isEditorViewOpen()` — **true only inside `/dashboard`** |

So the thing Adrian wants already exists, on the same page, marking the same elements. It is
gated on "am I inside the operator editor" rather than on "is this owner allowed to edit".

## The cost

| piece | cost | notes |
|---|---|---|
| **migration** | **none** | `p_website_meta` merges freely |
| **ungate `ws-pe` on the public canvas** | ~5 lines | `isWebsitePeEnabled()` returns `isEditorViewOpen() \|\| hcEditableEnabled()`. The risk is not the gate, it is everything the `ws-pe` system ASSUMES about being inside the editor |
| **the real work: sever `ws-pe` from editor state** | **the unknown** | its handlers call `closeEdSheet`, `hideWsPeContextBar`, `bindEditorManipulators`, `S.edEditMode`, `saveStorefront()` — all `/dashboard` machinery. On the public canvas there is no `S`, no sheet, no rail, and **no `saveStorefront`** |
| **a save path that is not `saveStorefront`** | ~40-60 lines | `saveStorefront` posts the WHOLE `S` object (~30 top-level keys). The canvas cannot do that — it has no `S`. Each edit must post one field, like `hcInlineEdit` does |
| **client → parent message** | ~10 lines | one new `postMessage` type, e.g. `hcInlineEdit` widened from a 2-entry `TEXT_FIELDS` map to the `ws-pe` label |
| **parent → server** | ~6 lines | `hcSendDirectEdit({ directEdit: { field, value } })` unchanged |
| **server branch** | **a sibling, not an extension** | see below |

### `directEdit` → `updateDraft` does NOT extend; it needs a sibling

`DIRECT_EDIT_TEXT_FIELDS = new Set(["heroHeadline","heroSubhead"])` and the handler dispatches
into **`business.updateDraft`** — a MODEL-FACING capability whose `argsSchema` the model reads
every turn. Widening it to carry `servicesTitle`, `ownerBio`, `faq[2].q` would:

- grow the model's prompt surface for fields the model should never set unasked (the
  never-publish-an-unstated-fact rule), and
- put owner clicks and model calls through one handler whose grounding rules differ.

**The right shape is a sibling structured branch beside `designEdit` and `directRecordEdit`** —
model-free, owner-authorised, one field per call:

```
body.directWebsiteTextEdit = { key: "servicesTitle" | "ownerBio" | "faq.2.q" | …, value: string }
  → ownsBusiness() → patch_business_in_progress(p_website_meta: { [key]: value })
```

with an **allowlist of writable `meta.website` text keys in TypeScript** (the SQL has none, and
a free merge reached from a click is how a typo'd key silently writes garbage into the store
the page renders from).

### Honest total

- **Zero migrations.**
- **~120-180 lines** for the sibling branch, the allowlist, the message type, and the parent hop.
- **Plus an unbounded piece**: severing `ws-pe` from `/dashboard`'s state, or writing a second,
  smaller marker pass for the public canvas that reuses `WS_PE_INLINE_TYPES`' *labels* and none
  of its *handlers*. **I would cost the second one at ~200 lines and recommend it** — the first
  is a refactor of a 208-branch system whose every branch assumes an editor shell around it.

**Recommended scope if it is built: the 17 `WS_PE_INLINE_TYPES` text labels, nothing else.**
That covers section titles, service names/prices, about and owner bio. FAQ items and reviews are
arrays with add/remove semantics, not single text fields, and they belong with the manual `+`
work rather than here.

## What is already true after 2026-09-13

Headline and subhead are editable by clicking them on a classic page — proved end to end on
`hubly-classic-fixture`. Everything above is about the *rest* of the page.
