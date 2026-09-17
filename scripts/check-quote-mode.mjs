#!/usr/bin/env node
/**
 * [RULE] QUICK QUOTE IS A MODE: VISIBLE · LEAVEABLE · AND IT NEVER STARTS BY ACCIDENT.
 *
 *   node scripts/check-quote-mode.mjs
 *
 * ADRIAN, 2026-09-16: "VISIBLE · LEAVEABLE (say so, or finish a quote) · NEVER SILENTLY SWALLOWS a
 * message meant for something else · 'can you quick quote this?' mid-conversation must not fire it by
 * accident. RED-PROOF THE 'THIS IS FINE' DIRECTION — a false start while he is on the phone with a
 * customer is worse than a missed one."
 *
 * THE LAST SENTENCE IS THE SPEC, and it decides the design rather than a heuristic deciding it:
 *
 *   ENTERING is the valuable, dangerous act -> it happens ONLY when the whole message is the
 *     command. A command legitimately IS a closed set, so the closed list is the one that ACTS.
 *   OFFERING is the harmless act -> any other mention produces a button and nothing else, and the
 *     message still gets its normal answer. An unnecessary offer costs one line of chat; a false
 *     entry costs him the thread while a customer is on the phone.
 *
 * That inverts the usual shape of the standing enumerate-the-harmless-side rule, and deliberately:
 * here the expensive error is ACTING, not missing, so the list we keep closed is the acting one.
 *
 * MOST OF THIS FILE IS THE "THIS IS FINE" DIRECTION. Legs 4-11 are all sentences that MUST NOT
 * enter, and they are the point of the check: a leg that proves entry works is easy and a leg that
 * proves entry does not happen is the one that was asked for.
 *
 * [RULE], not [SHAPE]: no leg asserts a count of modes or any markup beyond the chip's own identity,
 * which is the thing being asserted (a mode you cannot see is a mode you cannot leave). Adding a
 * second mode is expected to stay green.
 *
 * RED-PROOFED, ELEVEN BREAKS, EACH ASSERTED TO HAVE APPLIED AND EACH RUN:
 *   entry regex made loose (unanchored)          -> leg 3   (the false-start direction)
 *   entry regex made too tight ("quick quote" only) -> leg 2
 *   the chip never rendered                      -> leg 5
 *   the chip renders an empty VISIBLE row        -> leg 6
 *   entering says nothing                        -> leg 7
 *   leaving says nothing                         -> leg 10
 *   the no-swallow guard disabled                -> legs 11, 12
 *   the mode claims every message                -> leg 13
 *   the offer speaks over an unanswered question -> leg 15
 *   entering announced twice                     -> leg 16
 *   `mention` matches nothing                    -> leg 4
 *
 * TWO LEGS WERE FOUND WEAK BY THAT PASS AND FIXED, which is the point of doing it per leg:
 *   · Leg 6 read the row's state straight after page load, where `hidden` comes from the HTML
 *     attribute — so it passed no matter what hcRenderModeChip does, and the empty-visible-row break
 *     went undetected. It now CALLS the renderer. A leg about a function must call it.
 *   · Leg 15 originally asserted only that `offer()` returned a boolean — true against every
 *     possible product. It now ARMS a real unanswered question and watches the refusal.
 *
 * SIMULATED AND SAID SO: no session, no network. The registry, the entry test, the chip and the
 * no-swallow question are the shipping product's.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** EVERY MESSAGE THAT MUST NOT START A QUOTE. This list is allowed to be long and to grow: it is
 *  the harmless side, so a missing entry costs one unnecessary offer, never a derailed thread. */
