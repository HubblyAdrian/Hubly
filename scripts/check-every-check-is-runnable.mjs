#!/usr/bin/env node
/**
 * [RULE] EVERY CHECK ON DISK IS REACHED BY A COMMAND, AND THE BANNED COMMAND'S GUARD RUNS.
 *
 *   node scripts/check-every-check-is-runnable.mjs
 *
 * ADRIAN, 2026-09-16, after the /contact-pick.js catch: "SWEEP FOR THE ROUTER SHAPE. Where else does a
 * list decide whether something is served, loaded, routed or registered?"
 *
 * HERE IS THE BIGGEST ONE, MEASURED. **160 `check-*.mjs` files on disk. 105 `check:` entries in
 * package.json. 59 checks referenced by NOTHING.** `npm test` runs `node --test tests/*.test.mjs` and
 * nothing else — no `check:all`, no `verify`, no `ci`, and **no `.github/workflows` directory at all.**
 *
 * SO `scripts/check-no-db-push.mjs` WAS REFERENCED BY NOTHING. CLAUDE.md describes it as *"fails the
 * run if the command reappears anywhere in the repo"* — and there was no run for it to fail. The
 * `supabase db push` ban, the one that came ONE STATEMENT from relabelling every market business, was
 * enforced by prose plus a script nobody ran. CLAUDE.md's own words: *"The ban lived in prose for three
 * weeks and prose did not stop it."*
 *
 * **A LIST OF npm SCRIPTS IS A HAND-MAINTAINED SET, and its failure mode is the silent one:** a check
 * nobody runs is indistinguishable from a check that passes. Same shape as a script that serves HTML.
 *
 * WHAT THIS ASSERTS:
 *   1-2  the runner finds checks by GLOB, and that glob reaches every file on disk
 *   3    there is a command that runs them
 *   4-5  the banned-command guard runs as part of `npm test` — not merely as a file that exists
 *   6    and no check is reachable ONLY through a hand-written name
 *
 * [RULE]: no leg asserts how MANY checks there are. Adding one is expected to stay green — that is the
 * entire point.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { everyCheckFile } from "./run-all-checks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const onDisk = readdirSync(join(ROOT, "scripts")).filter((f) => /^check-.*\.mjs$/.test(f)).sort();
if (!onDisk.length) {
  console.error("CANNOT RUN — no check files found. A reader failure, not an absence.");
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const scripts = pkg.scripts || {};

// ── THE RUNNER'S OWN INVENTORY, EXECUTED — not a re-implementation of its glob. ─────────────
let found = [];
try { found = everyCheckFile(); } catch (e) { found = []; }
say("1 the runner finds checks by GLOBBING the directory, and it runs",
    found.length > 0, `${found.length} found by scripts/run-all-checks.mjs`);
const missed = onDisk.filter((f) => !found.includes(f));
say("2 its glob reaches EVERY check file on disk — adding one needs no second step",
    missed.length === 0, missed.length ? `unreachable: ${missed.join(", ")}` : `all ${onDisk.length}`);

// ── THERE IS A COMMAND THAT RUNS THEM ──────────────────────────────────────────────────────
const runnerRef = Object.entries(scripts).filter(([, v]) => /run-all-checks\.mjs/.test(String(v)));
say("3 a package.json script runs the whole set",
    runnerRef.length > 0, runnerRef.length ? runnerRef.map(([k]) => `npm run ${k}`).join(", ") : "no script references run-all-checks.mjs");

// ── THE BANNED COMMAND'S GUARD ACTUALLY RUNS ───────────────────────────────────────────────
//
// CLAUDE.md says this script "fails the run". THAT SENTENCE HAS TO BE TRUE OF A COMMAND SOMEONE
// ACTUALLY TYPES, and the one everybody types is `npm test`. `pretest` runs before it, automatically,
// with no extra step — so the claim becomes true of the command it was written about.
say("4 the `supabase db push` guard exists as a file",
    existsSync(join(ROOT, "scripts/check-no-db-push.mjs")), "scripts/check-no-db-push.mjs");
const pre = String(scripts.pretest || "");
say("5 and it runs as part of `npm test` — CLAUDE.md says it \"fails the run\", so a run must include it",
    /check-no-db-push\.mjs/.test(pre),
    pre ? `pretest = ${pre.slice(0, 90)}` : "there is no pretest script");

// ── AND NOTHING IS REACHABLE ONLY BY NAME ──────────────────────────────────────────────────
//
// A per-check `check:foo` entry is a convenience and there is nothing wrong with having them. What is
// wrong is a check whose ONLY route is such an entry, because then the set of entries decides what
// runs. Leg 2 already proves the glob covers everything; this leg states the consequence so the
// intent survives someone deleting leg 2.
const named = new Set();
for (const v of Object.values(scripts)) {
  for (const m of String(v).matchAll(/scripts\/(check-[A-Za-z0-9._-]+\.mjs)/g)) named.add(m[1]);
}
const onlyNamed = onDisk.filter((f) => named.has(f) && !found.includes(f));
say("6 no check depends on a hand-written name to be reached",
    onlyNamed.length === 0,
    `${named.size} have a convenience entry; ${onlyNamed.length} depend on one`);

console.log(failed ? `\n${failed} FAILED\n` : `\nALL PASS — ${onDisk.length} checks, reached by a glob, and the banned command's guard runs.\n`);
process.exit(failed ? 1 : 0);
