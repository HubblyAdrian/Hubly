#!/usr/bin/env node
/**
 * A PROMISE ON THE FRONT DOOR MUST HAVE A FEATURE BEHIND IT.
 *
 * Every action card and suggested question on the owner's home screen is generated
 * from HC_HOME_PROMISES in public/platform-home.html, and every entry names the
 * capability action it depends on (`cap: 'operations.read'`). This check reads those
 * names and fails if the action is not in supabase/functions/_shared/hubly_capability_registry.ts.
 *
 * Why it exists: "Set your hours" sat in the gaps panel for weeks offering owners a fix
 * no capability could make. It was found by clicking it on a real business, not by
 * reading the code — and the same class of defect (a chip that outlived its feature) has
 * no other automatic guard. Grepping harder is not a strategy.
 *
 * Exit codes, and they are not interchangeable:
 *   0  PASS  — every named capability exists
 *   1  FAIL  — a promise names something that is not there
 *   2  CANNOT RUN — a file was missing or unparseable. NEVER reported as either of the above.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = join(ROOT, "public/platform-home.html");
const REG = join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");

let home, reg;
try {
  home = readFileSync(HOME, "utf8");
  reg = readFileSync(REG, "utf8");
} catch (e) {
  console.error("CANNOT RUN — " + e.message);
  process.exit(2);
}

// ── The promises. Slice out the array literal, then read every cap: '<x>.<y>'. ──
const start = home.indexOf("var HC_HOME_PROMISES = [");
if (start < 0) {
  console.error("CANNOT RUN — HC_HOME_PROMISES not found in public/platform-home.html");
  process.exit(2);
}
// Bracket-match to the end of the literal rather than trusting a terminator string.
let depth = 0, end = -1;
for (let i = home.indexOf("[", start); i < home.length; i++) {
  const ch = home[i];
  if (ch === "[") depth++;
  else if (ch === "]") { depth--; if (depth === 0) { end = i; break; } }
}
if (end < 0) { console.error("CANNOT RUN — HC_HOME_PROMISES array literal is unterminated"); process.exit(2); }
const block = home.slice(start, end);

const promises = [];
for (const m of block.matchAll(/\bid\s*:\s*'([^']+)'[\s\S]{0,600}?\bcap\s*:\s*'([a-zA-Z_]+)\.([a-zA-Z_]+)'/g)) {
  promises.push({ id: m[1], cap: m[2], action: m[3] });
}
if (!promises.length) {
  console.error("CANNOT RUN — no cap: entries parsed out of HC_HOME_PROMISES");
  process.exit(2);
}

// ── The registry. name: "<capability>" at one indent, name: "<action>" inside it. ──
// Read as a flat set of "capability.action" pairs by walking the capability headings in
// file order and attributing every later action name to the most recent one.
const heads = [...reg.matchAll(/^\s{2,4}name:\s*"([a-z_]+)",\s*$/gm)].map((m) => ({ at: m.index, cap: m[1] }));
const acts = [...reg.matchAll(/^\s{6,10}name:\s*"([a-zA-Z_]+)",\s*$/gm)].map((m) => ({ at: m.index, action: m[1] }));
if (!heads.length || !acts.length) {
  console.error("CANNOT RUN — could not parse capability names out of the registry");
  process.exit(2);
}
const have = new Set();
for (const a of acts) {
  let owner = null;
  for (const h of heads) { if (h.at < a.at) owner = h.cap; else break; }
  if (owner) have.add(owner + "." + a.action);
}

const missing = promises.filter((p) => !have.has(p.cap + "." + p.action));
console.log(`home promises: ${promises.length} · registry actions: ${have.size}`);
for (const p of promises) {
  console.log(`  ${have.has(p.cap + "." + p.action) ? "ok  " : "GONE"} ${p.id} -> ${p.cap}.${p.action}`);
}
if (missing.length) {
  console.error(`\nFAIL — ${missing.length} home promise(s) name a capability that does not exist:`);
  for (const p of missing) console.error(`  ${p.id} promises ${p.cap}.${p.action}`);
  console.error("A card or chip whose capability is gone is a promise the product cannot keep.");
  process.exit(1);
}
console.log("PASS — every home promise has a capability behind it.");
process.exit(0);
