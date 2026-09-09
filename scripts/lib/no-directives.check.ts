/**
 * Assertions for check-no-directives-to-owners.mjs.
 *
 * TESTS THE COMPOSED OUTPUT. The strings below are read out of the shipping source and
 * evaluated as the owner would receive them — not matched as templates. Where a function
 * cannot be safely evaluated in isolation, its literal branches are read instead, and
 * that limit is stated rather than papered over.
 */
const ROOT = "/Users/adriansmithee/Projects/Hubly";

const DIRECTIVE = [
  "say that plainly", "say so plainly", "do not say", "don't say", "do not claim",
  "never say", "never claim", "you must say", "read this back", "read it back",
  "say it back", "do not describe", "do not announce", "do not suggest",
  "do not reuse", "ask the owner", "do not ask", "never present", "do not use",
];
const hit = (s: string) => DIRECTIVE.find((d) => s.toLowerCase().includes(d)) || null;

const fails: string[] = [];

/** Every template literal inside a named function's body, as shipped. */
function literalsIn(src: string, fnStart: number): string[] {
  let depth = 0, end = -1;
  const open = src.indexOf("{", fnStart);
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return [];
  const body = src.slice(open, end);
  return [...body.matchAll(/`([^`]{25,600})`/g)].map((m) => m[1]);
}

const idx = await Deno.readTextFile(ROOT + "/supabase/functions/hubly-conversation/index.ts");
const reg = await Deno.readTextFile(ROOT + "/supabase/functions/_shared/hubly_capability_registry.ts");

// THE VERBATIM REPLY CHANNEL. hubly-conversation builds
//   primaryReply = photoTruth || servicesTruth || contactHoursTruth || ...
// so every string these produce is read by an owner, word for word.
const CHANNELS: [string, string, string][] = [
  ["composeServicesTruth", idx, "servicesTruth -> primaryReply"],
  ["uploadDraftPhoto", reg, "photoTruth -> primaryReply"],
  ["composeContactHoursTruth", idx, "contactHoursTruth -> primaryReply"],
];
let checked = 0;
for (const [fn, src, why] of CHANNELS) {
  const at = src.indexOf(`function ${fn}(`);
  if (at < 0) continue;
  for (const lit of literalsIn(src, at)) {
    checked++;
    const h = hit(lit);
    if (h) fails.push(`${fn} (${why}) would say "${h}" to an owner\n      full: ${lit.replace(/\s+/g, " ").slice(0, 190)}`);
  }
}
if (!checked) { console.error("CANNOT RUN — no channel functions found; the reply plumbing moved"); Deno.exit(2); }

console.log(`owner-facing strings checked: ${checked} · directive phrases watched: ${DIRECTIVE.length}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length} directive(s) would reach an owner:`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log("PASS — no model directive appears in a string an owner reads verbatim.");
Deno.exit(0);
