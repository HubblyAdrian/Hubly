# Establish pass — the revised plan (2026-09-13)

Walked in a real browser before anything was read in the code. **My test business:
`payson-chimney` (created as `site-f05bd8`), one generation, "i do chimney sweeping in payson
utah" → named → 3 services → hours → photo ask.** Not Adrian's. Nothing was submitted on any
business of his; the booking walk below is read-only and no booking was completed.

---

## 1. `?book=1` — THE MAP

**What renders it.** `public/hubly.html`. The deep link is decided at load
(`hubly.html:18319-18375`): `wantsBooking = q.get('book')==='1'`, refuse if no business
(the S1.4 guard), hydrate services, then open. **Two different surfaces live behind it:**

| | what it is | where |
|---|---|---|
| **the wizard** | 4 steps — Package / When & where / Your info / Review — `submitBooking()` | `#bk-step-1..4`, `hubly.html:12559+`, submit at `:43101` |
| **the second website** | hero, nav (Services/Reviews/About), BOOK NOW + VIEW PACKAGES, its own chat input, "Powered by Hubly", a Window Services section | `renderThemedBookingLanding()` `:33344`, painting `#bkland-*` `:12492-12509`, shell `applyThemedBookingShell()` `:33282` |

**CONFIRMED BY CLICKING, and the route is worse than reported.** On
`crestview-window-cleaning`, clicking **Book** goes straight to the WIZARD (not the landing) —
so the second website is not what a first click shows. It is what the wizard's own **"← Back"**
shows: pressing it leaves the customer on the impostor site, still at `?book=1`, with the
business's name on a page that looks nothing like the one they were reading. The BROWSER back
button, by contrast, works correctly and returns to the real site with `?book=1` dropped.
**So the back-button defect is in the app's own Back control, not in history.**

**The load-bearing part the panel reuses:** `submitBooking()` (`:43101`) → `complete_abandoned_booking`
RPC, falling back to a direct `booking_requests` insert (`:43334`); plus
`writeAbandonedBookingRequest()` (`:42292`) which turns an abandoned booking into a lead, and
`persistBookingSmsConsent` / the consent-field helper at `:42268`. All of that is inside the
WIZARD and independent of the landing. **The landing is decoration; the wizard is the product.**

**Everything that routes there:** the runtime stamps `/?book=1` into generated pages
(`hubly_page_runtime.ts:583`, relative by design since S1.3) — **507 links across 162 of 172
stored pages**; `hubly-conversation/index.ts:1902` rewrites booking links on the page;
`platform-home.html:1968` opens it for the owner's "Preview booking"; and
`hubly_capability_registry.ts:3844` strips such links when composing.

**What breaks if it stops being customer-reachable:** every one of those 507 page links, the
owner's Preview-booking control, and any email/SMS/QR pointing at `?book=1`. **A URL must keep
working** — which is the ruling anyway: same address, page opens with the panel up.

**Defects seen in the wizard itself, in the browser:** the "🌙 Night" theme pill overlaps and
clips the "Save & exit" button; the "Booking summary" heading is crowded by its own calendar
glyph; all three package cards show empty grey image tiles.
Screenshots: `screenshot-1789267570730-11.png` (Night/Save & exit), `-12.png` (Booking summary).

---

## 2. THE CLAIMED SHELL — cause found for the missing site; Jobs/Customers half-established

**The site disappearing at claim is TWO CSS RULES, not a missing feature.**
`platform-home.html:283` — unclaimed with a draft: `.hc-app-right{display:flex;flex:1 1 70%}`,
the preview on the right. `:290-294` — claimed **and** `data-mode="home"`:
`.hc-app-right{display:none}` and the thread widens to 720px centred. Claim flips
`.hc-claimed` and the mode defaults to `home`, so the pane the owner has been watching for ten
minutes is hidden by rule. Nothing was deleted; a selector hides it.

**Jobs / Customers / Planner are built in `platform-home.html`:** `HC_ROOMS` at `:4858`
(`hcRenderPlanner :4661`, `hcRenderJobs :4767`, `hcRenderCustomers :4796`), reached by
`hcOpenWorkspace()` `:4869`, and the CSS for `data-mode="planner|jobs|customers"` shows the
right pane (`:303-307`). `HC_PLACE_SURFACES` `:4404` lists all four as real surfaces.
**Two candidate causes for "nothing changes", both visible in code:** `hcRenderRoom()` clears
`#hcCanvas` and returns early unless `hc.draftClaimed` and a business are both present
(`:4863`); and `hcSetView()` is only ever called with `'site'` (`:1797, 1809, 2562, 4185, 4282,
4890`) — no room sets a view. **NOT YET CONFIRMED IN THE BROWSER** — see the block below.

