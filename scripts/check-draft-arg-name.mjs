#!/usr/bin/env node
/**
 * THE INJECTED-ARGUMENT-NAME CHECK.  `node scripts/check-draft-arg-name.mjs`
 *
 * The engine injects structural values into a capability's args because the model
 * must never be trusted to transcribe a UUID. It injects them under a NAME, and
 * that name differs by branch (hubly-conversation/index.ts, dispatch):
 *
 *   DRAFT_INJECTED_ACTIONS  ->  args.draftId, args.draftToken, args.ownerUid
 *   capability "booking"    ->  args.businessId, args.bookingChannel
 *   capability "storefront" ->  args.businessId, args._ownerToken
 *
 * A handler that reads the wrong one gets `undefined` — never an error. Its guard
 * fires on EVERY call, and the refusal it returns names a cause that has nothing to
 * do with what went wrong ("No business was specified", "there isn't a draft").
 * It looks like a missing feature, it reads like the owner's fault, and it survives
 * type-checking, review, and every other invariant in this repo.
 *
 * Three occurrences in four days:
 *   places.add        read args.businessId, injected draftId   (found + fixed 2026-09-07)
 *   operations.read   read args.businessId, injected draftId   (shipped 2026-09-05, live)
 *   website.setChrome read args.draftId with no schema entry    (found by the owner audit)
 *
 * ── TWO CHECKS, because the bug has two directions ────────────────────────────
 *  1. Every action on DRAFT_INJECTED_ACTIONS reads `args.draftId` and NEVER
 *     `args.businessId`. That is the shape all three occurrences took.
 *  2. Every action of a capability on the businessId-injection branch reads
 *     `args.businessId` and NEVER `args.draftId`. The same bug pointed the other
 *     way. Without this half the checker would "prove" a booking handler broken
 *     for reading exactly the name its branch supplies.
 *
 * Plus a blindness guard: every id in DRAFT_INJECTED_ACTIONS must resolve to a real
 * action in the registry. A typo there is a silent no-op — the action is never
 * injected and nothing says so.
 *
 * ── HOW THIS PARSES, AND WHY NOT BY INDENT ───────────────────────────────────
 * `storefront` is added by HUBLY_CAPABILITY_REGISTRY.push({ … }) after the array
 * literal closes, at a different indent, and an indent-anchored regex was blind to
 * it (see check-capability-reachable.mjs). So capabilities and actions are found
 * STRUCTURALLY: an object literal whose own top-level keys include `name` + `actions`
 * is a capability; one whose own keys include `name` + `handler` is an action.
 *
 * ── WHERE THIS CHECK STOPS ───────────────────────────────────────────────────
 *  - It reads the handler's own object literal. A handler that forwards args into a
 *    helper which then reads the wrong name is invisible here.
 *  - It proves a handler reads the name its branch INJECTS. It cannot prove the
 *    value is correct, or that the branch fired.
 *  - Comments and string literals are blanked before matching, so `businessId` in an
 *    argsSchema property name or in prose is never mistaken for a read.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");
const CONVERSATION = path.join(ROOT, "supabase/functions/hubly-conversation/index.ts");

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL  " + m); };

/** Blank comments and string/template literals, preserving offsets and newlines, so
 *  only CODE positions survive. Offsets stay aligned with the original source. */
function codeOnly(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const k = j < 0 ? src.length : j; out += " ".repeat(k - i); i = k; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      const k = Math.min(j + 1, src.length);
      out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Blank COMMENTS only, preserving string literals and offsets. Used where the data
 *  we want IS a string (the ids in DRAFT_INJECTED_ACTIONS) but a comment beside it
 *  must not be read as one — that block quotes owner-facing sentences in prose, and
 *  this checker's first run read one of them as an action id. */
function blankComments(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const k = j < 0 ? src.length : j; out += " ".repeat(k - i); i = k; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); const k = j < 0 ? src.length : j + 2; out += src.slice(i, k).replace(/[^\n]/g, " "); i = k; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      const k = Math.min(j + 1, src.length);
      out += src.slice(i, k); i = k; continue;      // string kept verbatim
    }
    out += c; i++;
  }
  return out;
}

/** The object literal containing index i: walk back to its `{`, brace-match forward. */
function enclosingObject(src, i) {
  let depth = 0, start = -1;
  for (let j = i; j >= 0; j--) {
    const c = src[j];
    if (c === "}") depth++;
    else if (c === "{") { if (depth === 0) { start = j; break; } depth--; }
  }
  if (start < 0) return null;
  let d = 0;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return { start, end: j }; }
  }
  return null;
}

/** Keys at depth 1 of an object literal body — its OWN keys, not a nested object's. */
function ownKeys(body) {
  const keys = [];
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") d--;
    else if (d === 1) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(j, j + 40));
      if (m && (j === 0 || /[\s{,]/.test(body[j - 1]))) keys.push(m[1]);
    }
  }
  return keys;
}

const regRaw = fs.readFileSync(REGISTRY, "utf8");
// Match against code positions only; brace-match against the same blanked text so a
// `{` inside a comment or a string can never move the structure.
const reg = codeOnly(regRaw);
const lineAt = (i) => regRaw.slice(0, i).split("\n").length;

