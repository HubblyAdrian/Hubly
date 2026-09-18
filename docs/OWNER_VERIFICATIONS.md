# Outstanding OWNER verifications — things Claude Code structurally cannot do

**These are Adrian's, recorded 2026-09-17 so they survive a context loss.** Every one exists because a
standing rule stops the session doing it, not because it was forgotten or deferred. **A rule beats an
instruction; stopping was correct.** Until each is done, the thing it covers is UNVERIFIED — not
broken, not fine, unverified — and nothing in this repo may report it as proven.

---

## 5.1 Sign in, go to `#website`, refresh

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
- **`stripe-webhook`: has it ever run?** Unanswerable from here. Every table it writes has other
  writers (`stripe_connect_accounts` 6, `booking_requests` 3, `marketplace_bookings` 3,
  `commerce_orders` 3), so rows prove nothing about *that* function, and no invocation log is
  reachable (`supabase functions list` gives a deploy time). **Stripe's own webhook delivery log is
  the only place the answer lives**, and Adrian is the one who can open it.
