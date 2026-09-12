#!/usr/bin/env node
/**
 * A RECORDING CALL MUST FIRE ON THE PATH THAT SUCCEEDS.
 *
 * On 2026-09-12 the services area went onto ridgeline-pressure-washing's page at 05:47:52
 * and `placement_outcomes` had nothing to say about it. The line that records it —
 * `notePlacement("addServicesBlock", "inserted", …)` — was sitting INSIDE the
 * `if (!saved || saved.ok !== true)` branch, two lines below the failure row. So the one
 * path that actually puts a services area on a page wrote a row only when it had just
 * failed to, and the table built to answer "did this work?" could only ever answer "no".
 *
 * That is Lesson 13 in its own habitat: an instruction inside a refusal branch is
 * invisible to every test of the path that succeeds. It is also the second time in one
 * night this table was not watching when we needed it — a table that records only failures
 * cannot be read as a rate, and a rate is the only thing it was for.
 *
 * WHAT THIS CHECKS. For every `notePlacement(fn, branch, …)` call site: is the call inside
 * a failure guard? A function whose only success-branch recordings sit inside failure
 * guards is reported — that is precisely the defect above.
 *
 * IT RED-PROOFS ITSELF ON EVERY RUN. The detector is run first over two fixtures — one
 * with the call on the success path, one with the same call moved inside
 * `if (!saved || saved.ok !== true) { … }`. If it cannot tell those apart it exits 2
 * rather than reporting a green it has not earned: a detector that cannot fail is the
 * thing it was written to catch.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(ROOT, "supabase/functions/_shared");

/** Branch names that name a SUCCESS — the row whose absence makes the table a failure log. */
const SUCCESS = /^(placed|inserted|patched|swapped|added|section_added|updated|saved|changed|live|ok)$/i;

/** An `if (…)` whose body runs when something did NOT work. These are the conditions this
 *  codebase actually writes; each one is a real line from the server. */
const FAILURE_GUARD =
  /\b(?:!\s*\w+(?:\.\w+)*\s*(?:\|\||\)|&&)|\w+\.ok\s*!==\s*true|\w+\.ok\s*===\s*false|!\s*\w+\.ok|\bstatus\s*===\s*["'](?:failed|error|missed)["']|\berror\b|\bcatch\s*\()/;

/** Is the call at `idx` lexically inside a block whose condition is a failure guard?
 *  Walks outward through enclosing `{`s and reads the text immediately before each. */
function insideFailureGuard(src, idx) {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const c = src[i];
    if (c === "}") depth++;
    else if (c === "{") {
      if (depth > 0) { depth--; continue; }
      // The head of the block this call sits directly inside.
      const head = src.slice(Math.max(0, i - 220), i);
      const lastIf = head.lastIndexOf("if (");
      const lastCatch = head.lastIndexOf("catch");
      if (lastCatch > -1 && lastCatch > lastIf && /catch\s*\([^)]*\)\s*$/.test(head)) return true;
      if (lastIf > -1) {
        const cond = head.slice(lastIf);
        // Only the condition that belongs to THIS brace — no newline-separated statements.
        if (!/[;}]/.test(cond.slice(4)) && FAILURE_GUARD.test(cond)) return true;
      }
      // Not a failure guard: keep walking outward, an outer one still counts.
      idx = i - 1;
      i = i;                          // continue outward from here
      continue;
    }
  }
  return false;
}

/** Every recording call site in a source file — direct, dynamic, and through a local
 *  wrapper. The wrapper matters: applyBusinessNameToFreeform records through
 *  `const say = (status, detail) => notePlacement("applyBusinessNameToFreeform", status, …)`,
 *  so a scanner that only reads `notePlacement(` cannot see the one function whose rows
 *  we were reading when this defect was found. A blind spot in the instrument's instrument. */
