#!/usr/bin/env node
/**
 * [RULE] THE WEBSITE PREVIEW IS FITTED TO THE PANE IT IS IN NOW, NOT THE PANE IT WAS BORN IN.
 *
 *   node scripts/check-the-preview-refits-its-pane.mjs
 *
 * ══ WHAT HAPPENED ═══════════════════════════════════════════════════════════════════════════
 *
 * Entering Website by clicking the rail left the preview stage at **840px inside a 1150px pane**
 * and it stayed there — 310px of the owner's work surface permanently empty. Entering the same
 * mode by URL gave 1106. The difference is that the click path renders the canvas a second time.
 *
 * `#hcCanvasFrameWrap` is written by the canvas innerHTML, so every render destroys the observed
 * node and builds a new one. `hcObservePreviewPane()` guarded on `if(hcFitRO) return` — install
 * once, never again — so the ResizeObserver stayed bound to the first wrap, which was no longer
 * in the document. The three explicit `hcApplyPreviewFit()` calls at the call site all fire
 * inside the column's own 450ms flex-basis transition, so all three measure a pane still in
 * motion. The observer was the only thing that could see the settled width, and it was dead.
 *
 * ══ WHAT MAKES THIS CHECK WORTH ANYTHING ════════════════════════════════════════════════════
 *
 * Leg 1 does not reproduce the navigation at all — it resizes the pane directly and asks whether
 * the stage follows. That is the PROPERTY ("the preview tracks its pane"), and it holds no
 * matter which navigation path or transition timing gets you there. Leg 2 then drives the actual
 * failing route, because a property that holds in a synthetic resize is not evidence about the
 * route a person takes.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ width: 1710, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

let out = null;
try {
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "owner@example.com", displayName: "Owner",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [] },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) throw new Error(bad);

  out = await rig.page.evaluate(async ({ biz }) => {
    const q = (s) => document.querySelector(s);
    const W = (n) => (n ? Math.round(n.getBoundingClientRect().width) : null);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const railBtn = (label) => [...document.querySelectorAll(".hc-rail button, .hc-rail a")]
      .find((b) => b.textContent.trim() === label);

    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    window.hublyNavUI.openWorkspace("home");
    await wait(700);

    /* EVERY WIDTH THE PREVIEW IS LAID OUT AT ON THE WAY IN. The stage is a real viewport onto the
     * owner's real page, so each distinct width is a full re-layout of it — the thing Adrian saw
     * as the screen "changing width so much". Sampled per frame, from before the click until the
     * column has settled. */
    const seen = [];
    let sampling = true;
    (function sample() {
      if (!sampling) return;
      const st = q("#hcPreviewStage");
      const w = st ? Math.round(st.getBoundingClientRect().width) : null;
      if (w !== null && w !== seen[seen.length - 1]) seen.push(w);
      requestAnimationFrame(sample);
    })();

    /* ── FIRST VISIT: the property, measured while the observer is bound to a node that is
     *    unquestionably the live one. Doing the resize HERE rather than after a rebuild is what
     *    keeps leg 2 independent of leg 1 — a stale-node regression must not be able to turn
     *    this red, or neither leg would prove anything about itself. */
    (railBtn("Website") || { click() { window.hublyNavUI.openWorkspace("website"); } }).click();
    await wait(3000);
    sampling = false;
    // Drop widths that are not a rendered page: 0/1px before the iframe has a document.
    const layouts = seen.filter((w) => w > 8);
    const firstVisit = { wrap: W(q("#hcCanvasFrameWrap")), stage: W(q("#hcPreviewStage")) };

    const left = q(".hc-app-left");
    const basis0 = left.style.flexBasis;
    left.style.flexBasis = "620px";
    await wait(1200);
    const shrunk = { wrap: W(q("#hcCanvasFrameWrap")), stage: W(q("#hcPreviewStage")) };
    left.style.flexBasis = basis0;
    await wait(1200);
    const restored = { wrap: W(q("#hcCanvasFrameWrap")), stage: W(q("#hcPreviewStage")) };

    /* ── SECOND VISIT: leave and come back. This rebuilds the canvas, and with it the wrap —
     *    verified below by tagging the node — which is the condition the live defect needed and
     *    the reason a one-visit route found nothing. */
    const w1 = q("#hcCanvasFrameWrap"); w1.__tag = 1;
    (railBtn("Home") || { click() { window.hublyNavUI.openWorkspace("home"); } }).click();
    await wait(1500);
    (railBtn("Website") || { click() { window.hublyNavUI.openWorkspace("website"); } }).click();
    await wait(3000);
    const w2 = q("#hcCanvasFrameWrap");
    const secondVisit = { wrap: W(w2), stage: W(q("#hcPreviewStage")), rebuilt: w2 !== w1 && !w2.__tag };
    return { firstVisit, shrunk, restored, secondVisit, layouts };
  }, { biz: BIZ });
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

console.log(`  1st visit to Website : pane ${out.firstVisit.wrap}  stage ${out.firstVisit.stage}`);
console.log(`  pane shrunk by 240px : pane ${out.shrunk.wrap}  stage ${out.shrunk.stage}`);
console.log(`  pane restored        : pane ${out.restored.wrap}  stage ${out.restored.stage}`);
console.log(`  2nd visit (rebuilt ${out.secondVisit.rebuilt}) : pane ${out.secondVisit.wrap}  stage ${out.secondVisit.stage}`);
console.log(`  widths the preview was laid out at entering Website: [${out.layouts.join(", ")}]\n`);

