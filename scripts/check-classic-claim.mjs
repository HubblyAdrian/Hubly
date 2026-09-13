#!/usr/bin/env node
/**
 * THE SENTENCE MAY NOT OUTLIVE THE INABILITY IT DESCRIBES.
 *
 * On 2026-09-13, composeServicesTruth's classic branch shipped saying "your page is built a
 * different way and I can't add them to it from here yet." It was true for four hours. The
 * moment set_business_service_catalog was wired, that sentence became a lie told to the only
 * paying customer — and nothing in the repo would have noticed, because a sentence about what
 * Hubly can do reads like prose and behaves like a status indicator. Green is earned
 * (prohibition 2); so is red.
 *
 * THREE LEGS, because the first version of this fix failed on the second one and would have
 * passed a wording check:
 *
 *   1. WIRED — if setServices calls the classic writer, every composeServicesTruth call site
 *      must pass the classic outcome. A composer that is never told cannot be right by luck.
 *   2. REACHABLE — no caller may gate composeServicesTruth on `status !== "not_freeform"`.
 *      That gate is what made the whole classic branch dead code the first time: written,
 *      deployed, and never once executed.
 *   3. TRUTHFUL — run the composer for real on a written classic outcome and require a plain
 *      positive sentence. Not a phrase list of denials (that is enumerating the valuable side,
 *      and it undercounts every time); a closed set of NEGATION MARKERS that a sentence saying
 *      "these are on your site now" has no reason to contain at all.
 *
 * Exit: 0 all three hold · 1 a leg failed · 2 cannot run.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REG = join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");
const REPLIES = join(ROOT, "supabase/functions/_shared/hubly_owner_replies.ts");
const CONV = join(ROOT, "supabase/functions/hubly-conversation/index.ts");

let failed = 0;
const say = (leg, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${leg}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
};

let reg, replies, conv;
try {
  reg = readFileSync(REG, "utf8");
  replies = readFileSync(REPLIES, "utf8");
  conv = readFileSync(CONV, "utf8");
} catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

// Does the classic write path exist at all? Everything below is conditional on this, because
// before it existed the sentence was true and this check must not have failed the build then.
const classicWriterExists = /callBusinessRpc\(\s*"set_business_service_catalog"/.test(reg)
  && /async function applyServicesToClassic\(/.test(reg);
const setServicesCallsIt = /applyServicesToClassic\(draftId/.test(reg);
console.log(`classic writer present: ${classicWriterExists} · called by setServices: ${setServicesCallsIt}`);
if (!classicWriterExists || !setServicesCallsIt) {
  console.log("\nThe classic write path does not exist, so the branch is entitled to say so. Nothing to check.");
  process.exit(0);
}

// ── LEG 1: every composeServicesTruth call site passes the classic outcome ─────────────
const callSites = [...conv.matchAll(/composeServicesTruth\(([^)]*)\)/g)].map((m) => m[1]);
const missingArg = callSites.filter((a) => a.split(",").length < 3);
say("1 wired", callSites.length > 0 && missingArg.length === 0,
  `${callSites.length} call site(s), ${missingArg.length} missing the classic argument`);

// ── LEG 2: no caller gates it out ───────────────────────────────────────────────────────
const gate = /status\s*!==\s*"not_freeform"/.test(conv);
say("2 reachable", !gate, gate ? 'hubly-conversation still gates on status !== "not_freeform"' : "no not_freeform gate");

// ── LEG 3: run the composer and read the sentence it actually produces ──────────────────
const dir = mkdtempSync(join(tmpdir(), "hubly-claim-"));
const probe = join(dir, "probe.ts");
writeFileSync(probe, `
import { composeServicesTruth } from "file://${REPLIES}";
const placement = { status: "not_freeform", verifiedPlaced: [], missing: ["Headlight Restoration"] };
console.log(JSON.stringify({
  written: composeServicesTruth(placement as any, "https://x.myhubly.app",
    { status: "written", added: ["Headlight Restoration"], updated: [], preserved: 7 }),
  empty: composeServicesTruth(placement as any, "https://x.myhubly.app",
    { status: "written", added: [], updated: [], preserved: 7 }),
}));
`);
let out;
try { out = JSON.parse(execFileSync("deno", ["run", "-A", probe], { encoding: "utf8" }).trim().split("\n").pop()); }
catch (e) { console.error("CANNOT RUN — the composer would not execute: " + String(e.message).slice(0, 200)); process.exit(2); }

console.log(`\n  written -> ${JSON.stringify(out.written)}`);
console.log(`  empty   -> ${JSON.stringify(out.empty)}`);

// NEGATION MARKERS, not a list of denials. A sentence reporting that something IS on the
// owner's site has no reason to carry any of these; a denial in English is very hard to write
// without one. Enumerating the harmless side is the whole point (CLAUDE.md).
const NEG = /\bn't\b|n't|\bnot\b|\bno\b|\bnever\b|\bcannot\b|\bunable\b|\byet\b/i;
const hit = out.written.match(NEG);
say("3 truthful", Boolean(out.written) && !hit,
  hit ? `the written-classic sentence contains the negation marker "${hit[0]}": ${JSON.stringify(out.written)}`
      : "positive, names the service, no negation");

// And the empty-list refusal — broken grammar in a composed sentence means the sentence is
// composed rather than true, so it must not be emitted at all.
say("3b empty list refuses to emit", out.empty === "", `returned ${JSON.stringify(out.empty)}`);

console.log(failed ? `\n${failed} leg(s) failed.` : "\nAll legs hold.");
process.exit(failed ? 1 : 0);
