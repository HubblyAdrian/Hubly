#!/usr/bin/env node
/**
 * A RATE MAY NOT BE PRINTED WITHOUT ITS account_kind SPLIT, IN THE SAME LINE.
 *
 *   node scripts/check-denominator-rule.mjs
 *
 * CLAUDE.md has ruled since August that any number describing users, adoption or value filters
 * to `account_kind = 'market'` and states its denominator. It kept not happening — on
 * 2026-09-13 a photo rate was quoted off a corpus that is ~96% our own test drafts — because
 * the denominator lived in the record and the rate lived in the output.
 *
 * This makes the omission fail. Every `console.log` in scripts/ that prints a RATE must build
 * that line through `rateLine()` / `subsetLine()` from lib/kind-split.mjs, which throw rather
 * than format without the kinds. A statement that genuinely counts something with no
 * account_kind (a link count, a byte count, a check's own pass/fail) declares itself with
 * `// not-a-corpus-rate: <why>` on the line above, so the exemption is visible and arguable.
 *
 * Statements are extracted by BALANCED PARENS, not a line window (Lesson 39).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = process.env.HUBLY_SCRIPTS_DIR || join(ROOT, "scripts");

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));

/** Every console.log(...) call, paren-balanced, with the line it starts on. */
function logCalls(src) {
  const out = [];
  const re = /console\.(log|error)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    let d = 0, end = -1, inStr = null;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === "\\") i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "(") d++;
      else if (c === ")") { d--; if (!d) { end = i + 1; break; } }
    }
    if (end > open) out.push({ text: src.slice(m.index, end), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

/** Does this statement print a RATE — "N of M", "N / M", or a percentage? */
const RATE = [
  /\$\{[^}]*\}\s*of\s*\$\{/,                //  ${a} of ${b}
  /\$\{[^}]*\}\/\$\{/,                      //  ${a}/${b} — the rate idiom; "${a} / ${b}" with spaces is a separator
  /\bof \$\{/,                                //  ... of ${total}
  /\*\s*100\s*\)/,                            //  Math.round(n/total*100)
  /toFixed\(\s*\d\s*\)\s*\}\s*%/,             //  ${(n/t*100).toFixed(1)}%
];
const USES_HELPER = /\b(rateLine|subsetLine)\s*\(/;

/** IN SCOPE: scripts that read the BUSINESS CORPUS. A rate over gates, epics, sections or a
 *  check's own assertions has no account_kind and never did — the rule is about numbers that
 *  describe pages or businesses, and scoping it here keeps the check from becoming noise
 *  everyone exempts. The scope test is what the file READS, not its name. */
const READS_CORPUS = /from businesses\b|business_documents|account_kind|_CORPUS\b|loadKinds\(/;
let files;
try { files = readdirSync(DIR).filter((f) => f.endsWith(".mjs") && f !== "check-denominator-rule.mjs")
        .filter((f) => READS_CORPUS.test(readFileSync(join(DIR, f), "utf8"))); }
catch (e) { console.error("CANNOT RUN — cannot read " + DIR); process.exit(2); }
if (!files.length) { console.error("CANNOT RUN — no scripts found"); process.exit(2); }

const fails = [], exempt = [], ok = [];
let scanned = 0;
for (const f of files) {
  const raw = readFileSync(join(DIR, f), "utf8");
  const src = stripComments(raw);
  const rawLines = raw.split("\n");
  for (const call of logCalls(src)) {
    if (!RATE.some((re) => re.test(call.text))) continue;
    scanned++;
    if (USES_HELPER.test(call.text)) { ok.push(`${f}:${call.line}`); continue; }
    const above = (rawLines[call.line - 2] || "") + (rawLines[call.line - 1] || "");
    if (/not-a-corpus-rate:/.test(above)) { exempt.push(`${f}:${call.line}`); continue; }
    fails.push(`${f}:${call.line}  ${call.text.replace(/\s+/g, " ").slice(0, 110)}`);
  }
}

let helperLines = 0;
for (const f of files) helperLines += (readFileSync(join(DIR, f), "utf8").match(/\b(rateLine|subsetLine)\s*\(/g) || []).length;
console.log(`corpus-reading scripts in scope: ${files.length}   lines built through the formatter: ${helperLines}`);
console.log(`rate-printing statements found: ${scanned}   through the formatter: ${ok.length}   declared exempt: ${exempt.length}`);
for (const e of exempt) console.log(`  exempt  ${e}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} rate(s) printed without an account_kind split:`);
  for (const f of fails) console.error("  " + f);
  console.error(`\nUse rateLine()/subsetLine() from scripts/lib/kind-split.mjs, or mark the line\n  // not-a-corpus-rate: <why>  if it genuinely counts something with no account_kind.`);
  process.exit(1);
}
console.log(`\nPASS — every corpus rate in scripts/ carries its split.`);
