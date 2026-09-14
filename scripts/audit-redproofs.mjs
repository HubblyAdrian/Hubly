#!/usr/bin/env node
/**
 * RED-PROOF THE CHECKS WE HAVE RULED FROM.
 *
 *   node scripts/audit-redproofs.mjs            # every check in the ruled-from set
 *   node scripts/audit-redproofs.mjs --only=X   # one, by check name
 *   node scripts/audit-redproofs.mjs --list     # the set and why each gated a ruling
 *
 * A check's green is worth exactly what its red is worth. Every check listed below was the
 * evidence for a DECISION — a fix ruled done, a defect ruled absent, a number quoted to
 * Adrian. This breaks the thing each one asserts, in the real file, and requires the check to
 * SAY SO. A check that stays green under its own mutation was never measuring the property
 * it is named for, and every ruling that rested on it rests on nothing.
 *
 * WHY MUTATE THE REAL FILE AND NOT A COPY: failure #4 of check-computed-and-dropped was a
 * red-proof that pointed at a mutated copy while the check resolved paths against the repo,
 * so it parsed the real file twice and passed. Mutating in place removes that whole class.
 * The tree must be clean to start, and every file is restored from git in a finally — the
 * restore is verified, and a dirty tree after a run is reported as a failure of THIS script.
 *
 * Exit: 0 every check went red · 1 one or more stayed green · 2 cannot run
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";
const LIST = process.argv.includes("--list");
const TIER = (process.argv.find((a) => a.startsWith("--tier=")) || "").split("=")[1] || "";

/** Replace the first occurrence of `find` with `repl`; throw if the anchor is gone, because a
 *  mutation that silently no-ops produces a "stayed green" verdict about nothing. */
const swap = (find, repl) => (src) => {
  const i = src.indexOf(find);
  if (i < 0) throw new Error(`anchor not present: ${JSON.stringify(find.slice(0, 70))}`);
  return src.slice(0, i) + repl + src.slice(i + find.length);
};
const append = (text) => (src) => src + text;