---

## 3. WHAT I COULD NOT REPRODUCE, AND WHY

**Claiming.** Creating an account means entering a password, which I must not do. So
everything behind claim — the rail, the missing site pane, Jobs/Customers, the preview
toolbar overlap — is established **in code only** and is NOT browser-confirmed by me. To close
that gap I need either Adrian to claim `payson-chimney` (it is mine, built for this) and leave
the tab open, or an already-signed-in browser profile. **I am not reporting those four as
reproduced.**

---

## 4. CONVERSATION SCOPING — the gap is exactly where it was predicted

`business_conversations` is `id, business_id, seq, role, content, created_at`. **There is no
surface, tab, or context column.** One stream per business, ordered by `seq`. The client sends
no tab notion (`platform-home.html` has no `context:` in its send payload); the edge function
reads `body?.context` (`hubly-conversation/index.ts:1077`) but only as
`customer|operate|dashboard`, caller-declared, and `check-owner-id-invariant.mjs` already
records that it proves nothing and no access decision may be made from it.

**So Home-shows-everything is not a bug, it is the only view the data supports.** A tab view
requires labelling every turn AT SEND TIME; Home then stays the union and each tab is a filter.
No backfill is possible for existing turns — they are genuinely unlabelled, and the honest
default for history is Home.

---

## 5. THE NINE-STEP FLOW — walked, per step

| step | state | evidence from the walk |
|---|---|---|
| 1 build from a description | **built** | one sentence → full page, slug `site-f05bd8` |
| 2 ask claim-or-services | **absent** | it asks *"What's the business called?"* instead |
| 3 services added | **built** | 3 services, prices, placed; reply named them |
| 4 tell them it is done | **built, but doubled** | TWO Hubly messages in the same beat — a bare `"Chimney sweep $189, cap install $240, creosote removal $320."` then the composed reply. Two composers in one beat is already forbidden in CLAUDE.md |
| 5 ask for hours | **absent** | never asked; I had to volunteer them |
| 6 hours done | **built** | "Done — I added your hours on your page." Adrian's "schedule looks better now" holds on a fresh page |
| 7 ask for photos | **absent as an ask**, reachable as an answer | it never offered; asked directly, it said *"send me one photo … and I'll put it on the page and tell you exactly where it landed"* |
| 8 move photos on the page | **NOT FOUND** — no drag affordance seen pre-claim; unverified post-claim (see §3) |
| 9 ask them to claim | **partial** | a "Create your account" card appeared after the name, not after photos |

**The attach path exists but is not discoverable:** the composer's only glyph is a four-pointed
sparkle whose accessible name is "Attach a photo or file". It reads as a decorative AI star.
An owner told "send me a photo" has to guess.

---

## 6. WHAT RECORDS COMPLETION STATE TODAY

Nothing found that tracks per-business step completion. What exists is adjacent and partial:
`rebuild_outcome_events` (what a placement did), `businesses.meta`, the `services` /
`settings_business_hours` records themselves, and the client's `hc.*` in-memory flags
(`hc.postBuildTurns`, `hc.accountOfferHeld`) which are per-session and die with the tab.
**An internal checklist as specified needs a durable per-business record that does not exist.**

---

## 7. SMALLER DEFECTS — reproduced, plus two new ones

- **Dead hero CTAs, third and fourth instances.** On crestview, `See what we clean` does
  nothing when clicked; so does the header's `Services` link (that page is one of the 18
  whitespace-refused, so it has no fragment handler). Adrian's `See what to send` and `See how
  the quote works` are the same pattern.
- **NEW — "Payson, Utah, Utah".** The contact block on my page composes city + state where the
  city already carries the state. Visible on the live page footer.
- **NEW — a fact named that I never gave.** I typed a business NAME; the reply was *"Done — I
  added your address on your page, in the Hours & Contact section."* Address was never
  discussed in that turn.
- **The build card shows five green checkmarks** — Understanding, Writing, Adding photos,
  Setting up booking, Finishing touches — while the pane still reads "Loading your site…".
  Green before the thing it describes has reported back is prohibition 2; needs checking
  against what each tick actually knows.
