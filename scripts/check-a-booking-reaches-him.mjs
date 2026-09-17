#!/usr/bin/env node
/**
 * [RULE] WHEN A CUSTOMER BOOKS, DOES THE OWNER FIND OUT?
 *
 *   node scripts/check-a-booking-reaches-him.mjs
 *
 * ══ ADRIAN'S QUESTION, 2026-09-17 ═══════════════════════════════════════════════════════════
 *
 *   "if someone books a job how are they supposed to see it if my day is there?"
 *
 * HOME answers "WHAT'S NEW?". MY DAY answers "WHAT AM I DOING?". That is the distinction the
 * reversal rests on, and it only holds if a booking actually ARRIVES on Home — so this drives
 * the arrival rather than reading the code that would produce it.
 *
 * THE EVENT IS DELIVERED THE WAY REALTIME DELIVERS IT. `hcSubscribeEvents` registers
 * `postgres_changes` handlers on the supabase channel; the rig records them, and the legs below
 * invoke the handler the PRODUCT registered, with a payload, exactly as the socket would. No leg
 * calls hcOnEventSignal, hcRenderHome or hcLoadEvents.
 *
 * ══ WHAT IT CANNOT SEE, SAID PLAINLY ════════════════════════════════════════════════════════
 *
 * There is no session and no database. That the DB publishes the INSERT, that the owner's email
 * leaves Resend, and that `notification_deliveries` records it are all outside this check —
 * measured separately against the live ledger and written up in the round's report. What is
 * proved here is the client half: the subscription exists, an arriving row becomes a card
 * without a refresh, it is said in words, and what he can and cannot do with it.
 *
 * ══ RED-PROOFED PER LEG ═════════════════════════════════════════════════════════════════════
 *
 *   1  hcSubscribeEvents removed from Home            -> 1, 6
 *   2  the event cards are not rendered               -> 2, 4, 6
 *   3  the "One new booking came in." line deleted    -> 3, 6
 *   4  the Call link gated off                        -> 4
 *   5  the card's button relabelled "Accept booking"  -> 5
 *   6  the live re-render after the signal removed    -> 6
 *   7  the guard restored (news only on Home)         -> 7, 7c, 8
 *      the badge removed from the rail only            -> 7   (a count-the-badges leg stayed
 *                                                              GREEN here: the bottom bar still
 *                                                              had one. It is derived now)
 *      the aria-label dropped                          -> 7c
 *      the signal redraws the room he is standing in   -> 7, 7b, 7c
 *      nothing shown on return to Home                 -> 8, 9
 *      marked seen without rendering the cards         -> 8
 *
 * LEG 7 WAS [SHAPE] AND IT WENT RED, AND THE RED WAS THE POINT. It asserted the gap — "a booking
 * arriving while he is in another room shows him NOTHING" — so the gap could not close in silence.
 * Adrian ruled on 2026-09-17 that a booking must reach him wherever he is; the leg now asserts the
 * ruling instead, and 7b keeps the other half: his screen is not yanked out from under him.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srv = await servePublic(ROOT);
const PAGE = srv.url("platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const UID = "00000000-0000-0000-0000-0000000000aa";
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture Detailing", url: "https://hubly-classic-fixture.myhubly.app" };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());
/** The row get_business_events returns for a booking that just came in. */
const BOOKING = {
  event_id: "booking:b1", kind: "booking.created", occurred_at: new Date().toISOString(),
  subject_type: "booking_request", subject_id: "b1",
  customer_name: "Dana Whitlock", customer_phone: "(801) 555-0188", customer_email: null,
  service_name: "Full Detail", event_date: TODAY, event_time: "15:00", address: "77 N 200 W",
  vehicle: "2021 Tacoma", notes: null, status: "pending", amount: 180, is_new: true,
};

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/** A claimed owner, with the events reader returning `events` from the moment it is asked. */
async function arrive(events, places, edge) {
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: UID, email: "owner@example.com", displayName: "Adrian",
    places: places || [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: events || [] },
    // THE EDGE ANSWER IS DECLARED, like every other backend answer here. Nothing in this check
    // reaches the real accept-booking function; what is proved is that the CONTROL calls it, with
    // the right id and the owner's own token, and says what came back.
    edge: edge || { "accept-booking": { ok: true, job_id: "job-1", created: true, status_written: true,
                                        customer_name: "Dana Whitlock", service_name: "Full Detail",
                                        date: TODAY, time: "15:00" } },
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 500));
  }, { biz: BIZ });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }
}
try {
  console.log("SIMULATED OWNER — no session, no database. The socket handlers are the product's.\n");

  // ── THE SUBSCRIPTION ITSELF ───────────────────────────────────────────────────────────
  await arrive([]);
  const sub = await rig.page.evaluate(() => {
    const chans = window.__rig.channels || [];
    return { channels: chans.length, subscribed: chans.filter((c) => c.subscribed).length,
             tables: chans.flatMap((c) => c.handlers).map((h) => h.opts && h.opts.table) };
  });
  say("1 [RULE] Home subscribes to bookings arriving — there is a live path at all",
      sub.subscribed >= 1 && sub.tables.indexOf("booking_requests") >= 0,
      `${sub.channels} channel(s), tables: ${sub.tables.join(", ")}`);
} finally { /* the rest follows in the second pass */ }

