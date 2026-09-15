#!/usr/bin/env node
/**
 * "I COULDN'T LOOK" MAY NEVER BE SAID AS "IT ISN'T THERE".
 *
 *   node scripts/check-unreadiness-is-not-absence.mjs
 *
 * THE WALK, 2026-09-14. A paying-customer-shaped owner asked where he would add a service.
 * The canvas answered `found:false` because it looked before the frame was ready, and the
 * reply told him: *"There is no services area on your page yet."* His page renders six
 * `data-hubly-service` anchors and a "What we offer" section — measured on the live site,
 * read-only, the same day.
 *
 * The defect was not the selector. It was that NOT-FOUND WAS ONE VALUE. The canvas now
 * answers three ways — found · not_on_page · could_not_look — and only ONE of them may
 * become a claim about the owner's page.
 *
 * This is the record rule one dimension over: an ungrounded ABSENCE may not overwrite what
 * exists. There it was a service on the record; here it is a section on the page.
 *
 * Runs the composer rather than reading it (Lesson 83), and red-proofs on the case that bit
 * him: status could_not_look, and the sentence asserting absence.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let parent, canvas;
try {
  parent = readFileSync(resolve(ROOT, "public/platform-home.html"), "utf8");
  canvas = readFileSync(resolve(ROOT, "public/hubly.html"), "utf8");
} catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

function block(src, startRe, open, close) {
  const m = startRe.exec(src);
  if (!m) return null;
  const from = src.indexOf(open, m.index);
  if (from < 0) return null;
  let d = 0;
  for (let k = from; k < src.length; k++) {
    if (src[k] === open) d++;
    else if (src[k] === close) { d--; if (!d) return src.slice(m.index, k + 1); }
  }
  return null;
}

// ── 1. THE CANVAS HAS THREE ANSWERS ──────────────────────────────────────────────
const look = block(canvas, /function hcShowMeWhereOnCanvas\s*\(/, "{", "}");
if (!look) { console.error("CANNOT RUN — hcShowMeWhereOnCanvas not found in public/hubly.html"); process.exit(2); }
const statuses = ["found", "not_on_page", "could_not_look"].filter((s) => look.includes(`'${s}'`));
say("1 the canvas answers three ways", statuses.length === 3, statuses.join(" · "));
say("1b a readiness check runs before any absence is reported",
  /readyState/.test(look) && look.indexOf("readyState") < look.indexOf("querySelector"),
  "readiness is tested before the selector");

// ── 2. THE COMPOSER, RUN ─────────────────────────────────────────────────────────
const targets = block(parent, /var HC_SHOW_TARGETS\s*=\s*\{/, "{", "}");
const line = block(parent, /function hcShowMeWhereLine\s*\(/, "{", "}");
if (!targets || !line) { console.error("CANNOT RUN — HC_SHOW_TARGETS or hcShowMeWhereLine not found"); process.exit(2); }
let api;
try { api = new Function(`${targets};\n${line}\nreturn { HC_SHOW_TARGETS, hcShowMeWhereLine };`)(); }
catch (e) { console.error("CANNOT RUN — the composer would not execute: " + String(e.message).slice(0, 140)); process.exit(2); }

const ABSENCE = /\bno\b[^.]*\b(services?|area|section)\b|\bisn'?t (there|on)\b|\bnot on your page\b/i;
for (const key of Object.keys(api.HC_SHOW_TARGETS)) {
  const t = api.HC_SHOW_TARGETS[key];
  const found = api.hcShowMeWhereLine(t, "found");
  const missing = api.hcShowMeWhereLine(t, "not_on_page");
  const cantLook = api.hcShowMeWhereLine(t, "could_not_look");

  say(`2 ${key}: every status has a sentence`, !!found && !!missing && !!cantLook,
    `${[found, missing, cantLook].filter(Boolean).length}/3`);
  // THE ONE THAT BIT HIM.
  say(`2b ${key}: "could not look" never claims the page lacks anything`, !ABSENCE.test(cantLook),
    JSON.stringify(cantLook).slice(0, 110));
  say(`2c ${key}: the three sentences are all different`,
    new Set([found, missing, cantLook]).size === 3, "found ≠ not_on_page ≠ could_not_look");
  say(`2d ${key}: an unknown status falls back to "could not look", never to absence`,
    api.hcShowMeWhereLine(t, "anything_else") === cantLook, "unknown → could_not_look");
}

// ── 3. THE PARENT TRUSTS THE CANVAS'S WORD, AND DEFAULTS SAFE ────────────────────
const handler = block(parent, /window\.addEventListener\('message', function\(ev\)\{\s*\n\s*var d = ev && ev\.data;/, "{", "}");
say("3 an answer with no status is read as 'could not look', not as absence",
  !!handler && /could_not_look/.test(handler) && !/not_on_page/.test(String(handler).split("status =")[1] || ""),
  "the default is the safe one");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThree answers, three sentences, and only one of them is about his page.");
process.exit(failed ? 1 : 0);
