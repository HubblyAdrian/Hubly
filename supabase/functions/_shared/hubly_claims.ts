// ══ A PAGE THAT LIES CANNOT BE STORED ═══════════════════════════════════════════════════════
//
// ADRIAN'S TEST, VERBATIM, 2026-09-17:
//
//   "a string is a CLAIM if a reasonable customer could be WRONG by acting on it.
//    Quantity · credential word · availability or promise word · identifier.
//    The middle category is THE DERIVATION HOLDS, not 'a row exists' — 47 -> dozens holds,
//    47 -> hundreds is a lie with a true row behind it."
//
// That last sentence is the whole design. "Is there a row" is the test everything else in this
// repo uses and it is not enough here: a TRUE row can support a FALSE sentence. So a claim has
// three possible verdicts, not two.
//
// ── WHAT IT REJECTS, AND WHAT IT ONLY REPORTS ───────────────────────────────────────────────
//
// Two families can be JUDGED against the record, and being wrong about them costs a customer
// something real:
//
//   QUANTITY    "over 200 happy customers", "12 years in business", "500+ jobs" — checkable
//               against rows, and the derivation must hold, not merely exist.
//   IDENTIFIER  a phone number, an address — must be THIS business's own. This is the family
//               that caught saltmarsh-bindery publishing copperwick-kilns's phone: a real number
//               belonging to someone else, which is worse than an invented one because it
//               reaches THEM.
//
// Two families CANNOT be judged, because nothing in the schema holds them:
//
//   CREDENTIAL  "licensed", "insured", "bonded", "certified" — there is no licence column.
//   PROMISE     "24/7", "same-day", "free estimate", "satisfaction guaranteed" — no column.
//
// They are REPORTED, never rejected. Rejecting them would mean inventing a threshold for
// something we have no evidence about, which is the thing Adrian's (d) forbids; and rejecting
// every page that says "licensed and insured" would reject nearly every page we generate. The
// honest output is "this page asserts four things nothing can check", which is a fact about our
// schema rather than a verdict about the page.
//
// ── AND IF WE WERE HANDED NO FACTS, WE SAY SO ───────────────────────────────────────────────
//
// A caller that passes no facts gets `unjudgeable`, not `grounded`. An empty reader has told you
// about ITSELF — the standing rule — and a claims checker that silently passes everything when
// it was given nothing to check against is the worst possible version of this file.

export type BusinessFacts = {
  /** Rows that exist, for the derivation test. Absent means "we did not look", never zero. */
  customers?: number;
  reviews?: number;
  jobsCompleted?: number;
  /** The year the business started, if anything on the record holds it. */
  foundedYear?: number;
  /** businesses.years_in_business — the column that actually exists. Either form answers a
   *  "N years" claim; this one is what the record carries, so it is what callers pass. */
  yearsInBusiness?: number;
  phone?: string | null;
  address?: string | null;
};

export type ClaimFamily = "quantity" | "identifier" | "credential" | "promise";
export type ClaimVerdict = "grounded" | "derivation_holds" | "ungrounded" | "unjudgeable";
export type Claim = {
  text: string;
  family: ClaimFamily;
  kind: string;
  verdict: ClaimVerdict;
  why: string;
};

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const num = (s: string) => Number(String(s).replace(/[^0-9.]/g, ""));

/** THE SHAPES. Each names its family and what it matches. A shape that is not here is not
 *  detected — this is a FLOOR, and the list says so rather than pretending to be complete. */