// ── A BOOKING THAT IS ALREADY THERE WHEN HE ARRIVES ─────────────────────────────────────
try {
  await arrive([BOOKING]);
  const onHome = await rig.page.evaluate(() => {
    const cards = [...document.querySelectorAll(".hc-event-card")];
    const msgs = [...document.querySelectorAll(".hc-msg:not(.hc-event-card)")].map((m) => m.textContent.trim());
    const card = cards[0];
    return {
      cards: cards.length,
      head: card ? (card.querySelector(".hc-event-head") || {}).textContent : null,
      fields: card ? [...card.querySelectorAll(".hc-event-row")].map((r) => r.textContent.trim()) : [],
      acts: card ? [...card.querySelectorAll(".hc-event-acts a, .hc-event-acts button")].map((b) => b.textContent.trim()) : [],
      said: msgs.filter((t) => /booking/i.test(t)),
      canAccept: /accept/i.test(card ? card.textContent : ""),
    };
  });
  say("2 [RULE] a booking he has not seen is ON Home, as a card with the customer on it",
      onHome.cards === 1 && /Dana Whitlock/.test(onHome.head || "") ,
      JSON.stringify(onHome.head));
  say("3 [RULE] and it says what it is, in words, in the conversation",
      onHome.said.length > 0, JSON.stringify(onHome.said[0] || null));
  say("4 [RULE] it carries what he needs to act — the service, when, and a way to reach her",
      onHome.fields.some((f) => /Full Detail/.test(f)) && onHome.acts.some((a) => /call/i.test(a)),
      `fields: ${onHome.fields.length} · actions: ${onHome.acts.join(" / ")}`);
  // ══ THE DECISION, AND IT IS HIS TO MAKE FROM HERE ═══════════════════════════════════════
  //
  // WAS [SHAPE]: "he cannot ACCEPT it from this shell — acceptBookingRequest lives in hubly.html",
  // with a note saying that a red here meant the gap had closed. It closed on 2026-09-17 (Adrian:
  // "he can SEE it, so he can ACT on it"), the leg went red, and this is the ruling in its place.
  say("5 [RULE] the card puts the DECISION in front of him, not only the details",
      onHome.canAccept === true, `actions: ${onHome.acts.join(" / ")}`);

  const pressed = await rig.page.evaluate(async () => {
    const btn = document.querySelector("[data-hc-accept]");
    if (!btn) return { pressed: false };
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    const calls = (window.__rig.fetches || []).filter((f) => f.fn === "accept-booking");
    const said = document.querySelector("[data-hc-accept-said]");
    return { pressed: true, calls: calls.length, sentId: calls[0] && calls[0].body && calls[0].body.booking_request_id,
             authKind: calls[0] && calls[0].authKind,
             said: said ? said.textContent.trim() : null,
             saidKind: said ? said.getAttribute("data-hc-accept-said") : null,
             buttonGone: !document.querySelector("[data-hc-accept]") };
  });
  say("6 [RULE] PRESSING it calls the shared writer with this booking and the OWNER'S OWN token",
      pressed.calls === 1 && pressed.sentId === "b1" && pressed.authKind === "owner-jwt",
      `${pressed.calls} call(s) to accept-booking · id ${JSON.stringify(pressed.sentId)} · auth ${pressed.authKind}`);
  say("7 [RULE] and it says what it did, in words, beside the control he pressed",
      pressed.saidKind === "ok" && /accepted/i.test(pressed.said || "") && /Dana/.test(pressed.said || ""),
      JSON.stringify(pressed.said));

  // ── A REFUSAL IS SAID AS ITSELF, AND THE CONTROL COMES BACK ───────────────────────────
  await arrive([BOOKING], null, { "accept-booking": { __status: 403, ok: false, error: "not_owner" } });
  const refused = await rig.page.evaluate(async () => {
    const btn = document.querySelector("[data-hc-accept]");
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    const said = document.querySelector("[data-hc-accept-said]");
    const again = document.querySelector("[data-hc-accept]");
    return { said: said ? said.textContent.trim() : null, kind: said ? said.getAttribute("data-hc-accept-said") : null,
             retryable: !!(again && !again.disabled) };
  });
  say("8 [RULE] a refusal says which refusal it was, never claims it worked, and leaves him able to retry",
      refused.kind === "failed" && !/accepted —/i.test(refused.said || "") &&
      /own/i.test(refused.said || "") && refused.retryable === true,
      JSON.stringify(refused.said));
} finally { /* continue */ }

