#!/usr/bin/env node
/**
 * [RULE] A SERVICE WITH show_price FALSE SHOWS NO NUMBER AND IS STILL REACHABLE.
 *
 *   node scripts/check-a-hidden-price-stays-reachable.mjs
 *
 * ══ WHY ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Adrian, 2026-09-18: *"Most of my customers do not price off a menu. A detailer prices by vehicle
 * size, a cleaner by house size, a landscaper by lot and how bad it is. A fixed number is not just
 * wrong for them — it is a number they have to walk back on the phone."*
 *
 * And the rule that binds with it: **hiding a price must not remove the way a customer gets in touch.**
 * The service stays bookable or quotable. Hiding a price is not a third branch — it is a fact about
 * one field.
 *
 * ══ WHAT WAS MEASURED BEFORE ANY OF THIS WAS BUILT ═══════════════════════════════════════════
 *
 * `svcDisplayPrice` already returns "Quote at booking" for `showPrice === false` — but it reads a
 * CATALOG offer, and `applyServicesToFreeform`'s signature was
 * `{ name, price?, description? }[]`: three fields, and the flag was not one of them. So on a
 * FREEFORM page — the path every new business takes — a hidden price had no representation at all, in
 * the record or on the page. That is why `services.show_price` was added rather than reused.
 *
 * SCOPED, and the scope matters: this asserts the SERVER's placement wording and the OWNER-SIDE
 * control's wiring, plus the reader that feeds it. It does NOT drive a real freeform save — that needs
 * an owner session this environment may never create — so leg 3 reads the deployed placement function's
 * own source rather than a rendered page, and says so.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };
const shell = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
const canvas = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const registry = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");

function liveRead(args, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try { return { out: execFileSync("supabase", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 }) }; }
    catch (e) { last = e.message.split("\n")[0]; }
  }
  return { out: null, err: `${tries} attempt(s); last: ${last}` };
}

/* ── LEG 1 — the column, and every existing row unchanged ──────────────────────────────────── */
declareBreak({
  leg: "1 services.show_price exists, is NOT NULL, and defaults to showing",
  provenBy: "Reads the live schema, so no repo edit can move it. PROVEN BY HAND across the migration " +
            "on 2026-09-18: BEFORE 20260918240000 `information_schema.columns` had no show_price row " +
            "for `services` at all and the panel had nothing to write; AFTER, the column reads " +
            "boolean / NO / default true, and all 283 existing rows measured `show_price = true` — so " +
            "no owner's page changed. That is this assertion red then green for its own reason.",
});
const col = liveRead(["db", "query", "--linked",
  "select coalesce(string_agg(data_type || '|' || is_nullable || '|' || coalesce(column_default,''), ''), 'ABSENT') as c " +
  "from information_schema.columns where table_name='services' and column_name='show_price'"]);
const counts = liveRead(["db", "query", "--linked",
  "select count(*) as n, count(*) filter (where not show_price) as hidden from services"]);
let colDesc = null, total = null, hidden = null;
if (col.out) { const m = col.out.match(/"c":\s*"([^"]*)"/); if (m) colDesc = m[1]; }
if (counts.out) { const a = counts.out.match(/"n":\s*(\d+)/), b = counts.out.match(/"hidden":\s*(\d+)/); if (a) total = Number(a[1]); if (b) hidden = Number(b[1]); }
leg("RULE", "1 services.show_price exists, is NOT NULL, and defaults to showing",
  colDesc === "boolean|NO|true" && total !== null,
  colDesc === null ? `could not read the live schema (${col.err || "no row"}) — reported as FAILURE, not skipped`
    : `information_schema says ${JSON.stringify(colDesc)} (type|nullable|default) across ${total} row(s), ` +
      `${hidden} of them hidden. NOT NULL deliberately: "we do not know whether to show this price" is ` +
      `not a state a renderer can act on, and NULL would make \`show_price = false\` miss rows that a ` +
      `reader would then treat as hidden or shown depending on the operator it used.`);

