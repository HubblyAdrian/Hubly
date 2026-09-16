/**
 * THE BROWSER RIG — the write-side companion to read-receipt.mjs.
 *
 * read-receipt.mjs exists because five instrument failures in one week were caught by a human
 * noticing the answer was implausible. This file exists because three MORE were caught the same
 * way on 2026-09-13, and every one of them was on the WRITE side, where we had nothing:
 *
 *   Lesson 68  A fix was proposed after testing the bug and not the fix. Two theories died.
 *   Lesson 69  A scroll write was confirmed by reading it back in the same tick. With
 *              `scroll-behavior: smooth` that read is GUARANTEED to return the old value, so
 *              "the write did not apply" was structurally impossible to disprove. It killed a
 *              correct theory, then a control on a page that differed in exactly that property
 *              produced a second wrong answer.
 *   Lesson 70  `waitForTimeout(500)` stood between a click and its assertion, and produced the
 *              numbers ("0 of 119", "37 of 40") that justified rewriting 142 stored pages.
 *              Both are floors, not measurements.
 *
 * And one that never became a lesson because it was only diagnosed at the end: **clicking the
 * same fragment link twice in one document is a no-op**, so a harness that re-clicks without
 * reloading measures the browser declining to repeat itself and calls it a broken page.
 *
 * FOUR RULES, and they are the whole file:
 *
 *   1. RELOAD BETWEEN CLICKS. Same-document repeats are not independent trials.
 *   2. CONFIRM THE CLICK LANDED before reading anything. Roughly half the clicks in that
 *      session missed, and a missed click reads exactly like a dead control.
 *   3. POLL UNTIL STABLE. Never a fixed delay: a delay encodes a guess about duration into
 *      something that reads like an observation, and the guess is invisible in the output.
 *   4. PRINT THE WRITE RECEIPT — value asked, value read, and WHEN it was read. A null result
 *      without a timestamp is not a finding.
 *
 *   import { openRig } from "./lib/browser-rig.mjs";
 *   const rig = await openRig();
 *   await rig.load(url);                                  // full navigation + settle
 *   const hit = await rig.click({ selector: "a[href='#x']" });   // throws if it did not land
 *   const r   = await rig.settleScroll();                 // {final, ms, trace}
 *   rig.expect({ what: "scrollTop", asked: 616, read: r.final, ms: r.ms });
 *   await rig.close();
 *
 * Exit-code convention matches the rest of scripts/: the CALLER decides. The rig throws on a
 * broken instrument (no browser, click did not land) and returns values for everything else,
 * because "the control did nothing" is a RESULT and "I could not press the control" is not.
 */
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

/**
 * THE STABILITY WINDOW IS ITSELF A GUESS — and this is the honest part of Lesson 70.
 *
 * Polling beats a fixed delay, but "stable for N ms" still encodes an assumption about how
 * long the thing under test can pause mid-flight. A value that changes at 250ms and again at
 * 1200ms settles as 250 under an 800ms window, and that is not a bug in the rig — it is the
 * rig answering the question it was asked.
 *
 * So the window is a PARAMETER and it is PRINTED on every reading. Lesson 70's sentence was
 * "the guess is invisible in the output"; the fix is not to eliminate the guess, which cannot
 * be done, but to put it in the receipt beside the value so the next reader can see what was
 * assumed. Raise it when the thing being watched has a slow second act.
 */
const STABLE_MS = 800;
const CEILING_MS = 6000;

