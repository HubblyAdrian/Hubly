# Owner home — design rulings, 2026-09-06

An image with no ruling attached is just a picture. Every file here carries a verdict, or says
plainly that it has none.

| file | verdict |
| --- | --- |
| `my-day-2026-09-16-final.png` | **APPROVED — CURRENT for the SURFACE.** The My Day surface itself. Supersedes every earlier My Day/schedule image. **Its RAIL is out of date** — it draws `Home · Website · Settings` with no My Day row, which the 2026-09-17 reversal at the top of this file overturns |
| `my-day-2026-09-15-approved.png` | **Superseded** by `my-day-2026-09-16-final.png`. Kept as history, not as instructions |
| `owner-home-2026-09-06-flow.png` | **Approved in part** — screens 1, 2, and the top half of 3 |
| `owner-home-2026-09-06-advice-cards-rejected.png` | **Rejected.** The counter-example |
| `owner-home-2026-09-06-early-single-card-unreviewed.png` | **No verdict.** Kept as history |

---

## REVERSED 2026-09-17 — "MY DAY IS NOT A RAIL ROW" IS NO LONGER THE RULING

**Read this before the section below it.** The 2026-09-16 ruling recorded further down —
*"MY DAY IS NOT A RAIL ROW. MY DAY IS WHAT HOME RENDERS"* — was **reversed by Adrian on
2026-09-17**. It is left in place, not deleted, because an implicitly superseded ruling gets
restored by whoever reads the older text first; that is the same reason it was written down in the
first place.

**THE RULING NOW:** the rail is **Home · MY DAY · Website · Settings**, and **Home does not
auto-open the day.** My Day is a place an owner goes to.

### Why — the two questions are different questions

Adrian, 2026-09-17, arguing it from the booking case: *"if someone books a job how are they
supposed to see it if my day is there?"*

| surface | the question it answers |
| --- | --- |
| **HOME** | **"WHAT'S NEW?"** — what happened while he was away: a booking came in, someone asked and didn't book, a payment landed. News, newest first. |
| **MY DAY** | **"WHAT AM I DOING?"** — the plan for today: the bands, the calendar, what he has committed to. |

A day rendered on Home answers the second question in the place reserved for the first, and the
new booking — the single most valuable thing Hubly has to say — has nowhere to land. That is the
cost the reversal pays for, and it is why the earlier ruling's reasoning (*"the first screen of
ownership is the owner's day"*) does not survive contact with a business that is actually getting
bookings.

### And the day is not simply moved — it is EARNED, through a sequence

Adrian, 2026-09-17, describing what actually happens:

1. **HOME IS THE MAIN CHAT.** Full width, conversation-first — not a narrow column with a panel
   beside it.
2. He asks for his schedule.
3. **IT RENDERS INLINE IN THE THREAD.**
4. **IT OFFERS TO BECOME A TAB.**
5. He accepts → **MY DAY IS CREATED AS A TAB**, and it persists.
6. **OPENING THAT TAB** is where the chat moves left, the day takes the middle, the calendar sits
   to the right.

*"HOME IS CURRENTLY SHOWING STEP 6'S LAYOUT AT STEP 1."* That was the defect in one sentence: the
after-state was being rendered before anything had triggered it, so steps 2–5 had nothing left to
do. The three-column view is not wrong — it is **step 6**, and it belongs behind the tab.

The sequence is built and every step of it is pressed for real by
`scripts/check-my-day-sequence.mjs` (20 legs, each one seen red).

**STILL OPEN, FOR ADRIAN — do not let a session guess this:** *is the rail EARNED for everything,
or is My Day special?* Today My Day is earned exactly like Jobs and Customers — it is not in
`HC_RAIL_DEFAULT`, and the only way to get the row is to ask for the day and accept the offer.
Website is the one place a new business is given. That is a rule the code follows, not a ruling
Adrian has given.

---

## APPROVED — CURRENT — `my-day-2026-09-16-final.png`

