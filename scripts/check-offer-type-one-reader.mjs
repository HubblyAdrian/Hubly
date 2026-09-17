#!/usr/bin/env node
/**
 * [RULE] THE TYPE MODEL HAS ONE READER, AND THE TWO RUNTIMES GIVE THE SAME ANSWER.
 *
 *   node scripts/check-offer-type-one-reader.mjs
 *
 * ADRIAN, 2026-09-16: "TYPE model on the OFFER, one reader, structural mapping … untyped must not
 * guess." And SETTLED 30, established from the column names rather than assumed:
 * OFFER : MEMBERSHIP :: SERVICE : JOB, so the type belongs on the thing you SELL.
 *
 * WHY THIS CHECK AND NOT A COMMENT. "One reader" cannot be literally true here: the canonical
 * reader is `offerType` in a Deno module (supabase/functions/_shared/service_engine.ts) and the
 * editor runs in a browser that cannot import it. The standing rule is that this codebase has two
 * of almost everything and a rule written once is usually present twice — so the honest response is
 * not to claim one copy, it is to make the two PROVABLY agree. Every case below runs through both,
 * and any disagreement on kind, sale, or either provenance is a failure.
 *
 * THE QUESTION WORDING IS CHECKED CHARACTER FOR CHARACTER, because copy is the half that drifts:
 * the model is data in both runtimes for the same reason HC_BAND_RULE is data — the copy IS the
 * rule, and a prompt-side edit to words the client actually writes has already cost us two days.
 *
 * [RULE], not [SHAPE]: every leg is "these two readers agree" or "an undeclared type is not
 * guessed". None asserts a count or a layout. Adding a fourth kind is a deliberate change to the
 * case table AND to both readers — which is exactly the cost this check is supposed to impose.
 *
 * RED-PROOFED IN BOTH DIRECTIONS (see docs/OFFER_TYPE.md): seen red with the client copy defaulting
 * an undeclared kind to 'service' (the guess), and seen red with the client's editor-shape
 * translation removed (the 'flat' -> 'fixed' half), which is the drift this exists to catch.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// SERVED OVER HTTP, NOT A CONVENIENCE: hubly.html links ten stylesheets root-absolutely, and
// under file:// none of them load — a check would then be measuring an unstyled document. The rig
// refuses that outright (it is why this check failed to start once); servePublic is the other half.
const site = await servePublic(ROOT);
const PAGE = site.url("hubly.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** THE CASE TABLE. Every row is a real record shape, and each says which rule it is exercising.
 *  `home` is the store the offer came out of — the structural half of the model. */