/* ── LEG 2 — the reader surfaces it, so the control can reflect it ─────────────────────────── */
declareBreak({
  leg: "2 the owner's reader returns show_price, so the control can show its own state",
  provenBy: "Also the live schema. PROVEN BY HAND: before 20260918250000 the union reader's RETURNS " +
            "TABLE was (name, price, duration_hours, description, is_popular, source, conflicts) — no " +
            "show_price — so the panel's tick box would have rendered unchecked-or-checked from " +
            "nothing, which is a control that lies about the record. After, the column is returned and " +
            "evergreen-yard-care reads `true` with source `both`.",
});
const rd = liveRead(["db", "query", "--linked",
  "select coalesce(string_agg(t.a, ','), 'NONE') as cols from (select a from unnest(string_to_array(" +
  "pg_get_function_result('public.get_business_services(uuid,uuid)'::regprocedure), ',')) a) t where t.a ilike '%show_price%'"]);
let readerHas = null;
if (rd.out) { const m = rd.out.match(/"cols":\s*"([^"]*)"/); if (m) readerHas = m[1]; }
leg("RULE", "2 the owner's reader returns show_price, so the control can show its own state",
  !!readerHas && /show_price/.test(readerHas),
  readerHas === null ? `could not read the function's result type (${rd.err || "no row"}) — FAILURE, not skipped`
    : /show_price/.test(readerHas) ? `get_business_services returns ${JSON.stringify(readerHas.trim())}. The ` +
        `union resolves a disagreement between the two stores by preferring the CATALOGUE — the same ` +
        `rule it already applies to price two lines up, for the same stated reason, so a service's ` +
        `price and its visibility cannot come from different stores.`
      : `the reader does not return show_price, so the panel's control has no state to reflect`);

/* ── LEG 3 — the placement writes the WORDING, not a number ────────────────────────────────── */
declareBreak({
  leg: "3 the freeform placement writes the wording, and writes the SAME wording the client does",
  why: "put the number back unconditionally. Every other leg still passes — the column exists, the " +
       "reader returns it, the control saves it — and the owner's choice simply never reaches the page. " +
       "A setting that stores correctly and changes nothing is the worst of the three outcomes, because " +
       "the record agrees with the owner and the page does not.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: '  const priceStr = showPrice === false ? "Quote at booking" : fmtServicePrice(price);',
  with: "  const priceStr = fmtServicePrice(price);",
});
const wording = (canvas.match(/quoteAtBooking:\s*'([^']+)'/) || [])[1] || null;
const placeHonours = /const priceStr = showPrice === false \? "Quote at booking" : fmtServicePrice\(price\);/.test(registry);
const threaded = /placeOneServicePrice\(out, s\.name, s\.price, s\.show_price !== false\)/.test(registry) &&
  /tryInsert\(s\.name, s\.price, s\.description, s\.show_price !== false\)/.test(registry);
const sameWords = wording === "Quote at booking";
leg("RULE", "3 the freeform placement writes the wording, and writes the SAME wording the client does",
  placeHonours && threaded && sameWords,
  `placement honours the flag: ${placeHonours}; threaded through BOTH freeform paths (anchored row and ` +
  `guess-row clone): ${threaded}; and the words match the client's t('quoteAtBooking') = ` +
  `${JSON.stringify(wording)}: ${sameWords}. Both paths matter — otherwise which wording an owner sees ` +
  `depends on whether his page happened to ship with placeholder rows. SCOPED: this reads the deployed ` +
  `function's source, not a rendered page; a real freeform save needs an owner session.`);

