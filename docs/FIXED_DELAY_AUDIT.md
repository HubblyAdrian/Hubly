# Every fixed delay between an action and its assertion — listed before any is touched

**Audited 2026-09-13, at Adrian's instruction: *"list them all before touching any, with what
each one is waiting for. Some will be legitimate; I want to see which."*** Nothing below has
been changed.

**102 hits** across `scripts/`, `scripts/lib/` and `tests/` for `waitForTimeout`, `sleep(`, and
bare `setTimeout`. They fall into five kinds, and only the last is the defect Lesson 70 names.

## A · Not a wait at all — 13 hits, no action needed

| what | where | why it is fine |
|---|---|---|
| `requestAnimationFrame: (fn) => setTimeout(fn, 0)` | `cmv-locked-modules:223`, `mat-ask-hubly:200`, `mat-leads:221`, `mat-jobs:248`, `mat-marketing:211`, `mat-reports:212`, `mat-pipeline:222`, `mat-revenue:196`, `mat-storefront:218`, `mat-settings:207`, `mat-customers:308`, `mat-memberships:199`, `mat-reviews:202` | a **polyfill shim** for a Node/JSDOM mount. It is not waiting for anything |

## B · The thing under test — 2 hits, deliberately present

| what | where | why |
|---|---|---|
| `setTimeout(…,250)` / `setTimeout(…,1200)` inside the served fixture | `check-browser-rig.mjs:45-46` | **the trap the rig is tested against.** A value with a slow second act is the whole point |

## C · Watchdogs and human pauses — 3 hits, legitimate

| what | where | waiting for |
|---|---|---|
| global kill-switch | `check-customer-journey-os:18` | the script's own ceiling, not an outcome |
| `waitForTimeout(210000)` / `(45000)` | `walk-signup-in-browser:66,100` | **a human** walking the signup by hand. Not an assertion |

## D · Polls and backoff — 9 hits, legitimate (they re-read)

| what | where | waiting for |
|---|---|---|
| `for (i<12) { sleep(700); metaB = await readMetaB(); }` | `tests/storefront_three_configs:76` | a **poll with a re-read** — the correct pattern, just hand-rolled |
| retry backoff between attempts | `lib/reliability:193,223,605,646,654,662` | each is followed by a re-check |
| `sleep(40)` / `sleep(80)` inside a scan loop | `lib/quality-core:557`, `check-section14:105` | yielding between items, not awaiting an outcome |
| `setTimeout(r,20)` between mounts | `mat-leads:394`, `mat-jobs:541,545,551` | letting a synchronous mount flush; no assertion reads across it |

## E · **A fixed delay standing between an action and its assertion — 38 hits, all suspect**

These are Lesson 70's defect. Each encodes a guess about duration into a result that reads like
an observation, and **the guess is invisible in the output**.

| where | after what action | asserted immediately after | the guess |
|---|---|---|---|
| `check-walk-assertions:185` | `goto(bookHref)` | booking-landing name + text | **3500ms** |
| `check-walk-assertions` (fragment click) | `a.click()` | did the page scroll | **already fixed tonight — now settles** |
| `check-block-legibility:87,89` | mount, then `scrollIntoView` | pixel contrast of the block | **250ms ×2** |
| `check-graefs-page:191` | `waitForFunction(.page.active)` | the whole page snapshot | **4000ms** |
| `check-name-is-asked:145,243,339` | a sent chat message | what Hubly replied | **5000 / 1500 / 1000ms** |
| `shot-owner-home:155,288` | `renderHome()` / a render | layout assertions | **350 / 300ms** |
| `shot-owner-home:393` | a resize | measured box | 30ms |
| `shot-owner-rooms:188,196,250` | render / nav click | layout assertions | 250 / 300 / 220ms |
| `mat-*:350-ish` (11 files) | a mount + render | screenshot + assertions | **300-350ms each** |
| `lib/mount-as-product:76,94,98` | mount, render | whatever the caller asserts | 300 / 400 / 300ms |
| `smoke-instant-site:22,46,63,135,170` | chip click / fill / send | next-step visibility | 200-400ms |
| `e2e-booking-wizard:26,48,61,130,209,226,256` | fill + send, step clicks | next step present | 200-600ms |
| `e2e-quote-booking:` 15 hits | same shape | same | 200-800ms |
| `screenshot-booking-wizard:22,79,92,105` | navigation / step | the screenshot | 800-1200ms |
| `screenshot-settings:45,94` | navigation | the screenshot | 500 / 900ms |
| `tests/storefront_three_configs:49` | `goto` | page content | 3500ms |
| `tests/storefront_build_surface_choice:26,47` | click | next state | 300ms ×2 |

### What I would do, and in what order

**Not all 38 are equal, and the screenshot ones barely matter** — a screenshot taken 200ms early
is a worse picture, not a wrong number. The ranking is by *what a wrong reading would have cost*:

1. **`check-name-is-asked` (3 hits)** — it asserts what Hubly SAID after a real model turn, and a
   model turn has no fixed duration. A 1000ms wait on a slow turn reads an empty thread as a
   missing question. This is the one that can produce a confident wrong claim about behaviour.
2. **`check-block-legibility` (2)** — 132 blocks, contrast in pixels, and its own comment records
   that an earlier version measured 117 of 132 in the wrong place. A 250ms guess after
   `scrollIntoView` on a page with smooth scrolling is exactly Lesson 69's shape.
3. **`check-walk-assertions:185` and `check-graefs-page:191`** — 3500ms and 4000ms are generous
   enough to be usually right, which is worse than usually wrong: they will fail on a slow day
   and the failure will look like a product defect.
4. **The `e2e-*` and `smoke-*` flows (27)** — each `sleep` is "wait for the next step to appear",
   which is `waitFor(selector)`, which Playwright already does properly. Mechanical to convert.
5. **The `mat-*` and `shot-*` renders (16)** — synchronous renders where 300ms is almost
   certainly enough. Lowest value, highest count; convert last or leave with a comment.

**Nothing touched.** The rig (`scripts/lib/browser-rig.mjs`) is the replacement for kinds 1-3;
kind 4 wants `waitFor`, not the rig.
