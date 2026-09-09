# Test script — 2026-09-09

Everything below is live: `hubly-conversation` v271, and `public/` pushed to Vercel.
Sign in at **myhubly.app** as the owner of a real business. Graef's account is the one
this was built for; a test business works for everything except step 12.

**Nothing here has been exercised on a real owner session.** There is no owner JWT in
Claude Code, so every check below was proved at the SQL layer or in a harness with a
simulated session. That is exactly why this list exists.

---

## What is NOT in this list, and why

Don't go hunting for these — they were never switched on.

| Not here | Why |
|---|---|
| **Invoicing / "Send invoice"** | Does not exist. One dead table and a `createInvoice()` in the retired `/app` shell. Queued after the planner. |
| **A Leads room and a Store room** | The place rows exist (aquaspeed has `leads`, evergreen has `store`) but there is no surface, so the rail deliberately does not render them. A tab that opens nothing is the defect we are avoiding. |
| **Ticking a task off, rolling it to tomorrow, changing its band** | The database does all three (`set_task_status`, `roll_task`, `band_source`). There is no button yet. Tasks are read-only on screen. |
| **The completion ring, "one clear next thing", suggestions with actions** | Not built. The planner shows the day; it does not yet advise on it. |
| **Voice input** | Not built. |
| **A/B/C as owner override** | Hubly proposes a band and it is stored; there is no way for you to override it from the screen yet. |
| **Graef's page content as records** | Not started — that is the extraction you ruled yes on. His 8 services are still text; his records still hold one. |
| **Reviews, Stripe on the kept site, Bucket rebuild** | Not started. |
| **Anonymous-visitor booking proof** | See step 12 — I proved the row occupies the window in SQL, not through the public widget. That end of it is yours. |

---

## On your laptop

### 1. The home screen
Open **myhubly.app** signed in.

