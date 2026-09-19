#!/usr/bin/env node
/**
 * THE CONTEXTUAL TOP EDITOR SHOWS THE RECORD, WRITES THROUGH THE ONE WRITER, AND SAYS SO.
 *
 *   node scripts/check-the-top-editor-is-the-record.mjs
 *
 * ══ WHAT THIS IS FOR ═════════════════════════════════════════════════════════════════════════
 *
 * Clicking a service card on the canvas opens its REAL fields above the page. Four different
 * ways that can quietly stop being true, each with a leg:
 *
 *   · the canvas stops naming the card (the stamps move, or the walk climbs into the grid)
 *   · the parent stops CARRYING what the canvas named — the field-by-field rebuild of
 *     hc.selection drops a key and every reader gets `undefined` (L104, and it happened here
 *     on the first run: the band opened saying "Text" over a service card)
 *   · the band renders something other than the record — blanks, defaults, or our own
 *     un-read bookkeeping shown as his missing data (Lesson 86)
 *   · a save stops going through hcRecordEdit, or stops being CONFIRMED on screen
 *
 * ══ WHY THE FIXTURE IS THE REAL CARD MARKUP ══════════════════════════════════════════════════
 *
 * The card HTML in leg 1 is copied byte-for-byte out of evergreen-yard-care's stored document
 * (business_documents, latest version, 2026-09-19). A fixture I invented would be a fixture
 * that agrees with my reader by construction — the anchor count was wrong by 3x the last time
 * a shape was assumed rather than read.
 *
 * SCOPED, and this is the honest half: every leg drives the REAL shipping code in
 * public/hubly.html and public/platform-home.html through a real DOM, but the SAVE is observed
 * at the fetch seam — the payload the product would send — not against a live database. A real
 * write needs an owner session this environment cannot create. So these legs settle "the right
 * call is made with the right values"; they do not settle "the row changed".
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* The real card, out of the stored document. */
const CARD = `<section data-hc-section="hero"><div class="cards">
  <h1 data-hc="hero.headline" style="font-weight:400;font-size:48px">Best Lawn Mowing alive</h1>
  <article class="card"><div class="card-body">
    <h2 data-hc="hero.item.2.title" data-hubly-service="Full Service" style="font-weight:700;font-size:28px;color:rgb(15,81,50)">Full Service</h2>
    <div class="price"><strong><span data-hc="hero.item.2.body" data-hubly-price="Full Service">$95</span></strong><span data-hc="hero.item.2.body.2">per visit</span></div>
    <p data-hc="hero.item.2.body.3" data-hubly-desc="Full Service">Mowing plus trimming, fertilizing, and weed control.</p>
  </div></article>
  <article class="card"><div class="card-body">
    <h2 data-hc="hero.item.3.title" data-hubly-service="Basic Mow">Basic Mow</h2>
    <span data-hc="hero.item.3.body" data-hubly-price="Basic Mow">$40</span>
  </div></article></div></section>`;

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };

