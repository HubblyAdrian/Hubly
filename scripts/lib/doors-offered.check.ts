/**
 * A REPLY MAY ONLY OFFER A DOOR THAT EXISTS FOR THAT CAPABILITY, RIGHT NOW.
 *
 * Measured 2026-09-14 (`docs/CAPABILITY_DOORS.md`): of 212 capabilities, **none** had all three
 * doors and "I can show you where" existed for nothing at all. One capability has three today
 * (services). Hours has one that Hubly can speak — talk to me — because the do-it-yourself door
 * cannot be described in words (Hubly never names a control it cannot see) and the show door
 * has nowhere to point until the hours anchor is stamped at generation.
 *
 * So the count has to be non-lying AT THE POINT OF SPEECH, not only in a document. A sentence
 * that says "I can show you where your hours go" is a promise about a mechanism, and the
 * registry is the record of whether that mechanism exists. If only the talk door exists, the
 * sentence offers one way, not three.
 *
 * HOW A SENTENCE IS ATTRIBUTED TO A CAPABILITY: by the fact it is about. A sentence mentioning
 * hours is about `business.setHours`; one mentioning services or prices is about
 * `business.setServices`. That is deliberately a small, closed map — it is better to check the
 * two facts we actually compose sentences about than to guess at attribution for all 212 and
 * report a number nobody can trust.
 *
 * WHAT IT CANNOT SEE, stated rather than implied:
 *   · the MODEL's own reply, composed at run time. That is the system prompt's job, and the
 *     capability descriptions now carry the instruction (showMeWhere: "do not describe the
 *     control"). No source scan reaches a sentence that does not exist yet.
 *   · client copy outside the named blocks below. public/platform-home.html is 55,000 lines of
 *     product strings, UI chrome and developer text in one file; the blocks that compose OFFERS
 *     are named here, and the rest is out of scope for the same reason no-directives narrowed
 *     its own claim.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { HUBLY_CAPABILITY_REGISTRY as REGISTRY } from "../../supabase/functions/_shared/hubly_capability_registry.ts";
import { stringLiterals } from "./js-string-literals.ts";

const ROOT = "/Users/adriansmithee/Projects/Hubly";

/** fact -> the capability whose doors govern what may be offered about it. */
const TOPIC: { re: RegExp; capability: string; label: string }[] = [
  { re: /\bhours?\b|\bopening times?\b/i, capability: "business.setHours", label: "hours" },
  { re: /\bservices?\b|\bprices?\b|\bpricing\b/i, capability: "business.setServices", label: "services" },
];

/** A phrase that OFFERS a door. Each is a promise about a mechanism existing. */
const OFFERS: { door: "show" | "diy"; re: RegExp; what: string }[] = [
  { door: "show", what: "show you where", re: /\bshow (you|them) where\b|\btake (you|them) (there|to it)\b|\bpoint (you|them) (at|to) it\b|\bwalk (you|them) (to|through) it\b|\bjump (you|them) (to|there)\b/i },
  { door: "diy", what: "do it yourself", re: /\byourself\b|\byour own\b|\byou can (add|change|set|edit|update)\b/i },
];

function doorsFor(id: string): { talk: unknown; diy: unknown; show: unknown } | null {
  for (const cap of REGISTRY) {
    for (const a of cap.actions || []) {
      if (`${cap.name}.${a.name}` === id) return ((a as { doors?: never }).doors ?? null) as never;
    }
  }
  return null;
}

/** A named declaration's source text, brace/bracket matched. */
function blockOf(src: string, startRe: RegExp, open: string, close: string): string {
  const m = startRe.exec(src);
  if (!m) return "";
  const from = src.indexOf(open, m.index);
  if (from < 0) return "";
  let d = 0;
  for (let k = from; k < src.length; k++) {
    if (src[k] === open) d++;
    else if (src[k] === close) { d--; if (!d) return src.slice(m.index, k + 1); }
  }
  return "";
}

const fails: string[] = [];
const sources: { where: string; text: string }[] = [];

// 1. THE SERVER'S OWN SENTENCES — every literal in the owner-reply module.
const ownerModule = await Deno.readTextFile(`${ROOT}/supabase/functions/_shared/hubly_owner_replies.ts`);
for (const lit of stringLiterals(ownerModule)) {
  if (lit.trim().length >= 20) sources.push({ where: "hubly_owner_replies.ts", text: lit });
}

// 2. THE CLIENT BLOCKS THAT COMPOSE OFFERS, by name. Adding an offer composer means adding it
//    here — the same discipline as check-destructive-confirm's action list, and stated in the
//    header rather than left as an implied claim of full coverage.
const client = await Deno.readTextFile(`${ROOT}/public/platform-home.html`);
const CLIENT_BLOCKS: [string, RegExp, string, string][] = [
  ["HC_GAP_ASKS", /var HC_GAP_ASKS\s*=\s*\[/, "[", "]"],
  ["HC_GAP_DONE", /var HC_GAP_DONE\s*=\s*\{/, "{", "}"],
  ["hcChainLine", /function hcChainLine\s*\(/, "{", "}"],
  ["hcRenderArrival", /function hcRenderArrival\s*\(/, "{", "}"],
  ["HC_SHOW_TARGETS", /var HC_SHOW_TARGETS\s*=\s*\{/, "{", "}"],
];
let blocksFound = 0;
for (const [name, re, open, close] of CLIENT_BLOCKS) {
  const body = blockOf(client, re, open, close);
  if (!body) { fails.push(`the client block ${name} was not found — it was renamed or removed, and this check has gone blind to it`); continue; }
  blocksFound++;
  for (const lit of stringLiterals(body)) {
    if (lit.trim().length >= 20) sources.push({ where: `platform-home.html:${name}`, text: lit });
  }
}

let offers = 0;
for (const { where, text } of sources) {
  for (const topic of TOPIC) {
    if (!topic.re.test(text)) continue;
    for (const offer of OFFERS) {
      if (!offer.re.test(text)) continue;
      offers++;
      const doors = doorsFor(topic.capability);
      if (!doors) {
        fails.push(`${where} offers "${offer.what}" for ${topic.label}, and ${topic.capability} declares NO doors.\n      Declare them before offering one: an offer is a promise about a mechanism.\n      "${text.replace(/\s+/g, " ").slice(0, 120)}"`);
        continue;
      }
      if (!doors[offer.door]) {
        fails.push(`${where} offers the "${offer.what}" door for ${topic.label}, and ${topic.capability} does not have it (doors.${offer.door} is null).\n      "${text.replace(/\s+/g, " ").slice(0, 120)}"`);
      }
    }
  }
}

console.log(`sentences scanned: ${sources.length}  (owner module + ${blocksFound}/${CLIENT_BLOCKS.length} named client blocks)`);
console.log(`door offers found: ${offers}  ·  topics watched: ${TOPIC.map((t) => t.label).join(", ")}`);
for (const t of TOPIC) {
  const d = doorsFor(t.capability);
  console.log(`  ${t.label.padEnd(9)} ${t.capability.padEnd(22)} talk:${d && d.talk ? "yes" : "no "} diy:${d && d.diy ? "yes" : "no "} show:${d && d.show ? "yes" : "no "}`);
}
if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log(`\nPASS — no composed sentence offers a door the registry does not record as present.`);
Deno.exit(0);
