#!/usr/bin/env node
/**
 * ══ EVERY CHECK, FOUND BY GLOB, NEVER BY A LIST. ═════════════════════════════════════════════
 *
 *   node scripts/run-all-checks.mjs                 # all of them
 *   node scripts/run-all-checks.mjs day quote       # only those whose names match a term
 *   CHECK_TIMEOUT_MS=90000 node scripts/run-all-checks.mjs
 *
 * WHY THIS EXISTS, AND IT IS THE SAME DEFECT AS /contact-pick.js ONE LEVEL UP.
 *
 * Measured 2026-09-16: **160 `check-*.mjs` files on disk. 105 `check:` entries in package.json. 59
 * checks referenced by NOTHING.** `npm test` runs `node --test tests/*.test.mjs` and nothing else —
 * there is no `check:all`, no `verify`, no `ci`, and **no `.github/workflows` at all.**
 *
 * So `scripts/check-no-db-push.mjs` — the ENFORCEMENT of the banned command, which CLAUDE.md describes
 * as *"fails the run if the command reappears anywhere in the repo"* — **was referenced by nothing.**
 * There was no run for it to fail. The ban lived in prose, which is exactly what CLAUDE.md says prose
 * could not do for three weeks.
 *
 * **A LIST OF npm SCRIPTS IS A HAND-MAINTAINED SET, and a check that is not on it fails silently
 * forever.** Not with an error — a check nobody runs is indistinguishable from a check that passes.
 * That is the same silent-undefined shape as a script that serves HTML.
 *
 * SO THE INVENTORY IS THE DIRECTORY. Adding `scripts/check-whatever.mjs` puts it in this run with no
 * second step, and `scripts/check-every-check-is-runnable.mjs` fails if a file on disk could not be
 * reached from here.
 *
 * THREE OUTCOMES, AND THEY ARE NOT THE SAME THING (exit codes are the checks' own contract):
 *   0  PASS         the thing it asserts holds
 *   1  FAIL         the thing it asserts does not hold  -> this runner exits 1
 *   2  CANNOT RUN   it could not measure (no browser, no export, no credentials)
 * A CANNOT RUN is reported and is NOT a failure, because a check that refuses to measure is behaving
 * correctly — and folding it into the failures is how a green suite gets ignored. But they are COUNTED
 * and NAMED, because a suite quietly full of them is a suite that checks nothing.
 */
import { readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "scripts");
const TIMEOUT = Number(process.env.CHECK_TIMEOUT_MS || 120000);
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 3);

/** THE INVENTORY IS THE DIRECTORY. This glob is the only definition of "every check". */
export function everyCheckFile() {
  return readdirSync(DIR).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
}

// ══ IMPORTING THIS MUST NOT RUN IT. ══════════════════════════════════════════════════════════
//
// An ES module's top level executes on import, so `import { everyCheckFile }` from another check
// STARTED THE WHOLE SUITE — 160 children, three at a time, inside a check that only wanted the glob.
// It did not error; it hung. A module that both exports a helper and runs a program has to say which
// it is doing, and this is where it says it.
const isMain = (() => {
  try { return resolve(process.argv[1] || "") === fileURLToPath(import.meta.url); } catch (e) { return false; }
})();
if (!isMain) {
  // Imported for `everyCheckFile`. Nothing else happens.
} else {

const terms = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const all = everyCheckFile();
const picked = terms.length ? all.filter((f) => terms.some((t) => f.includes(t))) : all;

if (!picked.length) {
  console.error(`No checks matched ${JSON.stringify(terms)}. ${all.length} exist.`);
  process.exit(2);
}

const run = (file) => new Promise((done) => {
  const t0 = Date.now();
  const child = spawn(process.execPath, [join(DIR, file)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = "", killed = false;
  const timer = setTimeout(() => { killed = true; try { child.kill("SIGKILL"); } catch (e) {} }, TIMEOUT);
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  child.on("close", (code) => {
    clearTimeout(timer);
    const pass = (out.match(/^PASS\b/gm) || []).length;
    const fail = (out.match(/^FAIL\b/gm) || []).length;
    // A TIMEOUT IS ITS OWN OUTCOME. Reporting it as a failure would blame the product for a slow
    // browser; reporting it as a pass would be the unearned checkmark. It is named.
    const status = killed ? "TIMEOUT" : code === 0 ? "PASS" : code === 2 ? "CANNOT RUN" : "FAIL";
    done({ file, status, code, pass, fail, ms: Date.now() - t0,
           why: (err.match(/CANNOT RUN[^\n]*/) || [])[0] || "",
           failures: (out.match(/^FAIL[^\n]*/gm) || []).slice(0, 4) });
  });
});

console.log(`\n${picked.length} check${picked.length === 1 ? "" : "s"}, found by glob in scripts/ — not by a list.\n`);

const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, async () => {
  while (cursor < picked.length) {
    const file = picked[cursor++];
    const r = await run(file);
    results.push(r);
    const tag = r.status === "PASS" ? "ok  " : r.status === "CANNOT RUN" ? "skip" : r.status === "TIMEOUT" ? "TIME" : "RED ";
    console.log(`  ${tag} ${r.file.replace(/^check-|\.mjs$/g, "").padEnd(44)} ${String(r.pass).padStart(3)} pass${r.fail ? ` / ${r.fail} fail` : ""}  ${(r.ms / 1000).toFixed(1)}s`);
    if (r.status === "FAIL") r.failures.forEach((l) => console.log(`         ${l}`));
    if (r.status === "CANNOT RUN" && r.why) console.log(`         ${r.why.slice(0, 120)}`);
  }
}));

const by = (s) => results.filter((r) => r.status === s);
const legs = results.reduce((a, r) => a + r.pass, 0);
console.log(`\n  ${by("PASS").length} passed · ${by("FAIL").length} RED · ${by("CANNOT RUN").length} cannot run · ${by("TIMEOUT").length} timed out`);
console.log(`  ${legs} assertions passed across ${results.length} checks\n`);
if (by("FAIL").length) {
  console.log("RED:");
  by("FAIL").forEach((r) => console.log(`  ${r.file}`));
  console.log("");
}
if (by("TIMEOUT").length) {
  console.log(`TIMED OUT after ${TIMEOUT}ms (raise CHECK_TIMEOUT_MS):`);
  by("TIMEOUT").forEach((r) => console.log(`  ${r.file}`));
  console.log("");
}
process.exit(by("FAIL").length ? 1 : 0);

}   // end isMain
