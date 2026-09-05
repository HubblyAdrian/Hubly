#!/usr/bin/env node
/**
 * THE CLAIMED-OWNER WRITE CHECK.  `node scripts/check-owner-id-invariant.mjs`
 *
 * `create_business_document` authorises an UNCLAIMED draft by its token and a CLAIMED
 * business by `p_owner_id` (migration 20260822030000). A writer that omits `p_owner_id`
 * works perfectly until the owner signs up and then fails with `not_owner` forever —
 * silently, because every caller said "could not be saved", a sentence that fits every
 * cause equally. Eight call sites shipped in exactly that state (OPEN_FINDINGS #20).
 *
 * This exists because the count of that class was FIRST GOT WRONG BY EYE: "five
 * siblings" became eight the moment every payload was brace-matched instead of read off
 * a fixed window of lines. A number produced by grouping is a number nobody can check,
 * so the count lives here where anyone can re-run it.
 *
 * TWO CHECKS, because they catch different halves and neither catches the other's:
 *
 *  1. EVERY `create_business_document` PAYLOAD CARRIES `p_owner_id`.
 *     The object literal is brace-matched, not regex-windowed — a comment or a long
 *     payload must not be able to hide a missing key.
 *
 *  2. EVERY ACTION WHOSE HANDLER READS THE INJECTED OWNER IS ON THE INJECTION LIST.
 *     This is the half the runtime invariant structurally CANNOT see. `callBusinessRpc`
 *     throws when the `p_owner_id` key is absent — but a handler that reads an owner the
 *     engine never injects yields null, the key IS present, and the write is refused on
 *     a claimed business exactly as before. An accidental null and a deliberate
 *     pre-claim null are indistinguishable at the RPC. Only "this handler wants an
 *     owner" vs "the engine injects one for this action" can tell them apart.
 *     (hubly-conversation also runs this at boot; here it is checkable without deploying.)
 *
 *  3. NO ACCESS DECISION IS MADE FROM `context`.
 *     hubly-conversation reads the surface off the REQUEST BODY:
 *
 *         const context = body?.context === "customer" ? "customer"
 *                       : body?.context === "operate"  ? "operate" : "dashboard";
 *
 *     That string is whatever the caller sent. It shapes the prompt; it proves nothing.
 *     Anyone can POST `context: "dashboard"` from a public website's chat widget.
 *
 *     Today nothing leaks, because no capability returns operational data — every action
 *     either builds the page or reads free slots. The danger is the NEXT one: the first
 *     handler that returns a business's bookings and guards them with
 *     `if (context === "dashboard")` hands one business's customer list to whoever is
 *     chatting on its public site, and in review it reads exactly like a real check.
 *
 *     THE RULE: access is gated on `getOwnerUid()` (a user JWT, verified server-side
 *     against /auth/v1/user) AND on that uid owning THIS business
 *     (`biz.owner_id === ownerUid`). Never on `context`.
 *
 *     A hardcoded list of forbidden handlers would go stale the first time someone adds
 *     one — every hardcoded list in this codebase has silently dropped an entry. So this
 *     scans instead: no capability handler may read `context` in code at all, and in
 *     hubly-conversation `context` may never appear in an expression that also refuses
 *     access. Both are strict on purpose: `context` has no legitimate use in an
 *     authorisation decision, so "zero" is the only threshold that cannot rot.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REGISTRY = path.join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts");
const CONVERSATION = path.join(ROOT, "supabase/functions/hubly-conversation/index.ts");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** The object literal that starts at `from` (the index of its `{`), brace-matched. */
function objectAt(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(from, i + 1);
  }
  return null;
}

let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL  " + msg); };