// ── ONE THAT ARRIVES WHILE HE IS LOOKING AT SOMETHING ELSE ──────────────────────────────
try {
  const PLACES = [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 },
                  { kind: "planner", scope: "workspace", visible: true, sort_order: 20 }];
  await arrive([], PLACES);
  const live = await rig.page.evaluate(async (booking) => {
    const chans = window.__rig.channels || [];
    const hs = chans.flatMap((c) => c.handlers)
      .filter((h) => h.opts && h.opts.table === "booking_requests" && h.opts.event === "INSERT");
    const before = document.querySelectorAll(".hc-event-card").length;
    // THE ROW NOW EXISTS SERVER-SIDE, and only then is the signal delivered — the same order
    // the real thing has, and the reason the app re-reads instead of trusting the payload.
    window.__rig.events = [booking];
    hs.forEach((h) => h.cb({ eventType: "INSERT", new: { id: booking.subject_id } }));
    await new Promise((r) => setTimeout(r, 900));
    return { handlers: hs.length, before, after: document.querySelectorAll(".hc-event-card").length,
             mode: document.getElementById("hcApp").getAttribute("data-mode"),
             said: [...document.querySelectorAll(".hc-msg:not(.hc-event-card)")]
                     .map((m) => m.textContent.trim()).filter((t) => /booking/i.test(t)).length };
  }, BOOKING);
  say("9 [RULE] a booking that arrives WHILE HE IS ON HOME appears without a refresh",
      live.handlers >= 1 && live.before === 0 && live.after === 1 && live.said > 0,
      `${live.before} card(s) before, ${live.after} after, ${live.said} sentence(s)`);

  // NOW MOVE HIM OFF HOME AND DELIVER ANOTHER ONE.
  const away = await rig.page.evaluate(async (booking) => {
    const tab = [...document.querySelectorAll(".hc-rail-tab")].filter((b) => /my day/i.test(b.textContent))[0];
    if (!tab) return { pressed: false };
    tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 700));
    // COUNTED AFTER THE MOVE, BEFORE THE SECOND BOOKING. The first one's card is still sitting
    // in the conversation, so a bare count would have called it "he was told" when what he is
    // looking at is the OLD news.
    const before = document.querySelectorAll(".hc-event-card").length;
    const second = Object.assign({}, booking, { event_id: "booking:b2", subject_id: "b2",
                                                customer_name: "Ruth Alvarez" });
    window.__rig.events = [second].concat(window.__rig.events || []);
    const chans = window.__rig.channels || [];
    const hs = chans.flatMap((c) => c.handlers)
      .filter((h) => h.opts && h.opts.table === "booking_requests" && h.opts.event === "INSERT");
    hs.forEach((h) => h.cb({ eventType: "INSERT", new: { id: "b2" } }));
    await new Promise((r) => setTimeout(r, 900));
    return { pressed: true, mode: document.getElementById("hcApp").getAttribute("data-mode"),
             before, after: document.querySelectorAll(".hc-event-card").length,
             named: /Ruth Alvarez/.test(document.body.textContent),
             // EVERY NAVIGATION THAT RENDERS A HOME DESTINATION, DERIVED — not "there are two of
             // them". Removing the badge from the rail left the bottom bar's in place and a
             // count-the-badges leg stayed green, which is the hand-maintained-set disease
             // arriving in an assertion.
             homeDests: [...document.querySelectorAll('[data-tab="home"]')].map((el) => ({
               where: el.className.split(/\s+/)[0],
               badge: (el.querySelector(".hc-rail-badge") || {}).textContent || null })),
             homeLabel: (() => {
               const h = [...document.querySelectorAll(".hc-rail-tab")].filter((t) => /home/i.test(t.textContent))[0];
               return h ? h.getAttribute("aria-label") : null;
             })() };
  }, BOOKING);
  // [SHAPE], DELIBERATELY. This asserts TODAY'S BEHAVIOUR so the finding cannot change in
  // silence. If Hubly learns to tell him while he is in another room, this leg goes red and
  // that red is the improvement — update the leg, never the product.
  // ══ THIS LEG WAS [SHAPE] AND IT WENT RED, AND THE RED WAS THE IMPROVEMENT ═══════════════
  //
  // It asserted the gap — "a booking arriving while he is in another room shows him NOTHING" —
  // so that the gap could not close in silence. Adrian ruled on 2026-09-17: "A BOOKING MUST
  // REACH HIM WHEREVER HE IS. A booking is money… A BADGE ON HOME IN THE RAIL IS THE MINIMUM,
  // and the card is there when he goes to Home." So the leg now asserts the ruling, and the two
  // halves of it are asserted separately, because "he was told" and "his screen was not yanked
  // out from under him" are different promises.
  say("10 [RULE] a booking arriving while he is in another room COUNTS on Home — in EVERY navigation that has a Home",
      away.pressed && away.mode === "planner" && away.homeDests.length >= 1 &&
      away.homeDests.every((d) => d.badge === "1"),
      `${away.homeDests.map((d) => d.where + ":" + JSON.stringify(d.badge)).join(" · ")} · Home reads "${away.homeLabel}"`);
  say("10b [RULE] and it does NOT redraw the room he is standing in",
      away.after === away.before && away.named === false,
      `${away.before} card(s) before, ${away.after} after; the new customer named on screen: ${away.named}`);
  say("10c [RULE] the count is named for someone who cannot see the dot",
      /1 new thing/.test(away.homeLabel || ""), JSON.stringify(away.homeLabel));

  // ── AND THE OTHER HALF OF THE RULING: "the card is there when he goes to Home" ─────────
  const back = await rig.page.evaluate(async () => {
    const home = [...document.querySelectorAll(".hc-rail-tab")].filter((t) => /home/i.test(t.textContent))[0];
    home.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 900));
    return { mode: document.getElementById("hcApp").getAttribute("data-mode"),
             named: /Ruth Alvarez/.test(document.body.textContent),
             badges: document.querySelectorAll(".hc-rail-badge").length,
             marked: (window.__rig.writes || []).filter((w) => w.name === "mark_business_events_seen").length };
  });
  say("11 [RULE] going to Home shows him the booking he was counted about",
      back.mode === "home" && back.named === true,
      `mode ${back.mode} · the customer is named on screen: ${back.named}`);
  say("12 [RULE] and looking at it is what clears the count — never a timer, never a guess",
      back.badges === 0 && back.marked >= 1,
      `${back.badges} badge(s) left · ${back.marked} seen-write(s)`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nA booking reaches Home, says what it is, and can be called back — and reaches nothing else.\n");
process.exit(failed ? 1 : 0);
