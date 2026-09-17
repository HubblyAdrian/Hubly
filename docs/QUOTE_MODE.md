# Quick Quote as a MODE — visible, leaveable, and it never starts by accident

**Status:** the mode is built and checked, 2026-09-16. `npm run check:quote-mode`
**Ruling:** Adrian, 2026-09-16. **The quote itself is item 5 and is not in this file.**

> "He says 'quick quote' and the AI becomes a quoter in the chat. VISIBLE · LEAVEABLE (say so, or
> finish a quote) · NEVER SILENTLY SWALLOWS a message meant for something else · 'can you quick quote
> this?' mid-conversation must not fire it by accident. **RED-PROOF THE 'THIS IS FINE' DIRECTION — a
> false start while he is on the phone with a customer is worse than a missed one.**"

## That last sentence decided the design, and it removed the need for a heuristic

| act | how it is triggered |
|---|---|
| **ENTERING** — valuable and dangerous | **only when the whole message IS the command.** A command legitimately is a closed set: `quick quote`, `new quick quote`, `start a quote`, `quote`, `quickquote`… anchored at both ends. |
| **OFFERING** — harmless | **any other mention.** A real button, and the message still gets its normal answer. |

This **inverts** the usual shape of the standing *enumerate-the-harmless-side* rule, and deliberately.
Usually the expensive error is missing a fact, so the open-ended side is the valuable one. Here the
expensive error is **acting**, so the list we keep closed is the acting one and everything else asks.
An unnecessary offer costs one line of chat; a false entry costs him the thread while a customer is
on the phone.

The alternative — a list of phrasings that "mean he wants to start one" — is the list we have
watched undercount four times. It would have undercounted here too, except the cost of the miss
would have been a derailed conversation rather than a lost fact.

**Fifteen sentences that must not start it** are in the check, including *"can you quick quote
this?"*, *"I sent him a quick quote yesterday"*, *"what is quick quote?"*, *"don't quote him yet"*,
*"the quote was too high"*, *"quote the driveway at 180"*. None of them fire.

## The offer is additive, never a redirect

"can you quick quote this?" is still a sentence he expects an answer to. So the mention **queues**
an offer, the normal turn produces its reply, and the offer lands after it — through the same
one-ask-at-a-time discipline everything else uses (`hcAskOnFloor`, and the turn must not have ended
in a question of ours). Two composers speaking in the same beat read like two people talking over
each other, which is the 2026-08-26 defect.

The offer is **refused outright** while one of our own questions is unanswered.

## Visible

A chip above the composer: **`Quick Quote` · say "never mind" to leave · [Leave]**. Same visual
family as the selection chip, because it is the same kind of thing — a piece of state attached to
what you are about to type — and **the way out is a control beside the name, never a hidden gesture**.

It is **absent**, not empty, when there is no mode: an empty visible row reads as something loading.

Entering also **says so in words**, and says how to leave. A mode is the biggest shape change there
is — it changes what the next thing you type means — so prohibition 4 applies at full strength.

## Leaveable, two ways, and it says so

- Say it: `never mind`, `nevermind`, `forget it`, `cancel`, `stop`, `quit`, `exit`, `leave`,
  `no thanks`, `not now`, `done` — one list shared by every mode, because a mode with its own private
  way out is a mode he has to learn twice.
- Press **Leave** on the chip.

Either way it says **"Out of Quick Quote. Nothing was saved."** — because nothing was.

## It never silently swallows

While in the mode, a message that plainly means something else gets **one question and two real
controls**:

> You're in Quick Quote, so I didn't take that as "Your jobs". Do you want me to leave Quick Quote
> and do that instead?  **[Leave Quick Quote] [Stay in Quick Quote]**

`hcMeansSomethingElse` is **derived** from the registries that already exist — `HC_THREAD_VIEWS`'s
own trigger words, `HC_SHOW_PAGE_RE` — so a capability added later is protected without anyone
remembering to add it to a list here. A message the mode has nothing to say about **falls through**
to the normal turn.

**One bug the red-proof found in that guard:** the prefix group was a single optional alternation, so
it matched "show me jobs" and "my jobs" but **not "show me my jobs"** — two prefixes in a row, which
is how a person actually types it. The commonest phrasing went straight through to the quoter.

## Every way in that honestly exists, derived

`hcModeWays(key)` asks the code rather than listing:

| way | wired when |
|---|---|
| say it | there is an entry pattern and the composer routes through `hcSendText` |
| press the tab | `HC_PLACE_SURFACES[key]` **and** `HC_ROOMS[key]` both exist |
| press the button | `hcAppendActionRow` exists |

Adrian named three. **In this shell only two exist** — there is no `quotes` place in
`HC_PLACE_SURFACES`, so there is no tab to press; the classic app's `data-v="quotes"` rail row is a
different shell. The copy therefore says *"say 'quick quote' or press the button when I offer it"*,
and it will grow a third clause by itself the day a tab is wired. The check's leg is written as a
**conditional on what is wired**, so adding one turns it green rather than red.

## What it does not claim

Nothing here says the mode can produce a quote. It can be entered, seen, and left; what it says on
entry is exactly what it can do next. The quote is item 5.

## The check

`scripts/check-quote-mode.mjs` — **18 legs, `[RULE]`.** Most of the file is the "this is fine"
direction: legs 3 and 4 are about sentences that **must not** enter, and that is what was asked for —
a leg proving entry works is easy, a leg proving entry does **not** happen is the one that matters.

**Red-proofed, eleven breaks, each asserted to have applied and each run:**

| break | went red |
|---|---|
| entry regex unanchored | 3 |
| entry regex too tight | 2 |
| the chip never renders | 5 |
| the chip renders an empty **visible** row | 6 |
| entering says nothing | 7 |
| leaving says nothing | 10 |
| the no-swallow guard disabled | 11, 12 |
| the mode claims every message | 13 |
| the offer speaks over an unanswered question | 15 |
| entering announced twice | 16 |
| `mention` matches nothing | 4 |

**Two legs were found weak by that pass and fixed** — which is the whole reason for doing it per leg:

- **Leg 6** read the row's state straight after page load, where `hidden` comes from the HTML
  attribute, so it passed no matter what `hcRenderModeChip` does and the empty-visible-row break went
  undetected. It now **calls the renderer**. A leg about a function must call it.
- **Leg 15** originally asserted only that `offer()` returned a boolean — true against every possible
  product. It now **arms a real unanswered question** and watches the refusal.
