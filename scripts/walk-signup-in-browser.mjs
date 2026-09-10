/**
 * DRIVE THE REAL CLIENT. Not a hand-built fetch — the actual page, the actual composer.
 *
 * The fetch harness and the browser have now disagreed FOUR times about whether signup
 * asks for the business name: the harness said yes 3/3, and three separate real-browser
 * runs said no. A request-body diff said they were effectively identical, so I concluded
 * the harness must be right and the browser runs were variance. Four disagreements says
 * that conclusion was wrong and the difference is somewhere the diff did not look.
 *
 * This removes the whole class of question: no hand-built body, no guessed headers, no
 * assumption about what the client sends — the client sends it. It also captures the real
 * request off the network layer so it can be put side by side with the harness's.
 *
 * THE DIVISION OF LABOUR, stated so neither instrument gets asked to do the other's job:
 *   first_turn_outcomes  — volume and rate, from real traffic, continuously, free.
 *                          Records ONE turn; blind to anything that supersedes it.
 *   this walker          — what a person is actually left looking at, one run at a time,
 *                          at the price of a signup. Sees the whole conversation settle.
 * Tonight proved both directions: the counter said the name was asked (true) while the
 * owner was never asked (also true), and only driving the real client showed why.
 *
 * Usage: node scripts/walk-signup-in-browser.mjs "your sentence"
 * Exit: 0 ran · 2 could not run
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const SAY = process.argv[2] || "Im an avation pilot I need a website";
const SITE = process.env.HUBLY_SITE || "https://myhubly.app";

console.log(`\n  THIS RUN WILL CREATE 1 DRAFT BUSINESS AND GENERATE 1 WEBSITE (~3% of a top-up).`);
console.log(`  Driving the REAL client at ${SITE} — headless Chromium, real composer.\n`);

const browser = await chromium.launch();
// A clean context every time: no stored draft, no session — a stranger arriving cold.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const captured = [];
page.on("request", (r) => {
  if (r.url().includes("/functions/v1/hubly-conversation")) {
    captured.push({ url: r.url(), method: r.method(), headers: r.headers(), body: r.postData() });
  }
});
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });

try {
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 45000 });
  const input = page.locator("#heroInput");
  await input.waitFor({ state: "visible", timeout: 20000 });
  await input.click();
  await input.type(SAY, { delay: 25 });          // typed, not set — the way a person does it
  await input.press("Enter");

  // Wait for Hubly to actually say something back.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-hc-msg], .hc-msg, .hc-bubble').length > 1,
    null, { timeout: 120000 },
  ).catch(() => {});
  // WAIT FOR THE PAGE TO LAND AND THE POST-BUILD TURN TO FIRE. This is the part no
  // previous harness ever saw: the build takes 100-150s, and only when the page appears
  // does the client fire hcPostBuildTurn() — a SECOND model turn. The name question lives
  // in the FIRST turn's narration; the second turn is what the owner is left looking at.
  // Stopping at 20s measures the half of the conversation that was never in dispute.
  await page.waitForTimeout(210000);

  const shown = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.hc-msg, .hc-bubble, [data-hc-msg]').forEach((el) => {
      const t = (el.innerText || "").trim();
      if (t) out.push(t);
    });
    return out;
  });

  console.log("WHAT A PERSON SEES ON SCREEN:");
  shown.forEach((t, i) => console.log(`  [${i + 1}] ${t.replace(/\s+/g, " ").slice(0, 300)}`));

  const all = shown.join("\n");
  const asked = /what(?:'s| is| are| do)?[^.?!]{0,60}\b(call(?:ed)?|name)\b/i.test(all);
  console.log(`\n  ASKED FOR THE BUSINESS NAME anywhere on screen: ${asked ? "YES" : "NO"}`);
  const last = shown[shown.length - 1] || "";
  const lastAsksName = /what(?:'s| is| are| do)?[^.?!]{0,60}\b(call(?:ed)?|name)\b/i.test(last);
  const lastAsksPrice = /charge|price|book you for/i.test(last);
  console.log(`  THE LAST THING THEY ARE LOOKING AT: ${lastAsksName ? "the name question" : lastAsksPrice ? "a SERVICES/PRICE question" : "neither"}`);
  if (consoleErrors.length) console.log(`  console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);

  // ── THE NAME TURN, AND THE SYMPTOM THAT MUST NOT SURVIVE ────────────────────────────
  // Naming an unclaimed draft renames it (slug_follows_name). On 2026-09-10 that left the
  // preview pointing at an address which had stopped resolving, so the owner's site went
  // BLANK at the exact moment he named it. Answering the name question and then checking
  // the preview is still rendering is the whole point of this run.
  const NAME = process.env.HUBLY_TEST_NAME || "Bright & Clear Window Care";
  const composer = page.locator("#hcInput");
  if (await composer.count()) {
    await composer.click();
    await composer.type(NAME, { delay: 25 });
    await composer.press("Enter");
    await page.waitForTimeout(45000);

    const after = await page.evaluate(() => {
      // READ THE LIVE FRAME, NOT FRAME A. hcRefreshCanvasFrame loads the STANDBY frame and
      // swaps `is-live`, so frame A is stale BY DESIGN after any refresh — reading it
      // reported a stale src and stale content and made a broken run look fine.
      const f = document.querySelector("#hcCanvasFrameA.is-live, #hcCanvasFrameB.is-live")
             || document.querySelector("#hcCanvasFrameA");
      let inner = "";
      try { inner = f?.contentDocument?.body?.innerText?.slice(0, 400) || ""; } catch { inner = "(cross-origin — cannot read, which is normal)"; }
      const pill = document.querySelector("#hcAddressPill");
      return { src: f?.getAttribute("src") || "", pill: (pill?.innerText || "").trim(), inner };
    });
    console.log(`\n  AFTER THE NAME TURN`);
    console.log(`    address shown : ${after.pill}`);
    console.log(`    preview src   : ${after.src.slice(0, 90)}`);
    const blank = /isn.t live yet|still setting things up|Go to Hubly/i.test(after.inner);
    console.log(`    preview state : ${blank ? "*** BLANK — the not-live gate (THE REGRESSION) ***" : "rendering the page"}`);
    if (after.inner) console.log(`    preview text  : ${after.inner.replace(/\s+/g, " ").slice(0, 140)}`);
    await page.screenshot({ path: "/tmp/after-name.png", fullPage: false });
    console.log(`    screenshot    : /tmp/after-name.png`);
  } else {
    console.log("\n  (no #hcInput composer found — could not run the name turn)");
  }

  writeFileSync("/tmp/browser-request.json", JSON.stringify(captured, null, 2));
  console.log(`  captured ${captured.length} hubly-conversation request(s) -> /tmp/browser-request.json`);
  await page.screenshot({ path: "/tmp/browser-signup.png", fullPage: false });
} catch (e) {
  console.error("CANNOT RUN —", String(e).slice(0, 200));
  await browser.close();
  process.exit(2);
}
await browser.close();
