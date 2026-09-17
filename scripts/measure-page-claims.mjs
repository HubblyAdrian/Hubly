#!/usr/bin/env node
/**
 * DOES EVERY FACTUAL CLAIM ON A GENERATED PAGE TRACE TO A ROW?
 *
 *   supabase db query --linked -f scripts/sql/export-page-claims.sql > pages.json
 *   HUBLY_PAGE_CLAIMS=pages.json node scripts/measure-page-claims.mjs
 *
 * ADRIAN'S DESIGNER, and this is the specification: "OpenAI is allowed to be creative about the
 * EXPERIENCE. It is not allowed to be creative about the TRUTH."
 *
 * ══ THE THREE CATEGORIES, AND THE TEST THAT SORTS A STRING INTO THEM ═════════════════════════
 *
 *   SOURCE    a value that IS a row            review_count = 47
 *   DERIVED   a restatement of a row            "47 customer reviews" · "dozens of reviews"
 *   CREATIVE  copy that asserts no fact         "See why our customers keep coming back."
 *
 * Only the first two need grounding. **THE TEST, stated so the categories are not decoration:**
 *
 *   A string is a CLAIM (source or derived) if a reasonable customer could be WRONG by acting on it —
 *   i.e. it would be FALSIFIABLE against the business's records. Operationally, in this measurer:
 *     · it contains a QUANTITY (a number, a money figure, a count, a duration, a distance, a year), OR
 *     · it contains a CREDENTIAL word (licensed, insured, bonded, certified, warranty, guarantee), OR
 *     · it contains an AVAILABILITY or PROMISE word (24/7, same-day, free delivery, money back), OR
 *     · it is an IDENTIFIER (a phone number, a street address, an email).
 *   Everything else is CREATIVE. "Our customers keep coming back" cannot be checked against a row and
 *   nobody can act on it wrongly; "we have 200 customers" can, and they can.
 *
 * **AND A DERIVATION CAN BE FALSE FROM A TRUE SOURCE.** 47 -> "dozens" holds. 47 -> "hundreds" is a
 * lie with a real row behind it. So the middle category is not "a row exists" — it is **THE
 * DERIVATION HOLDS**, and that is what `derivationHolds()` below tests.
 *
 * ══ WHAT THIS NUMBER IS AND IS NOT ═══════════════════════════════════════════════════════════
 *
 * **It counts a FORM, not a fact** — the standing rule. Every claim shape here is one we thought of,
 * and prose has no closed set of forms, so the real number is HIGHER than whatever this prints. It is
 * a FLOOR. The shapes are listed in CLAIM_SHAPES and each says what it matches.
 *
 * It also cannot see a claim that is TRUE but unrecorded — an owner who really is licensed but whose
 * licence is in no table reads here as ungrounded. That is the correct reading for our purposes ("we
 * cannot show it is true") and the wrong reading for his ("he is lying"), and the report must say
 * which. Every row printed is a CANDIDATE.
 */
import { readFileSync } from "node:fs";

const SRC = process.env.HUBLY_PAGE_CLAIMS;
if (!SRC) { console.error("CANNOT RUN — set HUBLY_PAGE_CLAIMS to the export from scripts/sql/export-page-claims.sql"); process.exit(2); }
const raw = JSON.parse(readFileSync(SRC, "utf8"));
const pages = Array.isArray(raw) ? raw : (raw.rows || []);
if (!pages.length) { console.error("CANNOT RUN — the export holds no pages. Re-export; an empty export reports 'nothing ungrounded' about itself."); process.exit(2); }

