# Test script — walk it start to finish

**Roughly 60–75 minutes.** One sitting. Start on a laptop, finish the last section on
your phone. Everything here is live: `hubly-conversation` deployed 2026-09-09, `public/`
pushed to Vercel.

It runs in the order a real person hits it — a cold stranger signing up, through to an
owner watching a booking arrive. It is not grouped by subsystem, and it deliberately does
the awkward thing at every step, because every bug found in the last two days was found
by doing the awkward thing.

---

## The one instruction that applies to every step

**Read every reply as an owner, not as a tester.** If a sentence sounds like a machine
talking to itself rather than a person talking to you — "say that plainly", "do not
claim", anything that reads like an instruction rather than an answer — **flag it and
quote it.** That is exactly how the photo leak survived: it was correct, it was shipping,
and nobody read it as a sentence.

Everything else in this script is a specific check. This one is standing.

---

## What is NOT in this script, and why

Don't hunt for these. None of them is switched on.

| Not here | Why |
|---|---|
| **Invoicing / "Send invoice"** | Does not exist. One dead table and a `createInvoice()` in the retired `/app` shell. |
| **Ticking a task off, rolling it to tomorrow, changing its band** | The database does all three. There is no button. Tasks are **read-only on screen**. |
| **A Leads room, a Store room** | The place rows exist for some businesses; no surface renders them, deliberately. A tab that opens nothing is the defect we avoid. |
| **The completion ring, "one clear next thing", suggestions with actions** | Not built. The planner shows the day; it does not advise on it. |
| **Voice input** | Not built. |
| **Your old web address still working after a rename** | Deliberately not promised. There is no alias table, so the old address stops resolving — see step 7, where you should be told exactly that. |
| **Graef's page content as records** | Not started. His page shows 8 services; his records hold 1. |
| **Reviews, Stripe on the kept site, Bucket rebuild** | Not started. |

---

# PART 1 — Cold signup, as a stranger  *(~15 min)*

Use a private window. Do not sign in. Go to **myhubly.app**.

> **Rewritten 2026-09-10.** Signup changed four times in one day, so every step below was
> re-checked against the running product rather than edited from the old text. Each step
> is marked:
>
> - ✅ **PROVED** — watched happen in a real browser on 2026-09-10, end to end.
> - ⚠️ **CHANGED** — this used to fail or behave differently; the expectation here is new.
> - ❓ **NEVER WALKED** — no evidence either way. Not a claim that it works.
>
> The distinction matters: a ❓ failing is information, not a regression.

### 1. Say what you do, and nothing else  ⚠️ CHANGED · ✅ PROVED
Type something real but bare — e.g. `I clean gutters in Murray`.

**This is the step that changed most.** It no longer asks your business name first. It
**builds first**, and the name question arrives afterwards, on its own.

- **You should see:** a design narration while it works, then the build card ticking
  through its stages, then the page appears — and **after** that, one short question on
  its own line: *"What's the business called?"* It should be the **last thing on screen**.
- **You should NOT see:** a name question before anything is built; a menu of choices
  (*"want me to build a website, set up booking, or both?"*); a question about services or
  prices before the name question; more than one question in a message.
- **If it doesn't:** a menu means the introduction/request split has come back — a **wrong
  prompt**. A services-and-prices question *instead of* the name means the ordering rule
  lost its slot again; that exact contest cost a day, and the ordering is now stated in one
  place near `THE ORDER OF THE FIRST TWO QUESTIONS`.

### 2. Refuse to give a name  ⚠️ CHANGED · ✅ PROVED
Say `I'd rather not say yet` or just describe more of the business.

- **You should see:** the site stands, unnamed. The header shows an **eyebrow** — the trade
  and the place, e.g. `GUTTER CLEANING · MURRAY` — and **no wordmark at all**. The address
  stays a placeholder like `site-3f9a21.myhubly.app`.
- **You should NOT see:** an invented name of any kind. Not "Gutter Cleaning Murray", not
  "Your Business", not a monogram or initials, not in the browser tab title either.
- **If it doesn't:** any constructed name is the defect this whole thread exists for — a
  **wrong page**. Note the exact string and where it appeared (header, tab title, footer).

### 3. Now give a name  ⚠️ CHANGED · ✅ PROVED
Say `it's called Thistlebank Gutter Company`.

