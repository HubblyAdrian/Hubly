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

## Working agreement (how work is run here)

- **Verify by using it, not by reading it.** A change isn't done because the code
  looks right; it's done when the running product was exercised and did the thing.
- **Claude Code cannot verify mobile.** There is no true 390px viewport and no soft
  keyboard in this environment. Anything mobile must be checked on a real phone before
  it is called done.
- **Measure before fixing when a failure is unnamed.** Don't mask a bug with a fix
  before there's evidence naming which bug it is.
