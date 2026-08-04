# Experience 1 — UX Critique & Recommendations

**Status:** Critique only. No code changed. This document reviews the current live conversation and the "What I've Learned" panel, then proposes revisions. Nothing here gets implemented until reviewed together.

**Methodology:** every finding below is grounded in the actual live system prompt (`hubly-conversation/index.ts`), the actual panel rendering code (`platform-home.html`), and a real conversation run against the deployed endpoint — not assumption. The test conversation quoted throughout is real output from production, run today.

---

## The test conversation

```
User: I need help with my business
Hubly: I'd love to help.

Before I make recommendations or build anything, I'd like to learn about your business.

You can paste a website, your Google Business Profile, Facebook page, Instagram, upload
screenshots, or simply tell me you're starting from scratch.

User: I own a plumbing company.
Hubly: Got it — you run a plumbing company.

I can help with things like getting more calls, tightening up your services and pricing,
improving your website, organizing customers, setting up booking, or making your business
look more professional online.

What's the main thing you want help with right now — more customers, a better website,
pricing/services, scheduling, or something else?
```

The opening line is fine — short, clear, no menu. **The second reply is where it turns into software.** After exactly one fact ("plumbing"), it lists six capabilities and closes with a five-option menu. This is the concrete evidence behind all five points below — not a hypothetical.

---

## 1. Response length

The second reply is 384 characters across two paragraphs — not egregious by word count, but it's doing three jobs at once: acknowledging, pitching, and asking. A consultant meeting someone for the first time doesn't do all three in one breath. Real root cause isn't length exactly — it's **density**. One paragraph, not two; one idea, not three.

**Where this lives:** the `TONE` section of the system prompt already says "Short paragraphs" but has no instruction against *combining* ideas — reflect-back, capability pitch, and a question all get bundled because nothing tells the model to pick one.

## 2. Capabilities introduced too early

"Getting more calls, tightening up your services and pricing, improving your website, organizing customers, setting up booking, or making your business look more professional online" — six capability-shaped things, after one word of context. This is `RECOMMENDING A CAPABILITY`'s actual failure mode, not a violation of it: the section says "only bring one up when it genuinely helps with what the person actually said," but the model has no real evidence yet about what this plumbing business actually needs — it's pattern-matching "plumbing company" to a generic list of things plumbing companies often want, which is exactly the software-selling-itself feeling.

**Where this lives:** `CAPABILITY KNOWLEDGE RELEVANT TO THIS CONVERSATION` is present in the prompt on *every* turn, including this one — and the loader's foundational-backfill (Website Generation, Service Catalog, Booking Creation) fires precisely when too little is known yet, which is turn two of nearly every conversation. The mechanism built to keep the prompt small is inadvertently the mechanism making the model reach for capabilities before it has earned the right to.

## 3. The follow-up isn't consultative

"What's the main thing you want help with right now — more customers, a better website, pricing/services, scheduling, or something else?" is a dropdown wearing a question mark. Compare to what the user proposed: *"Are you just getting started, or have you been in business for a while?"* or *"What's the biggest challenge you're dealing with right now?"* — both ask the person to talk, not to pick from a shelf.

**Where this lives:** nothing in the current prompt distinguishes "a real question that invites a story" from "a menu disguised as a question." The `LEARNING ABOUT A BUSINESS` section talks about *what to accept* (website, GBP, Facebook, screenshots) but says nothing about *how to ask* when there's nothing to accept yet — a genuinely open moment, and the model defaults to enumerating options because that's the closest available pattern (the capability list right above it in the same prompt).

## 4. "What I've Learned" panel is visual noise, not alive

Confirmed directly in code (`platform-home.html`):

```js
function hcRenderUnderstanding(){
  ...
  el.innerHTML = HC_CATEGORY_ORDER.map(function(key){   // all 9 categories, always
    var d = hcFieldDisplay(key, hc.understanding[key]);
    return '...' + hcEscape(d.text) + '...';
  }).join('');
}
```

`HC_CATEGORY_ORDER` has 9 entries (business, industry, services, website, brand, scheduling, crm, payments, goals) and every single one renders every time, full re-render, no transition. After the plumbing exchange above, a real user sees **industry filled in and eight rows still saying "Not discussed yet."** That's not a panel building understanding in front of you — it's a checklist shaming you for the seven things you haven't said yet. There's also zero animation distinguishing *what just changed* from what was already there — a full `innerHTML` replace treats a brand-new discovery identically to a field that's been sitting there five turns.

