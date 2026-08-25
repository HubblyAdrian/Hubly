# Hubly — standing rules

These are hard prohibitions, not preferences. They exist because each one was paid
for by a real failure that shipped while reporting success. They bind every session,
including ones that never saw the conversation that produced them. Phrased as
prohibitions on purpose: when in doubt, the prohibited thing is prohibited.

## The six prohibitions

1. **No cleanup, validation, or post-processing pass may ever cause a second
   generation.** A pass that strips, stamps, collapses, labels, or repairs the model's
   output runs once and never triggers the model again. Regenerating to "fix" what a
   deterministic pass found is forbidden — it doubles cost, changes the page out from
   under the person, and hides the original defect.

2. **A status indicator may not show success unless that surface confirmed it. No
   green by default.** A checkmark, a "Signed in", a "Saved", a build step turning
   green — none of these may appear on the assumption that the step worked. They
   appear only after the surface they describe reports back that it did. Green is
   earned, never the default state.

3. **No step may assume a previous step succeeded. Assert the postcondition or fail.**
   Every link in a chain checks its own postcondition and fails loudly if it isn't
   met. After verify: a session exists AND reads back from storage. After claim:
   `owner_id` is actually set to this `auth.uid()`. After a load: a row actually came
   back. Falling through to a neutral screen (the chat, a blank state) is never an
   acceptable failure mode — that is precisely what makes a broken step invisible.
   Every distinct failure gets a distinct, human message; never "something went wrong."

4. **The interface may not change shape silently.** Anything that appears in or
   disappears from navigation is announced — never a control that silently shows up,
   vanishes, or relocates between states.

5. **A place appears in navigation only once the business has earned it — on every
   device; positions are stable and never reshuffle.** The earned-only rule is
   universal: desktop does not get to show empty rooms just because it has the space.
   Once a place has a position it keeps it — navigation never reorders by frequency,
   recency, or any "smart" signal. When a place goes dormant and steps out, the next
   new place takes the freed slot; the remaining items do not shift. **Mobile only:**
   the bottom bar holds at most 4 places. Desktop renders the same earned places as a
   sidebar list (no bar, no cap).

6. **Silence after a request is a failure mode.** If a person asked for something and
   it succeeded, they must be told. A state change the user requested may not complete
   without visible confirmation. An operation that works, updates the database, and
   says nothing is indistinguishable from one that failed — and is treated here as a
   defect of equal severity, not a cosmetic gap. Every other rule here guards against
   over-claiming success; this one guards against under-claiming it, and it is the rule
   that catches a silent success.

## The notification standard

Every Hubly notification — email, SMS, in-product, and everything after — must:

- **Name what happened** — the event, in plain words, in the subject/first line.
- **Say who it involves** — the business and/or person, not a generic "activity."
- **Link straight to the thing** — one tap to the booking, the site, the signup. If
  the recipient has to open something else to act on it, the notification has not
  done its job.
- **Never invite a reply to an address nobody reads.** A notification's call to action
  points back into the product (a link, a next step), never "reply to this email" when
  that inbox is unmonitored. A dead reply path is a promise the product silently breaks.

Two consequences that bind:
- A notification may not report a fact the system never recorded. Reporting a device,
  a source, or a count we didn't capture is the same defect as a checkmark we never
  earned (prohibition 2) — omit the field, don't approximate it.
- Delivery is best-effort; the in-product record is the source of truth. If a
  notification fails to send, that failure is visible (prohibition 6), never silent —
  and the thing it was announcing is still reachable inside Hubly.

## Hubly never points at a control it cannot see

Hubly never names or describes a UI control. It doesn't render the page and cannot know
what is on screen, so naming a button is claiming a capability it hasn't verified. It
acts, or it says what will happen — it never gives directions to something it can't see.

## Working agreement (how work is run here)

- **Verify by using it, not by reading it.** A change isn't done because the code
  looks right; it's done when the running product was exercised and did the thing.
