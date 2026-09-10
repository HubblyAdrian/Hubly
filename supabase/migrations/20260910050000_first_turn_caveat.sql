-- WHAT THIS TABLE CAN AND CANNOT SEE. Written into the database itself, because the
-- caveat is not obvious from the column names and the wrong reading is the natural one.
--
-- On 2026-09-10 this table reported asked=true for a turn where the owner, watching the
-- screen, was never asked. Both were true. The model DID ask, in that turn's reply — and
-- ~2 minutes later the client fired a SECOND turn (event:"post_build") whose gate read
-- the services record and asked about pricing on top of it. That second turn is NOT a
-- first turn (a draft exists by then), so the thing that actually overwrote the question
-- is invisible here. With the bug still live, this table would have reported asked=true
-- forever.

comment on table public.first_turn_outcomes is
  'One row per FIRST turn (a turn that arrived with no draft) — the only population that '
  'writes nothing else anywhere: no businesses row, and no business_conversations row '
  'either, because the client buffers conversation writes until a draft exists. '
  'MEASURES VOLUME AND RATE FROM REAL TRAFFIC. It does NOT measure what a person ended up '
  'looking at: later turns in the same conversation are not recorded here, so anything '
  'that supersedes, buries or contradicts this turn is invisible. For "what did the person '
  'actually see", drive the real client — scripts/walk-signup-in-browser.mjs. Neither can '
  'do the other job.';

comment on column public.first_turn_outcomes.reply is
  'What Hubly said back ON THIS TURN, raw and unjudged (whether it was a menu, or asked '
  'for a name, is decided at READ time — a detector in a write path poisons the data '
  'permanently). '
  'THE CAVEAT THAT MATTERS: deriving "asked_name" from this column means THE MODEL ASKED '
  'IN THIS TURN''S REPLY. It does NOT mean THE PERSON SAW A QUESTION. On 2026-09-10 the '
  'name question was the last sentence of a long build narration and was superseded two '
  'minutes later by a louder pricing question from the post_build turn; this column said '
  'asked=true and the owner correctly reported he was never asked. Anyone reading this '
  'column later will assume the second meaning. It is the first.';

comment on column public.first_turn_outcomes.said is
  'The visitor''s opening sentence, truncated to 200 chars. INTERNAL ONLY — never rendered '
  'to an owner, never in a reader, never part of any answer Hubly gives. Nulled after 30 '
  'days by purge-first-turn-text-daily, which keeps the booleans so the rate keeps a '
  'history without accumulating a corpus of strangers'' sentences.';

comment on column public.first_turn_outcomes.is_synthetic is
  'TRUE only when the caller DECLARED itself with the x-hubly-synthetic header (our own '
  'harnesses). Never sniffed: an absent Origin is a heuristic and would be wrong in the '
  'flattering direction on the day it mattered. An unmarked harness shows up as a visible '
  'bug rather than a quietly better number.';

comment on column public.first_turn_outcomes.later_business_id is
  'Set when a draft was created on a LATER turn of the same conversation. A turn is not a '
  'conversation: "can you build me a site" -> "what kind of business is it?" creates '
  'nothing and is CORRECT, while a menu creates nothing and is the failure. They are '
  'identical on turn one and only this column tells them apart.';
