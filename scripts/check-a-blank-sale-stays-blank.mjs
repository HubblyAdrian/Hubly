#!/usr/bin/env node
/**
 * [RULE] AN ORDINARY EDIT NEVER TURNS A DERIVED SALE INTO A DECLARED ONE.
 *
 *   node scripts/check-a-blank-sale-stays-blank.mjs
 *
 * ══ THE REQUIREMENT, IN ADRIAN'S WORDS ═══════════════════════════════════════════════════════
 *
 * *"A BLANK STAYS BLANK. This is the requirement, not a detail. Three states — not declared, declared
 * bookable, declared quoted — and the writer touches sale ONLY on an explicit pick. An owner editing a
 * price, a name or a description must leave sale exactly as it was, including absent. Silently
 * converting every service from derived to declared destroys the provenance distinction with no way
 * back, and nobody would notice until something depended on it."*
 *
 * `offerType` answers with a PROVENANCE — `saleFrom: "declared"` when the owner said so, `"structure"`
 * when it was derived from the pricing mode. The damage a default would do is not a wrong value: it is
 * that "bookable, because nobody ever said" and "bookable, because the owner chose it" would become the
 * same record, everywhere, permanently.
 *
 * ══ WHY LEG 1 IS THE ONE THAT CAN LIE ════════════════════════════════════════════════════════
 *
 * Adrian: *"especially the leave-it-alone leg, which is the one that can pass vacuously if the fixture
 * never has an undeclared service in it."* So leg 1 asserts, as part of its own claim, that the fixture
 * CONTAINED an undeclared service and that its provenance was `structure` BEFORE the edit — because
 * "the provenance did not change" is trivially true of a service that had no provenance to change, and
 * of a fixture with no undeclared services at all.
 *
 * SCOPED: this drives the real panel in the real shell with a SIMULATED owner, and reads what the edit
 * WOULD send (the request the rig captures) plus the real `offerType` on the resulting record shape. It
 * does NOT perform a live catalogue write — that needs an owner session — so leg 4 asserts the server
 * writes it only on a pick by reading the deployed handler, and says so.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REG = "supabase/functions/_shared/hubly_capability_registry.ts";
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* THE REAL offerType, so provenance is judged by the product and not by this file. */
let offerType;
try {
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, "supabase/functions/_shared/service_engine.ts")],
    { encoding: "utf8", cwd: ROOT, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
  ({ offerType } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")));
} catch (e) { console.error("CANNOT RUN — could not load service_engine: " + String(e.message).split("\n")[0]); process.exit(2); }
if (typeof offerType !== "function") { console.error("CANNOT RUN — offerType not exported"); process.exit(2); }

/* ── DRIVE THE REAL PANEL ───────────────────────────────────────────────────────────────────── */
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };
const srv = await servePublic(ROOT);
let rig, probe = null;
try { rig = await openRig({ width: 1440, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }
try {
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "o@e.test", displayName: "Adrian",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    // THE FIXTURE CONTAINS AN UNDECLARED SERVICE ON PURPOSE — leg 1 asserts that it does. The rig
    // answers get_business_services from `tables.services`, read off scripts/lib/owner-rig.mjs rather
    // than guessed: a fixture that guessed a record shape cost three red legs an hour earlier today.
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [
      { name: "Full Detail", price: 95, description: "in and out", show_price: true, source: "both", conflicts: false },
      { name: "Ceramic Coating", price: null, description: "", show_price: true, source: "services", conflicts: false },
    ] },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }
  probe = await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    // hcManageBtn is rendered BY hcRenderCanvas, so the canvas has to exist before it does — found by
    // the probe reporting "no hcManageBtn" rather than by reading the renderer.
    window.hublyNavUI.openWorkspace("website");
    await new Promise((r) => setTimeout(r, 900));
    const btn = document.getElementById("hcManageBtn");
    if (!btn) return { why: "no hcManageBtn" };
    btn.click();
    await new Promise((r) => setTimeout(r, 900));
    const rows = [...document.querySelectorAll(".hc-mng-svc:not(.hc-mng-add)")];
    if (!rows.length) return { why: "the panel rendered no service rows" };
    const row = rows[0];
    const sel = row.querySelector(".mng-ssale");
    const out = {
      rows: rows.length,
      selectPresent: !!sel,
      // THE RENDERED STATE of an undeclared service: the empty option must be the selected one.
      selectedValue: sel ? sel.value : null,
      optionValues: sel ? [...sel.options].map((o) => o.value) : null,
      optionLabels: sel ? [...sel.options].map((o) => o.textContent.trim()) : null,
      addRowHasSelect: !!document.querySelector(".hc-mng-add .mng-ssale"),
    };
    // ── AN UNRELATED EDIT: change the DESCRIPTION only, and capture what goes out ───────────
    const before = (window.__rig.fetches || []).length;
    row.querySelector(".mng-sd").value = "in and out, twice";
    row.querySelector(".mng-ssave").click();
    await new Promise((r) => setTimeout(r, 1200));
    const sent = (window.__rig.fetches || []).slice(before)
      .map((f) => f.body && f.body.directRecordEdit).filter(Boolean);
    out.unrelatedEdit = sent[0] || null;
    out.unrelatedHasSaleKey = sent.length ? Object.prototype.hasOwnProperty.call(sent[0], "sale") : null;
    // ── NOW AN EXPLICIT PICK ────────────────────────────────────────────────────────────────
    const before2 = (window.__rig.fetches || []).length;
    if (sel) { sel.value = "quoted"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    row.querySelector(".mng-ssave").click();
    await new Promise((r) => setTimeout(r, 1200));
    const sent2 = (window.__rig.fetches || []).slice(before2)
      .map((f) => f.body && f.body.directRecordEdit).filter(Boolean);
    out.pickedEdit = sent2[0] || null;
    out.pickedSale = sent2.length ? sent2[0].sale : null;
    return out;
  }, { biz: BIZ });
} catch (e) { console.error("CANNOT RUN — " + e.message); await rig.close(); srv.close(); process.exit(2); }
await rig.close(); srv.close();
if (!probe || probe.why) { console.error("CANNOT RUN — " + ((probe && probe.why) || "the probe did not run")); process.exit(2); }

