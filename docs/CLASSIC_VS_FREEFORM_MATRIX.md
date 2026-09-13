# What the assistant can do for a CLASSIC business vs a FREEFORM one (2026-09-13)

**Read-only. Established from the code paths, not from a live run** — every cell names the
function and the branch it takes. Cells marked ⚠️ are inferred from the branch and have **not**
been exercised against Graef; nothing was written to his business.

**The condition that splits them is one line, repeated in every writer:**
`const latest = await selectLatestBusinessDocument(draftId, "website")` → `if (!latest)` or
`latest.format !== "html"`.

| capability | FREEFORM (has a document) | CLASSIC (no document — Graef) | what the owner is told |
|---|---|---|---|
| **add a service** | record + page: `set_business_draft_services` then `applyServicesToFreeform` places a card | **record only.** `applyServicesToFreeform` returns `status:"not_freeform"` and places nothing | `servicesTruth` has branches for `failed`, `none_on_page`, `no_prices` — **none for `not_freeform`**, so it emits no sentence and the model composes from the action's own summary ⚠️ |
| **set prices** | same path, price verified in the saved bytes | **record only**, same branch | as above ⚠️ |
| **set hours** | record + `placeContactHoursInFreeform` | **record write WORKS AND SHOWS.** `set_business_hours` writes `settings_business_hours` **and `businesses.meta.hours`** — and the classic renderer reads it (`hubly.html:15264`, `if(meta.hours) S_hours=meta.hours`) | `composeContactHoursTruth` returns **`""`** for `not_freeform`/`not_applicable` — **silent, while the page actually updates.** The one capability that works better than it says |
| **add a photo** | `placeOwnerPhotoInFreeform` inserts it | `applyOwnerPhotoToFreeform` → `{status:"no_slot", detail:"not_freeform"}` | *"I've saved that photo. There's no open spot for it on the page as it's built, so it isn't showing yet — I can rebuild the page around it if you'd like."* |
| **move a photo** | `moveFreeformNode`, within its parent | `applyOwnerNodeMove` → `no_document` | **"There's no page to change yet."** |
| **move a section** | `moveFreeformSection`, and it fixes the nav | `applyOwnerSectionMove` → `no_document` | **"There's no page to change yet."** — *plus* the shell's own line, below |
| **edit page text** | `applyDirectFreeformEdit` / `applyOwnerStyleEdit` | `no_document` | **"There's no page to change yet."** and the shell's `classicScopeReply`: *"I can't change the page text from here — that's edited in Edit details, and your live site is unchanged at ‹host›."* |
| **add a block / services area** | `addServicesSection` builds and places it | `registry:7571` → `not_freeform` | *"This page is not one I can add …"* ⚠️ (truncated in source read) |
| **claim** | works | **works** — unaffected by the store |
| **publish** | a new version row IS the publish | **n/a** — the classic page is already live; there is no publish step |

## Which of these Graef hits today

He is claimed, has no document, and his page is live and full. So:

| he hits | what happens |
|---|---|
| **add a service** | **the worst cell.** Saved to the `services` table; **his page reads `meta.service_catalog`** (8 entries today) and **nothing the assistant can call writes that** — `service_engine.ts` is the only writer and it is imported by `marketplace`, `chatbot-message`, `booking_job`, `marketplace_match` and the context loader, **not by the capability registry or hubly-conversation**. So the service is stored, invisible, and the reply does not say so |
| **set a price** | same |
| **add/move a photo** | *"There's no open spot for it on the page as it's built"* / *"There's no page to change yet."* |
| **move a section** | **CONFIRMED, as expected** — see below |
| **edit page text** | *"I can't change the page text from here."* |
| **set hours** | **works, and shows on his page** — via `meta.hours` |

## The section-move message — confirmed, same condition

**Confirmed, not ruled out.** Two separate sentences, both reachable for Graef:

1. **Server**, `applyOwnerSectionMove` → `!latest` → **"There's no page to change yet."**
2. **Client**, `platform-home.html:6365` → fires when `hc.hasDocument === false` →
   *"Moving whole sections isn't something I can do on this page, and that isn't a temporary
   problem — reopening won't change it."*

Both are gated on **the same no-document condition**. The capability gate is right; the word
that is wrong remains **"temporary"** — a rebuild makes the page a document and every freeform
capability applies from that moment. **Neither sentence offers that route.**

## The bill, in one line

**Of ten owner-invocable capabilities, Graef gets 2 that work (hours, claim), 1 that works but
says nothing, and 6 that refuse or silently do not reach his page.** The single most damaging
is *add a service*: it succeeds, it is stored, and it never appears — because the assistant
writes the relational `services` table while his page renders `meta.service_catalog`.