const srv = await servePublic(ROOT);
let rig, canvas = null, parent = null;
try { rig = await openRig({ width: 1440, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

try {
  /* ── THE CANVAS HALF ──────────────────────────────────────────────────────────────────── */
  await rig.load(srv.url("hubly.html") + "?hcEditable=1");
  canvas = await rig.page.evaluate(async (cardHtml) => {
    // hcAuthedFlag is the CLICK gate (hcEditable=1 only ungates marking) — without it every
    // click below is swallowed and every leg would be vacuously green on zero selections.
    try { hcAuthedFlag = true; } catch (e) { return { why: "hcAuthedFlag not reachable" }; }
    const sent = [];
    window.parent.postMessage = (m) => { sent.push(m); };
    const host = document.createElement("div");
    host.innerHTML = cardHtml;
    document.body.appendChild(host);
    if (!window.hublyEditSurfaceUI) return { why: "no hublyEditSurfaceUI seam" };
    window.hublyEditSurfaceUI.wire(document, host);
    const click = (el) => { sent.length = 0;
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 }));
      return sent.find((m) => m && m.type === "hcSelection") || null; };
    const R = {};
    R.name  = click(host.querySelector('[data-hubly-service="Full Service"]'));
    R.price = click(host.querySelector('[data-hubly-price="Full Service"]'));
    R.desc  = click(host.querySelector('[data-hubly-desc="Full Service"]'));
    R.two   = click(host.querySelector('[data-hubly-service="Basic Mow"]'));
    // THE GRID IS NOT SELECTABLE BY CLICK — the handler needs a [data-hc]/[data-node]
    // ancestor and refuses non-leaf nodes, so a click here reports a CLEAR no matter what
    // the card reader does, and asserting on it proved nothing (the red-proof caught this
    // leg passing while its break was unreachable). Ask the reader directly: does the walk
    // stop when it reaches a container holding two cards?
    R.gridCard = (function(){
      try { return window.__hcTestServiceCardOf ? window.__hcTestServiceCardOf(host.querySelector(".cards")) : "no seam"; }
      catch (e) { return "threw: " + e.message; }
    })();
    R.grid  = click(host.querySelector(".cards"));
    // Previous/Next, and what they say at the end of the list.
    const step = (dir) => { sent.length = 0;
      window.dispatchEvent(new MessageEvent("message", { source: window.parent, data: { type: "hcCtxStep", dir } }));
      return { done: sent.find((m) => m.type === "hcCtxStepDone"), sel: sent.find((m) => m.type === "hcSelection") }; };
    const order = [];
    let guard = 0, r = step("next");
    while (r.done && r.done.moved && guard++ < 20) { order.push(r.sel ? r.sel.label : null); r = step("next"); }
    R.order = order;
    R.endSaysSo = !!(r.done && r.done.moved === false);

    // ══ THE COMMAND PATH — DOES IT PAINT, OR ONLY SAVE? ═══════════════════════════════════
    // This is the leg for the defect Adrian found on the live site: every control saved and
    // nothing on the page moved.
    const h1 = host.querySelector('[data-hc="hero.headline"]');
    sent.length = 0;
    h1.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 }));
    R.barAfterSelect = !!document.querySelector('div.hc-ctx[data-hc-editor="1"]');
    const run = (cmd) => { sent.length = 0;
      window.dispatchEvent(new MessageEvent("message", { source: window.parent, data: { type: "hcCtxCommand", id: "t", cmd } }));
      return { done: sent.find((m) => m.type === "hcCtxCommandDone"), sent: sent.slice() }; };
    const weightBefore = getComputedStyle(h1).fontWeight;
    const b = run({ op: "style", style: { "font-weight": "700" } });
    R.paint = { before: weightBefore, afterComputed: getComputedStyle(h1).fontWeight,
                alsoSent: b.sent.some((m) => m.type === "hcFreeformStyleEdit"),
                reported: b.done?.result?.style?.fontWeight };
    // Every one of the other controls, painted.
    const f = run({ op: "style", style: { "font-family": "slab" } });
    R.fontStack = { inline: h1.style.fontFamily, reported: f.done?.result?.style?.fontFamily };
    R.painted = {};
    for (const [cmd, read] of [
      [{ op:"style", style:{ "font-style":"italic" } },      () => h1.style.fontStyle],
      [{ op:"style", style:{ "text-decoration":"underline" } }, () => h1.style.textDecoration],
      [{ op:"style", style:{ "font-size":"64px" } },         () => h1.style.fontSize],
      [{ op:"style", style:{ "text-align":"center" } },      () => h1.style.textAlign],
      [{ op:"style", style:{ "letter-spacing":"0.06em" } },  () => h1.style.letterSpacing],
      [{ op:"style", style:{ "text-transform":"uppercase" } },() => h1.style.textTransform],
      [{ op:"style", style:{ "color":"#123456" } },          () => h1.style.color],
    ]) { run(cmd); R.painted[Object.keys(cmd.style)[0]] = read(); }

    // ── TEXT from the top runs the page's own commit, price branch included ──
    const t = run({ op: "text", text: "Denver lawns, done right" });
    R.topText = { onPage: h1.textContent, ok: t.done?.result?.ok,
                  payload: t.sent.find((m) => m.type === "hcFreeformInlineEdit") || null };
    const price = host.querySelector("[data-hubly-price]");
    price.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 5, clientY: 5 }));
    const pr = run({ op: "text", text: "120" });
    R.topPrice = { kind: pr.done?.result?.kind, toRecord: pr.sent.some((m) => m.type === "hcFreeformPriceEdit"),
                   asText: pr.sent.some((m) => m.type === "hcFreeformInlineEdit") };
    const bad = run({ op: "text", text: "call us" });
    R.topBadPrice = { ok: bad.done?.result?.ok, why: bad.done?.result?.why, restored: price.textContent };
    const mv = run({ op: "move", dir: "up" });
    R.refusalNamed = { ok: mv.done?.result?.ok, why: mv.done?.result?.why };
    return R;
  }, CARD);
  if (canvas && canvas.why) { console.error("CANNOT RUN — " + canvas.why); await rig.close(); srv.close(); process.exit(2); }

  /* ── THE PARENT HALF ──────────────────────────────────────────────────────────────────── */
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "o@e.test", displayName: "Adrian",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [
      { name: "Full Service", price: 95, description: "Mowing plus trimming, fertilizing, and weed control.",
        show_price: true, source: "both", conflicts: false }] },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  parent = await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    window.hublyNavUI.openWorkspace("website");
    await new Promise((r) => setTimeout(r, 900));
    const R = {};
    const band = document.getElementById("hcCtx");
    if (!band) return { why: "the contextual band is not in the DOM" };
    R.hiddenAtRest = band.hidden === true;
    R.toolbar = [...document.querySelectorAll(".hc-canvas-url button")].map((b) => b.textContent.trim());
    const posts = [];
    const realFetch = window.fetch;
    window.fetch = function (u, o) {
      try { if (String(u).includes("hubly-conversation") && o && o.body) posts.push(JSON.parse(o.body)); } catch (e) {}
      return realFetch.apply(this, arguments);
    };
    const SEL = { type: "hcSelection", label: "hero.item.2.title", on: "element", kind: "text",
      name: "Full Service heading", text: "Full Service",
      style: { fontFamily: null, fontSize: 28, fontWeight: "700", italic: false, underline: false,
               color: "#0f5132", align: null, transform: "none", letterSpacing: "normal" },
      card: { service: "Full Service", field: "name" },
      node: { anchor: "hero.item.2.title", anchorKind: "label", steps: [], fp: "h2|0||" } };
    const say = (d) => window.dispatchEvent(new MessageEvent("message", { origin: new URL(biz.url).origin, data: d }));

    // ── UNREAD IS NOT EMPTY. Before any read, the band must not claim the record lacks him.
    //
    // SAMPLED SYNCHRONOUSLY, WITH THE UNREAD STATE FORCED. The first draft slept 40ms and read
    // the fields instead — the fake answers fast enough that the read had already landed, so
    // the leg was measuring MY timing, not the product, and it failed while the product was
    // right. Forcing `read=false` reproduces the state a real owner is in on their first click
    // (nothing reads the record on workspace open — only the Services panel does), and
    // dispatchEvent is synchronous, so this observes the very first paint with no race.
    // hcManage is closure-scoped and cannot be forced from here — tried, and it is right that
    // it cannot be. It does not need forcing: nothing reads the record on workspace open (only
    // the Services panel does), so THIS first selection is genuinely the un-read state, and the
    // leg asserts the fields are absent from that paint so it cannot pass on an already-read one.
    say(SEL);
    R.beforeRead = document.getElementById("hcCtxBody")?.textContent ?? null;
    R.beforeReadHadFields = !!document.getElementById("hcCtxSvcName");

    await new Promise((r) => setTimeout(r, 1600));
    R.opened = !band.hidden;
    R.what = document.getElementById("hcCtxWhat")?.textContent ?? null;
    R.fields = { name: document.getElementById("hcCtxSvcName")?.value,
                 price: document.getElementById("hcCtxSvcPrice")?.value,
                 desc: document.getElementById("hcCtxSvcDesc")?.value,
                 sale: document.getElementById("hcCtxSvcSale")?.value };
    R.fmt = { bold: document.getElementById("hcCtxB")?.classList.contains("is-on"),
              size: document.getElementById("hcCtxSize")?.value,
              colour: document.getElementById("hcCtxColour")?.value };

    // ── A SAVE goes through the one writer, with prevName and a parsed price.
    const nmEl = document.getElementById("hcCtxSvcName");
    const prEl = document.getElementById("hcCtxSvcPrice");
    const svEl = document.getElementById("hcCtxSvcSave");
    if (nmEl) nmEl.value = "Premium Lawn Service";
    if (prEl) prEl.value = "$120.50";
    if (svEl) svEl.click();
    await new Promise((r) => setTimeout(r, 1500));
    R.saved = posts.filter((p) => p.directRecordEdit).map((p) => p.directRecordEdit);
    R.savedSays = document.getElementById("hcCtxStatus")?.textContent ?? null;
    R.savedOk = (document.getElementById("hcCtxStatus")?.className || "").includes("is-ok");

    // ── AN UNREADABLE PRICE writes nothing and says why. Re-select first, or the fields are
    //    gone (the fixture still holds the old name) and the leg would be vacuous.
    say({ ...SEL, card: { service: "Full Service", field: "price" } });
    await new Promise((r) => setTimeout(r, 900));
    R.badLegReal = !!document.getElementById("hcCtxSvcSave");
    posts.length = 0;
    if (document.getElementById("hcCtxSvcPrice") && document.getElementById("hcCtxSvcSave")) {
      document.getElementById("hcCtxSvcPrice").value = "call us";
      document.getElementById("hcCtxSvcSave").click();
      await new Promise((r) => setTimeout(r, 800));
    }
    R.badWrote = posts.filter((p) => p.directRecordEdit).length;
    R.badSays = document.getElementById("hcCtxStatus")?.textContent ?? null;

    // ── STYLE goes through the SAME writer the floating bar uses.
    posts.length = 0;
    document.getElementById("hcCtxB")?.click();
    await new Promise((r) => setTimeout(r, 900));
    R.style = posts.filter((p) => p.styleEdit).map((p) => p.styleEdit);

    // ══ THE DEBOUNCE, MEASURED AT THE FRAME BOUNDARY ═══════════════════════════════════════
    // The canvas is cross-origin here, so its real contentWindow is unreachable — replacing the
    // getter on the ELEMENT makes the parent's own postMessage land in this counter. That is
    // the right place to measure: the debounce is parent-side.
    const sentToCanvas = [];
    const fakeWin = { postMessage: (m) => {
      if (m && m.type === "hcCtxCommand") sentToCanvas.push({ paintOnly: !!m.paintOnly, op: m.cmd && m.cmd.op }); } };
    for (const id of ["hcCanvasFrameA", "hcCanvasFrameB"]) {
      const f = document.getElementById(id); if (!f) continue;
      Object.defineProperty(f, "contentWindow", { configurable: true, get(){ return fakeWin; } });
    }
    say({ ...SEL, card: null });
    await new Promise((r) => setTimeout(r, 700));
    const pick = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); };

    sentToCanvas.length = 0;
    for (const v of ["20", "24", "28", "32", "40", "48"]) { pick("hcCtxSize", v); await new Promise((r) => setTimeout(r, 80)); }
    await new Promise((r) => setTimeout(r, 1800));
    R.debounce = { changes: 6, paints: sentToCanvas.filter((x) => x.paintOnly).length,
                   saves: sentToCanvas.filter((x) => !x.paintOnly).length };

    sentToCanvas.length = 0;
    pick("hcCtxSize", "56"); await new Promise((r) => setTimeout(r, 80));
    const cc = document.getElementById("hcCtxColour"); cc.value = "#111111"; cc.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1800));
    R.merge = { changes: 2, paints: sentToCanvas.filter((x) => x.paintOnly).length,
                saves: sentToCanvas.filter((x) => !x.paintOnly).length };

    sentToCanvas.length = 0;
    pick("hcCtxSize", "40"); await new Promise((r) => setTimeout(r, 1400));
    pick("hcCtxSize", "64"); await new Promise((r) => setTimeout(r, 1400));
    R.spaced = { changes: 2, saves: sentToCanvas.filter((x) => !x.paintOnly).length };
    return R;
  }, { biz: BIZ });
  if (parent && parent.why) { console.error("CANNOT RUN — " + parent.why); await rig.close(); srv.close(); process.exit(2); }
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