/* The undeclared service's provenance, judged by the real reader, before and after that edit. */
const undeclared = { name: "Full Detail", pricing: { mode: "fixed", price_cents: 9500, show_price: true },
                     includes: [], addons: [], media: { photos: [] } };
const beforeT = offerType(undeclared, "catalog_services");
const afterUnrelated = offerType({ ...undeclared, description: "in and out, twice" }, "catalog_services");
console.log(`  panel: ${probe.rows} row(s) · select present ${probe.selectPresent} · selected ` +
  `${JSON.stringify(probe.selectedValue)} · options ${JSON.stringify(probe.optionValues)} · add row has one ${probe.addRowHasSelect}`);
console.log(`  unrelated edit sent sale key: ${probe.unrelatedHasSaleKey} · explicit pick sent ` +
  `${JSON.stringify(probe.pickedSale)} · provenance before ${JSON.stringify(beforeT.saleFrom)} after ${JSON.stringify(afterUnrelated.saleFrom)}\n`);

/* ── LEG 1 — THE LEAVE-IT-ALONE LEG, with its own vacuity guard ─────────────────────────────── */
declareBreak({
  leg: "1 an unrelated edit sends NO sale key, so a derived answer stays derived",
  why: "send the select's value unconditionally. Every edit then carries sale, so the first time an " +
       "owner corrects a description every service becomes DECLARED — and \"bookable because nobody " +
       "said\" and \"bookable because the owner chose it\" become the same record, product-wide, with no " +
       "way back. The control still looks identical and nothing errors.",
  file: "public/platform-home.html",
  find: "        if(saleEdit) editPayload.sale = saleEdit;",
  with: "        editPayload.sale = saleSel ? saleSel.value : '';",
});
const fixtureHadUndeclared = beforeT.saleFrom === "structure" && beforeT.sale === "bookable";
leg("RULE", "1 an unrelated edit sends NO sale key, so a derived answer stays derived",
  fixtureHadUndeclared && probe.unrelatedHasSaleKey === false &&
    afterUnrelated.saleFrom === "structure" && !!probe.unrelatedEdit,
  `the fixture CONTAINED an undeclared service whose provenance was ${JSON.stringify(beforeT.saleFrom)} ` +
  `before the edit (${fixtureHadUndeclared}) — asserted as part of this leg, because "the provenance did ` +
  `not change" is trivially true of a service that never had one, which is exactly how this leg could ` +
  `pass vacuously. A description-only save sent ` +
  `${JSON.stringify(probe.unrelatedEdit ? Object.keys(probe.unrelatedEdit) : null)} — no \`sale\` key ` +
  `(hasOwnProperty: ${probe.unrelatedHasSaleKey}) — and the provenance after is ` +
  `${JSON.stringify(afterUnrelated.saleFrom)}.`);