const CASES = [
  // ── the structure types it: where it is stored is a fact, not an inference ──────────────
  { why: "a catalog service with a flat price", home: "catalog_services",
    raw: { name: "Full Detail", pricing: { mode: "fixed", price_cents: 18000 } } },
  { why: "a catalog service priced by vehicle size", home: "catalog_services",
    raw: { name: "Full Detail", pricing: { mode: "variable", variable_prices: { sedan: 8500 } } } },
  { why: "a catalog service that must be quoted", home: "catalog_services",
    raw: { name: "Paint correction", pricing: { mode: "quote_required", price_cents: null } } },
  { why: "a membership offer, which has no pricing.mode at all", home: "membership_offers",
    raw: { name: "Monthly maintenance" } },
  { why: "a membership offer the owner quotes", home: "membership_offers",
    raw: { name: "Fleet plan", offer: { sale: "quoted" } } },
  // ── the record's own declaration beats the structure ───────────────────────────────────
  { why: "a membership stored in the services catalog, declared", home: "catalog_services",
    raw: { name: "Monthly wash club", offer: { kind: "membership" }, pricing: { mode: "fixed", price_cents: 4900 } } },
  { why: "something that is neither, declared", home: "catalog_services",
    raw: { name: "Trip fee", offer: { kind: "other" }, pricing: { mode: "fixed", price_cents: 1500 } } },
  // ── UNTYPED MUST NOT GUESS: no home, no declaration ───────────────────────────────────
  { why: "the object the + button is about to create — no home, nothing declared", home: "none",
    raw: { name: "" } },
  { why: "half-declared: he said membership, not yet how it is sold", home: "none",
    raw: { name: "", offer: { kind: "membership" } } },
  { why: "half-declared the other way: quoted, but not what it is", home: "none",
    raw: { name: "", offer: { sale: "quoted" } } },
  // ── THE EDITOR'S SHAPE, which speaks a different vocabulary ────────────────────────────
  { why: "an editor row: pricingType 'flat' means fixed", home: "catalog_services",
    raw: { name: "Express Wash", pricingType: "flat", price: 60 } },
  { why: "an editor row: pricingType 'variable'", home: "catalog_services",
    raw: { name: "Full Detail", pricingType: "variable", varPrices: { sedan: 85 } } },
  { why: "an editor row: pricingType 'quote' means quote_required", home: "catalog_services",
    raw: { name: "Restoration", pricingType: "quote" } },
  { why: "an editor row with no pricing decided yet", home: "catalog_services",
    raw: { name: "", pricingType: "" } },
  // ── garbage in: an unrecognised value is UNKNOWN, never the flattering default ─────────
  { why: "a kind we do not recognise", home: "catalog_services",
    raw: { name: "x", offer: { kind: "subscription" }, pricing: { mode: "fixed", price_cents: 100 } } },
  { why: "a sale mode we do not recognise, with no pricing to fall back on", home: "none",
    raw: { name: "x", offer: { sale: "haggled" } } },
  { why: "not an object at all", home: "none", raw: null },
];

// ── THE CANONICAL READER, IN ITS OWN RUNTIME ────────────────────────────────────────────────
let deno;
const dir = mkdtempSync(join(tmpdir(), "offertype-"));
const runner = join(dir, "run.ts");
writeFileSync(runner, `
import { offerType, OFFER_TYPE_QUESTIONS, offerIsTyped, offerTypeAsk } from "${join(ROOT, "supabase/functions/_shared/service_engine.ts")}";
const cases = ${JSON.stringify(CASES)};
console.log(JSON.stringify({
  answers: cases.map((c: any) => { const t = offerType(c.raw, c.home);
    return { ...t, typed: offerIsTyped(t), ask: offerTypeAsk(t) }; }),
  questions: OFFER_TYPE_QUESTIONS,
}));
`);
try {
  deno = JSON.parse(execFileSync("deno", ["run", "--allow-read", runner], { encoding: "utf8" }).trim());
} catch (e) {
  console.error("CANNOT RUN — the canonical reader would not run under Deno: " + String(e.message).slice(0, 200));
  process.exit(2);
}

// ── THE CLIENT COPY, IN A REAL BROWSER, FROM THE SHIPPING PAGE ──────────────────────────────
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

let client;
try {
  await rig.load(PAGE);
  const seamOk = await rig.page.evaluate(() => typeof window.hublyOfferUI?.type === "function");
  if (!seamOk) { console.error("CANNOT RUN — public/hubly.html publishes no hublyOfferUI.type seam"); await rig.close(); process.exit(2); }
  client = await rig.page.evaluate((cases) => ({
    answers: cases.map((c) => {
      const t = window.hublyOfferUI.type(c.raw, c.home);
      return Object.assign({}, t, { typed: window.hublyOfferUI.isTyped(t), ask: window.hublyOfferUI.ask(t) });
    }),
    questions: window.hublyOfferUI.questions,
  }), CASES);
} finally { await rig.close(); site.close(); }

// ── LEG 1..N: THE TWO RUNTIMES AGREE, CASE BY CASE ──────────────────────────────────────────
console.log("The canonical reader ran under Deno; the client copy ran in a browser on the shipping page.\n");
let disagreements = 0;
CASES.forEach((c, i) => {
  const a = deno.answers[i], b = client.answers[i];
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) { disagreements++; console.log(`  DISAGREE  ${c.why}\n            server: ${JSON.stringify(a)}\n            client: ${JSON.stringify(b)}`); }
});
say(`1 both readers give the same answer for all ${CASES.length} record shapes`,
    disagreements === 0, `${disagreements} disagreement(s)`);

