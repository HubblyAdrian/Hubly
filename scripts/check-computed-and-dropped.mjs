#!/usr/bin/env node
/**
 * A VALUE COMPUTED INTO A COUNTS OBJECT AND NEVER READ IS A LIE WITH A QUERY BEHIND IT.
 *
 *   node scripts/check-computed-and-dropped.mjs
 *
 * FOURTH TIME THIS CLASS HAS SHIPPED:
 *   1. `verifiedPlaced` — computed correctly, dropped one function later, so the reply was
 *      composed from a value that never arrived (2026-09-12).
 *   2. `hcHomeCounts.openBookings` — a live `booking_requests` count, rendered by nothing.
 *   3. `hcHomeCounts.openLeads` — never rendered AND counting the wrong table for its name.
 *   4. `verifiedPlaced` AGAIN — computed by applyServicesToFreeform and dropped by
 *      applyOwnerRecordEdit, which composed "Added X on your page" from `placement.status`
 *      instead. Same value, same defect, a different function, three months apart (2026-09-13).
 *
 * Instance 4 is why this file now checks TWO shapes. The counts-object scan below cannot see
 * it: the drop is in TypeScript, in an edge function, and the value is a placement result
 * rather than a property of an object named `…Counts`. The second leg — PLACEMENT TRUTH — is
 * at the end of this file. One home for one class, because a class that has shipped four times
 * will ship a fifth somewhere neither leg looks, and the next person should find both here.
 *
 * Each one ran a real query on a real business and threw the answer away. The cost is not the
 * wasted read: it is that the screen and the database disagree while the code looks correct.
 *
 * PARSED WITH ACORN, not line windows (Lesson 39). Every assignment to a property of a counts
 * object is collected from the AST; a property is "read" if the AST contains a matching member
 * read, OR if its NAME appears as a string literal anywhere — because the consumer here is
 * `countKey:'jobsToday'`, an indirection no AST can follow. An AST alone would under-report;
 * string-literal usage is checked for exactly that reason, and it is stated rather than
 * silently assumed.
 *
 * SCOPED to objects whose name ends in Counts/Results/Totals/Stats, so it stays a check and
 * does not become a repo-wide unused-value scanner everyone learns to ignore.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { receipt } from "./lib/read-receipt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
let acorn;
try { acorn = require_("acorn"); }
catch { console.error("CANNOT RUN — acorn not installed (npm i -D acorn)"); process.exit(2); }

const TARGETS = (process.env.HUBLY_CD_FILES || "public/platform-home.html,public/hubly.html").split(",");
const OBJ = /(Counts|Results|Totals|Stats)$/;

function scriptsOf(path) {
  // absolute paths are used as given, so a red-proof can point at a mutated copy.
  // The RECEIPT is what makes that safe: failure #4 was this exact line resolving against
  // the script's own repo, so a red-proof parsed the real file twice and passed.
  const src = receipt(isAbsolute(path) ? path : join(ROOT, path), "parse");
  if (!/\.html$/.test(path)) return [src];
  return [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

let checked = 0;
const fails = [];
for (const path of TARGETS) {
  let chunks;
  try { chunks = scriptsOf(path); }
  catch (e) { console.error(`CANNOT RUN — ${path}: ${e.message}`); process.exit(2); }
  for (const code of chunks) {
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: "latest", locations: true, allowReturnOutsideFunction: true }); }
    catch (e) { console.error(`CANNOT RUN — ${path} did not parse: ${String(e.message).slice(0, 90)}`); process.exit(2); }

    const writes = new Map();   // "obj.prop" -> line
    const reads = new Set();
    const strings = new Set();  // string LITERALS from the AST — never comments
    (function walk(n, parent) {
      if (!n || typeof n.type !== "string") return;
      if (n.type === "MemberExpression" && n.object?.type === "Identifier" && OBJ.test(n.object.name)
          && n.property?.type === "Identifier" && !n.computed) {
        const key = `${n.object.name}.${n.property.name}`;
        const isWriteTarget = parent && parent.type === "AssignmentExpression" && parent.left === n;
        if (isWriteTarget) { if (!writes.has(key)) writes.set(key, n.loc.start.line); }
        else reads.add(key);
      }
      if (n.type === "Literal" && typeof n.value === "string") strings.add(n.value);
      if (n.type === "TemplateLiteral") for (const q of n.quasis) strings.add(q.value.cooked || "");
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => walk(c, n));
        else if (v && typeof v.type === "string") walk(v, n);
      }
    })(ast, null);

    for (const [key, line] of writes) {
      checked++;
      const prop = key.split(".")[1];
      if (reads.has(key)) continue;
      // the indirection an AST cannot follow: countKey:'openBookings'. Tested against
      // string LITERALS collected from the AST, never against raw text — the first version
      // regexed the source and was satisfied by the deletion COMMENT that named the very
      // property it was meant to catch.
      if (strings.has(prop)) continue;
      fails.push(`${path}:${line}  ${key} is assigned and never read — not as a member, not as a string key`);
    }
  }
}

console.log(`counts-object properties assigned: ${checked}   dropped: ${fails.length}`);
if (fails.length) {
  console.error(`\nFAIL — computed and dropped:`);
  for (const f of fails) console.error("  " + f);
  console.error(`\nDelete the computation, or render it. A query whose answer nothing reads is\nthe screen and the database disagreeing while the code looks correct.`);
  process.exit(1);
}
console.log("PASS — every value written into a counts object is read somewhere.");


// ─────────────────────────────────────────────────────────────────────────────────────────
// LEG 2 — PLACEMENT TRUTH. A placement result may not reach a reply except through the
// composer that reads the verified list.
//
// `applyServicesToFreeform` / `applyServicesToClassic` return `verifiedPlaced`: the services
// actually found in the SAVED BYTES. `composeServicesTruth` is the only composer that reads it
// and nothing else. Twice now a caller has taken the placement and written its own sentence
// from `placement.status` — a value that is "placed" when SOME of them landed — and told an
// owner his prices were on a page that contained none of them.
//
// THE INVARIANT, in two halves, because there are two legitimate shapes:
//   a) the function composes the sentence itself  -> it must call composeServicesTruth;
//   b) the function hands the placement upward    -> it must put it on `raw` so a caller can.
// A function that does NEITHER has dropped the verified list.
//
// And the sharp half: a function holding a placement may not branch on `placement.status` to
// decide what to TELL the owner unless it also calls the composer. Reading `.status` to decide
// what to DO is fine; reading it to decide what to SAY is the defect.
//
// Brace-matched function bodies over the TypeScript sources — acorn does not parse TS, and
// that limit is stated rather than worked around silently (Lesson 39's rule about saying what
// the instrument can actually see).
// ─────────────────────────────────────────────────────────────────────────────────────────
const TS_TARGETS = [
  "supabase/functions/_shared/hubly_capability_registry.ts",
  "supabase/functions/hubly-conversation/index.ts",
];
const PLACERS = /\bawait\s+(applyServicesToFreeform|applyServicesToClassic)\s*\(/;

function fnBodies(src) {
  const out = [];
  // TWO SHAPES, because the first version of this leg found ONE function where there are two.
  // Every capability action in the registry is `handler: async (args) => { … }` — an arrow on
  // an object property — and a `function NAME(` regex sees none of them. A check that cannot
  // see the shape the codebase actually uses is decoration; this is exactly the "enumerate the
  // harmless side" rule pointed at syntax.
  const re = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)[^{]*\{|([A-Za-z0-9_$]+)\s*:\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]*)?=>\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let d = 0, start = m.index + m[0].length - 1, end = -1;
    for (let k = start; k < src.length; k++) {
      if (src[k] === "{") d++;
      else if (src[k] === "}") { d--; if (!d) { end = k; break; } }
    }
    if (end > 0) out.push({ name: m[1] || m[2], body: src.slice(start + 1, end), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const truthFails = [];
let placementFns = 0;
for (const rel of TS_TARGETS) {
  const abs = isAbsolute(rel) ? rel : join(ROOT, rel);
  let src;
  try { src = receipt(abs, "placement-truth"); } catch { continue; }
  for (const fn of fnBodies(src)) {
    if (!PLACERS.test(fn.body)) continue;
    if (/^(applyServicesToFreeform|applyServicesToClassic)$/.test(fn.name)) continue;   // the placers themselves
    placementFns++;
    const composes = /composeServicesTruth\s*\(/.test(fn.body);
    const handsUp = /raw:\s*\{[^}]*\bservices\b/.test(fn.body) || /\bservices:\s*placement\b/.test(fn.body);
    if (!composes && !handsUp) {
      truthFails.push(`${rel}:${fn.line}  ${fn.name}() takes a placement and neither calls composeServicesTruth nor hands it up on raw.services — verifiedPlaced is dropped`);
      continue;
    }
    // the sharp half: deciding what to SAY from .status
    const saysFromStatus = /(summary|reply)\s*:[^,;]*placement\.status/.test(fn.body)
      || /placement\.status\s*===\s*"(placed|partial|no_prices)"/.test(fn.body) && /(summary|reply)\s*:/.test(fn.body);
    if (saysFromStatus && !composes) {
      truthFails.push(`${rel}:${fn.line}  ${fn.name}() composes what the owner reads from placement.status without calling composeServicesTruth — "placed" is true when SOME of them landed`);
    }
  }
}

console.log(`\nfunctions holding a placement result: ${placementFns}   dropping the verified list: ${truthFails.length}`);
if (truthFails.length) {
  console.error(`\nFAIL — a placement reached a reply without the truth composer:`);
  for (const f of truthFails) console.error("  " + f);
  console.error(`\ncomposeServicesTruth reads verifiedPlaced — what is in the saved bytes — and nothing\nelse. Anything else is a sentence about what we ASKED for. This class has shipped four\ntimes; see the header.`);
  process.exit(1);
}
console.log("PASS — every placement result is composed by the truth composer or handed up intact.");
