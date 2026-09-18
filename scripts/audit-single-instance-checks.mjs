#!/usr/bin/env node
/**
 * LESSON 97, TURNED ON OUR OWN CHECKS.
 *
 *   node scripts/audit-single-instance-checks.mjs
 *
 * "A CHECK THAT COVERS ONE INSTANCE OF A SURFACE COVERS NONE OF THEM." This finds the checks that
 * make a claim about a multi-instance surface while touching one instance of it.
 *
 * ══ THIS PRODUCES CANDIDATES, NOT FINDINGS ══════════════════════════════════════════════════
 *
 * A grep cannot see intent. A check named "check-graefs-page" is about ONE business on purpose and
 * is not defective for it; a check that loads one shell to assert something about that shell's own
 * markup is correct. The sweep cannot tell those from a check whose title says "every" and whose
 * body visits one. So the output is a CANDIDATE LIST, and a candidate graduates only by being ACTED
 * ON — opened, extended to a second instance, and seen to pass or fail there. Reported as
 * "N candidates", never "N confirmed" (CLAUDE.md; Lesson 94).
 *
 * ══ THE INSTANCE DIMENSIONS ARE DERIVED, NOT LISTED ═════════════════════════════════════════
 *
 * It would be absurd to audit for hand-maintained sets using a hand-maintained set. Each dimension
 * below is read from the product at run time:
 *   SHELLS  the files in public/ that carry the claimed-owner seam (fs, not a filename)
 *   PLACES  HC_PLACE_SURFACES, parsed out of the shipping file
 *   ROOMS   HC_ROOMS, same
 *   STORES  the two page stores, by the column each is read through
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");

/* ── DIMENSION 1: THE SHELLS. Which files in public/ actually are a shell? ─────────────────── */
// A SHELL is a page in public/ that carries the hc* application layer — the thing that has two
// copies of almost everything. Measured rather than named: platform-home.html has 184 of these
// markers and hubly.html has 4, while every other page in public/ has ZERO, so the threshold is
// "any at all" and the set comes back as exactly the two we already know are the hazard. The first
// version of this looked for hcRevealApp/hcOpenWorkspace and found ONE shell, because those live
// only in platform-home — a derivation that answers "1" for a two-instance surface is the same
// false universal this audit is looking for, arriving in the audit.
const shells = readdirSync(PUB).filter((f) => f.endsWith(".html")).filter((f) => {
  const s = readFileSync(join(PUB, f), "utf8");
  return /hcAppendMessage|hcPersist\(|window\.hubly[A-Z]/.test(s);
});

/* ── DIMENSIONS 2-3: THE PLACES AND ROOMS, parsed out of platform-home.html ────────────────── */
const SRC = readFileSync(join(PUB, "platform-home.html"), "utf8");
const block = (name) => {
  const i = SRC.indexOf("var " + name + " = {");
  if (i < 0) return [];
  let d = 0, j = SRC.indexOf("{", i);
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === "{") d++; else if (SRC[k] === "}") { d--; if (!d) { j = k; break; } }
  }
  // TOP-LEVEL KEYS ONLY, AT ANY INDENTATION. Two bugs in two versions of this one parser, and both
  // were silent: requiring four leading spaces returned ZERO keys for HC_ROOMS (a one-line literal),
  // and then not tracking depth returned `label` and `icon` — the keys of the objects INSIDE
  // HC_PLACE_SURFACES — as if they were places. A dimension that answers 0 or answers 8 for a
  // 6-member set contributes noise either way, and neither said a word about it.
  // COMMENTS OUT FIRST. `leads:` in HC_PLACE_SURFACES sits after a nine-line comment, so the
  // character before it is the `/` of `*/` and the delimiter test rejected it — 5 places instead of
  // 6, and the one it lost is the surface added most recently. FOURTH bug in this one parser, and
  // every one of them undercounted SILENTLY. The lesson is in the file it audits: a matcher written
  // against the shapes you have already seen loses the next shape, and loses it quietly.
  const body = SRC.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  // THE DELIMITER IS LOOKED AT, NOT CONSUMED. Third bug in this parser: `/[{}]|(?:^|[{,])\s*key:/`
  // let the brace alternative EAT the `{`, so the first key of a one-line literal had no delimiter
  // left in front of it — `HC_ROOMS` came back as 4 rooms instead of 5, missing `planner`, which is
  // the one every other reader of that map starts with.
  const keys = [];
  let depth = 0;
  for (const m of body.matchAll(/[{}]|([a-z_][a-z0-9_]*)\s*:/gi)) {
    if (m[0] === "{") { depth++; continue; }
    if (m[0] === "}") { depth--; continue; }
    if (!m[1] || depth !== 1) continue;
    const before = body.slice(0, m.index).replace(/\s+$/, "").slice(-1);
    if (before === "{" || before === ",") keys.push(m[1]);
  }
  return keys.filter((k, n, a) => a.indexOf(k) === n);
};
const places = block("HC_PLACE_SURFACES");
const rooms = block("HC_ROOMS");
// THE TWO PAGE STORES, by a marker that cannot mean anything else. The first version used the
// bare word "meta" for the classic store and matched <meta> tags, "metadata" and local variables —
// it put check-no-db-push.mjs on the candidate list, which is how you know a marker is a word and
// not a signal. `service_catalog` is the classic store's content key; `business_documents` /
// `rendered_html` is the freeform one.
const stores = [
  { name: "freeform (business_documents.rendered_html)", rx: /business_documents|rendered_html/ },
  { name: "classic (businesses.meta.service_catalog)", rx: /service_catalog/ },
];