Five things should happen from that one message. Check them individually — they were
separate bugs and they were fixed separately.

- **The record takes it** — the name is saved.
- **The address derives, with filler stripped:** `thistlebank-gutter.myhubly.app`. Words
  carrying no identity (company, co, LLC, inc, ltd, the, and, in) are dropped; everything
  else is kept. **Not** `thistlebank-gutter-company`, and **not** `george-s-…` if the name
  has an apostrophe.
- **The pill and the preview both follow** — the address bar above the site and the preview
  itself should both be on the new address within the same turn.
- **The wordmark lands ABOVE the eyebrow, and the eyebrow survives.** You should see the
  business name on top and `GUTTER CLEANING · MURRAY` underneath it. Trade and place were
  true before the name and are still true after; losing them to gain a name is a downgrade.
- **The reply names the new address and offers to change it** — something like *"Saved —
  your site is at thistlebank-gutter.myhubly.app. Say the word if you'd rather it was
  something else."* Nobody is ever told they can choose their address otherwise.

- **If it doesn't:** name saved but address unchanged = **broken write**. Address changed
  but the pill still reads `site-xxxxxx` = the client is not adopting, a **broken step**.
  Name on the record but not on the page = the placement failed; that one is now countable,
  so tell me and I can answer it with a query against `placement_outcomes` rather than
  guessing.

### 4. Change the name again, before claiming  ❓ NEVER WALKED — and read this first
Say `actually make it Thistlebank Gutter Co`.

**Expect the name to change and the address NOT to follow**, and that is deliberate but
possibly wrong — I want your ruling rather than a verdict.

The address follows a name only while the slug is still a system placeholder
(`site-` + six hex). After the first rename it is `thistlebank-gutter`, which no longer
matches, so the guard that protects an address *you chose* from being silently overwritten
also stops a second conversational rename from moving it.