/* ══ LEGS ═══════════════════════════════════════════════════════════════════════════════════ */

declareBreak({
  leg: "1 the canvas names the card, and the field inside it",
  why: "stop reading the price stamp, so hcServiceFieldOf answers 'name' for a click on the price. The " +
       "top editor then opens with the caret in the wrong box every time an owner clicks a price — the " +
       "card is still named correctly, so legs 2 and 4 stay green and only this one moves.",
  file: "public/hubly.html",
  find: "    if(el.getAttribute('data-hubly-price')) return 'price';",
  with: "",
});
leg("RULE", "1 the canvas names the card, and the field inside it, off the stamps",
  !!(canvas.name?.card?.service === "Full Service" && canvas.name.card.field === "name" &&
     canvas.price?.card?.field === "price" && canvas.desc?.card?.field === "description" &&
     canvas.two?.card?.service === "Basic Mow"),
  `name→${JSON.stringify(canvas.name?.card)}, price→${JSON.stringify(canvas.price?.card)}, ` +
  `desc→${JSON.stringify(canvas.desc?.card)}, second card→${JSON.stringify(canvas.two?.card)}. ` +
  `Driven against the real stored markup, so the second card resolving to itself is the assertion ` +
  `that matters — a walk that climbs too far reports every card as the first one.`);

declareBreak({
  leg: "2 the grid holding two cards is not a card",
  why: "remove the multi-stamp stop, so a container holding two cards resolves to the FIRST of them. " +
       "Selecting the grid then opens Full Service's editor over a element that is not a service — and " +
       "a click anywhere in the section would silently edit the first card's record.",
  file: "public/hubly.html",
  find: "      if(names.length > 1) return null;                     // climbed past the card",
  with: "      if(names.length > 1){ var f = names[0].getAttribute('data-hubly-service') || ''; return f ? { name: f, card: a } : null; }",
});
leg("RULE", "2 the grid holding two cards is not a card",
  canvas.gridCard === null,
  `asked the card reader directly about the .cards container: ${JSON.stringify(canvas.gridCard)}. ` +
  `A container holding two services is not one service, and resolving it to the first would put the ` +
  `WRONG ROW behind every field. Asked directly and not through a click, because a click on the grid ` +
  `is refused by the leaf-only rule before the reader is ever consulted — which is how the first ` +
  `version of this leg passed with its break unreachable.`);

declareBreak({
  leg: "3 Next walks in document order and the end of the list says so",
  why: "let the index run past the end instead of refusing. Next then reports moved:true forever while " +
       "selecting nothing, and the parent's 'that is the last thing' sentence never fires — a button " +
       "that looks like it worked and did nothing.",
  file: "public/hubly.html",
  find: "      if(n < 0 || n >= list.length) return false;     // AT THE END IS A REAL ANSWER",
  with: "      if(n < 0) return false;\n      if(n >= list.length) return true;",
});
leg("RULE", "3 Next walks in document order and the end of the list says so",
  canvas.order.length >= 5 && canvas.order[0] === "hero.headline" &&
  canvas.order[canvas.order.length - 1] === "hero.item.3.body" && canvas.endSaysSo === true,
  `walked ${JSON.stringify(canvas.order)} then answered moved=false (${canvas.endSaysSo}). Document ` +
  `order is the order the owner's eye follows; "there is nothing after this" is a real outcome and is ` +
  `reported rather than swallowed.`);