function callSites(src, file) {
  const out = [];
  const at = (i) => src.slice(0, i).split("\n").length;

  // 1. Direct calls. The branch may be a literal or an expression (r.status), and a
  //    dynamic branch is neither a success nor a failure recording — it is BOTH, which is
  //    the pattern we want, so it counts as covering the success path.
  const re = /notePlacement\(\s*"([^"]+)"\s*,\s*([^,]+),/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[2].trim();
    const lit = /^"([^"]*)"$/.exec(raw);
    out.push({ file, fn: m[1], branch: lit ? lit[1] : "(dynamic)", dynamic: !lit,
      line: at(m.index), guarded: insideFailureGuard(src, m.index) });
  }

  // 2. Wrappers: `const NAME = (...) => { … notePlacement("FN", <arg>, …) … }`, then every
  //    NAME("branch") call is a recording of FN.
  const wrapRe = /const\s+(\w+)\s*=\s*\([^)]*\)\s*(?::[^=]+)?=>\s*\{([\s\S]{0,400}?)\n\s*\};/g;
  let w;
  while ((w = wrapRe.exec(src))) {
    const note = /notePlacement\(\s*"([^"]+)"/.exec(w[2]);
    if (!note) continue;
    const name = w[1], fn = note[1];
    const callRe = new RegExp(`\\b${name}\\(\\s*"([^"]+)"`, "g");
    let c;
    while ((c = callRe.exec(src))) {
      if (c.index > w.index && c.index < w.index + w[0].length) continue;   // the definition itself
      out.push({ file, fn, branch: c[1], dynamic: false, via: name,
        line: at(c.index), guarded: insideFailureGuard(src, c.index) });
    }
  }
  return out;
}

// ── THE DETECTOR'S OWN RED-PROOF ──────────────────────────────────────────────
const GOOD = `
async function save() {
  const saved = await rpc();
  if (!saved || saved.ok !== true) {
    notePlacement("demo", "save_failed", id, "x");
    return { ok: false };
  }
  notePlacement("demo", "inserted", id, "n=1");
  return { ok: true };
}`;
const BAD = GOOD.replace(`  notePlacement("demo", "inserted", id, "n=1");\n`, "")
  .replace(`    notePlacement("demo", "save_failed", id, "x");\n`,
           `    notePlacement("demo", "save_failed", id, "x");\n    notePlacement("demo", "inserted", id, "n=1");\n`);
const goodSites = callSites(GOOD, "(fixture)");
const badSites = callSites(BAD, "(fixture)");
const goodOk = goodSites.some((s) => s.branch === "inserted" && !s.guarded);
const badCaught = badSites.every((s) => s.branch !== "inserted" || s.guarded);
if (!goodOk || !badCaught) {
  console.error("CANNOT RUN — the detector failed its own fixtures:");
  console.error(`  success-path call recognised as such: ${goodOk}`);
  console.error(`  call moved into the failure branch caught: ${badCaught}`);
  process.exit(2);
}

// ── THE REAL SOURCES ──────────────────────────────────────────────────────────
let sites = [];
try {
  for (const f of readdirSync(SHARED)) {
    if (!f.endsWith(".ts")) continue;
    sites = sites.concat(callSites(readFileSync(join(SHARED, f), "utf8"), `_shared/${f}`));
  }
} catch (e) { console.error("CANNOT RUN — cannot read the shared sources: " + e.message); process.exit(2); }
if (!sites.length) { console.error("CANNOT RUN — no notePlacement call sites found; has it been renamed?"); process.exit(2); }

const byFn = new Map();
for (const s of sites) { const a = byFn.get(s.fn) || []; a.push(s); byFn.set(s.fn, a); }

const fails = [];
const lines = [];
for (const [fn, calls] of [...byFn].sort()) {
  // A dynamic branch (`notePlacement(fn, r.status, …)`) records whatever happened,
  // successes included — that is the pattern the rest should look like.
  const successCalls = calls.filter((c) => c.dynamic || SUCCESS.test(c.branch));
  const onSuccessPath = successCalls.filter((c) => !c.guarded);
  const buried = successCalls.filter((c) => c.guarded);
  lines.push(`  ${fn.padEnd(30)} ${String(calls.length).padStart(2)} call(s), ${successCalls.length} naming success, ${onSuccessPath.length} on the success path`);
  if (!successCalls.length) {
    fails.push(`${fn}: records ${calls.map((c) => c.branch).join(", ")} — no branch naming a success, so the table can only ever say this failed`);
  } else if (!onSuccessPath.length) {
    fails.push(`${fn}: every success recording is inside a failure guard (${buried.map((c) => `${c.file}:${c.line} "${c.branch}"`).join(", ")}) — the row fires only when the operation has just failed`);
  }
}

console.log(`notePlacement call sites: ${sites.length} across ${byFn.size} function(s)`);
for (const l of lines) console.log(l);
console.log("  (detector red-proofed on its own fixtures this run)");

if (fails.length) {
  console.error(`\nFAIL — ${fails.length} recorder(s) that cannot report a success:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("\nPASS — every recorded function writes a row on the path that succeeds.");
process.exit(0);