/* ── Structural pass: capabilities, then actions, then which capability owns each ── */
const caps = [];       // { name, start, end }
const actions = [];    // { name, start, end, body }
// Names are matched in the RAW source (the value survives there), but every
// structural decision is made against the blanked text at the SAME offsets — so a
// `{` inside a comment or a string can never move the structure, and a `name:` that
// only exists inside prose is rejected because its own offset was blanked.
for (const m of regRaw.matchAll(/\bname:\s*"([A-Za-z_][\w]*)"/g)) {
  if (reg[m.index] !== "n") continue;   // blanked => this `name:` is comment or string
  const o = enclosingObject(reg, m.index);
  if (!o) continue;
  const body = reg.slice(o.start, o.end + 1);
  const keys = ownKeys(body);
  if (!keys.includes("name")) continue;
  if (keys.includes("actions")) {
    if (!caps.some((c) => c.start === o.start)) caps.push({ name: m[1], start: o.start, end: o.end });
  } else if (keys.includes("handler")) {
    if (!actions.some((a) => a.start === o.start)) actions.push({ name: m[1], start: o.start, end: o.end, body });
  }
}
for (const a of actions) {
  // The innermost capability whose range contains this action.
  const owner = caps.filter((c) => c.start < a.start && c.end > a.end).sort((x, y) => y.start - x.start)[0];
  a.cap = owner ? owner.name : "?";
  a.id = `${a.cap}.${a.name}`;
}

console.log(`capabilities parsed : ${caps.length}  (${caps.map((c) => c.name).join(", ")})`);
console.log(`actions parsed      : ${actions.length}`);
if (!caps.length || !actions.length) {
  fail("parsed ZERO capabilities or actions — this check has stopped checking anything");
  console.error(`\n${failures} failure(s).`); process.exit(1);
}

/* ── Which args does a handler actually read? ──────────────────────────────────
   Casts are normalised away first so `(args as Record<string, unknown>)?.businessId`
   and `args?.businessId` are the same read. Destructuring counts too. */
function readsArg(body, key) {
  const flat = body.replace(/\(\s*args\s+as\s+[^)]*\)/g, "args");
  if (new RegExp(`\\bargs\\s*\\??\\s*\\.\\s*${key}\\b`).test(flat)) return true;
  const de = new RegExp(`\\{[^}]*\\b${key}\\b[^}]*\\}\\s*=\\s*\\(?\\s*args\\b`);
  return de.test(flat);
}

const conv = fs.readFileSync(CONVERSATION, "utf8");
// Comments blanked, strings kept: the ids ARE strings, and the block around them is
// dense prose that quotes owner-facing sentences.
const convNC = blankComments(conv);
const setBlock = convNC.match(/const DRAFT_INJECTED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/);
if (!setBlock) {
  fail("could not find DRAFT_INJECTED_ACTIONS in hubly-conversation — this check cannot run");
  console.error(`\n${failures} failure(s).`); process.exit(1);
}
const injected = [...setBlock[1].matchAll(/"([^"\n]+)"/g)].map((x) => x[1]);

// Which capabilities take businessId on the OTHER injection branch. Read from the
// source rather than hardcoded, so a third branch added tomorrow is covered.
const bizCaps = [...convNC.matchAll(/capabilityName === "([a-z_]+)" && businessId\)/g)].map((m) => m[1]);

console.log(`DRAFT_INJECTED_ACTIONS entries : ${injected.length}`);
console.log(`businessId-injected capabilities : ${bizCaps.length ? bizCaps.join(", ") : "(none found — check has gone blind)"}`);
if (!bizCaps.length) fail("found no businessId injection branch — the second half of this check cannot run");

/* ── CHECK 0 — every listed id resolves to a real action ── */
const byId = new Map(actions.map((a) => [a.id, a]));
for (const id of injected) {
  if (!byId.has(id)) {
    fail(`DRAFT_INJECTED_ACTIONS lists "${id}", which is NOT an action in the registry.\n` +
         `      The entry does nothing: no action by that name is ever injected, and\n` +
         `      nothing reports it. Fix the name or remove it.`);
  }
}

/* ── CHECK 1 — draft-injected actions read draftId, never businessId ── */
let checked1 = 0;
for (const id of injected) {
  const a = byId.get(id);
  if (!a) continue;
  checked1++;
  if (readsArg(a.body, "businessId")) {
    fail(`${id} (registry line ${lineAt(a.start)}) reads args.businessId, but it is on\n` +
         `      DRAFT_INJECTED_ACTIONS — the engine injects draftId/draftToken/ownerUid and\n` +
         `      NEVER businessId. The read yields undefined on every call, so the handler's\n` +
         `      guard fires every time and refuses with a reason that is not the real one.\n` +
         `      Read args.draftId, as the other injected handlers do.`);
  } else if (!readsArg(a.body, "draftId")) {
    fail(`${id} (registry line ${lineAt(a.start)}) is on DRAFT_INJECTED_ACTIONS but never\n` +
         `      reads args.draftId. Either it does not need the injection (remove it from\n` +
         `      the set) or it is reading the value under some other name.`);
  }
}
console.log(`draft-injected actions checked : ${checked1}`);

/* ── CHECK 2 — businessId-injected capabilities read businessId, never draftId ── */
let checked2 = 0, viol2 = 0;
for (const a of actions) {
  if (!bizCaps.includes(a.cap)) continue;
  if (injected.includes(a.id)) {
    fail(`${a.id} is on DRAFT_INJECTED_ACTIONS AND on the "${a.cap}" businessId branch.\n` +
         `      Both fire, and which name wins is an ordering accident. Pick one branch.`);
    continue;
  }
  checked2++;
  if (readsArg(a.body, "draftId")) {
    viol2++;
    fail(`${a.id} (registry line ${lineAt(a.start)}) reads args.draftId, but "${a.cap}" is\n` +
         `      injected with businessId, not draftId. Same bug as check 1, pointed the\n` +
         `      other way: the read yields undefined and the guard fires on every call.`);
  }
}
console.log(`businessId-injected actions checked : ${checked2}  (reading the wrong name: ${viol2}, must be 0)`);

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nPASS — every injected action reads the argument name its branch supplies.");
