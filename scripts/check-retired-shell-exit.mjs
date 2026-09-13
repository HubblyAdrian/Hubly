#!/usr/bin/env node
/**
 * THE RETIRED OPERATOR SHELL IS LEFT ON WHO ARRIVES, NOT ON WHERE THEY WERE.
 *
 *   node scripts/check-retired-shell-exit.mjs
 *
 * `openOperateHome()` redirects an owner out of the retired 25-item operator shell. From
 * 2026-09-08 to 2026-09-13 that redirect was gated on `_target === 'dashboard'` — the
 * RESTORED VIEW — and `readPersistedOwnerAppView()` restores whatever the owner last opened.
 * So it fired for owners who had never been anywhere and never for the ones who had: one
 * visit to jobs or leads pinned them inside the retired shell permanently, because the stale
 * value restored itself on every subsequent arrival.
 *
 * Two things must stay true, and each is asserted separately so either can go red alone:
 *   1. the redirect condition does NOT read the restored view
 *   2. the redirect clears the persisted view before leaving
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.env.HUBLY_SHELL_FILE || join(ROOT, "public/hubly.html");

let src;
try { src = readFileSync(FILE, "utf8"); }
catch (e) { console.error("CANNOT RUN — cannot read " + FILE); process.exit(2); }

// The block is bounded by its own marker comment and the `location.replace('/')` inside it.
const start = src.indexOf("GATE ON WHO IS ARRIVING");
if (start < 0) { console.error("CANNOT RUN — the retired-shell exit block is not where this check expects it (marker comment missing)"); process.exit(2); }
const redirectAt = src.indexOf("location.replace('/')", start);
if (redirectAt < 0) { console.error("CANNOT RUN — no location.replace('/') after the marker"); process.exit(2); }
const block = src.slice(start, redirectAt + 40);
// Only the CODE decides; a comment may discuss the old condition freely.
const code = block.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ");

const fails = [];
if (/_target|readPersistedOwnerAppView\s*\(|\bpersisted\s*&&/.test(code)) {
  fails.push("the redirect condition reads the RESTORED VIEW. It must gate on whether an owner is arriving — the old bug was asking which view, not who.");
}
if (!/\bclearPersistedOwnerAppView\s*\(\s*\)/.test(code)) {
  fails.push("the redirect does not clear the persisted view. A stale value pulls the owner back the moment anything reads it — including this function on the next visit.");
}
if (!/function\s+clearPersistedOwnerAppView\s*\(/.test(src)) {
  fails.push("clearPersistedOwnerAppView() is not defined anywhere in the file.");
}

console.log(`retired-shell exit block found at byte ${start}; ${code.replace(/\s+/g, " ").length} chars of code examined`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — the exit gates on the arriver and clears the persisted view.");
