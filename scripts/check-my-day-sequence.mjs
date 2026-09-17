#!/usr/bin/env node
/**
 * [RULE] THE SEQUENCE — ASK · RENDER IN THE THREAD · OFFER · ACCEPT · THE TAB EXISTS · OPEN IT.
 *
 *   node scripts/check-my-day-sequence.mjs
 *
 * ══ WHAT ADRIAN DESCRIBED, 2026-09-17 ═══════════════════════════════════════════════════════
 *
 *   1. HOME IS THE MAIN CHAT. Full width, conversation-first — not a narrow column with a
 *      panel beside it.
 *   2. He asks for his schedule.
 *   3. IT RENDERS INLINE IN THE THREAD.
 *   4. IT OFFERS TO BECOME A TAB.
 *   5. He accepts → MY DAY IS CREATED AS A TAB, and it persists.
 *   6. OPENING THAT TAB is where the chat moves left, the day takes the middle, the calendar
 *      sits to the right.
 *
 *   "HOME IS CURRENTLY SHOWING STEP 6'S LAYOUT AT STEP 1." That was the defect: the after-state
 *   was being rendered before anything had triggered it, so steps 2–5 had nothing left to do.
 *
 * ══ EVERY LEG DISPATCHES A REAL EVENT ON A REAL ELEMENT ═════════════════════════════════════
 *
 * "A CHECK THAT CALLS THE FUNCTION IS NOT A CHECK THAT THE CONTROL WORKS" (Adrian, 2026-09-17).
 * So the day is asked for by CLICKING the Home card an owner would click, the tab is accepted by
 * CLICKING "Yes, add it", and the room is opened by CLICKING the rail tab. Not one leg calls
 * hublyDayUI.inThread, hcOfferSidebarTab or openWorkspace.
 *
 * [RULE] throughout. No leg asserts a count of tabs, a pixel size, or a class beyond the identity
 * of the control being touched — the two width legs assert a RELATION (Home's chat spans the app;
 * the day room leaves the chat present and narrower), which stays true if the design changes size.
 *
 * ══ WHAT IS SIMULATED, SAID PLAINLY ═════════════════════════════════════════════════════════
 *
 * There is no session here. The backend is scripts/lib/owner-rig.mjs. Leg 9 proves the CLIENT
 * half of persistence — a fresh load whose server holds the row paints the tab with nothing
 * clicked — and leg 7 proves the write goes out with this owner's id. That the RPC itself
 * durably stores the row needs Adrian signed in on the real thing; it is not proved here.
 *
 * ══ RED-PROOFED PER LEG ═════════════════════════════════════════════════════════════════════
 *
 * "A BREAK THAT LEAVES A LEG GREEN HAS NOT TESTED IT", and a break that never applied has not
 * tested anything. Every leg below was SEEN RED, by a break aimed at it, in public/platform-home.html:
 *
 *   1    Home keeps a second pane          [data-mode="home"] .hc-app-right{display:flex}
 *   2    Home draws the day itself         hcRenderHome renders hcRenderMyDay into #hcCanvas
 *   3,3b the card is never offered         the schedule promise's needs() returns false
 *   4    the card does nothing             `if(p.view) hcShowInThread(p.view)` disabled
 *   5,7  the day is drawn in silence       the "Here's your day —" sentence deleted
 *   6    it never offers                   hcOfferSidebarTab removed from hcShowDayInThread
 *   7    it offers over him                the offer moved above the sentence
 *   8    an unearned tab in the rail       hcWorkspaces concats a planner row nobody earned
 *   9    the write loses the owner         p_owner_id dropped from the add_business_place call
 *   10   no repaint after the write        hcRenderRail removed from the accept handler
 *   11   it works and says nothing         the "Got it — I've added My Day" message deleted
 *   12   the rail ignores the row          hcWorkspaces filters planner out
 *   13,15 the tab has no room behind it    planner removed from HC_ROOMS
 *   14   the day eats the chat             [data-mode="planner"] .hc-app-left{display:none}
 *   15   the calendar stacks underneath    .hcmd{flex-direction:column}
 *   16   the no takes the day away too     the decline handler removes the in-thread day
 *   17   the no is heard silently          the "I won't ask again" message deleted
 *   17b,18 the no is not written down      hcRememberTabDeclined's setItem removed
 *   19   it offers what he already has     the hcWorkspaces guard removed from the offer
 *
 * TWO OF THOSE BREAKS CAUGHT A DEFECT IN THIS FILE RATHER THAN IN THE PRODUCT, which is the
 * whole point of doing it:
 *   · leg 11 asked "does any message mention the sidebar" and the OFFER ITSELF says "…as a tab in
 *     your sidebar?", so deleting the confirmation left it green. It now compares against the
 *     messages present BEFORE the click and requires a new one that names the tab.
 *   · legs 5 and 7 scanned `.hc-msg`, and the in-thread day host IS a `.hc-msg` — the rendered
 *     surface satisfied a leg about the sentence. Scoped to `.hc-msg:not(.hc-inthread-day)`.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// SERVED, NOT file://. localStorage THROWS on a file:// origin in Chromium, so the decline the
// product stores would be silently unstorable and leg 18 would be measuring the harness's origin
// rather than the product's memory. It is also the origin an owner is actually on.
const srv = await servePublic(ROOT);
const PAGE = srv.url("platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const UID = "00000000-0000-0000-0000-0000000000aa";
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", url: "https://hubly-classic-fixture.myhubly.app" };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());
const JOBS = [
  { id: "j1", business_id: BIZ.id, customer_name: "Leslie Ammons", service_name: "Full Detail", scheduled_date: TODAY,
    scheduled_time: "12:00:00", duration_hours: 3, amount: 180, status: "scheduled", is_block: false },
];
const TASKS = [
  { id: "t1", business_id: BIZ.id, title: "Order glass cleaner", due_date: TODAY, due_time: null, band: "C",
    band_source: "owner", lane: "work", status: "open", roll_count: 0 },
];
/** ONLY the website row — My Day has NOT been earned yet. That is the state the sequence starts in. */
const PLACES_BEFORE = [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }];
const PLACES_AFTER = PLACES_BEFORE.concat([{ kind: "planner", scope: "workspace", visible: true, sort_order: 20 }]);

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/** A fresh claimed Home, exactly as an owner arrives at it. Reload between scenarios (rig rule 1). */
/** ══ WHY THE "LATER VISIT" IS A FRESH CONTEXT CARRYING WHAT THE PRODUCT WROTE ═══════════════
 *
 *  The obvious move — reload the same browser with `fresh: false` — measures something else. On a
 *  warm reload supabase-js is already in the HTTP cache, so it wins the race against the fake and
 *  `authClient` is built from the REAL sdk before the fake is installed: zero rpc calls, an app
 *  reading nothing, and legs that would be reporting on a broken instrument (the same trap
 *  owner-rig's `intact()` note describes, arriving from the other side).
 *
 *  So a later visit is a fresh context that carries FORWARD exactly the localStorage the product
 *  itself wrote — captured from the page, never a key typed in here. What is proved is the
 *  product's half: what it stored is enough to change what the next visit does. That the browser
 *  keeps localStorage between visits is the browser's promise, not ours, and is not tested here. */