export async function openRig(opts = {}) {
  let chromium;
  try { ({ chromium } = require_("playwright")); }
  catch (e) { throw new Error("CANNOT RUN — playwright not loadable: " + e.message); }

  const browser = await chromium.launch({ headless: opts.headless !== false });
  const width = opts.width || 1440, height = opts.height || 900;
  let ctx = await browser.newContext({ viewport: { width, height } });
  let page = await ctx.newPage();
  const log = (s) => { if (!opts.quiet) console.log(s); };

  // CONSOLE CAPTURE THAT SURVIVES A RELOAD — added 2026-09-13 after it cost an hour.
  //
  // `load({fresh:true})` closes the page and opens a new one, which is the whole point (rule 1).
  // But a caller doing the obvious thing — `rig.page.on("console", …)` and then `rig.load(url)` —
  // attaches the listener to a page that is thrown away, and then reads ZERO console lines and
  // concludes the code under test never ran. That is exactly what happened while chasing the
  // "+" mount: four structural gates were investigated because an instrument reported silence
  // it had manufactured itself.
  //
  // So the rig owns the buffer and re-attaches on every page it creates. `rig.consoleLines`
  // is the whole log; `rig.consoleSince(mark)` reads what arrived after a point.
  const consoleLines = [];
  const attachConsole = (p) => { p.on("console", (m) => { try { consoleLines.push(m.text()); } catch (_) {} }); };
  attachConsole(page);

  // …AND THE SAME FOR INIT SCRIPTS. Found within the hour of writing Lesson 74, by doing
  // precisely what that lesson says the next caller will do: `page.addInitScript(fn)` and then
  // `rig.load(url)`. The init script was registered on the context `load` throws away, so the
  // watcher it installed never armed and reported ZERO removals — silence indistinguishable
  // from absence, a second time, in the probe written to investigate the first.
  //
  // Anything a caller registers on the page BEFORE a load has to be owned by the rig, because
  // the rig is the thing entitled to replace the page. That is the whole rule; this is its
  // second instance and there will be a third.
  const initScripts = [];
  const applyInit = async (p) => { for (const fn of initScripts) { try { await p.addInitScript(fn); } catch (_) {} } };

  /** Poll a page-evaluated expression until it stops changing. Returns the trace. */
  async function settle(readFn, label = "value", { stableMs = STABLE_MS, ceilingMs = CEILING_MS } = {}) {
    await assertFakeIntact();
    const t0 = Date.now();
    const trace = [];
    let last = Symbol("none"), stableSince = null;
    for (;;) {
      const v = await page.evaluate(readFn).catch(() => null);
      const t = Date.now() - t0;
      if (JSON.stringify(v) !== JSON.stringify(last)) { trace.push([t, v]); last = v; stableSince = t; }
      if (stableSince !== null && t - stableSince >= stableMs && t >= 300) {
        log(`  [settle] ${label} = ${JSON.stringify(v)}  at t=${t}ms  (stable for ${stableMs}ms · ${trace.length} change(s))`);
        return { final: v, ms: t, trace, label, stableMs };
      }
      if (t > ceilingMs) {
        log(`  [settle] ${label} = ${JSON.stringify(v)}  at t=${t}ms  CEILING ${ceilingMs}ms — never settled`);
        return { final: v, ms: t, trace, label, stableMs, ceiling: true };
      }
      await page.waitForTimeout(60);   // the ONLY fixed delay in this file: a poll interval,
                                       // which is not a wait-for-an-outcome. It never stands
                                       // between an action and its assertion — the loop does.
    }
  }

  /** Same-origin stylesheets the page asked for, and whether each actually loaded. */
  async function assertStylesheetsLoaded(url) {
    let bad;
    try {
      bad = await page.evaluate(() => {
        const asked = [...document.querySelectorAll('link[rel~="stylesheet"][href]')]
          .map((l) => l.href)
          .filter((h) => { try { return new URL(h).origin === location.origin; } catch { return false; } });
        if (!asked.length) return [];
        const got = new Map();
        for (const s of document.styleSheets) {
          if (!s.href) continue;
          let n = -1;
          try { n = s.cssRules.length; } catch { n = -1; }   // -1 = present but unreadable
          got.set(s.href, n);
        }
        return asked.filter((h) => !(got.get(h) > 0));
      });
    } catch (_) { return; }                                   // a page with no DOM to ask
    if (bad && bad.length) {
      const e = new Error(
        `RIG PRECONDITION FAILED — ${bad.length} same-origin stylesheet(s) the page asked for did not load:\n` +
        bad.map((b) => "      " + b).join("\n") +
        `\n    Measuring ${url} without them measures a different program. If this is file://, serve the ` +
        `directory over HTTP: root-absolute hrefs cannot resolve from a file path.`);
      e.rigPrecondition = true;
      throw e;
    }
  }

  /** THE DECLARED BACKEND MUST STILL BE THE ONE ANSWERING, at the moment of measurement.
   *  Only meaningful once a check has installed one, so it is a no-op until then — and from then
   *  on it is checked on every settle, which is the call every check already makes. */
  async function assertFakeIntact() {
    let why = null;
    try {
      why = await page.evaluate(() => {
        const f = window.__rigFake;
        if (!f) return null;                                   // no fake declared: nothing to check
        if (typeof f.intact === "function" && !f.intact())
          return "the declared backend was REPLACED after install (a deferred CDN script overwrote window.supabase)";
        return null;
      });
    } catch (_) { return; }
    if (why) { const e = new Error("RIG PRECONDITION FAILED — " + why); e.rigPrecondition = true; throw e; }
  }

  const rig = {
    page, browser,

    /** RULE 1 — a full navigation, never a same-document hash change, then settle. */
    async load(url, { fresh = true } = {}) {
      if (fresh) {
        // A new context per load: a same-document repeat is not an independent trial, and
        // neither is a second load carrying the first one's history entry for this fragment.
        try { await page.close(); await ctx.close(); } catch (_) {}
        ctx = await browser.newContext({ viewport: { width, height } });
        page = await ctx.newPage();
        attachConsole(page);
        await applyInit(page);
        rig.page = page;
      }
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const s = await settle(() => document.readyState + "|" + document.body.innerText.length, "load");
      log(`  [load] ${url}  settled in ${s.ms}ms`);
      await assertStylesheetsLoaded(url);
      return s;
    },

    /** RULE 0 — THE PAGE UNDER TEST IS THE PAGE THAT SHIPPED, STYLES AND ALL.
     *
     *  2026-09-16, twice in two rounds, the rig was EASIER THAN THE PRODUCT and easier meant
     *  measuring a different program:
     *
     *    · check-job-door-open loaded hubly.html over file://. That page links its stylesheets
     *      ROOT-ABSOLUTELY (`/journey-os/operate-pixel.css`), which under file:// resolves to
     *      `file:///journey-os/…` and silently 404s. So the SIX css rules that hid the button
     *      under test were absent, and "the browser paints it" was true of an unstyled page.
     *    · check-day-hours-derived reinstalled a backend fake after load, but authGetClient
     *      CACHES its client — so the product kept answering from the previous fake and a leg
     *      passed on the wrong fixture.
     *
     *  Both were caught by luck. This is the version that cannot be skipped: every load asserts
     *  that every SAME-ORIGIN stylesheet the page asked for actually arrived. Cross-origin sheets
     *  (fonts.googleapis) are expected to be unreadable and are not counted — the question is
     *  whether OUR css is there, not whether the network is.
     *
     *  It throws rather than warns. A warning in a check's output is a thing nobody reads until
     *  after they have quoted the green. */
    async assertStylesheetsLoaded(url) { return assertStylesheetsLoaded(url); },

    /**
     * RULE 2 — click, and PROVE it landed. Returns what changed; throws if nothing did.
     *
     * "Landed" is not "playwright returned". A click can be dispatched at a coordinate no
     * element occupies, or onto an overlay. So the element is resolved first, its box is
     * checked for size, and a marker is written from a real listener the click must fire.
     */
    async click({ selector, witness }) {
      const el = await page.$(selector);
      if (!el) throw new Error(`CLICK DID NOT LAND — no element matches ${selector}`);
      const box = await el.boundingBox();
      if (!box || box.width < 1 || box.height < 1) {
        throw new Error(`CLICK DID NOT LAND — ${selector} has no box (${JSON.stringify(box)}); it is hidden or a zero-size clone`);
      }
      // THE WITNESS GOES ON `document`, NOT ON THE ELEMENT.
      //
      // An element-level listener is defeated by any handler that calls `stopPropagation()`
      // during the CAPTURE phase — document-capture runs before the target, so the click never
      // reaches the element's own listener and the rig reports "did not land" for a control
      // that worked perfectly. Found on the "+ Add service" tile, whose canvas handler is
      // exactly that shape. A document-capture witness still fires, because stopPropagation
      // stops the journey between nodes, not other listeners on the same node.
      // …AND IT WITNESSES `mousedown`, NOT `click`.
      //
      // Second correction from the same control. A click handler that rewrites its own element
      // — `tile.innerHTML = ''` — DETACHES `e.target` before a later listener runs, so
      // `e.target.closest(sel)` finds nothing and the rig reports a control that worked as one
      // that did not. `mousedown` fires before any click handler, so the target is still in the
      // document when the witness reads it. `click` is kept as a second signal for controls
      // driven by keyboard or by a synthetic dispatch.
      await page.evaluate((sel) => {
        window.__rigClicked = 0;
        const hit = (e) => { try { if (e.target && e.target.closest && e.target.closest(sel)) window.__rigClicked++; } catch (_) {} };
        document.addEventListener("mousedown", function m(e) { hit(e); document.removeEventListener("mousedown", m, true); }, true);
        document.addEventListener("click", function w(e) { hit(e); document.removeEventListener("click", w, true); }, true);
      }, selector);
      // ONE VOCABULARY, AND FAST. Playwright retries a blocked click for 30s and then throws
      // its own verbose error; a covered control is an instrument failure we want in 2s, in
      // the rig's words, so a caller never has to parse someone else's stack.
      try {
        await el.click({ timeout: (opts.clickTimeoutMs || 2000) });
      } catch (e) {
        const why = /intercepts pointer events/.test(String(e.message)) ? "something is covering it" : String(e.message).split("\n")[0];
        throw new Error(`CLICK DID NOT LAND — ${selector}: ${why}`);
      }
      const landed = await page.evaluate(() => window.__rigClicked || 0);
      if (!landed) throw new Error(`CLICK DID NOT LAND — ${selector} received no click event (an overlay or a moved element)`);
      log(`  [click] ${selector}  landed (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)})`);
      if (witness) {
        const w = await settle(witness, "witness");
        return { landed: true, witness: w };
      }
      return { landed: true };
    },

    /** RULE 3 — poll any page value until stable. */
    settle,
    settleScroll(o) { return settle(() => Math.round(window.scrollY), "scrollTop", o); },

    /**
     * RULE 4 — the write receipt. Value asked, value read, and WHEN.
     *
     * A null result without a timestamp is not a finding. Had `t=0ms` been printed beside the
     * zeros on 2026-09-13, the shape would have been obvious on the first pass instead of the
     * fourth theory.
     */
    expect({ what, asked, read, ms, tolerance = 0 }) {
      const ok = typeof asked === "number" && typeof read === "number"
        ? Math.abs(asked - read) <= tolerance
        : JSON.stringify(asked) === JSON.stringify(read);
      log(`  [write] ${what}  asked=${JSON.stringify(asked)}  read=${JSON.stringify(read)}  at t=${ms}ms  ${ok ? "MATCH" : "DIFFERS"}`);
      return ok;
    },

    /** Register a page-world init script that SURVIVES every reload. Use this, never
     *  `rig.page.addInitScript` — see the note above `initScripts`. */
    async addInitScript(fn) { initScripts.push(fn); await page.addInitScript(fn).catch(() => {}); },

    /** Everything the page has logged, across every reload. */
    get consoleLines() { return consoleLines.slice(); },
    /** A mark to read from; pass it to consoleSince() after the action. */
    consoleMark() { return consoleLines.length; },
    consoleSince(mark) { return consoleLines.slice(mark); },

    async shot(path) { await page.screenshot({ path, fullPage: false }); log(`  [shot] ${path}`); return path; },
    async close() { try { await ctx.close(); } catch (_) {} await browser.close(); },
  };
  return rig;
}

