#!/usr/bin/env node
/**
 * NOTHING IN HUBLY RENDERS SQUEEZED.
 *
 *   node scripts/check-nothing-squeezed.mjs
 *
 * ADRIAN'S STANDING RULE, 2026-09-15: "the check my sales edit my website things on this view
 * are too squeezed. i know those things will be fixed because they are not supposed to be there,
 * but we should not have squeezed things like that, it doesn't look good."
 *
 * Not a fix for two cards — whatever stands there next has the same rail and the same widths. At
 * every width a surface can reach: text does not break inside a word, labels do not crush,
 * controls do not overlap, nothing clips. A thing that cannot be shown properly at a width
 * CHANGES SHAPE — stacks, truncates at a word boundary, or is not shown — never mangled.
 *
 * IT MEASURES GEOMETRY, NOT PRESENCE. "the label is there" passes happily on "Chec k my sales":
 * the string is intact and the RENDERING is broken. squeezeProbe puts a Range around each word
 * and asks the browser where that word actually landed; a word whose rects sit on two lines was
 * split. That is the distinction Lesson 83 is about, applied to layout.
 *
 * SIMULATED AND SAID SO: no session; the backend is the declared fake in lib/owner-rig.mjs. The
 * CSS, the widths and the layout are the product's.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake, fakeIntact, squeezeProbe } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "B", slug: "hubly-classic-fixture", name: "Hubly Classic Fixture",
              url: "https://hubly-classic-fixture.myhubly.app", hasPage: true };
const iso = (d) => { const x = new Date(Date.now() + d * 864e5);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

/** A FULL account. An empty one offers no cards and would hide the very things he screenshotted. */
const FULL = {
  uid: "u", email: "adriansmithee+ever@gmail.com", displayName: "Adrian",
  // THE PLACES A BUSINESS CAN ACTUALLY HAVE. `planner` was in this list and stopped being a
  // surface on 2026-09-16 (My Day is what Home renders), so the fixture was claiming a place the
  // product no longer has — harmless here because hcWorkspaces filters unknown kinds, and
  // exactly the kind of stale fixture that later "proves" a surface exists. A fake must describe
  // the world owners live in (owner-rig.mjs), including when that world changes.
  places: ["website", "jobs", "customers"].map((k, i) => ({ kind: k, scope: "workspace", visible: true, sort_order: (i + 1) * 10 })),
  hours: [{ weekday: 1, open: "08:00", close: "17:00", closed: false }],
  tables: {
    jobs: [
      { id: "b1", business_id: "B", service_name: "doctor’s appointment", scheduled_date: iso(1), scheduled_time: "07:00:00",
        duration_hours: 2, amount: null, status: "scheduled", address: null, is_block: true, paid: false },
      { id: "j1", business_id: "B", customer_name: "Bob Jones", service_name: "driveway", scheduled_date: iso(2),
        scheduled_time: "14:00:00", amount: 180, status: "scheduled", address: "14 Maple St", is_block: false, paid: true },
    ],
    customers: [{ id: "c1", name: "Bob Jones", phone: "8015550134", jobs_count: 2 }],
    booking_requests: [{ id: "r1", business_id: "B", status: "pending" }],
    services: [{ id: "s1", business_id: "B", name: "driveway", price: 180 }],
  },
};

/**
 * THE WIDTHS TESTED, AND WHY THEY GO BELOW WHAT THE PANE CAN REACH TODAY.
 *
 * Measured: the thread pane is `flex:0 0 380px` and does not shrink with the viewport, so 380 is
 * its nominal width in every mode with a right pane. But Adrian SAW words break at what should
 * have been 380, which means his effective label box was narrower than the nominal one — a
 * larger system font, browser zoom, or a narrower window all do that, and none of them is a
 * state we control. So the floor is tested well below the nominal width: a layout that only
 * holds at exactly 380px is one system-font setting away from breaking again.
 */