**Filed 2026-09-16. THIS IS THE ONE TO BUILD.** It supersedes `my-day-2026-09-15-approved.png` and
every earlier schedule mockup. Those are kept as history; do not read them as instructions. The
written specification is `docs/MY_DAY.md`; where the two disagree, the spec is the requirement and
this image is how it looks.

**Do not redesign or reinterpret this.** Adrian's standing rule: *"Do not redesign or invent the My
Day interface from scratch if an existing design/mockup/spec already exists in the project. Find the
existing design first."*

### What it settles that the earlier versions did not

Four rulings Adrian gave on 2026-09-16, all now drawn:

1. **NO CHATS IN THE RAIL.** Home · Website · Settings, and the account at the foot. Saved
   conversations depend on the conversation-identity migration and do not appear until it is live.
   The panel on the left is the **active** conversation, not a navigation destination.
2. **NO GHOST ROWS.** An empty band shows exactly one line: *"Double-click to add something…"*.
   Grey placeholder rows read as loading and make an empty state look broken. **Never populate fake
   or example items.**
3. **NO PROGRESS METER, AND NO COUNT WHEN EMPTY.** The band header carries the letter, the name, the
   description and an overflow menu — nothing else. The "0% Day complete" ring is **gone** from
   *Today at a glance*, which is now three honest zeros: Jobs · Events · Tasks. When items exist, a
   lightweight count only ("2 complete" / "2 of 4 complete"). Adrian's rule governs the section:
   *"The A/B/C priority hierarchy is about deciding what matters, not measuring how productive the
   owner was."* No bars, rings, percentages, streaks, or colour that moves with progress.
4. **ONE ROW FOR EVERYTHING.** `What | When | Where | Type`. A task or event needs no more. Choosing
   **Type = Job** reveals the minimum job fields *inline* — Customer, Service, When, Where — using
   the **existing Job model and the existing Job workspace**. My Day must never become a second job
   system. Price only if known, never fabricated, never required to create the item unless the model
   itself requires it. Existing customers and services are selectable. Ask only for what is missing,
   through the one-ask floor. *My Day = fast daily entry. Job workspace = complete management.*

### THIS RULING REVERSES THE 2026-09-13 RULING — stated explicitly, with the reason
<!-- AND WAS ITSELF REVERSED ON 2026-09-17. See the top of this file. The 2026-09-13 ruling it
     superseded ("Home shows the site too") did NOT come back: Home is the conversation, full
     width, and the site is one rail row away under Website. -->

**Superseded: "Home shows the site too" (Adrian, 2026-09-13).** That ruling put the site preview
back into Home's right-hand pane, reversing an even earlier choice to hide it. Its reasoning is
recorded in `public/platform-home.html` and was sound at the time: *"the preview they had been
watching build vanished at the exact moment the site became theirs, and the first screen of
ownership was a full-width chat with no product in it."*

**Superseded by: "MY DAY IS NOT A RAIL ROW. MY DAY IS WHAT HOME RENDERS" (Adrian, 2026-09-16).**
Home's right-hand pane is now the day. The problem the 2026-09-13 ruling solved does not come back:
the first screen of ownership is no longer an empty chat, it is the owner's day, and **the site is
one rail row away under Website** rather than hidden entirely.

**It is written here rather than left implicit because an implicitly superseded ruling gets
restored.** A future session reads the 2026-09-13 comment beside the CSS, finds a well-argued rule
that the code no longer follows, and "fixes" it back. Both rulings are Adrian's; this one is later
and it wins.

### Verified against the image itself, 2026-09-16

**The file was opened and read, not trusted from this description** — the scar at the foot of this
file is a ruling that travelled further than the artifact it described. Every point above is present
in `my-day-2026-09-16-final.png`: the rail is **Home · Website · Settings** with the account at the
foot and no chats; each band shows exactly one *"Double-click to add something…"* line and no ghost
rows; *Today at a glance* is **Jobs 0 · Events 0 · Tasks 0** with no ring and no percentage; the row
header is **What | When | Where | Type**; the honesty line and all four Quick examples are as quoted.