const SET = [
  // ── source-only, fast ──────────────────────────────────────────────────────
  { check: "check-no-duplicate-ids", tier: "fast",
    ruled: "the dead-nav fix at source — that stripPreviewCloneIds actually removes the id",
    file: "public/hubly.html",
    mutate: swap('<body', '<div id="hc-redproof-dup"></div><div id="hc-redproof-dup"></div><body') },

  { check: "check-one-ask-not-a-list", tier: "fast",
    ruled: "one ask at a time — that the tiered gap ask says exactly one thing",
    file: "public/platform-home.html",
    mutate: append(`\n<script>function hcRedproofBullets(){ hcAppendMessage('hubly', '• ' + n.text); }</script>\n`) },

  { check: "check-one-voluntary-addition", tier: "fast",
    ruled: "the repeating-message gate — one voluntary addition per turn",
    file: "public/platform-home.html",
    mutate: (src) => {
      const m = /function hcMayAddVoluntary\s*\([^)]*\)\s*\{/.exec(src);
      if (!m) throw new Error("hcMayAddVoluntary not found");
      return src.slice(0, m.index + m[0].length) + " return true; " + src.slice(m.index + m[0].length);
    } },

  { check: "check-denominator-rule", tier: "fast",
    ruled: "every rate quoted this week — that it carries its market/internal/test split",
    file: "scripts/__redproof_rate.mjs", create: true,
    mutate: () => `// a rate with no denominator, exactly the 2026-09-13 shape\nconsole.log(\`pages with a photo: \${(hit / total * 100).toFixed(0)}%\`);\n` },

  { check: "check-paginated-aggregate", tier: "fast",
    ruled: "every aggregate printed off the admin connection",
    file: "public/platform-home.html",
    mutate: append(`\n<script>async function hcRedproofAgg(){ var r = await sb.from('businesses').select('*'); var rows = (r && r.data) || []; return rows.reduce(function(a,b){ return a + 1; }, 0); }</script>\n`) },

  { check: "check-no-directives-to-owners", tier: "fast",
    ruled: "Hubly never points at a control it cannot see",
    file: "supabase/functions/_shared/hubly_owner_replies.ts",
    mutate: append(`\nexport function redproofDirective(): string {\n  return "Click the Publish button in the top right to put it live.";\n}\n`) },

  { check: "check-destructive-confirm", tier: "fast",
    ruled: "the destructive-action shape — a live page is never replaced unasked",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: (src) => {
      const m = /function\s+wouldReplaceALivePage\s*\(|const\s+wouldReplaceALivePage\s*=/.exec(src);
      if (!m) throw new Error("the gate's definition was not found under either name");
      return src.slice(0, m.index) + "// redproof: gate renamed out from under its callers\n" +
             src.slice(m.index).replace("wouldReplaceALivePage", "wouldReplaceALivePage_REDPROOF");
    } },

  { check: "check-owner-id-invariant", tier: "fast",
    ruled: "the claimed-owner write audit — a writer without p_owner_id is dead on a claimed site",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: swap("p_owner_id:", "p_owner_id_REDPROOF:") },

  { check: "check-computed-and-dropped", tier: "fast",
    ruled: "the computed-and-dropped audit — a value measured and never returned",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: append(`\nexport function redproofDropped(html: string) {\n  const verifiedPlaced = html.includes("data-hubly-service");\n  return { status: "ok" };\n}\n`) },

  { check: "check-classic-claim", tier: "slow",
    ruled: "the two-store split, classic side — the sentence may not outlive the inability",
    file: "supabase/functions/_shared/hubly_owner_replies.ts",
    mutate: swap("composeServicesTruth", "composeServicesTruth_REDPROOF") },

  { check: "check-two-store-readers", tier: "slow",
    ruled: "the services reader reads both stores",
    file: "supabase/migrations/20260914080000_services_reader_both_stores.sql",
    mutate: swap("meta", "meta_REDPROOF") },

  { check: "check-registry-knows-every-door", tier: "slow",
    ruled: "the door measurement — 212 capabilities, 8 talk, 20 diy, 3 both",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: swap("website.moveSection", "website.moveSection_REDPROOF") },

  { check: "check-draft-capable-writers", tier: "slow",
    ruled: "which writers work on an unclaimed draft",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: (src) => {
      const m = /case "business\.setHours"[\s\S]{0,400}?\{/.exec(src);
      if (!m) throw new Error("business.setHours handler not found");
      return src.slice(0, m.index + m[0].length) +
        `\n      if (!ownerUid) return { error: "not_signed_in" } as any;\n` +
        src.slice(m.index + m[0].length);
    } },

  { check: "check-capability-reachable", tier: "slow",
    ruled: "reachability — a capability the model can name and the router cannot run",
    file: "supabase/functions/hubly-conversation/index.ts",
    mutate: swap("applyOwnerRecordEdit", "applyOwnerRecordEdit_REDPROOF") },

  { check: "check-browser-rig", tier: "slow",
    ruled: "every browser measurement this week ran through it",
    file: "scripts/lib/browser-rig.mjs",
    mutate: swap("__hublyWitness", "__hublyWitness_REDPROOF") },
];

if (LIST) {
  for (const s of SET) console.log(`${s.check.padEnd(34)} ${s.tier.padEnd(5)} ${s.ruled}`);
  console.log(`\n${SET.length} checks in the ruled-from set.`);
  process.exit(0);
}

// ── the tree must be clean, or the restore cannot be trusted ──────────────────
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
if (dirty) { console.error("CANNOT RUN — working tree is dirty; the restore would not be trustworthy:\n" + dirty); process.exit(2); }

function runCheck(name) {
  const r = spawnSync("node", [`scripts/${name}.mjs`], { cwd: ROOT, encoding: "utf8", timeout: 600000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const rows = [];
for (const s of SET) {
  if (ONLY && s.check !== ONLY) continue;
  if (TIER && s.tier !== TIER) continue;
  const path = resolve(ROOT, s.file);
  let before = null;
  try {
    // 1. green first — a check already red proves nothing about the mutation
    const green = runCheck(s.check);
    if (green.code === 2) { rows.push({ ...s, verdict: "CANNOT RUN", note: green.out.trim().split("\n")[0].slice(0, 90) }); continue; }
    if (green.code !== 0) { rows.push({ ...s, verdict: "ALREADY RED", note: "this check does not currently pass; red-proof is meaningless until it does" }); continue; }

    // 2. break the thing it asserts
    if (s.create) { writeFileSync(path, s.mutate("")); }
    else { before = readFileSync(path, "utf8"); writeFileSync(path, s.mutate(before)); }

    // 3. it must say so
    const red = runCheck(s.check);
    rows.push({
      ...s,
      verdict: red.code === 1 ? "RED-PROVED" : red.code === 2 ? "CANNOT RUN UNDER MUTATION" : "STAYED GREEN",
      note: red.code === 1 ? (red.out.split("\n").find((l) => /FAIL/.test(l)) || "").trim().slice(0, 100)
                           : red.out.trim().split("\n").slice(-1)[0].slice(0, 100),
    });
  } catch (e) {
    rows.push({ ...s, verdict: "MUTATION FAILED", note: String(e.message).slice(0, 100) });
  } finally {
    if (s.create) { if (existsSync(path)) unlinkSync(path); }
    else if (before !== null) writeFileSync(path, before);
  }
}

const after = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();

const W = { "RED-PROVED": "✅", "STAYED GREEN": "❌", "ALREADY RED": "⚠️ ", "CANNOT RUN": "⚠️ ", "MUTATION FAILED": "⚠️ ", "CANNOT RUN UNDER MUTATION": "⚠️ " };
console.log();
for (const r of rows) {
  console.log(`${W[r.verdict] || "  "} ${r.check.padEnd(34)} ${r.verdict}`);
  console.log(`   gated: ${r.ruled}`);
  if (r.note) console.log(`   ${r.note}`);
}
const bad = rows.filter((r) => r.verdict !== "RED-PROVED");
// not-a-corpus-rate: counts checks in this audit, not businesses
console.log(`\nchecks red-proofed: ${rows.filter((r) => r.verdict === "RED-PROVED").length} of ${rows.length}`);
if (after) { console.log(`\nTREE NOT RESTORED — this script failed, regardless of the verdicts above:\n${after}`); process.exit(1); }
console.log("tree restored clean.");
if (bad.length) { console.log(`\n${bad.length} check(s) did not go red under their own mutation. Every ruling that rested on them rests on nothing until this is resolved.`); process.exit(1); }
process.exit(0);
