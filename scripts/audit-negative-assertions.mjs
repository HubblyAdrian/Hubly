#!/usr/bin/env node
/**
 * EVERY NEGATIVE ASSERTION IN EVERY CHECK, AND WHETHER IT COULD EVER FAIL.
 *
 *   node scripts/audit-negative-assertions.mjs
 *
 * ══ LESSON 98 ═══════════════════════════════════════════════════════════════════════════════
 *
 * A negative assertion — "this string / class / element / row is ABSENT" — is satisfied by the thing
 * not existing, which is a different reason from the thing being correctly prevented. BREAK 1 on
 * 2026-09-17 is the case: a leg asserted a line of Home's transcript was absent from the Website
 * thread, Home does not render a transcript, and the leg was green under every possible state of the
 * product. It had been written for Adrian's own bug report, which is the most dangerous place for it.
 *
 * ══ WHAT THIS CAN AND CANNOT SEE — SCOPED BEFORE THE NUMBER ═════════════════════════════════
 *
 * IT CAN SEE: a negation in an assertion expression, in any file matching scripts/check-*.mjs.
 * IT CANNOT SEE whether a break was ever aimed at that leg alone. **Nothing in this repo records
 * that.** A red-proof happens in a terminal and lives in a commit message, in prose, if anywhere. So
 * the count this file reports is *negative assertions with NO RECORDED INDIVIDUAL RED-PROOF*, and for
 * all but a handful that is the same as "never individually red-proofed" — but it is an absence of
 * EVIDENCE, not evidence of absence, and those are different claims (the empty-reader rule).
 *
 * The one thing it can check mechanically is the tell that BREAK 1 had: **a negative assertion whose
 * subject is a LITERAL STRING that appears nowhere in the product.** If a check asserts that
 * "HOME-ONLY-TRANSCRIPT-LINE" is absent and no file under public/ or supabase/functions/ can ever
 * emit it, the assertion is unfalsifiable by construction and that is provable from here.
 *
 * Exit: 0 — a sweep. It produces CANDIDATES; a candidate graduates by a break being aimed at it.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKS = readdirSync(join(ROOT, "scripts")).filter((f) => f.startsWith("check-") && f.endsWith(".mjs"));

/* ── THE PRODUCT'S OWN TEXT, so "could this string ever be emitted" is answerable ───────────── */
const productFiles = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  if (f.name === "node_modules" || f.name.startsWith(".")) continue;
  const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (/\.(ts|js|html)$/.test(f.name)) productFiles.push(p);
} };
walk(join(ROOT, "public")); walk(join(ROOT, "supabase/functions"));
if (existsSync(join(ROOT, "api"))) walk(join(ROOT, "api"));
const PRODUCT = productFiles.map((p) => readFileSync(p, "utf8")).join("\n");
console.log(`  product surface searched: ${productFiles.length} file(s) under public/, supabase/functions/, api/\n`);

/* ── THE NEGATION FORMS. Enumerated as the SMALL side, and the small side is the assertion
      expression: a leg's truth value. Anything else in a check is setup, not a claim. ───────── */
