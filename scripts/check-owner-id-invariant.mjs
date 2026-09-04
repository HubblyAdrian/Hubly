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

if (failures) { console.error(`\n${failures} failure(s).`); process.exit(1); }
console.log("\nOK — every create_business_document payload carries p_owner_id, and every");
console.log("action that reads the injected owner is on the list that injects it.");
