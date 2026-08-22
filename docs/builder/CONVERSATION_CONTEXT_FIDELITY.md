# Conversation context: mid-session vs after a restore

Written at the end of **Block 3 (persistence)** as the input the **next block (setup
state)** designs against. It answers one question: after a reload, does Hubly know
enough to still be mid-sentence, or does it come back thinner than it was a minute
earlier?

Short answer: **it comes back thinner.** That is acceptable for a one-shot build and
is the open question for a multi-day setup conversation. Nothing here is a bug to fix
in Block 3 — it is the boundary the state engine has to cover.

## The three things a turn carries

Each turn, `hubly-conversation` builds a working context for the model out of:

1. **The display transcript** — the person's messages and Hubly's final replies.
   This is the only thing Block 3 persists (`business_conversations`, one row per
   message, keyed to the business).
2. **Injected capability results** — after every capability call, the edge pushes a
   `role:"system"` `CAPABILITY RESULT for <cap>.<action>: {...}` message into the
   working history so the model can see what actually happened (a draft was created,
   services were set, a document was generated, an edit landed). Ephemeral: built
   fresh each turn, never stored.
3. **Interim status + the build-steps card** — "Looking at that…", the five-stage
   build narration. Display-only, transient, never stored.

Plus the **Understanding** object (structured business facts), which is carried
separately by the client and is *not* part of this note — it already persists via
its own path and is stable across a reload.

## Mid-session: what the model has

- The last **`MAX_HISTORY = 40`** messages of the working history, which by then
  includes the interleaved `CAPABILITY RESULT` system lines from earlier turns this
  session. So mid-session the model can see not just *what was said* but *what it
  did* — "I already created the draft", "services are already set", "the document was
  generated", "that edit was applied".
- The current Understanding.

## After a restore: what the model has

On reload the client calls `hcLoadConversation()`, which reads the stored transcript
(draft-token gate before a claim, owner/`auth.uid()` gate after) and **seeds
`hc.messages` with the display turns only**. So the model's context on the first
post-reload turn is:

- The **display transcript** (user + assistant text), clean and in order.
- The current Understanding.
- **No capability-result lines.** The record that Hubly *did* things — created the
  draft, set services, generated the document, applied an edit — is gone. It can be
  *inferred* from the assistant's own replies ("I've started building your site")
  and from Understanding, but it is no longer stated as fact in the context.

## What is lost in between

| Signal | Mid-session | After restore |
|---|---|---|
| Person's messages | ✅ | ✅ (persisted) |
| Hubly's final replies | ✅ | ✅ (persisted) |
| Capability results (what Hubly *did*) | ✅ (as system lines) | ❌ (not persisted) |
| Interim status / build-steps card | ✅ (transient) | ❌ (by design — never a message) |
| Understanding (structured facts) | ✅ | ✅ (separate path) |
| History depth | last 40 messages | full transcript, re-sliced to last 40 |
| Pre-business chit-chat turns | ✅ | ❌ (see below) |

**The gap that matters:** the *action record*. Mid-session the model knows it already
generated the document because the `CAPABILITY RESULT` for `website.generateDocument`
is sitting in its context. After a restore that line is gone. Today this rarely
bites, because (a) the assistant's persisted replies usually narrate what it did, and
(b) Understanding holds the durable facts. It will bite when the setup conversation
spans days and the model needs to reason precisely about **what it has already done
vs. what is still outstanding** ("did I already ask for photos?", "is the booking
capability already wired?"). That precise state is exactly what the next block builds
— and it should be sourced from an explicit setup-state record, **not** reconstructed
by re-reading the transcript, because the transcript deliberately does not carry it.

## Two smaller, known losses (noted, not being fixed in Block 3)

- **Pre-business turns.** Persistence keys to `business_id` and begins the moment a
  business exists. On turn 1 the draft is created *during* the turn, so the first
  brief + reply are captured. But if someone has several turns of chit-chat *before*
  any draft is created, those are not attached. Accepted; no retroactive-attach.
- **Unbounded working context over days.** `MAX_HISTORY=40` caps what's sent to the
  model, so a multi-day conversation keeps shipping 40 messages every turn and the
  oldest turns fall out of the model's view even though they're stored. The
  transcript is complete on disk; the model's *window* into it is not. Summarization
  of older turns is a candidate for a later block.

## Implication for the setup-state block

Design the state engine to own the action/outstanding record explicitly (per
business, referencing `business_conversations.seq` where a turn matters), so that
"what Hubly has already done and what is still owed" survives a restore independent of
the model's 40-message window and independent of whether a capability-result line
happens to still be in context. The transcript is the record of the *conversation*;
the state engine must be the record of the *work*.
