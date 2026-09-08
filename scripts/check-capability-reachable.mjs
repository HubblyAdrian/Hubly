#!/usr/bin/env node
/**
 * EVERY CAPABILITY MUST BE REACHABLE, AND EVERY ADVERTISED ONE MUST EXIST.
 *
 *   node scripts/check-capability-reachable.mjs
 *
 * WHY: a capability absent from CONTEXT_CAPABILITY_ALLOWLIST is filtered out of the
 * model's prompt AND blocked at dispatch. It exists, type-checks, passes every other
 * invariant in this repo, and does nothing — the model simply says the thing "isn't
 * live in the workspace". This has now happened twice:
 *   - `places`     dead for the length of the session that built it (2026-09-08)
 *   - `operations` dead since it shipped (2026-09-05)
 * Both directions matter, so both are checked:
 *   ORPHAN  in the registry, not in any allowlist  -> real code the model can never call
 *   GHOST   in an allowlist, not in the registry   -> the model is told it exists and errors
 *
 * ── HOW THIS PARSES, AND WHY NOT BY INDENT ────────────────────────────────────
 * The previous ad-hoc version matched /^\s{4}name: "..."/ and reported "6 declared,
 * 6 reachable" while completely blind to a SEVENTH capability: `storefront` is added
 * by `HUBLY_CAPABILITY_REGISTRY.push({ … })` AFTER the array literal closes, at a
 * different indent. A checker that misreads the file's real shape reports PASS over
 * the defect it exists to catch — the same failure as the scanner regex that required
 * a colon, read the valid shorthand `{ …, p_owner_id }` as a violation, and led to
 * duplicate keys and TS1117.
 *
 * So: no indent assumptions and no assumption about the array literal. A capability is
 * identified STRUCTURALLY — an object literal whose own top-level keys include BOTH
 * `name` and `actions`. That is true of both forms in the file today and of any third
 * form someone writes tomorrow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");
const CONVERSATION = path.join(ROOT, "supabase/functions/hubly-conversation/index.ts");

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL  " + m); };

/** The object literal containing index `i`: walk back to its `{`, brace-match forward. */
function enclosingObject(src, i) {
  let depth = 0;
  let start = -1;
  for (let j = i; j >= 0; j--) {
    const c = src[j];
    if (c === "}") depth++;
    else if (c === "{") { if (depth === 0) { start = j; break; } depth--; }
  }
  if (start < 0) return null;
  let d = 0;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return { start, end: j, body: src.slice(start, j + 1) }; }
  }
  return null;
}

/** Keys at depth 1 of an object literal body — its OWN keys, not a nested object's. */
function ownKeys(body) {
  const keys = [];
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") d--;
    else if (d === 1) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(j, j + 40));
      if (m && (j === 0 || /[\s{,]/.test(body[j - 1]))) keys.push(m[1]);
    }
  }
  return keys;
}

const reg = fs.readFileSync(REGISTRY, "utf8");
const declared = new Map();     // name -> line
for (const m of reg.matchAll(/\bname:\s*"([a-z_][a-z_0-9]*)"/g)) {
  const obj = enclosingObject(reg, m.index);
  if (!obj) continue;
  const keys = ownKeys(obj.body);
  // A CAPABILITY has both. An ACTION has name + argsSchema/handler but no `actions`.
  if (keys.includes("name") && keys.includes("actions")) {
    if (!declared.has(m[1])) declared.set(m[1], reg.slice(0, m.index).split("\n").length);
  }
}

const conv = fs.readFileSync(CONVERSATION, "utf8");
const block = conv.match(/const CONTEXT_CAPABILITY_ALLOWLIST[\s\S]*?\n\};/);
if (!block) { fail("could not find CONTEXT_CAPABILITY_ALLOWLIST — this check cannot run"); process.exit(1); }
// Strip comments first: the block carries prose that mentions capability names.
const cleaned = block[0].replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const allowed = new Map();      // name -> [contexts]
for (const ctx of cleaned.matchAll(/^\s*([a-z_]+)\s*:\s*\[([^\]]*)\]/gm)) {
  for (const n of ctx[2].matchAll(/"([a-z_][a-z_0-9]*)"/g)) {
    if (!allowed.has(n[1])) allowed.set(n[1], []);
    allowed.get(n[1]).push(ctx[1]);
  }
}

console.log(`capabilities defined in the registry : ${declared.size}  (${[...declared.keys()].join(", ")})`);
console.log(`capabilities in the allowlist        : ${allowed.size}  (${[...allowed.keys()].join(", ")})`);

if (!declared.size) fail("parsed ZERO capabilities — this check has stopped checking anything");
if (!allowed.size) fail("parsed ZERO allowlist entries — this check has stopped checking anything");

const orphans = [...declared.keys()].filter((c) => !allowed.has(c));
const ghosts = [...allowed.keys()].filter((c) => !declared.has(c));

for (const c of orphans) {
  fail(`ORPHAN  "${c}" (registry line ${declared.get(c)}) is in NO context allowlist.\n` +
       `        The model can never invoke it. It will say the feature "isn't live".`);
}
for (const c of ghosts) {
  fail(`GHOST   "${c}" is advertised in context(s) [${allowed.get(c).join(", ")}] but is NOT in the registry.\n` +
       `        The model is told it exists; invoking it errors.`);
}

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nPASS — every capability is reachable, and every advertised capability exists.");