- **The open question:** a slug we derived is not a slug you chose. Should a second rename
  on an unclaimed draft follow too? Arguments both ways — nobody has seen the URL yet
  (follow it), versus you might already have said it out loud to someone (don't).
- **You should see:** the name change on the record and the page. The address staying put.
- **If the address DOES move:** that is not a bug, but it means the guard is looser than
  this text says and the script needs correcting.

### 5. Give your prices  ❓ NEVER WALKED tonight
Type them the way a person would, in one message:
`Gutter clean 180, Gutter guards 450, Downspout repair 120`

- **You should see:** it saves them **and** they appear on the page. The reply should name
  the prices back.
- **You should NOT see:** any mention of rebuilding the page from scratch, or any sentence
  about a "services section" being absent when you can see services on the page.
- **If it doesn't:** if it says the prices are on the page and they are not, that is the
  worst class — a **wrong sentence about a write that didn't happen**. Reload and look
  before deciding. This path was not touched on 2026-09-10 and was last walked before it.

### 6. Go and look at the page  ❓ NEVER WALKED tonight
Open the site in another tab.

- **You should see:** your three services with your three prices, in the page's own design.
- **You should NOT see:** placeholder copy addressed to you — anything like *"Use this row
  for the primary work the company wants to be known for"* or *"once the owner confirms"*.
  Those are written for the owner and should never be on a page a customer reads.
- **If you see placeholder text:** that is a **wrong page** — the real service should have
  overwritten it. Tell me which sentence and on which row.

> ### ⓘ THE TWO REFUSALS — not a numbered step, because you cannot reliably cause them
Both of these are rare by design and neither is easy to provoke in a normal walk. Read
them so you recognise them if they appear, rather than trying to cause them.

- **"Too many new sites from this connection"** — the per-IP limit, now 30 per hour. It
  must say the limit is **temporary and clears within the hour**, that it is **not your
  fault**, and it must **not** invite you to try again immediately, because that cannot
  work. It must never invent a countdown or a number of sites.
- **"Hubly is at capacity"** — the global ceiling, 35 generations per hour. This one must
  say plainly that it is **us**, not your connection and nothing you typed. If it blames
  your connection, that is a **wrong sentence**: the two refusals are different and must
  not blur.
- **If you see either during an ordinary walk:** tell me — at 30/hour and 35/hour neither
  should be reachable by one person, and hitting one means something else is spending.

---

# PART 2 — Claim it, then change the address  *(~10 min)*

### 7. Sign up and claim the site  ❓ NEVER WALKED tonight
Use the normal flow.

- **You should see:** you end up on the owner home, signed in.
- **If it doesn't:** anything that lands you on a blank screen or back at the chat with no
  sign anything happened is a **broken step** — note exactly what the last thing you
  clicked was.

### 8. Now try to change the address — read the warning carefully  ❓ NEVER WALKED tonight
Say `can you change my address to thistlebank-gutters-murray`.

**After claiming, the rules invert.** Before a claim the address follows silently because
nobody has seen it. After a claim, someone may hold the link, so it becomes an explicit,
confirmed rename.

- **You should see:** the **exact final address** before anything happens, and that **the
  old address stops working**. Something like: *"I can move your site to
  thistlebank-gutters-murray.myhubly.app. Your current address stops working the moment I
  do — anyone holding the old link won't reach you. Want me to?"*
- **You must see the consequence BEFORE you answer, not after.**
- **If it doesn't:** if it just does it, that is a **broken confirm**. If it says the old
  address will keep working, that is a **wrong sentence** and it is false — there is no
  redirect and no alias table.

### 9. Try an address that's taken  ❓ NEVER WALKED tonight
Say `change it to graefs-autocare`.

- **You should see:** it says that one is taken and **offers** an alternative as a choice.
- **If it doesn't:** silently taking a numbered variant is a **wrong write** — that is how
  a second bad address gets minted.

### 10. Try an address with punctuation  ✅ the normaliser is proved, the confirm is not
Say `make it Thistlebank's Gutter & Wash`.

- **You should see:** the exact normalised string read back to you —
  `thistlebanks-gutter-wash` — **before** it commits. Note the apostrophe **collapses**
  (`thistlebanks`, not `thistlebank-s`); that was a real bug on 2026-09-10 and there is now
  one normaliser rather than two.
- **If it doesn't:** committing without showing you the string is a **broken confirm**. You
  should get the chance to catch a typo before it becomes permanent.
- **Note:** an address you type is transcribed faithfully — filler words are **not**
  stripped here, because you said what you wanted. Stripping only happens when Hubly
  derives an address from a name.
---

# PART 3 — The owner home  *(~10 min)*

### 11. Look at the home screen
- **You should see:** a dark sidebar about 260px wide, full height, "hubly" at the top,
  nav as icon **plus word**, your business name and city at the foot. Top right is an
  account chip with your name and a chevron.
- **You should NOT see:** a narrow pale strip; a business name wrapped into a column;
  anything that says "Signed in".
- **If it doesn't:** **wrong layout** — screenshot it.

### 12. The greeting and the one news line
- **You should see:** "Good morning/afternoon/evening, <name>." then the business name,
  then **at most one line** of news, then four cards.
- **Silence is correct.** An empty news line on a quiet day is a pass, not a bug.
- **If it doesn't:** a news line stating something you know is untrue, or any invented
  number, is a **wrong number** — quote it exactly.

### 13. Click all four cards
**View my schedule**, **See my customers**, **Check my sales**, **Edit my website**.

- **You should see:** schedule opens the Planner room, customers opens the Customers
  room, website opens the editor, sales asks the question in chat.
- **A count appears only when there's something to count.** No "0 jobs today".
- **If it doesn't:** any card showing a zero is a **wrong number**; a card opening a room
  that isn't in your sidebar is a **wrong gate**.

### 14. ⚠️ THE READ MARKER — must not fail quietly
1. Note which event cards are highlighted as new.
2. **Reload the page.**

- **You should see:** those cards are **no longer** marked new, and the greeting stops
  announcing them.
- **If it doesn't:** if the same booking is announced as new on every reload, the read
  marker never lands. **This fails silently by nature** — nothing errors, you just get
  told the same news for ever. `business_event_reads` had zero rows two days ago; I
  proved the function writes and that the client calls it, never with a real session.
  **Tell me first if this fails.**

---

# PART 4 — The services block, the awkward way  *(~15 min)*

This part needs **two different businesses**, both `test` accounts, both already set up
for it:

| for | slug |
|---|---|
| step 15 — services area made of **placeholder rows** | `sunday-field-bakery` |
| step 16 — **no services area at all** | `weekly-lawn-care-and-seasonal-cleanups` |

You'll need to be signed in as their owner to talk to them. If you'd rather use your own
account, any page you've built that shows services will do for 15; for 16 you need one
with no services section, and those two are the ones I've verified.

### 15. A page whose services area is placeholders
On that business, add a service with a price: `add Paint Correction at 275`.

- **You should see:** it lands **in the existing services area**, replacing the first
  placeholder row — not appended beside it.
- **Then go and look:** the placeholder sentence that used to be in that row should be
  **gone** from the page.
- **If it doesn't:** if you get an offer to rebuild the whole page, the inserter still
  can't see the section — **wrong gate**. If the service appears *next to* a placeholder
  rather than replacing it, **wrong write**.

### 16. A page with NO services area — accept the offer
On the other business: `add Full Detail at 180`.

- **You should see:** *"Your page doesn't have a services area yet — want me to add one
  with Full Detail in it?"* — an offer, **not** a rebuild warning.
- Say yes.
- **You should see:** it confirms it added the area and **asks you to go and look**.
- **If it doesn't:** any sentence about starting the page over from scratch is a **wrong
  sentence** — that answer was retired.

### 17. ⚠️ NOW GO AND LOOK AT THAT PAGE — this is the one only you can check
Open the site.

- **You should see:** a services area that looks like **part of the page** — same fonts,
  same colours, heading at the page's own size — with your service and price readable.
- **If the text is invisible, nearly invisible, or the block looks bolted on:** tell me
  the slug. **93 of 96 pages render this correctly and 3 do not**, and nothing detectable
  in the page's HTML separates them — I tested two hypotheses and both failed. A human
  eye is the only thing that reaches this, which is why the reply asks you to look.

---

# PART 5 — Capture: the planner  *(~10 min)*

Type each of these into the chat on Home. **One box. Nothing should ask you to fill in a
form.**

### 18. A job with a stated span
`add tomorrow 12 to 3, Leslie Ammons, detailing`

- **You should see:** saved, read back — who, what, when. **No** follow-up question about
  price or phone.
- **Then open Planner:** it should be there tomorrow at 12:00.
- **If it doesn't:** more than one question = **wrong sentence**; not on the day =
  **broken write**.

### 19. ⚠️ A job with NO length — the assumption must be spoken
`add a full detail for Marcus Reed Thursday at 2`

- **You should see:** saved, **and** it tells you it assumed: *"I've put aside 2 hours —
  tell me if it's longer."*
- **If it saves silently, that is the failure.** Two hours of your day just went busy and
  nobody told you. **Wrong sentence**, and the whole reason this step exists.

### 20. Blocked time is not a customer
`dentist appointment Thursday 2 to 4`

- **You should see:** saved as blocked time. Not described as a job or a customer.
- **Then check:** open **Customers** — the dentist must not be there. Open **Jobs** — not
  there either. It belongs only in the Planner.
- **If it doesn't:** a customer called "Blocked" or "Dentist appointment" anywhere is a
  **broken write**; a changed sales figure is a **wrong number**.

### 21. Tasks, including a personal one
`remind me to order glass cleaner` then `gym at 6`

- **You should see:** both saved without being asked for a date or a priority. The glass
  cleaner has no day and must **not** read as overdue or late. Gym marked personal.
- **Then open Planner:** both under "To do", each with a band (A/B/C) and a short reason.
- **If it doesn't:** being asked "when?" or "how important?" is a **wrong sentence** —
  capture takes what it's given.

### 22. Identity — say a name you already have
`add a wash for <a customer already on your list> Friday at 9`

- **You should see:** it **asks** whether that's the person on record before saving.
- **If it doesn't:** silently attaching to an existing person, or creating a second copy
  of someone you already have, is a **broken write**. Two people can share a name.

### 23. A conflict
Add something that overlaps step 18 — e.g. `oil change tomorrow 1 to 2`.

- **You should see:** in Planner both rows marked, with a line saying they overlap.
- **If it doesn't:** no overlap shown = **missing check**, and it's the most useful thing
  the calendar can tell you.

---

# PART 6 — ⚠️ Does a captured job actually block the calendar  *(~5 min)*

### 24. Must not fail quietly
After step 18 (the 12–3 job tomorrow):

1. Open your **public site** in a private window.
2. Ask the booking chat for an appointment **tomorrow afternoon**.

- **You should see:** 12:00, 13:00 and 14:00 are **not offered**. Same for the dentist
  block from step 20.
- **If it offers you a slot inside a taken window, stop and tell me.** A manual booking
  that doesn't block the calendar is worse than none — you'd trust it and get
  double-booked. **This fails silently by nature**: nothing errors, you just get
  double-booked a week later.
- I proved the row occupies the right minutes using the same arithmetic the availability
  engine reads. I did not drive the public widget. **This step is that half.**

---

# PART 7 — The things that should now tell you the truth  *(~5 min)*

### 25. Upload a hero image
Upload one as your header image.

- **You should see:** it tells you the image is **saved to your record** and that it is
  **not** on the generated page — because that page's header was written as part of the
  page and a saved banner doesn't appear there.
- **You should NOT see:** "live", "now shows it", or anything implying you can go and
  look at it.
- **If it says it's live:** **wrong sentence** — and you'll go and look, which is exactly
  why it was changed.

### 26. Ask Hubly about your own business
Type these and check each answer against what you know:

> `Who are my regulars?`
> `What did I make last month?`
> `Which service sells the most?`
> `What are my opening hours?`
> `What do I charge for each service?`
> `Did my customers actually get their confirmations?`

- **You should see:** real names, real numbers, or an honest "none on record". Money is
  computed over **every** row, not a sample.
- **If it doesn't:** any vague number — "a few", "several", "around" — is a **wrong
  number**. Any customer or booking you don't recognise is a **wrong read**.
- **Expected on Graef specifically:** "what do I charge" comes back with **one** service,
  `clay and seal`, with no price. That is correct and is the finding in
  `docs/GRAEF_PAGE_VS_RECORDS.md` — his page shows 8 services, his records hold 1. Not a
  bug in the reader.

### 27. The classic-site sentence
On Graef's account, ask Hubly to change some page text.

- **You should see:** *"I can't change the page text from here — that's edited in Edit
  details, and your live site is unchanged at graefs-autocare.myhubly.app."* Once per
  conversation.
- **If it says your site was "built by hand":** **wrong sentence** — that's our word for
  our data model and it should be gone everywhere.

---

# PART 8 — On your phone  *(~10 min)*

Do these one-handed, outdoors if you can. **This is the device the planner is for, and
it is the part I cannot test at all** — there is no real 390px viewport and no soft
keyboard in my environment. Anything you find here is a genuine first look.

### 28. Layout
- **You should see:** **no sidebar.** A bottom bar with the same places in the same
  order, max four. Greeting and news readable **without scrolling**.
- **If it doesn't:** a sidebar on a phone, the "hubly" wordmark overlapping the account
  chip, or any sideways scroll is a **wrong layout**.

### 29. A record is a sheet
Tap a card, then a row in a room.

- **You should see:** the record slides **up** from the bottom over the chat, with a
  close ×, and you can scroll to the bottom of it — including the Call button.
- **If the last row or the Call button is cut off with no way to reach it:** **wrong
  layout**.

### 30. The composer and the keyboard
Tap the chat box and start typing.

- **You should see:** the box stays above the keyboard; the send arrow is reachable with
  your thumb.
- **If the keyboard covers either:** **wrong layout**, and it's the interaction you'd
  perform most.

### 31. Check something off — the thumb test
Tap a task or a row in the Planner.

- **You should see:** the record open comfortably with one thumb.
- **Note:** you cannot tick a task **done** from the screen — that button does not exist
  yet. Opening it is the whole interaction for now.

---

# PART 9 — The end of the walk

### 32. Watch a booking arrive
From the private window, complete a real booking on your public site. Then go back to the
owner home.

- **You should see:** it appear on Home as an event card, **without reloading** if the
  realtime path is working, and on the next load if not. Click **View details** — it
  should open in a panel **on the right** that narrows the conversation, not a box in the
  middle. The title should match the kind: "Booking" for a booking, "Lead from your site"
  for a chat lead.
- **If it doesn't:** not appearing at all after a reload is a **broken read**; a modal in
  the middle of the screen is a **wrong layout**; a chat lead titled "Booking" is a
  **wrong sentence**.

---

## What to send back

For anything that failed: **the step number, what you did, what happened.** A screenshot
beats a description for anything about layout — several of the last two days' real
defects were invisible in every measurement and obvious in one picture.

Say these first if they failed, in this order:

1. **Step 14** — the read marker
2. **Step 24** — a captured job blocking the public widget
3. **Step 17** — whether the added services block reads on the page

Everything else is cosmetic next to those three.
