/**
 * Assertions for check-no-directives-to-owners.mjs.
 *
 * TWO NETS, AND THE FIRST IS THE ONE THAT LASTS.
 *
 * 1. STRUCTURAL. hubly_owner_replies.ts owns every string an owner reads verbatim FROM
 *    THE SERVER. This asserts that each producer feeding primaryReply is IMPORTED from
 *    that module rather than defined somewhere else. A future leak is then not a phrase we
 *    failed to predict — it is a string in the wrong file, which is decidable.
 *
 *    WHAT IT DOES NOT SEE: owner-facing copy composed CLIENT-side in public/hubly.html —
 *    the standalone name ask, the claim card, the talk-step questions. On 2026-09-12 an
 *    owner was asked one question twice, once by the model and once by the client, with
 *    this check green. The module's claim was narrowed to match this coverage rather than
 *    the coverage left implied; see OPEN_FINDINGS.md for what closing the gap would take.
 *
 * 2. THE PHRASE LIST. Kept because it costs nothing, and because it is what caught the
 *    three live leaks. It will never catch "be honest that…", "avoid claiming…", "make
 *    clear that…" — which is exactly why net 1 exists.
 */
const ROOT = "/Users/adriansmithee/Projects/Hubly";
const OWNER_MODULE = "hubly_owner_replies.ts";

const DIRECTIVE = [
  "say that plainly", "say so plainly", "do not say", "don't say", "do not claim",
  "never say", "never claim", "you must say", "read this back", "read it back",
  "say it back", "do not describe", "do not announce", "do not suggest",
  "do not reuse", "ask the owner", "do not ask", "never present", "do not use",
  "be honest that", "avoid claiming", "make clear that", "don't overstate",
  "tell them", "say the", "state that",
];
/** COMMENTS ARE NOT SENTENCES AN OWNER READS. Stripped before the phrase scan, because
 *  the scan pairs backticks naively: a closing backtick and the next opening one capture
 *  everything between them, comments included. On 2026-09-12 a comment EXPLAINING that a
 *  directive had been removed was reported as a directive — the check flagging the record
 *  of its own fix. Code only from here. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const hit = (s: string) => DIRECTIVE.find((d) => s.toLowerCase().includes(d)) || null;

/** THE PHRASE SCAN, as a function of source text — so it can be pointed at a fixture and
 *  proved to fail before it is pointed at the product (Lesson 40). */
function scanSentences(src: string): string[] {
  const out: string[] = [];
  for (const m of stripComments(src).matchAll(/`([^`]{20,500})`/g)) {
    const h = hit(m[1]);
    if (h) out.push(`${h} :: ${m[1].replace(/\s+/g, " ").slice(0, 120)}`);
  }
  return out;
}

// ── RED-PROOF, EVERY RUN (Lesson 40) ────────────────────────────────────────
// A check's first green is meaningless. This mutates a known-good sentence into a
// known-bad one and asserts the scan catches it — and asserts it does NOT fire on a
// comment that merely quotes a directive, which is the exact mis-tokenising that let a
// live leak through while this file reported 25 sentences where 21 were real.
{
  const CLEAN = "function f(){ return `Screen cleaning $60 is on your page now.`; }";
  const LEAK  = "function f(){ return `Screen cleaning $60 is not showing. Say that plainly.`; }";
  const QUOTED_IN_A_COMMENT = "// this used to say: say that plainly\nfunction f(){ return `Screen cleaning $60 is on your page now.`; }";
  const ok = scanSentences(CLEAN).length === 0
    && scanSentences(LEAK).length === 1
    && scanSentences(QUOTED_IN_A_COMMENT).length === 0;
  if (!ok) {
    console.error("CANNOT RUN — the phrase net failed its own fixtures:");
    console.error(`  clean sentence flagged   : ${scanSentences(CLEAN).length} (expected 0)`);
    console.error(`  directive caught         : ${scanSentences(LEAK).length} (expected 1)`);
    console.error(`  directive in a comment   : ${scanSentences(QUOTED_IN_A_COMMENT).length} (expected 0)`);
    Deno.exit(2);
  }
}

const fails: string[] = [];
const idx = await Deno.readTextFile(ROOT + "/supabase/functions/hubly-conversation/index.ts");
const reg = await Deno.readTextFile(ROOT + "/supabase/functions/_shared/hubly_capability_registry.ts");
let mod: string;
try { mod = await Deno.readTextFile(ROOT + "/supabase/functions/_shared/" + OWNER_MODULE); }
catch { console.error(`CANNOT RUN — ${OWNER_MODULE} is missing; the owner-reply channel has no owner.`); Deno.exit(2); }

// ── NET 1: STRUCTURAL ───────────────────────────────────────────────────────
// Find what primaryReply is built from, then require each producer to come from the
// owner module. This reads the shipping source, so moving the plumbing breaks the check
// loudly rather than silently passing.
const pr = /const\s+primaryReply\s*=\s*([^;]+);/.exec(idx);
if (!pr) { console.error("CANNOT RUN — primaryReply not found; the reply plumbing moved."); Deno.exit(2); }
const sources = pr[1].split("||").map((s) => s.trim()).filter((s) => s && !/^["'`]/.test(s));
const KNOWN_MODEL_CHANNEL = new Set(["deduped.reply", '""']);   // the model's own composed reply