**REVERSED 2026-09-17 — see the section at the top of this file. My Day IS a rail row.** The
paragraph below is kept as the record of what was ruled on 2026-09-16 and is no longer what the
product does; the rail is `Home · My Day · Website · Settings` and Home does not render the day.

**It also answers the rail question that was being held.** **My Day is not a rail row.** The rail is
three items, `Home` is the selected one, and **My Day is what Home renders** — the date, the title,
the bands. The 2026-09-15 image put My Day *in* the rail; this one does not, and the conversation
panel beside it is the active conversation rather than a destination (ruling 1). Today the code has
`HC_PLACE_SURFACES = website, planner("My Day"), jobs, customers` with `HC_RAIL_DEFAULT = website,
planner` — so the rail currently shows a **My Day** row this design does not have. Adrian to confirm
before anything moves; `scripts/check-navigation-destinations.mjs` holds either way.

### TWO THINGS IN THE IMAGE THAT THE WRITTEN RULINGS DO NOT COVER

1. **The calendar column skips 6 PM.** The hours read 6 AM … 4 PM, 5 PM, **7 PM**, 8 PM — fourteen
   labels across a fifteen-hour span. Built literally, a 6 PM item has no row to land on. This is a
   slip in the drawing, not a ruling, and it sits directly on top of the one thing this file already
   says the image does **not** decide (*"the calendar's hour range follows the data, not this
   drawing"*). Worth naming because a missing hour is exactly the class of defect that ships when a
   mockup is transcribed rather than read — and we have already shipped the day-window version of it
   once.
2. **"Your AI business partner"** sits under *Ask Hubly* as the panel's subtitle. The rejected
   mockups in this file include *"Hubly is your AI business partner — here to help you get more
   customers and grow"* as **marketing copy inside the product**. The short form here is not the
   same sentence and carries no growth promise, but it is the same register, in a working tool, and
   it is flagged rather than quietly built.

### The rest of the screen

**LEFT — the assistant, beside the day.** *"Hey Adrian! 👋"*, one sentence of what it can do, four
actions (Plan my day · Add a job or task · Move tasks to tomorrow · Show my schedule), the composer,
and the honesty line pinned beneath it: **"Hubly uses your real data. I won't make up information."**
Then **Quick examples** — *"Move my B tasks to next week"*, *"Add a call with a customer tomorrow at
2pm"*, *"What should I focus on today?"*, *"Show me my open jobs"*. **Every one of those is a
promise: it works before it ships.**

**CENTRE — the day is the hero.** Date, **My Day**, and one line of instruction that matches the
gesture everywhere else: *"Get things done. Double-click to add something, or just start typing."*
One gesture, one phrasing, in the subtitle, the rows and the Pro tip.

**RIGHT — context, never a second dashboard.** *Today at a glance*; a **Calendar** column;
*Today's locations*; and the Pro tip that teaches the gesture.

### One thing the image does not decide

**The calendar's hour range follows the data, not this drawing.** It reads 6 AM – 8 PM here because
that is a sensible default for an empty day. It is **not a rule**: an item at 5 AM or 9 PM must be
visible without scrolling past an empty band. We have already shipped this exact defect once — the
day window was today+tomorrow and hid a real Thursday job until it was widened to a week.

### What it does not license

Every figure is **zero** because the day is empty, and that is the point: the mockup shows the
honest empty state rather than a populated fantasy. `MY_DAY.md` §9 and Adrian's product context are
unchanged and absolute — **no invented jobs, customers, deadlines, statistics, urgency or reasons.**
The empty states are invitations, not apologies: *"No events yet — Add a job, task, or event to see
it on your calendar."* / *"No locations yet — Add an address to see your route and locations here."*

---

## APPROVED — `my-day-2026-09-15-approved.png`

**Filed 2026-09-15, by Adrian, with the instruction: "replace the picture in the repo with this one
… this one has the actual logo etc."** It supersedes any earlier My Day picture, pasted or
described. The written specification it renders is `docs/MY_DAY.md`; where the two disagree, the
spec is the requirement and this image is how it looks.

**Do not redesign or reinterpret this. Do not build My Day from a paraphrase of it.** Adrian's
standing rule: *"Do not redesign or invent the My Day interface from scratch if an existing
design/mockup/spec already exists in the project. Find the existing design first."*

### What the image rules

**LEFT — the rail is short, and My Day is in it.** Home · My Day · Website · Settings. Nothing else.
This is progressive navigation, `MY_DAY.md` §11: a capability appears when the owner enters it, not
because a table holds rows.

**LEFT PANEL — "Ask Hubly", the assistant beside the day, not buried under it.** It greets by name,
says what it can do in one sentence, and offers five real openers: *Plan my day for today · Move
this to tomorrow · Make this an A · Add a 15 min break · What should I do next?* Its footer is the
honesty line, in the product, permanently: **"Hubly uses your real data. I won't make up
information."** That sentence is a promise the rest of this repo is built to keep.

**CENTRE — the day is the hero.** Date, then **Good morning, Adrian** by name, then the dynamic
context line — *"You have 2 things that really matter today. Start with your A's. Everything else
can wait."* Then two composers, each carrying its own examples: **Add a task…** (*e.g. Order
supplies, Call Sarah, Update website…*) and **Move something…** (*e.g. Move to tomorrow, Make this a
B, Reschedule…*). Then the bands.

