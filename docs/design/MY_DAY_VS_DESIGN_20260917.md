# My Day, the real thing beside the drawing — 2026-09-17

Adrian: *"TAKE A SCREENSHOT OF THE REAL MY DAY AND PUT IT BESIDE
`docs/design/my-day-2026-09-16-final.png` AND LOOK AT BOTH. Report the differences as a list,
worst first. Do not fix silently — show me what is off."*

| | |
| --- | --- |
| the drawing | `docs/design/my-day-2026-09-16-final.png` |
| the product | `docs/shots/owner-rooms/desktop-planner-clean.png` — 1440×900, the My Day room, reached by **pressing the rail tab** |

**SIMULATED CLAIMED STATE, and the picture says so on its face.** There is no session here: the
rows are declared fakes and the claimed state is set by `hublyArrivalUI.simulate`. Everything
about LAYOUT is the shipping product's; nothing here is evidence about what the server returns.

---

## Differences, worst first

1. **~~The account pill sits on top of the day.~~ FIXED THIS ROUND.** It was `position:fixed` in
   the header and landed on the *Today at a glance* card. It is now in the rail, in the flow,
   above the business row — which is where the drawing puts it too. The 180–260px of clearance
   padding the overlap required is gone with it. A sweep of the claimed shell at 1440×900 across
   Home, My Day and Website now finds **nothing** absolutely-positioned over content except
   `#hcApp` itself, which is the shell.

2. **There is no way to look at another day.** The drawing has `Today`, `‹`, `›` and a
   date-picker button beside the title. The product has none of the four. The renderer already
   reads `hc._dayISO`, so the *model* of "which day am I looking at" exists and has no controls
   on it — the missing-door shape, in the surface Adrian just made a tab.

3. **A band that has something in it offers no way to add to it.** The drawing shows
   `+ Double-click to add something…` under EVERY band, full or empty. The product shows that
   line only in an EMPTY band. On the day in the screenshot all three bands have items, so the
   only add doors left are the calendar hours — and nothing on screen says they are doors.

4. **The day's own column is squeezed and the rows truncate.** The centre is **412px** of the
   800px canvas (chat 380 + context 320 + gaps). Measured truncations on this day:
   `488 W Center St` → `488 W Cen…`, `Blocked — not a customer` → `Blocked — not a custo…`,
   `Business` → `Busine…`. The drawing gives the day roughly 670px and nothing clips.

5. **The context column's cards are named differently and have lost their links.**
   `Today at a glance` (with three icons) → `Today` (no icons) · `Calendar · View calendar →` →
   `Calendar` (no link) · `Today's locations · View map →` → `Your stops, in order` (no map).

6. **~~The band descriptions are different sentences.~~ RULED 2026-09-17 — NOT A GAP.** Adrian:
   *"KEEP THE BAND-RULE SENTENCES. They are in the doc that is the source of truth and they already
   ship. The drawing is history — mark it so."* So it is marked: the drawing's *"Critical tasks that
   move your business forward." / "Important, but not time-sensitive." / "Great to do if you have
   time."* are **HISTORY, not instructions.** The shipping sentences — *"If this doesn't happen
   today, there is a real consequence." / "Should get done, but can move if necessary." / "Good to
   accomplish, but completely okay if it doesn't happen."* — are the band rule, and the band rule
   wins over the picture.

7. **The Ask Hubly panel is much thinner than the drawing.** Absent: the *"Ask Hubly / Your AI
   business partner"* card header, the four action chips with icons (*Plan my day*, *Add a job or
   task*, *Move tasks to tomorrow*, *Show my schedule*), the attach and mic buttons, the
   **honesty line** *"Hubly uses your real data. I won't make up information."*, and the
   *Quick examples:* list. Present instead: the greeting, two computed cards, three chips, a
   plain input. The honesty line is the one with product meaning rather than decoration.

8. **The calendar clips at 340px with nothing saying there is more.** It generates every hour its
   items need (checked: a 6 PM item yields `6…20`), but the card is `max-height:340px;
   overflow:auto`, so a late item is out of sight in a box that does not look scrollable.

9. **The subtitle is different, deliberately.** *"Get things done. Double-click to add something,
   or just start typing."* → *"Add something to your day."* Double-click does not exist on touch;
   recorded when the gesture was fixed.

10. **The rail is different, deliberately.** Drawing: `Home · Website · Settings`. Product:
    `Home · Website · My Day` (plus Jobs and Customers once earned) with Settings as the gear at
    the foot. That is the 2026-09-17 reversal plus earned navigation.

11. **No "Pro tip" card**, dropped on Adrian's own string-audit ruling. Left column also sits on
    a warm ground where the drawing is white.

## What the product does that the drawing does not

- **Says two things overlap, in words, above the day** — *"Two things overlap today — Leslie
  Ammons at 12:00 PM and Dentist appointment at 2:00 PM."* — and marks both rows `OVERLAPS`.
- **The calendar has real items on it** (the drawing shows the empty state).
- **"Later this week"**, so nothing Hubly named goes off-screen.
- **A block says it is a block** — *"Blocked — not a customer"* — so a dentist appointment cannot
  read as a customer called Dentist.