/** STILL OUTSIDE THE MODULE, recorded 2026-09-09 rather than hidden. composeContactHoursTruth
 *  lives in the capability registry and was left there when the services composer moved:
 *  it is the older of the two, it has no known leak, and moving a second function out of
 *  a 7,000-line file at the end of a long session is how the last extraction over-reached
 *  and swallowed four unrelated functions.
 *
 *  It is NOT unguarded — the phrase net below scans its literals. This entry names the
 *  gap and fails if anything NEW joins it. */
const OUTSIDE_BY_RECORD = new Set(["contactHoursTruth"]);
let structural = 0;
for (const src of sources) {
  if (KNOWN_MODEL_CHANNEL.has(src)) continue;
  structural++;
  // What assigns it?
  const assign = new RegExp(`${src.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*=\\s*([^;\n]+)`, "g");
  const rhs = [...idx.matchAll(assign)].map((m) => m[1]).filter((r) => !/^\s*""\s*$/.test(r));
  if (!rhs.length) { fails.push(`primaryReply reads "${src}" and nothing assigns it — cannot verify its source`); continue; }
  // Follow ONE level of indirection: `servicesTruth = truth` where `truth =
  // composeServicesTruth(...)` a few lines up. Stopping at the first assignment reported
  // a false leak on a channel that is correctly owned.
  const resolved: string[] = [];
  for (const r of rhs) {
    resolved.push(r);
    const bare = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(r);
    if (!bare) continue;
    const inner = new RegExp(`(?:const|let|var)\\s+${bare[1]}\\s*=\\s*([^;\n]+)`).exec(idx);
    if (inner) resolved.push(inner[1]);
  }
  const ok = resolved.some((r) =>
    // produced by the owner module, directly or through a capability summary the module wrote
    new RegExp(`\\b(${[...mod.matchAll(/export function (\w+)/g)].map((m) => m[1]).join("|")})\\s*\\(`).test(r)
    || /\.summary\b/.test(r));
  if (!ok && !OUTSIDE_BY_RECORD.has(src)) {
    fails.push(`"${src}" is not produced by ${OWNER_MODULE} — it is assigned from: ${rhs[0].slice(0, 90)}`);
  }
}

// ── NET 2: THE PHRASE LIST, over the owner module's own sentences ───────────
const modCode = stripComments(mod);
const idxCode = stripComments(idx);
let checked = 0;
for (const m of modCode.matchAll(/`([^`]{20,500})`/g)) checked++;
for (const f of scanSentences(mod)) fails.push(`${OWNER_MODULE} would say "${f.split(" :: ")[0]}" to an owner\n      full: ${f.split(" :: ")[1]}`);
// …and over any composer still living outside it that feeds the channel.
for (const [fn, src] of [["composeServicesTruth", idxCode], ["composeContactHoursTruth", idxCode]] as [string, string][]) {
  const at = src.indexOf(`function ${fn}(`);
  if (at < 0) continue;
  let d = 0, end = -1; const open = src.indexOf("{", at);
  for (let i = open; i < src.length; i++) { if (src[i] === "{") d++; else if (src[i] === "}") { d--; if (d === 0) { end = i; break; } } }
  for (const m of src.slice(open, end).matchAll(/`([^`]{20,500})`/g)) {
    checked++;
    const h = hit(m[1]);
    if (h) fails.push(`${fn} would say "${h}" to an owner\n      full: ${m[1].replace(/\s+/g, " ").slice(0, 170)}`);
  }
}

console.log(`primaryReply sources checked structurally: ${structural} · owner sentences scanned: ${checked} · phrases watched: ${DIRECTIVE.length} · (detector red-proofed this run)`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log(`PASS — every SERVER-composed string reaching an owner is produced by ${OWNER_MODULE}, and none of them instructs a model. (Client-composed owner copy in public/ is outside this check.)`);
Deno.exit(0);
