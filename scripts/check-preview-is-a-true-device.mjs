#!/usr/bin/env node
/**
 * [RULE] THE PREVIEW'S DEVICE HAS A TRUE 1440x900 VIEWPORT, AT ANY PANE SIZE, NEVER UPSCALED.
 *
 *   node scripts/check-preview-is-a-true-device.mjs
 *
 * ══ WHY THESE TWO THINGS AND NOT "IT LOOKS RIGHT" ════════════════════════════════════════════
 *
 * Adrian ruled on 2026-09-18 that the preview fits the WIDTH — `scale = paneW/1440` — because it is
 * the only option that makes it bigger without making it LIE. Two properties carry that entire
 * argument, and both are invisible to the eye:
 *
 *   1. THE LOGICAL VIEWPORT IS STILL 1440x900. If the device's own box changes with the pane, a
 *      `100vh` hero stops measuring what a visitor's does and every breakpoint moves. The preview
 *      would look fine and be wrong, which is worse than margins.
 *   2. THE SCALE NEVER EXCEEDS 1. Upscaling shows text BIGGER than a visitor gets — lying in the
 *      other direction, and the reason option 4 was refused.
 *
 * Measured at several pane sizes by driving the real `hcApplyPreviewFit` in the real shell, not by
 * reading the arithmetic. The arithmetic is what was wrong twice: `min(w,h)` silently converted a
 * wider window into beige, and a comment claimed `clientWidth` excluded padding when it includes it.
 *
 * ══ AND MOBILE MUST NOT CHANGE ══════════════════════════════════════════════════════════════
 *
 * `hcIsMobile()` (max-width:700px) clears the transform and renders native-width — a phone IS the
 * device, there is nothing to simulate. Adrian: *"keep that exactly as it is."* Leg 4 asserts it, so
 * a future change to the desktop path cannot quietly take the phone with it.
 *
 * SCOPED: this drives the fit function against a real pane in a real shell, with a declared backend.
 * It does NOT prove what the page inside the iframe looks like — no assertion here can; that is
 * `docs/OWNER_VERIFICATIONS.md`'s territory and it needs a person.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// `url` is REQUIRED: hcRenderCanvas returns early without it and the preview nodes are never
// created — which the first run reported as "the preview nodes are not on the page", correctly.
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ width: 1900, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/* Several pane shapes, including the one Adrian measured (1900x723 -> a short pane). */
const SHAPES = [
  { w: 1900, h: 723, why: "Adrian's own window, where the height fit used to bind" },
  { w: 1900, h: 1200, why: "a tall window — the width fit should still decide" },
  { w: 1100, h: 900, why: "narrow: the scale must come down with the width" },
  { w: 2600, h: 1400, why: "very wide and tall: the 1:1 ceiling must hold" },
];

