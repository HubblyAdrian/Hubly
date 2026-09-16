// hubly_record_claims.ts
//
// ══ WHEN HUBLY REPORTS WHAT IS IN THE RECORD, THE FIGURES COME FROM A READER ═══════════════
//
// Five sentences in five days, one act — Hubly describing the owner's own business back to them,
// wrongly:
//   "clay and seal, price 0" as Graef's only service
//   "there is no services area on your page yet"
//   "the 1 service you priced"
//   "your schedule isn't set up on this account yet"
//   "one paid store order — Store Walk, $24.99, paid"
//
// The last one, measured 2026-09-16: the record held TWO orders, "[TEST] Pin Check" $12.34 and
// "[TEST] Mode Filter" $9.99, both PENDING. Four of six fields fabricated. And the preceding seven
// turns of that conversation were entirely about opening hours, so nothing earlier could have
// supplied the figures either.
//
// ══ WHY THIS AND NOT A COMPOSER PER CAPABILITY ═════════════════════════════════════════════
//
// Measured across 284 stored assistant turns: 89 make a record claim, and 79 of those are STATE
// claims whose commonest form is "on your page" — which no reader can answer today, because the two
// service stores disagree on 23 of 41 claimed businesses and neither of them is the page. A
// composeXTruth per capability is ~40 composers where the expensive ones are the unwritable ones.
//
// So: ONE assertion at ONE choke point. Every figure in an owner-facing reply must appear in the
// capability result that produced the turn. Rephrasing a figure the handler returned is fine; a
// figure from nowhere is the Store Walk defect.
//
// ══ TWO VERDICTS, AND THE SECOND IS THE DANGEROUS ONE ══════════════════════════════════════
//
//   unsupported_figure  a figure in the reply that is absent from the result. The model had
//                       something to read and departed from it.
//   no_reader           a record claim in a turn where NOTHING WAS READ. Ungrounded BY
//                       CONSTRUCTION — a presence test, not a comparison, because there is
//                       nothing the figure could have come from. Same shape as "an ungrounded
//                       absence may not overwrite the record's existence", one dimension over.
//
// A model with nothing to read is inventing rather than rephrasing, so `no_reader` is expected to
// be the worse half. That is a prediction and the rows will settle it.
//
// ══ REPORT ONLY ════════════════════════════════════════════════════════════════════════════
//
// Nothing here refuses, edits or suppresses anything. It returns a verdict for recording. Rows
// before enforcement: the same order as envelope_suppression_events, which earned itself within
// hours by catching a real occurrence. A rule that can refuse before it has been sized is a rule
// that will refuse something real for the wrong reason.

export type ClaimVerdict = {
  /** Did the reply claim anything about the record at all? */
  claims: boolean;
  /** Which markers fired — for reading a spike, not for logic. */
  markers: string[];
  /** Figures in the reply that appear in NO evidence for this turn. */
  unsupported: string[];
  /** A record claim with no reader at all this turn. */
  noReader: boolean;
  /** Could something read EARLIER in this conversation have supplied them? The caveat that
   *  decides whether `no_reader` needs conversation scope rather than turn scope. */
  priorEvidence: boolean;
};

/** Record nouns — the things an owner has rows of. Deliberately a short list of the nouns we
 *  actually store, not an attempt at every noun in English: a miss here costs one uncounted
 *  claim, and the alternative (treating every number as a record claim) would flood the table
 *  with prices the owner just typed. */
const RECORD_NOUNS =
  "jobs?|bookings?|services?|edits?|orders?|customers?|leads?|messages?|photos?|tasks?|reviews?|pages?|appointments?|visits?|invoices?|products?";

/** State words that assert something about a row's condition. */
const STATE_WORDS =
  "is live|are live|it's live|on record|isn't showing|is showing|not set up|isn't set up|marked paid|is paid|unpaid|pending|saved|scheduled|booked|on your page|on the page|no longer|removed|added";

const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|no|zero";

const WORD_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};
/** A count as a comparable digit string, or null when it is an ABSENCE claim ("no bookings",
 *  "zero orders") — which asserts emptiness rather than a value, and is not checked here. */
function wordToDigit(tok: string): string | null {
  if (tok === "no" || tok === "zero") return null;
  return WORD_NUMBERS[tok] || (/^\d+$/.test(tok) ? tok : null);
}

/** The figures a reply asserts: money amounts, counts, and quoted names.
 *
 *  A COUNT ALLOWS UP TO TWO WORDS BEFORE ITS NOUN. The first version of this required the noun
 *  adjacent and so missed "The 8 earlier edits we talked about" — reporting ONE count claim across
 *  284 turns when the real figure is 15. The row that exposed it was one already read by eye, which
 *  is why the crude read comes before the detector and not after it. */
