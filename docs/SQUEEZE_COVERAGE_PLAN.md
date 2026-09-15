# The three squeeze gaps — plan, not started

Adrian, 2026-09-15, on what I reported as uncovered: *"public/hubly.html is not swept for squeeze
— that is the page every CUSTOMER sees, which makes it more important than the owner shell, not
less."* Plus overlap detection, and mobile.

**Not started. Nothing here begins before the conversation-identity migration is settled.**

---

## A. `public/hubly.html` — the page every customer sees

**It is two different jobs, and conflating them would produce one sweep that does neither.**

### A1. The SHELL — hubly.html's own chrome

The booking wizard, the storefront, the themed booking landing. One codebase, **96 media
queries**, breakpoints at 1240 / 1200 / 1100 / 820 / 720 / 640 / 560 / **420px**.

This is the same job as the owner shell and reuses the same tools: `squeezeProbe` from
`lib/owner-rig.mjs`, driven at each declared breakpoint and just below it (a breakpoint is where
the layout *changes*; the squeeze lives just above the next one down).

**Already has a known defect waiting for it**, recorded in `WALK_ESTABLISH_20260913.md` and never
fixed: *"the 🌙 Night theme pill overlaps and clips the Save & exit button"* and *"the Booking
summary heading is crowded by its own calendar glyph."* Those are **overlap**, which is gap B —
so B should land before A1, or A1 will find them and have no way to assert them.

Cost: a day. Risk: low — measurement only until the list is read.

### A2. The 623 GENERATED PAGES — a corpus sweep, not a page check

**623 stored documents across 174 businesses**, and every one is a different layout the model
wrote. There is no single page to check.

**The machinery already exists and must be reused rather than rebuilt:**
- `scripts/lib/mount-as-product.mjs` — mounts a stored document **the way the product serves it**
  (Lesson 37: `setContent` on the stored bytes renders an AST page with none of the shell CSS,
  i.e. measures a document nobody is served).
- `scripts/baselines/block-legibility-corpus.json` — the corpus, already assembled.
- `check-block-legibility.mjs` — already renders these pages and reads **pixels**.
- `lib/kind-split.mjs` — because any rate over this corpus needs its `account_kind` denominator.

So A2 is: run `squeezeProbe` inside the existing mount, over the existing corpus, at the existing
breakpoints. **And it must MEASURE FIRST and report a rate with a denominator** — never fix a
generated page by hand, and never rebuild one (prohibition 1).

**Two cautions specific to generated pages**, both already paid for here:
- **Measure with images LOADED.** CLAUDE.md: aborting them makes an `<img>` fall back to its
  width attribute and manufactures min-content collapses that do not happen on the real page —
  a whole false-positive sweep on 2026-08-27 came from exactly that.
- **A finding is a CLASS, not a page.** 623 pages will produce a long list; the useful output is
  the handful of generator patterns behind it, not 623 tickets.

Cost: two days, most of it in reading the results honestly.

---

## B. Overlap detection — the gap in the probe itself

`squeezeProbe` finds mid-word breaks and clipping. **Overlap is in the rule and is not
detected**, which I said rather than implied, and it stays true until this is built.

**The method.** For every pair of visible, text-bearing or interactive elements that are not
ancestor-and-descendant, intersect their bounding rects. A real intersection of two independent
controls is a defect.

**The hard part is the false positives, and they are the whole design:**
- deliberate overlays — modals, dropdowns, the account menu, tooltips → exclude
  `position:fixed|absolute` where a real stacking context and a backdrop exist
- decorative layers — a gradient over a hero, an icon inside its own button → exclude when one
  element **contains** the other
- negative margins used on purpose — avatar stacks, overlapping cards

A probe that cries wolf gets muted (Lesson 84's neighbour), so the first version reports
**candidates with their geometry** and is tuned against a corpus before it is allowed to fail a
build.

**Start here, not with A1**, because A1 has two known overlap defects waiting and no assertion
for them.

Cost: a day, most of it tuning.

---

## C. Mobile — what it would actually take

**CLAUDE.md is unambiguous: "Claude Code cannot verify mobile. There is no true 390px viewport
and no soft keyboard in this environment. Anything mobile must be checked on a real phone before
it is called done."** That stands. What follows is the split between what *can* honestly be
narrowed and what cannot.

### What emulation genuinely buys (and I would build)

Playwright device emulation gives a real 390×844 viewport, device pixel ratio, touch events and a
mobile user-agent. That is **enough to run `squeezeProbe` at mobile widths** and to catch
mid-word breaks, clipping and overlap in the mobile layout — the sub-900px branch of the owner
shell, which today is tested by nothing at all.

It would be labelled in its own output as **layout only, emulated**, in the check's own words, so
a green there is never read as "mobile works".

### What it cannot buy, and why a phone is still required

- **The soft keyboard.** It resizes the viewport under the page on iOS and not on Android, moves
  the composer, and is the single most common cause of a mobile chat bug. No emulator reproduces it.
- **Real scroll and viewport-resize behaviour** — `100vh` vs the dynamic viewport, rubber-banding,
  the URL bar collapsing.
- **iOS Safari specifics** — font-size autoscaling, tap highlight, `position:fixed` inside a
  scrolled container.

### So the honest plan

1. Build the emulated mobile-width sweep. It closes the layout half and costs half a day.
2. **Everything behind the keyboard stays unverifiable here and needs Adrian on a real phone.**
   The most useful thing I can produce for that is a short scripted walk — five actions, what to
   look for at each — so a check on a real device takes ten minutes instead of an exploration.
3. Never let (1)'s green stand in for (2).

---

## Order, and why

**B → A1 → A2 → C1**, with C2 always waiting on a person.

B first because A1 has known overlap defects and no way to assert them. A2 last of the build
items because it is the largest and the one most likely to produce a list nobody reads.

**None of it starts before the migration design is settled.**