**THE BANDS CARRY WORDS, NOT COLUMN NAMES.** `A — Must Do`, `B — Important`, `C — Nice to Do`, each
with its letter in a coloured disc, a tinted header strip, and an item count. **The row is not a
coloured card.** A row is: checkbox · time (only when it has one) · icon · title · one line of
detail · a quiet lane pill (`Job` / `Business` / `Personal`) · a chevron. `Band B` and `Lane: Work`
are our column names and **must never reach an owner**.

**RIGHT — context, not a second dashboard.** *Today at a glance* (Jobs · Personal · Total · Day
complete as a ring). *Today's schedule* — a plain time-ordered list, 12-hour. *AI Suggestions* —
each one an offer with its reason attached: *"Move website update to tomorrow? You have a busy
afternoon."*

### What it does not license

Every figure in this image is **mock data for layout**. `MY_DAY.md` §9 and Adrian's product context
are unchanged and absolute: **no invented jobs, customers, deadlines, statistics, urgency or
reasons.** A suggestion's reason line is subject to the same rule as everything else in this file —
*Hubly may suggest; Hubly may not manufacture a fact to support a suggestion.* "You have a busy
afternoon" is allowed only when the afternoon is actually busy in the record.

And per §4: no guilt. The ring is a glance, not a score. **"7/10 tasks completed" is forbidden**;
"Nice work today. You got your A's done." is the tone, used sparingly.

---

## APPROVED — `owner-home-2026-09-06-flow.png`, screens 1, 2, and the top half of 3

**The home screen is a conversation plus what it produces, not a dashboard laid out in advance.**
That is the direction. Everything below is a consequence of it.

### Screen 1 — the booking card is the standard

Every field on it is something we actually hold: name, date, package, price, address, vehicle, and
the customer's own note. Nothing is inferred, averaged, benchmarked or estimated. Both buttons —
**View Job** and **Message Customer** — act on a real record.

> **Use this card as the test for any future card.** If a field on a proposed card cannot be traced
> to a row we hold, it does not go on the card.

### Screen 2 — a generated view, rendered inside the conversation, offered

The owner asks for their schedule; Hubly renders it inline and asks *"Want me to keep this as a tab
in your sidebar?"* with **Yes, add it** / **No, not now**. The view is produced by the conversation
and only becomes furniture if the owner says so. Nothing appears in navigation because we guessed
they would want it.

### Screen 3, top half — how EVERY capability change gets announced

> *"Got it! I've added Schedule to your sidebar. You can always ask me to remove it or add more
> tabs later."*

