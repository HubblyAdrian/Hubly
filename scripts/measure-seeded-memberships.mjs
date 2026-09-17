#!/usr/bin/env node
/**
 * HOW MANY BUSINESSES PUBLISH A MEMBERSHIP FACT THE OWNER NEVER SET?
 *
 *   supabase db query --linked -f scripts/sql/export-membership-offers.sql > offers.json
 *   HUBLY_MEMBERSHIP_OFFERS=offers.json node scripts/measure-seeded-memberships.mjs
 *
 * WHY. `defaultMembershipPlan` seeded a PRICE, a NAME, a DESCRIPTION and three INCLUDES from
 * `membershipDefaultsForTrade`, with `enabled:true`, and the website card rendered them with a Join
 * button under it. Driven on the served page 2026-09-16: a new plan produced $99/mo that nobody
 * stated. The write side is fixed; this measures what is ALREADY LIVE, because removing a price from
 * under a business that has since embraced it would be its own harm.
 *
 * THE SEED TABLE IS READ OUT OF public/hubly.html, NEVER TRANSCRIBED. The standing rule about
 * hand-maintained sets, and it is load-bearing here: my first pass searched for $99 and concluded
 * "no seeded price is live". The seed is PER TRADE — 99 detailing, 89 windows, 149 cleaning,
 * **119 landscaping**, 129 hvac, 99 pressure_washing — and adrians-lawn-service publishes exactly
 * 119. Searching for one trade's number is how a per-trade default hides in plain sight.
 *
 * PER FIELD, NOT PER PLAN. A plan is usually PART seeded: Graef set his prices ($60/$50) and the
 * includes on one plan, and left the seeded description on both and the seeded includes on the
 * other. "Is this plan seeded" has no honest answer; "is this FIELD his" does.
 *
 * WHAT WOULD MAKE THIS WRONG, before the numbers:
 *   · It reads `meta.website.membershipOffers`. A plan baked into a freeform page's HTML would not
 *     appear — neither business here has a freeform key in meta, so both render from meta, but a
 *     freeform business with a baked plan would be invisible to this.
 *   · Equality with a seed is EVIDENCE, not proof. An owner who types the exact seeded sentence has
 *     stated it; this counts him as seeded. The error runs toward over-reporting, which is the safe
 *     direction for a "we published something he didn't say" number.
 *   · A plan with `enabled:false` is not on the page. Counted separately, never folded in.
 *   · account_kind splits market from test. A test figure is about us, not about owners.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.HUBLY_MEMBERSHIP_OFFERS;
if (!SRC) { console.error("CANNOT RUN — set HUBLY_MEMBERSHIP_OFFERS to the export from scripts/sql/export-membership-offers.sql"); process.exit(2); }

/** THE SEED TABLE, PARSED OUT OF THE SHIPPING FILE. If the shape of
 *  `membershipDefaultsForTrade` changes, this fails loudly rather than comparing against a stale
 *  copy of it — a measurement against a transcribed constant is a measurement of last week. */