declareBreak({
  leg: "4 the parent CARRIES the card the canvas named",
  why: "title a carried service card 'Text'. The owner is then editing a service's real fields under a " +
       "heading that says they are editing a paragraph — the band describing itself wrongly. NARROWED: " +
       "the obvious break (dropping `card` from the rebuild, which is the bug this leg was written for) " +
       "starves SEVEN legs at once and proves nothing about any of them. That defect is caught here by " +
       "the title and by leg 5, whose fields cannot render from a card that was never carried.",
  file: "public/platform-home.html",
  find: "    if(what) what.textContent = isCard ? 'Service Card'",
  with: "    if(what) what.textContent = isCard ? 'Text'",
});
leg("RULE", "4 the parent CARRIES the card the canvas named, into a Service Card editor",
  parent.opened === true && parent.what === "Service Card",
  `the band opened (${parent.opened}) titled ${JSON.stringify(parent.what)}. This is the leg that was ` +
  `RED on the first real run — the handler rebuilds hc.selection key by key and did not copy \`card\`, ` +
  `so the service branch was unreachable while every part of it was correct.`);

declareBreak({
  leg: "5 the fields hold the record's values, not placeholders",
  why: "blank the DESCRIPTION the row carries, leaving name and price alone. The band then shows an " +
       "empty box over a service that HAS a description — and an empty box invites the owner to fill in " +
       "what the record already holds. Aimed away from name/price on purpose: the save legs type their " +
       "own values into those two, so blanking them would starve leg 7 as well and prove nothing about " +
       "either — which is exactly the COMPOUND this break scored on its first run.",
  file: "public/platform-home.html",
  find: "'<textarea class=\"hc-ctx-in\" id=\"hcCtxSvcDesc\" rows=\"2\" placeholder=\"What this includes\">' + hcEsc(row.description || '') + '</textarea>') +",
  with: "'<textarea class=\"hc-ctx-in\" id=\"hcCtxSvcDesc\" rows=\"2\" placeholder=\"What this includes\"></textarea>') +",
});
leg("RULE", "5 the fields hold the record's values, not placeholders",
  parent.fields.name === "Full Service" && parent.fields.price === "95" &&
  /Mowing plus trimming/.test(parent.fields.desc || ""),
  `name=${JSON.stringify(parent.fields.name)} price=${JSON.stringify(parent.fields.price)} ` +
  `desc=${JSON.stringify((parent.fields.desc || "").slice(0, 34))}. Read through get_business_services ` +
  `(the union reader, both stores) — the same call the Services panel uses, so the two surfaces cannot ` +
  `show different values for one service.`);

declareBreak({
  leg: "6 an un-read record is not reported as a missing service",
  why: "say 'no service by that name' while the read is still in flight. The owner is told his page " +
       "shows a service his record does not have, before anything has looked — our bookkeeping reported " +
       "as his missing data, which is Lesson 86 exactly and has reached a paying customer once. " +
       "NARROWED to the copy: removing the un-read BRANCH turns six legs red together, because every " +
       "later leg needs the fields that branch is protecting.",
  file: "public/platform-home.html",
  find: "      body.innerHTML = '<div class=\"hc-ctx-note\">Reading your services…</div>';",
  with: "      body.innerHTML = '<div class=\"hc-ctx-note\">there is no service by that name</div>';",
});
leg("RULE", "6 an un-read record is not reported as a missing service",
  parent.beforeReadHadFields === false &&
  /Reading your services/.test(parent.beforeRead || "") && !/no service by that name/.test(parent.beforeRead || ""),
  `the band's first paint said ${JSON.stringify((parent.beforeRead || "").slice(0, 46))} and rendered ` +
  `no fields (${parent.beforeReadHadFields === false}) — so this is the genuine un-read state and not ` +
  `an already-answered one. ` +
  `"We have not looked yet" and "he has none" are opposite sentences and \`services: []\` cannot tell ` +
  `them apart, which is why the read carries its own flag.`);

declareBreak({
  leg: "7 a save goes through hcRecordEdit",
  why: "drop prevName from the edit. The writer is then handed the NEW name with no way to match the " +
       "old one, so a rename either fails to find the row or writes a second one. NARROWED on purpose: " +
       "the obvious break (sending the raw string where the parsed number belongs) also turns leg 9 red, " +
       "because both legs lean on the one parser call — prevName is this leg's own clause.",
  file: "public/platform-home.html",
  find: "      var payload = { kind:'service', op:'edit', id: null, prevName: prevName, name: nm,",
  with: "      var payload = { kind:'service', op:'edit', id: null, name: nm,",
});
leg("RULE", "7 a save goes through hcRecordEdit with prevName and a parsed price",
  parent.saved.length === 1 && parent.saved[0].kind === "service" && parent.saved[0].op === "edit" &&
  parent.saved[0].prevName === "Full Service" && parent.saved[0].name === "Premium Lawn Service" &&
  parent.saved[0].price === 120.5,
  `one edit was sent: ${JSON.stringify(parent.saved[0] || null)}. prevName is what lets the writer find ` +
  `the row through a rename, and the price is a NUMBER through the one parser (window.HUBLY_PRICE) — ` +
  `the same reader the canvas's inline price edit uses.`);

declareBreak({
  leg: "8 a blank sale stays blank",
  why: "send the select's value unconditionally. An untouched control then writes sale='' or a default " +
       "onto a service nobody declared — a fact the owner never stated, published to a page a customer " +
       "reads. This is the leg that can pass vacuously, so it is asserted on a fixture whose service IS " +
       "undeclared and whose save DID happen (leg 7 proves the save happened).",
  file: "public/platform-home.html",
  find: "      if(saleVal === 'bookable' || saleVal === 'quoted') payload.sale = saleVal;",
  with: "      payload.sale = saleVal;",
});
leg("RULE", "8 a blank sale stays blank — an untouched control writes nothing",
  parent.saved.length === 1 && !Object.prototype.hasOwnProperty.call(parent.saved[0] || {}, "sale") &&
  parent.fields.sale === "",
  `the control read ${JSON.stringify(parent.fields.sale)} and the edit carried the \`sale\` key: ` +
  `${Object.prototype.hasOwnProperty.call(parent.saved[0] || {}, "sale")}. NOT VACUOUS: the fixture's ` +
  `service is undeclared (sale reads ""), and leg 7 establishes that a real save went out in the same ` +
  `click — so the absent key is a writer that declined, not a save that never happened.`);