This is the model, and it does three things at once:

1. **It announces.** Prohibition 4 — the interface may not change shape silently. A new place in
   navigation is exactly that kind of change.
2. **It is reversible, and says so.** The owner is told how to undo it in the same breath.
3. **It teaches the mechanic without a tooltip.** "You can ask me to add more tabs later" is the
   entire feature explained in one clause, in the conversation, at the moment it is relevant.

Any capability that lands in the sidebar is announced this way.

---

## NOT APPROVED — and this is the part that gets built by accident otherwise

### The bottom half of screen 3 (in the otherwise-approved flow)

Three claims in the "ideas" list that we cannot support:

| the copy | why it is not allowed |
| --- | --- |
| "Many detailers in Bakersfield see a bump in October." | **We have no data on Bakersfield detailers.** None. This is a market statistic invented to make a suggestion sound grounded. |
| "Your last post was 10 days ago." | Requires a social connection we **do not have**. |
| "Your $60/month plan is a great offer." | A **judgement with nothing behind it** — we have no comparison to call it good. |

### `owner-home-2026-09-06-advice-cards-rejected.png` — the counter-example

The six-card Sunset Detailing home. **Four of its six cards assert data we do not have, and one of
those is financial advice.** Verbatim from the image:

- **"Your average ticket has dropped 8%"** — *"Your average ticket this month is $162 (down from
  $176). I'd recommend raising your Basic Detail from $149 to $169."* We cannot compute an average
  ticket trend, and this is a **recommendation to change a price**, unprompted, on a made-up trend.
- **"Consider adjusting pet hair removal"** — *"You're currently charging $35... Based on similar
  businesses and your recent jobs, I'd recommend $45."* **"Similar businesses" is a competitor
  benchmark we do not possess.**
- **"Your before/after photos can be even better"** — *"Your last 10 job photos are great, but your
  before/after shots aren't consistent."* We have not assessed anyone's last ten photos.
- **"Haven't posted this week"** — *"You haven't posted on Instagram this week."* No social
  connection exists.

Two of those are **unsolicited pricing advice**, which is the most expensive version of the
mistake: `CLAUDE.md` already requires that anything Hubly says about what to charge is
what-was-found-with-sources, never what-to-do, because *"if he raises to $55 on our say-so and
loses his regulars, that is on us."* These cards are the opposite — what-to-do, with an invented
finding attached.

### THE RULE, stated so it is checkable

> **Hubly may suggest. Hubly may not manufacture a fact to support a suggestion.**

*"Want to try a fall promotion?"* is fine — it is an offer, and it claims nothing.
*"Many detailers in Bakersfield see a bump in October"* is not — it is a statistic we invented to
make the offer land.

**The check:** for every sentence in a suggestion, name the row it came from. If you cannot, delete
the sentence — not the suggestion. The suggestion usually survives without it, and is more honest
for the loss.

This is **Hedge Trimming in a helpful voice** — the same family as `OPEN_FINDINGS` #22 (a renderer
composing "Someone in {city} just booked a {service} moments ago" from a city and a service name,
consulting no booking), #25, and #45 (a confident, specific, entirely fictional explanation built
on an unchecked premise). The voice being helpful is what makes it hard to see.

### Two smaller things, both in the mockups

- **The notification bell with an unread badge is the old model persisting.** If the assistant tells
  you what happened, the badge is counting something the conversation has already handled. Two
  systems claiming to be the record of what happened is one too many — and it is the "two of
  everything" pattern this codebase keeps paying for.
- **"Hubly is your AI business partner — here to help you get more customers and grow"** is
  marketing copy sitting inside the product. The owner has already bought it. Footer space in a
  working tool should carry something true and useful, or nothing.

---

## NO VERDICT — `owner-home-2026-09-06-early-single-card-unreviewed.png`

An earlier, simpler version: Sunset Detailing, one card — *"Your website is live and ready to go!"*
— with a **Go to Website** button and a site preview.

