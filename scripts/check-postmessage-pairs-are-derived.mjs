#!/usr/bin/env node
/**
 * [RULE] EVERY MESSAGE TYPE THE CANVAS SENDS IS HANDLED, AND EVERY TYPE HANDLED IS SENT.
 *
 *   node scripts/check-postmessage-pairs-are-derived.mjs
 *
 * ══ THE CLASS ════════════════════════════════════════════════════════════════════════════════
 *
 * A postMessage type is a HAND-MAINTAINED SET WITH ITS TWO HALVES IN TWO FILES, and its failure mode
 * is SILENT-DROPPED. Nobody 404s. Nothing throws. The owner clicks, the message goes out, and the
 * other file never looked for it.
 *
 * Measured 2026-09-18, on the live shells:
 *
 *   hcFreeformLinkEdit      SENT from a live "Link · Change where this goes" menu item since
 *                           2026-09-02, handled NOWHERE — not in the parent, not in the server
 *                           (there is no directFreeformLinkEdit key in supabase/functions at all).
 *                           16 days of an owner typing a URL into a prompt and nothing happening.
 *   hcFreeformSectionMove   SENT by hcMoveSection, which had ONE occurrence in the file — its own
 *                           definition. No caller, no handler.
 *   hcFreeformNodeMove      HANDLED, with a working writer, and sent by nothing. The same-day
 *                           counterpart of the above with an incompatible payload.
 *
 * Two half-built move features pointing in opposite directions, and one reachable dropped action.
 *
 * ══ BOTH HALVES DERIVED FROM THE SOURCE ══════════════════════════════════════════════════════
 *
 * There is no list of message types in this file. Senders are read out of the shells' postMessage
 * calls (direct and via their `post()` helpers); receivers out of every `.type === '…'` / `.type
 * !== '…'` comparison, which catches a LOCAL listener (`hcAuthStateAck` is compared with `!==`
 * inside hcTellPreviewAuthed, not in the main chain) as well as the big else-chain. A list in a
 * third file would be the same disease with an extra copy.
 *
 * SCOPED to types matching `hc` + a capital — our own naming convention. This listener also receives
 * from Stripe, from browser extensions and from any other frame on the page; `file.type === 'image/
 * png'` and `j.type === 'Job'` are `.type` comparisons too and are not messages. That scope is the
 * one judgement in this file, and it is stated rather than buried.
 *
 * ALSO SCOPED: this is a STATIC pairing check. It cannot see a payload guard rejecting a real
 * message at run time — a known type whose `&& typeof data.label === 'string'` fails still vanishes.
 * That case is covered at run time by the loud `else` at the end of the parent's listener, which is
 * the other half of this guard and is asserted by leg 4.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANVAS = "public/hubly.html";
const PARENT = "public/platform-home.html";
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const OURS = /^hc[A-Z]/;
/** Every type this file SENDS: postMessage({type:…}) and the local post({type:…}) helpers. */
function sentTypes(src) {
  const out = new Map();
  for (const m of src.matchAll(/\bpost(?:Message)?\s*\(\s*\{([^}]{0,160})/g)) {
    const t = /type\s*:\s*['"]([A-Za-z]+)['"]/.exec(m[1]);
    if (t && OURS.test(t[1])) {
      const line = src.slice(0, m.index).split("\n").length;
      if (!out.has(t[1])) out.set(t[1], []);
      out.get(t[1]).push(line);
    }
  }
  return out;
}
/** Every type this file RECEIVES: any `<expr>.type === '…'` or `!== '…'`, whatever the variable. */
function recvTypes(src) {
  const out = new Map();
  for (const m of src.matchAll(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.type\s*[!=]==\s*['"]([A-Za-z]+)['"]/g)) {
    if (!OURS.test(m[1])) continue;
    const line = src.slice(0, m.index).split("\n").length;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push(line);
  }
  return out;
}
/** A handler with no sender may declare itself, AT THE SITE. Same mechanism as
 *  PUBLIC-READER-OPTIONAL: an exemption list inside a checker goes stale silently. */
function pendingSenders(src) {
  return new Set([...src.matchAll(/CANVAS-SENDER-PENDING:\s*([A-Za-z]+)/g)].map((m) => m[1]));
}

const canvas = readFileSync(join(ROOT, CANVAS), "utf8");
const parent = readFileSync(join(ROOT, PARENT), "utf8");
const cSent = sentTypes(canvas), pRecv = recvTypes(parent);
const pSent = sentTypes(parent), cRecv = recvTypes(canvas);
const pending = pendingSenders(parent);

console.log(`  canvas -> parent   sends ${cSent.size}   parent compares ${pRecv.size}`);
console.log(`  parent -> canvas   sends ${pSent.size}   canvas compares ${cRecv.size}`);
console.log(`  handlers declaring CANVAS-SENDER-PENDING: ${pending.size ? [...pending].join(" ") : "none"}\n`);
if (!cSent.size || !pRecv.size) { console.error("CANNOT RUN — one side derived ZERO types; the extraction moved, and an empty set would pass every leg"); process.exit(2); }

/* ── LEG 1 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 every type the canvas sends is compared by the parent",
  why: "DELETE the parent's hcFreeformAddService branch. The canvas keeps sending it, nothing " +
       "matches, and the ONLY working add control in the product silently stops adding — the exact " +
       "shape hcFreeformLinkEdit shipped in for 16 days. Deleted rather than RENAMED: a rename is " +
       "the obvious break and it is too wide, because it removes one comparison and introduces " +
       "another, so it fires leg 2 as well and proves nothing about either (L98). This one changes " +
       "the sent-but-unhandled set and leaves the handled-but-unsent set untouched.",
  // A LITERAL. The ledger parses these declarations STATICALLY and cannot evaluate `PARENT` — the
  // first version used the constant and all four came back UNPARSEABLE. The runner said so and
  // exited non-zero rather than reporting "0 breaks applied" as a clean run.
  file: "public/platform-home.html",
  find: "    } else if(data.type === 'hcFreeformAddService' && typeof data.name === 'string' && data.name.trim()){\n      hcAddServiceFromCanvas(data);\n",
  with: "",
});
const dropped = [...cSent.keys()].filter((t) => !pRecv.has(t)).sort();
leg("RULE", "1 every type the canvas sends is compared by the parent",
  dropped.length === 0,
  dropped.length
    ? `SENT AND NEVER COMPARED — silently dropped: ` +
      dropped.map((t) => `${t} (${CANVAS}:${cSent.get(t).join(",")})`).join("; ")
    : `all ${cSent.size} type(s) the canvas sends are compared somewhere in the parent. Derived from ` +
      `postMessage calls on one side and every \`.type\` comparison on the other, so a LOCAL ` +
      `listener counts (hcAuthStateAck is compared with \`!==\` inside hcTellPreviewAuthed, not in ` +
      `the main chain) — a chain-only scan would have called that one a drop.`);

/* ── LEG 2 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 every type the parent compares is sent by the canvas, or declares itself pending",
  why: "remove the CANVAS-SENDER-PENDING marker from the hcFreeformNodeMove handler. It is a real " +
       "handler with a real writer and no sender; without the marker that fact is invisible, and " +
       "with a marker nobody can tell it from a handler whose sender was deleted by accident.",
  // A LITERAL. The ledger parses these declarations STATICALLY and cannot evaluate `PARENT` — the
  // first version used the constant and all four came back UNPARSEABLE. The runner said so and
  // exited non-zero rather than reporting "0 breaks applied" as a clean run.
  file: "public/platform-home.html",
  find: "    // CANVAS-SENDER-PENDING: hcFreeformNodeMove — this parent half is COMPLETE",
  with: "    // (marker removed)",
});
const orphanHandlers = [...pRecv.keys()].filter((t) => !cSent.has(t) && !pending.has(t)).sort();
leg("RULE", "2 every type the parent compares is sent by the canvas, or declares itself pending",
  orphanHandlers.length === 0,
  orphanHandlers.length
    ? `COMPARED AND NEVER SENT, with no CANVAS-SENDER-PENDING marker: ` +
      orphanHandlers.map((t) => `${t} (${PARENT}:${pRecv.get(t).join(",")})`).join("; ")
    : `every compared type has a sender, counting ${pending.size} that declare CANVAS-SENDER-PENDING ` +
      `at the site. The exemption lives at the handler, not in a list here, so deleting the handler ` +
      `deletes the exemption with it.`);

/* ── LEG 3 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 the reverse channel pairs too — parent to canvas",
  why: "rename the parent's hcAuthState send. The canvas never learns the owner is signed in, so " +
       "click-to-edit never ungates — which is the missing-handshake defect that closed on " +
       "2026-08-31, reintroduced from the other end.",
  // A LITERAL. The ledger parses these declarations STATICALLY and cannot evaluate `PARENT` — the
  // first version used the constant and all four came back UNPARSEABLE. The runner said so and
  // exited non-zero rather than reporting "0 breaks applied" as a clean run.
  file: "public/platform-home.html",
  find: "type:'hcAuthState'",
  with: "type:'hcAuthStatee'",
});
const revDropped = [...pSent.keys()].filter((t) => !cRecv.has(t)).sort();
leg("RULE", "3 the reverse channel pairs too — parent to canvas",
  revDropped.length === 0 && pSent.size > 0,
  pSent.size === 0 ? `the parent sends ZERO types — VACUOUS, not a pass`
    : revDropped.length ? `parent sends, canvas never compares: ` +
        revDropped.map((t) => `${t} (${PARENT}:${pSent.get(t).join(",")})`).join("; ")
    : `all ${pSent.size} type(s) the parent sends are compared in the canvas. Both directions are ` +
      `checked because a channel has two ends and only one of them was ever the one that bit us.`);

/* ── LEG 4 ─────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 an unhandled message is LOUD at run time, not a silent else",
  why: "put the listener's chain back to ending at a bare `}`. Every static pairing leg above still " +
       "passes — the types still match — while a KNOWN type whose payload guard rejects it goes back " +
       "to vanishing with no trace. That run-time case is the half a static check cannot see.",
  // A LITERAL. The ledger parses these declarations STATICALLY and cannot evaluate `PARENT` — the
  // first version used the constant and all four came back UNPARSEABLE. The runner said so and
  // exited non-zero rather than reporting "0 breaks applied" as a clean run.
  file: "public/platform-home.html",
  find: "    } else if(typeof data.type === 'string' && /^hc[A-Z]/.test(data.type)){",
  with: "    } else if(false){",
});
const hasLoudElse = /else if\(typeof data\.type === 'string' && \/\^hc\[A-Z\]\/\.test\(data\.type\)\)\{/.test(parent) &&
  /NOTHING HANDLED a message from the canvas/.test(parent);
leg("RULE", "4 an unhandled message is LOUD at run time, not a silent else",
  hasLoudElse,
  hasLoudElse
    ? `the parent's listener ends in a branch that console.errors the unmatched type. Scoped to ` +
      `\`hc\` + a capital, so Stripe and extension messages are not reported — and it fires for a ` +
      `KNOWN type whose payload guard rejected it, which is the case no static pairing can catch.`
    : `the listener has no loud fallback — an unmatched or rejected message vanishes`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