// ── THE MODEL ITSELF, asserted once (the two now being known equal) ─────────────────────────
const at = (why) => deno.answers[CASES.findIndex((c) => c.why === why)];
say("2 where it is stored types it — and says the answer came from the structure",
    at("a catalog service with a flat price").kind === "service" &&
    at("a catalog service with a flat price").kindFrom === "structure" &&
    at("a membership offer, which has no pricing.mode at all").kind === "membership",
    JSON.stringify(at("a membership offer, which has no pricing.mode at all")));
say("3 quote_required is the quoted axis, and it is independent of the kind",
    at("a catalog service that must be quoted").sale === "quoted" &&
    at("a catalog service that must be quoted").kind === "service" &&
    at("a membership offer the owner quotes").sale === "quoted" &&
    at("a membership offer the owner quotes").kind === "membership",
    "a service can be quoted and a membership can be quoted");
say("4 the record's own declaration beats the store it happens to live in",
    at("a membership stored in the services catalog, declared").kind === "membership" &&
    at("a membership stored in the services catalog, declared").kindFrom === "declared",
    JSON.stringify(at("a membership stored in the services catalog, declared")));
say("5 UNTYPED IS NOT GUESSED — the + button's object is unknown on both axes",
    at("the object the + button is about to create — no home, nothing declared").kind === "unknown" &&
    at("the object the + button is about to create — no home, nothing declared").sale === "unknown" &&
    at("the object the + button is about to create — no home, nothing declared").typed === false,
    JSON.stringify(at("the object the + button is about to create — no home, nothing declared")));
const blank = at("the object the + button is about to create — no home, nothing declared");
say("6 an unknown type produces a QUESTION, never a stated type",
    typeof blank.ask === "string" && blank.ask.includes("?") &&
    at("a catalog service with a flat price").ask === null,
    JSON.stringify(blank.ask));
// ONE ASK AT A TIME. The first version of offerTypeAsk concatenated both questions into one line,
// which is two requests in one message — the defect of 2026-08-26 wearing a type model's clothes.
say("6b with BOTH halves unknown it asks ONE question, not two",
    blank.ask === client.questions.kind.ask && !blank.ask.includes(client.questions.sale.ask),
    JSON.stringify(blank.ask));
say("7 a half-declared offer is asked ONLY the half that is missing (one ask at a time)",
    at("half-declared: he said membership, not yet how it is sold").ask === client.questions.sale.ask &&
    at("half-declared the other way: quoted, but not what it is").ask === client.questions.kind.ask,
    `${at("half-declared: he said membership, not yet how it is sold").ask} / ${at("half-declared the other way: quoted, but not what it is").ask}`);
say("8 a DECLARATION we cannot read is unknown, never overruled by the store it sits in",
    at("a kind we do not recognise").kind === "unknown" &&
    at("a kind we do not recognise").kindFrom === "unknown" &&
    at("a sale mode we do not recognise, with no pricing to fall back on").sale === "unknown" &&
    at("not an object at all").kind === "unknown",
    "subscription / haggled / null all land on unknown");
say("9 the editor's own vocabulary reads the same as the catalog's",
    at("an editor row: pricingType 'flat' means fixed").sale === "bookable" &&
    at("an editor row: pricingType 'variable'").sale === "bookable" &&
    at("an editor row: pricingType 'quote' means quote_required").sale === "quoted" &&
    at("an editor row with no pricing decided yet").sale === "unknown",
    "flat->bookable, variable->bookable, quote->quoted, blank->unknown");
say("10 the two questions are worded identically in both runtimes, character for character",
    JSON.stringify(deno.questions) === JSON.stringify(client.questions),
    JSON.stringify(deno.questions) === JSON.stringify(client.questions) ? "identical" : "the copy has drifted");

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — one type model, two runtimes, no guessing.\n");
process.exit(failed ? 1 : 0);
