#!/usr/bin/env node
/**
 * THE MOUNT DECISION EXISTS TWICE AND MUST NOT DRIFT.
 *
 * `hcIsFullDocument` in public/hubly.html decides whether a stored page is mounted in a
 * srcdoc iframe (all its CSS must be in the page) or set as innerHTML on #hc-doc-root
 * (where 158KB of shell stylesheet applies). Every harness that renders a stored page has
 * to make the same call, and a harness cannot import from a browser file — so the copy in
 * scripts/lib/mount-as-product.mjs is unavoidable. This makes it checkable instead.
 *
 * It is the fifth pair of gates holding one fact this week, and the first one inside our
 * instruments rather than the product (Lesson 37).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FULL_DOCUMENT_RE, isFullDocument, SHELL_STYLESHEETS } from "./lib/mount-as-product.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let shell;
try { shell = readFileSync(join(ROOT, "public/hubly.html"), "utf8"); }
catch (e) { console.error("CANNOT RUN — public/hubly.html unreadable: " + e.message); process.exit(2); }

const fails = [];

// 1. THE PREDICATE ITSELF, read out of the browser file and compared source-to-source.
const m = /function hcIsFullDocument\(html\)\{\s*return\s*(\/[^\n]*?\/[a-z]*)\.test/i.exec(shell.replace(/\n\s*/g, "\n"))
  || /function hcIsFullDocument\(html\)\s*\{[\s\S]{0,200}?return\s*(\/.*?\/[a-z]*)\.test/i.exec(shell);
if (!m) {
  fails.push("hcIsFullDocument not found in public/hubly.html — the harness copy has nothing to agree with. If it was renamed, update this check and scripts/lib/mount-as-product.mjs together.");
} else if (m[1] !== String(FULL_DOCUMENT_RE)) {
  fails.push(`the two copies disagree:\n    public/hubly.html          ${m[1]}\n    lib/mount-as-product.mjs   ${String(FULL_DOCUMENT_RE)}`);
}

// 1b. THE THIRD COPY — the server-side guard, which refuses an unstyled page only when the
//     page is the kind that must carry its own CSS. If its idea of "full document" drifts
//     from the client's, the guard either stops firing or starts refusing healthy fragments
//     — which is the seven-page false alarm, rebuilt in the product.
const GUARD = "supabase/functions/_shared/hubly_page_css_guard.ts";
try {
  const src = readFileSync(join(ROOT, GUARD), "utf8");
  const g = /FULL_DOCUMENT_RE\s*=\s*(\/.*?\/[a-z]*)\s*;/.exec(src);
  if (!g) fails.push(`FULL_DOCUMENT_RE not found in ${GUARD}`);
  else if (g[1] !== String(FULL_DOCUMENT_RE)) {
    fails.push(`the guard disagrees:\n    ${GUARD}   ${g[1]}\n    lib/mount-as-product.mjs   ${String(FULL_DOCUMENT_RE)}`);
  }
} catch { fails.push(`${GUARD} is missing — the unstyled-page guard has no mount decision to gate on`); }

// 2. BEHAVIOUR, not only text. A regex can be rewritten and still mean the same thing;
//    these are the shapes the corpus actually contains, and both copies must agree on them.
const CASES = [
  ["<!doctype html><html>…", true],
  ["<!DOCTYPE HTML>\n<html lang=\"en\">", true],
  ["  \n<html><head>", true],
  ["<style>#hc-doc-root{--brand:#c25a3a}</style><header class=\"hd-chrome-header\">", false],
  ["<div data-node=\"page\" class=\"bg-white\">", false],
  ["<section class=\"hero\"><h1>x</h1></section>", false],
];
for (const [html, want] of CASES) {
  if (isFullDocument(html) !== want) fails.push(`harness predicate got ${!want} for ${JSON.stringify(html.slice(0, 40))}`);
}

// 3. THE SHELL STYLESHEETS an AST page depends on are still linked, and still exist.
for (const p of SHELL_STYLESHEETS) {
  const base = p.split("/").pop();
  if (!shell.includes(base)) fails.push(`public/hubly.html no longer links ${base} — an AST page would render unstyled, and the harness would still be styling it`);
  try { readFileSync(join(ROOT, p), "utf8"); }
  catch { fails.push(`${p} is missing from the repo`); }
}

if (fails.length) {
  console.error("FAIL — the mount decision has drifted:");
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — public/hubly.html and scripts/lib/mount-as-product.mjs make the same mount decision, and the shell stylesheets are linked and present.");
process.exit(0);
