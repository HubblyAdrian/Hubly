# Outstanding OWNER verifications — things Claude Code structurally cannot do

**These are Adrian's, recorded 2026-09-17 so they survive a context loss.** Every one exists because a
standing rule stops the session doing it, not because it was forgotten or deferred. **A rule beats an
instruction; stopping was correct.** Until each is done, the thing it covers is UNVERIFIED — not
broken, not fine, unverified — and nothing in this repo may report it as proven.

---

## ✅ 5.1 — CLOSED 2026-09-18. Adrian signed in and looked.

**BOTH LIVE BUGS CONFIRMED FIXED ON A REAL SESSION** — real RLS, real business
(`hubly-classic-fixture`), real authenticated load:

- **BUG 1 — the first paint.** `hc-boot-owner` is on `<html>` on an authenticated load. **No landing
  paint.**
- **BUG 2 — a conversation per tab.** The Website tab shows its own conversation: *"This is a separate
  conversation, just about Website. Your main chat is on Home."* **Home's chat is not in it.**

**THIS IS THE FIRST EVIDENCE IN THIS ENTIRE EFFORT FROM THE SURFACE A PERSON ACTUALLY TOUCHES.** Every
browser leg I ran used the declared fake in `scripts/lib/owner-rig.mjs` — real code paths, but no RLS,
no session, no real JWT (limit 2 in that file's own header). Two things follow and both matter:

1. The fake's green legs were not wrong, and they were not sufficient. They said the code does the
   right thing against a declared world. They could not say the world is that.
2. **The three rows below that these two closures cover are now LIVE-CONFIRMED** in
   `docs/UNCONFIRMED_AGAINST_A_LIVE_SURFACE.md`: the first paint and the tab conversations move out of
   RIG-MEASURED. What is still unconfirmed there is everything else, and the list says which.

The section below is kept as the record of what was unverified and why, because the reasoning is what
made the gap findable — not because it is still open.

## 5.1 (the original entry, kept as the record) — Sign in, go to `#website`, refresh

**Why nobody else can do it.** *"Never create an account, never enter a password."* Every browser leg
in the 2026-09-17 rounds ran against the declared fake (`scripts/lib/owner-rig.mjs`), which has **no
RLS, no real session and no real JWT**. The fixture's own header lists that as limit 2.

**What is unverified until he does it** — three things shipped and confirmed in the served bytes, none
of them exercised with a real session:

| shipped | what a real session would prove |
| --- | --- |
| **Bug 1 — the first paint** (`hc-boot-owner`, set in `<head>` from the supabase session in localStorage) | that a REAL session's stored shape is what `HublyBoot.isAuthed()` reads. The fake writes a two-field object; a live supabase session has more, and only the real one settles it |
| **Bug 2 — a conversation per tab** (`hcRenderHome` refuses to paint into another tab; the place loader re-checks after every await) | that `ask_hubly_conversations` / `ask_hubly_messages` are readable and writable **under real owner RLS**. The fake returns whatever it is asked for, whoever asks — the claimed-owner write audit exists for exactly this class |
| **The tab offer** (`hc._tabOfferShown` is per place now, not one boolean per sitting) | that `add_business_place` accepts the real `p_owner_id` from a live JWT, and that the rail repaints for a signed-in owner |

**The exact steps:** sign in · navigate to `#website` · refresh. Watch for (a) any frame of the
landing page — there must be none; (b) the Website tab's own conversation surviving the load — Home's
greeting must not replace it; (c) asking for My Day, accepting the tab, then asking for Jobs in the
same sitting — **both** must be offered.

## 5.2 The pending booking on `adrians-lawn-service`, fired 17:54:32Z

**Adrian presses ACCEPT.** The endpoint (`accept-booking`) is deployed and calls the shared
`createJobFromBookingRequest` writer; nothing about it has been exercised with a real owner JWT.
Report nothing about this booking until he says what happened.

## 5.3 Mobile — the 5th place on a phone

**Why nobody else can do it.** *"Claude Code cannot verify mobile."* There is no true 390px viewport
and no soft keyboard in this environment.

**Why it is newly at risk.** Prohibition 5 caps the phone's bottom bar at 4 places. Until 2026-09-17
`hc._tabOfferShown` was a single boolean, so **at most one place could enter the rail per sitting** —
which made a 5th place practically unreachable. That is fixed, so a 5th place is now reachable in one
sitting, and the overflow ("More") has never been exercised on a real phone with a real 5th place.

**What to check:** earn five places, on a phone. The bar shows 4 and a way to the rest; positions do
not reshuffle; the 5th is reachable and announced rather than silently absent.

---

## Build items named rather than guessed at

These are not verifications — they are things a session deliberately did NOT build because the
alternative was shipping something unverifiable.

- **A working email call-to-action on a full-document page.** `hubly_contact.ts` and the classic
  hero/footer no longer emit `mailto:` (ruled 2026-09-17: fix the writer, keep the ban). The freeform
  equivalent is `<a href="hubly:contact">`, bound by `wireHublyDocumentReserved` **inside
  `#hc-doc-root` only** — so it is live on a mounted AST document and **dead inside the
  full-document iframe renderer**, which is how three of the four patched pages are served. Until the
  iframe path binds the scheme (or stops being used), those pages carry the address as text and no
  email CTA. Shipping a CTA that works on one renderer and silently does nothing on the other is
  worse than the mailto it replaced.
- **`json_schema` + `strict`.** Ruled: collect the baseline first.
  `scripts/check-baseline-before-schema.mjs` fails if anyone flips it while
  `document_generation_events` holds no usable `json_object` baseline. Its `[SHAPE]` leg "the baseline
  is being collected at all" is **RED on purpose today** — the table has zero rows because no page has
  been generated since it was created. It goes green on the first build. That is a named deliberate
  red, in `docs/CHECK_TRIAGE_20260917.md`.
## 5.4 Stripe's webhook delivery log — has `stripe-webhook` ever run?

**Adrian's, 2026-09-18.** Unanswerable from this repo and the database, and the reason is worth keeping
rather than re-deriving: every table `stripe-webhook` writes has other writers
(`stripe_connect_accounts` 6, `booking_requests` 3, `marketplace_bookings` 3, `commerce_orders` 3), so
rows prove nothing about *that* function, and no invocation log is reachable —
`supabase functions list` returns a DEPLOY time, not a call count. `commerce_orders` holds 2 rows and
both are still `pending`, which is suggestive of a webhook that never fired and is not evidence.

**Stripe's own webhook delivery log is the only place the answer lives.** After the 2026-09-18 quoting
fix in the orphan sweep, `stripe-webhook` is one of only THREE edge functions with no caller anywhere
in `public/`, `api/`, cron or a migration — the other two are `commerce-merchandising` and
`mission-control`.

## 5.5 GRAEF'S EXTRA CONTACTS — and the finding changed shape overnight

**Adrian is asking Graef whether he meant to publish these.** The exact values, so they are in front of
him when he asks:

| on his page / in his record | value |
| --- | --- |
| phone, **on his record** | `661-546-2662` |
| phone, also present | `661-493-5289` |
| phone, also present | `661-717-2773` |
| email | `kurash448@gmail.com` |
| email | `lhgraef5@gmail.com` — carries his surname |
| email | `austinjgraef@gmail.com` — carries his surname |

**AND THE 2026-09-17 FRAMING OF THIS WAS WRONG, which changes the question he should ask.** It was
reported as *"his live page carries two extra phone numbers and three personal gmail addresses"*. On
2026-09-18 they were located: they are **three lead records at `meta.pipeline.manual`**, each with a
name, a phone and an email. The classic renderer does not render `meta.pipeline`, so **they are
probably not on his page at all** — they are his own leads, correctly stored.

So the question is no longer "did you mean to publish these". It is **5.6**.

## 5.6 THE ANON READER RETURNS THE WHOLE `businesses` ROW — including that lead list

**What would make this wrong, first.** `get_public_business(slug)` is `SECURITY DEFINER`,
`EXECUTE`-granted to `anon`, and its body is `select to_jsonb(b) - 'draft_token' from public.businesses b
where b.slug = p_slug and b.owner_id is not null`. That is conclusive about **what the function
returns**. It is **NOT** an executed unauthenticated request: making one needs the anon key, and a key
may never reach a command line or a transcript. **That last link is Adrian's to close**, and until he
does, this is "the grant and the body say so", not "I fetched it".

**What it means if it holds.** Every column of `businesses` is public for any CLAIMED business —
including `meta`, and `meta.pipeline.manual` is a lead list. Measured 2026-09-18, counts only, no
values printed: **`graefs-autocare` (market, claimed) has 3 lead records each carrying a name, a phone
and an email**; `adrians-lawn-service` (test, claimed) has 2. Those are the six values in 5.5.

**AND IT IS NOT JUST A NAME AND A PHONE.** The check reports FIELD NAMES (never values). Each of
Graef's three records carries: `name`, `phone`, `email`, `address`, `messages`, `lastMessage`, `notes`,
`notesList`, `activity`, `appointments`, `tasks`, `estimate`, `estimatedValue`, `service`, `source`,
`stage`, `status`, `crmStatus`, `quoteStatus`, `jobStatus`, `tags`, `followUpAt`, `lastContacted`,
`aiScore`, `aiQualified`, `buyingIntent`, `lostReason`, `isReturning`, `isMembershipSignup`. **That is
his whole CRM record for those three people, including the message history and his own notes.**

**And the shape is the problem, not the column.** `to_jsonb(b)` means a column added next month for
something else is public the moment it exists. Nobody has to make a mistake for the next leak.

`scripts/check-no-public-reader-leaks-contacts.mjs` is RED on this today and prints no values. The fix
is a ruling — narrow the reader to the columns a public page actually needs — and it touches a live
reader used by ten market businesses, so it is not something a session should choose alone.

- **`stripe-webhook`: has it ever run?** Unanswerable from here. Every table it writes has other
  writers (`stripe_connect_accounts` 6, `booking_requests` 3, `marketplace_bookings` 3,
  `commerce_orders` 3), so rows prove nothing about *that* function, and no invocation log is
  reachable (`supabase functions list` gives a deploy time). **Stripe's own webhook delivery log is
  the only place the answer lives**, and Adrian is the one who can open it.
