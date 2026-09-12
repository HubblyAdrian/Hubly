#!/usr/bin/env node
/**
 * EVIDENCE THAT IS COMPUTED MUST REACH THE RESULT.
 *
 * On 2026-09-12 `placeServicesInFreeform` computed `verifiedPlaced` exactly right — a
 * service counts as placed only if its name AND its price are in the bytes about to be
 * saved — and `applyServicesToFreeform` returned without it. One absent field in one
 * return statement. `composeServicesTruth` then fell back to the REPORTED list and told an
 * owner "Interior and exterior window cleaning $220, Screen cleaning $60 and Hard water
 * removal $140 are on your page now." There is no $220 anywhere in that document.
 *
 * Lesson 11 says claim the page only when the value was verified in the rendered bytes.
 * The verification existed and worked. It was discarded one function later, which is worse
 * than never writing it: a check nobody runs looks exactly like a check that passes.
 *
 * THE RULE: a `verified*` value computed inside a function must reach that function's
 * returned object — as a field, or inside an expression that becomes a field. Evidence
 * that cannot leave the function where it was gathered cannot be acted on anywhere else.
 *
 * It red-proofs its own detector on every run against two fixtures, and exits 2 if it
 * cannot tell them apart.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(ROOT, "supabase/functions/_shared");

/** Strip comments: a name mentioned in prose is not a name reaching a return.
 *  (Lesson 39 — a scanner that does not tokenise the way the compiler does reports
 *  coverage it does not have.) */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));
}

/** Function bodies, by brace balance from each declaration. */
function functions(src) {
  const out = [];
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    // PAST THE PARAMETER LIST FIRST. A parameter can be an object TYPE — 
    // `services: { name: string; price?: number }[]` — and the first `{` after the
    // function name is then inside the signature, not the body. The first version of
    // this check did exactly that, extracted a body of parameter types, found no
    // `return {` in it, and passed everything. It reported "2 verification values,
    // all carried" and did not move when the field it was written to catch was
    // deleted. Same mis-tokenising as the phrase net (Lesson 39), one day later.
    let p = m.index + m[0].length - 1, depth = 0, close = -1;
    for (let i = p; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") { depth--; if (!depth) { close = i; break; } }
    }
    if (close < 0) continue;
    const open = src.indexOf("{", close);
    if (open < 0) continue;
    let d = 0, end = -1;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") d++;
      else if (src[i] === "}") { d--; if (!d) { end = i; break; } }
    }
    if (end > open) out.push({ name: m[1], body: src.slice(open, end), at: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

/** Every `return { … }` object literal in a body, as text. */
function returnedObjects(body) {
  const out = [];
  const re = /return\s*\{/g;
  let m;
  while ((m = re.exec(body))) {
    let d = 0, end = -1;
    for (let i = m.index + m[0].length - 1; i < body.length; i++) {
      if (body[i] === "{") d++;
      else if (body[i] === "}") { d--; if (!d) { end = i; break; } }
    }
    if (end > 0) out.push(body.slice(m.index, end + 1));
  }
  return out;
}

function analyse(src, file) {
  const code = stripComments(src);
  const findings = [];
  for (const fn of functions(code)) {
    const computed = [...new Set([...fn.body.matchAll(/(?:const|let)\s+(verified\w*)\s*=/g)].map((m) => m[1]))];
    if (!computed.length) continue;
    const objs = returnedObjects(fn.body);
    if (!objs.length) continue;                 // reports nothing; nothing to carry it in
    for (const name of computed) {
      const reaches = objs.some((o) => new RegExp(`\\b${name}\\b`).test(o));
      if (!reaches) findings.push({ file, fn: fn.name, at: fn.at, name, objs: objs.length });
    }
  }
  return findings;
}

// ── RED-PROOF, EVERY RUN ──────────────────────────────────────────────────────
const GOOD = `function f(){ const verifiedPlaced = xs.filter(ok); return { status, verifiedPlaced, n: 1 }; }`;
const USED = `function g(){ const verified = html.includes(url); return { status: verified ? "placed" : "missed" }; }`;
const BAD  = `function h(){ const verifiedPlaced = xs.filter(ok); return { status, placed, n: 1 }; }`;
if (analyse(GOOD, "(fixture)").length !== 0 || analyse(USED, "(fixture)").length !== 0 || analyse(BAD, "(fixture)").length !== 1) {
  console.error("CANNOT RUN — the detector failed its own fixtures:");
  console.error(`  carried as a field: ${analyse(GOOD, "(f)").length} finding(s), expected 0`);
  console.error(`  carried inside an expression: ${analyse(USED, "(f)").length} finding(s), expected 0`);
  console.error(`  dropped: ${analyse(BAD, "(f)").length} finding(s), expected 1`);
  process.exit(2);
}

// ── THE REAL SOURCES ──────────────────────────────────────────────────────────
let findings = [], scanned = 0, computedTotal = 0;
try {
  for (const f of readdirSync(SHARED)) {
    if (!f.endsWith(".ts")) continue;
    const src = readFileSync(join(SHARED, f), "utf8");
    scanned++;
    computedTotal += [...new Set([...stripComments(src).matchAll(/(?:const|let)\s+(verified\w*)\s*=/g)].map((m) => m[1]))].length;
    findings = findings.concat(analyse(src, `_shared/${f}`));
  }
} catch (e) { console.error("CANNOT RUN — cannot read the shared sources: " + e.message); process.exit(2); }

console.log(`files scanned: ${scanned} · verification values computed: ${computedTotal} · (detector red-proofed this run)`);
if (findings.length) {
  console.error(`\nFAIL — ${findings.length} verification value(s) computed and never returned:`);
  for (const f of findings) console.error(`  ${f.file}:${f.at} ${f.fn}() computes "${f.name}" and returns ${f.objs} object(s), none of which carry it`);
  console.error("\nEvidence that cannot leave the function where it was gathered cannot be acted on anywhere else.");
  process.exit(1);
}
console.log("PASS — every verification value computed in a reporting function reaches its result.");
process.exit(0);