declareBreak({
  leg: "9 an unreadable price writes nothing",
  why: "save it anyway when the parser returns null. The record then takes a null price from a typed " +
       "\"call us\" and the owner is told it saved — a value nobody stated, reported as stored.",
  file: "public/platform-home.html",
  find: "        if(priceEdit === null){\n          hcCtxSay('I couldn’t read \"' + raw.slice(0, 18) + '\" as a price — try a number like 95 or 95.50. Nothing saved.', false);\n          return;\n        }",
  with: "        if(priceEdit === null){ hcCtxSay('', true); }",
});
leg("RULE", "9 an unreadable price writes nothing and says why, in words",
  parent.badLegReal === true && parent.badWrote === 0 && /could|couldn/.test(parent.badSays || "") &&
  /call us/.test(parent.badSays || ""),
  `the Save control existed for this leg (${parent.badLegReal}) — without re-selecting, the band shows ` +
  `the "not in your record" note and there is nothing to click, which is how the first draft of this ` +
  `leg passed on zero attempts. It wrote ${parent.badWrote} edits and said ` +
  `${JSON.stringify((parent.badSays || "").slice(0, 60))}.`);

declareBreak({
  leg: "10 a save that landed is confirmed on screen",
  why: "say it BEFORE the re-render, which is where it was. hcRenderCtx clears the status line, so the " +
       "confirmation is wiped a moment later by the very refresh that proves the save worked — the " +
       "owner changes a price, the record changes, and nothing says so. Found by measurement, not by " +
       "reading: the drive returned statusAfterSave:\"\" with the row correctly written.",
  file: "public/platform-home.html",
  find: "        hcCtxSaved('Saved');\n        try{ if(document.getElementById('hcMngOv')) hcRenderManageBody(); }catch(e){}",
  with: "        try{ if(document.getElementById('hcMngOv')) hcRenderManageBody(); }catch(e){}",
});
leg("RULE", "10 a save that landed is confirmed on screen (prohibition 6)",
  parent.savedSays === "Saved" && parent.savedOk === true,
  `after the save the status line read ${JSON.stringify(parent.savedSays)} (ok-styled: ${parent.savedOk}). ` +
  `An operation that works, changes the record and says nothing is indistinguishable from one that ` +
  `failed — and is treated here as a defect of equal severity.`);

declareBreak({
  leg: "11 the formatting row reports the element's real state",
  why: "ignore the carried style and render the row from an empty object. Every toggle then opens on a " +
       "default — an un-bolded B over bold text, an empty size box over a 28px heading — and the owner's " +
       "first click SETS what the control appeared to be reporting (prohibition 2). Aimed at the PARENT: " +
       "the canvas-side break (style:null in hcPostSelection) was NOT RED and could not be otherwise, " +
       "because this probe writes the selection payload by hand and never runs the canvas's snapshot.",
  file: "public/platform-home.html",
  find: "    var st = sel.style || {};",
  with: "    var st = {};",
});
leg("RULE", "11 the formatting row reports the element's real state, not defaults",
  parent.fmt.bold === true && parent.fmt.size === "28" && parent.fmt.colour === "#0f5132",
  `bold=${parent.fmt.bold} size=${JSON.stringify(parent.fmt.size)} colour=${JSON.stringify(parent.fmt.colour)}, ` +
  `against an element whose computed style is 700/28px/#0f5132. Computed, not inline: text styled by ` +
  `the page's own stylesheet has no style attribute, and reading the attribute would report "not set" ` +
  `for text that is plainly bold on screen.`);

declareBreak({
  leg: "12 a style command PAINTS the element",
  why: "send without painting — which is exactly what shipped on 2026-09-19 and what Adrian hit in the " +
       "live editor. The save LANDS (evergreen's document went to font-weight:700 and the live page " +
       "computes 700) and the canvas never moves, because hcStyleEdit does not reload on success: it " +
       "was written for a caller that had already painted. Every control then says \"Saved\" over an " +
       "unchanged page, which reads as a dead control and is a SILENT SUCCESS.",
  file: "public/hubly.html",
  find: "          el.style.setProperty(prop, v);   // setProperty handles --custom too",
  with: "",
});
const P = canvas.painted || {};
leg("RULE", "12 a style command PAINTS the element — every control, font as a real stack",
  canvas.paint.before === "400" && canvas.paint.afterComputed === "700" && canvas.paint.reported === "700" &&
  P["font-style"] === "italic" && /underline/.test(P["text-decoration"] || "") && P["font-size"] === "64px" &&
  P["text-align"] === "center" && P["letter-spacing"] === "0.06em" && P["text-transform"] === "uppercase" &&
  /18, 52, 86|#123456/.test(P["color"] || "") && /Rockwell/i.test(canvas.fontStack.inline || ""),
  `computed weight ${canvas.paint.before} -> ${canvas.paint.afterComputed}; painted ${JSON.stringify(P)}; ` +
  `font-family:"slab" became ${JSON.stringify((canvas.fontStack.inline || "").slice(0, 32))}. ` +
  `THIS IS THE LEG FOR THE BUG THAT SHIPPED — the first version sent without painting, so it saved ` +
  `correctly and showed nothing. ENUMERATED, not sampled: "colour works, the others don't" is how the ` +
  `bug was actually reported, and a fix that painted only bold would satisfy a leg testing only bold. ` +
  `MERGED from three legs on purpose — paint-exists, paint-every-property and paint-the-font-stack are ` +
  `one loop, and a break in it turned all three red together, which proves nothing about any of them (L98).`);

