# The phone shell — what it is for, what a room is on it, and how you leave one

**Written 2026-09-17 on Adrian's instruction, and DELIBERATELY NOT BUILT.** His words:
*"PHONE NAVIGATION IS A REAL GAP AND NEEDS DESIGNING, NOT GUESSING. A room on a phone with no way
back except the bottom bar's Home was never designed. Write up what it should be — what the phone
shell is for, what a room is on a phone, how you leave one — and bring it. Do not build it yet."*

**EVERY NUMBER BELOW WAS MEASURED AT 390×844 IN THE DESKTOP ENGINE, NOT ON A HANDSET.** There is no
true phone viewport here and no soft keyboard. The CSS and the DOM are real; how it FEELS is not
established, and the rule stands: Claude Code cannot verify mobile.

---

## 1. What is actually there today, measured

| | at 390px |
| --- | --- |
| the rail | **not rendered** (`@media (max-width:900px) .hc-app.hc-claimed .hc-rail{display:none}`) |
| the bottom bar | Home · Website · My Day · Jobs — **4 items, the cap** (`HC_MOBILE_PLACE_CAP = 4`) |
| an owner with 5 earned places | **Customers and Quotes have no door at all.** They are earned, they render nothing, nothing says they exist |
| the Chat/Site toggle | two values, shown only once a site exists; hidden in a room as of today |
| a room | takes the whole screen (fixed today — it used to be a blank screen: see OPEN_FINDINGS) |
| a record panel | **full width, 390px, over the room** |
| sideways scroll | none |

### The three things that were never designed

1. **The bar is the whole navigation, and it holds four.** The cap is prohibition 5 and it is
   right — a phone bar with seven icons is a phone bar nobody reads. What was never decided is
   **what happens to the fifth place.** Today: nothing. It is earned and unreachable.
2. **Two navigations that overlap.** The bar answers *"which place am I in"*; the Chat/Site toggle
   answers *"chat or the site"* — and **Website is in both**. On desktop there is one answer (the
   rail). On a phone there are two controls whose meanings cross.
3. **A room is a destination, and leaving it is undefined.** Pressing Home on the bar works, and
   that is the only way. There is no back, no gesture, and the panel over a room has only its ×.

---

## 2. What the phone shell is FOR

The desktop shell shows **two things at once**: the conversation and whatever he is working on. That
is the whole point of it — he talks to Hubly *about* the thing in front of him.

**A phone cannot do that, and should not try.** One screen, one thing. So the phone shell is not a
smaller desktop; it is **a way to carry the conversation around, and to look at one thing at a
time when he needs to.** Which gives the ordering:

- **The conversation is the default and the home.** It is the one surface that works at any size
  and is the only one that can answer a question he has not anticipated.
- **A place is somewhere he goes on purpose**, looks at one thing, and comes back.
- **Nothing on a phone should require two panes to make sense.** Anything that does is a desktop
  feature and should say so rather than render half.

## 3. What a ROOM is on a phone

**A room is a full-screen view he entered deliberately, and it is temporary.** Not a mode he can
get stranded in. Three consequences:

1. **It takes the whole screen.** (True today.)
2. **It has a visible way out, on the room, not only on a bar** — because a bar is navigation, and
   "get me out of here" is not the same act as "take me to Home". A room heading with a back
   affordance is the ordinary answer.
3. **The conversation is never further than one tap**, because it is the thing that works when the
   room does not answer his question.

## 4. How you LEAVE one — three options, and a recommendation

**Option A — Back on the room heading.** The room gains a `‹ Back` beside its title; it returns to
whatever he was on (Home, in practice). Cheapest, and it is the only one of the three that answers
"get me out" as distinct from "go somewhere".

**Option B — The bar highlights and Home is the exit.** What exists today. It works, it is already
built, and its weakness is that leaving a room is indistinguishable from navigating — an owner who
wants his conversation back has to know Home is where it lives.

**Option C — A sheet, not a room.** A room on a phone is presented as a sheet over the conversation
that he dismisses by swiping down. The strongest model (it matches what every phone app does) and
the most work: it changes what a room IS on a phone rather than where it sits.

**Recommendation: A, then C when there is time.** A is a heading affordance and a listener; it
closes the stranding immediately. C is the right long-term answer and is a design change, not a
patch.

## 5. The fifth place — BUILT, 2026-09-17 (option 1)

**Adrian: "bring me the smallest honest fix."** The last slot becomes **More** when there are more
places than fit, and it opens the rest by name. Measured at 390px: the bar reads
`Home · Website · My Day · More`, and More opens `Jobs, Customers, Quotes`.

- **The cap stays four.** Prohibition 5 is untouched.
- **NOTHING REORDERS.** The first three keep their positions forever; the overflow keeps its own
  order. Both halves of the prohibition hold.
- **It says how many are behind it** — `aria-label="3 more places"` — so the dots are not a mystery
  to someone who cannot see them.
- **It does not appear when it would save nothing.** Four destinations fit, so at four there is no
  More: it costs a slot and only earns one when it saves two. (Red-proofing found the first version
  could not tell — with three destinations both behaviours look identical. Leg 8 tests the boundary.)

Held by `scripts/check-every-earned-place-has-a-door-on-a-phone.mjs`, 8 legs, every control pressed
at a real 390px viewport. **NOT VERIFIED ON A HANDSET** — the standing rule.

### The options that were not taken, and why

1. **taken** — More in the fourth slot.
2. **the bar shows the four he uses most.** *Forbidden.* Prohibition 5: positions are stable and
   navigation never reorders by frequency or recency. Named as forbidden so it does not look
   available.
3. **the rest are reached by ASKING.** Defensible — every place is reachable in the conversation —
   but only honest if Hubly SAYS so when a place is earned on a phone and cannot be shown. That is
   a sentence nobody has written, so it is not the smallest fix; it is a second one.

## 5b. The original three options, kept as the record

1. **A "More" item in the fourth slot** opening a list of the rest. Keeps the cap honest, gives
   every earned place a door, costs one tap for places 4+.
2. **The bar shows the four he uses most.** *Forbidden.* Prohibition 5: positions are stable and
   navigation never reorders by frequency or recency.
3. **The bar holds four and the rest are reached by ASKING.** Defensible — every place is already
   reachable in the conversation (`HC_GO_PLACES`, `hcGoToPlace`) — but it is only honest if Hubly
   **says so** when a place is earned on a phone and cannot be shown. A place that is earned,
   invisible, and unmentioned is the interface changing shape silently.

**The one thing that is not an option is today's behaviour:** earned, invisible, and unsaid.

## 6. What this write-up does NOT settle

- Whether the Chat/Site toggle survives at all once rooms are first-class on a phone. (It probably
  becomes "the site is a place like any other place", which deletes a control — good, but it is
  Adrian's call.)
- The record panel: full-screen over a room today, with only a ×. If a room becomes a sheet, the
  panel is a second sheet and the stack needs a rule.
- Anything about how it FEELS. That needs a handset.