**Neither Adrian nor I has ruled on this.** It is filed as history so the progression is visible,
and it must not be read as rejected. Notably it does **not** contain the advice cards above; it is a
different and much quieter design.

---

## A note on how this file was assembled

The rejected ruling was originally described to me for a file whose contents did not match the
description — the pricing-advice cards were **not** in the image I had been pointed at. The
description had been written from an image pasted into chat, not from a filename, and the two had
drifted apart.

I declined to attach a damning ruling to a file whose contents contradicted it, and asked instead.
That is the same discipline as the two-timestamps rule in `STATE.md`: **do not let a description
travel further than the thing it described.** A ruling attached to the wrong artifact is worse than
no ruling, because the next person reads the file, sees no pricing cards, and concludes the ruling
is noise.

---

## In flight

**The Store capability decision (`OPEN_FINDINGS` #36, #46) is screen 3.** It is the first real
instance of the tab mechanic — an owner asking for a capability, Hubly adding it to the sidebar and
announcing it — and it arrives with a paying customer attached. The `capabilities.storefront`
chicken-and-egg in #46 (the flag is only earned by using the Store UI, which is only reachable with
the flag) is precisely the question screen 2 answers: **the owner asks, and Hubly adds it.**

---

## THE STRING AUDIT — Adrian's sourcing test, applied to every string on My Day (2026-09-16)

**The rule:** *"If you cannot name the sentence in MY_DAY.md or in Adrian's own words that a string
comes from, it is a picture artifact. Derive it or drop it."*

**A mention in this file does not count as a source unless it is inside a quoted ruling.** Most of
this README's prose is a *description of the picture* written by a session, so citing it back would
be circular — the same trap as the ruling that travelled further than its artifact.

| string | source | verdict |
|---|---|---|
| "My Day" | `MY_DAY.md` §1 | **SOURCED** |
| `A` / `B` / `C`, "Must Do" / "Important" / "Nice to Do" | `MY_DAY.md` §4 | **SOURCED** |
| `What \| When \| Where \| Type` | Adrian's ruling 4, verbatim | **SOURCED** |
| "Double-click to add something…" | Adrian's ruling 2, verbatim | **SOURCED** |
| "Jobs · Events · Tasks" | Adrian's ruling 3, verbatim | **SOURCED** |
| "Calendar" | `MY_DAY.md` §6 | **SOURCED** |
| the date heading, the hour labels | derived (Intl / generated) | **DERIVED** |
| band descriptions — *"Critical tasks that move your business forward."* etc. | the drawing only | **FAILED → DERIVED.** Replaced with `MY_DAY.md` §4's own definitions: *"If this doesn't happen today, there is a real consequence."* / *"Should get done, but can move if necessary."* / *"Good to accomplish, but completely okay if it doesn't happen."* |
| subtitle — *"Get things done. … or just start typing."* | the drawing only | **FAILED → DERIVED.** The subtitle is now exactly the one sourced gesture sentence, so the phrasing is identical everywhere the gesture appears |
| "Today at a glance" | the drawing only | **FAILED → DERIVED** to "Today". The three tile labels under it are Adrian's and are unchanged |
| "Today's locations" | the drawing only | **FAILED → DERIVED** to "Where you're going" |
| **"Pro tip" + "Keep it simple — Hubly handles the details."** | the drawing only | **FAILED → DROPPED**, on Adrian's explicit ruling. Its only other content was the gesture sentence, which the subtitle already carries in the same words |
| "No events yet — Add a job, task, or event…" / "No locations yet — Add an address…" | **borderline** | **KEPT, FLAGGED.** Quoted in this file's "What it does not license" section as the approved empty states, but that section is a session's description of the image, not a quoted ruling. Adrian to confirm or replace |
| "Later this week" | not from the drawing — written for the fix that stops a job past today disappearing | **DERIVED** |

**Two strings on the surface come from neither the spec nor Adrian and were kept deliberately:**
"Where you're going" and "Later this week" are headings naming their own content rather than
captions copied from a picture. They are flagged here rather than smuggled.
