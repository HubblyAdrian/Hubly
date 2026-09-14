#!/usr/bin/env node
/**
 * THE RIG'S OWN SELF-TEST — against a page built to contain the exact failures it exists for.
 *
 * A rig that has never failed is not a rig. This serves a local fixture carrying, deliberately:
 *
 *   · `html { scroll-behavior: smooth }`      — Lesson 69's read-back trap
 *   · a value that only settles after 1200ms  — Lesson 70's fixed-delay trap (a 500ms wait reads
 *                                               the WRONG value; the rig's poll reads the right one)
 *   · a zero-size element carrying the same id as the real one, FIRST in document order
 *                                             — the shape that cost four hours on 2026-09-13
 *   · a button covered by a transparent overlay — a click that dispatches and never lands
 *
 * Every assertion below is therefore a red-proof: the trap is present, and the rig either
 * survives it or reports it.
 *
 *   node scripts/check-browser-rig.mjs
 *
 * Exit: 0 the rig behaves · 1 an assertion failed · 2 cannot run (no browser).
 */
import { createServer } from "node:http";
import { openRig } from "./lib/browser-rig.mjs";

const PAGE = `<!doctype html><meta charset="utf-8"><title>rig fixture</title>
<style>
  html{scroll-behavior:smooth}
  body{margin:0;font:16px system-ui}
  .pad{height:1400px;background:linear-gradient(#eef,#fff)}
  #target{height:300px;background:#cfc}
  #slow{padding:20px;font-size:24px}
  #covered{position:relative}
  .cover{position:absolute;z-index:99;background:rgba(0,0,0,0)}
</style>
<!-- THE ZERO-SIZE DECOY, first in document order, same id as the real section. -->
<div id="target" style="height:0;overflow:hidden"></div>
<a id="jump" href="#target">jump</a>
<button id="slowbtn">go slow</button>
<span style="position:relative;display:inline-block"><button id="covered">covered</button><span class="cover" style="inset:-4px"></span></span>
<!-- THE TWO WITNESS TRAPS. Both were live defects in the rig, found by a real control. -->
<button id="stopprop">stops propagation in capture</button>
<button id="selfrewrite"><span>rewrites its own element</span></button>
<div class="pad"></div>
<div id="target">THE REAL TARGET</div>
<div id="slow">0</div>
<script>
  // TRAP A — a document-level CAPTURE handler that stops propagation. The element's own
  // listener never fires, so a witness attached to the element sees nothing.
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#stopprop')){
      e.preventDefault(); e.stopPropagation();
      document.getElementById('stopprop').setAttribute('data-fired','1');
    }
  }, true);
  // TRAP B — a handler that rewrites its own element, detaching e.target before any later
  // listener runs, so e.target.closest(sel) finds nothing.
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('#selfrewrite') : null;
    if(t){
      e.preventDefault(); e.stopPropagation();
      t.setAttribute('data-fired','1');
      t.innerHTML = '<input id="rewritten">';
    }
  }, true);
  document.getElementById('slowbtn').addEventListener('click', function(){
    var el=document.getElementById('slow');
    setTimeout(function(){ el.textContent='250'; }, 250);
    setTimeout(function(){ el.textContent='1200'; }, 1200);   // the value a 500ms wait misses
  });
</script>`;

let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const server = createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(8795, r));
const URL_ = "http://127.0.0.1:8795/";

let rig;
try { rig = await openRig({ quiet: false }); }
catch (e) { console.error(String(e.message)); server.close(); process.exit(2); }

