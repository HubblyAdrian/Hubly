// hubly_match.ts
//
// WHICH ROW DID HE MEAN? One matcher, for every capability that resolves the owner's own words
// against his own records.
//
// ══ THE DEFECT THAT PRODUCED THIS (2026-09-15) ═══════════════════════════════════════════════
//
//   owner: change the driveway job to 3 PM
//   Hubly: I couldn't find a job matching "driveway job." Which job do you mean?
//
// He had ONE job and it was printed three lines above. He rephrased to "change the driveway to
// 3 PM" and it worked.
//
// The old rule required EVERY query word of >=3 characters to appear in the row's text, and the
// row's text is only customer_name + service_name + address — which never contains the word
// "job", because "job" is OUR noun for the row and not a word in it. Measured over six natural
// phrasings, bare "driveway" was the ONLY one that matched. "the driveway" failed too, because
// "the" is three characters and was therefore required.
//
// ══ WHY THIS IS NOT A STOPWORD LIST ══════════════════════════════════════════════════════════
//
// A list of "our nouns" would have repaired five of six phrasings and left "the driveway" — the
// most natural one — broken. It would also have been the twelfth hand-maintained set in
// CHECKER_LESSONS Lesson 87, and that lesson says the fix for that shape is to DERIVE the set or
// make membership STRUCTURAL.
//
// So: a word matters in proportion to how FEW of HIS OWN ROWS contain it.
//   "job", "the", "appointment", "booking" appear in none of his rows -> weight nothing, and they
//   all die BY THE SAME MECHANISM rather than by four entries in a list nobody will maintain.
//   "driveway" appears in one row of two -> it discriminates, so it decides.
// The vocabulary is derived from the records it describes. There is nothing to keep in sync.
//
// ══ MAX, NOT SUM — and this was found by inventing the adversarial case ══════════════════════
//
// Summing the weights lets two weak words outvote one strong one. With rows "Driveway wash" and
// "The job", the query "the driveway job" scored *The job* 2.0 ("the" + "job") against *Driveway
// wash* 1.0 — and would have CHANGED A JOB HE NEVER MEANT. Taking each row's single
// best-discriminating word makes that a tie, and a tie is a QUESTION, never a coin flip.
//
// ══ THE ONE-ROW CASE, STATED RATHER THAN INFERRED ════════════════════════════════════════════
//
// With a single row, every word appears in 100% of rows, so df === rows.length for everything and
// NOTHING discriminates. That is the common early case — it is Adrian's own business — so it is
// named here and asserted by a check rather than left to fall out of the arithmetic: with one
// candidate there is nothing to disambiguate, so we ACT. The scoring below reaches that naturally
// (one row scoring anything at all is the sole best), but "it happens to work" is not a promise.

export type MatchRow = Record<string, unknown>;

export type MatchOutcome<T extends MatchRow> =
  | { kind: "act"; row: T }
  | { kind: "ask"; candidates: T[] }       // ALWAYS >= 2 — see requireCandidates
  | { kind: "none" };

/** The text of one row, as the owner might refer to it. `fields` is per-record-kind, so a job is
 *  matched on customer/service/address and a customer on name/phone/email. */
function hay(row: MatchRow, fields: string[]): string {
  return fields.map((f) => row[f]).filter(Boolean).join(" ").toLowerCase();
}

/** Score every row and return the outcome.
 *
 *  `rows` MUST be this business's rows and nothing else. Never a global corpus and never another
 *  business's vocabulary: the whole rule is "rare among HIS records", and a shared denominator
 *  would make one owner's wording decide another owner's match. */
export function matchRows<T extends MatchRow>(
  which: string,
  rows: T[],
  fields: string[] = ["customer_name", "service_name", "address"],
): MatchOutcome<T> {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { kind: "none" };
  const q = String(which || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  if (!q.length) return { kind: "none" };

  const hays = list.map((r) => hay(r, fields));
  const scored = list.map((row, i) => {
    let best = 0;
    for (const w of q) {
      // df = how many of HIS rows contain this word. Zero means the word is not about his records
      // at all ("job", "the") and it is ignored entirely rather than counted against anything.
      const df = hays.filter((h) => h.includes(w)).length;
      if (df === 0) continue;
      if (hays[i].includes(w)) best = Math.max(best, 1 / df);
    }
    return { row, best };
  });

  const top = Math.max(0, ...scored.map((s) => s.best));
  if (top <= 0) return { kind: "none" };
  // A whisker, not equality: these are reciprocals of small integers, so exact ties are the norm
  // and float comparison should not be what decides whether we ask.
  const winners = scored.filter((s) => s.best >= top * 0.999).map((s) => s.row);
  if (winners.length === 1) return { kind: "act", row: winners[0] };
  return { kind: "ask", candidates: winners };
}

/** NAMING THE CANDIDATES IS A PRECONDITION OF REFUSING.
 *
 *  The defect this makes unreachable: two refusal branches existed, and the WRONG one fired. The
 *  `ambiguous` branch (2+ matches) was correct and named up to four candidates. The `no_match`
 *  branch (ZERO matches) borrowed its QUESTION without its EVIDENCE — "Say which job they mean",
 *  with nothing to choose between and no word about what he actually has.
 *
 *  So a disambiguation cannot be composed without two or more candidates. Zero and one are
 *  unreachable by construction rather than by remembering to write a second sentence. */
export function requireCandidates<T>(candidates: T[]): T[] {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length < 2) {
    throw new Error(
      `a disambiguation needs at least two candidates, got ${list.length} — ` +
      `zero means say there is no match AND say what they do have; one means act and name it`,
    );
  }
  return list;
}

/** One row, in the owner's own terms, for naming a candidate or an action. Never an id — he has
 *  never seen one and it would tell him nothing about which job we touched. */
export function describeRow(row: MatchRow): string {
  const bits = [row.customer_name, row.service_name, row.scheduled_date,
    String(row.scheduled_time || "").slice(0, 5) || null, row.address]
    .filter(Boolean).map(String);
  return bits.length ? bits.join(" · ") : "an unnamed record";
}
