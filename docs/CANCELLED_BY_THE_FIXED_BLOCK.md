# What the fixed services block cancels — listed, not deleted

Ruling: the services block becomes Hubly-owned markup (`docs/SERVICES_BLOCK_SPEC.md`) with the
brand colour substituted. That cancels the work whose only purpose was inferring a page's own
design. **Nothing below has been deleted. Adrian rules on each line.**

## Cancelled — its only job was inference

| thing | where | why it goes |
|---|---|---|
| `pickChainDonor` / `wrapInChain` / `chainClonedServicesBlock` | `hubly_services_block.ts` | clones section → wrappers → item container from the page. A fixed block needs no donor. |
| `describesASequence()` | same | exists ONLY to stop the donor cloning a "How it works" section. No donor, no problem — **but see Lesson 48: `hasHoursHeading` should consult it, so it must not be deleted until hours is fixed.** |
| the donor census / `donor-census.ts`, `build-variants*.ts`, `variants*.json` | scratchpad | measured which donor got picked across 127 pages |
| the inset measurement (`measure-v3.mjs`, `report4.mjs`, textStart vs the page column) | scratchpad | asked "does our block start where the page's text starts". A fixed block has its own grid. |
| `shape-match.mjs` (box match against the page's own item) | scratchpad | asked "does our row look like their row". We no longer want it to. |
| the item-shape clone (cloning the donor's item element for card shape) | `hubly_services_block.ts` | replaced by the spec's `<article class="card">` |

## KEEPS EARNING ITS PLACE — a fixed block on an unknown ground still has to be legible

| thing | where | why it stays |
|---|---|---|
| **the block contrast rescue** (flat 4.5:1, scoped to `[data-hubly-services-block]`) | `hubly_page_runtime.ts` | our block lands on a page whose background we do not control. A fixed card with `rgba(255,255,255,.62)` over an unknown hero is exactly the case it was written for. |
| **the `effBg` alpha compositing fix** | same | the reference card's own background IS translucent — `rgba(255,255,255,.62)`. Without compositing, the rescue reads its ground as pure white and paints the wrong ink. The fixed block makes this MORE load-bearing, not less. |
| **the ground-shift (hue-preserving lightness)** | same | our Book button is painted in the owner's brand colour, which is precisely where "neither white nor black reaches AA" happens. |
| `markServiceAnchorsInFreeform` / `data-hubly-service` / `data-hubly-price` | registry | the reference block carries these anchors already; post-build price updates depend on them. |
| `check-block-legibility.mjs` | scripts | measures the block where it lands, in pixels. Independent of how the block is built. |
| `placeOneServicePrice`, `verifiedPlaced` byte verification | registry / owner replies | what we SAY about a placement is unaffected by how the block is built. |

## Open question for the ruling

The **standalone painted block** fallback (always readable, always looks like a card) and the
`KNOWN_UNREADABLE` list both exist because a cloned block could be illegible. With a fixed
block they may be redundant — or the fixed block may simply become the standalone one. Not
decided here.
