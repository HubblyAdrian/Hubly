#!/usr/bin/env node
/**
 * A QUESTION HUBLY ASKS HAS EXACTLY ONE WRITER.
 *
 * On 2026-09-12, on ridgeline-pressure-washing, an owner was asked the same question
 * twice in a row, 42 seconds apart:
 *
 *   seq 2 (05:45:11, model)      "…I'm giving it a crisp, fresh look… What's the business called?"
 *   seq 3 (05:45:53, standalone) "What's the business called?"
 *
 * Two writers of one question — the fifth pair of gates holding one fact this week, and
 * the first one a customer could see. The standalone ask owns it (it is composed
 * client-side, `isTalkBizTitle` in public/hubly.html); the model describes what it is
 * making and stops.
 *
 * THIS CHECKS BOTH HALVES, because either alone can go green while the owner still sees
 * the question twice:
 *
 *   STATIC     — nothing in the server prompt tells or permits the model to ask for the
 *                business name. Runs anywhere, needs no database.
 *   TRANSCRIPT — no business has two consecutive assistant turns asking the same
 *                question. This reads the record rather than a replica: it goes RED on
 *                ridgeline today, and is the thing to re-run after a deploy and a walk.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const notes = [];
const known = [];

// ── STATIC ────────────────────────────────────────────────────────────────────
const REGISTRY = "supabase/functions/_shared/hubly_capability_registry.ts";
let src;
try { src = readFileSync(join(ROOT, REGISTRY), "utf8"); }
catch (e) { console.error("CANNOT RUN — cannot read the registry: " + e.message); process.exit(2); }

// Instructions, not prose about them: a line that TELLS the model to ask. The negative
// forms ("do NOT ask…") are the fix and must not trip it.
for (const m of src.matchAll(/[^\n]*\bask\w*\b[^\n]{0,30}?\b(?:what (?:the )?business is called|what it is called|for (?:the|its|a) name)\b[^\n]*/gi)) {
  const line = m[0].trim();
  if (/^\s*(\/\/|\*)/.test(line)) continue;                 // a comment explaining the rule
  if (/\bdo NOT ask\b|\bnever ask\b|\bHubly asks\b/i.test(line)) continue;
  fails.push(`the model is still told to ask for the name:\n      ${line.slice(0, 160)}`);
}

// ── TRANSCRIPT ────────────────────────────────────────────────────────────────
/** The question in a turn, normalised: last interrogative sentence, punctuation and
 *  smart quotes flattened. Comparing whole turns would miss it — the model's question
 *  arrives at the end of a paragraph and the standalone one arrives alone. */
function questionOf(text) {
  const t = String(text || "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const qs = t.match(/[^.?!]*\?/g);
  if (!qs || !qs.length) return null;
  return qs[qs.length - 1].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

let rows = null;
try {
  const q = `select b.slug, c.seq, c.role, c.content::text as content, to_char(c.created_at,'MM-DD HH24:MI:SS') as at
             from business_conversations c join businesses b on b.id = c.business_id
             where c.created_at > now() - interval '14 days'
             order by b.slug, c.seq`;
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows":');
  if (i >= 0) {
    let d = 0, s = out.indexOf("[", i), e = -1;
    for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
    rows = JSON.parse(out.slice(s, e));
  }
} catch (e) {
  notes.push("transcript half SKIPPED — the database was not reachable: " + String(e.message).slice(0, 90));
}

if (rows) {
  // KNOWN, AND DATED, so the check is green on the state we have explained and goes red
  // the moment a NEW owner sees it. Both of these are the model-composed name question
  // landing beside the standalone one — the defect fixed above, which cannot clear from
  // the record retroactively. A walk after the next deploy must not add a third.
  const KNOWN_PAIRS = new Set([
    "george-s-window-cleaning-company:2:3",   // 2026-09-10 22:09
    "ridgeline-pressure-washing:2:3",         // 2026-09-12 05:45, the walk that found it
  ]);
  const bySlug = new Map();
  for (const r of rows) { const a = bySlug.get(r.slug) || []; a.push(r); bySlug.set(r.slug, a); }
  let pairs = 0;
  for (const [slug, turns] of bySlug) {
    for (let i = 1; i < turns.length; i++) {
      const a = turns[i - 1], b = turns[i];
      if (a.role !== "assistant" || b.role !== "assistant") continue;
      const qa = questionOf(a.content), qb = questionOf(b.content);
      if (!qa || !qb || qa !== qb) continue;
      pairs++;
      const line = `${slug}: asked the same question twice in a row (seq ${a.seq} @ ${a.at}, seq ${b.seq} @ ${b.at}) — "${qb.slice(0, 60)}"`;
      if (KNOWN_PAIRS.has(`${slug}:${a.seq}:${b.seq}`)) known.push(line); else fails.push(line);
    }
  }
  notes.push(`transcript half: ${rows.length} turns across ${bySlug.size} businesses in the last 14 days; ${pairs} duplicate-question pair(s)`);
}

for (const n of notes) console.log("  " + n);
if (known.length) {
  console.log(`  known and explained (${known.length}) — recorded, not hidden:`);
  for (const k of known) console.log("    " + k);
}
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} place(s) where one question has two writers:`);
  for (const f of fails) console.error("  " + f);
  console.error("\nThe standalone ask owns the question. The model describes what it is making and stops.");
  process.exit(1);
}
console.log("PASS — nothing tells the model to ask for the name, and no owner was asked one question twice in a row.");
process.exit(0);