const WIDTHS = [380, 340, 300, 260, 220];

let rig;
try { rig = await openRig({ width: 1440, height: 900 }); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session. The CSS, the widths and the layout are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, FULL);
  await rig.page.evaluate((b) => { window.hublyArrivalUI.simulate(b, true); }, BIZ);
  await rig.settle(() => document.querySelectorAll("[data-promise]").length, "furniture", { stableMs: 800, ceilingMs: 9000 });
  await rig.page.evaluate(() => window.hublyThreadViews.show("day"));
  await rig.settle(() => document.querySelectorAll('[data-hc-view-row="day"]').length, "day rows", { stableMs: 500, ceilingMs: 6000 });

  // ══ LEG 0 FOR THE HARNESS, AT THE MOMENT OF MEASUREMENT ══════════════════════════════
  //
  // Not at install time — that proves nothing, because the page has not asked for a client yet.
  // HERE, after everything has rendered, is where "was the backend I declared the backend that
  // answered?" is a real question.
  //
  // 2026-09-16: the real supabase-js arrives as a DEFERRED script from the CDN and overwrites
  // window.supabase, so a fake installed before load is replaced, every read fails, and the app
  // renders its unreadiness paths. A room that could not read anything then looks exactly like a
  // room that works. Refuse to report rather than measure a broken app.
  {
    const why = await rig.page.evaluate(fakeIntact);
    if (why) { console.error("CANNOT RUN — " + why); await rig.close(); process.exit(2); }
  }

  // ── 0. THE PROBE MUST BE LOOKING AT SOMETHING. ──────────────────────────────────────
  //
  // A layout sweep that renders nothing reports zero problems and reads like success — the
  // first run of measure-squeeze.mjs did exactly that, because the shell was never revealed and
  // every pane measured 0 wide.
  const present = await rig.page.evaluate(() => ({
    cards: document.querySelectorAll(".hc-act").length,
    chips: document.querySelectorAll(".hc-sugg").length,
    rows: document.querySelectorAll('[data-hc-view-row="day"]').length,
    paneW: Math.round((document.querySelector(".hc-app-left") || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
  }));
  say("0 the surface actually rendered, so everything below is measuring something",
    present.cards > 0 && present.rows > 0 && present.paneW > 100,
    `${present.cards} card(s), ${present.chips} chip(s), ${present.rows} day row(s), pane ${present.paneW}px`);
  if (!(present.cards > 0 && present.rows > 0)) {
    console.error("CANNOT RUN — nothing rendered; a clean result here would be meaningless.");
    await rig.close(); process.exit(2);
  }

  // ── 1. AT EVERY WIDTH, NOTHING BREAKS MID-WORD AND NOTHING CLIPS. ───────────────────
  for (const w of WIDTHS) {
    await rig.page.evaluate((px) => { document.querySelector(".hc-app-left").style.flex = "0 0 " + px + "px"; }, w);
    await rig.page.waitForTimeout(160);
    const r = await rig.page.evaluate(squeezeProbe);
    say(`1@${w}px nothing breaks inside a word, nothing clips`,
      r.brokenWords.length === 0 && r.clipped.length === 0,
      r.brokenWords.length || r.clipped.length
        ? `${r.brokenWords.length} broken: ${JSON.stringify(r.brokenWords.slice(0, 4).map((b) => b.word + " @" + b.where))}` +
          `${r.clipped.length ? ` · ${r.clipped.length} clipped: ${JSON.stringify(r.clipped.slice(0, 3).map((c) => c.where))}` : ""}`
        : "clean");
  }

  // ── 1b. MY DAY — HOME'S OWN SURFACE, at every width the pane can reach. ────────────
  //
  // Added 2026-09-16 with the surface itself, because the rule is "nothing renders squeezed at
  // any width, ON ANY SURFACE" and a sweep that only ever looks at the card rail is a sweep that
  // certifies one corner. My Day is a three-column layout with a four-column grid inside it —
  // exactly the shape that collapses to min-content first.
  const dayProbe = await rig.page.evaluate(async (widths) => {
    if (!(window.hublyDayUI && window.hublyDayUI.render)) return { skipped: "no hublyDayUI.render" };
    const host = document.createElement("div");
    host.className = "hc-inthread-day";
    host.style.position = "fixed"; host.style.top = "0"; host.style.left = "0";
    document.body.appendChild(host);
    const out = [];
    for (const w of widths) {
      host.style.width = w + "px";
      await window.hublyDayUI.render(host, { id: "B", slug: "s", name: "N", url: "https://s.myhubly.app" });
      await new Promise((r) => setTimeout(r, 60));
      // A box wider than its own container is clipped or overflowing, either way unreadable.
      const over = [...host.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 2
        && getComputedStyle(e).overflowX === "visible" && e.clientWidth > 0)
        .map((e) => (e.className || e.tagName) + " " + e.scrollWidth + ">" + e.clientWidth);
      // A column crushed to nothing is the min-content collapse.
      const crushed = [...host.querySelectorAll(".hcmd-cols span, .hcmd-tile, .hcmd-calh")]
        .filter((e) => e.getBoundingClientRect().width < 8)
        .map((e) => e.textContent.trim() || e.className);
      out.push({ w, over: over.slice(0, 3), crushed: crushed.slice(0, 3) });
    }
    host.remove();
    return { out };
  }, [1280, 1024, 900, 760, 620]);
  if (dayProbe.skipped) {
    say("1b My Day was reachable to sweep", false, dayProbe.skipped);
  } else {
    dayProbe.out.forEach((r) => {
      say(`1b@${r.w}px My Day: nothing overflows, no column crushed`,
        r.over.length === 0 && r.crushed.length === 0,
        r.over.length || r.crushed.length
          ? `over: ${JSON.stringify(r.over)} crushed: ${JSON.stringify(r.crushed)}`
          : "clean");
    });
  }

  // ── 2. AND THE LABELS DID NOT CRUSH. One line is the point of the stacking rule. ────
  await rig.page.evaluate(() => { document.querySelector(".hc-app-left").style.flex = "0 0 380px"; });
  await rig.page.waitForTimeout(160);
  const labels = await rig.page.evaluate(() => {
    return [...document.querySelectorAll(".hc-act-nm")].map((e) => {
      const r = e.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(e).lineHeight) || 20;
      return { text: e.textContent, lines: Math.round(r.height / lh), w: Math.round(r.width) };
    });
  });
  say("2 a card label is one line at the pane's real width, not two or three",
    labels.length > 0 && labels.every((l) => l.lines <= 1),
    labels.map((l) => `${JSON.stringify(l.text)}=${l.lines}ln/${l.w}px`).join(" "));

  // ── 3. THE ENABLING RULE IS GONE FROM LABELS. ───────────────────────────────────────
  //
  // `.hc-msg{overflow-wrap:anywhere}` is correct for a chat bubble — it rescues a pasted URL.
  // The cards, chips and record cards are all `.hc-msg`, so they inherited permission to split a
  // word, and THAT is what produced "Chec k my sales". A label has no unbreakable token to
  // rescue. Asserted on the computed style, because the CSS file is not the browser.
  const wraps = await rig.page.evaluate(() => {
    const get = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).overflowWrap : null; };
    return { label: get(".hc-act-nm"), chip: get(".hc-sugg"), card: get(".hc-job-card-t"), bubble: get(".hc-msg.hubly") };
  });
  say("3 labels may not split a word; a chat bubble still may",
    wraps.label === "normal" && wraps.chip === "normal" && wraps.card === "normal" && wraps.bubble === "anywhere",
    JSON.stringify(wraps));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally { try { await rig.close(); } catch (_) {} }

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nNothing renders squeezed at any width the surface can reach.");
process.exit(failed ? 1 : 0);
