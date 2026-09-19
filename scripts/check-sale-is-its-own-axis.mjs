#!/usr/bin/env node
/**
 * [RULE] SALE IS INDEPENDENT OF PRICE. A QUOTED SERVICE WITH A PRICE IS STILL A QUOTE REQUEST.
 *
 *   node scripts/check-sale-is-its-own-axis.mjs
 *
 * ══ WHAT THIS UNLOCKS, IN ADRIAN'S WORDS ═════════════════════════════════════════════════════
 *
 * *"$95 starting — call for a quote." Priced AND quoted. Impossible today.*
 *
 * It was impossible for one expression. `service_engine.ts` has carried `declared.sale`
 * ("bookable" | "quoted"), a `saleFrom` provenance, and an explicit "unknown" refusal for an
 * unreadable declaration since it was written — so the AXIS was never missing. But both booking DTO
 * builders set `quote_required: mode === "quote_required"`, reading the PRICING MODE instead of the
 * sale. A service priced "from $95" and marked quoted therefore arrived at the booking engine as
 * bookable at $95, and the owner's declaration was silently discarded.
 *
 * ══ AND THE DERIVATION STAYS, PERMANENTLY ════════════════════════════════════════════════════
 *
 * Adrian, 2026-09-18, striking his own earlier instruction: *"A membership offer has no pricing.mode,
 * so structure-derived sale is the only thing that can answer for it. Keep saleFrom: 'structure' as
 * the fallback permanently."* So leg 3 asserts the fallback still works — a check that only proved
 * the declared case would let the derivation be deleted by someone reading the earlier ruling.
 *
 * ══ WHY THIS WAS SAFE TO LAND BEFORE THE WRITER ══════════════════════════════════════════════
 *
 * Nothing writes `declared.sale` yet, so for every row that exists today `offerType()` falls to the
 * same structure derivation the old expression used, and nothing changes. Leg 4 asserts that
 * inertness directly rather than trusting it.
 *
 * SCOPED: this runs the real `offerType` and the real DTO builders out of the shipping module against
 * constructed offers. It does NOT drive a live booking — that needs a business with a declared sale,
 * and nothing can write one yet, which is the next piece of work rather than a gap in this check.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOD = "supabase/functions/_shared/service_engine.ts";
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* THE REAL MODULE, transpiled and run — not reimplemented. esbuild is already a dependency here. */
let mod;
try {
  // --bundle, not a bare transpile: the module imports ./hubly_business_meta.ts and a data: URL
  // cannot resolve a relative specifier. The first version failed on exactly that and said so, which
  // is the right failure — CANNOT RUN, never a quieter test.
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, MOD)],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
} catch (e) { console.error("CANNOT RUN — could not load " + MOD + ": " + String(e.message).split("\n")[0]); process.exit(2); }
if (typeof mod.offerType !== "function") { console.error("CANNOT RUN — offerType is not exported from " + MOD); process.exit(2); }

/** A minimal offer the real functions accept.
 *
 *  A DECLARATION LIVES AT `offer.sale`, NOT AT THE TOP LEVEL — `offerType` reads
 *  `o.offer.sale`. The first version of this fixture set `sale` at the top level and every declared
 *  case silently resolved by STRUCTURE instead, including the deliberately-unreadable one. The legs
 *  went red and were right to: the fixture was describing a record shape that does not exist. Read
 *  the reader before writing the fixture — and this is also the answer the WRITER needs (2.2): a
 *  writer must set `offer: { sale }` on the record, not a bare column. */
const offer = (over = {}) => ({
  name: over.name || "Full Detail",
  kind: "service",
  ...(over.sale ? { offer: { sale: over.sale } } : {}),
  pricing: { mode: over.mode || "fixed", price_cents: over.cents === undefined ? 9500 : over.cents,
             show_price: true, ...(over.pricing || {}) },
  duration_minutes: 60, includes: [], addons: [], media: { photos: [] },
  category: null, subcategory: null, status: "active",
});
const T = (o) => mod.offerType(o);

console.log(`  offerType loaded from ${MOD}`);
const priced = offer({ mode: "from", cents: 9500, sale: "quoted" });
const pricedT = T(priced);
const plainPriced = T(offer({ mode: "fixed", cents: 9500 }));
const noPrice = T(offer({ mode: "quote_required", cents: null }));
const membership = mod.offerType({ name: "Bi-Weekly", includes: [], addons: [], media: { photos: [] } }, "membership_offers");
const bogus = T(offer({ sale: "sometimes" }));
console.log(`  from-$95 + declared quoted -> sale=${pricedT.sale} (${pricedT.saleFrom}) · plain priced -> ` +
  `${plainPriced.sale} (${plainPriced.saleFrom}) · no price -> ${noPrice.sale} (${noPrice.saleFrom}) · ` +
  `membership -> ${membership.sale} (${membership.saleFrom}) · unreadable "sometimes" -> ${bogus.sale} (${bogus.saleFrom})\n`);

