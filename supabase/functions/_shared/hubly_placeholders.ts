/**
 * Mark what Hubly guessed; strip what it must never invent.
 *
 * A generated page contains two kinds of content the model produced without a
 * fact to work from:
 *
 *   SOFT GUESSES — a plausible process ("01 Book · 02 Set the tone · 03 Receive
 *   direction"), a value proposition, a tagline. Useful proposals, not lies. The
 *   model MARKS these itself as it writes (data-hubly-guess="…"), because it
 *   knows what it invented — it just invented it. This pass keeps those marks
 *   and adds a light deterministic backstop for a few it forgets. The owner sees
 *   them as "Hubly's suggestion" and replaces each in one click.
 *
 *   HARD CREDENTIALS — a price, a review, a star rating, a review count, years
 *   in business, a licence, insurance, a certification, a guarantee. These are
 *   NOT marked, they are STRIPPED, because the damage if an owner doesn't notice
 *   and publishes is real: a fabricated "Licensed & Insured · 4.9★ (312 reviews)"
 *   is a lie about the business that a marked-but-unnoticed placeholder would
 *   still ship. Fake the shape and the voice; never the credentials.
 *
 * GROUNDING. A credential is kept only if the record backs it: a price that
 * matches a recorded service price, a "N years" that matches yearsInBusiness.
 * Anything ungrounded is removed. Ratings, review counts and licence/insurance/
 * certification/guarantee claims have no record source at all in this format, so
 * any of them is ungrounded by definition.
 *
 * NO EXTRA MODEL CALL, NO REGENERATION. Everything here is a deterministic pass
 * over the HTML — the standing rule.
 */

import { scanHtml, spliceAll, type ScannedEl, type Splice } from "./hubly_html_scan.ts";
import { innerText, ownText } from "./hubly_html_scan.ts";

export interface PlaceholderRecord {
  services?: { name?: string | null; price?: number | null }[];
  yearsInBusiness?: number | null;
  reviews?: unknown[];
  city?: string | null;
  state?: string | null;
  areaCities?: string[];
}

export interface Placeholder {
  reason: string;
  sample: string;
  source: "model" | "backstop";
}

export interface Stripped {
  kind: string;
  text: string;
}

export interface PlaceholderResult {
  html: string;
  placeholders: Placeholder[];
  stripped: Stripped[];
}

const GUESS_ATTR = "data-hubly-guess";

/** A leaf whose own text can carry an editable claim. */
const TEXT_LEAF = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "li", "td", "th",
  "strong", "em", "b", "i", "small", "div", "figcaption", "blockquote", "mark", "dd", "dt",
]);

/** Credential shapes that have NO source in the freeform record — always strip. */
const RATING_RE = /(★|⭐|\bstars?\b|\brated\b|\d(?:\.\d)?\s*\/\s*5\b|\b\d(?:\.\d)?\s*out of\s*5\b)/i;
const REVIEW_COUNT_RE = /\b\d[\d,]*\+?\s*(reviews?|ratings?|(happy\s+)?customers?|clients?|homeowners?|households?|families|jobs?\b|projects?\b|homes?\b|five[- ]star)|\btrusted by\b|\bloved by\b|\bjoin(ed)?\s+\d/i;
const CREDENTIAL_RE = /\b(licen[sc]ed|fully insured|insured|bonded|certified|certification|accredited|BBB[- ]accredited|BBB\b|award[- ]winning|guarantee[ds]?|warrant(y|ies)|money[- ]back|satisfaction guaranteed|100%\s+guaranteed)\b/i;
/** A price token anywhere in text. */
const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*\s*dollars\b/gi;
/** "N years" (in business / of experience). */
const YEARS_RE = /\b(\d{1,3})\s*(?:\+\s*)?years?\b/i;

function priceToNumber(token: string): number | null {
  const m = token.replace(/,/g, "").match(/\d+(\.\d{1,2})?/);
  return m ? Number(m[0]) : null;
}

/** The smallest text leaf enclosing a node — where a credential claim lives. */
function enclosingLeaf(el: ScannedEl): ScannedEl {
  let n: ScannedEl = el;
  while (n.parent && !TEXT_LEAF.has(n.name)) n = n.parent;
  return n;
}

