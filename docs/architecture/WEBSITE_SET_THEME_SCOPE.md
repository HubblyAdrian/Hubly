# `website.setTheme` — scope

**Date:** 2026-08-18
**Status:** scoped, not built.
**Bounded by:** `AI_CAPABILITY_INVENTORY.md`. Nothing here is LIVE.

---

## The problem it solves

An owner looks at their new site and says one of these:

> change the background colour · use this photo as the background · change the font · make my logo bigger · make that section darker

Every one of them is a reasonable first request. None of them has anywhere to
write today. The Hubly Document bans `style` attributes, the renderer exposes a
single variable (`--brand`), and `patchDocument` can only touch nodes — so a
page-level look is not addressable at all.

Until 2026-08-18 the system answered these with three confident "Done"s and an
unchanged page. That specific failure is now fixed: `patchDocument` diffs before
and after and refuses to claim success when nothing moved. **`setTheme` is what
turns an honest "I can't do that yet" into "done".**

## Why not just let `patchDocument` do it

Three reasons, and they are the whole design.

1. **These are business-level, not node-level.** "My background", "my font" are
   properties of the site, not of any element. Expressing them as node patches
   means touching every section for one request and re-touching them all on the
   next — with no single place that records what the theme actually is.
2. **`patchDocument` cannot be verified the same way.** Its new guarantee is a
   tree diff. A theme change may legitimately alter nothing in the tree, so
   routing it through the same action would either defeat the check or require a
   special case inside it.
3. **The request set is closed and the CSS surface is not.** We want a fixed set
   of knobs, not free CSS — a named enum can be validated, stored, reasoned
   about and reverted. Free CSS can be none of those.

So: a sibling action on the same capability, writing a `theme` object on the
business, read by `renderHublyDocument` where `--brand` already is.

## The knobs

Five, all closed vocabularies. No hex, no font names, no numbers outside a
named scale — same discipline as `SITE_PALETTES`, and for the same reason: a
model choosing freely will eventually produce something illegible, and nobody
reviews it before a stranger sees it.

| Knob | Values | Answers |
|---|---|---|
| `background` | `paper`, `warm`, `cool`, `dark`, `ink` — resolved against the business's palette | "change the background colour", "make it dark" |
| `fontPairing` | `sans`, `serif-display`, `serif-body`, `mono-accent`, `condensed` — each a real heading/body pair | "change the font" |
| `logoScale` | `sm`, `md`, `lg` | "make my logo bigger" |
| `sectionTone` | per section id: `default`, `muted`, `contrast`, `brand` | "make that section darker" |
| `heroImage` | a Hubly asset URL, or null | "use this photo as the background" |

`sectionTone` is the only per-node one, and it is keyed by section id rather
than written into the node, so the document stays the AI's and the theme stays
the owner's.

### Deliberately excluded

Per-element colour, spacing, custom fonts, arbitrary images behind arbitrary
sections. Each is a real request eventually; each also turns a closed set into
free CSS. Add a knob when a real owner asks twice, not in anticipation.

## What it costs

| Piece | Work | Notes |
|---|---|---|
| `businesses.theme jsonb` + RPC | small | mirrors `patch_business_in_progress`; must be added to the LIVE function body, never rewritten from migration history — see `KNOWN_ISSUES.md` |
| Theme → CSS variables in `renderHublyDocument` | small | one more block beside the existing `--brand` scoping |
| Chrome + document CSS reading the tokens | medium | `hubly-document-chrome.css` already uses `--brand`; backgrounds and font pairs join it |
| `website.setTheme` registry action | small | enum-validated args, same shape as `startDraft`'s palette |
| Re-render existing documents | **already built** | `scripts/rerender-business-document.ts` |

The last row is the useful surprise. Because `rendered_html` is stored, a theme
change would otherwise never reach an existing site — the same
non-retroactivity that made an anchor fix look broken on 2026-08-17. The
re-render tool built for that is a prerequisite for this, and a theme change
needs only a re-render, never a regeneration: no model call, no cost, no risk
of the page coming back different.

## Verification this must ship with

`setTheme` inherits the rule that caused it to exist. **Read the stored theme
back after writing and compare it to what was asked for.** A theme write that
does not change the stored object reports failure, in the owner's words, the
same way `patchDocument` now does.

## Open question

Whether `background: dark` should also flip `sectionTone` defaults, or whether
the two compose independently and an owner can produce an unreadable page. The
safer answer is that background sets the baseline and section tones are
expressed relative to it — but that is a design decision to make with real
pages in front of us, not in a scoping document.
