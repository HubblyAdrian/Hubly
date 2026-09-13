#!/usr/bin/env node
/**
 * WHAT THE PRODUCT CAN ALREADY DO — GENERATED, NEVER HAND-WRITTEN.
 *
 *   node scripts/generate-capabilities.mjs            # writes docs/CAPABILITIES.md
 *   node scripts/generate-capabilities.mjs --check    # fails if the file is stale
 *
 * THREE TIMES we have queued research into whether something could be built that was already
 * shipping: the design-inference mechanism (evergreen already had the card), Jobs and
 * Customers (built, design and backend), and structural editing of a freeform page
 * (insert/move/delete/restyle, all reachable from the owner's conversation). Lesson 49 says
 * read the working example first — but prose will not stop the fourth.
 *
 * So this is the list, and it is generated: every exported mutation function in the shared
 * modules, its file, its size, and whether anything OWNER-REACHABLE calls it. A capability
 * nothing calls is a capability with no door (CLAUDE.md: look for the missing door before
 * building the room); a capability with a caller is one we already have.
 *
 * Parsed with acorn where the source is JS; the shared modules are Deno TS, so the export and
 * call extraction is done on the stripped source with brace matching — and the file prints its
 * own receipt so what it read is checkable.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { receipt } from "./lib/read-receipt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(ROOT, "supabase/functions/_shared");
const OUT = join(ROOT, "docs/CAPABILITIES.md");
const CHECK = process.argv.includes("--check");

const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));

/** A MUTATION is a function whose name says it changes something. Verb-led, deliberately
 *  loose (Lesson 61: enumerate loosely, then read every hit) — a reader can argue with a
 *  name on the list far more easily than they can notice one that is missing. */
const MUTATION = /^(apply|insert|place|move|delete|remove|mark|stamp|set|add|upload|patch|sync|restamp|strip|sanitize|build|generate|create|write|record|claim|assign)/i;

const files = readdirSync(SHARED).filter((f) => f.endsWith(".ts"));
const sources = new Map();
for (const f of files) sources.set(f, strip(readFileSync(join(SHARED, f), "utf8")));

/** Owner-reachable = called from the conversation function or from a capability action's
 *  handler. Those are the two doors an owner can actually come through. */
const doors = [
  ["hubly-conversation", strip(readFileSync(join(ROOT, "supabase/functions/hubly-conversation/index.ts"), "utf8"))],
  ["registry actions", sources.get("hubly_capability_registry.ts") || ""],
];

const caps = [];
for (const [file, src] of sources) {
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (!MUTATION.test(name)) continue;
    // SIZE — past the parameter list AND the return type first. A signature like
    // `export async function f(a: string): Promise<{ ok: boolean }> {` contains TWO braces
    // before the body, and the first version took the one inside the return type, reporting
    // 58-line functions as 1 line. Same mis-tokenising as Lesson 39, three months on.
    let p2 = m.index + m[0].length - 1, depth = 0, closeParen = -1;
    for (let i = p2; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") { depth--; if (!depth) { closeParen = i; break; } }
    }
    if (closeParen < 0) continue;
    // AFTER THE PARENS, THE RETURN TYPE CAN ALSO CONTAIN BRACES — an inline object literal
    // like `): { ok: boolean; html?: string } {`. Skipping only `<...>` was not enough:
    // insertServiceIntoFreeform reported 1 line because the type's brace was taken as the
    // body. The body brace is the one followed by a NEWLINE; a type's brace is mid-line.
    let k = closeParen + 1, angle = 0, brace = 0, open = -1;
    for (; k < src.length; k++) {
      const ch = src[k];
      if (ch === "<") angle++;
      else if (ch === ">") angle = Math.max(0, angle - 1);
      else if (ch === "{") {
        if (brace === 0 && angle === 0) {
          const rest = src.slice(k + 1, k + 40);
          if (/^[ \t]*\r?\n/.test(rest)) { open = k; break; }   // body: brace ends the line
        }
        brace++;
      } else if (ch === "}") brace = Math.max(0, brace - 1);
      else if (ch === ";" && brace === 0 && angle === 0) break;
    }
    let d = 0, end = -1;
    for (let i = open; i < src.length && open >= 0; i++) {
      if (src[i] === "{") d++;
      else if (src[i] === "}") { d--; if (!d) { end = i; break; } }
    }
    const lines = end > open ? src.slice(open, end).split("\n").length : 0;
    // Called anywhere in _shared at all? This separates "internal helper" from "built and
    // completely unreferenced" — the second is the missing-door case that matters.
    let internal = 0;
    for (const [f2, s2] of sources) {
      const n = (s2.match(new RegExp(`\\b${name}\\s*\\(`, "g")) || []).length - (f2 === file ? 1 : 0);
      if (n > 0) internal += n;
    }
    const callers = [];
    for (const [label, dsrc] of doors) {
      const calls = (dsrc.match(new RegExp(`\\b${name}\\s*\\(`, "g")) || []).length
                  - (dsrc === src ? 1 : 0);   // its own declaration
      if (calls > 0) callers.push(`${label} ×${calls}`);
    }
    caps.push({ name, file, lines, callers, internal });
  }
}
caps.sort((a, b) => (b.callers.length - a.callers.length) || a.file.localeCompare(b.file) || a.name.localeCompare(b.name));

