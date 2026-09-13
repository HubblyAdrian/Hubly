#!/usr/bin/env node
/**
 * NO CODE MAY DRIVE A NAV ITEM THAT DOES NOT EXIST.
 *
 *   node scripts/check-nav-targets-exist.mjs
 *
 * `document.querySelector('[data-v="customers"]')` returns null when the nav item is gone, and
 * the caller then does nothing, or falls through to somewhere else. No error, no log — the
 * button simply stops working. That is the failure shape retiring a view produces, and it is
 * why the jobs/customers retirements had to repoint their callers rather than assume.
 *
 * IT CAUGHT ITS OWN REASON FOR EXISTING. The nav audit reported `customers: 0 inbound` and a
 * retirement was ruled safe on that basis. The count came from a regex assuming one call shape
 * (`.ni[data-v="..."]`); the real call sites use the bare attribute. There were 2. This check
 * counts what is actually there, and prints the list so the number can be read rather than
 * trusted (Lesson 58: a check states what it read).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { receipt } from "./lib/read-receipt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = (process.env.HUBLY_NAV_FILES || "public/hubly.html,public/journey-os/journey.js").split(",");

let sources;
try { sources = FILES.map((f) => ({ f, src: receipt(f.startsWith("/") ? f : join(ROOT, f), "read") })); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

const html = sources[0].src;
// The nav items that EXIST: a rendered element carrying data-v.
// ANY element carrying data-v that is a nav item — `class="ni"` AND `class="ni active"`.
// The first version required class="ni" exactly and declared `dashboard` an orphan because
// its item is `class="ni active"`. That is the same one-shape assumption this check exists
// to catch, made inside the check itself.
const declared = new Set([...html.matchAll(/<div[^>]*class="ni(?:\s[^"]*)?"[^>]*data-v="([a-z0-9-]+)"/g)].map((m) => m[1]));
if (!declared.size) { console.error("CANNOT RUN — no nav items found; this check is stale, not the code"); process.exit(2); }

// Everything that TARGETS one by attribute.
const targets = new Map();
for (const { f, src } of sources) {
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*['"][^'"]*\[data-v=\\?['"]([a-z0-9-]+)\\?['"]\]/g)) {
    const v = m[1];
    if (!targets.has(v)) targets.set(v, []);
    targets.get(v).push(`${f}:${src.slice(0, m.index).split("\n").length}`);
  }
}

const orphans = [...targets.entries()].filter(([v]) => !declared.has(v));
const total = [...targets.values()].reduce((n, a) => n + a.length, 0);
console.log(`nav items declared: ${declared.size}   call sites targeting one: ${total}`);
for (const [v, where] of [...targets.entries()].sort()) {
  console.log(`  ${declared.has(v) ? "ok " : "ORPHAN"} ${v.padEnd(16)} ${where.length}  ${where.join(", ")}`);
}
if (orphans.length) {
  console.error(`\nFAIL — ${orphans.length} destination(s) are driven by code but have no nav item:`);
  for (const [v, where] of orphans) console.error(`  [data-v="${v}"] targeted from ${where.join(", ")} — querySelector returns null and the control silently does nothing`);
  console.error(`\nRepoint the caller, or restore the nav item. A retired view with live links is\nthe same defect as the second website.`);
  process.exit(1);
}
console.log(`\nPASS — every nav item that code drives exists.`);
