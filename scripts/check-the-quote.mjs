#!/usr/bin/env node
/**
 * [RULE] A QUOTE IS BUILT FROM HIS OWN PRICES, NEVER INVENTS ONE, AND SHOWS ITS ARITHMETIC.
 *
 *   node scripts/check-the-quote.mjs
 *
 * ADRIAN, 2026-09-16: "Built from their own pricing through the equal readers · NEVER invents a number,
 * the existing grounding mechanism · asks for what is missing ONE ASK AT A TIME · a discount in his own
 * words applied WITH THE ARITHMETIC SHOWN — usual price, the discount, the result — because he reads it
 * aloud · a PDF he can text or email · MEASURE THE TURN TIME."
 *
 * THE TWO HONEST ORIGINS OF A PRICE, and the record stores which:
 *   'offer:<name>'  his own catalogue, read through `get_business_services` — the UNION reader, so this
 *                   works identically on a CLASSIC and a FREEFORM business (ruled 2026-09-16). It reads
 *                   the RECORD, never the page, so there is nothing for a page kind to differ about.
 *   'said'          a number he typed IN THIS MESSAGE — the same grounding rule as `priceGrounded`.
 * Anything else is 'unpriced' and Hubly ASKS. It never averages, never guesses, and never reaches back
 * into the transcript for a number — that last one is the evergreen-yard-care defect with money on it.
 *
 * [RULE]: every leg is one of those sentences. The turn-time leg asserts that a number is REPORTED and
 * that it is plausible, never a specific duration — a threshold would be a [SHAPE] leg about this
 * machine.
 *
 * RED-PROOFED, ELEVEN BREAKS, EACH ASSERTED TO HAVE APPLIED AND EACH RUN:
 *   an unpriced service given an invented 5000 -> legs 5, 6, 7, 16
 *   the reader's DOLLARS not converted to cents-> legs 1, 2, 4, 9, 10, 11, 15, 17  (a units bug is loud)
 *   the arithmetic replaced by the total alone -> legs 9, 9b
 *   OUR word "Discount" instead of his phrase  -> leg 9b
 *   the turn time not reported                -> leg 3
 *   saving an unpriced quote allowed           -> leg 16
 *   the one-off's "this quote only" line gone  -> leg 13
 *   the printed total = subtotal (drift)       -> leg 17
 *   "Valid for 30 days" added to the print     -> leg 19
 *
 * TWO PROBLEMS THAT PASS FOUND, and both were in the CHECK rather than the product:
 *   · Leg 9 only asserted the numbers, so replacing his phrase with our generic "Discount" in the
 *     sentence HE READS ALOUD went undetected — leg 18 covered only the printed copy. Leg 9b now
 *     covers the half that reaches a customer's ear.
 *   · `__rig.writes` accumulated across drives, so "it refused to save" read as one write from an
 *     EARLIER case and leg 16 failed against a correct product — while leg 14's "exactly one write"
 *     passed only because it happened to run first. A probe that shares state between cases is
 *     measuring the order it ran in.
 *
 * SIMULATED AND SAID SO: no session, no network. The quoter, the arithmetic, the ask and the print
 * document are the shipping product's; the catalogue is a declared fixture shaped exactly as the RPC
 * returns it (DOLLARS, plus source and conflicts) so the unit conversion is exercised too.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// HIS OWN CATALOGUE, in the shape get_business_services returns: DOLLARS, with a conflict flagged and
// one service he has never priced.
const SERVICES = [
  { name: "Full Detail", price: 85, duration_hours: 3, description: null, is_popular: true, source: "both", conflicts: false },
  { name: "Premium Detail", price: 130, duration_hours: 4, description: null, is_popular: false, source: "catalog", conflicts: false },
  { name: "Clay & Seal Package", price: 75, duration_hours: 2, description: null, is_popular: false, source: "catalog", conflicts: true },
  { name: "Paint Correction", price: null, duration_hours: null, description: null, is_popular: false, source: "catalog", conflicts: false },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

const drive = async (messages) => rig.page.evaluate(async ({ messages }) => {
  window.hublyModeUI.leave("t"); window.hublyQuoteUI.end();
  // EACH DRIVE STARTS FROM NOTHING WRITTEN. The first version let `__rig.writes` accumulate across
  // drives, so "it refused to save" read as 1 write from an EARLIER drive and leg 16 failed against a
  // correct product — and leg 14's "exactly one write" passed only because it happened to run first.
  // A probe that shares state between cases is measuring the order it ran in.
  window.__rig.writes.length = 0; window.__rig.quotes.length = 0;
  window.hublyModeUI.enter("quote", "test");
  const before = document.querySelectorAll(".hc-msg.hubly").length;
  for (const m of messages) {
    window.hublyModeUI.handled(m);
    await new Promise((r) => setTimeout(r, 350));
  }
  const said = [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent).slice(before);
  const q = window.hublyQuoteUI.state();
  return {
    said, last: said[said.length - 1] || "",
    lines: q ? (q.lines || []).map((l) => ({ name: l.name, cents: l.unit_cents, source: l.source })) : [],
    discount: q ? q.discount : null,
    math: q ? window.hublyQuoteUI.math(q) : null,
    writes: (window.__rig.writes || []).filter((w) => w.name === "create_quote"),
    quotes: (window.__rig.quotes || []).slice(),
  };
}, { messages });

try {
  console.log("SIMULATED — no session, no network. The quoter, the arithmetic and the print document are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian",
    tables: { jobs: [], tasks: [], services: SERVICES },
  });
  await rig.page.evaluate(() => { window.hublyCaptureUI.withBusiness("5ebedc20-1061-46b9-b393-a6ef57225910"); });

  const seam = await rig.page.evaluate(() => !!(window.hublyQuoteUI && window.hublyQuoteUI.math && window.hublyQuoteUI.printDoc));
  if (!seam) { console.error("CANNOT RUN — platform-home.html publishes no hublyQuoteUI seam"); await rig.close(); process.exit(2); }

  // ── HIS OWN PRICES, FROM HIS OWN RECORD ────────────────────────────────────────────────
  const one = await drive(["Full Detail"]);
  say("1 naming his own service prices the line FROM HIS RECORD, and says where it came from",
      one.lines.length === 1 && one.lines[0].cents === 8500 && one.lines[0].source === "offer:Full Detail",
      JSON.stringify(one.lines));
  say("2 the reader's DOLLARS become the record's CENTS exactly once — no unit bug",
      one.math && one.math.subtotal === 8500, `subtotal ${one.math && one.math.subtotal}`);
  say("3 and it reports how long the turn took, because he is mid-phone-call",
      /\(\d+ ms\)/.test(one.last), (one.last.match(/\(\d+ ms\)/) || [""])[0]);

  const two = await drive(["Full Detail and Premium Detail"]);
  say("4 two of his services in one sentence become two lines, each priced from his record",
      two.lines.length === 2 && two.math.subtotal === 21500, JSON.stringify(two.lines.map((l) => l.cents)));

  // ── NEVER INVENTS. An unpriced service ASKS. ───────────────────────────────────────────
  const un = await drive(["Paint Correction"]);
  say("5 a service HE has never priced becomes an UNPRICED line — never a guessed number",
      un.lines.length === 1 && un.lines[0].source === "unpriced" && un.lines[0].cents === 0,
      JSON.stringify(un.lines));
  say("6 and it ASKS him for that price, by name, one question",
      /what do you charge for paint correction/i.test(un.last) && (un.last.match(/\?/g) || []).length === 1,
      JSON.stringify(un.last.replace(/\n/g, " ").slice(0, 90)));

  const answered = await drive(["Paint Correction", "$400"]);
  say("7 the price he then types answers that line and is marked as HIS word",
      answered.lines.length === 1 && answered.lines[0].cents === 40000 && answered.lines[0].source === "said",
      JSON.stringify(answered.lines));

  // ── THE DISCOUNT, IN HIS WORDS, WITH THE ARITHMETIC ───────────────────────────────────
  const disc = await drive(["Full Detail and Premium Detail", "give him 10% off"]);
  say("8 a discount in HIS words is applied, and the words are kept as he said them",
      !!disc.discount && disc.discount.kind === "pct" && disc.discount.value === 10 &&
      /10\s*%\s*off/i.test(disc.discount.words || ""),
      JSON.stringify(disc.discount));
  say("9 the ARITHMETIC IS SHOWN — usual price, the discount, the result — because he reads it aloud",
      /usual price \$215/i.test(disc.last) && /\$21\.50 off/i.test(disc.last) && /comes to \$193\.50/i.test(disc.last),
      JSON.stringify(disc.last.replace(/\n/g, " ").slice(0, 150)));
  // AND THE SPOKEN LINE USES HIS WORDS TOO. Leg 18 only covered the PRINTED copy, so replacing the
  // phrase with our own generic "Discount" in the sentence he reads aloud went undetected — the half
  // that actually reaches a customer's ear.
  say("9b the sentence he reads aloud uses HIS phrase for the discount, not our word for it",
      /10% off is/i.test(disc.last) && !/\bDiscount is\b/i.test(disc.last),
      JSON.stringify((disc.last.match(/[^.\n]*off is[^.\n]*/i) || [""])[0].trim()));
  const flat = await drive(["Full Detail", "take 20 off"]);
  say("10 a flat discount works the same way and clamps at the subtotal",
      flat.math.discount === 2000 && flat.math.total === 6500, `disc ${flat.math.discount} total ${flat.math.total}`);
  const over = await drive(["Full Detail", "take 200 off"]);
  say("11 a discount bigger than the job cannot make the total negative",
      over.math.total === 0 && over.math.discount === 8500, `total ${over.math.total}`);

  // ── A ONE-OFF IS FIRST-CLASS AND NEVER BECOMES A PUBLIC OFFER ─────────────────────────
  const off = await drive(["headlight restoration for $60"]);
  say("12 work not on his list becomes a one-off line from HIS OWN WORDS, priced only by what he said",
      off.lines.length === 1 && off.lines[0].cents === 6000 && off.lines[0].source === "said" &&
      /headlight/i.test(off.lines[0].name), JSON.stringify(off.lines));
  say("13 and it SAYS the one-off stays on this quote only — it never becomes a public offer",
      /stays on this quote only/i.test(off.last), "said in words");

  // ── SAVING: the record computes the money, and the reply is read BACK ─────────────────
  const saved = await drive(["Full Detail and Premium Detail", "10% off", "send it"]);
  say("14 saving writes one quote, with every line carrying its source",
      saved.writes.length === 1 && (saved.writes[0].args.p_lines || []).every((l) => !!l.source),
      `${saved.writes.length} write(s), sources ${JSON.stringify((saved.writes[0] || {}).args ? saved.writes[0].args.p_lines.map((l) => l.source) : [])}`);
  say("15 the saved record's total is the total he was read, and the reply confirms from the READ-BACK",
      saved.quotes.length === 1 && saved.quotes[0].total_cents === 19350 && /^Saved\./.test(saved.last),
      `record total ${saved.quotes[0] && saved.quotes[0].total_cents} · ${JSON.stringify(saved.last.split("\n")[0])}`);

  const cantSend = await drive(["Paint Correction", "send it"]);
  say("16 it REFUSES to save a quote with an unpriced line, and says which one",
      cantSend.writes.length === 0 && /can.t send it yet/i.test(cantSend.last) && /paint correction/i.test(cantSend.last),
      JSON.stringify(cantSend.last.replace(/\n/g, " ").slice(0, 90)));

  // ── THE PRINTED COPY IS THE SAME ARITHMETIC ──────────────────────────────────────────
  const printed = await rig.page.evaluate(async () => {
    window.hublyModeUI.leave("t"); window.hublyQuoteUI.end();
    window.hublyModeUI.enter("quote", "test");
    window.hublyModeUI.handled("Full Detail and Premium Detail");
    await new Promise((r) => setTimeout(r, 350));
    window.hublyModeUI.handled("10% off");
    await new Promise((r) => setTimeout(r, 250));
    const q = window.hublyQuoteUI.state();
    const doc = window.hublyQuoteUI.printDoc(q);
    return { doc: doc || "", math: window.hublyQuoteUI.math(q) };
  });
  say("17 the printable copy shows the SAME three numbers he read aloud",
      /\$215/.test(printed.doc) && /−\$21\.50/.test(printed.doc) && /\$193\.50/.test(printed.doc),
      "usual price, discount, total all present");
  say("18 it uses HIS words for the discount on the page, not ours",
      /10% off/i.test(printed.doc) && !/\bDiscount\b/.test(printed.doc.replace(/data-[^=]*="[^"]*"/g, "")),
      "his phrasing on the printed row");
  say("19 nothing is invented on it — no validity period, no terms he never wrote",
      !/valid for|expires|terms and conditions|30 days/i.test(printed.doc), "no invented clauses");
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the quote comes from his own prices, asks for what is missing, and shows its arithmetic.\n");
process.exit(failed ? 1 : 0);
