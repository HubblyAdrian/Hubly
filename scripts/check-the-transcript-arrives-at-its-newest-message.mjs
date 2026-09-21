#!/usr/bin/env node
/**
 * [RULE] COMING BACK TO THE CHAT PUTS YOU AT THE NEWEST MESSAGE, NOT PART-WAY UP THE TRANSCRIPT.
 *
 *   node scripts/check-the-transcript-arrives-at-its-newest-message.mjs
 *
 * ══ WHAT HAPPENED ═══════════════════════════════════════════════════════════════════════════
 *
 * `scrollTop = scrollHeight` is a latched measurement of something still moving. Going Home ->
 * Website the chat column animates 1530px -> 380px over its own 450ms flex-basis transition, and
 * every line of every message re-wraps on the way down. MEASURED live on one switch:
 *
 *     t=10ms    chat 1710px   scrollHeight 730   clientHeight 730   -> NO OVERFLOW AT ALL
 *     t=1000ms  chat  380px   scrollHeight 912   clientHeight 730   -> scrollTop stuck at 129
 *
 * At 10ms the transcript fits, so scrolling to the end does nothing; by the time it does not fit,
 * 182px of newly-wrapped text has appeared below the owner and nothing looks again.
 *
 * ══ WHY THE WIDTH CHANGE IS THE WHOLE FIXTURE ═══════════════════════════════════════════════
 *
 * A check that piles messages into an already-narrow panel and asserts "we are at the bottom"
 * passes against the broken code, because with the width settled the latched measurement is
 * correct. The defect only exists while the column is still moving. So the fixture below drives
 * the REAL route — a wide panel, then a narrowing one — and the assertion is made after the
 * transition, about where the owner ends up. Nothing here asserts that an observer exists, how
 * it is coalesced, or that any particular function was called; swap the mechanism and this check
 * should still pass.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Fixture", hasPage: true, url: "https://hubly-classic-fixture.myhubly.app" };

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ width: 1710, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

let out = null;
try {
  await rig.load(srv.url("platform-home.html"));
  /* THE TRANSCRIPT COMES FROM THE PLACE CONVERSATION, because that is where the Website chat's
   * messages actually come from. The first version of this fixture appended .hc-msg nodes by
   * hand; switching to Website emptied the thread (hcLoadPlaceConversation does
   * `thread.innerHTML = ''` before rendering its own rows) and the panel arrived holding a
   * single "this is a separate conversation" line. A fixture the product deletes on the way into
   * the screen under test is not a fixture. Seeding the rows makes the real loader do the real
   * render on the real route. */
  const TURNS = [];
  for (let i = 0; i < 14; i++) {
    TURNS.push({ id: "m" + i, conversation_id: "conv-web", business_id: BIZ.id,
      role: i % 2 ? "assistant" : "user",
      content: (i % 2 ? "Hubly answering turn " + i + ": " : "Owner asking turn " + i + ": ") +
        "a sentence with enough words in it to occupy one line of a wide column and three of a narrow one.",
      created_at: new Date(Date.now() - (14 - i) * 60000).toISOString() });
  }
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "owner@example.com", displayName: "Owner",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [],
      ask_hubly_conversations: [{ id: "conv-web", business_id: BIZ.id, place: "website",
                                  title: "Website", updated_at: new Date().toISOString() }],
      ask_hubly_messages: TURNS },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) throw new Error(bad);

  out = await rig.page.evaluate(async ({ biz }) => {
    const q = (s) => document.querySelector(s);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const railBtn = (label) => [...document.querySelectorAll(".hc-rail button, .hc-rail a")]
      .find((b) => b.textContent.trim() === label);
    const go = (label) => { const b = railBtn(label);
      if (b) b.click(); else window.hublyNavUI.openWorkspace(label.toLowerCase()); };
    const tail = () => { const t = q("#hcThread");
      return { top: Math.round(t.scrollTop), h: t.scrollHeight, c: t.clientHeight,
               fromBottom: Math.round(t.scrollHeight - t.scrollTop - t.clientHeight) }; };

    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    window.hublyNavUI.openWorkspace("home");
    await wait(800);

    const inHome = { ...tail(), chatW: Math.round(q(".hc-app-left").getBoundingClientRect().width) };

    // ── THE ROUTE: Home -> Website, across the column transition. ──
    go("Website");
    await wait(2500);
    const arrive = { ...tail(), chatW: Math.round(q(".hc-app-left").getBoundingClientRect().width) };
    const lastMsg = [...document.querySelectorAll(".hc-msg")].at(-1).getBoundingClientRect();
    const panel = q("#hcThread").getBoundingClientRect();
    arrive.newestVisible = lastMsg.bottom <= panel.bottom + 4 && lastMsg.top >= panel.top - 4;

    // ── AND BACK AGAIN: Website -> Home -> Website. ──
    go("Home"); await wait(1200); go("Website"); await wait(2500);
    const returned = tail();
    const msgCount = document.querySelectorAll(".hc-msg").length;
    const last2 = [...document.querySelectorAll(".hc-msg")].at(-1).getBoundingClientRect();
    const panel2 = q("#hcThread").getBoundingClientRect();
    returned.newestVisible = last2.bottom <= panel2.bottom + 4 && last2.top >= panel2.top - 4;

    /* ── READING HISTORY MUST NOT BE INTERRUPTED. Scroll up, then force a reflow the same way
     *    the route does, and confirm the owner is left where they put themselves. */
    const t = q("#hcThread");
    t.scrollTop = 0;
    await wait(300);
    const left = q(".hc-app-left");
    const basis0 = left.style.flexBasis;
    left.style.flexBasis = "520px";          // a real resize, which re-wraps every message
    await wait(900);
    const whileReading = tail();
    left.style.flexBasis = basis0;
    await wait(900);
    return { inHome, arrive, returned, whileReading, msgCount };
  }, { biz: BIZ });
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

