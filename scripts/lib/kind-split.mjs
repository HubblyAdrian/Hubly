/**
 * A RATE MAY NOT BE PRINTED WITHOUT ITS account_kind SPLIT, IN THE SAME LINE.
 *
 * CLAUDE.md already rules that any number describing users, adoption or value filters to
 * `account_kind = 'market'` and states its denominator. It kept not happening, because the
 * denominator lived in the record and the rate lived in the output — and on 2026-09-13 a photo
 * rate was quoted off a corpus that is ~96% our own test drafts.
 *
 * So the rule is enforced HERE, at the only place a rate is allowed to be formatted:
 * `rateLine()` throws if it is not given the kinds. There is no way to print "139 of 172 (81%)"
 * from these scripts without "market 6 · test 165 · internal 1" standing next to it.
 *
 *   import { loadKinds, rateLine, splitOf } from "./lib/kind-split.mjs";
 *   const kinds = loadKinds();                       // slug -> account_kind, from the DB
 *   console.log(rateLine("pages with images", 139, slugs, kinds));
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDER = ["market", "internal", "test"];   // market first: it is the only one that can carry a rate

/** FIXTURES ARE NOT THE CORPUS. `hubly-paging-fixture` holds 250 customers, 250 jobs and 250
 *  booking_requests — roughly 25x everything real (jobs 5, customers 17, booking_requests 31
 *  before it existed). Any count or rate computed without excluding it is meaningless, and
 *  SETTLED #8 saying so is prose, which decays. So the rule lives here, beside the split, and
 *  a caller either excludes them or DECLARES the inclusion in its own output. */
export const FIXTURE_SLUGS = new Set(["hubly-paging-fixture", "hubly-classic-fixture"]);

/** Drop fixture rows from a corpus. Returns the kept items and prints what it removed —
 *  silence would make an exclusion indistinguishable from a corpus that had none. */
export function withoutFixtures(items, keyOf = (x) => (typeof x === "string" ? x : x && x.slug)) {
  const kept = [], dropped = [];
  for (const it of items) (FIXTURE_SLUGS.has(keyOf(it)) ? dropped : kept).push(it);
  console.log(`  fixtures excluded: ${dropped.length}${dropped.length ? " (" + dropped.map(keyOf).join(", ") + ")" : ""}  ·  corpus: ${kept.length}`);
  return kept;
}

/** slug -> account_kind, straight from the database. Never cached to a file: a reused export
 *  silently undercounts, which is the standing rule for every corpus sweep. */
export function loadKinds() {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    "select slug, account_kind from businesses"], { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const i = out.indexOf('"rows"');
  if (i < 0) throw new Error("could not read account_kind from the database");
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  const map = new Map();
  for (const r of JSON.parse(out.slice(s, e))) map.set(r.slug, r.account_kind);
  if (!map.size) throw new Error("account_kind map came back empty");
  return map;
}

/** The split of a set of slugs (or of rows that already carry account_kind). */
export function splitOf(items, kinds) {
  const counts = {};
  let unknown = 0;
  for (const it of items) {
    const k = typeof it === "string" ? (kinds && kinds.get(it)) : (it.account_kind || it.kind_of_account || (kinds && kinds.get(it.slug)));
    if (!k) { unknown++; continue; }
    counts[k] = (counts[k] || 0) + 1;
  }
  if (unknown) counts.unknown = unknown;
  return counts;
}

/** "label: 139 of 172 (81%)   market 6 · internal 1 · test 165"
 *  THROWS rather than printing a bare rate — the whole point of this module. */
/** TWO WEBSITE STORES, and a claim about "pages" that does not say which one is not a claim.
 *  `business_documents.rendered_html` is freeform — 173 of 174 pages, and everything built in
 *  September targets it. `businesses.meta` is the classic renderer's content model, and it is
 *  what the only paying customer serves. Same enforcement shape as the account_kind split:
 *  a rate about pages states its store or throws. */
export const PAGE_STORES = new Set(["business_documents", "businesses.meta", "both"]);

export function rateLine(label, n, denominatorItems, kinds, opts = {}) {
  if (/\bpages?\b/i.test(label)) {
    if (!opts.store) {
      throw new Error(`rateLine("${label}") counts PAGES without naming its store. ` +
        `Pass { store: "business_documents" | "businesses.meta" | "both" } — there are two, ` +
        `and the live customer is on the one most code ignores (SETTLED #2).`);
    }
    if (!PAGE_STORES.has(opts.store)) {
      throw new Error(`rateLine("${label}") store "${opts.store}" is not one of: ${[...PAGE_STORES].join(", ")}`);
    }
  }
  // A RATE OVER A CORPUS THAT STILL CONTAINS A FIXTURE IS NOT A RATE. The caller either
  // excluded them, or says `includesFixtures: true` and wears it in the output.
  if (Array.isArray(denominatorItems) && !opts.includesFixtures) {
    const key = (x) => (typeof x === "string" ? x : x && x.slug);
    const inside = denominatorItems.filter((x) => FIXTURE_SLUGS.has(key(x)));
    if (inside.length) {
      throw new Error(`rateLine("${label}") includes ${inside.length} FIXTURE row(s) (${inside.map(key).join(", ")}). ` +
        `Call withoutFixtures() first, or pass { includesFixtures: true } to say so in the output.`);
    }
  }
  if (!Array.isArray(denominatorItems) || !denominatorItems.length) {
    throw new Error(`rateLine("${label}") needs the denominator's ITEMS, not just a count — the split is computed from them`);
  }
  const total = denominatorItems.length;
  const counts = splitOf(denominatorItems, kinds);
  const named = Object.keys(counts).filter((k) => k !== "unknown");
  if (!named.length) {
    throw new Error(`rateLine("${label}") has no account_kind for any of its ${total} items. A rate without its split may not be printed (CLAUDE.md).`);
  }
  const parts = [...ORDER.filter((k) => counts[k]), ...named.filter((k) => !ORDER.includes(k)).sort()]
    .map((k) => `${k} ${counts[k]}`);
  if (counts.unknown) parts.push(`unknown ${counts.unknown}`);
  const pct = total ? Math.round((n / total) * 100) : 0;
  const warn = opts.includesFixtures ? "   [INCLUDES FIXTURE ROWS]" : "";
  const store = opts.store ? `   [store: ${opts.store}]` : "";
  return `${label}: ${n} of ${total} (${pct}%)   ${parts.join(" · ")}${store}${warn}`;
}

/** For a rate over a SUBSET whose own split matters more than the denominator's
 *  (e.g. "16 pages diverge — of which market 1"). Same refusal. */
export function subsetLine(label, items, kinds) {
  const counts = splitOf(items, kinds);
  const named = Object.keys(counts).filter((k) => k !== "unknown");
  if (items.length && !named.length) throw new Error(`subsetLine("${label}") has no account_kind for any item`);
  const parts = [...ORDER.filter((k) => counts[k]), ...named.filter((k) => !ORDER.includes(k)).sort()].map((k) => `${k} ${counts[k]}`);
  if (counts.unknown) parts.push(`unknown ${counts.unknown}`);
  return `${label}: ${items.length}   ${parts.join(" · ") || "(none)"}`;
}