const SHAPES: { kind: string; family: ClaimFamily; re: RegExp }[] = [
  { kind: "customer_count", family: "quantity", re: /\b(?:over\s+|more than\s+|trusted by\s+)?([\d,]+)\+?\s*(?:happy\s+|satisfied\s+)?(?:customers?|clients?|homeowners?|families)\b/gi },
  // A NUMBER NEAR THE WORD, not a number touching it. "120 five-star reviews" was missed by a
  // shape that allowed only the word "customer" between them — the same undercount as every other
  // list of forms we have written. Up to two words of adjective, whatever they are.
  { kind: "review_count",   family: "quantity", re: /\b(?:over\s+|more than\s+)?([\d,]+)\+?(?:\s+[\w-]+){0,2}\s+reviews?\b/gi },
  { kind: "job_count",      family: "quantity", re: /\b(?:over\s+|more than\s+)?([\d,]+)\+?\s*(?:jobs?|projects?|installs?|cars?|homes?)\s+(?:completed|done|serviced|detailed|finished)\b/gi },
  // BOTH ORDERS. "12 years of experience" was caught; "Serving the area for 30 years" — the more
  // natural sentence, and the one a model actually writes — was not, because the shape demanded
  // the qualifier AFTER the number. A duration claim is still a duration claim backwards.
  { kind: "years",          family: "quantity", re: /\b([\d]{1,3})\+?\s*years?\s+(?:of\s+)?(?:experience|in business|serving|trading|operating)/gi },
  { kind: "years",          family: "quantity", re: /\b(?:serving|in business|trading|operating|experience)\b[^.!?]{0,40}?\b([\d]{1,3})\+?\s*years?\b/gi },
  { kind: "since",          family: "quantity", re: /\bsince\s+((?:19|20)\d{2})\b/gi },
  { kind: "vague_count",    family: "quantity", re: /\b(a few|several|dozens|hundreds|thousands)\s+of\s+(?:happy\s+)?(?:customers?|clients?|reviews?|jobs?|projects?)\b/gi },
  { kind: "phone",          family: "identifier", re: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g },
  { kind: "credential",     family: "credential", re: /\b(licensed|insured|bonded|certified|accredited|BBB[- ]accredited|EPA[- ]certified)\b/gi },
  { kind: "promise",        family: "promise", re: /\b(24\/7|24 hours a day|same[- ]day|next[- ]day|7 days a week|money[- ]back|satisfaction guarantee[d]?|free\s+(?:estimate|quote|consultation|inspection|delivery))\b/gi },
];

/** A DERIVATION CAN BE FALSE FROM A TRUE SOURCE. A stated figure may not EXCEED what the record
 *  holds; a vague word must sit in a band the record actually reaches. 47 -> "dozens" holds,
 *  47 -> "hundreds" does not, and "over 200" from 47 rows does not. */
export function derivationHolds(claimed: number, actual: number): boolean {
  if (!Number.isFinite(claimed) || !Number.isFinite(actual)) return false;
  return claimed <= actual;
}
const BANDS: Record<string, number> = { "a few": 2, "several": 3, "dozens": 24, "hundreds": 100, "thousands": 1000 };
export function vagueDerivationHolds(word: string, actual: number): boolean | null {
  const floor = BANDS[String(word || "").toLowerCase()];
  if (floor === undefined) return null;
  return actual >= floor;
}