/**
 * SETTLE ON A PAGE THE CALLER ALREADY OWNS.
 *
 * The rig above owns its browser. Most existing scripts already have a Playwright `page` and
 * only need the one thing a fixed delay cannot give them: a reading that stopped changing,
 * with the window that was assumed printed beside it. This is that, and nothing else.
 *
 *   const r = await settleOn(page, () => document.body.innerText.length, "reply text");
 *   //   [settle] reply text = 812  at t=1240ms  (stable for 800ms · 3 change(s))
 */
export async function settleOn(page, readFn, label = "value", { stableMs = STABLE_MS, ceilingMs = CEILING_MS, quiet = false } = {}) {
  const t0 = Date.now();
  const trace = [];
  let last = Symbol("none"), stableSince = null;
  for (;;) {
    const v = await page.evaluate(readFn).catch(() => null);
    const t = Date.now() - t0;
    if (JSON.stringify(v) !== JSON.stringify(last)) { trace.push([t, v]); last = v; stableSince = t; }
    const done = stableSince !== null && t - stableSince >= stableMs && t >= 300;
    if (done || t > ceilingMs) {
      if (!quiet) {
        console.log(`  [settle] ${label} = ${JSON.stringify(v)}  at t=${t}ms  ` +
          (done ? `(stable for ${stableMs}ms · ${trace.length} change(s))` : `CEILING ${ceilingMs}ms — never settled`));
      }
      return { final: v, ms: t, trace, label, stableMs, ceiling: !done };
    }
    await page.waitForTimeout(60);
  }
}

/**
 * POLL ANYTHING UNTIL A CONDITION HOLDS — for the non-browser waits (a row appearing, a job
 * dispatching). Returns as soon as the predicate is true, and says how long it took; on a
 * timeout it says THAT rather than returning a value that looks settled.
 *
 *   const r = await settleUntil(() => countRows(), (n) => n > before, { label: "outcome row" });
 *   if (r.timedOut) …   // a distinct outcome, never confused with "the value is still 0"
 */
export async function settleUntil(readFn, predicate, { label = "value", everyMs = 250, ceilingMs = 15000, quiet = false } = {}) {
  const t0 = Date.now();
  let v;
  for (;;) {
    v = await readFn();
    const t = Date.now() - t0;
    if (predicate(v)) {
      if (!quiet) console.log(`  [settle] ${label} = ${JSON.stringify(v)}  satisfied at t=${t}ms`);
      return { final: v, ms: t, timedOut: false };
    }
    if (t > ceilingMs) {
      if (!quiet) console.log(`  [settle] ${label} = ${JSON.stringify(v)}  NEVER SATISFIED within ${ceilingMs}ms`);
      return { final: v, ms: t, timedOut: true };
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
}
