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
 *   7  hcOnEventSignal's `mode !== 'home'` guard cut  -> 7  (the leg is [SHAPE]: this break is
 *                                                            what the IMPROVEMENT would look like)
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
async function arrive(events, places) {
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: UID, email: "owner@example.com", displayName: "Adrian",
    places: places || [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: events || [] },
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
  // ══ AND THE ONE HE CANNOT DO. This is a FINDING, asserted so it cannot quietly change. ══
  say("5 [SHAPE] he cannot ACCEPT it from this shell — acceptBookingRequest lives in hubly.html",
      onHome.canAccept === false,
      "if this leg goes red, accepting has been built here and the finding is closed — update it");
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
  say("6 [RULE] a booking that arrives WHILE HE IS ON HOME appears without a refresh",
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
             badge: document.querySelectorAll(".hc-rail-tab .hc-badge, .hc-rail-dot, [data-hc-unseen]").length };
  }, BOOKING);
  // [SHAPE], DELIBERATELY. This asserts TODAY'S BEHAVIOUR so the finding cannot change in
  // silence. If Hubly learns to tell him while he is in another room, this leg goes red and
  // that red is the improvement — update the leg, never the product.
  say("7 [SHAPE] a SECOND booking, arriving while he is in another room, shows him NOTHING — today",
      away.pressed && away.mode === "planner" && away.after === away.before &&
      away.named === false && away.badge === 0,
      `in ${away.mode}: ${away.before} card(s) before, ${away.after} after, the new customer named: ${away.named}, ` +
      `${away.badge} badge(s) — hcOnEventSignal returns early unless mode==='home'`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nA booking reaches Home, says what it is, and can be called back — and reaches nothing else.\n");
process.exit(failed ? 1 : 0);