export function annotatePlaceholders(html: string, record: PlaceholderRecord): PlaceholderResult {
  const recordPrices = new Set<number>();
  for (const s of record.services || []) {
    if (typeof s.price === "number" && s.price > 0) recordPrices.add(s.price);
  }
  const years = typeof record.yearsInBusiness === "number" && record.yearsInBusiness > 0 ? record.yearsInBusiness : null;
  const hasReviews = Array.isArray(record.reviews) && record.reviews.length > 0;

  const placeholders: Placeholder[] = [];
  const stripped: Stripped[] = [];

  // --- PASS 1: STRIP ungrounded credentials, to a fixed point (removing one
  //     element shifts offsets; re-scan; bounded because it only removes bytes).
  let src = String(html || "");
  for (let pass = 0; pass < 8; pass++) {
    const scan = scanHtml(src);
    const cuts: Splice[] = [];
    const seen = new Set<ScannedEl>();

    const stripElement = (el: ScannedEl, kind: string) => {
      const leaf = enclosingLeaf(el);
      if (seen.has(leaf)) return;
      seen.add(leaf);
      cuts.push({ start: leaf.openStart, end: Math.max(leaf.closeEnd, leaf.openEnd), text: "" });
      stripped.push({ kind, text: innerText(leaf, src).slice(0, 80) || ownText(leaf, src).slice(0, 80) });
    };

    for (const el of scan.all) {
      if (!TEXT_LEAF.has(el.name)) continue;
      const t = ownText(el, src);
      if (!t) continue;

      // Ratings / stars — no source, ever.
      if (RATING_RE.test(t) && !hasReviews) { stripElement(el, "rating"); continue; }
      // Review / customer counts — no source, ever.
      if (REVIEW_COUNT_RE.test(t)) { stripElement(el, "review-count"); continue; }
      // Licence / insurance / certification / guarantee — no record field.
      if (CREDENTIAL_RE.test(t)) { stripElement(el, "credential"); continue; }
      // Years in business — kept only if it matches the record.
      const ym = t.match(YEARS_RE);
      if (ym) {
        const n = Number(ym[1]);
        if (years === null || n !== years) { stripElement(el, "years"); continue; }
      }
      // Prices — kept only if the number matches a recorded service price.
      const priceTokens = t.match(PRICE_RE);
      if (priceTokens) {
        const anyUngrounded = priceTokens.some((tok) => {
          const n = priceToNumber(tok);
          return n === null || !recordPrices.has(n);
        });
        if (anyUngrounded) { stripElement(el, "price"); continue; }
      }
    }

    if (!cuts.length) break;
    // Non-overlapping: two credential leaves can't be nested (enclosingLeaf
    // stops at the first leaf), but guard anyway.
    cuts.sort((a, b) => a.start - b.start || b.end - a.end);
    const kept: Splice[] = [];
    let lastEnd = -1;
    for (const c of cuts) { if (c.start < lastEnd) continue; kept.push(c); lastEnd = c.end; }
    src = spliceAll(src, kept);
  }

  // --- PASS 2: collect the model's own guess marks (kept as-is).
  {
    const scan = scanHtml(src);
    for (const el of scan.all) {
      const reason = el.attrs[GUESS_ATTR];
      if (reason != null) {
        placeholders.push({ reason: String(reason).slice(0, 80) || "guessed", sample: ownText(el, src).slice(0, 60), source: "model" });
      }
    }
  }

  // --- PASS 3: BACKSTOP. Mark a narrow class of forgotten guesses that ARE
  //     deterministically detectable. This does NOT try to detect arbitrary
  //     invented prose — that is inherently the model's job, which is why it
  //     marks its own. What it catches:
  //       * a numbered process/steps block ("01 … 02 … 03 …"), which has no
  //         record source and is the single most common unmarked guess.
  //     Anything caught here is MARKED (not stripped) so the owner sees it.
  {
    const scan = scanHtml(src);
    const marks: Splice[] = [];
    // Step markers: leaves whose whole text is a 1-2 digit ordinal ("01", "1").
    for (const el of scan.all) {
      if (el.attrs[GUESS_ATTR] != null) continue;
      if (!TEXT_LEAF.has(el.name)) continue;
      const t = ownText(el, src);
      if (!/^0?[1-9]$/.test(t)) continue;
      // Only when a sibling ordinal exists — one "01" alone is not a process.
      const sibs = (el.parent?.parent?.children || []).flatMap((c) => c.children).filter((c) => c !== el);
      const looksLikeStep = sibs.some((c) => /^0?[1-9]$/.test(ownText(c, src)));
      if (!looksLikeStep) continue;
      // Mark the step's block (its grandparent card), not the digit.
      const card = el.parent?.parent && TEXT_LEAF.has(el.parent.parent.name) ? el.parent.parent : el.parent;
      if (!card || card.attrs[GUESS_ATTR] != null) continue;
      marks.push({ start: card.attrInsertAt, end: card.attrInsertAt, text: ` ${GUESS_ATTR}="a suggested process — replace with your real steps"` });
      placeholders.push({ reason: "a suggested process", sample: innerText(card, src).slice(0, 60), source: "backstop" });
    }
    if (marks.length) {
      // Dedup by insert position (a card can hold several ordinals).
      const byPos = new Map<number, Splice>();
      for (const m of marks) if (!byPos.has(m.start)) byPos.set(m.start, m);
      src = spliceAll(src, [...byPos.values()]);
      // Recount placeholders now the dupes are collapsed: rebuild from the html.
    }
  }

  // Final authoritative count from the html, so placeholders[] matches exactly
  // what is in the document (dedup handled above may have collapsed backstops).
  const finalScan = scanHtml(src);
  const finalMarks = finalScan.all.filter((e) => e.attrs[GUESS_ATTR] != null);
  const authoritative: Placeholder[] = finalMarks.map((e) => ({
    reason: String(e.attrs[GUESS_ATTR]).slice(0, 80) || "guessed",
    sample: ownText(e, src).slice(0, 60) || innerText(e, src).slice(0, 60),
    source: /suggested process/i.test(e.attrs[GUESS_ATTR] || "") ? "backstop" as const : "model" as const,
  }));

  return { html: src, placeholders: authoritative, stripped };
}

/** How many placeholders a stored page still carries — the queryable count. */
export function countPlaceholders(html: string): number {
  return scanHtml(String(html || "")).all.filter((e) => e.attrs[GUESS_ATTR] != null).length;
}