export function figuresIn(text: string): { money: string[]; counts: string[]; names: string[] } {
  const t = String(text || "");
  const money = [...t.matchAll(/\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g)].map((m) => m[1].replace(/,/g, ""));
  // NORMALISED TO DIGITS, AND ZERO IS NOT A FIGURE.
  //
  // Two bugs the check caught here, same root cause — bare short tokens:
  //   "one paid store order" yielded the literal "one", which then had to be found verbatim in a
  //   JSON blob holding `"total":"24.99"`. A word-number and a digit are the same figure.
  //   "No real bookings" yielded "no", and `includes("no")` matched inside the word "note" in an
  //   unrelated sentence — so an invented figure looked supported. Substring matching on a
  //   two-letter token is the same disease as a regex window that reaches past its subject.
  //
  // And "no"/"zero" is an ABSENCE claim, not a figure with a value: "no bookings" asserts the
  // count is zero, which is checked by a reader returning an empty set, not by finding "0" in a
  // blob. Absence claims are out of scope here and are deliberately not reported as unsupported —
  // over-reporting would bury the real cases, which is the whole failure mode of this instrument.
  const counts = [...t.matchAll(new RegExp(`\\b(\\d+|${NUMBER_WORDS})\\b(?:\\s+\\w+){0,2}\\s+(?:${RECORD_NOUNS})\\b`, "gi"))]
    .map((m) => wordToDigit(m[1].toLowerCase()))
    .filter((v): v is string => v !== null);
  // A quoted or capitalised multi-word name the reply attributes to a row ("Store Walk").
  const names = [...t.matchAll(/["“]([^"”]{2,40})["”]/g)].map((m) => m[1]);
  return { money, counts, names };
}

export function makesRecordClaim(text: string): string[] {
  const t = String(text || "");
  const markers: string[] = [];
  if (new RegExp(`\\b(\\d+|${NUMBER_WORDS})\\b(?:\\s+\\w+){0,2}\\s+(?:${RECORD_NOUNS})\\b`, "i").test(t)) markers.push("count");
  if (new RegExp(`\\b(${STATE_WORDS})\\b`, "i").test(t)) markers.push("state");
  if (/\$\s?\d/.test(t)) markers.push("money");
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i.test(t)
      || /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(t)) markers.push("date");
  return markers;
}

/** Was this figure available to the model?
 *
 *  Deliberately GENEROUS: a plain substring test over the evidence blob, with commas stripped, so
 *  "1,200" matches "1200" and a number inside a larger JSON value still counts. Generous in the
 *  direction of NOT reporting — an over-eager audit that cries wolf on rephrasing is worse than one
 *  that undercounts, because the first thing it would do is bury the Store Walk case in noise. */
function supported(figure: string, evidence: string): boolean {
  const f = String(figure).replace(/,/g, "").toLowerCase();
  if (!f) return true;
  const ev = evidence.replace(/,/g, "").toLowerCase();
  // BOUNDED, NOT `includes`. A bare `includes("no")` matched inside "note" and made an invented
  // figure look supported; `includes("1")` would match inside "2160". A number must appear as a
  // number, and a name as a whole word.
  if (/^\d+(?:\.\d+)?$/.test(f)) {
    return new RegExp(`(?:^|[^\\d.])${f.replace(".", "\\.")}(?:[^\\d]|$)`).test(ev);
  }
  return new RegExp(`(?:^|\\W)${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\W|$)`).test(ev);
}

/** The audit. `evidence` is everything read or returned THIS turn; `priorEvidence` is everything
 *  read earlier in the same conversation. Returns a verdict; changes nothing. */
export function auditRecordClaim(
  reply: string,
  evidence: string,
  priorEvidenceText = "",
): ClaimVerdict {
  const markers = makesRecordClaim(reply);
  if (!markers.length) {
    return { claims: false, markers, unsupported: [], noReader: false, priorEvidence: false };
  }
  const ev = String(evidence || "");
  const fig = figuresIn(reply);
  // ══ COUNTS ARE NOT COMPARED AGAINST THE EVIDENCE, AND HERE IS WHY ════════════════════════
  //
  // A count asserts "there are N of these". Verifying it means COUNTING the evidence, not
  // searching it — the reader that returns one order returns
  // `{"orders":[{"customer_name":"Store Walk",...}]}`, which contains no digit "1" anywhere. So
  // string-searching a count flags every correct count as unsupported, and an instrument that
  // reports its loudest false positives first is worse than no instrument: the Store Walk case
  // would arrive buried in noise.
  //
  // Counts still make a reply a RECORD CLAIM — so "you have 6 bookings" on a turn where nothing
  // was read is still `no_reader`, which is the half that matters most. They are simply not
  // listed as unsupported FIGURES, because this instrument cannot honestly judge them.
  //
  // Judging them needs the reader's own count, which means the handler returning a number rather
  // than a list — a separate change, and not one to smuggle in behind an instrument.
  const comparable = [...fig.money, ...fig.names];
  const unsupported = comparable.filter((f) => !supported(f, ev));
  const all = [...comparable, ...fig.counts];
  const prior = String(priorEvidenceText || "");
  return {
    claims: true,
    markers,
    unsupported,
    // NOTHING WAS READ. Not "the figure disagreed" — there was no reader at all, so every figure
    // in the reply arrived from somewhere other than the record.
    noReader: ev.trim().length === 0,
    priorEvidence: all.length > 0 && all.some((f) => supported(f, prior)),
  };
}