/* ── LEG 2 — the control tells the truth about a state nobody chose ─────────────────────────── */
// ══ THIS LEG IS ABOUT THE WORDING AND THE OPTION SET, NOT ABOUT WHICH IS SELECTED ═════════════
//
// It first asserted "the EMPTY option is selected" and its break removed ` selected` from it — which
// changed NOTHING, because a <select> with no explicit selection defaults to its first option. The
// runner reported NOT RED and was right: the break did not reproduce the defect.
//
// And no break CAN separate "which option is selected" from leg 1: the writer reads `sel.value`, so any
// render change that pre-selects the derived answer also makes the next save send it. Those two are one
// claim, and leg 1 owns it — it asserts the actual consequence (no `sale` key on an unrelated edit),
// which is the thing that matters.
//
// So leg 2 owns what is genuinely its own and genuinely breakable: THREE states exist, and their words
// are the product's own. `OFFER_TYPE_QUESTIONS` is exported as data in service_engine.ts for exactly
// this reason — "the copy IS the rule" — and two surfaces wording one question differently is the
// status-vocabulary scar, one question over.
declareBreak({
  leg: "2 the three states exist and use the product's OWN wording, not new copy",
  why: "reword one option. The control still works, the blank rule still holds, and the editor now asks " +
       "the sale question in different words from the `+` flow — which is how an owner comes to think " +
       "they are answering two different questions about the same thing.",
  file: "public/platform-home.html",
  find: "'<option value=\"bookable\"'+(s.sale==='bookable'?' selected':'')+'>They book it</option>'+",
  with: "'<option value=\"bookable\"'+(s.sale==='bookable'?' selected':'')+'>Bookable</option>'+",
});
const WANT_LABELS = ["They book it", "They ask for a price"];
const gotLabels = (probe.optionLabels || []).slice(1);
leg("RULE", "2 the three states exist and use the product's OWN wording, not new copy",
  probe.selectPresent && probe.addRowHasSelect &&
    JSON.stringify(probe.optionValues) === JSON.stringify(["", "bookable", "quoted"]) &&
    JSON.stringify(gotLabels) === JSON.stringify(WANT_LABELS),
  `values ${JSON.stringify(probe.optionValues)} — three real states, the empty one first — labelled ` +
  `${JSON.stringify(gotLabels)}, which is OFFER_TYPE_QUESTIONS.sale's wording verbatim. The add row has ` +
  `one too (${probe.addRowHasSelect}). WHICH option is selected is leg 1's claim, not this one: the ` +
  `writer reads sel.value, so no break can separate the two, and leg 1 asserts the consequence that ` +
  `actually matters. (An undeclared service did render the empty option: ` +
  `${JSON.stringify(probe.selectedValue)}.)`);

/* ── LEG 3 — and a pick DOES write ──────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 an explicit pick sends the declaration",
  why: "drop the key on a pick as well. The control then does nothing at all in either direction — the " +
       "blank rule satisfied by a control that cannot write, which is the dead-control shape and would " +
       "leave legs 1 and 2 green.",
  file: "public/platform-home.html",
  find: "        var editPayload = { kind:'service', op:'edit', id: wrap.getAttribute('data-id')",
  with: "        var saleEdit = null; var editPayload = { kind:'service', op:'edit', id: wrap.getAttribute('data-id')",
});
leg("RULE", "3 an explicit pick sends the declaration",
  probe.pickedSale === "quoted",
  `after picking "They ask for a price" the edit carried sale=${JSON.stringify(probe.pickedSale)}. Asserted ` +
  `separately from legs 1 and 2 because a control that never writes would satisfy both of them — the ` +
  `blank rule is only worth anything if the non-blank case works.`);

/* ── LEG 4 — and the SERVER writes it only on a pick ────────────────────────────────────────── */
declareBreak({
  leg: "4 the server writes a declaration only for an explicit bookable/quoted",
  why: "accept any truthy value. A stray `sale: true` from a future caller then writes a declaration " +
       "that offerType cannot read, and `offerType` refuses an unreadable declaration as \"unknown\" — so " +
       "the service would resolve to unknown and a booking flow cannot act on unknown. Refusing at the " +
       "writer is what keeps that out of the record.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: '  if (declaredSale === "bookable" || declaredSale === "quoted") {',
  with: "  if (declaredSale) {",
});
const reg = readFileSync(join(ROOT, REG), "utf8");
const guarded = /if \(declaredSale === "bookable" \|\| declaredSale === "quoted"\) \{/.test(reg);
const writesOffer = /offer: \{ \.\.\.priorOffer, sale: declaredSale \}/.test(reg);
const reportsNoEntry = /status: "no_catalogue_entry"/.test(reg);
const notGatedOnFormat = reg.indexOf("const declaredSale") < reg.indexOf('if (placement.status === "not_freeform")');
leg("RULE", "4 the server writes a declaration only for an explicit bookable/quoted",
  guarded && writesOffer && reportsNoEntry && notGatedOnFormat,
  `the handler is guarded on the two real values (${guarded}), merges into the PRIOR offer rather than ` +
  `replacing it (${writesOffer}), REPORTS rather than invents when there is no catalogue entry to ` +
  `declare on (${reportsNoEntry}), and is not gated on page format (${notGatedOnFormat}) — sale changes ` +
  `what the BOOKING FLOW does, and that reads the catalogue on both formats. SCOPED: read off the ` +
  `deployed source, because a live catalogue write needs an owner session.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
