# E — state 2, before it is built

**Design only. No code written. 2026-09-15.**

## The ruling being implemented

Identity has **three** answers, not two. This is the not-found-is-three-answers lesson one feature
over, and it follows directly from the measurement: the `localStorage` keys are **enough to
suppress, never enough to assert.**

| | condition | what is on screen |
|---|---|---|
| **1** | no keys | the landing page, immediately, exactly as today |
| **2** | keys present, auth not yet resolved | **neither.** A neutral shell, holding. Claims nothing about who this is. |
| **3** | auth resolved, signed in | the app |

An expired session lands in state 2 and **falls to state 1** when auth answers. That is correct and
honest, and a signed-in shell is never shown to somebody who is signed out.

## What state 2 looks like

**It is the app's own frame with nothing claimed inside it.** Not a spinner, not a splash, not a
logo animation, and above all not an apology.

> "It must not be a spinner apologising — an owner opening their own business should never see us
> hesitate at them." — Adrian

Measured, so the frame can be matched exactly: `<header class="nav">` is **64px** (`--nav-h`) and is
already painted as part of the static markup in every state, including the landing. `#hcApp` is
`<div class="hc-app" aria-hidden="true" data-mview="chat">` and contains `#hcRail`, which ships
`hidden`.

So state 2 is:

- **The nav stays exactly where it is.** It is already on screen at 67ms and it does not move,
  because it is the same element in all three states. Nothing about the top of the page changes when
  auth resolves.
- **Below it, the app's own ground colour fills the viewport** — the same background `#hcApp` paints
  in state 3, at the same dimensions (`calc(100dvh - var(--nav-h))`).
- **The rail is absent, not empty.** It ships `hidden` and stays hidden: an empty rail would be a
  claim about which places he has earned, and we do not know yet. Prohibition 5 — a place appears
  only once the business has earned it — and we cannot know what is earned before auth answers.
- **No greeting, no business name, no chip, no cards, no thread.** Every one of those is a fact
  about who this is. State 2's entire discipline is that **it asserts nothing.**
- **No text at all.** Not "Loading…", not "One moment", not "Signing you in". Each of those is
  either a claim (that he *is* signed in) or an apology. Silence in a frame that is obviously his
  product is not a gap; it is the shortest possible absence of a lie.

**On the landing being gone:** in state 2 the hero and footer are hidden by `body.hc-active` exactly
as in state 3. That is the whole point — no marketing page for an owner.

## Why it does not flash

The requirement is that when auth resolves fast, state 2 → state 3 is **indistinguishable from the
app appearing directly.** Three things make that true, and each is a design constraint rather than a
hope:

1. **State 2 and state 3 are the same box.** Same element, same background, same dimensions, same
   nav above it. Going to state 3 only *adds* content inside a frame that is already the right
   shape and colour. Nothing resizes, nothing moves, nothing reflows.
2. **Nothing in state 2 animates.** A spinner that has to finish a rotation, or a fade that has to
   complete, creates a minimum visible duration — the flash we are trying to avoid. State 2's cost
   of being dismissed is zero frames.
3. **State 2 is entered synchronously, before first paint**, from `localStorage` — which is a
   synchronous read available immediately, unlike anything that waits on the CDN. So there is no
   window in which the landing shows first and state 2 replaces it. **If state 2 can only be
   entered after a network call, the design has failed** and we have added a third flash rather
   than removed one.

**And if auth resolves slowly, state 2 is still silent.** No progressive disclosure, no "still
working on it" after N seconds. If auth *fails*, we fall to state 1 — the landing, honestly — and
the reason a signed-out person sees the landing is that they are signed out.

## What I am NOT proposing

- **Not caching any owner content to paint early.** A cached business name or greeting painted
  before auth resolves is a fact asserted on the strength of a stale key — the same defect as a
  green checkmark we did not earn. State 2 shows a frame, never content.
- **Not gating the app on the keys.** The keys suppress the landing. Only auth reveals the app.
  These are separate switches and the design keeps them separate; collapsing them is exactly the
  bug this avoids.
- **Not touching the CDN dependency.** That is the separate finding below and it is measured, not
  fixed.

## What this design does not know

- **How long state 2 actually lasts for a real owner.** Unmeasured — there is no authed session in
  this environment. Lower bound ~0.6s from the CDN leg alone.
- **Whether anything else already reads those keys before paint** in a way that would conflict.
  Measured as zero pre-paint identity reads, but that was a grep for the ones I thought of.
- **Mobile.** No 390px viewport here. A holding state that looks calm on a desktop viewport and
  wrong on a phone is exactly the class of defect this environment cannot see.