function seedTable() {
  const html = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
  const at = html.indexOf("function membershipDefaultsForTrade(");
  if (at < 0) return null;
  let i = html.indexOf("{", at), depth = 0, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;
  const body = html.slice(at, end);
  const out = {};
  // Each trade is `id:{ name:'…', price:N, description:'…', includes:['…','…'] }`, plus one
  // unnamed fallback object after `return table[id]||`.
  const re = /(\w+)\s*:\s*\{\s*name\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*price\s*:\s*(\d+)\s*,\s*description\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*includes\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body))) {
    out[m[1]] = { name: unq(m[2]), price: Number(m[3]), description: unq(m[4]),
                  includes: m[5].split(",").map((s) => unq(s.trim().replace(/^'|'$/g, ""))).filter(Boolean) };
  }
  const fb = /return\s+table\[id\]\s*\|\|\s*\{\s*name\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*price\s*:\s*(\d+)\s*,\s*description\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*includes\s*:\s*\[([^\]]*)\]/.exec(body);
  if (fb) out.__fallback = { name: unq(fb[1]), price: Number(fb[2]), description: unq(fb[3]),
                             includes: fb[4].split(",").map((s) => unq(s.trim().replace(/^'|'$/g, ""))).filter(Boolean) };
  return out;
}
const unq = (s) => String(s).replace(/\\'/g, "'").replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

const seeds = seedTable();
if (!seeds || Object.keys(seeds).length < 3) {
  console.error("CANNOT RUN — could not read membershipDefaultsForTrade out of public/hubly.html.");
  console.error("  That is a parse failure on our side, not an absence of seeded plans. Refusing to");
  console.error("  report 'nothing is seeded' off a reader that found nothing (the empty-reader rule).");
  process.exit(2);
}

const rows = JSON.parse(readFileSync(SRC, "utf8"));
const list = Array.isArray(rows) ? rows : (rows.rows || []);
if (!list.length) {
  console.error("CANNOT RUN — the export holds no plan rows. Re-export; a reused or empty export");
  console.error("  reports 'no seeded memberships' when it has told you about itself, not about them.");
  process.exit(2);
}

// Trades are normalised the way the client does: an unknown business_type takes the fallback seed.
const seedFor = (t) => seeds[String(t || "").trim().toLowerCase()] || seeds.__fallback || null;
const sameList = (a, b) => JSON.stringify((a || []).map(String)) === JSON.stringify((b || []).map(String));

const findings = [];
for (const r of list) {
  const seed = seedFor(r.business_type);
  const inc = Array.isArray(r.plan_includes) ? r.plan_includes : JSON.parse(r.plan_includes || "[]");
  const price = r.plan_price === null || r.plan_price === "" ? null : Number(r.plan_price);
  const enabled = String(r.plan_enabled) === "true";
  const f = {
    slug: r.slug, kind: r.account_kind, trade: r.business_type, plan: r.plan_name,
    index: r.plan_index, enabled, price,
    seedPrice: seed ? seed.price : null,
    priceSeeded: !!seed && price !== null && price === seed.price,
    nameSeeded: !!seed && String(r.plan_name || "") === seed.name,
    descSeeded: !!seed && String(r.plan_description || "") === seed.description,
    // A cadence variant ("…, bi-weekly." for "…, every month.") is still OUR sentence. Matching the
    // stem catches it; matching the whole string would miss it and under-report.
    descSeededStem: !!seed && !!r.plan_description &&
      String(r.plan_description).slice(0, Math.max(12, seed.description.indexOf(",") + 1)) === seed.description.slice(0, Math.max(12, seed.description.indexOf(",") + 1)),
    includesSeeded: !!seed && sameList(inc, seed.includes),
    includes: inc,
  };
  findings.push(f);
}

const pub = findings.filter((f) => f.enabled);
const line = (label, sel) => {
  const m = pub.filter((f) => f.kind === "market" && sel(f)).length;
  const t = pub.filter((f) => f.kind !== "market" && sel(f)).length;
  console.log(`  ${label.padEnd(46)} market ${String(m).padStart(3)}   other ${String(t).padStart(3)}`);
};

console.log(`\nSEEDED MEMBERSHIP FACTS ON LIVE PAGES — ${list.length} plan rows, ${pub.length} enabled\n`);
console.log("Seed table read from public/hubly.html: " +
  Object.entries(seeds).map(([k, v]) => `${k}=$${v.price}`).join(" · ") + "\n");
console.log("ENABLED PLANS ONLY (a disabled plan is not on the page):");
line("plans published at all", () => true);
line("PRICE equals the trade seed", (f) => f.priceSeeded);
line("NAME equals the trade seed", (f) => f.nameSeeded);
line("DESCRIPTION equals the trade seed exactly", (f) => f.descSeeded);
line("DESCRIPTION is the seed sentence (stem match)", (f) => f.descSeededStem);
line("ALL THREE INCLUDES equal the trade seed", (f) => f.includesSeeded);
line("every field seeded — name, price, desc, includes", (f) => f.nameSeeded && f.priceSeeded && f.descSeeded && f.includesSeeded);
line("nothing seeded — every field is his", (f) => !f.nameSeeded && !f.priceSeeded && !f.descSeededStem && !f.includesSeeded);

console.log("\nEVERY ROW, so nothing is hidden behind a total:\n");
for (const f of findings) {
  const tags = [
    f.enabled ? "LIVE" : "off",
    f.priceSeeded ? "price=SEED" : `price=$${f.price ?? "—"} (his)`,
    f.nameSeeded ? "name=SEED" : "name=his",
    f.descSeeded ? "desc=SEED" : f.descSeededStem ? "desc=SEED(variant)" : "desc=his",
    f.includesSeeded ? "includes=SEED" : "includes=his",
  ];
  console.log(`  ${f.slug.padEnd(24)} ${String(f.kind).padEnd(9)} ${String(f.trade).padEnd(12)} #${f.index} ${String(f.plan).padEnd(22)} ${tags.join(" · ")}`);
  console.log(`  ${"".padEnd(24)} includes: ${JSON.stringify(f.includes)}  seed price for ${f.trade}: $${f.seedPrice}`);
}
console.log("");