/* ── CHECK 1 ─────────────────────────────────────────────────────────────────── */
let sites = 0;
for (const file of walk(path.join(ROOT, "supabase/functions"))) {
  const src = fs.readFileSync(file, "utf8");
  const re = /callBusinessRpc\(\s*"create_business_document"\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    sites++;
    const obj = objectAt(src, m.index + m[0].length - 1);
    const line = src.slice(0, m.index).split("\n").length;
    const where = `${path.relative(ROOT, file)}:${line}`;
    if (obj === null) { fail(`${where} — unbalanced payload literal, could not check`); continue; }
    if (!/(^|[\s{,])p_owner_id\s*:/.test(obj)) {
      fail(`${where} — create_business_document payload has no p_owner_id.\n` +
           `      Pass the verified owner uid, or pass \`p_owner_id: null\` explicitly and\n` +
           `      say in a comment why this path only ever runs before claim.`);
    }
  }
}
console.log(`create_business_document call sites checked : ${sites}`);
if (!sites) fail("no call sites found at all — this check has stopped checking anything");

/* ── CHECK 2 ─────────────────────────────────────────────────────────────────── */
const conv = fs.readFileSync(CONVERSATION, "utf8");
const setBlock = conv.match(/const DRAFT_INJECTED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/);
if (!setBlock) fail("could not find DRAFT_INJECTED_ACTIONS in hubly-conversation — the owner-injection check cannot run");
const injected = new Set([...(setBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]));

// Which actions read the injected owner? Located by walking the registry's capability
// blocks: `name: "<action>"` down to the next one, and asking whether that span calls
// the single typed reader. The reader exists precisely so this is one string to find.
const reg = fs.readFileSync(REGISTRY, "utf8");
const capNames = [...reg.matchAll(/^\s{4}name: "([a-z_]+)",$/gm)].map((m) => ({ name: m[1], at: m.index }));
const actionHits = [...reg.matchAll(/^\s{8}name: "([A-Za-z_]+)",$/gm)];
let readers = 0;
for (let i = 0; i < actionHits.length; i++) {
  const a = actionHits[i];
  const end = i + 1 < actionHits.length ? actionHits[i + 1].index : reg.length;
  const span = reg.slice(a.index, end);
  if (!/injectedOwnerUid\s*\(/.test(span)) continue;
  readers++;
  const cap = [...capNames].filter((c) => c.at < a.index).pop();
  const id = `${cap ? cap.name : "?"}.${a[1]}`;
  if (!injected.has(id)) {
    fail(`${id} reads the injected owner but is NOT in DRAFT_INJECTED_ACTIONS.\n` +
         `      It will always see null, so every write it makes is refused on a CLAIMED\n` +
         `      business — and the p_owner_id invariant cannot see it, because the key IS present.`);
  }
}
console.log(`actions reading the injected owner        : ${readers} (all on the injection list unless failed above)`);
if (!readers) fail("no action reads injectedOwnerUid — either the reader was renamed or this check has gone blind");

// ---------------------------------------------------------------------------
// CHECK 3 — no access decision is made from the caller-declared `context`.
// ---------------------------------------------------------------------------

/** Blank out comments and string/template literals so a mention in prose or in a
 *  description field is never mistaken for a read. Only CODE positions survive. */
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

const regCode = codeOnly(reg);
const ctxInHandlers = [...regCode.matchAll(/\bcontext\b/g)].map((m) => reg.slice(0, m.index).split("\n").length);
console.log(`capability handlers reading \`context\` in code : ${ctxInHandlers.length} (must be 0)`);
for (const ln of ctxInHandlers) {
  fail(`a capability handler reads \`context\` (registry line ~${ln}).\n` +
       `      \`context\` is whatever the CALLER sent — a public chat widget can send "dashboard".\n` +
       `      Gate on getOwnerUid() plus biz.owner_id === ownerUid instead. See OPEN_FINDINGS #27.`);
}

// In hubly-conversation, `context` must never share an expression with a refusal.
const convCode = codeOnly(conv);
const REFUSAL = /not_signed_in|not_owner|forbidden|unauthori[sz]ed|\b40[13]\b/;
let ctxGates = 0;
convCode.split("\n").forEach((line, idx) => {
  if (!/\bcontext\b/.test(line)) return;
  if (!REFUSAL.test(line)) return;
  ctxGates++;
  fail(`hubly-conversation:${idx + 1} decides a refusal using \`context\`:\n` +
       `      ${conv.split("\n")[idx].trim().slice(0, 96)}\n` +
       `      That is a caller-declared string, not an auth check. See OPEN_FINDINGS #27.`);
});
console.log(`refusals decided from \`context\`                : ${ctxGates} (must be 0)`);

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nOK — every create_business_document payload carries p_owner_id, every");
console.log("action that reads the injected owner is on the list that injects it, and no");
console.log("access decision anywhere is made from the caller-declared `context`.");
