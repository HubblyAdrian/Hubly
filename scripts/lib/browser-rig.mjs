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

  /** Poll a page-evaluated expression until it stops changing. Returns the trace. */
  async function settle(readFn, label = "value", { stableMs = STABLE_MS, ceilingMs = CEILING_MS } = {}) {
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
        rig.page = page;
      }
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const s = await settle(() => document.readyState + "|" + document.body.innerText.length, "load");
      log(`  [load] ${url}  settled in ${s.ms}ms`);
      return s;
    },

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
      await page.evaluate((sel) => {
        const e = document.querySelector(sel);
        window.__rigClicked = 0;
        e.addEventListener("click", () => { window.__rigClicked++; }, { once: true, capture: true });
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
