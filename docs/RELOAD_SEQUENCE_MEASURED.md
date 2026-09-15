# E — what a reload actually shows, with timings

**Measured 2026-09-15 against the live page at `https://myhubly.app/`. Nothing changed.**

> "every refresh renders the landing page is that because its a test account or what?" — Adrian

**It is not the test account.** The hypothesis in the master list is confirmed, and the mechanism is
narrower than "the shell is display:none until something activates it" — it is a **chain that cannot
start until a third-party CDN responds.**

## The visibility timeline (signed out, live page, instrumented before any script ran)

| | |
|---|---|
| **10 ms** | nothing visible yet |
| **67 ms** | **landing visible** (`section.hero`, 791 px), `#hcApp` hidden |
| … | no further state change |

## The network sequence that gates the app

| at | event |
|---|---|
| 3 ms | request `myhubly.app/` |
| **313 ms** | HTML arrives |
| 320 ms | `supabase-js@2` requested — **from `cdn.jsdelivr.net`, a third-party CDN** |
| **430 ms** | `supabase-js` arrives. **Before this instant there is no auth client, so the page cannot know whether anyone is signed in.** |
| 439 → **601 ms** | `/api/draft-session` (162 ms) |

Total network events for the whole boot: 14.

## Why the landing wins, in four measured facts

1. **The landing is unconditional static markup.** As served: `<section class="hero" id="top">` — no
   gate, no class, nothing to wait for. It paints as soon as the HTML does.
2. **The app is opt-in via CSS:** `.hc-app.is-active{display:flex}`. It appears only once JS adds
   `is-active`.
3. **The landing is hidden only by JS too:** `body.hc-active .hero{display:none}`.
4. **`supabase-js` is `<script defer src="https://cdn.jsdelivr.net/...">`.** Auth cannot be
   consulted before it resolves — 430 ms here, on a warm connection, from a machine on good
   bandwidth.

So the order is forced: **paint the marketing page, fetch a library from someone else's CDN, then
ask who this is, then hide the marketing page.** A signed-in owner sees the public landing for the
whole of that.

## How long the flash lasts

**Lower bound, measured: ~0.6 s** — 430 ms before an auth client exists, plus the one round trip I
could measure (162 ms). A real owner's reload adds a session read, an identity load and a business
load on top, so the true figure is higher.

**I cannot give the real number.** There is no authed session in this environment, so the
signed-in reload itself is unmeasured. What is measured is the part that is identical for everyone:
nothing can hide the landing until 430 ms at the earliest.

## What I checked and did NOT find

**There is no pre-paint signed-in hint in use — zero occurrences.** Nothing reads a cached marker
before the first paint to decide what to show.

Two synchronous signals *are* already in `localStorage` and are readable before paint:
`hubly_account_claimed` and `hcLastBusiness`.

**But neither proves a live session**, and this is the part that matters for the fix: an expired or
revoked session leaves both keys in place. Gating the *app* on them would show a signed-in shell to
someone who is signed out — a checkmark we did not earn (prohibition 2). They are sufficient to
**suppress the landing** and show a neutral boot state; they are not sufficient to **assert
signed-in**. Those are different claims and the fix has to keep them apart.

## What this does not tell us

- **The real duration for a signed-in owner.** Needs a session; not available here.
- **Mobile.** No 390 px viewport and no soft keyboard in this environment. On a phone, on a cold
  connection, the CDN leg is the one that gets worse — but that is reasoning, not measurement.
- **Whether jsdelivr is ever slow or unavailable in practice.** One sample, one location.
  A CDN on the critical path for "who is this person" is a dependency worth knowing about
  regardless of today's number.

**And a note on when this was measured:** the database was in a scheduled maintenance window
(`503`, completion 21:45 Z) earlier in this session. I waited for it to close rather than publish
timings that described an outage. These numbers are from 22:1x Z, after it cleared.

**Adrian has walked none of today's work** since the envelope fix went live.