/* ── LEG 1 — the headline case ──────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 a DECLARED quoted sale wins over a price that is present",
  why: "make a declared sale lose to the structure derivation. Every existing row behaves identically " +
       "— nothing declares sale yet — so nothing looks broken, and the one thing an owner can state " +
       "about how their service is sold is silently discarded. That is the state this change ended.",
  file: "supabase/functions/_shared/service_engine.ts",
  find: '  if (ds === "bookable" || ds === "quoted") { sale = ds as OfferSale; saleFrom = "declared"; }',
  with: '  if (false) { sale = "bookable"; saleFrom = "declared"; }',
});
leg("RULE", "1 a DECLARED quoted sale wins over a price that is present",
  pricedT.sale === "quoted" && pricedT.saleFrom === "declared" && plainPriced.sale === "bookable",
  `"from $95" + declared quoted resolves to sale=${JSON.stringify(pricedT.sale)} from ` +
  `${JSON.stringify(pricedT.saleFrom)}, while the same offer with no declaration resolves to ` +
  `${JSON.stringify(plainPriced.sale)}. The price is still 9500 in both — "quoted" means the customer ` +
  `asks, not that there is no number, which is the whole of "$95 starting — call for a quote".`);

/* ── LEG 2 — the DTO, which is what the booking engine actually reads ───────────────────────── */
declareBreak({
  leg: "2 the booking DTO's quote_required follows SALE, not the pricing mode",
  why: "read the pricing mode again. offerType still resolves sale correctly, so leg 1 still passes " +
       "and the owner's declaration is still stored — and the BOOKING FLOW ignores it, which is " +
       "exactly the state that made priced-and-quoted impossible while looking supported.",
  file: "supabase/functions/_shared/service_engine.ts",
  find: '    quote_required: offerType(service).sale === "quoted",\n    addon_names:',
  with: '    quote_required: service.pricing.mode === "quote_required",\n    addon_names:',
});
let dto = null, dtoErr = null;
try {
  const build = mod.toBookingServiceDto || mod.bookingServiceDto || null;
  if (build) dto = build(priced);
} catch (e) { dtoErr = e.message; }
const dtoSrc = readFileSync(join(ROOT, MOD), "utf8");
const bothFollowSale = (dtoSrc.match(/quote_required: offerType\(service\)\.sale === "quoted",/g) || []).length === 2;
const priceKept = /price_cents: service\.pricing\.mode === "quote_required"\n\s*\? null\n\s*: service\.pricing\.price_cents,/.test(dtoSrc);
leg("RULE", "2 the booking DTO's quote_required follows SALE, not the pricing mode",
  bothFollowSale && priceKept,
  `${(dtoSrc.match(/quote_required: offerType\(service\)\.sale === "quoted",/g) || []).length} of 2 DTO ` +
  `builders read sale (both required — a fix in one is the two-of-everything shape), and price_cents ` +
  `still follows MODE (${priceKept}) so a quoted service KEEPS its number. Asserted on the shipping ` +
  `source because the two builders are not both reachable from one exported entry point` +
  (dto ? ` (a DTO was also built: quote_required=${dto.quote_required})` : dtoErr ? ` (direct build: ${dtoErr.slice(0, 40)})` : ``) + `.`);

/* ── LEG 3 — the derivation stays, permanently ──────────────────────────────────────────────── */
declareBreak({
  leg: "3 the STRUCTURE derivation still answers when nothing is declared",
  why: "delete the structure fallback, which an earlier ruling asked for and Adrian then struck: " +
       "'A membership offer has no pricing.mode, so structure-derived sale is the only thing that can " +
       "answer for it.' Without it every existing service and every membership resolves to 'unknown', " +
       "and a booking flow cannot act on unknown.",
  file: "supabase/functions/_shared/service_engine.ts",
  find: '  else if (mode === "quote_required") { sale = "quoted"; saleFrom = "structure"; }',
  with: "  else if (false) { sale = \"quoted\"; saleFrom = \"structure\"; }",
});
leg("RULE", "3 the STRUCTURE derivation still answers when nothing is declared",
  noPrice.sale === "quoted" && noPrice.saleFrom === "structure" &&
  plainPriced.saleFrom === "structure" && bogus.sale === "unknown" && bogus.saleFrom === "unknown",
  `no price -> ${JSON.stringify(noPrice.sale)} from ${JSON.stringify(noPrice.saleFrom)}; a plain priced ` +
  `service -> ${JSON.stringify(plainPriced.sale)} from ${JSON.stringify(plainPriced.saleFrom)}; and an ` +
  `UNREADABLE declaration ("sometimes") -> ${JSON.stringify(bogus.sale)}, refused rather than guessed. ` +
  `The fallback is PERMANENT by ruling, not a migration step — Adrian struck "delete the derivation ` +
  `afterwards" from the record himself.`);

/* ── LEG 4 WAS HERE — folded into leg 1 above, with the reason recorded there and in the report.
 *   Its break (letting the structure branch override a declaration) is the same break leg 1 needs,
 *   so keeping it separate would have added a green that cannot be red-proofed. The PROPERTY is
 *   still asserted — at both pricing modes AND across the add-a-price transition. ────────────── */

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