try {
  await rig.load(srv.url("platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "o@e.test", displayName: "Adrian",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [] } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    window.hublyNavUI.openWorkspace("website");
    await new Promise((r) => setTimeout(r, 700));
  }, { biz: BIZ });

  const seen = [];
  for (const sh of SHAPES) {
    await rig.page.setViewportSize({ width: sh.w, height: sh.h });
    const m = await rig.page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 260));
      const wrap = document.getElementById("hcCanvasFrameWrap");
      const frame = document.getElementById("hcPreviewFrame");
      const stage = document.getElementById("hcPreviewStage");
      if (!wrap || !frame || !stage) return null;
      const cs = getComputedStyle(wrap), ss = getComputedStyle(stage);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const mx = new DOMMatrixReadOnly(ss.transform);
      return {
        paneW: wrap.clientWidth - padX, paneH: wrap.clientHeight - padY,
        wrapOverflowY: cs.overflowY, wrapAlign: cs.alignItems,
        stageW: Math.round(parseFloat(ss.width)), stageH: Math.round(parseFloat(ss.height)),
        scale: Math.round(mx.a * 1e4) / 1e4,
        frameW: Math.round(frame.getBoundingClientRect().width),
        frameH: Math.round(frame.getBoundingClientRect().height),
      };
    });
    if (!m) { console.error("CANNOT RUN — the preview nodes are not on the page"); break; }
    seen.push({ ...sh, ...m });
    console.log(`  ${String(sh.w) + "x" + sh.h}`.padEnd(12) + `pane ${Math.round(m.paneW)}x${Math.round(m.paneH)} · ` +
      `stage ${m.stageW}x${m.stageH} · scale ${m.scale} · frame ${m.frameW}x${m.frameH}   (${sh.why})`);
  }
  console.log();

  declareBreak({
    leg: "1 the device's LOGICAL viewport is 1440x900 at every pane size",
    why: "make the stage's logical height follow the pane instead of staying 900 — the preview then " +
         "LOOKS right and a 100vh hero measures something no visitor has, which is the failure mode " +
         "the width-fit ruling exists to avoid",
    file: "public/platform-home.html",
    find: "    stage.style.setProperty('--hc-ph', dev.h + 'px');",
    with: "    stage.style.setProperty('--hc-ph', Math.round(paneH / (scale || 1)) + 'px');",
  });
  leg("RULE", "1 the device's LOGICAL viewport is 1440x900 at every pane size",
    seen.length === SHAPES.length && seen.every((m) => m.stageW === 1440 && m.stageH === 900),
    `${seen.length} of ${SHAPES.length} pane shape(s) measured — the count is part of the assertion, ` +
    `because "every one is 1440x900" is trivially true of none — and the stage was ` +
    `${[...new Set(seen.map((m) => m.stageW + "x" + m.stageH))].join(", ")} across all of them. ` +
    `A 100vh hero measures a real 900px only while this holds.`);

  declareBreak({
    leg: "2 the scale never exceeds 1",
    why: "remove the 1:1 ceiling, so a pane wider than 1440 upscales the device and shows the owner " +
         "text BIGGER than a visitor gets — lying in the opposite direction from the clipped fold",
    file: "public/platform-home.html",
    find: "    if(scale > 1) scale = 1;                       // 1:1 is the ceiling",
    with: "    /* BREAK: the ceiling is gone */",
  });
  const over = seen.filter((m) => m.scale > 1.0001);
  leg("RULE", "2 the scale never exceeds 1",
    seen.length > 0 && over.length === 0,
    `${seen.length} shape(s) measured, including one 2600px wide where the width fit is ${(2600 / 1440).toFixed(2)} ` +
    `— so the ceiling is actually exercised rather than never reached — and ${over.length} exceeded 1. ` +
    `Scales seen: ${seen.map((m) => m.scale).join(", ")}.`);

  declareBreak({
    leg: "3 the scale tracks the pane's WIDTH",
    why: "put the height fit back into the scale — `min(paneW/dev.w, paneH/dev.h)` — which is the " +
         "state Adrian reported as 'the website got small': a wider window adds only beige",
    file: "public/platform-home.html",
    find: "    var scale = paneW / dev.w;",
    with: "    var scale = Math.min(paneW / dev.w, paneH / dev.h);",
  });
  const narrow = seen.find((m) => m.w === 1100), wide = seen.find((m) => m.w === 1900 && m.h === 723);
  const tall = seen.find((m) => m.w === 1900 && m.h === 1200);
  leg("RULE", "3 the scale tracks the pane's WIDTH, and height does not shrink it",
    !!narrow && !!wide && !!tall &&
    narrow.scale < wide.scale &&                       // a narrower pane scales down
    Math.abs(wide.scale - tall.scale) < 0.002 &&       // pane HEIGHT changes nothing
    Math.abs(wide.frameW - wide.paneW) < 2,            // and the frame fills the width
    `narrow(1100) ${narrow && narrow.scale} < short-wide(1900x723) ${wide && wide.scale} ` +
    `= tall-wide(1900x1200) ${tall && tall.scale}. Same width, 477px more height, same scale — which ` +
    `is the ruling: height is a window, not a divisor. And the frame width ${wide && wide.frameW} ` +
    `matches the pane's usable ${wide && Math.round(wide.paneW)} (padding EXCLUDED — clientWidth ` +
    `includes it, and the old code did not subtract it).`);

  declareBreak({
    leg: "4 the pane never needs its own scrollbar",
    why: "restore `align-items:center; overflow:auto` on the wrap — the obvious implementation of a " +
         "width fit, which puts the WORKSPACE's scrollbar beside the PAGE's and, worse, centres an " +
         "overflowing frame so its top sits above the scroll origin and cannot be reached at all",
    file: "public/platform-home.html",
    find: ".hc-canvas-frame-wrap{flex:1;position:relative;background:var(--bg-1);min-height:0;overflow:hidden;display:flex;align-items:flex-start;justify-content:center;padding:22px}",
    with: ".hc-canvas-frame-wrap{flex:1;position:relative;background:var(--bg-1);min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:22px}",
  });
  leg("RULE", "4 the pane never needs its own scrollbar, so only the PAGE's is on screen",
    seen.length > 0 && seen.every((m) => m.wrapOverflowY === "hidden" && m.wrapAlign === "flex-start") &&
    seen.every((m) => m.frameH <= Math.ceil(m.paneH)),
    `overflow-y=${[...new Set(seen.map((m) => m.wrapOverflowY))].join("/")} · ` +
    `align-items=${[...new Set(seen.map((m) => m.wrapAlign))].join("/")} · frame height never exceeds ` +
    `the pane (${seen.map((m) => m.frameH + "<=" + Math.ceil(m.paneH)).join(", ")}). The frame is a ` +
    `WINDOW onto the device: the workspace does not scroll, so the only scrollbar visible is the one ` +
    `inside the iframe — the page's own, which a real visitor also has. flex-start matters because a ` +
    `CENTRED overflow puts the frame's top above the scroll origin, out of reach.`);

  /* ── MOBILE IS UNTOUCHED, and it is asserted rather than assumed ───────────────────────────── */
  await rig.page.setViewportSize({ width: 390, height: 844 });
  const mob = await rig.page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 300));
    try { window.hublyPreviewUI && window.hublyPreviewUI.fit && window.hublyPreviewUI.fit(); } catch (e) {}
    const stage = document.getElementById("hcPreviewStage");
    if (!stage) return { missing: true, isMobile: window.matchMedia("(max-width:700px)").matches };
    const ss = getComputedStyle(stage);
    return { transform: ss.transform, isMobile: window.matchMedia("(max-width:700px)").matches,
             inlineScale: stage.style.getPropertyValue("--hc-scale") || "(cleared)" };
  });
  declareBreak({
    leg: "5 mobile still renders native-width",
    why: "make hcIsMobile() always false, so a phone gets the desktop device simulation — a 1440px " +
         "viewport scaled into a 390px screen, which is the one thing a phone must never do because " +
         "the phone IS the device",
    file: "public/platform-home.html",
    find: "  function hcIsMobile(){ try{ return window.matchMedia('(max-width:700px)').matches; }catch(e){ return false; } }",
    with: "  function hcIsMobile(){ return false; }",
  });
  leg("RULE", "5 mobile still renders native-width with no transform",
    // BOTH MECHANISMS, because the first version asserted only the CSS result and the break could not
    // move it: `@media(max-width:700px){.hc-preview-stage{transform:none!important}}` wins whatever
    // the JS does, so "transform is none" stayed true with hcIsMobile() forced false. The JS half is
    // that it CLEARS the inline custom properties — belt and braces that a check must also hold, or
    // half the guard is untested.
    mob.isMobile === true && !mob.missing &&
    (mob.transform === "none" || mob.transform === "matrix(1, 0, 0, 1, 0, 0)") &&
    mob.inlineScale === "(cleared)",
    `at 390x844 the media query matches (${mob.isMobile}) and the stage transform is ` +
    `${JSON.stringify(mob.transform)} AND the JS cleared the inline --hc-scale ` +
    `(${JSON.stringify(mob.inlineScale)}) — both halves, because the CSS !important alone would make ` +
    `this leg pass with the JS branch dead. A phone IS ` +
    `the device; there is nothing to simulate. Asserted because the desktop path changed and a change ` +
    `there must not take the phone with it.`);
} finally { await rig.close(); srv.close(); }

const bad2 = legs.filter((l) => !l.pass);
console.log(`\n${bad2.length ? "FAIL" : "PASS"} — ${legs.length - bad2.length}/${legs.length} legs`);
process.exit(bad2.length ? 1 : 0);
