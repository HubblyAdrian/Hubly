#!/usr/bin/env node
/**
 * NO AGGREGATE IS SUMMED FROM A PAGINATED RESULT.
 *
 *   node scripts/check-paginated-aggregate.mjs
 *
 * `get_business_customers` takes `p_limit integer DEFAULT 8`. A `reduce` / `+=` over the rows
 * it returns produces a total for A PAGE. It reads as correct against the only live business —
 * 4 customers, under every limit in the codebase — and is silently wrong for anyone real:
 * no error, no empty state, just a number that is too small in a plausible way (Lesson 59).
 *
 * SCOPED TO THE KNOWN PAGINATED READERS, listed below, so this stays a check rather than a
 * repo-wide "someone summed an array" scanner that everyone learns to exempt. Adding a reader
 * with a limit parameter means adding it here.
 *
 * Parsed with acorn; every file it opens prints a receipt (path, bytes, hash) first.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import { receipt } from "./lib/read-receipt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require_ = createRequire(import.meta.url);
let acorn;
try { acorn = require_("acorn"); }
catch { console.error("CANNOT RUN — acorn not installed"); process.exit(2); }

/** IS THIS REDUCE A SUM? The class is "a value SUMMED from a page", not "a value folded over
 *  a page". `list.reduce((a,e) => t > a ? t : a, 0)` finds the NEWEST event in the page in
 *  order to mark it seen — correct over a page, by definition, and the first version of this
 *  check flagged it. A max, a min, a concat and a find are all legitimate; addition is not,
 *  because addition claims to describe a whole the page does not contain. */
function isAdditive(fn) {
  if (!fn || !["ArrowFunctionExpression", "FunctionExpression"].includes(fn.type)) return true;  // unknown shape: flag it
  const acc = fn.params?.[0]?.type === "Identifier" ? fn.params[0].name : null;
  let additive = false;
  (function walk(n) {
    if (!n || typeof n.type !== "string" || additive) return;
    if (n.type === "BinaryExpression" && n.operator === "+") {
      const names = [n.left, n.right].filter((x) => x?.type === "Identifier").map((x) => x.name);
      if (!acc || names.includes(acc)) additive = true;
    }
    if (n.type === "AssignmentExpression" && n.operator === "+=") additive = true;
    for (const k of Object.keys(n)) {
      if (k === "_parent") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") walk(c); });
      else if (v && typeof v.type === "string") walk(v);
    }
  })(fn.body);
  return additive;
}

/** Readers whose result is A PAGE. Established 2026-09-13 from pg_proc. */
const PAGINATED = new Set(["get_business_customers", "get_business_events", "get_business_notifications"]);
const AGGREGATORS = new Set(["reduce", "reduceRight"]);
const TARGETS = (process.env.HUBLY_PA_FILES || "public/platform-home.html").split(",");

let scanned = 0;
const fails = [];
for (const path of TARGETS) {
  const abs = isAbsolute(path) ? path : join(ROOT, path);
  let src;
  try { src = receipt(abs, "parse"); }
  catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
  const chunks = /\.html$/.test(abs)
    ? [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    : [src];
  for (const code of chunks) {
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: "latest", locations: true, allowReturnOutsideFunction: true }); }
    catch (e) { console.error("CANNOT RUN — parse failed: " + String(e.message).slice(0, 90)); process.exit(2); }

    // 1. variables that hold the rows of a paginated reader
    const tainted = new Set();
    (function mark(n) {
      if (!n || typeof n.type !== "string") return;
      if (n.type === "CallExpression" && n.callee?.type === "MemberExpression"
          && n.callee.property?.name === "rpc"
          && n.arguments[0]?.type === "Literal" && PAGINATED.has(n.arguments[0].value)) {
        scanned++;
        // whatever this call's result is assigned to, and anything read off .data
        let p = n._parent;
        while (p && !["VariableDeclarator", "AssignmentExpression"].includes(p.type)) p = p._parent;
        const target = p?.id?.name || (p?.left?.type === "Identifier" ? p.left.name : null);
        if (target) tainted.add(target);
      }
      // `_parent` is a back-link we add ourselves; walking it would make the tree cyclic
      // and blow the stack, which is exactly what the first version of this check did.
      for (const k of Object.keys(n)) {
        if (k === "_parent") continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") { c._parent = n; mark(c); } });
        else if (v && typeof v.type === "string") { v._parent = n; mark(v); }
      }
    })(ast);

    // 1b. TAINT PROPAGATION. The rows are almost never summed off the RPC result directly —
    // they are extracted first (`var rows = (r && r.data) || []`). The first version of this
    // check tainted only `r`, so its red-proof PASSED against a reduce over `rows`. Any
    // declarator or assignment whose initialiser mentions a tainted name inherits the taint,
    // repeated until nothing new is marked.
    for (let pass = 0; pass < 5; pass++) {
      const before = tainted.size;
      (function spread(n) {
        if (!n || typeof n.type !== "string") return;
        const isDecl = n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init;
        const isAssign = n.type === "AssignmentExpression" && n.left?.type === "Identifier";
        if (isDecl || isAssign) {
          const name = isDecl ? n.id.name : n.left.name;
          const init = isDecl ? n.init : n.right;
          let mentions = false;
          (function scan(x) {
            if (!x || typeof x.type !== "string" || mentions) return;
            if (x.type === "Identifier" && tainted.has(x.name)) { mentions = true; return; }
            for (const k of Object.keys(x)) {
              if (k === "_parent") continue;
              const v = x[k];
              if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") scan(c); });
              else if (v && typeof v.type === "string") scan(v);
            }
          })(init);
          if (mentions) tainted.add(name);
        }
        for (const k of Object.keys(n)) {
          if (k === "_parent") continue;
          const v = n[k];
          if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") spread(c); });
          else if (v && typeof v.type === "string") spread(v);
        }
      })(ast);
      if (tainted.size === before) break;
    }

    // 2. an aggregate computed over one of them
    (function find(n) {
      if (!n || typeof n.type !== "string") return;
      if (n.type === "CallExpression" && n.callee?.type === "MemberExpression"
          && AGGREGATORS.has(n.callee.property?.name)) {
        const root = (function base(x) { return x?.type === "MemberExpression" ? base(x.object) : x; })(n.callee.object);
        if (root?.type === "Identifier" && tainted.has(root.name) && isAdditive(n.arguments[0])) {
          fails.push(`${abs}:${n.loc.start.line}  ${n.callee.property.name}() over \`${root.name}\`, which holds the rows of a LIMITED reader — that is a page total, not a business total`);
        }
      }
      for (const k of Object.keys(n)) {
        if (k === "_parent") continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") find(c); });
        else if (v && typeof v.type === "string") find(v);
      }
    })(ast);
  }
}

console.log(`paginated reader calls found: ${scanned}   aggregates over their rows: ${fails.length}`);
if (fails.length) {
  console.error(`\nFAIL — an aggregate summed from a page:`);
  for (const f of fails) console.error("  " + f);
  console.error(`\nCompute it server-side or do not render it. A bigger p_limit is not a fix —\nit moves the wrong answer to a size nobody predicted (Lesson 59, D-024).`);
  process.exit(1);
}
console.log("PASS — no aggregate is summed from a paginated result.");
