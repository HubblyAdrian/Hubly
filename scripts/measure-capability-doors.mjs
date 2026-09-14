#!/usr/bin/env node
/**
 * WHICH DOORS DOES EACH CAPABILITY HAVE?
 *
 * The spec's shape for every capability is three doors: **talk to me · do it yourself · I can
 * show you where.** Four capabilities turned out on 2026-09-13 to have only the middle one, and
 * the brief says 63 mutation capabilities have no caller anywhere. This measures the whole
 * population rather than rediscovering three a week by accident.
 *
 *   TALK TO ME   — the model can invoke it: it is called from inside a registry action handler.
 *   DO IT YOURSELF — a client control reaches it: it is called from a `body.<x>` branch in
 *                  hubly-conversation (which is what every canvas control and panel posts to).
 *   SHOW ME WHERE — the parent can point at it on the page. Measured, not assumed.
 *
 * Reuses generate-capabilities.mjs's definition of a mutation and of "reachable" so the two
 * documents cannot disagree — a second definition of the same word is how 103 became 19.
 *
 *   node scripts/measure-capability-doors.mjs            # prints the summary
 *   node scripts/measure-capability-doors.mjs --json     # the rows, for the doc generator
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(ROOT, "supabase/functions/_shared");
const CONV = join(ROOT, "supabase/functions/hubly-conversation/index.ts");

const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));

// The SAME regex as generate-capabilities.mjs. Copied deliberately with this note rather than
// imported, because that file is a generator with side effects; if it changes, this must too.
const MUTATION = /^(apply|insert|place|move|delete|remove|mark|stamp|set|add|upload|patch|sync|restamp|strip|sanitize|build|generate|create|write|record|claim|assign)/i;

const files = readdirSync(SHARED).filter((f) => f.endsWith(".ts"));
const sources = new Map();
for (const f of files) sources.set(f, strip(readFileSync(join(SHARED, f), "utf8")));
const registrySrc = sources.get("hubly_capability_registry.ts") || "";
const convSrc = strip(readFileSync(CONV, "utf8"));
const clientSrc = ["public/platform-home.html", "public/hubly.html"]
  .map((p) => readFileSync(join(ROOT, p), "utf8")).join("\n");

/** Every registry action handler body, so "the model can invoke it" is call-site based. */
function handlerBodies(src) {
  const out = [];
  for (const m of src.matchAll(/handler:\s*async\s*\([^)]*\)\s*=>\s*\{/g)) {
    let d = 0, i = m.index + m[0].length - 1;
    for (let k = i; k < src.length; k++) {
      if (src[k] === "{") d++;
      else if (src[k] === "}") { d--; if (!d) { out.push(src.slice(i + 1, k)); break; } }
    }
  }
  return out;
}
const HANDLERS = handlerBodies(registrySrc).join("\n");

/** Every `if (body.<x>)` branch body in the conversation function — the client's doors. */
function bodyBranches(src) {
  const out = [];
  for (const m of src.matchAll(/if\s*\(\s*body\??\.([a-zA-Z][\w]*)[^)]*\)\s*\{/g)) {
    let d = 0, i = m.index + m[0].length - 1;
    for (let k = i; k < src.length; k++) {
      if (src[k] === "{") d++;
      else if (src[k] === "}") { d--; if (!d) { out.push({ key: m[1], body: src.slice(i + 1, k) }); break; } }
    }
  }
  return out;
}
const BRANCHES = bodyBranches(convSrc);

const rows = [];
for (const [file, src] of sources) {
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (!MUTATION.test(name)) continue;
    const re = new RegExp(`\\b${name}\\s*\\(`, "g");

    const talk = (HANDLERS.match(re) || []).length > 0;
    // DO IT YOURSELF = the conversation function calls it OUTSIDE a registry handler. That is
    // the structured-POST path, and it is the only way a client control reaches anything.
    //
    // The first version of this looked only inside `if (body.x) { … }` blocks and found 4. It
    // was wrong: the conversation function destructures the key first (`const directRecordEdit
    // = body?.directRecordEdit …; if (directRecordEdit) { … }`), so the branch is `if (X)` and
    // the regex saw nothing. Counting a FORM again instead of the fact — the same mistake, in
    // the tool written to stop making it.
    const convCalls = (convSrc.match(re) || []).length;
    const diy = convCalls > 0 ? BRANCHES.filter((b) => new RegExp(`\\b${name}\\s*\\(`).test(b.body)).map((b) => b.key) : [];
    const diyReachable = convCalls > 0;
    let internal = 0;
    for (const [f2, s2] of sources) {
      const n = (s2.match(new RegExp(`\\b${name}\\s*\\(`, "g")) || []).length - (f2 === file ? 1 : 0);
      if (n > 0) internal += n;
    }
    rows.push({ name, file, talk, diy: diyReachable ? (diy.length ? diy : ["structured POST"]) : [], internal });
  }
}
rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

if (process.argv.includes("--json")) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

const n = rows.length;
const talk = rows.filter((r) => r.talk);
const diy = rows.filter((r) => r.diy.length);
const both = rows.filter((r) => r.talk && r.diy.length);
const neither = rows.filter((r) => !r.talk && !r.diy.length);
const orphan = neither.filter((r) => r.internal === 0);
const helper = neither.filter((r) => r.internal > 0);

console.log(`mutation capabilities in _shared: ${n}   (files scanned: ${files.size ?? files.length})\n`);
console.log(`  TALK TO ME     (a registry handler calls it)      ${String(talk.length).padStart(3)}`);
console.log(`  DO IT YOURSELF (a client control posts to it)     ${String(diy.length).padStart(3)}`);
console.log(`  BOTH                                              ${String(both.length).padStart(3)}`);
console.log(`  SHOW ME WHERE                                       0   — no mechanism exists for any capability`);
console.log(`  NEITHER                                           ${String(neither.length).padStart(3)}`);
console.log(`     of which called by another shared module        ${String(helper.length).padStart(3)}   (an internal step, not a capability)`);
console.log(`     of which called by NOTHING, anywhere            ${String(orphan.length).padStart(3)}   <- the missing-door list\n`);
console.log(`  ONLY talk-to-me    ${talk.filter((r) => !r.diy.length).length}`);
console.log(`  ONLY do-it-yourself ${diy.filter((r) => !r.talk).length}   <- the shape the four found on 2026-09-13 were in`);