const FORMS = [
  { id: "!includes",   rx: /!\s*[\w.$[\]()"'`]*\.includes\(([^)]*)\)/g },
  { id: "!some",       rx: /!\s*[\w.$[\]()"'`]*\.some\(/g },
  { id: "!test",       rx: /!\s*\/((?:[^\/\\\n]|\\.)+)\/[a-z]*\.test\(/g },
  { id: "!match",      rx: /!\s*[\w.$[\]()"'`]*\.match\(/g },
  { id: "!querySel",   rx: /!\s*[\w.$]*\.?querySelector\(([^)]*)\)/g },
  { id: "!contains",   rx: /!\s*[\w.$[\]()"'`]*\.contains\(([^)]*)\)/g },
  { id: "=== null",    rx: /===\s*null\b/g },
  { id: "length === 0",rx: /\.length\s*===\s*0\b/g },
  { id: "!length",     rx: /!\s*[\w.$[\]()]*\.length\b/g },
  { id: "=== 0",       rx: /\b(?:count|n|hits|found|bad|leaks?|rows?)\s*===\s*0\b/gi },
  // `!/re/.test(` IS ALREADY `!test`. Having both forms double-counted the same 99 constructs and
  // reported 351 where the real figure is 252 — an inflated count in a sweep whose whole subject is
  // assertions that cannot be trusted. Deduped by dropping the narrower form and, below, by position.
];

/** Is this line an ASSERTION, or setup? A leg's assertion is the argument to the reporter. */
const ASSERTING = /\b(say|leg|assert|expect|ok\s*[:=]|pass\s*[:=]|report)\s*\(|\bpass:|\bok:/;

const rows = [];
const seen = new Set();
for (const f of CHECKS) {
  const src = readFileSync(join(ROOT, "scripts", f), "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue;                 // a comment is not an assertion
    // A leg's assertion can wrap onto the next lines; look at a 3-line window for the reporter call.
    const win = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
    if (!ASSERTING.test(win)) continue;
    for (const form of FORMS) {
      form.rx.lastIndex = 0;
      let m;
      while ((m = form.rx.exec(L))) {
        const subject = (m[1] || "").trim();
        const at = `${f}:${i + 1}:${m.index}`;
        if (seen.has(at)) continue;                 // one construct, one row, whatever matched it
        seen.add(at);
        rows.push({ file: f, line: i + 1, col: m.index, form: form.id, subject, text: L.trim().slice(0, 150) });
      }
    }
  }
}

/* ── THE ONE MECHANICAL TELL: a literal the product can never emit ──────────────────────────── */
const literal = (s) => {
  const m = String(s || "").match(/^["'`]([^"'`]{6,})["'`]$/);
  return m ? m[1] : null;
};
const unfalsifiable = [];
for (const r of rows) {
  const lit = literal(r.subject);
  if (!lit) continue;
  if (/[<>#.\[\]]/.test(lit) && !/\s/.test(lit)) continue;       // a selector, not a message
  if (PRODUCT.includes(lit)) continue;
  // ...OR THE CHECK'S OWN FIXTURE. "Can the product emit this" is the wrong question for a value the
  // CHECK plants. check-list-surfaces asserts that the customer names "Already booked" and
  // "Submitted, waiting on him" are NOT in the leads list, and it seeds exactly those two names as
  // rows that must be excluded — so the leg is perfectly falsifiable and this sweep called it
  // unfalsifiable. A false alarm from a sweep about untrustworthy assertions is the worst kind.
  const ownSrc = readFileSync(join(ROOT, "scripts", r.file), "utf8");
  const plantedHere = ownSrc.split("\n").filter((_, n) => n + 1 !== r.line).join("\n").includes(lit);
  if (plantedHere) continue;
  unfalsifiable.push({ ...r, lit });
}

/* ── PURELY NEGATIVE LEGS — the mechanical signal for "worst by consequence" ──────────────────
   A leg with a negation AND a positive clause needs something to actually be there, so it cannot
   pass on an empty or dead surface. A leg whose every clause is a negation passes on a blank page,
   a failed load, an unrendered room — and it is the shape that BREAK 1 had. */
/** Does this assertion window contain a clause that requires something to BE there?
 *
 *  Written as a scan rather than one regex because the one-regex version produced false positives —
 *  it missed `line === gap.say` (equality against an expression rather than a literal), a bare
 *  `/2:00 PM/.test(text)` sitting a line outside the window, and `!!writerBody`. Reporting a leg with
 *  a positive clause as purely negative is the same false-alarm class this sweep exists to find, so
 *  the detector gets the same scepticism as the legs it judges. */
function hasPositiveClause(win) {
  // `.test(` / `.includes(` / `.some(` / `.contains(` NOT negated
  if (/(?<![!\w])(?:\/(?:[^\/\\\n]|\\.)+\/[a-z]*|[\w.$\])"'`]+)\.(?:test|includes|some|contains)\(/.test(
        win.replace(/![\s]*(?:\/(?:[^\/\\\n]|\\.)+\/[a-z]*|[\w.$\[\]()"'`]+)\.(?:test|includes|some|contains)\(/g, " NEG( "))) return true;
  // an equality against anything that is not a falsy sentinel
  for (const m of win.matchAll(/===\s*([^\s,;)&|]+)/g)) {
    const rhs = m[1];
    if (!/^(null|0|false|undefined|""|''|``|\[\])$/.test(rhs)) return true;
  }
  if (/!!/.test(win)) return true;                          // an explicit truthiness assertion
  if (/\.length\s*(?:>|>=)\s*\d|>\s*0\b|>=\s*1\b/.test(win)) return true;
  if (/\btrue\b/.test(win)) return true;
  return false;
}
const purelyNegative = [];
for (const r of rows) {
  const src = readFileSync(join(ROOT, "scripts", r.file), "utf8").split("\n");
  const win = src.slice(Math.max(0, r.line - 3), r.line + 3).join(" ");
  if (!hasPositiveClause(win)) purelyNegative.push({ ...r, win: win.replace(/\s+/g, " ").trim().slice(0, 170) });
}

const byFile = {};
for (const r of rows) (byFile[r.file] = byFile[r.file] || []).push(r);

console.log(`NEGATIVE ASSERTIONS IN ${CHECKS.length} CHECK FILES: ${rows.length}, across ${Object.keys(byFile).length} file(s).\n`);
console.log(`NONE OF THEM HAS A RECORDED INDIVIDUAL RED-PROOF, because nothing in this repo records`);
console.log(`one — a red-proof happens in a terminal and survives, if at all, as prose in a commit`);
console.log(`message. So: ${rows.length} negative assertions with no recorded break aimed at them alone.`);
console.log(`That is an absence of EVIDENCE. It is not proof none was ever done.\n`);

console.log(`BY FORM:`);
const byForm = {};
for (const r of rows) byForm[r.form] = (byForm[r.form] || 0) + 1;
for (const [k, n] of Object.entries(byForm).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log(`\nPROVABLY UNFALSIFIABLE — a literal the product cannot emit: ${unfalsifiable.length}`);
for (const u of unfalsifiable) console.log(`  ${u.file}:${u.line}  "${u.lit}"\n      ${u.text}`);
if (!unfalsifiable.length) console.log(`  none. SCOPED: this tests only string literals of 6+ chars that appear in an`);
if (!unfalsifiable.length) console.log(`  assertion's own expression. A negation over a VARIABLE holding such a string is invisible here —`);
if (!unfalsifiable.length) console.log(`  and BREAK 1's own leg used a variable, so this tell would NOT have caught it.`);

console.log(`\nPURELY NEGATIVE LEGS — every clause a negation, nothing positive required: ${purelyNegative.length}`);
console.log(`These are the worst by consequence: a leg with a positive clause beside its negation cannot`);
console.log(`pass on a blank page or a failed load, and one without cannot tell those from success. It is`);
console.log(`the shape BREAK 1 had.\n`);
for (const u of purelyNegative.slice(0, 40)) console.log(`  ${u.file}:${u.line}  [${u.form}]\n      ${u.win}`);
if (purelyNegative.length > 40) console.log(`  … and ${purelyNegative.length - 40} more`);

console.log(`\nDENSEST FILES (where a compound break is most likely to have hidden a green leg):`);
for (const [f, rs] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length).slice(0, 12))
  console.log(`  ${String(rs.length).padStart(3)}  ${f}`);
