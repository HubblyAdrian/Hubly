# Milestone 2.5 — Phase E: Founder Certification

**This is the only definition of done that matters.**

Engineer green (`merge passed`, `gates green`) is necessary but **not sufficient**.

Milestone 2.5 is complete only when a brand-new customer can go from **hubly.app** to a fully launched business **without ever realizing there was an old product**.

```
Nothing is considered complete until the live production product passes these tests.
```

Do **not** start Milestone 3 until every test below is ✅ on **live hubly.app** (not localhost, not a preview that still points at old `main`).

---

## How to run Phase E

1. Merge / deploy the cutover branch so production serves this code.
2. Open an **incognito** browser (Test 1).
3. Work through Tests 1–8 below.
4. Fill the [Cutover Report](./MILESTONE25_CUTOVER_REPORT.md) — every row green.
5. Sign the Founder Certification block at the bottom of this file.
6. Only then close Milestone 2.5.

Wiring gate (`npm run check:m25-cutover`) proves the code *intends* this journey.  
**Phase E proves a customer can live it.**

---

## Test 1 — Brand New User

Open an incognito browser. Go to **hubly.app**.

You should experience:

```
Welcome
  → Business Conversation (Discovery)
  → Thinking
  → Creative Build
  → Reveal
  → Save Business
  → Launch
  → Business Home
```

You should **never** see:

- Old signup (“Let’s build your site” / account form first)
- Old onboarding (Creative Director form wizard / vibe → email → build)
- Old dashboard
- Old editor

| Check | Pass? |
|-------|-------|
| Apex `/` is Welcome conversation | ⬜ |
| First message enters Discovery, not a form | ⬜ |
| Thinking canvas appears (not “Loading…”) | ⬜ |
| Creative Build is collaborative, not a spinner wizard | ⬜ |
| Reveal feels like a finished business | ⬜ |
| Save / Launch → Business Home | ⬜ |
| Zero old-product surfaces appeared | ⬜ |

**If any old surface appears → cutover fails.**

---

## Test 2 — Returning User

Sign in to an existing account.

You should land on:

**Business Home**

Not:

**Dashboard**

Your first experience should feel like:

> Good morning…  
> Last night I reviewed your business…

| Check | Pass? |
|-------|-------|
| `/login` → session → Business Home (or Hubly Daily → Home) | ⬜ |
| No classic Dashboard as the first screen | ⬜ |
| Morning / overnight Hubly voice present | ⬜ |

---

## Test 3 — Website Editing

From Business Home, click **Edit Website** / **Edit with Hubly**.

You should enter:

**Creative Workspace**

Not:

**Old Editor**

If you need manual control:

```
Creative Workspace
  → Advanced Studio
  → (optional) pixel editor
```

The old editor should **never** be the default.

| Check | Pass? |
|-------|-------|
| Edit opens Creative Workspace | ⬜ |
| Conversation-first editing works | ⬜ |
| Advanced Studio is intentional, not accidental | ⬜ |
| Old editor is not the default home for edit | ⬜ |

---

## Test 4 — Chat

Click **Ask Hubly** from:

- Business Home
- Website (Creative Workspace / site context)
- Booking
- Customers
- Business Home again (not a separate “Dashboard assistant”)

Every conversation should stay in **one thread**.  
No separate assistants.

| Check | Pass? |
|-------|-------|
| Ask Hubly feels like one partner | ⬜ |
| Context carries across surfaces | ⬜ |
| No “new bot” / split-brain assistants | ⬜ |

---

## Test 5 — Build Something

Tell Hubly:

> Add arrival windows.

You should see:

```
Builder Plan → Preview → Approval → Deploy
```

Not a settings page.

| Check | Pass? |
|-------|-------|
| Hubly proposes a plan in conversation | ⬜ |
| Preview before apply | ⬜ |
| Explicit approval | ⬜ |
| No buried settings form as the primary UX | ⬜ |

---

## Test 6 — Refresh

Reload the browser halfway through onboarding or editing.

Nothing important should disappear. Everything resumes.

| Check | Pass? |
|-------|-------|
| Mid-Welcome / Discovery refresh recovers | ⬜ |
| Mid-build / mid-home refresh recovers | ⬜ |
| No blank dead-end | ⬜ |

---

## Test 7 — Mobile

Repeat the journey on a phone.

It should feel like the **same product** — conversation-first everywhere.

| Check | Pass? |
|-------|-------|
| Welcome usable on phone | ⬜ |
| Discovery → Home completable on phone | ⬜ |
| Creative Workspace conversation-first on phone | ⬜ |
| No “desktop-only old dashboard” trap | ⬜ |

---

## Test 8 — Speed

Measure (stopwatch is fine):

| Metric | Target feel | Yours | Pass? |
|--------|-------------|-------|-------|
| Time to first conversation | Immediate — type within seconds | _____ | ⬜ |
| Time to first preview | Feels alive, not stuck | _____ | ⬜ |
| Time to Business Home | Full journey feels worth it | _____ | ⬜ |

If it is **noticeably slower** than the old product, optimize before Milestone 3.

---

## After Phase E passes — dead code discipline

Do **not** mass-delete yet. Use the inventory:

**[`MILESTONE25_DEAD_CODE_INVENTORY.md`](./MILESTONE25_DEAD_CODE_INVENTORY.md)**

For every old-only file/symbol:

| Mark | Meaning |
|------|---------|
| **Delete** | Safe to remove after Phase E (callers gone) |
| **Archive** | Demote / keep off primary paths |
| **Still Required** | Auth, Advanced Studio, ops — keep |

Produce / update that report **before** deleting anything.

---

## Founder Certification (sign-off)

I personally completed Tests 1–8 on **live hubly.app**.

A brand-new customer can go from hubly.app to a fully launched business without ever realizing there was an old product.

| Field | Value |
|-------|-------|
| Founder name | |
| Date (UTC) | |
| Production URL verified | `https://hubly.app` |
| Deploy / commit SHA | |
| Cutover Report | all rows green — [`MILESTONE25_CUTOVER_REPORT.md`](./MILESTONE25_CUTOVER_REPORT.md) |
| Signature | ☐ I certify Phase E PASS |

**Until this block is signed, Milestone 2.5 is not complete — regardless of CI.**