if (shells.length < 2 || places.length < 2) {
  console.error(`CANNOT RUN — derived ${shells.length} shell(s) and ${places.length} place(s); ` +
    `a dimension with fewer than two instances cannot have a single-instance defect, so either the ` +
    `product changed shape or this parser did.`);
  process.exit(2);
}
console.log(`DERIVED FROM THE PRODUCT`);
console.log(`  shells (${shells.length}): ${shells.join(", ")}`);
console.log(`  places (${places.length}): ${places.join(", ")}`);
console.log(`  rooms  (${rooms.length}): ${rooms.join(", ")}`);
console.log(`  page stores (${stores.length}): ${stores.map((s) => s.name).join(" · ")}\n`);

/* ── A UNIVERSAL CLAIM. What makes a check's own words cover a class rather than a case. ───── */
const UNIVERSAL = /\b(every|all|any|each|never|no\s+\w+\s+(may|can|is|are)|both)\b/i;

/* ── THE FUNCTIONS THAT EXIST TWICE. This is the two-of-everything hazard, counted. ───────── */
const fnsIn = (f) => new Set([...readFileSync(join(PUB, f), "utf8")
  .matchAll(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]));
const fnSets = shells.map(fnsIn);
const SHARED_FNS = new Set([...fnSets[0]].filter((n) => fnSets.every((s) => s.has(n))));
console.log(`  functions defined in BOTH shells: ${SHARED_FNS.size} ` +
  `(${shells.map((f, i) => f + " has " + fnSets[i].size).join(", ")})\n`);

const files = readdirSync(join(ROOT, "scripts")).filter((f) => f.startsWith("check-") && f.endsWith(".mjs"));
const rows = [];
for (const f of files) {
  const src = readFileSync(join(ROOT, "scripts", f), "utf8");
  const head = src.slice(0, 2600);                 // the file's own statement of what it asserts
  const claimsUniversal = UNIVERSAL.test(head) || UNIVERSAL.test(f.replace(/-/g, " "));
  // DERIVES? A check that reads the registry is covered whatever the registry holds.
  const derives = /hublyListUI\s*\.\s*surfaces|hublyNavUI\s*\.\s*surfaces|HC_PLACE_SURFACES|HC_ROOMS|readdirSync|existsSync/.test(src);

  const dims = [];
  /* ══ "TOUCHES ONE SHELL" IS NOT A DEFECT BY ITSELF ═════════════════════════════════════════
     The first version of this dimension flagged any check that named one shell, and produced 63
     candidates most of which were correct as written: this very file's landing check is about
     platform-home's landing, and hubly.html has no landing to test. A candidate list that is
     mostly noise gets skimmed, and a skimmed list is worse than a short one.

     THE REAL QUESTION IS WHETHER THE THING BEING ASSERTED EXISTS IN BOTH SHELLS. That is
     measurable: take the identifiers the check names, keep the ones that appear in BOTH shell
     files, and a check that names such an identifier while reading only one shell is asserting
     about a two-instance surface from one instance. If every identifier it names lives in one
     shell only, the check is correctly scoped and is not a candidate at all. */
  const shellsHit = shells.filter((s) => src.includes(s));
  if (shellsHit.length === 1) {
    // AND THE IDENTIFIER MUST BE CODE, NOT PROSE. The version before this one took every long word
    // in the check and asked whether it appeared in both shell files — so it "found" `business`,
    // `Measured` and `VERBATIM`, which are English in the comments of two heavily-commented files.
    // Third time in one sitting that a matcher found prose ABOUT the thing instead of the thing.
    // SHARED_FNS is the set of function names DEFINED in both shells: that is what "this capability
    // exists twice" actually means, and it is what a check asserting about one copy is missing.
    const named = new Set([...src.matchAll(/\b(hc[A-Za-z0-9_]{3,}|[a-z][A-Za-z0-9_]{5,})\s*\(/g)].map((m) => m[1]));
    const inBoth = [...named].filter((t) => SHARED_FNS.has(t));
    if (inBoth.length) dims.push({ dim: "shells", of: shells.length, hit: shellsHit,
      why: `names ${inBoth.length} function(s) DEFINED IN BOTH shells: ` + inBoth.slice(0, 6).join(", ") });
  }
  const placesHit = places.filter((p) => new RegExp(`["'\`/#]${p}\\b|\\b${p}["'\`]`).test(src));
  if (placesHit.length) dims.push({ dim: "places", of: places.length, hit: placesHit });
  const storesHit = stores.filter((s) => s.rx.test(src)).map((s) => s.name);
  if (storesHit.length) dims.push({ dim: "page stores", of: stores.length, hit: storesHit });

  const partial = dims.filter((d) => d.hit.length === 1 && d.of > 1);
  if (partial.length && claimsUniversal && !derives) {
    rows.push({ f, partial, dims });
  }
}

console.log(`${rows.length} CANDIDATE(S) — a universal claim in the file's own words, one instance touched,`);
console.log(`and no run-time derivation of the instance list. Verified by use: 0. Sorted by how many`);
console.log(`dimensions are single-instance, then by name.\n`);
rows.sort((a, b) => b.partial.length - a.partial.length || a.f.localeCompare(b.f));
for (const r of rows) {
  console.log(`  ${r.f}`);
  // not-a-corpus-rate: dimensions of one check, not businesses
  for (const d of r.partial) console.log(`      ${d.dim}: touches ${d.hit[0]} — 1 of ${d.of}` +
    (d.why ? `\n          ${d.why}` : ""));
}
console.log(`\nNOT a defect list. Each one has to be opened and extended to a second instance before`);
console.log(`anything about it is a finding.`);