/** THE CLAIM SHAPES. Each says what it matches and which of Adrian's "cannot invent" items it is. */
const CLAIM_SHAPES = [
  { kind: "price",        re: /\$\s?\d[\d,]*(?:\.\d{2})?/g },
  { kind: "rating",       re: /\b\d(?:\.\d)?\s*(?:\/\s*5\s*)?(?:star|stars|out of 5)\b/gi },
  { kind: "review_count", re: /\b(?:over\s+|more than\s+)?\d[\d,]*\+?\s*(?:customer\s+)?reviews?\b/gi },
  { kind: "customer_count", re: /\b(?:over\s+|more than\s+|trusted by\s+)?\d[\d,]*\+?\s*(?:happy\s+|satisfied\s+)?(?:customers?|clients?|homeowners?|families)\b/gi },
  { kind: "years",        re: /\b(?:since\s+(?:19|20)\d{2}|\d{1,3}\+?\s*years?\s+(?:of\s+)?(?:experience|in business|serving))/gi },
  { kind: "credential",   re: /\b(?:licensed|insured|bonded|certified|accredited|BBB[- ]accredited|EPA[- ]certified)\b/gi },
  { kind: "guarantee",    re: /\b(?:money[- ]back|satisfaction guarantee[d]?|guaranteed|warrant(?:y|ied)|no[- ]risk)\b/gi },
  { kind: "availability", re: /\b(?:24\/7|24 hours a day|open 24 hours|same[- ]day|next[- ]day|7 days a week)\b/gi },
  { kind: "free_promise", re: /\bfree\s+(?:pickup|delivery|shipping|estimate|quote|consultation|inspection)\b/gi },
  { kind: "radius",       re: /\bwithin\s+\d+\s*(?:miles?|mi|km)\b/gi },
  { kind: "phone",        re: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g },
  { kind: "address",      re: /\b\d{1,6}\s+[NSEW]?\.?\s*[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Way|Ct|Court|Pkwy)\b\.?/g },
];

const digits = (s) => String(s || "").replace(/\D/g, "");
const money = (s) => Number(String(s).replace(/[^0-9.]/g, ""));

/** THE GROUNDING TEST, per claim kind. Returns { grounded, why }. */
function ground(kind, text, page) {
  const cat = (page.catalog || []).map((s) => ({ name: s.name, cents: s.cents == null ? null : Number(s.cents), variable: s.variable }));
  const tbl = (page.table_services || []).map((s) => ({ name: s.name, cents: s.price == null ? null : Math.round(Number(s.price) * 100) }));
  const mem = (page.memberships || []).map((m) => ({ name: m.name, cents: m.price == null || m.price === "" ? null : Math.round(Number(m.price) * 100) }));
  const allPrices = new Set();
  for (const s of [...cat, ...tbl, ...mem]) {
    if (s.cents != null && Number.isFinite(s.cents)) allPrices.add(s.cents);
    if (s.variable && typeof s.variable === "object") for (const v of Object.values(s.variable)) allPrices.add(Number(v));
  }
  switch (kind) {
    case "price": {
      const cents = Math.round(money(text) * 100);
      if (!Number.isFinite(cents)) return { grounded: false, why: "unreadable figure" };
      return allPrices.has(cents)
        ? { grounded: true, why: "matches a priced offer" }
        : { grounded: false, why: `no offer is priced at ${text}` };
    }
    case "phone": {
      const d = digits(text).slice(-10);
      const own = digits(page.phone).slice(-10);
      return d && own && d === own
        ? { grounded: true, why: "the business's own number" }
        : { grounded: false, why: own ? `not the number on record (${page.phone})` : "no phone on record at all" };
    }
    case "address": {
      const rec = [page.meta_address, page.meta_address2].filter(Boolean).join(" ").toLowerCase();
      const num = (text.match(/\d{1,6}/) || [""])[0];
      return rec && num && rec.includes(num)
        ? { grounded: true, why: "matches the address on record" }
        : { grounded: false, why: rec ? "does not match the address on record" : "no address on record at all" };
    }
    case "rating":
    case "review_count":
      // THERE IS NO REVIEWS TABLE. Nothing in the database can ground a rating or a count, so any such
      // claim is ungrounded BY CONSTRUCTION — which is itself the finding, not a detection failure.
      return { grounded: false, why: "no reviews table exists — nothing could ground this" };
    case "customer_count": {
      // DERIVED, AND THE DERIVATION MUST HOLD. A count is checkable against `customers`; the page's
      // number may not overstate it.
      const n = Number((text.match(/\d[\d,]*/) || ["0"])[0].replace(/,/g, ""));
      const have = Number(page.customer_rows || 0);
      if (!have) return { grounded: false, why: "no customer rows to count" };
      return derivationHolds(n, have)
        ? { grounded: true, why: `${have} customers on record` }
        : { grounded: false, why: `claims ${n}, record holds ${have}` };
    }
    case "years": case "credential": case "guarantee": case "availability":
    case "free_promise": case "radius":
      // NOTHING IN THE SCHEMA HOLDS ANY OF THESE. No licence field, no founding year, no guarantee,
      // no service radius, no delivery promise. Ungrounded by construction, and that is the finding.
      return { grounded: false, why: "no column exists that could hold this" };
    default:
      return { grounded: false, why: "unknown claim kind" };
  }
}

