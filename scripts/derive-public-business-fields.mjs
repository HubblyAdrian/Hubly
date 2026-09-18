#!/usr/bin/env node
/**
 * WHICH FIELDS OF `get_public_business()` DO THE RENDERERS ACTUALLY READ?
 *
 *   node scripts/derive-public-business-fields.mjs
 *
 * ══ WHY DERIVED, NOT HAND-PICKED ════════════════════════════════════════════════════════════
 *
 * `get_public_business` is `select to_jsonb(b) - 'draft_token'` — the WHOLE `businesses` row, EXECUTE
 * granted to anon, and `meta.pipeline.manual` (a lead list, with message history and the owner's own
 * notes) is inside it. Replacing that with an allowlist is the fix. **Hand-picking the allowlist is
 * the hand-maintained-set disease**: it would be wrong the first time someone adds a field, the field
 * would be silently absent, the renderer would read `undefined`, and nothing would 404 — the
 * route-list failure mode arriving in a column list.
 *
 * ══ TWO SOURCES, EACH JUSTIFIED — AND THREE ATTEMPTS TO GET HERE ════════════════════════════
 *
 * ATTEMPT 1 searched the whole 3MB file for `data.X` and "derived" 80 fields including `vehicle`,
 * `visitor`, `warnings` and `textContent.trim`, off hundreds of unrelated variables sharing a name.
 * ATTEMPT 2 scoped to the enclosing function and lost the destructuring form — `let {data,error}=await
 * …rpc(…)` made the regex capture `let` — so it derived FOUR fields for a renderer that reads dozens.
 * **Too loose, then too tight, and silent both times.** The sources below are what survived:
 *
 *   (a) A BOUNDED WINDOW after each call site. The caller unpacks the row within a few dozen lines of
 *       receiving it. `WINDOW` is printed with the result, because it is an assumption and an
 *       assumption that is not printed is a guess pretending to be a measurement.
 *   (b) THE NAMED GLOBAL `currentBusiness`, FILE-WIDE — justified by CHECKING its assignments rather
 *       than assuming: all 11 in hubly.html assign a business row (this function, get_draft_business,
 *       two other business reads, and one `{id:'ceo-demo-biz'…}` demo literal). A global that only
 *       ever holds a business row can be read file-wide without ambiguity. The script re-checks that
 *       and refuses to use the global if it stops being true.
 *
 * ══ THE SAFE DIRECTION IS "IN" ══════════════════════════════════════════════════════════════
 *
 * A field wrongly INCLUDED is still public, which is today's status quo. A field wrongly EXCLUDED
 * breaks a renderer silently. So anything ambiguous goes IN, with the read that demanded it recorded.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/redproof.mjs";

// WIDENED FROM 60 TO 250, AND THE 60 COST SOMETHING REAL. `data.account_kind` is read at
// hubly.html:18218 — 70 lines after the call — to decide whether a public page gets `hcNoIndex()`.
// It fell outside the window, was left out of the allowlist, and TEST BUSINESSES' PUBLIC PAGES
// SILENTLY STOPPED BEING NOINDEXED. Nothing errored: `undefined === 'test'` is simply false. That is
// the route-list failure mode arriving through a window parameter, and it was found by Adrian asking
// about a DIFFERENT field on the same line.
//
// The window is printed with the result because it is an assumption. 250 covers the whole of
// loadPublicProfile; a read further away than that would still be invisible, which is why the
// allowlist ALSO unions the named global and why check-public-reader-allowlist-is-derived exists.
const WINDOW = 250;
const CALL = /rpc\(\s*['"`]get_public_business['"`]\s*(?:,|\))/;
const NOT_A_COLUMN = new Set(["data", "error", "message", "then", "catch", "length", "map", "filter",
  "forEach", "slice", "push", "trim", "toString", "hasOwnProperty", "single", "maybeSingle", "rpc",
  "from", "split", "join", "replace", "match", "test", "includes", "indexOf", "toLowerCase",
  "toUpperCase", "querySelector", "addEventListener", "textContent", "innerHTML", "classList",
  "dataset", "style", "value", "id_", "then_"]);

const files = [];
const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) {
  if (f.name === "node_modules" || f.name.startsWith(".")) continue;
  const p = join(d, f.name);
  if (f.isDirectory()) walk(p); else if (/\.(html|js|ts|mjs)$/.test(f.name)) files.push(p);
} };
walk(join(ROOT, "public")); walk(join(ROOT, "api")); walk(join(ROOT, "supabase/functions"));

const callers = files.filter((p) => CALL.test(readFileSync(p, "utf8")));
console.log(`CALLERS OF get_public_business, enumerated from the product (L97) — ${callers.length}:`);
for (const p of callers) console.log(`  ${p.slice(ROOT.length + 1)}`);
console.log(`\nWINDOW: ${WINDOW} lines after each call site. Printed because it is an assumption.\n`);

const fields = new Map();
const add = (f, where) => { if (!fields.has(f)) fields.set(f, new Set()); fields.get(f).add(where); };
const notes = [];

/* ── (a) THE WINDOW AFTER EACH CALL ─────────────────────────────────────────────────────────── */
for (const p of callers) {
  const src = readFileSync(p, "utf8"), rel = p.slice(ROOT.length + 1), lines = src.split("\n");
  const at = lines.findIndex((l) => CALL.test(l));
  const win = lines.slice(at, at + WINDOW);
  // Whatever the row was unpacked into, in this window: destructured names and simple assignments.
  const roots = new Set();
  const head = win.join("\n");
  for (const m of head.matchAll(/\{([^}]*)\}\s*=\s*await\s+[\w.$]+\.rpc\(\s*['"`]get_public_business['"`]/g))
    for (const nm of m[1].split(",")) { const v = nm.split(":").pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(v)) roots.add(v); }
  for (const m of head.matchAll(/(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+[\w.$]+\.rpc\(\s*['"`]get_public_business['"`]|Array\.isArray\([^)]*\)\s*\?)/g))
    roots.add(m[1]);
  notes.push(`${rel}:${at + 1} — the row is unpacked into: ${[...roots].join(", ") || "(NONE RESOLVED — this caller is not covered)"}`);
  for (const v of roots) {
    const rx = new RegExp(`\\b${v}\\s*(?:\\?)?\\.([a-z_][a-z0-9_]*)\\b`, "g");
    for (let i = 0; i < win.length; i++) for (const m of win[i].matchAll(rx))
      if (!NOT_A_COLUMN.has(m[1])) add(m[1], `${rel}:${at + 1 + i} (${v}.${m[1]}, within ${WINDOW} lines of the call)`);
  }
}

/* ── (b) THE NAMED GLOBAL, ONLY IF ITS ASSIGNMENTS STILL JUSTIFY IT ─────────────────────────── */
const G = "currentBusiness";
for (const p of callers) {
  const src = readFileSync(p, "utf8"), rel = p.slice(ROOT.length + 1), lines = src.split("\n");
  const assigns = [...src.matchAll(new RegExp(`\\b${G}\\s*=\\s*([^;\\n]{0,70})`, "g"))].map((m) => m[1].trim());
  if (!assigns.length) continue;
  // The justification, re-checked: every assignment is a business row (or null / the global itself).
  const suspicious = assigns.filter((a) => !/^(null|data|bizData|existing|currentBusiness\b|\{id:'ceo-demo-biz')/.test(a));
  if (suspicious.length) {
    notes.push(`${rel} — ${G} IS NOT USABLE FILE-WIDE: ${suspicious.length} assignment(s) are not a ` +
      `business row (${suspicious.slice(0, 3).join(" | ")}). Its reads are EXCLUDED, so the list below ` +
      `is incomplete by that much.`);
    continue;
  }
  notes.push(`${rel} — ${G} read file-wide: all ${assigns.length} assignment(s) are a business row ` +
    `(${[...new Set(assigns)].slice(0, 5).join(" | ")}), re-checked here rather than assumed`);
  const rx = new RegExp(`\\b${G}\\s*(?:\\?)?\\.([a-z_][a-z0-9_]*)\\b`, "g");
  for (let i = 0; i < lines.length; i++) for (const m of lines[i].matchAll(rx))
    if (!NOT_A_COLUMN.has(m[1])) add(m[1], `${rel}:${i + 1} (${G}.${m[1]})`);
}

for (const n of notes) console.log(`  ${n}`);
const cols = [...fields.keys()].sort();
console.log(`\nFIELDS READ OFF THE RETURNED OBJECT — ${cols.length}:`);
for (const c of cols) {
  const why = [...fields.get(c)];
  console.log(`  ${c.padEnd(24)} ${String(why.length).padStart(3)} read(s)  e.g. ${why[0]}`);
}
console.log(`\nALLOWLIST, as SQL (paste into the migration, do not retype):`);
console.log(`  ${cols.map((c) => `'${c}'`).join(", ")}`);