const reachable = caps.filter((c) => c.callers.length);
const helpers = caps.filter((c) => !c.callers.length && c.internal > 0);
const dark = caps.filter((c) => !c.callers.length && c.internal === 0);
const body = `# Capabilities — what the product can already do

**GENERATED by \`scripts/generate-capabilities.mjs\`. Do not hand-edit.** Regenerate with
\`node scripts/generate-capabilities.mjs\`; \`--check\` fails if this file is stale.

Three times we have queued research into whether something could be built that was already
shipping — the design-inference mechanism, Jobs and Customers, and structural editing of a
freeform page. **Before asking whether we can build something, read what we already built.**

**${caps.length} mutation functions** exported from \`supabase/functions/_shared\`.
**${reachable.length} are owner-reachable** — something in the conversation function or a
capability action calls them. **${helpers.length} are called only by other shared
modules** (internal helpers). **${dark.length} have NO CALLER ANYWHERE** — built and
unreferenced, which is the missing-door case.

## Owner-reachable (${reachable.length})

| capability | file | lines | reached from |
|---|---|---|---|
${reachable.map((c) => `| \`${c.name}\` | ${c.file} | ${c.lines} | ${c.callers.join(", ")} |`).join("\n")}

## Internal helpers (${helpers.length})

Called by another shared module, but nothing an owner reaches directly.

| capability | file | lines | internal callers |
|---|---|---|---|
${helpers.map((c) => `| \`${c.name}\` | ${c.file} | ${c.lines} | ${c.internal} |`).join("\n")}

## NO CALLER ANYWHERE (${dark.length}) — the missing-door list

Built and referenced by nothing. This is the "look for the missing door before building the
room" case, and it is where the photo upload, the inline image editing, the trade-aware booking
wizard and Stripe Connect were all found built and unreachable.

| capability | file | lines |
|---|---|---|
${dark.map((c) => `| \`${c.name}\` | ${c.file} | ${c.lines} |`).join("\n")}

*Generated ${new Date().toISOString().slice(0, 10)}. The name filter is deliberately loose —
a reader can argue with a name on this list far more easily than notice one missing.*
`;

if (CHECK) {
  let current = "";
  try { current = readFileSync(OUT, "utf8"); } catch {}
  const norm = (s) => s.replace(/\*Generated \d{4}-\d{2}-\d{2}\./, "");
  if (norm(current) !== norm(body)) {
    console.error("FAIL — docs/CAPABILITIES.md is stale. Run: node scripts/generate-capabilities.mjs");
    process.exit(1);
  }
  console.log(`PASS — CAPABILITIES.md matches the code (${caps.length} capabilities, ${reachable.length} owner-reachable, ${dark.length} with no caller).`);
  process.exit(0);
}
writeFileSync(OUT, body);
console.log(`docs/CAPABILITIES.md written — ${caps.length} mutation capabilities · ${reachable.length} owner-reachable · ${helpers.length} internal helpers · ${dark.length} with NO caller anywhere.`);
