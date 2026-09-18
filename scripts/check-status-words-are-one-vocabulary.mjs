#!/usr/bin/env node
/**
 * [RULE] THE STATUS VOCABULARY LIVES IN ONE PLACE, AND ITS KEYS ARE THE DATABASE'S.
 *
 *   node scripts/check-status-words-are-one-vocabulary.mjs
 *
 * ══ FOUND BY MEASUREMENT, NOT BY SUSPICION ══════════════════════════════════════════════════
 *
 * The two-of-everything audit's SECOND signal — the same user-visible SENTENCE appearing verbatim in
 * both shells — returned 17 hits with zero noise, against my own prediction that it would flood. The
 * most important: `'Not sent yet'`, `'Waiting on them'`, `'They said yes'`, `'They said no'` existed
 * TWICE, hand-maintained, in `public/hubly.html` (renderQuotesFromRecord) and `public/platform-home.html`
 * (HC_STATUS_WORDS.quote). **A user-visible vocabulary duplicated by hand means the two shells can
 * disagree about what a quote's status is CALLED — to the same owner, about the same record.**
 *
 * They live in `public/status-words.js` now, loaded by both shells.
 *
 * ══ THREE LEGS, AND EACH GUARDS A DIFFERENT WAY THIS COMES BACK ═════════════════════════════
 *
 *   1. NEITHER SHELL HOLDS A LITERAL COPY. The duplication returning is one paste away.
 *   2. BOTH SHELLS LOAD THE ONE FILE. A shell reading `window.HUBLY_STATUS_WORDS` without loading it
 *      gets `undefined`, falls back, and shows raw statuses — silent-undefined, the route-list shape.
 *      This is why a new root-level script was only safe once `api/router.js` derived from
 *      `fs.existsSync` (router.js:237) and `check-root-scripts-are-served` existed: `contact-pick.js`
 *      shipped, was missing from a hand-written list of three, and was answered with 3MB of HTML.
 *   3. THE KEYS ARE THE CONSTRAINT. `quotes.status` carries a CHECK constraint, so the key set is the
 *      database's and not five words somebody imagined. A sixth status added in SQL would otherwise
 *      leave a word missing and read as an empty cell.
 *
 * SCOPED: this covers the QUOTE vocabulary, which is the one the sentence signal found duplicated. The
 * other vocabularies in HC_STATUS_WORDS (job, lead) are not yet duplicated — measured by the same
 * signal, which found no shared sentence from them — and are not moved.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, declareBreak } from "./lib/redproof.mjs";

const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const one = readFileSync(join(ROOT, "public/status-words.js"), "utf8");
const shells = ["public/hubly.html", "public/platform-home.html"];
const src = Object.fromEntries(shells.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));

/* THE WORDS, from the one place. */
const words = Object.fromEntries([...one.matchAll(/^\s*([a-z]+):\s*"([^"]+)",/gm)].map((m) => [m[1], m[2]]));

declareBreak({
  leg: "neither shell holds its own copy of the words",
  why: "paste the five words back into hubly.html as a literal — the duplication this file exists to " +
       "prevent, and it is one paste away at all times",
  file: "public/hubly.html",
  find: "  const words=(window.HUBLY_STATUS_WORDS&&window.HUBLY_STATUS_WORDS.quote)||{};",
  with: "  const words={draft:'Not sent yet',sent:'Waiting on them',accepted:'They said yes',declined:'They said no',expired:'Ran out'};",
});

const copies = [];
for (const f of shells) {
  const body = src[f];
  for (const [k, w] of Object.entries(words)) {
    // A LITERAL COPY, not a mention. The comments in both shells NAME these words to explain the
    // move, so a bare substring search would match the explanation — the 2026-09-16 scar where an
    // absence marker matched the comment describing a deletion. A copy is the word inside a quoted
    // string on a line that is not a comment.
    for (const line of body.split("\n")) {
      if (/^\s*(\/\/|\*|\/\*|--|<!--)/.test(line)) continue;
      if (new RegExp(`['"\`]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\`]`).test(line)) copies.push(`${f}: "${w}"`);
    }
  }
}
leg("RULE", "neither shell holds its own copy of the words",
  Object.keys(words).length >= 5 && copies.length === 0,
  `${Object.keys(words).length} word(s) read from public/status-words.js — the count is part of the ` +
  `assertion, because "no copies" is trivially true if the one place is empty — and ${copies.length} ` +
  `literal cop(ies) in the two shells` + (copies.length ? `: ${[...new Set(copies)].join(", ")}` : ""));

// ONLY THE SHELLS THAT READ IT, which narrows this leg to its own subject. Leg 1's break — pasting a
// literal copy back into hubly.html — also DELETES the read, so a leg that required every shell to
// contain one fired alongside leg 1 and proved nothing about either (L98). Whether a shell that does
// not read it should is leg 1's question, not this one's.
const readers = shells.filter((f) => src[f].includes("HUBLY_STATUS_WORDS.quote"));
const loads = readers.filter((f) => /<script[^>]+src="\/status-words\.js"/.test(src[f]));
const ordered = readers.filter((f) => {
  const at = src[f].indexOf('src="/status-words.js"');
  return at >= 0 && at < src[f].indexOf("HUBLY_STATUS_WORDS.quote");
});
leg("RULE", "every shell that reads the vocabulary loads it first",
  readers.length > 0 && loads.length === readers.length && ordered.length === readers.length,
  `${readers.length} shell(s) read window.HUBLY_STATUS_WORDS.quote — the count is part of the ` +
  `assertion, because "all of them load it" is trivially true of none — ${loads.length} load ` +
  `/status-words.js and ${ordered.length} load it BEFORE the read. A shell that reads it without ` +
  `loading it gets undefined, falls back, and shows raw statuses; nothing errors, which is the ` +
  `route-list failure mode. This bit twice while being built: first loaded beside contact-pick.js ` +
  `(after platform-home's definition), then anchored on a charset tag inside a generated-document ` +
  `template literal at byte 2.7M, where the shell never loaded it at all.`);

let constraintKeys = null;
try {
  const out = execFileSync("supabase", ["db", "query", "--linked",
    `select pg_get_constraintdef(c.oid) as d from pg_constraint c join pg_class t on t.oid=c.conrelid
      where t.relname='quotes' and c.contype='c' and pg_get_constraintdef(c.oid) ilike '%status%'`],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  const defs = JSON.parse(out.slice(s, e)).map((r) => r.d).join(" ");
  const found = [...defs.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
  if (found.length) constraintKeys = [...new Set(found)].sort();
} catch (_) { /* reported below */ }

leg("RULE", "the key set is the database's CHECK constraint, not five words somebody imagined",
  constraintKeys !== null && constraintKeys.length > 0 &&
  JSON.stringify(constraintKeys) === JSON.stringify(Object.keys(words).sort()),
  constraintKeys === null
    ? `the CHECK constraint on quotes.status could not be READ, so this leg asserts nothing and says ` +
      `so rather than passing. An unreadable constraint is not an agreeing one.`
    : `constraint: ${constraintKeys.join(", ")} · vocabulary: ${Object.keys(words).sort().join(", ")}. ` +
      `A status added in SQL and not here would render as an empty cell; one here and not in SQL is a ` +
      `word for a state the column cannot hold.`);

const bad = legs.filter((l) => !l.pass);
console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