/* ── LEG 12b — and the change still reaches the one writer ───────────────────────────────── */
declareBreak({
  leg: "12b the style still reaches the one writer",
  why: "paint and do not send. The page then changes under the owner's hand and the record does not, so " +
       "it looks right until a reload silently takes it away — the mirror image of the shipped bug, and " +
       "the reason both halves are asserted separately instead of as one \"it works\".",
  file: "public/hubly.html",
  find: "  function hcSendStyle(label, on, style){\n    post({ type:'hcFreeformStyleEdit', label: label, on: on, style: style });\n  }",
  with: "  function hcSendStyle(label, on, style){}",
});
const ph = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
// The controls route through the DEBOUNCE, which hands the same command to the same canvas
// path — the shape changed when persistence was debounced (2026-09-19), the route did not.
const topCallsCommand = /function send\(style\)\{ hcCtxCommandDebounced\(\{ op:'style', style: style \}\); \}/.test(ph)
  && /hcCtxFlushPending\(\);?\s*\n?\s*\}/.test(ph) && /function hcCtxSend\(cmd, opts\)\{/.test(ph);
const noDirectStyleWrite = !/hcCtxSendStyle/.test(ph);
leg("RULE", "12b the style still reaches the one writer — through the canvas, not around it",
  canvas.paint.alsoSent === true && topCallsCommand && noDirectStyleWrite,
  `the command sent hcFreeformStyleEdit (${canvas.paint.alsoSent}); the top editor's controls call ` +
  `hcCtxCommand (${topCallsCommand}) and the old direct-to-hcStyleEdit helper is gone ` +
  `(${noDirectStyleWrite}). The writer is unchanged — hcSendStyle -> hcFreeformStyleEdit -> hcStyleEdit, ` +
  `the path the black toolbar always used. What was removed is the top editor's SECOND way in.`);

/* ── LEG 12e — the black toolbar is gone, and its commands are not ──────────────────────── */
declareBreak({
  leg: "12e the black floating toolbar is gone",
  why: "build the bar again on selection. Two manual editing surfaces then sit on one page, which is " +
       "what Adrian reported. [SHAPE]-adjacent but asserted as a RULE: the rule is one editing system, " +
       "and the bar's return would break it however it looked.",
  file: "public/hubly.html",
  find: "    hcPostSelectionStyle(el);",
  with: "    hcBuildBar(el, kind); hcPostSelectionStyle(el);",
});
const hb = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const commandsKept = /function hcStepScale/.test(hb) && /function hcSendNodeMove/.test(hb) &&
                     /function hcCommitTextChange/.test(hb) && /hcCtxRunCommand/.test(hb);
leg("RULE", "12e the black floating toolbar is gone, and its commands are not",
  canvas.barAfterSelect === false && commandsKept,
  `after selecting an element, div.hc-ctx[data-hc-editor] in the canvas: ${canvas.barAfterSelect}. The ` +
  `commands it wrapped are all still the only implementation (${commandsKept}) — hcStepScale, ` +
  `hcSendNodeMove, hcCommitTextChange, hcCtxRunCommand. The PRESENTATION layer was removed; nothing ` +
  `it did was lost, and the top editor calls the same functions its buttons called.`);

/* ── LEG 12f — the words are editable from the top, through the page's own commit ───────── */
declareBreak({
  leg: "12f text typed at the top reaches the page",
  why: "drop the text op. The field then accepts typing, says nothing, and changes neither the page nor " +
       "the record — the instructional note it replaced was at least honest about where to type.",
  file: "public/hubly.html",
  find: "    post({ type:'hcFreeformInlineEdit', op:'update_text', label: el.getAttribute('data-hc'),\n           text: now.trim(), prevText: before });",
  with: "",
});
leg("RULE", "12f text typed at the top reaches the page through the page's OWN commit",
  canvas.topText.ok === true && canvas.topText.onPage === "Denver lawns, done right" &&
  canvas.topText.payload && canvas.topText.payload.label === "hero.headline" &&
  canvas.topText.payload.prevText === "Best Lawn Mowing alive",
  `the element now reads ${JSON.stringify(canvas.topText.onPage)} and the edit went out as ` +
  `${JSON.stringify(canvas.topText.payload)}. Same hcCommitTextChange the inline blur handler calls — ` +
  `one text path with two entry points, not a second editing engine.`);

/* ── LEG 12g — and the price branch survives the new entry point ────────────────────────── */
declareBreak({
  leg: "12g a price typed at the top goes to the RECORD",
  why: "strip the price branch out of the shared commit, so a price typed anywhere becomes a TEXT patch. " +
       "The page then shows a number the services row does not have — the evergreen divergence exactly " +
       "(record 95/220/40, page 111.222.333/$111,222,333/50), arriving through the new field.",
  file: "public/hubly.html",
  find: "    var priceKey = el.getAttribute && el.getAttribute('data-hubly-price');\n    if(priceKey){\n      var n = hcParsePrice(now);",
  with: "    var priceKey = null;\n    if(priceKey){\n      var n = hcParsePrice(now);",
});
leg("RULE", "12g a price typed at the top goes to the RECORD, and an unreadable one is refused",
  canvas.topPrice.kind === "price" && canvas.topPrice.toRecord === true && canvas.topPrice.asText === false &&
  canvas.topBadPrice.ok === false && canvas.topBadPrice.why === "bad_price" && canvas.topBadPrice.restored === "$120",
  `"120" went to the record (${canvas.topPrice.toRecord}) and NOT as a text patch ` +
  `(${canvas.topPrice.asText === false}); "call us" was refused (${canvas.topBadPrice.why}) and the ` +
  `displayed text put back to ${JSON.stringify(canvas.topBadPrice.restored)} — the page never shows a ` +
  `value that was not stored.`);

/* ── LEG 12h — a refused command says WHICH refusal ─────────────────────────────────────── */
declareBreak({
  leg: "12h a refused command names its reason",
  why: "answer a bare false. The band then falls back to one generic sentence for every refusal, and " +
       "\"there is nowhere for this to move\" becomes indistinguishable from \"I cannot style that\" — " +
       "which is the \"something went wrong\" this repo bans outright.",
  file: "public/hubly.html",
  find: "      if(!sibs.length) return { ok:false, why:'nowhere_to_go' };",
  with: "      if(!sibs.length) return { ok:false };",
});
leg("RULE", "12h a refused command names its reason, so the band can say which one",
  canvas.refusalNamed.ok === false && canvas.refusalNamed.why === "nowhere_to_go",
  `moving an element with no placeable siblings answered ${JSON.stringify(canvas.refusalNamed)}. Every ` +
  `refusal carries its own key and the band maps it to its own sentence (HC_CTX_WHY) — a control that ` +
  `declines must say why, or it is a control that did nothing.`);

/* ── LEG 13 — the vocabulary, read off the shipping file ─────────────────────────────────────── */
declareBreak({
  leg: "13 the three new properties are in the closed vocabulary",
  why: "remove text-decoration from STYLE_VOCAB. The Underline button then paints itself on and the " +
       "server rejects the declaration as all_rejected — a control the editor offers and the writer " +
       "refuses, which is the dead-control shape this whole surface was meant to remove.",
  file: "supabase/functions/_shared/hubly_freeform.ts",
  find: '  "text-decoration":  (v) => ["none", "underline"].includes(v.trim()) ? v.trim() : null,',
  with: "",
});
const vocab = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_freeform.ts"), "utf8");
const hasDecor = /"text-decoration":\s*\(v\)/.test(vocab);
const hasSpacing = /"letter-spacing":\s*\(v\)/.test(vocab);
const hasTransform = /"text-transform":\s*\(v\)/.test(vocab);
const stillClosed = !/"text-decoration":\s*\(v\)\s*=>\s*v\b/.test(vocab);
leg("RULE", "13 the three new properties are in the closed vocabulary, still closed",
  hasDecor && hasSpacing && hasTransform && stillClosed,
  `text-decoration=${hasDecor} letter-spacing=${hasSpacing} text-transform=${hasTransform}, each ` +
  `enumerating its accepted values rather than passing the string through (${stillClosed}). They join ` +
  `the same table, the same validateStyleDecls and the same inline-style merge — the vocabulary grew ` +
  `by three and nothing else moved.`);

/* ── LEG 14 — the approved toolbar ──────────────────────────────────────────────────────────── */
declareBreak({
  leg: "14 the toolbar is the approved set",
  why: "put the Design button back. The leg then sees a sixth control that the approved design removed — " +
       "this is a SHAPE leg, so it going red means the shape moved and the question is whether that was " +
       "intended, not that something is broken.",
  file: "public/platform-home.html",
  find: "      '</div>' +\n      // THE CONTEXTUAL EDITOR, IN FLOW",
  with: "      '<button type=\"button\" id=\"hcDesignBtn\">Design</button>' +\n      '</div>' +\n      // THE CONTEXTUAL EDITOR, IN FLOW",
});
const bar = (parent.toolbar || []).join(" | ");
leg("SHAPE", "14 the toolbar is the approved set — no Publish, no Design",
  !/Publish/i.test(bar) && !/Design/i.test(bar) && /Desktop/.test(bar) && /Mobile/.test(bar) &&
  /Undo/.test(bar) && /Visit site/.test(bar) && /Services, hours/.test(bar),
  `the canvas bar renders: ${bar}. [SHAPE] — this encodes an approved layout, so it legitimately goes ` +
  `red when the toolbar changes, and the fix is then to confirm the change was intended and update ` +
  `this leg, never to undo the change. Publish never existed in this editor; Design was removed.`);

/* ── LEG 15 — the band is not a permanent fixture ───────────────────────────────────────────── */
declareBreak({
  leg: "15 the band is absent until something is selected",
  why: "leave the band shown when there is no selection. An empty editing band then stands between the " +
       "toolbar and the page at all times, costing the owner canvas height for a surface with nothing " +
       "in it. Aimed at the RENDER, not the markup: dropping `hidden` from the initial HTML is masked a " +
       "moment later by hcRenderCtx setting it — correct of the product, and it made the markup break " +
       "NOT RED.",
  file: "public/platform-home.html",
  find: "      band.hidden = true;\n      if(body) body.innerHTML = '';",
  with: "      band.hidden = false;\n      if(body) body.innerHTML = '';",
});
leg("RULE", "15 the band is absent until something is selected",
  parent.hiddenAtRest === true,
  `with nothing selected the band's hidden flag is ${parent.hiddenAtRest}. It appears with a selection ` +
  `and leaves with it; it never covers the page and there is nothing to dismiss to see the site.`);

/* ── LEG 16 — the debounce ──────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "16 rapid changes coalesce into ONE save",
  why: "send on every change, which is what shipped before this round and what the measurement " +
       "found: five changes 700ms apart produced FIVE document versions, and the only reason a " +
       "fast burst produced fewer was accidental in-flight coalescing whose window was however " +
       "long the request happened to take. Dragging a colour picker is then a dozen versions.",
  file: "public/platform-home.html",
  find: "  var HC_CTX_DEBOUNCE_MS = 600;",
  with: "  var HC_CTX_DEBOUNCE_MS = 0;",
});
leg("RULE", "16 rapid changes coalesce into ONE save, and each still paints immediately",
  parent.debounce.changes === 6 && parent.debounce.paints === 6 && parent.debounce.saves === 1 &&
  parent.merge.saves === 1 && parent.merge.paints === 2 && parent.spaced.saves === 2,
  `six size steps 80ms apart: ${parent.debounce.paints} paints, ${parent.debounce.saves} save. ` +
  `A size and a colour in one burst: ${parent.merge.paints} paints, ${parent.merge.saves} save ` +
  `(merged per property). Two changes 1400ms apart: ${parent.spaced.saves} saves — the debounce ` +
  `COALESCES a burst, it does not swallow a later edit. The paint count matching the change count ` +
  `is the half that matters as much: persistence is debounced, feedback is not.`);

/* ── LEG 17 — a paint is not a save ──────────────────────────────────────────────────────── */
declareBreak({
  leg: "17 a paint-only pass writes nothing",
  why: "let the paint-only pass fall through to hcSendStyle. Every keystroke of a debounced burst " +
       "then writes after all — the debounce becomes decoration, and the page still churns a " +
       "document version per step while the code claims otherwise.",
  file: "public/hubly.html",
  find: "      if(cmd.paintOnly !== true) hcSendStyle(label, on, cmd.style);",
  with: "      hcSendStyle(label, on, cmd.style);",
});
const hb2 = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
const paintOnlySkipsWrite = /if\(cmd\.paintOnly !== true\) hcSendStyle\(label, on, cmd\.style\);/.test(hb2);
const paintOnlyAnswersNothing = /if\(d\.paintOnly === true\) return;/.test(hb2);
leg("RULE", "17 a paint-only pass writes nothing and confirms nothing",
  paintOnlySkipsWrite && paintOnlyAnswersNothing,
  `the paint pass skips the writer (${paintOnlySkipsWrite}) and sends no answer back ` +
  `(${paintOnlyAnswersNothing}). The second half matters on its own: a reply would make the band ` +
  `say "Saved" for a save that has not happened yet — an unearned checkmark introduced BY the ` +
  `debounce, which is exactly the defect a debounce is most likely to add.`);

/* ── LEG 18 — reload only when the page changed shape ────────────────────────────────────── */
declareBreak({
  leg: "18 a value-only service edit paints",
  why: "reload on every service save, which is what shipped and what threw the owner's selection " +
       "away mid-edit — measured live twice: the name saved and the editor vanished with them " +
       "still looking at the card.",
  file: "public/platform-home.html",
  find: "        var inPlace = (r.pageChange === 'in_place');",
  with: "        var inPlace = false;",
});
const phD = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
const readsVerdict = /var inPlace = \(r\.pageChange === 'in_place'\);/.test(phD);
const paintsWhenInPlace = /if\(inPlace\)\{\s*\n\s*hcCtxCommand\(\{ op:'serviceValues'/.test(phD);
const reloadsOtherwise = /\} else \{\s*\n\s*try\{ hcRefreshCanvasFrame\(\); \}catch\(e\)\{\}/.test(phD);
const reselectOnlyOnReload = /if\(!inPlace && hc\.selection && hc\.selection\.label\) hcCtxReselect/.test(phD);
leg("RULE", "18 a value-only service edit paints; a structural one re-reads",
  readsVerdict && paintsWhenInPlace && reloadsOtherwise && reselectOnlyOnReload,
  `the client reads the server's verdict (${readsVerdict}), paints the card's values when the page ` +
  `only changed value (${paintsWhenInPlace}), reloads otherwise (${reloadsOtherwise}), and only ` +
  `re-selects when the frame was actually replaced (${reselectOnlyOnReload}). The verdict is ` +
  `computed once on the server and handed over as a verdict, not as a bag of placement internals ` +
  `for the client to re-derive.`);

/* ── LEG 19 — the verdict's default direction ────────────────────────────────────────────── */
declareBreak({
  leg: "19 anything not provably value-only reloads",
  why: "default to in_place. A page that DID change shape is then never re-read, so the owner is " +
       "left looking at a canvas that no longer matches their record — a stale page that says it " +
       "saved. The costs are not symmetric: an unnecessary reload is a flicker, a skipped one is a " +
       "lie, so the tie goes to re-reading.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: '      if ((placement.inserted || []).length > 0) return "structural";    // a new entry was cloned in',
  with: '      if ((placement.inserted || []).length > 0) return "in_place";',
});
const regD = readFileSync(join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
const defaultsStructural = /if \(classic\) return "structural";/.test(regD) &&
  /if \(\(placement\.inserted \|\| \[\]\)\.length > 0\) return "structural";/.test(regD) &&
  /if \(\(placement\.missing \|\| \[\]\)\.length > 0\) return "structural";/.test(regD) &&
  /if \(edit\.op !== "edit"\) return "structural";/.test(regD);
const clientTreatsAbsentAsStructural = !/r\.pageChange !== 'structural'/.test(phD);
leg("RULE", "19 anything not provably value-only reloads — including an absent verdict",
  defaultsStructural && clientTreatsAbsentAsStructural,
  `the server returns "structural" for a classic page, an inserted entry, a missing placement and ` +
  `any op that is not an edit (${defaultsStructural}); the client tests for 'in_place' rather than ` +
  `against 'structural', so an OLDER function that sends no verdict at all still reloads ` +
  `(${clientTreatsAbsentAsStructural}). A deploy where the two halves disagree degrades to the ` +
  `old behaviour, not to a stale page.`);

/* ── LEG 20 — the rename keeps the card ──────────────────────────────────────────────────── */
declareBreak({
  leg: "20 a rename edits the card in place",
  why: "fall back to remove-then-place for every rename. The re-placed entry is CLONED from a " +
       "sibling, so the owner's photo comes back as an empty slot, the card jumps to the end of " +
       "the section, and when the bounds guard refuses the cut the OLD card stays and the page " +
       "shows both names. All three measured on evergreen, 2026-09-19.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: '  e = e.replace(/(\\bdata-hubly-price=")[^"]*(")/gi, (_m, a, b) => a + keyAttr + b);',
  with: "",
});
let rename = null;
try {
  // DRIVE THE REAL FUNCTION, against markup copied out of evergreen's stored document.
  const out = execFileSync("deno", ["eval", "--ext=ts", `
    import { renameServiceInFreeform } from "${join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts")}";
    const CARD = \`<div class="cards"><article class="card">
      <img data-hc="i.image" src="https://images.pexels.com/photos/12916204/x.jpeg" data-hubly-photo-slot="card" alt="">
      <div class="card-body">
        <h2 data-hc="i.title" data-hubly-service="Full Service">Full Service</h2>
        <span data-hc="i.body" data-hubly-price="Full Service">$95</span>
        <p data-hubly-desc="Full Service">Mowing plus trimming.</p>
        <a data-hc="hero.item.1.body.4" target="_top" href="https://x.myhubly.app/?book=1&amp;svc=Full%20Service">Book Full Service</a>
      </div></article>
      <article class="card"><h2 data-hubly-service="Basic Mow">Basic Mow</h2>
      <p data-hubly-desc="Basic Mow">Nothing like Full Service.</p>
      <a data-hubly-runtime="card-book" href="https://x.myhubly.app/?book=1&amp;svc=Basic%20Mow">Book Basic Mow</a></article>
      <a data-hc="nav.item.1" href="https://x.myhubly.app/?book=1">Book lawn care</a></div>\`;
    const r = renameServiceInFreeform(CARD, "Full Service", "Premium Lawn Service");
    console.log(JSON.stringify({ renamed: r.renamed,
      photoKept: /photos\\/12916204/.test(r.html),
      positionKept: r.html.indexOf('data-hubly-service="Premium Lawn Service"') < r.html.indexOf('data-hubly-service="Basic Mow"'),
      priceRekeyed: /data-hubly-price="Premium Lawn Service"[^>]*>\\$95</.test(r.html),
      descRekeyed: /data-hubly-desc="Premium Lawn Service"/.test(r.html),
      ctaSvc: (r.html.match(/svc=(Premium[^"&\\s]*)/) || [])[1],
      ctaText: /Book Premium Lawn Service/.test(r.html),
      neighbourLinkIntact: /svc=Basic%20Mow">Book Basic Mow/.test(r.html),
      navLinkIntact: /nav\\.item\\.1" href="[^"]*\\?book=1">Book lawn care/.test(r.html),
      oldGone: !/data-hubly-service="Full Service"/.test(r.html),
      neighbourIntact: /Nothing like Full Service\\./.test(r.html) && /data-hubly-service="Basic Mow"/.test(r.html) }));
  `], { encoding: "utf8", cwd: ROOT, timeout: 180000 });
  rename = JSON.parse(out.trim().split("\n").pop());
} catch (e) { rename = { err: String(e.message).split("\n")[0] }; }
leg("RULE", "20 a rename edits the card in place — photo, position, price, link and neighbours",
  !!rename && rename.renamed === true && rename.photoKept === true && rename.positionKept === true &&
  rename.priceRekeyed === true && rename.descRekeyed === true && rename.oldGone === true &&
  rename.ctaSvc === "Premium%20Lawn%20Service" && rename.ctaText === true &&
  rename.neighbourIntact === true && rename.neighbourLinkIntact === true && rename.navLinkIntact === true,
  `renaming against evergreen's real card markup: ${JSON.stringify(rename)}. THE BOOKING LINK IN ` +
  `THIS FIXTURE IS THE UNSTAMPED FORM ON PURPOSE. The first version keyed on ` +
  `data-hubly-runtime="card-book" and passed — against a fixture I wrote carrying that stamp. On ` +
  `evergreen only FOUR of SEVEN booking links carry it; the rest are the model's own from build ` +
  `time. So a rename updated the card and left its button pointing at a service that no longer ` +
  `existed, and it took renaming a real service in the live editor to see it. The link is now ` +
  `matched by the service it POINTS AT, and the leg asserts three things the form-matching version ` +
  `could not: the unstamped link follows, another service's stamped link does NOT, and the nav's ` +
  `"Book lawn care" (?book=1 with no svc=) is left alone.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