## 5. Cognitive load

This is the sum of 2 and 3: turn two alone puts eleven distinct options in front of the user (six capabilities + five menu items) before they've said a second sentence. Nothing forces a choice among them explicitly, but the *shape* of the reply is "here's a catalog, which page do you want" — the opposite of one focused thought.

---

## Proposed revised conversation

Same scenario, same information available to the model, different behavior:

```
User: I need help with my business
Hubly: I'd love to help.

Before I make recommendations or build anything, I'd like to learn about your business.

You can paste a website, your Google Business Profile, Facebook page, Instagram, upload
screenshots, or simply tell me you're starting from scratch.

User: I own a plumbing company.
Hubly: Nice — plumbing's a solid business to build on.

Are you just getting started, or have you been running it for a while?
```

Note what's *not* there: no capability list, no menu. One acknowledgment, one question, and the question is chosen because "how established is this business" is genuinely the highest-value thing to know next — it reshapes almost everything downstream (a two-week-old business and a ten-year-old business need entirely different next questions, and entirely different capability recommendations later). This is the "single highest-value question" principle from the brief, applied concretely.

A second example, showing capabilities earning their way in rather than being pitched upfront:

```
User: Business has been open about 3 years. Honestly bookings have been slow lately.
Hubly: Got it — three years in, and bookings have slowed down. That's useful to know.

Is that a new thing, or has it been trending down for a while?
```

Still no capability mention — "slow bookings" is exactly the kind of signal that *should* eventually surface Marketing or Booking, but not on the turn it's first mentioned. Trust is built by staying curious a beat longer than software would.

Only once there's a real, specific problem *and* enough context to know it's the right moment does a capability get named — and even then, one, not a list:

```
User: It's been trending down for a couple months. I think people just don't know we exist.
Hubly: That's a visibility problem, not a plumbing problem — very fixable.

The fastest lever is usually getting your business showing up where people already search
for a plumber nearby. Want me to look at what you've got online right now, or start from
scratch if there's nothing yet?
```

One capability-shaped idea, framed as a diagnosis ("visibility problem, not a plumbing problem") rather than a feature name, with a real choice (two options, not five) that's actually about the *user's situation*, not a menu of Hubly's modules.

---

## Proposed "What I've Learned" panel behavior

1. **Hide unknown categories entirely.** Only render a row for a category once `hcFieldDisplay` returns `known: true`. An empty panel on turn one (or a single friendly placeholder like "Getting to know your business...") is more honest and less noisy than nine "Not discussed yet" rows.
2. **Animate new discoveries.** When a category transitions from absent/unknown to known between renders, apply a distinct visual treatment (brief highlight/fade-in) so it reads as *just learned*, not identical to a field that's been sitting there since turn one. This requires diffing the previous render against the new one — comparing `hc.understanding` before and after a patch merge, not just re-rendering everything.
3. **Order by recency, not fixed category order**, once more than a couple of fields are known — so the most recently learned thing is visible near the top, reinforcing "Hubly is actively listening" rather than "Hubly has a fixed form it's filling out."

None of this touches the Business Understanding *data* — the patch/merge mechanism, the schema, what the model emits. It's entirely a rendering-layer change: which known fields to show, in what order, with what transition.

---

## Confirming the constraints

Nothing above proposes:
- A new field in `BusinessUnderstandingPatch` or `CustomerUnderstandingPatch`.
- A new Capability Registry entry or a change to how one is invoked.
- A new orchestration step, planner, or reasoning pass — the model still makes one decision per turn, same shape, same contract.
- Any change to the deterministic opening (it already works — the second turn is where this document's findings start).

Every recommendation is either **prompt language** (how the model is instructed to pace itself and choose questions) or **rendering logic** (which known fields the panel shows and how it animates them). Both are reversible, low-risk, and don't touch anything currently under the architecture freeze.

---

## Open question worth deciding before implementation

The "single highest-value question" principle (point 3) implies the model should have some notion of *which* unknown field matters most given what's already known — today's prompt has no such ranking, it just says "ask what's needed." Is a short, explicit list of instructive examples (like the ones in this document) sufficient to shift model behavior, or does this warrant a lightweight "what's the highest-leverage next question" heuristic similar in spirit to how Capability Knowledge is already selected (deterministic, not a second model call)? My instinct is that prompt examples alone will get most of the way there and should be tried first before adding any new mechanism — but flagging it since it's the one place "just write a better prompt" and "add a small deterministic helper" are both plausible, and the second one would need its own sign-off before being built.