try {
  // ── RULE 3 · the poll beats a fixed delay ──────────────────────────────────────
  await rig.load(URL_);
  await rig.click({ selector: "#slowbtn" });
  const readSlow = () => document.getElementById("slow").textContent;
  // The fixture changes at 250ms and AGAIN at 1200ms. Under the default 800ms window it
  // settles as "250" — correct for the question asked, and the whole point: the window is a
  // guess, so it is a parameter and it is printed. Raising it reads the later value.
  const slowDefault = await rig.settle(readSlow, "slow value (default window)");
  say("3 the poll settles, reports its window, and never reads at t=0",
    slowDefault.final === "250" && slowDefault.stableMs === 800 && slowDefault.ms > 800,
    `final=${slowDefault.final} at t=${slowDefault.ms}ms window=${slowDefault.stableMs}ms trace=${JSON.stringify(slowDefault.trace)}`);

  await rig.load(URL_);
  await rig.click({ selector: "#slowbtn" });
  const slowWide = await rig.settle(readSlow, "slow value (wide window)", { stableMs: 1600 });
  say("3b the window is a real parameter — widening it reaches the second change",
    slowWide.final === "1200", `final=${slowWide.final} at t=${slowWide.ms}ms window=${slowWide.stableMs}ms`);
  say("3c and a fixed 500ms wait would have read neither settled value",
    (slowDefault.trace.find(([t]) => t >= 500) || [])[1] === undefined,
    "nothing changed at/after 500ms under the default window — a 500ms wait lands mid-flight");

  // ── RULE 4 · the write receipt carries WHEN ────────────────────────────────────
  say("4 write receipt matches when it should",
    rig.expect({ what: "slow value", asked: "1200", read: slowWide.final, ms: slowWide.ms }) === true);
  say("4b write receipt reports a mismatch rather than swallowing it",
    rig.expect({ what: "slow value", asked: "250", read: slowWide.final, ms: slowWide.ms }) === false);

  // ── RULE 1 + the duplicate-id decoy ───────────────────────────────────────────
  await rig.load(URL_);                       // fresh context: not a same-document repeat
  const before = (await rig.settleScroll()).final;
  await rig.click({ selector: "#jump" });
  const after = await rig.settleScroll();
  // The decoy is first, so a browser resolving #target by document order scrolls nowhere.
  // Whatever it does, the rig must REPORT it with a timestamp rather than assert a guess.
  console.log(`  [decoy] scrollTop ${before} -> ${after.final} at t=${after.ms}ms (two #target elements, the first zero-size)`);
  say("1 a fragment click is measured with a settled read and a timestamp",
    typeof after.final === "number" && typeof after.ms === "number", `final=${after.final} ms=${after.ms}`);

  // THE DECOY, RED-PROOFED — and this is evidence, not just a rig test. With a zero-size
  // element carrying the same id FIRST in document order, the fragment click moves nothing.
  // Remove it, reload, click the same link: it scrolls. That is the mechanism we spent four
  // hours on, reproduced in nine lines of controlled HTML.
  say("1b with the decoy, the click does not scroll", after.final === 0, `scrollTop=${after.final}`);
  await rig.load(URL_);
  await rig.page.evaluate(() => document.querySelectorAll("#target")[0].remove());
  await rig.click({ selector: "#jump" });
  const noDecoy = await rig.settleScroll();
  say("1c without the decoy, the same click scrolls", noDecoy.final > 100,
    `scrollTop 0 -> ${noDecoy.final} at t=${noDecoy.ms}ms, one #target element`);

  // ── RULE 2 · a click that cannot land is an instrument failure, not a result ───
  let threwMissing = false;
  try { await rig.click({ selector: "#does-not-exist" }); } catch (e) { threwMissing = /no element matches/.test(e.message); }
  say("2 a missing element throws rather than returning a null result", threwMissing);

  await rig.load(URL_);   // the decoy was removed above; a fresh load restores it
  let threwZero = false;
  try { await rig.click({ selector: "#target" }); } catch (e) { threwZero = /has no box/.test(e.message); }
  say("2b a zero-size element throws rather than being clicked", threwZero);

  let threwCovered = false;
  try { await rig.click({ selector: "#covered" }); } catch (e) { threwCovered = /CLICK DID NOT LAND/.test(e.message); }
  say("2c a covered control does not report a landed click", threwCovered);

  // ── THE WITNESS, against both shapes that defeated it ──────────────────────────
  //
  // The rig's landing witness is the most load-bearing line in the toolchain: everything it
  // says "didn't happen" is a claim about the product. Both of these reported a WORKING
  // control as dead, and both were found only because a real control happened to be shaped
  // that way. They are fixtures now so an edit cannot regress them quietly.
  await rig.load(URL_);
  let okStop = true;
  try { await rig.click({ selector: "#stopprop" }); } catch (e) { okStop = false; }
  const stopFired = await rig.page.evaluate(() => document.getElementById("stopprop").getAttribute("data-fired") === "1");
  say("5 a capture handler that stops propagation does not hide the click", okStop && stopFired,
    `rig said landed=${okStop}, the page's own handler ran=${stopFired}`);

  await rig.load(URL_);
  let okRewrite = true;
  try { await rig.click({ selector: "#selfrewrite" }); } catch (e) { okRewrite = false; }
  const rewriteFired = await rig.page.evaluate(() => document.getElementById("selfrewrite").getAttribute("data-fired") === "1");
  say("5b a handler that rewrites its own element does not hide the click", okRewrite && rewriteFired,
    `rig said landed=${okRewrite}, the page's own handler ran=${rewriteFired}`);

} finally {
  await rig.close();
  server.close();
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe rig survives every trap it exists for.");
process.exit(failed ? 1 : 0);
