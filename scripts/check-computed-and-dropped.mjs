#!/usr/bin/env node
/**
 * A VALUE COMPUTED INTO A COUNTS OBJECT AND NEVER READ IS A LIE WITH A QUERY BEHIND IT.
 *
 *   node scripts/check-computed-and-dropped.mjs
 *
 * THIRD TIME THIS CLASS HAS SHIPPED:
 *   1. `verifiedPlaced` — computed correctly, dropped one function later, so the reply was
 *      composed from a value that never arrived (2026-09-12).
 *   2. `hcHomeCounts.openBookings` — a live `booking_requests` count, rendered by nothing.
 *   3. `hcHomeCounts.openLeads` — never rendered AND counting the wrong table for its name.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
let acorn;
try { acorn = require_("acorn"); }
catch { console.error("CANNOT RUN — acorn not installed (npm i -D acorn)"); process.exit(2); }

const TARGETS = (process.env.HUBLY_CD_FILES || "public/platform-home.html,public/hubly.html").split(",");
const OBJ = /(Counts|Results|Totals|Stats)$/;

function scriptsOf(path) {
  // absolute paths are used as given, so a red-proof can point at a mutated copy
  const src = readFileSync(isAbsolute(path) ? path : join(ROOT, path), "utf8");
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
