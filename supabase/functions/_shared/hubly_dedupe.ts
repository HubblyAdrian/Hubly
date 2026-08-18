// Transcript dedupe for the builder conversation.
//
// The client renders every interimMessage and then `reply`. When the model
// announces a capability in one round ("Building the full page now, it'll
// appear in a moment") and then opens its final turn with the same sentence,
// the owner sees it twice, verbatim, seconds apart. It reads like the request
// fired twice.
//
// Deduped at the boundary rather than by asking the model not to repeat
// itself: the model cannot know what the client already displayed, and a rule
// it must carry across rounds is a rule it will eventually drop. Compared on
// normalised text so casing or trailing punctuation still collapses.
//
// LIVES IN ITS OWN MODULE so it can be exercised without booting the Edge
// Function, which touches Deno.env at load. That is not tidiness: the first
// version of this code shipped broken with correct similarity scores, and the
// only thing that would have caught it was running the real function over the
// real inputs. See tests/conversation-dedupe.test.mjs.

function normalizeForDedupe(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Dice coefficient over normalised word sets. Chosen over Jaccard because it
 *  weights overlap more generously, which suits short conversational lines
 *  where a few shared content words already mean something. */
export function similarity(a: string, b: string): number {
  const A = new Set(normalizeForDedupe(a).split(" ").filter(Boolean));
  const B = new Set(normalizeForDedupe(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/** THE THRESHOLD: 0.6. Measured against the repeats actually observed rather
 *  than picked for roundness. The photos prompt repeated near-verbatim scores
 *  ~0.95; two genuinely different lines in this product score under 0.2. 0.6
 *  sits in open space rather than on top of either cluster. */
export const DUPLICATE_THRESHOLD = 0.6;

/** The exception the threshold cannot catch. "Building the first version now."
 *  and "Building the page now — it'll appear in a moment." are the SAME
 *  statement and score only ~0.43, because English offers many ways to say one
 *  thing. Two lines that both announce a build in progress are a repeat
 *  whatever their wording. */
const PROGRESS_RE = /\b(building|creating|putting together|working on|generating)\b/i;
const PAGE_RE = /\b(page|site|website|version|draft)\b/i;
export function isProgressAnnouncement(t: string): boolean {
  return PROGRESS_RE.test(t) && PAGE_RE.test(t);
}

function isNearDuplicate(candidate: string, recent: string[]): boolean {
  for (const prior of recent) {
    if (similarity(candidate, prior) >= DUPLICATE_THRESHOLD) return true;
    if (isProgressAnnouncement(candidate) && isProgressAnnouncement(prior)) return true;
  }
  return false;
}

/** Compared against the last few assistant messages, not only the previous one:
 *  the observed photos repeat was two turns apart. */
export const DEDUPE_WINDOW = 4;

/** `priorSaid` must be what the assistant said on EARLIER turns only.
 *
 *  THE FAILURE THIS SIGNATURE EXISTS TO PREVENT: the first version took the
 *  conversation history and filtered it for assistant messages. The caller
 *  handed it `history` — the live array that the same turn had already pushed
 *  every interim message and finalText into. Each candidate was therefore
 *  compared against itself, scored 1.0, and was dropped. The builder went
 *  completely silent on any turn that invoked a capability: the page updated
 *  and Hubly said nothing.
 *
 *  Taking plain strings rather than a message array is part of the guard —
 *  there is no live history to hand in by accident. */
export function dedupeConversationMessages(
  interim: string[],
  reply: string,
  priorSaid: string[] = [],
): { interim: string[]; reply: string } {
  const recent: string[] = priorSaid.slice(-DEDUPE_WINDOW);

  const kept: string[] = [];
  for (const m of interim) {
    if (!m || !m.trim()) continue;
    if (isNearDuplicate(m, recent.concat(kept))) continue;
    kept.push(m);
  }
  // The reply is dropped rather than an interim: the interim arrived first and
  // was true when it arrived.
  const replyIsDupe = !!reply && isNearDuplicate(reply, recent.concat(kept));
  return { interim: kept, reply: replyIsDupe ? "" : reply };
}