/* ── LEG 4 — the anchor SURVIVES, so hiding is reversible and the service stays reachable ──── */
declareBreak({
  leg: "4 hiding a price keeps the anchor and removes no way to get in touch",
  // AIMED AT THE ANCHOR, NOT THE WORDING. The first break emptied `priceStr`, which is the same ONE
  // LINE leg 3 reads — so it fired both and proved nothing about either (L98). What leg 4 claims on its
  // own is that the wording goes INSIDE the keyed span, so this break writes it bare instead: the
  // owner still sees "Quote at booking", and the anchor every later price change depends on is gone.
  why: "emit the wording WITHOUT its span. The page still reads correctly to the owner — which is why " +
       "this is the dangerous version — and the keyed anchor is gone, so the next price change has " +
       "nothing to find and 'hidden' becomes indistinguishable from 'never had a price' to every later " +
       "reader. It is also how hiding a price would quietly take the booking affordance with it.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: '    const rebuilt = `<span data-hubly-price="${keyAttr}">${priceStr}</span>`;',
  with: "    const rebuilt = `${priceStr}`;",
});
// ══ COUNTED, NOT "DOES IT APPEAR SOMEWHERE" ═══════════════════════════════════════════════════
//
// This was `.test(registry)` for one template. FIVE sites in that file build a data-hubly-price span —
// the rebuild, the bare-price replacement, the injection, and the clone builder all emit the same
// wrapper — so "does this string appear" was satisfied by any ONE of them, and the break that removed
// the rebuild left the leg GREEN. The runner reported NOT RED and it was right: the leg was vacuous.
// Counting makes removing any single site visible.
const anchorSites = (registry.match(/<span data-hubly-price="\$\{(?:keyAttr|nameAttr)\}">\$\{priceStr\}<\/span>/g) || []).length;
const keepsAnchor = anchorSites >= 4;
const noPriceNoRemoval = !/showPrice === false[\s\S]{0,400}?(removeServiceCard|splice|delete )/.test(registry);
// `placeHonours` WAS ALSO ASSERTED HERE and that was the coupling: it is leg 3's clause, and legs 3 and
// 4 then shared one line of source. One clause, one leg — the fourth time today the same fault and the
// same fix (the rail check's leg 1, the name-reader's leg 11, the second-edit check's control leg).
leg("RULE", "4 hiding a price keeps the anchor and removes no way to get in touch",
  keepsAnchor && noPriceNoRemoval,
  `${anchorSites} site(s) write the wording INTO a keyed data-hubly-price span (4 expected: the ` +
  `rebuild, the bare-price replacement, the injection, and the clone builder), so the ` +
  `anchor survives and the next price change still has something to find — and nothing on the hidden ` +
  `path removes the card or the booking route (${noPriceNoRemoval}). Hiding a NUMBER is a fact about one ` +
  `field; it is not a third branch and it must not become one.`);

/* ── LEG 5 — the owner's control, beside the price, writing the field it names ─────────────── */
declareBreak({
  leg: "5 the control sits beside the price and writes what it says",
  why: "drop showPrice from the edit save. The tick box still renders, still reflects the record, and " +
       "still appears to work — and unticking it changes nothing, which is a control that lies. That is " +
       "the shape of every dead control this codebase has removed.",
  file: "public/platform-home.html",
  find: "description: wrap.querySelector('.mng-sd').value.trim(), showPrice: showEdit });",
  with: "description: wrap.querySelector('.mng-sd').value.trim() });",
});
const boxes = (shell.match(/class="mng-sshow"/g) || []).length;
const savesEdit = /showPrice: showEdit \}\)/.test(shell);
const savesAdd = /showPrice: showAdd \}\)/.test(shell);
const besidePrice = shell.indexOf('class="hc-mng-showp"') > shell.indexOf('placeholder="Price"');
const readsState = /showPrice: r\.show_price !== false/.test(shell);
leg("RULE", "5 the control sits beside the price and writes what it says",
  boxes === 2 && savesEdit && savesAdd && besidePrice && readsState,
  `${boxes} tick box(es) — the edit row and the add row, so a service can be created hidden as well as ` +
  `hidden later; it sits after the price field (${besidePrice}), because a service is where an owner ` +
  `thinks about its price; both save paths send it (edit ${savesEdit}, add ${savesAdd}); and it reflects ` +
  `the record via \`r.show_price !== false\` (${readsState}) — \`!== false\` and not \`=== true\`, so a ` +
  `reader that stops returning the field shows prices rather than hiding every one of them.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