async function arrive(places, carryStorage, opts) {
  await rig.load(PAGE);
  if (carryStorage) {
    await rig.page.evaluate((entries) => {
      try { for (const [k, v] of entries) localStorage.setItem(k, v); } catch (e) {}
    }, carryStorage);
  }
  await rig.page.evaluate(installOwnerFake, {
    uid: UID, email: "owner@example.com", displayName: "Adrian", places,
    tables: { jobs: JOBS, tasks: TASKS, customers: [], events: [] },
    refuseAddPlace: !!(opts && opts.refuseAddPlace),
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 400));
  }, { biz: BIZ });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }
}
/** The real click, on the real element, after confirming it is there and visible. */
async function press(sel, text) {
  return rig.page.evaluate(async ({ sel, text }) => {
    const all = [...document.querySelectorAll(sel)];
    const el = text ? all.filter((e) => (e.textContent || "").trim() === text)[0] : all[0];
    if (!el) return { pressed: false, why: "no element matching " + sel + (text ? ` with text "${text}"` : "") };
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return { pressed: false, why: "the element is present but has no box" };
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((x) => setTimeout(x, 450));
    return { pressed: true };
  }, { sel, text });
}
const rail = () => rig.page.evaluate(() =>
  [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()));

try {
  console.log("SIMULATED OWNER — no session, no network. Every control below is pressed for real.\n");

  // ── STEP 1 ────────────────────────────────────────────────────────────────────────────
  await arrive(PLACES_BEFORE);
  const home = await rig.page.evaluate(() => {
    const app = document.getElementById("hcApp");
    const left = document.querySelector(".hc-app-left"), right = document.querySelector(".hc-app-right");
    const railEl = document.querySelector(".hc-rail");
    return { mode: app.getAttribute("data-mode"),
             appW: app.getBoundingClientRect().width,
             railW: railEl ? railEl.getBoundingClientRect().width : 0,
             leftW: left.getBoundingClientRect().width,
             rightShown: getComputedStyle(right).display !== "none",
             card: !!document.querySelector('.hc-act[data-promise="schedule"]'),
             dayOnHome: document.querySelectorAll("#hcCanvas .hcmd-main").length };
  });
  say("1 [RULE] HOME IS THE CONVERSATION — the chat takes everything the rail does not, with no second pane beside it",
      home.leftW >= (home.appW - home.railW) - 2 && home.rightShown === false,
      `chat ${Math.round(home.leftW)}px of the ${Math.round(home.appW - home.railW)}px beside the rail · second pane shown: ${home.rightShown}`);
  say("2 [RULE] and Home does not open the day by itself — step 6's surface is not rendered at step 1",
      home.dayOnHome === 0, `${home.dayOnHome} day surface(s) in the canvas`);

  // ── STEP 2 ────────────────────────────────────────────────────────────────────────────
  say("3 [RULE] there is a real control for asking to see the schedule",
      home.card === true, 'button.hc-act[data-promise="schedule"]');
  const asked = await press('.hc-act[data-promise="schedule"]');
  if (!asked.pressed) { say("3b the schedule control could be pressed", false, asked.why); }

  // ── STEP 3 ────────────────────────────────────────────────────────────────────────────
  const drawn = await rig.page.evaluate(() => {
    const day = document.querySelector("#hcThread .hc-inthread-day, .hc-thread .hc-inthread-day, .hc-inthread-day");
    // NOT the day itself: the in-thread day host carries .hc-msg, so an unscoped scan lets the
    // SURFACE satisfy a leg about the SENTENCE (caught by red-proofing: deleting the sentence left
    // the leg green because the rendered day says "My Day" inside it).
    const msgs = [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")];
    const offer = document.querySelector("[data-hc-tab-offer]");
    return {
      inThread: !!day,
      inCanvas: !!document.querySelector("#hcCanvas .hc-inthread-day"),
      bands: day ? day.querySelectorAll(".hcmd-band").length : 0,
      cal: day ? day.querySelectorAll(".hcmd-calrow").length : 0,
      rows: day ? day.querySelectorAll(".hcmd-row").length : 0,
      sentence: msgs.map((m) => m.textContent.trim()).filter((t) => /your day/i.test(t)).slice(-1)[0] || null,
      offerAfterSentence: (() => {
        if (!offer) return null;
        const said = msgs.filter((m) => /your day/i.test(m.textContent || ""));
        if (!said.length) return null;
        return !!(said[said.length - 1].compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
      offerText: offer ? (offer.previousElementSibling || {}).textContent || null : null,
      offerButtons: offer ? [...offer.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
    };
  });
  say("4 [RULE] pressing it draws the day IN THE CONVERSATION, not in a room",
      drawn.inThread && !drawn.inCanvas && drawn.bands >= 3 && drawn.cal >= 1,
      `${drawn.bands} bands · ${drawn.cal} calendar hours · ${drawn.rows} rows`);
  say("5 [RULE] and it says what is on it, in words",
      !!drawn.sentence, JSON.stringify(drawn.sentence));

  // ── STEP 4 ────────────────────────────────────────────────────────────────────────────
  say("6 [RULE] THEN it offers to become a tab — a real control with a yes and a no",
      drawn.offerButtons.length === 2, drawn.offerButtons.join(" / ") || "no offer");
  say("7 [RULE] the offer comes AFTER the day was described — one ask at a time, never over him",
      drawn.offerAfterSentence === true, `offer follows the sentence: ${drawn.offerAfterSentence}`);
  const before = await rail();
  say("8 [RULE] and it is not offering something he already has",
      !before.some((t) => /my day/i.test(t)), `rail: ${before.join(" · ")}`);

  // ── STEP 5 ────────────────────────────────────────────────────────────────────────────
  // WHAT WAS ALREADY SAID, BEFORE THE CLICK. Leg 11 asked "does any message mention the sidebar",
  // and the OFFER ITSELF mentions it ("Want me to keep this as a tab in your sidebar?") — so the
  // leg passed with the confirmation deleted. A leg that can be satisfied by the question it is
  // checking the answer to is not checking anything.
  const saidBefore = await rig.page.evaluate(() =>
    [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")].map((m) => m.textContent.trim()));
  const yes = await press("[data-hc-tab-offer] button", "Yes, add it");
  if (!yes.pressed) say("8b the yes could be pressed", false, yes.why);
  const accepted = await rig.page.evaluate((before) => ({
    writes: (window.__rig.writes || []).filter((w) => w.name === "add_business_place"),
    rail: [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()),
    said: [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")].map((m) => m.textContent.trim())
            .filter((t) => before.indexOf(t) < 0)
            .filter((t) => /my day/i.test(t) && /sidebar/i.test(t)).slice(-1)[0] || null,
    offerGone: !document.querySelector("[data-hc-tab-offer]"),
  }), saidBefore);
  const w = accepted.writes[0];
  say("9 [RULE] YES writes the place, for this owner, on this business",
      !!w && w.args.p_kind === "planner" && w.args.p_scope === "workspace" &&
      w.args.p_owner_id === UID && w.args.p_id === BIZ.id,
      w ? JSON.stringify(w.args) : "add_business_place was never called");
  say("10 [RULE] the tab appears — without a refresh, and without the offer still sitting there",
      accepted.rail.some((t) => /my day/i.test(t)) && accepted.offerGone,
      `rail: ${accepted.rail.join(" · ")}`);
  say("11 [RULE] and it says what it did, in words — a NEW sentence naming the tab, not the question it just asked",
      !!accepted.said, JSON.stringify(accepted.said));

  // ── STEP 5, THE HALF THAT ONLY A RELOAD CAN SHOW ──────────────────────────────────────
  await arrive(PLACES_AFTER);
  const kept = await rail();
  say("12 [RULE] a fresh load paints My Day with nothing clicked — the tab is not a session trick",
      kept.some((t) => /my day/i.test(t)), `rail: ${kept.join(" · ")}`);

  // ── STEP 6 ────────────────────────────────────────────────────────────────────────────
  const opened = await rig.page.evaluate(async () => {
    const tab = [...document.querySelectorAll(".hc-rail-tab")].filter((b) => /my day/i.test(b.textContent))[0];
    if (!tab) return { pressed: false };
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    const app = document.getElementById("hcApp");
    const left = document.querySelector(".hc-app-left"), right = document.querySelector(".hc-app-right");
    const lr = left.getBoundingClientRect(), rr = right.getBoundingClientRect();
    return { pressed: true, mode: app.getAttribute("data-mode"),
             chatW: lr.width, dayW: rr.width, rightShown: getComputedStyle(right).display !== "none",
             day: document.querySelectorAll("#hcCanvas .hcmd-main").length,
             cal: document.querySelectorAll("#hcCanvas .hcmd-cal").length,
             calRightOfDay: (() => {
               const m = document.querySelector("#hcCanvas .hcmd-main"), c = document.querySelector("#hcCanvas .hcmd-cal");
               return m && c ? c.getBoundingClientRect().left >= m.getBoundingClientRect().right - 1 : null;
             })(),
             // NOT "is it inside the frame" — is any cell showing less text than it holds.
             truncated: [...document.querySelectorAll("#hcCanvas .hcmd-row > span, #hcCanvas .hcmd-whatmain, #hcCanvas .hcmd-whatsub")]
               .filter((e) => e.scrollWidth > e.clientWidth + 1).length };
  });
  say("13 [RULE] PRESSING the tab opens the day as a room",
      opened.pressed && opened.mode === "planner" && opened.day === 1,
      `mode ${opened.mode} · ${opened.day} day surface(s)`);
  say("14 [RULE] the chat is still there and narrower, and the day takes the space beside it",
      opened.rightShown === true && opened.chatW > 0 && opened.dayW > opened.chatW,
      `chat ${Math.round(opened.chatW)}px · day ${Math.round(opened.dayW)}px`);
  // ══ "THE CALENDAR SITS RIGHT" — AND "NOTHING RENDERS SQUEEZED" ═════════════════════════════
  //
  // Both are Adrian's, and at 1440 they conflict. The rail (260) and the chat (380) leave the day
  // an 800px canvas: side by side, the day gets 472px and "488 W Center St" truncates; stacked, it
  // gets 752 and nothing truncates. The day column wins, and the context drops underneath — which
  // is what the container query does, and it goes back to sitting beside the day the moment there
  // is room (measured below at 1800). So the leg asserts THE RULE — the calendar is always there,
  // and it is beside the day wherever both fit — instead of a fixed picture that can only be true
  // at one window size.
  // ══ BOTH RULES AT 1440, AFTER ADRIAN'S RULING ON THE TRADE — 2026-09-17 ═══════════════════
  //
  // This leg used to say "at this width it stacks rather than squeezing the day", which was the
  // honest report of a trade I had made: with the rail at 260 the canvas was 800, the day got
  // 412px, and three cells truncated, so the context column was dropped underneath. Adrian ruled
  // the other way — "NARROW THE RAIL… both rules must be true at 1440" — and he was right that it
  // was affordable. Rail 180 -> canvas 880 -> day 492, and the Where cell wraps instead of
  // ellipsing, so a 53-character address renders whole. BOTH now hold and the leg asserts both.
  say("15 [RULE] at 1440 the calendar sits BESIDE the day AND nothing is truncated",
      opened.cal === 1 && opened.calRightOfDay === true && opened.truncated === 0,
      `beside the day: ${opened.calRightOfDay} · ${opened.truncated} truncated cell(s)`);

  // ── AND ON A SCREEN WITH ROOM, IT IS BESIDE THE DAY AGAIN ─────────────────────────────
  await rig.page.setViewportSize({ width: 1800, height: 900 });
  await new Promise((r) => setTimeout(r, 400));
  const wide = await rig.page.evaluate(() => {
    const m = document.querySelector("#hcCanvas .hcmd-main"), c = document.querySelector("#hcCanvas .hcmd-cal");
    return { beside: m && c ? c.getBoundingClientRect().left >= m.getBoundingClientRect().right - 1 : null,
             truncated: [...document.querySelectorAll("#hcCanvas .hcmd-row > span")]
               .filter((e) => e.scrollWidth > e.clientWidth + 1).length,
             canvas: Math.round(document.querySelector(".hc-app-right").getBoundingClientRect().width) };
  });
  say("15b [RULE] and more room keeps both true rather than trading one for the other",
      wide.beside === true && wide.truncated === 0,
      `canvas ${wide.canvas}px · beside: ${wide.beside} · ${wide.truncated} truncated cell(s)`);
  await rig.page.setViewportSize({ width: 1440, height: 900 });

  // ══ AND WHEN THE WRITE FAILS ═══════════════════════════════════════════════════════════
  //
  // "Yes-add-it fails" — the case where he says yes and the place is NOT added. The tab must not
  // appear, he must be told in words, and the offer must not be left looking like it worked.
  // The rig refuses the write by answering the RPC as the real one does for a wrong owner.
  await arrive(PLACES_BEFORE, null, { refuseAddPlace: true });
  await press('.hc-act[data-promise="schedule"]');
  const failed2 = await (async () => {
    const before = await rig.page.evaluate(() =>
      [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")].map((m) => m.textContent.trim()));
    await press("[data-hc-tab-offer] button", "Yes, add it");
    return rig.page.evaluate((before) => ({
      rail: [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()),
      said: [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")].map((m) => m.textContent.trim())
              .filter((t) => before.indexOf(t) < 0).slice(-1)[0] || null,
      offerGone: !document.querySelector("[data-hc-tab-offer]"),
    }), before);
  })();
  say("19b [RULE] when the write FAILS the tab does not appear",
      !failed2.rail.some((t) => /my day/i.test(t)), `rail: ${failed2.rail.join(" · ")}`);
  say("19c [RULE] and he is told, in words, that his sidebar did not change",
      !!failed2.said && /couldn.t add|hasn.t changed/i.test(failed2.said) && !/Got it/i.test(failed2.said),
      JSON.stringify(failed2.said));

  // ── NO MEANS NO ───────────────────────────────────────────────────────────────────────
  await arrive(PLACES_BEFORE);
  await press('.hc-act[data-promise="schedule"]');
  const no = await press("[data-hc-tab-offer] button", "No, not now");
  const declined = await rig.page.evaluate(() => ({
    offerGone: !document.querySelector("[data-hc-tab-offer]"),
    said: [...document.querySelectorAll(".hc-msg:not(.hc-inthread-day)")].map((m) => m.textContent.trim())
            .filter((t) => /ask again|won.t ask/i.test(t)).slice(-1)[0] || null,
    rail: [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()),
    dayStillThere: !!document.querySelector(".hc-inthread-day"),
  }));
  say("16 [RULE] NO takes the offer away, leaves the day where it is, and adds no tab",
      no.pressed && declined.offerGone && declined.dayStillThere && !declined.rail.some((t) => /my day/i.test(t)),
      `rail: ${declined.rail.join(" · ")}`);
  say("17 [RULE] and it says it will not ask again — an offer that quietly stops is indistinguishable from one that broke",
      !!declined.said, JSON.stringify(declined.said));

  // WHAT THE PRODUCT WROTE, read off the page — not a key this check knows.
  const wrote = await rig.page.evaluate(() => {
    try { return Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]); } catch (e) { return []; }
  });
  say("17b [RULE] and the no is written down somewhere the next visit can read it",
      wrote.some(([k]) => /decline/i.test(k)),
      wrote.filter(([k]) => /decline/i.test(k)).map(([k]) => k).join(", ") || "nothing was stored");
  await arrive(PLACES_BEFORE, wrote);
  await press('.hc-act[data-promise="schedule"]');
  const again = await rig.page.evaluate(() => ({
    offer: !!document.querySelector("[data-hc-tab-offer]"),
    day: !!document.querySelector(".hc-inthread-day"),
  }));
  say("18 [RULE] on a later visit it does not ask again — and still shows him the day",
      again.offer === false && again.day === true,
      `offer: ${again.offer} · day: ${again.day}`);

  // ── AND IT NEVER OFFERS WHAT HE ALREADY HAS ───────────────────────────────────────────
  await arrive(PLACES_AFTER);
  await press('.hc-act[data-promise="schedule"]');
  const owned = await rig.page.evaluate(() => ({
    offer: !!document.querySelector("[data-hc-tab-offer]"),
    day: !!document.querySelector(".hc-inthread-day"),
  }));
  say("19 [RULE] an owner who already has the tab is not offered it again",
      owned.offer === false && owned.day === true, `offer: ${owned.offer} · day: ${owned.day}`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — ask, render, offer, accept, persist, open. Every step by a real event.\n");
process.exit(failed ? 1 : 0);