function judge(kind: string, family: ClaimFamily, text: string, m: RegExpExecArray, facts: BusinessFacts | undefined): { verdict: ClaimVerdict; why: string } {
  if (!facts) return { verdict: "unjudgeable", why: "no facts were supplied, so nothing here was checked" };
  switch (kind) {
    case "customer_count": {
      const claimed = num(m[1] || "");
      if (facts.customers === undefined) return { verdict: "unjudgeable", why: "no customer count was supplied" };
      return derivationHolds(claimed, facts.customers)
        ? { verdict: "derivation_holds", why: `${facts.customers} customers on record` }
        : { verdict: "ungrounded", why: `claims ${claimed}, the record holds ${facts.customers}` };
    }
    case "review_count": {
      const claimed = num(m[1] || "");
      if (facts.reviews === undefined) return { verdict: "ungrounded", why: "there is no reviews table — nothing could ground this" };
      return derivationHolds(claimed, facts.reviews)
        ? { verdict: "derivation_holds", why: `${facts.reviews} reviews on record` }
        : { verdict: "ungrounded", why: `claims ${claimed}, the record holds ${facts.reviews}` };
    }
    case "job_count": {
      const claimed = num(m[1] || "");
      if (facts.jobsCompleted === undefined) return { verdict: "unjudgeable", why: "no completed-job count was supplied" };
      return derivationHolds(claimed, facts.jobsCompleted)
        ? { verdict: "derivation_holds", why: `${facts.jobsCompleted} completed jobs on record` }
        : { verdict: "ungrounded", why: `claims ${claimed}, the record holds ${facts.jobsCompleted}` };
    }
    case "years": {
      const claimed = num(m[1] || "");
      const known = facts.yearsInBusiness ?? (facts.foundedYear === undefined ? undefined : new Date().getUTCFullYear() - facts.foundedYear);
      if (known === undefined) return { verdict: "ungrounded", why: "nothing on the record says how long this business has been going" };
      const actual = known;
      return derivationHolds(claimed, actual)
        ? { verdict: "derivation_holds", why: `the record says ${actual} years` }
        : { verdict: "ungrounded", why: `claims ${claimed} years, the record says ${actual}` };
    }
    case "since": {
      const claimed = num(m[1] || "");
      if (facts.foundedYear === undefined) return { verdict: "ungrounded", why: "nothing on the record says when this business started" };
      return claimed >= facts.foundedYear
        ? { verdict: "derivation_holds", why: `founded ${facts.foundedYear}` }
        : { verdict: "ungrounded", why: `says since ${claimed}, the record says ${facts.foundedYear}` };
    }
    case "vague_count": {
      const word = String(m[1] || "").toLowerCase();
      const actual = facts.customers ?? facts.jobsCompleted;
      if (actual === undefined) return { verdict: "unjudgeable", why: "no count was supplied to judge the word against" };
      const holds = vagueDerivationHolds(word, actual);
      if (holds === null) return { verdict: "unjudgeable", why: `"${word}" has no band` };
      return holds
        ? { verdict: "derivation_holds", why: `"${word}" is fair for ${actual}` }
        : { verdict: "ungrounded", why: `"${word}" overstates ${actual}` };
    }
    case "phone": {
      const own = digits(facts.phone).slice(-10);
      const said = digits(text).slice(-10);
      if (!own) return { verdict: "ungrounded", why: "no phone on the record, so this number came from nowhere we know" };
      return said === own
        ? { verdict: "grounded", why: "the business's own number" }
        : { verdict: "ungrounded", why: `not the number on record (${facts.phone})` };
    }
    case "credential":
      return { verdict: "unjudgeable", why: "no column holds a licence, insurance or certification — this cannot be checked, only reported" };
    case "promise":
      return { verdict: "unjudgeable", why: "no column holds hours-of-availability or a guarantee — this cannot be checked, only reported" };
    default:
      return { verdict: "unjudgeable", why: "unknown claim kind" };
  }
}

/** Every claim in a page's text, with a verdict each. */
export function claimsIn(text: string, facts?: BusinessFacts): Claim[] {
  const out: Claim[] = [];
  const seen = new Set<string>();
  for (const shape of SHAPES) {
    const re = new RegExp(shape.re.source, shape.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const t = m[0].trim();
      const key = shape.kind + "|" + t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const { verdict, why } = judge(shape.kind, shape.family, t, m, facts);
      out.push({ text: t, family: shape.family, kind: shape.kind, verdict, why });
    }
  }
  return out;
}

/** The two families a page may NOT lie about, because they can be judged and being wrong about
 *  them costs a customer something real. Credential and promise words are reported by claimsIn
 *  and are deliberately not here — see the header. */
export const REJECTABLE_FAMILIES: ClaimFamily[] = ["quantity", "identifier"];

export function lyingClaims(text: string, facts?: BusinessFacts): Claim[] {
  return claimsIn(text, facts).filter((c) => c.verdict === "ungrounded" && REJECTABLE_FAMILIES.includes(c.family));
}
