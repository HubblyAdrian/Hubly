# Hubly — standing rules

These are hard prohibitions, not preferences. They exist because each one was paid
for by a real failure that shipped while reporting success. They bind every session,
including ones that never saw the conversation that produced them. Phrased as
prohibitions on purpose: when in doubt, the prohibited thing is prohibited.

## The five prohibitions

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

5. **Navigation is capped at 4, positions are stable once assigned, and nothing
   reshuffles on usage.** Once a nav item has a position it keeps it. Frequency,
   recency, or "smart" reordering of navigation is forbidden.

## Working agreement (how work is run here)

- **Verify by using it, not by reading it.** A change isn't done because the code
  looks right; it's done when the running product was exercised and did the thing.
- **Claude Code cannot verify mobile.** There is no true 390px viewport and no soft
  keyboard in this environment. Anything mobile must be checked on a real phone before
  it is called done.
- **Measure before fixing when a failure is unnamed.** Don't mask a bug with a fix
  before there's evidence naming which bug it is.