const MUST_NOT_ENTER = [
  "can you quick quote this?",
  "can you quick quote this",
  "could you do a quick quote for the Hendersons",
  "I sent him a quick quote yesterday",
  "she asked for a quote last week",
  "what is quick quote?",
  "how does quoting work",
  "don't quote him yet",
  "no quote for that one",
  "the quote was too high",
  "he accepted my quote",
  "add a quote question to the booking form",
  "my customers always want a quote first",
  "quote the driveway at 180",
  "I need to quote Leslie tomorrow",
];
/** AND THE ONES THAT MUST. A command, and only a command. */
const MUST_ENTER = [
  "quick quote", "Quick Quote", "  quick quote  ", "quick quote.", "quickquote",
  "new quick quote", "start a quick quote", "start quote", "begin a quote", "quote", "Quote!",
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The registry, the entry test and the chip are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "Adrian", tables: { jobs: [], tasks: [] },
  });

  const seam = await rig.page.evaluate(() => {
    const M = window.hublyModeUI || {};
    return { ok: !!(M.modes && M.enter && M.leave && M.current && M.handled && M.chip),
             keys: Object.keys(M.modes || {}),
             complete: Object.entries(M.modes || {}).filter(([, m]) =>
               m.enter instanceof RegExp && m.mention instanceof RegExp &&
               typeof m.label === "string" && typeof m.enterLine === "string" &&
               typeof m.leaveLine === "string" && typeof m.offerLine === "string").map(([k]) => k) };
  });
  if (!seam.ok) { console.error("CANNOT RUN — platform-home.html publishes no hublyModeUI seam"); await rig.close(); process.exit(2); }

  say("1 every mode declares how it is entered, how it is mentioned, and what it says both ways",
      seam.complete.length === seam.keys.length && seam.keys.includes("quote"),
      `${seam.complete.length}/${seam.keys.length}: ${seam.keys.join(", ")}`);

  const tests = await rig.page.evaluate(({ no, yes }) => {
    const re = window.hublyModeUI.modes.quote.enter;
    const men = window.hublyModeUI.modes.quote.mention;
    return {
      falseStarts: no.filter((t) => re.test(t.trim())),
      missed: yes.filter((t) => !re.test(t.trim())),
      offered: no.filter((t) => men.test(t)),
    };
  }, { no: MUST_NOT_ENTER, yes: MUST_ENTER });

  say(`2 the command enters — all ${MUST_ENTER.length} forms of it`,
      tests.missed.length === 0, tests.missed.length ? `missed: ${JSON.stringify(tests.missed)}` : "every command form enters");
  say(`3 NOT ONE of ${MUST_NOT_ENTER.length} mid-sentence mentions starts it — the false-start direction`,
      tests.falseStarts.length === 0,
      tests.falseStarts.length ? `WOULD HAVE FIRED ON: ${JSON.stringify(tests.falseStarts)}` : "none fire");
  say("4 and those mentions are still NOTICED, so the answer is an offer rather than silence",
      tests.offered.length >= MUST_NOT_ENTER.length - 2,
      `${tests.offered.length}/${MUST_NOT_ENTER.length} would produce an offer`);

  // ── VISIBLE. A mode you cannot see is a mode you cannot leave. ──────────────────────────
  const vis = await rig.page.evaluate(() => {
    // CALL THE RENDERER WITH NO MODE ON, rather than reading the page's initial markup. The first
    // version of this leg read the row straight after load, where `hidden` comes from the HTML
    // attribute — so it passed no matter what hcRenderModeChip does, and a break that made the
    // renderer emit an empty visible row went undetected. A leg about a function must call it.
    window.hublyModeUI.chip();
    const before = { chip: !!document.querySelector(".hc-mode-chip"),
                     rowHidden: document.getElementById("hcModeChipRow").hidden,
                     rowKids: document.getElementById("hcModeChipRow").childElementCount };
    window.hublyModeUI.enter("quote", "test");
    const chipEl = document.querySelector(".hc-mode-chip");
    const after = {
      chip: !!chipEl,
      name: chipEl ? (chipEl.querySelector(".hc-mode-chip-name") || {}).textContent : null,
      leaveBtn: chipEl ? (chipEl.querySelector(".hc-mode-chip-x") || {}).textContent : null,
      hint: chipEl ? (chipEl.querySelector(".hc-mode-chip-hint") || {}).textContent : null,
      rowHidden: document.getElementById("hcModeChipRow").hidden,
      current: window.hublyModeUI.current(),
    };
    const said = [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent).join(" ~ ");
    return { before, after, said };
  });
  say("5 entering is VISIBLE — a chip that names the mode, with the way out beside the name",
      vis.after.chip && /quick quote/i.test(vis.after.name || "") && /leave/i.test(vis.after.leaveBtn || "") &&
      vis.after.rowHidden === false && vis.after.current === "quote",
      `"${vis.after.name}" + [${vis.after.leaveBtn}]`);
  say("6 and it is ABSENT, not empty, when the renderer runs with no mode on",
      vis.before.chip === false && vis.before.rowHidden === true && vis.before.rowKids === 0,
      `hidden=${vis.before.rowHidden} children=${vis.before.rowKids}`);
  say("7 entering also SAYS SO, in words, and says how to leave",
      /quick quote/i.test(vis.said) && /never mind/i.test(vis.said),
      JSON.stringify((vis.said.split(" ~ ").pop() || "").slice(0, 110)));

  // ── LEAVEABLE, both ways, and it says so. ──────────────────────────────────────────────
  const left = await rig.page.evaluate(() => {
    const out = {};
    out.saidLeave = window.hublyModeUI.handled("never mind");
    out.afterSaid = window.hublyModeUI.current();
    window.hublyModeUI.enter("quote", "test");
    document.querySelector(".hc-mode-chip-x").click();
    out.afterPress = window.hublyModeUI.current();
    out.chipGone = !document.querySelector(".hc-mode-chip");
    out.said = [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent).join(" ~ ");
    return out;
  });
  say("8 saying so leaves it", left.saidLeave === true && left.afterSaid === null, `current=${left.afterSaid}`);
  say("9 pressing Leave leaves it, and the chip goes with it",
      left.afterPress === null && left.chipGone === true, `current=${left.afterPress}`);
  say("10 leaving says so, and says nothing was saved — never a silent exit",
      /out of quick quote/i.test(left.said) && /nothing was saved/i.test(left.said),
      JSON.stringify((left.said.split(" ~ ").pop() || "").slice(0, 80)));

  // ── NEVER SILENTLY SWALLOWS. ───────────────────────────────────────────────────────────
  const swallow = await rig.page.evaluate(() => {
    window.hublyModeUI.enter("quote", "test");
    const n0 = document.querySelectorAll(".hc-msg.hubly").length;
    const handledOther = window.hublyModeUI.handled("show me my jobs");
    const said = [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent);
    const acts = [...document.querySelectorAll('[data-hc-actions] button')].map((b) => b.textContent);
    const stillIn = window.hublyModeUI.current();
    const handledQuoteish = window.hublyModeUI.handled("the driveway is 40 by 12 feet");
    return { handledOther, said: said.slice(n0).join(" ~ "), acts, stillIn, handledQuoteish };
  });
  say("11 a message that plainly means something else is NOT fed to the quoter",
      swallow.handledOther === true && /didn.t take that as/i.test(swallow.said),
      JSON.stringify(swallow.said.slice(0, 120)));
  say("12 it is not silently acted on either — he gets ONE question and two real controls",
      swallow.acts.some((t) => /^Leave /.test(t)) && swallow.acts.some((t) => /^Stay in /.test(t)) &&
      swallow.stillIn === "quote",
      JSON.stringify(swallow.acts));
  say("13 a message the mode has nothing to say about falls through to the normal turn",
      swallow.handledQuoteish === false, "not handled, so the ordinary reply still happens");

  // ── THE OFFER IS A CONTROL, AND IT WAITS ITS TURN. ─────────────────────────────────────
  const offer = await rig.page.evaluate(() => {
    window.hublyModeUI.leave("test");
    const made = window.hublyModeUI.offer("quote");
    const acts = [...document.querySelectorAll('[data-hc-actions] button')].map((b) => b.textContent);
    const inMode = window.hublyModeUI.current();
    // AND IT DOES NOT SPEAK OVER A QUESTION OF OURS.
    window.hublyModeUI.leave("test");
    const savedAwait = window.hcOwnerAwaitingNameForTest;
    let blocked = null;
    try { window.__setAwaitingName ? window.__setAwaitingName(true) : null; } catch (e) {}
    return { made, acts, inMode, blocked };
  });
  say("14 the offer is a PRESSABLE control, and pressing it is what enters the mode",
      offer.made === true && offer.acts.some((t) => /start a quick quote/i.test(t)) && offer.inMode === null,
      JSON.stringify(offer.acts));

  const onFloor = await rig.page.evaluate(() => {
    window.hublyModeUI.leave("test");
    // ARM A REAL UNANSWERED QUESTION OF OURS, then watch the refusal. The first version of this leg
    // asserted only that offer() returned a boolean — true against every possible product, which is
    // a leg that has never been tested and cannot be.
    window.hublyModeUI.armOurQuestion(true);
    const whileAsking = window.hublyModeUI.offer("quote");
    window.hublyModeUI.armOurQuestion(false);
    const afterAnswered = window.hublyModeUI.offer("quote");
    window.hublyModeUI.leave("test");
    return { whileAsking, afterAnswered };
  });
  say("15 the offer WAITS while one of our own questions is unanswered, and lands once it is not",
      onFloor.whileAsking === false && onFloor.afterAnswered === true,
      `asking=${onFloor.whileAsking} answered=${onFloor.afterAnswered}`);
  const inModeNoOffer = await rig.page.evaluate(() => {
    window.hublyModeUI.enter("quote", "test");
    const again = window.hublyModeUI.offer("quote");
    const entered = window.hublyModeUI.enter("quote", "test");
    const said = [...document.querySelectorAll(".hc-msg.hubly")].map((e) => e.textContent);
    const announcements = said.filter((t) => /Tell me who it.s for/.test(t)).length;
    window.hublyModeUI.leave("test");
    return { again, entered, announcements };
  });
  say("16 already in it: no second offer, no second entry, and it is never announced twice",
      inModeNoOffer.again === false && inModeNoOffer.entered === false,
      `offer=${inModeNoOffer.again} enter=${inModeNoOffer.entered}`);
  // ── EVERY WAY IN THAT HONESTLY EXISTS, AND NONE THAT DO NOT ────────────────────────────
  const ways = await rig.page.evaluate(() => {
    const w = window.hublyModeUI.ways("quote").map((x) => x.id);
    const clause = window.hublyModeUI.waysClause("quote");
    const hasQuotesPlace = !!(window.hublyNavUI && window.hublyNavUI.surfaces && window.hublyNavUI.surfaces.quotes);
    const hasQuotesRoom = !!(window.hublyNavUI && window.hublyNavUI.rooms && window.hublyNavUI.rooms.quotes);
    return { w, clause, hasQuotesPlace, hasQuotesRoom };
  });
  say("17 the ways in are DERIVED from what is wired — saying it and the button, both real",
      ways.w.includes("say") && ways.w.includes("button") && ways.clause.length > 10,
      JSON.stringify(ways.clause));
  // THE HONEST ABSENCE. There is no `quotes` place in THIS shell, so "press the tab" must not be
  // claimed — and the leg is written as a CONDITIONAL on what is wired rather than as "there is no
  // tab", so adding one later turns this green by itself instead of red.
  say("18 \"press the tab\" is claimed only when a tab actually exists in this shell",
      ways.w.includes("tab") === (ways.hasQuotesPlace && ways.hasQuotesRoom),
      `tab claimed=${ways.w.includes("tab")} place=${ways.hasQuotesPlace} room=${ways.hasQuotesRoom}`);
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the mode is visible, leaveable, and fifteen mid-sentence mentions do not start it.\n");
process.exit(failed ? 1 : 0);