- **Claude Code cannot verify mobile.** There is no true 390px viewport and no soft
  keyboard in this environment. Anything mobile must be checked on a real phone before
  it is called done.
- **Measure before fixing when a failure is unnamed.** Don't mask a bug with a fix
  before there's evidence naming which bug it is.
- **Hubly records what it asks for and misses what it overhears — so ask.** Measured:
  a stated fact is captured ~40% of the time when the person merely mentions it in
  passing, ~80% when Hubly asked the question first (services/prices, live test
  2026-08-23). This is a fact about the product, not about services: every fact it
  depends on — services, prices, hours, service area, phone — must be reached by an
  explicit question, never left to fall out of conversation on its own. And because
  even "asked" leaves ~1 in 5 uncaptured, the ask is not done until the capture is
  confirmed (read it back, or detect the miss and ask again) — silence is not success.
- **A category that describes people may not default to the flattering value.** When the
  system cannot know who someone is, it must say it doesn't know and ask Adrian — never
  guess the answer that makes us look better. `account_kind` defaulted to 'real' and cost a
  week; the claim trigger then silently promoted unrecognized signups to 'market' — the same
  bug one level up. The honest value is the default; confirmation is the manual action, not
  the reverse (see `owner_identified`, migration `20260825130000`).
- **Design sweeps run over every page; user/value numbers filter to MARKET.** A broken
  layout is broken regardless of who made it — so layout/quality sweeps run over all
  generated pages. But `account_kind` has three values — **test** (our drafts), **internal**
  (founders, us, family), **market** (a genuine outside business) — and any number that
  describes users, adoption, or value filters `account_kind = 'market'`, stating the
  denominator every time. Not 'real': "not a test draft" still includes us and our
  families, and reading it as "the market" is how a week of priorities came to rest on a
  corpus that was ~93% test with a market N of 7. A ratio without a denominator is a claim
  we can't check.
- **Don't ship copy that offers an action until a working path to it has been tested end
  to end.** On 2026-08-23 we deployed "drop a screenshot of your price list" while the
  attach button was broken and paste was unwired. This is the same failure as naming a
  control that doesn't exist — the model isn't the one lying, the copy is.
- **Hubly has two deploy paths; know which one a change took.** Edge functions go live via
  `supabase functions deploy`; everything in `public/` (platform-home.html, hubly.html)
  goes live ONLY via a git push to Vercel. Never describe a client-side change as live
  until it has been pushed. When reporting what shipped, say which path each change took.
  (This two-path split — instantly-deployed server code beside never-pushed client code —
  is what masqueraded as "stale" for a whole day on 2026-08-23.)
- **Before editing a prompt to change what Hubly SAYS, confirm the model is the one saying
  it.** Some of Hubly's speech is composed CLIENT-side (e.g. the post-build follow-up in
  `hcPostBuildFollowup`, the claim card, the "reserved for you" line) — a prompt edit there
  changes a turn that never happens. Twice on 2026-08-23 a prompt was edited for words the
  client actually writes (the phantom sign-up guidance; the post-build services question).
  Tells that a message is client-composed, not model output: a fixed menu/bullets the model
  is told never to produce, slot-filled broken grammar, or a string that greps to a literal
  in `public/`. Find the source first; fix it where it's written.
- **Never reveal a live secret to the terminal.** `supabase projects api-keys --reveal` (and
  anything like it) prints a key into scrollback, shell history, and any transcript that later
  gets shared — that is exactly how a key leaked on 2026-08-25, and it nearly happened twice
  because the replacement key went through the same command an hour later. If a script needs a
  key, Adrian sets it in the environment and the script reads it from there; Claude Code never
  prints, echoes, `sed`s, or writes a key to a file. To identify a key, use its NAME and PREFIX,
  never its value (e.g. `edgefunctions202608` / `sb_secret_NmJ3E…`). A key that has appeared in
  terminal output is compromised and must be rotated — treat the appearance itself as the breach,
  before asking whether anyone saw it.