console.log(`  in Home (chat ${out.inHome.chatW}px): content ${out.inHome.h} / panel ${out.inHome.c}`);
console.log(`  messages rendered in the Website panel: ${out.msgCount}`);
console.log(`  arriving in Website (chat ${out.arrive.chatW}px): content ${out.arrive.h} / panel ${out.arrive.c}, ` +
            `${out.arrive.fromBottom}px from the bottom`);
console.log(`  after Website -> Home -> Website: ${out.returned.fromBottom}px from the bottom`);
console.log(`  scrolled up, then a reflow: scrollTop ${out.whileReading.top}\n`);

/* THE FIXTURE MUST ACTUALLY CREATE THE CONDITION. If the transcript did not grow on the way into
 * the narrow column, the latched measurement was never wrong and every leg passes for free. */
if (!(out.arrive.h > out.arrive.c + 120)) {
  console.error(`CANNOT RUN — the transcript (${out.arrive.h}px) barely exceeds the panel (${out.arrive.c}px). ` +
                `With nothing much to scroll, landing at the bottom is not a distinguishable outcome and ` +
                `these legs would pass against the original defect.`);
  process.exit(2);
}
if (!(out.msgCount >= 10)) {
  console.error(`CANNOT RUN — only ${out.msgCount} messages rendered in the Website panel, so the seeded ` +
                `conversation did not reach the screen and the fixture is measuring an empty room.`);
  process.exit(2);
}

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
/* ARRIVAL AND RETURN ARE ONE LEG, NOT TWO. They are the same machinery reached by two routes, so
 * every break that can reach one reaches the other and a second leg could only ever be COMPOUND —
 * a result that proves nothing about itself (L98). Both routes are still DRIVEN, because a return
 * crosses the column transition twice and is where the original report came from; they are simply
 * reported as one verdict rather than dressed up as independent evidence. */
declareBreak({
  leg: "1 arriving at Website lands on the newest message, first visit and return alike",
  why: "take the tail-following away and leave only the latched scroll calls. They fire while the " +
       "column is still animating, when the transcript still fits and scrolling to the end is a " +
       "no-op; the text then re-wraps taller underneath and nobody looks again.",
  file: "public/platform-home.html",
  find: "          if(el && hcTailPinned){ el.scrollTop = el.scrollHeight; hcTailLastTop = el.scrollTop; }",
  with: "          if(el && hcTailPinned && false){ el.scrollTop = el.scrollHeight; hcTailLastTop = el.scrollTop; }",
});
leg("RULE", "1 arriving at Website lands on the newest message, first visit and return alike",
  out.arrive.fromBottom <= 8 && out.arrive.newestVisible &&
  out.returned.fromBottom <= 8 && out.returned.newestVisible,
  `Home -> Website: ${out.arrive.fromBottom}px from the bottom, newest message in the panel ` +
  `${out.arrive.newestVisible}. Website -> Home -> Website: ${out.returned.fromBottom}px, ` +
  `${out.returned.newestVisible}. ${out.msgCount} messages, content ${out.arrive.h}px in a ` +
  `${out.arrive.c}px panel, across a column transition from ${out.inHome.chatW}px to ` +
  `${out.arrive.chatW}px — the condition the defect needed; live it left the owner 129px into a ` +
  `182px scroll.`);

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 an owner reading history is not dragged back to the bottom",
  why: "follow the tail unconditionally instead of only when the owner is already at it. Every " +
       "reflow — a mode switch, the window, a chip row appearing — then yanks someone who is " +
       "reading older messages down to the newest one, which is worse than the bug being fixed.",
  file: "public/platform-home.html",
  find: "          if(el && hcTailPinned){ el.scrollTop = el.scrollHeight; hcTailLastTop = el.scrollTop; }",
  with: "          if(el){ el.scrollTop = el.scrollHeight; hcTailLastTop = el.scrollTop; }",
});
leg("RULE", "2 an owner reading history is not dragged back to the bottom",
  out.whileReading.top <= 8,
  `scrolled to the top, then the column was resized by 140px (re-wrapping every message): scrollTop ` +
  `stayed ${out.whileReading.top}. Following the tail is only correct while the owner is AT the ` +
  `tail — this leg is the other half of leg 1 and the reason the fix is conditional.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