- **Expect:** a dark sidebar about 260px wide, full height, "hubly" at the top, nav as icon **plus word**, your business name and city at the foot with your logo (or initials on your brand colour if there's no logo on record). Top right is an account chip with your first name and a chevron — **not** a pill saying "Signed in".
- **Fail if:** the sidebar is a narrow pale strip; the business name wraps into a column; anything says "Signed in"; the greeting doesn't say your name.

### 2. The greeting and the news line
- **Expect:** "Good morning/afternoon/evening, <your name>." with the business name under it, then **at most one line** of news, then four cards.
- **Fail if:** the news line states something you know is untrue, or invents a number. **Silence is correct** when nothing happened — an empty news line is a pass, not a bug.

### 3. The four cards
Click each: **View my schedule**, **See my customers**, **Check my sales**, **Edit my website**.

- **Expect:** schedule opens the Planner room, customers opens the Customers room, website opens the editor. Sales types "How are my sales doing?" into the chat and sends it.
- **Expect:** a card shows a count (e.g. "3 jobs today") **only when there is something to count**. No zeros.
- **Fail if:** any card shows "0 anything"; any card opens a room that isn't in your sidebar; the count runs into the label with no line break.

### 4. A record opens in the panel, not a modal
On Home, find an event card and click **View details**.

- **Expect:** a panel slides in **on the right** and the middle column narrows. The composer stays visible and usable. The panel title matches the kind — "Booking" for a booking, **"Lead from your site"** for a chat lead, "Unfinished booking" for an abandoned one.
- **Fail if:** it opens as a box in the middle of the screen; it covers the card it came from; the last row is cut off; a chat lead is titled "Booking".

### 5. The read marker survives a reload
This is the one I could not settle from here.

1. Load Home. Note which event cards are highlighted as new.
2. **Reload the page.**

- **Expect:** those cards are **no longer** marked new. The greeting stops announcing them.
- **Fail if:** the same booking is announced as new every single time you reload. That means the read marker never lands, and `business_event_reads` had zero rows before today — I proved the function works and that the client calls it, but never with a real session.
- If it fails, tell me and don't work around it.

### 6. The three rooms
Click **Planner**, **Jobs**, **Customers** in the sidebar.

- **Expect:** each takes the **centre** of the screen; the conversation narrows to a column on the left and stays usable. Each has a heading.
- **Expect on Planner:** today and tomorrow, jobs and blocked time in **one list**, with tasks under "To do".
- **Expect on Customers:** anyone with two records sharing a phone or email shows as **one person**, with "2 records matched on contact details" on the row.
- **Fail if:** a room renders an empty table with column headers — an empty room must say something in words. **"I couldn't read your jobs just now" is a different message from "no jobs yet"** and they must not be swapped.
- **Fail if:** two people who merely share a name are shown as one person.

### 7. Click a row
In any room, click a job, a task or a customer.

- **Expect:** it opens in the same right-hand panel. Titles: "Job", "Blocked time", "Task", "Customer".
- **Fail if:** clicking navigates away, or the panel opens empty.

---

## Capture — the part that matters most

Type each of these into the chat box on Home. **One box. Nothing should ask you to fill in a form.**

### 8. A job with a stated span
> `add tomorrow 12 to 3, Leslie Ammons, detailing`

- **Expect:** it's saved, and Hubly reads it back — who, what, when. It should **not** ask you for a price, a phone number or anything else you didn't say.
- **Then:** open Planner. It should be there tomorrow at 12:00.
- **Fail if:** you're asked more than one question; the length isn't 3 hours; it doesn't appear on the day.

### 9. A job with NO length — the stated assumption
> `add a full detail for Marcus Reed Thursday at 2`

- **Expect:** saved, **and Hubly tells you it assumed**: something like *"I've put aside 2 hours — tell me if it's longer."*
- **Fail if it saves silently.** Two hours of your day just went busy. A silent default here is the single thing this step exists to catch.

### 10. Blocked time
> `dentist appointment Thursday 2 to 4`

- **Expect:** saved as blocked time. Hubly should not call it a customer or a job.
- **Then:** open **Customers**. The dentist must **not** be in there. Open **Jobs** — it must not be in there either. It belongs only in the Planner.
- **Fail if:** a customer named "Blocked" or "Dentist appointment" appears anywhere; the sales figure changes.

### 11. Tasks, and the personal one
> `remind me to order glass cleaner`
> then
> `gym at 6`

- **Expect:** both saved without being asked for a date or a priority. The glass cleaner has no day, and that's fine — it must **not** be described as overdue or late. Gym should be marked personal.
- **Then:** open Planner. Both under "To do", each showing a band (A/B/C) and a short reason.
- **Fail if:** you're asked "when?" or "how important?"; an undated task reads as overdue.

### 12. The calendar is actually occupied — *the one that must not fail silently*
After step 8 (the 12–3 job tomorrow):

1. Open your **public site** in a private window — `<your-slug>.myhubly.app`.
2. Ask the booking chat for an appointment **tomorrow afternoon**.

- **Expect:** 12:00, 13:00 and 14:00 are **not offered**. Same for the dentist block from step 10.
- **Fail if:** it offers you a slot inside a window that's already taken. **A manual booking that doesn't block the calendar is worse than none** — you'd trust it and get double-booked.
- I proved the row occupies 720–900 minutes using the same arithmetic the availability engine reads. I did not drive the public widget. This step is that half.

### 13. Identity — three cases
> `add a wash for <a name already in your customers> Friday at 9`

- **Expect (one match):** Hubly **asks** whether that's the person on record before saving.
- **Expect (several with that name):** it lists them and asks which.
- **Expect (a brand new name):** it just creates them, no interrogation.
- **Fail if:** it silently attaches the job to an existing person, or creates a second copy of someone you already have.

### 14. A conflict
Book two things that overlap — e.g. after step 8, add `oil change Friday 1 to 2` where Friday 12–3 is already taken.

- **Expect:** in Planner both rows are marked, with a line saying they overlap and offering to move one.
- **Fail if:** the overlap isn't shown at all.

### 15. An empty day
Switch to a business (or a day) with nothing on it.

- **Expect:** a sentence explaining what will appear here and how to add something.
- **Fail if:** you get an empty frame, a table with no rows, or anything implying you've fallen behind.

---

## On your phone — the device this is for

Do these one-handed, outdoors if you can.

### 16. Layout
- **Expect:** **no sidebar.** A bottom bar with the same places in the same order, max four. Greeting and news readable **without scrolling**.
- **Fail if:** the sidebar appears; the "hubly" wordmark overlaps the account chip; the page scrolls sideways at all.

### 17. Records are a sheet
Tap a card, then a row in a room.

- **Expect:** the record slides **up** from the bottom over the chat, with a close ×, and you can scroll to the bottom of it — including the Call button.
- **Fail if:** the last row or the Call button is cut off with no way to reach it.

### 18. The composer and the keyboard
Tap the chat box.

- **Expect:** the box stays above the keyboard. The send arrow is reachable with your thumb.
- **Fail if:** the keyboard covers the box or the send button.
- **I cannot test this at all** — there is no real 390px viewport and no soft keyboard in my environment. Anything you find here is a genuine first look.

### 19. Tablet
If you have one: landscape should be three columns (sidebar, list, record). Portrait should behave like a wide phone — bottom bar, no sidebar.
- **Fail if:** portrait shows a sidebar that fills the screen.

---

## Questions to ask Hubly

Type these on Home and check the answer against what you know.

### 20.
> `Who are my regulars?`
> `What did I make last month?`
> `Which service sells the most?`
> `What are my opening hours?`
> `What do I charge for each service?`
> `Did my customers actually get their confirmations?`

- **Expect:** real names, real numbers, or an honest "none on record". Money figures are computed over **every** row, not a sample.
- **Fail if:** any number is vague ("a few", "several", "around"); any answer describes a customer or a booking you don't recognise; it says you have no hours when your page shows hours.
- **Expected on Graef specifically:** "what do I charge" will come back with **one** service — `clay and seal`, no price. That is correct and is the finding in `docs/GRAEF_PAGE_VS_RECORDS.md`: his page has 8 services, his records have 1. It is not a bug in the reader.

### 21. The classic-site line
Ask Hubly to change some page text on a business with no document (Graef).

- **Expect:** *"I can't change the page text from here — that's edited in Edit details, and your live site is unchanged at graefs-autocare.myhubly.app."* Once per conversation.
- **Fail if:** it says your site was "built by hand". That's our word for our data model and it should be gone.

---

## What to send back

For anything that fails: the step number, what you did, what happened. A screenshot is worth more than a description for anything about layout — two of today's four real defects were invisible in every measurement and obvious in one picture.

If step 5 or step 12 fails, say so first. Everything else is cosmetic by comparison.
