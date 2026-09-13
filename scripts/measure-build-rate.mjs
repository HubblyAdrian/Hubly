/**
 * MEASURE THE FIRST-TURN BUILD RATE, named and unnamed.
 *
 * Adrian's question: does signup build a page on the first turn, and how often?
 * If the rate is near 50% he cannot tell a new bug from the old flake when he
 * walks the test script, so this number gates the walk.
 *
 * WHAT IS COUNTED HERE AND WHAT IS NOT (Lesson 15). Exactly one thing is decided
 * by machine: whether website.generateDocument was called. That is a fact in the
 * capability results, not a reading of prose. Everything the model SAID is printed
 * raw and classified by a person, because a regex over free text is a hypothesis
 * about phrasing and the model's job is to vary phrasing — a detector that missed
 * by one character already reported "the name is never asked" at 0/4 when it was
 * asked 4/4.
 *
 * Cleans up every draft it creates.
 *
 * Usage: node scripts/measure-build-rate.mjs [runsPerCase]
 * Exit: 0 measured · 2 CANNOT RUN
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FN = "https://rtwxxkxpkqdrhclkozma.supabase.co/functions/v1/hubly-conversation";
const N = Math.max(1, Number(process.argv[2] || 20));
const CONCURRENCY = 4;

let KEY;
try {
  KEY = /HUBLY_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/.exec(
    readFileSync(join(ROOT, "public/journey-os/hubly-public-key.js"), "utf8"))?.[1];
} catch (e) { console.error("CANNOT RUN — could not read the publishable key: " + e.message); process.exit(2); }
if (!KEY) { console.error("CANNOT RUN — no publishable key found"); process.exit(2); }

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT });
  const i = out.indexOf('"rows":');
  if (i < 0) return [];
  let d = 0, st = out.indexOf("[", i), en = -1;
  for (let k = st; k < out.length; k++) {
    if (out[k] === "[") d++;
    else if (out[k] === "]") { d--; if (d === 0) { en = k + 1; break; } }
  }
  return JSON.parse(out.slice(st, en));
}

async function say(text) {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "content-type": "application/json", apikey: KEY, authorization: `Bearer ${KEY}`,
      // OUR HARNESSES DECLARE THEMSELVES. Never sniffed server-side from a missing Origin:
      // a heuristic there is wrong in the flattering direction on the day it matters, and
      // an unmarked harness must show up as a visible bug rather than a better number.
      "x-hubly-synthetic": "1",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: text }], understanding: {}, draftBusiness: null }),
  });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || (body && body.ok === false)) {
    const e = new Error(String((body && (body.detail || body.error)) || `endpoint ${res.status}`));
    e.cannotRun = true;
    throw e;
  }
  return body;
}

const CASES = [
  { id: "UNNAMED", say: "I do mobile detailing in los angeles" },
  { id: "NAMED",   say: "I run Ridgeline Detail, mobile detailing in LA" },
];


// ─────────────────────────────────────────────────────────────────────────────
// THE PRICE, PRINTED BEFORE ANYTHING IS SPENT.
//
// This script drives the LIVE endpoint: every case creates a real business row and
// generates a real website through the model. That is not free, and on 2026-09-09 it
// stopped being theoretical — roughly 35 signups drained a full OpenAI top-up, twice
// taking signup down for every visitor and every customer chat on every live business
// site. This file used to run inside `npm test`, so an ordinary test run spent money.
// It is opt-in now, and it says what it costs before it costs it.
// ─────────────────────────────────────────────────────────────────────────────
function printPrice(drafts) {
  // not-a-corpus-rate: a cost plan before the run, not a measurement
  console.log(
    // not-a-corpus-rate: a cost plan before the run, not a measurement
    `\n  THIS RUN WILL CREATE ${drafts} DRAFT BUSINESSES AND GENERATE ${drafts} WEBSITES.\n` +
    `  Cost anchor (2026-09-09, denominator unknown): ~35 signups drained one full top-up,\n` +
    `  so this is roughly ${(drafts / 35 * 100).toFixed(0)}% of a top-up. Drafts are deleted afterwards; quota is not refunded.\n`);
}

let cannotRun = null;
const created = [];
const results = [];
const OUT = join(ROOT, "docs/BUILD_RATE_MEASUREMENT.json");

// EVERY RUN IS WRITTEN THE MOMENT IT LANDS. The first version of this script held all
// results in memory and wrote the file at the very end; the OpenAI account ran dry on
// run ~33 of 40 and every measured run was discarded, after spending the quota to get
// them. Data already paid for is never held hostage to the run completing.
function flush(partial) {
  writeFileSync(OUT, JSON.stringify({
    measured_at: new Date().toISOString(),
    runs_per_case: N,
    complete: !partial,
    results,
  }, null, 2));
}

async function one(c, i) {
  let j;
  try { j = await say(c.say); }
  catch (e) {
    // NOT process.exit(). exit() skips `finally`, which is where the drafts this script
    // created get deleted — the abort that lost the data above also orphaned 53 rows for
    // exactly this reason. Raise a flag, let the workers drain, and unwind normally.
    if (e.cannotRun) { cannotRun = cannotRun || e.message; return { case: c.id, run: i, aborted: true }; }
    return { case: c.id, run: i, error: String(e.message) };
  }
  const caps = (j.messages || []).filter((m) => m.role === "system").map((m) => String(m.content)).join(" ");
  const calls = [...new Set(caps.match(/\b(?:business|website)\.\w+/g) || [])];
  if (j.draftBusiness?.id) created.push(j.draftBusiness.id);
  return {
    case: c.id,
    run: i,
    built: calls.includes("website.generateDocument"),   // the one machine-decided fact
    calls,
    slug: j.draftBusiness?.slug || null,
    reply: String(j.reply || ""),
  };
}

async function main() {
  printPrice(N * CASES.length);
  for (const c of CASES) {
    const queue = Array.from({ length: N }, (_, i) => i + 1);
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (let i = queue.shift(); i !== undefined && !cannotRun; i = queue.shift()) {
        results.push(await one(c, i));
        flush(true);
      }
    });
    await Promise.all(workers);
    if (cannotRun) break;
  }

  for (const c of CASES) {
    const rows = results.filter((r) => r.case === c.id).sort((a, b) => a.run - b.run);
    // An ABORTED run is not a run. Counting it as a non-build would report the outage
    // as a build failure — the same false red the checker's exit-2 branch exists to stop.
    const ok = rows.filter((r) => !r.error && !r.aborted);
    const built = ok.filter((r) => r.built).length;
    // not-a-corpus-rate: over the drafts THIS RUN creates, which are test by construction
    console.log(`\n${"=".repeat(78)}\n${c.id} — "${c.say}"   n=${ok.length}   built ${built}/${ok.length}\n${"=".repeat(78)}`);
    for (const r of rows) {
      if (r.aborted) { console.log(`\n[${r.run}] NOT RUN — endpoint stopped answering`); continue; }
      if (r.error) { console.log(`\n[${r.run}] ERROR ${r.error}`); continue; }
      console.log(`\n[${r.run}] ${r.built ? "BUILT" : "NO BUILD"}  slug=${r.slug}  calls=[${r.calls.join(", ")}]`);
      console.log(`     ${r.reply.replace(/\n/g, "\n     ")}`);
    }
  }

  flush(!!cannotRun);
  console.log(`\nraw results written to ${OUT}`);
  if (cannotRun) {
    const done = results.filter((r) => !r.error && !r.aborted).length;
    // not-a-corpus-rate: a CANNOT RUN message counting attempts, not pages
    console.error(
      // not-a-corpus-rate: a CANNOT RUN message counting attempts, not pages
      `\nCANNOT RUN — the endpoint stopped answering after ${done} of ${N * CASES.length} runs: ${cannotRun}\n` +
      `The ${done} completed runs ARE in ${OUT}, but this is a TRUNCATED SAMPLE — report it as ` +
      `"${done} runs, cut short" and never as the build rate.`);
    process.exitCode = 2;
  }
}

try { await main(); }
finally {
  if (created.length) {
    const ids = [...new Set(created)].map((id) => `'${id}'`).join(",");
    try {
      sql(`delete from businesses where id in (${ids})`);
      console.log(`\ncleaned up ${new Set(created).size} draft(s) this measurement created`);
    } catch (e) { console.error(`\nCLEANUP FAILED — ${new Set(created).size} drafts left behind: ${e.message}`); }
  }
}
