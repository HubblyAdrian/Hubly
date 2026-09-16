#!/usr/bin/env node
/**
 * EVERY EXAMPLE THE REGISTRY PUTS IN ITS OWN DESCRIPTION — is it a promise the code keeps?
 *
 *   node scripts/measure-documented-examples.mjs
 *
 * WHY THIS SWEEP EXISTS. `business.updateJob`'s description told the model to invoke it for "the
 * Maple St one is $200 now" — and the matcher killed it on the word "one", which appears in no
 * row. A documented example that cannot work is the same class as shipping copy that offers an
 * action with no path behind it: the model isn't lying, OUR TEXT is.
 *
 * Adrian: "report which other documented examples in the registry are untested claims; I suspect
 * this is not the only one."
 *
 * MEASUREMENT ONLY. This extracts the quoted examples from every capability description and
 * reports which ones any check exercises. It does not judge whether an example WORKS — that needs
 * the capability's own backend — it reports which are UNTESTED, which is the honest question.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reg = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");

// Every capability's name + description block.
const caps = [];
// THE DENOMINATOR IS THE FIRST THING TO GET RIGHT. A first version of this regex required
// `doors:` or `argsSchema:` to close the block and parsed only 25 of 43 `name:` entries — it would
// have reported "42 untested" off barely half the registry. The file has 43 name entries, 40
// handlers and 81 description blocks, so the parse is checked against those counts below and the
// sweep REFUSES to print a total it cannot reconcile (the leg-0 habit, Lesson 87 addendum).
const nameRe = /name:\s*"([a-zA-Z.]+)"\s*,\s*\n\s*description:\s*\n?([\s\S]*?)(?=\n\s*(?:doors|argsSchema|handler|invoke|examples|returns|sideEffects|name)\s*:)/g;
let m;
while ((m = nameRe.exec(reg))) caps.push({ name: m[1], desc: m[2] });
// A `name:` line is only a CAPABILITY's name if a `description:` follows it within a line or two.
// The first denominator counted 43 and one of them was `name: "name", tagline: "tagline", ...` —
// a field-mapping object. So the shortfall was in my DENOMINATOR, not in the parse, and the
// reconciliation is derived here rather than excused by a hardcoded exception.
const lines = reg.split("\n");
const capNames = [];
lines.forEach((l, i) => {
  const mm = /^\s*name: "([a-zA-Z.]+)",\s*$/.exec(l);
  if (!mm) return;                                       // a name sharing its line with other keys is not a capability header
  if (!/^\s*description:/.test(lines[i + 1] || "")) return;
  capNames.push(mm[1]);
});
const missed = capNames.filter((n) => !caps.some((c) => c.name === n));
if (missed.length) {
  console.log(`PARSE SHORTFALL: ${caps.length} blocks parsed, but ${capNames.length} name+description headers exist.`);
  console.log(`Missed: ${missed.join(", ")}`);
  console.log(`\nNo totals printed. A percentage off a partial parse is exactly the kind of number that gets`);
  console.log(`acted on and corrected too late (Lesson 85), so this sweep refuses to produce one.`);
  process.exit(2);
}
console.log(`  reconciled: ${caps.length} capability blocks parsed = ${capNames.length} name+description headers found.\n`);

// The quoted phrases inside a description are the examples: \"...\" in the source.
const EX = /\\"([^"\\]{6,90})\\"/g;
const rows = [];
for (const c of caps) {
  const ex = [];
  let e;
  while ((e = EX.exec(c.desc))) ex.push(e[1]);
  if (ex.length) rows.push({ name: c.name, examples: [...new Set(ex)] });
}

// What do the checks actually exercise? Concatenate every check and look for each example verbatim.
const scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.startsWith("check-") && f.endsWith(".mjs"));
const allChecks = scripts.map((f) => { try { return readFileSync(join(ROOT, "scripts", f), "utf8"); } catch { return ""; } }).join("\n");

// ── REACHABILITY, DERIVED FROM THE ALLOWLIST ──────────────────────────────────────────
// Adrian: "rank them — which sit on capabilities an owner can actually reach today, versus ones
// behind a door that does not exist."
//
// The authority is CONTEXT_CAPABILITY_ALLOWLIST in hubly-conversation/index.ts, because a
// capability absent from the context the owner is actually in is filtered out of the model's
// prompt AND blocked at dispatch — it cannot be invoked at all. Read from the source, not listed
// here, so a context change moves the ranking on its own.
const conv = readFileSync(join(ROOT, "supabase/functions/hubly-conversation/index.ts"), "utf8");
const allowBlock = conv.slice(conv.indexOf("const CONTEXT_CAPABILITY_ALLOWLIST"));
const ctx = {};
for (const m of allowBlock.slice(0, 2600).matchAll(/^\s*(dashboard|customer|operate):\s*\[([^\]]*)\]/gm)) {
  ctx[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
// The owner's ordinary conversation is `dashboard`. `operate` is reached ONLY through the editor
// hub's `store` tab, which lives inside the ?hcEdit=1-gated editor — measured 2026-09-15.
const REACHABLE = new Set(ctx.dashboard || []);
const GATED = new Set((ctx.operate || []).filter((g) => !REACHABLE.has(g)));

// Which GROUP owns each capability: the nearest preceding top-level `name:` that is in a context.
const groupOf = {};
{
  let current = null;
  lines.forEach((l, i) => {
    const mm = /^\s*name: "([a-zA-Z.]+)",\s*$/.exec(l);
    if (!mm) return;
    if (REACHABLE.has(mm[1]) || GATED.has(mm[1]) || (ctx.customer || []).includes(mm[1])) current = mm[1];
    groupOf[mm[1]] = current;
  });
}

let total = 0, tested = 0;
const untested = [];
console.log("CAPABILITY                     EXAMPLES  TESTED  UNTESTED");
for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) {
  const t = r.examples.filter((x) => allChecks.includes(x));
  total += r.examples.length; tested += t.length;
  const u = r.examples.filter((x) => !allChecks.includes(x));
  if (u.length) untested.push({ name: r.name, u });
  console.log(`  ${r.name.padEnd(28)} ${String(r.examples.length).padStart(5)} ${String(t.length).padStart(7)} ${String(u.length).padStart(9)}`);
}
console.log(`\n  ${caps.length} capabilities parsed; ${rows.length} carry quoted examples.`);
console.log(`  ${total} documented examples. ${tested} appear verbatim in a check. ${total - tested} DO NOT.`);
console.log(`\n  WHAT WOULD MAKE THIS NUMBER WRONG (stated before it is used):`);
console.log(`   · "appears verbatim in a check" is a weak proxy for tested — a check may exercise the`);
console.log(`     same intent in different words, which would make the untested count too HIGH.`);
console.log(`   · the description regex may miss capabilities whose block is shaped differently,`);
console.log(`     which would make both numbers too LOW. ${caps.length} parsed is the denominator to sanity-check.`);
console.log(`   · an example appearing in a check is not proof the check ASSERTS on it.`);
// ── THE SPLIT ────────────────────────────────────────────────────────────────────────
const bucket = (n) => {
  const g = groupOf[n];
  if (!g) return "UNKNOWN";
  if (REACHABLE.has(g)) return "REACHABLE";
  if (GATED.has(g)) return "GATED";
  return "OTHER(" + g + ")";
};
const tally = {};
for (const x of untested) {
  const b = bucket(x.name);
  tally[b] = (tally[b] || 0) + x.u.length;
}
console.log(`\n  ── THE SPLIT of the ${total - tested} untested examples ──`);
console.log(`     contexts read from source: dashboard=[${(ctx.dashboard||[]).join(",")}] operate=[${(ctx.operate||[]).join(",")}] customer=[${(ctx.customer||[]).join(",")}]`);
for (const [b, n] of Object.entries(tally).sort((a, b2) => b2[1] - a[1])) console.log(`     ${b.padEnd(18)} ${String(n).padStart(3)}`);
console.log(`\n  REACHABLE TODAY — test these first:`);
for (const x of untested.filter((x) => bucket(x.name) === "REACHABLE")) for (const e of x.u) console.log(`   ${(groupOf[x.name]+"/"+x.name).padEnd(34)} "${e}"`);
console.log(`\n  BEHIND A DOOR THE OWNER'S CONVERSATION CANNOT OPEN (capability group only in \`operate\`,`);
console.log(`  which is reached only via the editor hub's store tab inside ?hcEdit=1):`);
for (const x of untested.filter((x) => bucket(x.name) === "GATED")) for (const e of x.u) console.log(`   ${(groupOf[x.name]+"/"+x.name).padEnd(34)} "${e}"`);
const other = untested.filter((x) => !["REACHABLE","GATED"].includes(bucket(x.name)));
if (other.length) { console.log(`\n  UNCLASSIFIED (no owning capability group found — the denominator to check):`);
  for (const x of other) for (const e of x.u) console.log(`   ${(x.name).padEnd(34)} "${e}"  [${bucket(x.name)}]`); }
