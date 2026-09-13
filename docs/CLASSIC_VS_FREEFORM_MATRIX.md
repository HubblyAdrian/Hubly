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

---

# RE-RUN, 2026-09-13 22:40 UTC — after `set_business_service_catalog`

**Same table shape, same condition, one capability moved.** Everything below the matrix that
was established from code paths is unchanged except where marked.

| capability | FREEFORM (has a document) | CLASSIC (no document — Graef) | what the owner is told |
|---|---|---|---|
| **add a service** | unchanged | **record + PAGE.** `applyServicesToFreeform` still returns `not_freeform`; `applyServicesToClassic` then merges the catalogue and writes it through `set_business_service_catalog` | *"Headlight Restoration is on your site now — ‹url›. Your other 2 services are exactly as they were."* — **verified in the bytes of the live page**, screenshot below |
| **set prices** | unchanged | **record + PAGE**, same path (a price on a name already in the catalogue is an `updated`, not an `added`) | as above |
| **set hours** | unchanged | works and shows (unchanged) | **no longer silent** — fixed earlier tonight |
| **add a photo** | unchanged | **still `no_slot`** — `media.photos` on a catalogue entry is untouched by this work | unchanged |
| **move a photo / move a section / edit page text** | unchanged | **still `no_document`** | unchanged |
| **add a block / services area** | unchanged | **still `not_freeform`** | unchanged |
| **claim / publish** | unchanged | unchanged | unchanged |

## How many of Graef's six failures closed

**Two of six, and they are the two that were costing him.**

| his six | before | after |
|---|---|---|
| add a service | stored, invisible, not said | **writes the store his page renders from** |
| set a price | stored, invisible, not said | **same** |
| add a photo | no slot | no slot — open |
| move a photo | no page to change | open |
| move a section | no page to change | open |
| edit page text | edited in Edit details | open |

Counting the three that already worked (hours, claim, and hours' silence), the bill is now
**4 of 10 working, 0 working-but-silent, 6 refusing** → **6 of 10 working, 4 refusing.**

## What is proved, and what is not

**Proved** (hubly-classic-fixture, never Graef):
- The RPC refuses a wrong owner (`-1`), a null owner on a claimed row (`-1`), a random draft
  token on a claimed row (`-1`), a missing business (`-3`) and an empty catalogue (`0`), and the
  catalogue count is unchanged across all five.
- The merge is additive: with one new service stated, `diff PRE POST` adds exactly one service
  block and removes exactly one line — the catalogue's own `updated_at`. Both existing services,
  including six variable prices, three `includes` and a photo URL, are byte-identical.
- The card renders on the live public page.

**NOT proved:** the same write driven by typing into the assistant as the signed-in owner. The
owner session in this environment is expired and restoring it was not available to me, so the
last link — model → capability → RPC — is exercised by its own code and its own RPC, not by a
human sentence. **That is one four-sentence walk for Adrian and it is the thing to do first.**
No screenshot of a signed-in state was taken, and none was simulated.