if (!out.secondVisit.rebuilt) {
  console.error("CANNOT RUN — leaving and returning to Website did not rebuild the canvas wrap, " +
                "so leg 1's condition (a stale observed node) cannot arise and it would pass vacuously.");
  process.exit(2);
}

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 the preview fills the pane on a RETURN visit, after the canvas has been rebuilt",
  why: "restore the install-once guard on the ResizeObserver. The wrap is rebuilt by the canvas " +
       "innerHTML on every render, so the observer stays bound to a node that has left the " +
       "document and the live pane is watched by nobody. This is the live defect exactly.",
  file: "public/platform-home.html",
  find: "    if(hcFitRO && hcFitROTarget === wrap) return;   // already watching THIS node",
  with: "    if(hcFitRO) return;   // already watching THIS node",
});
leg("RULE", "1 the preview fills the pane on a RETURN visit, after the canvas has been rebuilt",
  out.secondVisit.wrap > 0 && out.secondVisit.stage > 0 &&
  out.secondVisit.wrap - out.secondVisit.stage <= 60,
  `second visit: pane ${out.secondVisit.wrap}, stage ${out.secondVisit.stage}, unused ` +
  `${out.secondVisit.wrap - out.secondVisit.stage}px (the wrap's own 44px of padding is the floor, ` +
  `so 60 is the tolerance). A ONE-VISIT route found nothing here — the first wrap is always the ` +
  `observed one — which is why this leg insists the canvas was actually rebuilt before asserting.`);

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the preview tracks the pane when the pane changes width",
  why: "stop observing once the pane has settled. Navigation still lands correctly (one fit, at " +
       "the end of the transition) so legs 1 and 3 are untouched, but nothing follows a pane that " +
       "changes size afterwards — the panel opening, the window, a chip row appearing.\n" +
       "Two narrower-looking attempts were rejected by the ledger first. Pointing the observer at " +
       "the STAGE came back COMPOUND: the stage is what the fit writes, so it feeds itself and the " +
       "preview churns, reddening leg 3 too. Freezing the pane width the fit READS came back NOT " +
       "RED, and that one taught something real — the stage is sized `dev.w` and then SCALED to " +
       "the pane, so its rendered width tracks the pane through the scale even when dev.w is " +
       "frozen. Leg 2 is about what the owner sees, and what he sees still followed.",
  file: "public/platform-home.html",
  find: "        hcFitRO._t = setTimeout(function(){ hcFitRO._t = null; try{ hcApplyPreviewFit(); }catch(e){} }, 120);",
  with: "        hcFitRO._t = setTimeout(function(){ hcFitRO._t = null; try{ hcApplyPreviewFit(); hcFitRO.disconnect(); }catch(e){} }, 120);",
});
leg("RULE", "2 the preview tracks the pane when the pane changes width",
  out.shrunk.stage !== null && out.shrunk.stage < out.firstVisit.stage &&
  out.restored.stage === out.firstVisit.stage,
  `pane ${out.firstVisit.wrap}->${out.shrunk.wrap}->${out.restored.wrap}, stage ` +
  `${out.firstVisit.stage}->${out.shrunk.stage}->${out.restored.stage}. The PROPERTY, asked without ` +
  `reference to any navigation path, and measured on the FIRST visit so that a stale-node ` +
  `regression cannot reach it — otherwise leg 1 and this leg would fail together and neither would ` +
  `be evidence about itself.`);

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 entering Website lays the preview out once, not once per frame of the transition",
  why: "go back to a leading-edge throttle, which fires every 60ms for the whole column " +
       "animation. The final size is still right, so legs 1 and 2 stay green while the owner's " +
       "page re-wraps eight times on the way there — which is the state Adrian reported.",
  file: "public/platform-home.html",
  find: "        if(hcFitRO._t) clearTimeout(hcFitRO._t);\n        hcFitRO._t = setTimeout(function(){ hcFitRO._t = null; try{ hcApplyPreviewFit(); }catch(e){} }, 120);",
  with: "        if(hcFitRO._t) return;\n        hcFitRO._t = setTimeout(function(){ hcFitRO._t = null; try{ hcApplyPreviewFit(); }catch(e){} }, 60);",
});
leg("RULE", "3 entering Website lays the preview out once, not once per frame of the transition",
  out.layouts.length <= 2,
  `the preview was laid out at ${out.layouts.length} distinct width(s) on the way in: ` +
  `[${out.layouts.join(", ")}]. Each one is a full re-layout of a customer-facing page — text ` +
  `re-wrapping, images resizing, columns collapsing and reopening. Measured on Adrian's own shell ` +
  `before this was debounced: 1 -> 299 -> 668 -> 734 -> 884 -> 1006 -> 1071 -> 1101 -> 1106, eight ` +
  `re-layouts per click. The allowance is 2 rather than 1 because a build-time fit followed by one ` +
  `settled fit is legitimate; what is not is a fit per frame.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
