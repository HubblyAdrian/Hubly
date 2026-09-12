#!/usr/bin/env node
/**
 * A CAPABILITY MAY NOT REFUSE AN UNCLAIMED DRAFT ITS WRITER WOULD HAVE ACCEPTED.
 *
 *   node scripts/check-draft-capable-writers.mjs
 *
 * `business.setHours` shipped 2026-09-08 with this at the top of its handler:
 *
 *     if (!ownerUid) return { error: "not_signed_in", … }
 *
 * and nothing was wrong with the sentence — it was wrong about who was asking. Most
 * businesses that say "we open at 8" are an UNCLAIMED DRAFT with a token and no account.
 * The writer underneath authorises a draft by token; the handler refused before it ever
 * asked. Four days, every draft owner, silent.
 *
 * The mirror of check-owner-id-invariant.mjs, which catches a writer that forgets the
 * OWNER. This catches one that forgets the DRAFT. Both are the same defect — a caller
 * making an access decision its writer already makes, and making it differently.
 *
 * THE DRAFT-CAPABLE SET IS DERIVED, NOT LISTED. Every migration is read in filename
 * order and the LAST definition of each function wins, exactly as Postgres sees it; a
 * function whose live signature takes `p_draft_token` is draft-capable. A hardcoded list
 * would be a second definition of a fact, which is the disease (Lesson 45).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");
const MIGRATIONS = join(ROOT, "supabase/migrations");

/** Prose is not code (Lesson 39). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "));
}
/** Balanced slice from the opening bracket at `from`. */
function balanced(src, from, open, close) {
  let d = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close) { d--; if (!d) return src.slice(from, i + 1); }
  }
  return null;
}

// ── 1. WHICH RPCs TAKE A DRAFT TOKEN, as the database currently stands ──────────
let files;
try { files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort(); }
catch (e) { console.error("CANNOT RUN — no migrations directory: " + e.message); process.exit(2); }
const signatures = new Map();
for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS, f), "utf8");
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    const params = balanced(sql, sql.indexOf("(", m.index + m[0].length - 1), "(", ")");
    if (params) signatures.set(m[1], params);          // filename order: the last one wins
  }
  const dropAll = /drop\s+function\s+if\s+exists\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*;\s*$/gim;
  let d;
  while ((d = dropAll.exec(sql))) { /* a drop is always followed by the create above */ }
}
const draftCapable = new Set([...signatures].filter(([, p]) => /p_draft_token/.test(p)).map(([n]) => n));
if (!draftCapable.size) { console.error("CANNOT RUN — no draft-capable RPC found; the scan is broken, not the code"); process.exit(2); }

// ── 2. EVERY HANDLER THAT CALLS ONE ─────────────────────────────────────────────
let src;
try { src = stripComments(readFileSync(REGISTRY, "utf8")); }
catch (e) { console.error("CANNOT RUN — registry unreadable: " + e.message); process.exit(2); }

const handlers = [];
const hre = /handler:\s*async\s*\(([^)]*)\)\s*=>\s*\{/g;
let h;
while ((h = hre.exec(src))) {
  const body = balanced(src, src.indexOf("{", h.index + h[0].length - 1), "{", "}");
  if (!body) continue;
  // The action's own name is the nearest `name: "…"` above it.
  const before = src.slice(0, h.index);
  const nm = [...before.matchAll(/name:\s*"([^"]+)"/g)].pop();
  handlers.push({ name: nm ? nm[1] : "(unnamed)", body, line: before.split("\n").length });
}
if (handlers.length < 10) { console.error(`CANNOT RUN — only ${handlers.length} handlers parsed; the scan is broken`); process.exit(2); }

const fails = [], ok = [];
for (const a of handlers) {
  const calls = [...a.body.matchAll(/callBusinessRpc\(\s*"(\w+)"/g)].map((m) => m[1]).filter((n) => draftCapable.has(n));
  if (!calls.length) continue;
  const callAt = a.body.search(/callBusinessRpc\(\s*"(?:\w+)"/);
  const head = a.body.slice(0, callAt);
  // A refusal on the absence of an owner, BEFORE the writer gets to decide.
  const refuses = /if\s*\([^)]*!\s*ownerUid[^)]*\)\s*\{?[^}]*not_signed_in/s.test(head);
  const passesToken = /p_draft_token/.test(a.body);
  if (refuses) fails.push(`${a.name} (registry:${a.line}) refuses !ownerUid before calling ${calls[0]}, which authorises a draft by token`);
  else if (!passesToken) fails.push(`${a.name} (registry:${a.line}) calls ${calls[0]} without passing p_draft_token — a draft can never be authorised`);
  else ok.push(`${a.name} -> ${calls.join(", ")}`);
}

console.log(`draft-capable RPCs, derived from ${files.length} migrations: ${[...draftCapable].sort().join(", ")}`);
console.log(`capability handlers parsed: ${handlers.length}   handlers calling a draft-capable writer: ${ok.length + fails.length}`);
for (const o of ok) console.log(`  ok  ${o}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} handler(s) refuse a draft their writer would accept:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log(`\nPASS — every handler that calls a draft-capable writer lets the writer decide.`);