/** A DERIVATION CAN BE FALSE FROM A TRUE SOURCE. 47 -> "dozens" holds; 47 -> "hundreds" does not.
 *  A stated figure may not EXCEED the source, and a vague one must sit in the right band. */
export function derivationHolds(claimed, actual) {
  if (!Number.isFinite(claimed) || !Number.isFinite(actual)) return false;
  return claimed <= actual;
}
export function vagueDerivationHolds(word, actual) {
  const w = String(word || "").toLowerCase();
  const band = { "a few": [1, 5], "several": [3, 9], "dozens": [24, 999], "hundreds": [100, 99999], "thousands": [1000, 999999] }[w];
  if (!band) return null;
  return actual >= band[0];
}

const rows = [];
for (const p of pages) {
  const text = String(p.page_text || "");
  for (const shape of CLAIM_SHAPES) {
    shape.re.lastIndex = 0;
    for (const m of text.matchAll(shape.re)) {
      const claim = m[0].trim();
      const g = ground(shape.kind, claim, p);
      rows.push({ slug: p.slug, kind: p.account_kind, type: p.business_type, shape: shape.kind,
                  claim, grounded: g.grounded, why: g.why });
    }
  }
}

const market = rows.filter((r) => r.kind === "market");
const other = rows.filter((r) => r.kind !== "market");
const un = (a) => a.filter((r) => !r.grounded);
console.log(`\n${pages.length} live generated pages · ${rows.length} factual claims detected\n`);
console.log(`  MARKET   ${market.length} claims, ${un(market).length} with nothing behind them, on ${new Set(un(market).map((r) => r.slug)).size} businesses`);
console.log(`  test/int ${other.length} claims, ${un(other).length} with nothing behind them, on ${new Set(un(other).map((r) => r.slug)).size} businesses\n`);

const byShape = {};
for (const r of rows) {
  byShape[r.shape] ||= { total: 0, ungrounded: 0, market: 0, marketUngrounded: 0 };
  byShape[r.shape].total++;
  if (!r.grounded) byShape[r.shape].ungrounded++;
  if (r.kind === "market") { byShape[r.shape].market++; if (!r.grounded) byShape[r.shape].marketUngrounded++; }
}
console.log("  by claim shape (all pages · market):");
for (const [k, v] of Object.entries(byShape).sort((a, b) => b[1].ungrounded - a[1].ungrounded))
  // rateLine() splits a SET OF SLUGS by account_kind, and a claim has no account_kind of its own.
  // not-a-corpus-rate: a per-CLAIM count, not a per-business rate — and the market split is printed on the line itself
  console.log(`    ${k.padEnd(16)} ${String(v.ungrounded).padStart(4)} of ${String(v.total).padStart(4)} ungrounded   ·   market ${v.marketUngrounded} of ${v.market}`);

const which = (process.argv[2] || "market");
const show = which === "all" ? un(rows) : un(market);
console.log(`\n  EVERY UNGROUNDED CLAIM (${which}):\n`);
const seen = new Set();
for (const r of show) {
  const k = r.slug + "|" + r.claim;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`    ${r.slug.padEnd(24)} ${r.shape.padEnd(15)} ${JSON.stringify(r.claim).padEnd(42)} ${r.why}`);
}
console.log("");
