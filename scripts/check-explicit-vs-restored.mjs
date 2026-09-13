#!/usr/bin/env node
/**
 * AN EXPLICIT URL NAMING A VIEW IS HONOURED. A DEFAULT OR PERSISTED ARRIVAL REDIRECTS.
 *
 *   node scripts/check-explicit-vs-restored.mjs
 *
 * The retired operator shell has SIX entry points (Lesson 55). `5a21a1b` gated one of them on
 * whether an owner is arriving. The policy this check enforces is the distinction that makes
 * the other five safe to close later:
 *
 *   - a URL that NAMES a view (`/app#leads`) is an act of intent — honour it
 *   - a default arrival, or one restored from sessionStorage, is not — redirect it
 *
 * Both halves matter. Without the first, closing the doors deletes every operator surface the
 * claimed rail has no equivalent for. Without the second, one visit pins an owner in the
 * retired shell forever, which is the bug that was just fixed.
 *
 * THIS IS WRITTEN BEFORE THE DOORS CLOSE, deliberately: a door added later without the
 * distinction fails the run rather than being discovered by an owner.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { receipt } from "./lib/read-receipt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.env.HUBLY_SHELL_FILE || join(ROOT, "public/hubly.html");

let src;
try { src = receipt(FILE, "read"); }
catch (e) { console.error("CANNOT RUN — cannot read " + FILE); process.exit(2); }

/** The six ways into the operator shell, found 2026-09-13. Each must either pass through the
 *  gate, or be a path that cannot carry an arrival (a pure paint). Keyed by the call site's
 *  own text so a MOVED line still matches and a NEW door does not. */
const DOORS = [
  { id: "openOperateHome", find: /function\s+openOperateHome\s*\(/, gated: true },
  { id: "signed-in bounce from p-landing/p-signup/p-signin", find: /dest==='p-landing'\|\|dest==='p-signup'\|\|dest==='p-signin'/, gated: false },
  { id: "session-restored boot", find: /Session restored — never coerce dashboard\/onboarding back to marketing/, gated: false },
  { id: "goWebsiteSetup", find: /async function goWebsiteSetup\s*\(/, gated: false },
  { id: "pixel-editor entry (goClassicDashboard)", find: /function\s+goClassicDashboard\s*\(/, gated: false },
  { id: "goDash", find: /function\s+goDash\s*\(/, gated: false },
];

const GATE = /GATE ON WHO IS ARRIVING/;
const EXPLICIT = /parseOwnerAppViewHash\s*\(|location\.hash/;

const missing = DOORS.filter((d) => !d.find.test(src));
if (missing.length) {
  console.error(`CANNOT RUN — ${missing.length} known entry point(s) no longer match; this check is stale, not the code:`);
  for (const m of missing) console.error("  " + m.id);
  process.exit(2);
}
console.log(`entry points into the operator shell, all found: ${DOORS.length}`);

const fails = [];
if (!GATE.test(src)) fails.push("the arriver gate is gone from openOperateHome — nothing routes an owner out of the retired shell");

// The policy itself: the gate must distinguish an EXPLICIT hash from a RESTORED value.
const gateAt = src.search(GATE);
const gateBlock = gateAt >= 0 ? src.slice(gateAt, src.indexOf("location.replace('/')", gateAt) + 40) : "";
const code = gateBlock.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ");
if (/readPersistedOwnerAppView\s*\(/.test(code)) {
  fails.push("the gate reads the RESTORED view — a persisted arrival must redirect, and reading it here is how it stopped doing so");
}
if (!/parseOwnerAppViewHash\s*\(/.test(src) || !EXPLICIT.test(src)) {
  fails.push("no explicit-URL reader exists (parseOwnerAppViewHash / location.hash), so an explicit request cannot be honoured — closing the other doors would delete every operator surface");
}

console.log(`gate present: ${GATE.test(src)}   explicit-URL reader present: ${EXPLICIT.test(src)}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — the gate exists, it does not consult the restored view, and an explicit URL can still be read.");
