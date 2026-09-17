#!/usr/bin/env node
/**
 * [RULE] THE QUOTES RAIL ROW STILL WORKS WITH smart-quote/ui.js GONE.
 *
 *   node scripts/check-quote-tab-after-removal.mjs
 *
 * ADRIAN, 2026-09-16: "THEN AND ONLY THEN the 177KB comes out, in its own commit, saying exactly what
 * went and confirming the rail row still works."
 *
 * ══ WHAT WENT, AND WHAT DID NOT — MEASURED BEFORE ANYTHING WAS DELETED ═══════════════════════
 *
 *   ui.js      82,971  HublySmartQuoteUI — the old Quick Quote UI. **REMOVED.**
 *   engine.js  56,171  HublySmartQuote — used by ui.js (31x) AND booking.js (16x). **STAYS.**
 *   booking.js 37,823  HublyBookingSQ — the LIVE BOOKING WIZARD's pricing. **STAYS.**
 *
 * The 176,965 bytes were never one removable unit. `HublyBookingSQ.computeMoney()` is called
 * **unguarded** at two sites in hubly.html, in the path where a booking is priced and paid for —
 * removing booking.js throws there, and engine.js is what it computes with. **Deleting either to
 * reach a byte count would trade a working payment path for a tidier number.**
 *
 * So 82,971 of 176,965 came out, and the rest is named rather than quietly counted as removed.
 *
 * ══ WHAT THIS ASSERTS ═══════════════════════════════════════════════════════════════════════
 *
 * That nothing is left pointing at the file that is gone. A deleted script does not 404 into a
 * visible error — its globals are simply `undefined`, and an `onclick` that calls one throws only
 * when a person presses it. **That is the same silent-undefined shape as /contact-pick.js**, which is
 * why this check exists rather than a read-through.
 *
 * [RULE]: the legs are "no live reference to a removed global" and "the tab has contents". None
 * asserts a byte count — the numbers above are in the prose, where a human reads them, because a leg
 * asserting 82,971 would go red the day someone reformats the file.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { codeOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const html = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
// COMMENTS STRIPPED. This file explains at length which globals came out, and a file-wide search for
// their names trips on the explanation — the third time that shape has fired (SETTLED 31).
const code = codeOf(html);

say("1 smart-quote/ui.js is gone from disk",
    !existsSync(join(ROOT, "public/smart-quote/ui.js")), "removed");
say("2 and the page no longer loads it",
    !/<script[^>]*smart-quote\/ui\.js/.test(html), "no <script src> for it");

// ── NOTHING LIVE STILL CALLS THE GLOBAL IT DEFINED ────────────────────────────────────────
const live = [...code.matchAll(/HublySmartQuoteUI\s*\.\s*([A-Za-z]+)/g)].map((m) => m[1]);
say("3 no live call to HublySmartQuoteUI survives — a deleted global does not error, it is undefined",
    live.length === 0, live.length ? `still called: ${[...new Set(live)].join(", ")}` : "none");
const orphanIds = ["sq-list", "m-quote-sms", "quote-sms-body"].filter((id) => new RegExp(`id="${id}"`).test(code));
say("4 the markup its buttons lived in went with it — no controls left that throw when pressed",
    orphanIds.length === 0, orphanIds.length ? `orphaned: ${orphanIds.join(", ")}` : "none");

// ── WHAT STAYS, STAYS — AND THE REASON IS CHECKABLE ──────────────────────────────────────
say("5 engine.js and booking.js are still on disk and still loaded",
    existsSync(join(ROOT, "public/smart-quote/engine.js")) &&
    existsSync(join(ROOT, "public/smart-quote/booking.js")) &&
    /smart-quote\/engine\.js/.test(html) && /smart-quote\/booking\.js/.test(html),
    "both present");
// THE REASON, ASSERTED: booking.js is load-bearing because computeMoney is called without a guard.
const unguarded = (code.match(/(?<!typeof )HublyBookingSQ\.computeMoney\(\)/g) || []).length;
say("6 booking.js is load-bearing — computeMoney() is called UNGUARDED where a booking is priced",
    unguarded >= 1, `${unguarded} unguarded call site(s); removing it would throw there`);

// ── AND THE RAIL ROW HAS CONTENTS ────────────────────────────────────────────────────────
say("7 the Quotes rail row still exists",
    /data-v="quotes"/.test(html), 'data-v="quotes" present');
say("8 and it renders the RECORD — the row opens onto something, not an empty panel",
    /renderQuotesFromRecord\(\)/.test(code) && /id="sq-record-list"/.test(code) &&
    /rpc\('get_business_quotes'/.test(code),
    "renderQuotesFromRecord -> get_business_quotes -> #sq-record-list");
say("9 switching to the view calls it — the door is wired, not merely defined",
    /v==='quotes'\)\{[\s\S]{0,200}?renderQuotesFromRecord\(\)/.test(code),
    "switchV('quotes') renders the record");
say("10 and the empty state says how a quote is made, without naming a control it cannot see",
    /Say .quick quote. to Hubly/.test(code) && !/click the .*button/i.test(code),
    "says what to say, not what to press");

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — ui.js is out, the wizard's pricing stayed, and the rail row opens onto the record.\n");
process.exit(failed ? 1 : 0);
