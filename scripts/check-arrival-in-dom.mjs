#!/usr/bin/env node
/**
 * THE ARRIVAL IS IN THE DOM, AFTER HOME HAS SETTLED — or this goes red.
 *
 *   node scripts/check-arrival-in-dom.mjs
 *
 * WHY THIS EXISTS, AND WHY IT EXISTS ONLY NOW
 *
 * The arrival has failed on a human's screen THREE times. Three explanations shipped — the
 * gate, the wipe, the marking order — and not one of them was ever observed to work, because
 * every one was reasoned out of the source. The fourth diagnosis was not in the source at all.
 * It was one row:
 *
 *   hubly_owner_profile  owner f3f11707
 *     welcomed_at = 2026-09-14 22:01:24.826016+00
 *     created_at  = 2026-09-14 22:01:24.826016+00      <- the same instant
 *
 * The arrival rendered at 22:01:24, stamped `welcomed_at`, and was erased by the other
 * hcRenderHome call site seconds later. The fix that followed corrected the render and the
 * marking order and NEVER CLEARED THE ROW, so the gate `!hcOwner.welcomedAt` has been closed
 * for that owner ever since. All three fixes sat behind a one-shot that was already spent.
 *
 * So this check asserts the only thing that would have caught any of them: THE WORDS, IN THE
 * DOM, AFTER SETTLE. Not that hcRenderArrival ran. Not that welcomed_at was written.
 *
 * SIMULATED, AND SAID SO ON ITS FACE. There is no real session here: `window.supabase
 * .createClient` is replaced before load with a fake whose rpc/auth/from answers are declared
 * in this file, and `window.hublyArrivalUI.simulate()` supplies the business. Everything
 * between that seam and the DOM is the shipping code in public/platform-home.html — the real
 * hcMaybeShowArrival, the real hcLoadOwnerProfile, the real hcRenderHome, the real
 * hcRenderArrival. This is NOT evidence about a real signed-in session; it is evidence about
 * the render path and the gate, which is where all three failures lived.
 *
 * RED-PROOFED AGAINST ALL THREE. Each of the three fixed bugs is restored in the page world
 * and the assertion must go red for each. A check that cannot be made to fail is not a check
 * (docs/REDPROOF_AUDIT.md), and this one exists precisely because three fixes were believed
 * without one.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (no browser / seam absent)
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// The business the simulated owner owns. `hasPage` + a url so hcRenderArrival can speak the
// host; the id/slug are fixtures, never a real row.
const BIZ = { id: "00000000-0000-0000-0000-0000000000aa", slug: "arrival-fixture",
              name: "Arrival Fixture", url: "https://arrival-fixture.myhubly.app", hasPage: true };

/**
 * THE FAKE BACKEND, declared in one place so what is simulated is readable.
 *
 * Installed AFTER load and BEFORE the arrival runs, with a plain page.evaluate — no init
 * script. That is possible because authGetClient() polls for `window.supabase.createClient`
 * for up to ten seconds and is not called until the arrival path asks for a client, so the
 * fake is in place before the first real use. It also means each run gets its own options
 * without stacking init scripts across reloads, which is what broke the first version of this
 * file (the options never arrived and __arrivalRig came back undefined).
 *
 * `welcomedAt` is the parameter the whole gate turns on. `services` decides whether the earned
 * second line is said. Everything else answers empty, which is the honest shape for a business
 * with no events, no counts and no gaps.
 */
function fakeBackend(opts) {
  const W = window;
  W.__arrivalRig = { markedAt: null, markedWithArrivalInDom: null, rpcCalls: [] };
  const okData = (data) => Promise.resolve({ data, error: null });
  // A chainable query builder that resolves to rows whatever is chained onto it.
  const q = (rows) => {
    const t = {
      select: () => t, eq: () => t, in: () => t, order: () => t, limit: () => t,
      maybeSingle: () => okData(rows[0] || null), single: () => okData(rows[0] || null),
      then: (res, rej) => okData(rows).then(res, rej),
    };
    return t;
  };
  const client = {
    auth: {
      getUser: () => okData({ user: { id: opts.uid } }),
      getSession: () => okData({ session: { access_token: "simulated.jwt.token", expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
      signOut: () => okData(null),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (table) => q(table === "services" ? opts.services : []),
    rpc: (name) => {
      W.__arrivalRig.rpcCalls.push(name);
      if (name === "get_owner_profile") {
        return okData([{ display_name: opts.displayName, name_source: opts.displayName ? "owner" : "unknown", welcomed_at: opts.welcomedAt }]);
      }
      if (name === "mark_owner_welcomed") {
        // THE ORDER ASSERTION. Snapshot, at the instant the one-shot is spent, whether the
        // arrival is actually on screen. This is what makes bug 3 (marking before the DOM)
        // detectable at all — a boolean read from the DOM, not from call order in the source.
        let inDom = false;
        try { inDom = !!(W.hublyArrivalUI && W.hublyArrivalUI.inDom && W.hublyArrivalUI.inDom()); } catch (_) {}
        if (W.__arrivalRig.markedAt === null) {
          W.__arrivalRig.markedAt = Date.now();
          W.__arrivalRig.markedWithArrivalInDom = inDom;
        }
        return okData(new Date().toISOString());
      }
      return okData(null);
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  };
  W.supabase = { createClient: () => client };
  // hcIsAuthed() reads the session out of localStorage, not out of the client.
  try {
    localStorage.setItem("sb-rtwxxkxpkqdrhclkozma-auth-token",
      JSON.stringify({ access_token: "simulated.jwt.token", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  } catch (_) {}
  // No network from a check. Anything unstubbed answers empty rather than hanging.
  W.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
}

/** THE THREE BEATS, from Adrian's ruling of 2026-09-15 — congratulate, say who you are and
 *  that you are their assistant, ask the name. Not a copy of hcRenderArrival's strings: the
 *  previous version of this constant was the OLD copy ("is a real address"), which meant the
 *  check would have gone green on the very sentence Adrian ruled out. A check that encodes the
 *  shipped wording rather than the requirement only ever proves the code is the code. */
const MUST_SAY = [/congratulations on finishing your website/i, /welcome to Hubly/i, /business assistant/i];

/**
 * ONE RUN: load the page, install the fake backend, drive the real arrival path, settle on the
 * DOM, and report what the thread actually says.
 *
 * `mutate` is a page-world function applied AFTER the fake is installed and BEFORE the arrival
 * runs — this is how each of the three bugs is restored for the red-proof.
 */
async function run(rig, { welcomedAt = null, displayName = null, services = [], mutate = null, messages = null } = {}) {
  const uid = "00000000-0000-0000-0000-0000000000bb";
  await rig.load(PAGE);
  await rig.page.evaluate(fakeBackend, { uid, welcomedAt, displayName, services });
  const seam = await rig.page.evaluate(() => !!(window.hublyArrivalUI && window.hublyArrivalUI.simulate));
  if (!seam) return { cannotRun: "window.hublyArrivalUI.simulate is not exposed" };
  if (mutate) await rig.page.evaluate(mutate);
  await rig.page.evaluate(({ biz, messages }) => { window.hublyArrivalUI.simulate(biz, true, messages); }, { biz: BIZ, messages });
  // RULE 3 — poll the DOM until it stops changing. The arrival's second line arrives from an
  // async services read, so a fixed delay here would be a guess dressed as an observation.
  const settled = await rig.settle(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const a = t && t.querySelector('[data-hc-arrival="1"]');
    return {
      // The ARRIVAL's own text, so suggestion chips (which carry their own question marks)
      // can never be mistaken for the arrival asking a second thing.
      arrival: a ? a.innerText.replace(/\s+/g, " ").trim() : "",
      // THE WHOLE SCREEN, not a 400-char prefix. The stack that shipped was eleven things
      // long and the booking line sat past the old cut — a truncated read is a detector that
      // cannot see the defect it was written for.
      thread: t ? t.innerText.replace(/\s+/g, " ").trim() : "",
      furniture: t ? {
        cards: t.querySelectorAll(".hc-action-card, .hc-event-card").length,
        chips: t.querySelectorAll(".hc-suggest button, .hc-suggestions button").length,
        history: [...t.querySelectorAll("button")].filter((b) => /See earlier conversation/i.test(b.textContent)).length,
        news: t.querySelectorAll(".hc-news").length,
      } : { cards: 0, chips: 0, history: 0, news: 0 },
    };
  }, "arrival text", { stableMs: 900, ceilingMs: 9000 });
  const state = await rig.page.evaluate(() => ({
    inDom: !!(window.hublyArrivalUI.inDom && window.hublyArrivalUI.inDom()),
    log: window.hublyArrivalUI.log(),
    rig: window.__arrivalRig || { markedAt: null, markedWithArrivalInDom: null, rpcCalls: [] },
  }));
  return { arrival: settled.final.arrival, thread: settled.final.thread, furniture: settled.final.furniture, ms: settled.ms, ...state };
}

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED SIGNED-IN OWNER — no real session; the backend is a declared fake.\n");

  // ── 1. THE GREEN CASE: a brand-new owner, never welcomed. ────────────────────────────
  console.log("— a claimed owner who has never been welcomed —");
  const a = await run(rig, { welcomedAt: null, services: [{ id: "s1", price: 120 }] });
  if (a.cannotRun) { console.error("CANNOT RUN — " + a.cannotRun); await rig.close(); process.exit(2); }
  say("1 the arrival WORDS are in the DOM after Home settled", a.inDom === true && MUST_SAY.every((r) => r.test(a.arrival)),
    `inDom=${a.inDom} at t=${a.ms}ms · ${JSON.stringify(a.arrival.slice(0, 140))}`);
  say("2 with no name on file it asks for one, and asks nothing else",
    /what should I call you\?/i.test(a.arrival) && (a.arrival.match(/\?/g) || []).length === 1,
    `${(a.arrival.match(/\?/g) || []).length} question mark(s) in the arrival itself`);

  // ══ WHEN A QUESTION IS ON THE FLOOR, NOTHING ELSE SPEAKS. ═══════════════════════════════
  //
  // THIS IS THE TRANSCRIPT, 2026-09-15. What an owner was actually shown, in order:
  //   the site is live / it is a real address / anyone can visit it / I'm Hubly / tell me what
  //   you want changed / WHAT SHOULD I CALL YOU? / your booking works too, customers can pick
  //   from the 1 service you priced / one person looked at your page on 09/13/2026 / two cards
  //   / four chips / a history button.
  // Adrian: "too many questions at once doesn't feel good."
  //
  // The voluntary gate existed and was correct, and every one of those walked past it, because
  // the gate only guarded the four CHAT composers. These legs assert the whole screen, not the
  // bubble — a speaker added later cannot pass by not being a bubble.
  say("2a the arrival does not explain infrastructure to the person who owns it",
    !/is a real address/i.test(a.thread) && !/anyone can visit it/i.test(a.thread),
    JSON.stringify(a.arrival.slice(0, 160)));
  say("2b it congratulates, and says it is their assistant",
    /congratulations on finishing your website/i.test(a.arrival) && /business assistant/i.test(a.arrival),
    "congratulate + who I am");
  /* ══ L98 — "NOTHING ELSE SPEAKS" IS TRUE OF AN EMPTY THREAD ══════════════════════════════════
   * Three negations over `a.thread`. A thread that never rendered, or rendered and was wiped, passes
   * all three — and the leg reports the one-ask-at-a-time rule as upheld on a screen with nothing on
   * it. The positive clause is that the ARRIVAL IS IN THE THREAD: something spoke, exactly one
   * thing, and it was the arrival. */
  declareBreak({
    leg: "2c the arrival IS in the thread",
    why: "speak a second time while the name question is on the floor — a page-view count beside the " +
         "arrival, which is two composers talking over each other",
    file: "public/platform-home.html",
    find: "      hcRenderArrival(biz);",
    with: "      hcRenderArrival(biz);\n      hcAppendMessage('hubly', '3 people looked at your page this week.');",
  });
  say("2c the arrival IS in the thread and NOTHING ELSE SPOKE while the name is on the floor",
    a.thread.length > 0 && a.arrival.length > 0 && a.thread.includes(a.arrival.slice(0, 40)) &&
    !/booking works/i.test(a.thread) && !/looked at your page/i.test(a.thread) && !/service you priced/i.test(a.thread),
    `the arrival is present in a ${a.thread.length}-char thread — the old leg's three negations were ` +
    `all true of an EMPTY thread — and nothing else spoke: ${JSON.stringify(a.thread.slice(0, 150))}`);
  say("2d and no cards, chips or history button under the question",
    a.furniture.cards === 0 && a.furniture.chips === 0 && a.furniture.history === 0 && a.furniture.news === 0,
    `cards=${a.furniture.cards} chips=${a.furniture.chips} history=${a.furniture.history} news=${a.furniture.news}`);
  say("2e the whole screen holds exactly ONE question mark",
    (a.thread.match(/\?/g) || []).length === 1,
    `${(a.thread.match(/\?/g) || []).length} question mark(s) on the entire screen`);

  // RED-PROOF THE FLOOR RULE ITSELF. Restore the stack — a speaker that ignores the floor —
  // and every one of the legs above must go red. A gate that cannot be shown to fire is the
  // gate that let the fourth composer through in the first place.
  const stacked = await run(rig, {
    welcomedAt: null, services: [{ id: "s1", price: 120 }],
    mutate: () => {
      // Exactly the shape that shipped: a speaker appending after the arrival without asking
      // the floor predicate anything.
      const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
      const obs = new MutationObserver(() => {
        if (t.querySelector('[data-hc-arrival="1"]') && !t.__stacked) {
          t.__stacked = true;
          const d = document.createElement("div"); d.className = "hc-msg hubly";
          d.textContent = "Your booking works too — customers can pick from the 1 service you priced and book online.";
          t.appendChild(d);
          const n = document.createElement("div"); n.className = "hc-msg hubly hc-news";
          n.textContent = "One person looked at your page on 09/13/2026.";
          t.appendChild(n);
        }
      });
      obs.observe(t, { childList: true, subtree: true });
    },
  });
  say("R0 restoring the stack goes RED",
    /booking works/i.test(stacked.thread) && /looked at your page/i.test(stacked.thread) &&
    (stacked.thread.match(/\?/g) || []).length === 1,
    "the detector sees the booking line and the page-view line when they are present");

  // AND THE FURNITURE IS DEFERRED, NOT LOST. Answer the name; the screen fills in.
  const released = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    return { pendingBefore: !!window.hublyArrivalUI.pending() };
  });
  say("2f the furniture is DEFERRED, not dropped — Home records that it is holding it",
    released.pendingBefore === true, `furniturePending=${released.pendingBefore}`);
  say("3 welcomed_at was written, and only with the arrival already in the DOM",
    a.rig.markedAt !== null && a.rig.markedWithArrivalInDom === true,
    `marked=${a.rig.markedAt !== null} arrivalInDomAtMark=${a.rig.markedWithArrivalInDom}`);
  say("4 every gate decision is traceable under one prefix", a.log.length >= 2 && a.log.every((l) => l.startsWith("[arrival]")),
    `${a.log.length} line(s)`);

  // ── 2. THE ROW THAT HID THREE FIXES. Already welcomed -> silent, by design. ──────────
  console.log("\n— the same owner with welcomed_at already stamped (the state that hid three fixes) —");
  const b = await run(rig, { welcomedAt: "2026-09-14T22:01:24.826016+00:00" });
  say("5 an already-welcomed owner is not congratulated twice", b.inDom === false && !/is a real address/i.test(b.thread),
    `inDom=${b.inDom}`);
  say("6 and the trace SAYS the gate closed on welcomed_at, so it can never be theorised again",
    b.log.some((l) => /due=false/.test(l) && /ALREADY WELCOMED/.test(l)),
    JSON.stringify((b.log.find((l) => /due=false/.test(l)) || "").slice(0, 150)));

  // ── 3. RED-PROOF. Restore each of the three fixed bugs; each must go red. ───────────
  console.log("\n— RED-PROOF: restoring each of the three bugs that already shipped —");

  // BUG 1 — THE GATE. The pre-2026-09-14 version gated on a localStorage flag, so an owner
  // welcomed on any device was never welcomed again anywhere. Restored by making the gate read
  // a flag that is already set.
  const g = await run(rig, {
    welcomedAt: null,
    mutate: () => {
      try { localStorage.setItem("hubly_welcomed", "1"); } catch (_) {}
      const real = window.hublyArrivalUI.simulate;
      window.hublyArrivalUI.simulate = function (biz, claimed) {
        try { if (localStorage.getItem("hubly_welcomed")) return; } catch (_) {}
        return real(biz, claimed);
      };
    },
  });
  say("R1 restoring the localStorage gate goes RED", g.inDom === false, `inDom=${g.inDom} (must be false)`);

  // BUG 2 — THE WIPE. The arrival rendered from one call site and hcRenderHome then ran from
  // the other, whose first statement is `thread.innerHTML = ''`. Restored by wiping the thread
  // one tick after the arrival lands — the exact shape of the original.
  const w = await run(rig, {
    welcomedAt: null,
    mutate: () => {
      const body = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
      const obs = new MutationObserver(() => {
        if (body.querySelector('[data-hc-arrival="1"]')) { obs.disconnect(); setTimeout(() => { body.innerHTML = ""; }, 0); }
      });
      obs.observe(body, { childList: true, subtree: true });
    },
  });
  say("R2 restoring the wipe-after-render goes RED", w.inDom === false, `inDom=${w.inDom} (must be false)`);

  // BUG 3 — THE MARKING ORDER. welcomed_at was written BEFORE the arrival was in the DOM, so a
  // render that then failed left the one-shot spent and nothing to notice. Restored by marking
  // first. The assertion that catches it is #3's second half, read at the moment of the RPC.
  const m = await run(rig, {
    welcomedAt: null,
    mutate: () => {
      const body = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
      // Mark before anything can render: fire the RPC now, with an empty thread.
      body.innerHTML = "";
      window.supabase.createClient().rpc("mark_owner_welcomed", {});
    },
  });
  say("R3 restoring mark-before-the-DOM goes RED", m.rig.markedWithArrivalInDom === false,
    `arrivalInDomAtFirstMark=${m.rig.markedWithArrivalInDom} (must be false)`);

  // ══ THE THREAD IS IN ORDER. Older above newer, always. ═══════════════════════════════
  //
  // A thread out of order is its own lie about what was said when, and Home's was out of order
  // BY CONSTRUCTION: hcRenderTranscript APPENDED restored history to the END of the thread, so
  // yesterday's turns landed UNDERNEATH today's greeting, news line, cards and suggestions.
  // On 2026-09-15 that put "hey" (stored 2026-09-14 05:52) below a news line about 2026-09-13.
  console.log("\n— the thread's order, with history restored —");
  const HISTORY = [
    { role: "user", content: "hey" },
    { role: "assistant", content: "I'd love to help. Before I make recommendations or build anything, I'd like to learn about your business." },
    { role: "user", content: ": where would I add a service mysel" },
    { role: "assistant", content: "I can't show that spot from here in this conversation." },
  ];
  const h = await run(rig, { welcomedAt: "2026-09-14T22:01:24Z", displayName: "Adrian", messages: HISTORY });
  const order = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const btn = [...t.querySelectorAll("button")].find((b) => /See earlier conversation/i.test(b.textContent));
    if (btn) btn.click();
    const kids = [...t.children];
    const idx = (pred) => kids.findIndex(pred);
    return {
      rendered: t.querySelectorAll('[data-hc-history="1"]').length,
      firstHistory: idx((e) => e.getAttribute && e.getAttribute("data-hc-history") === "1"),
      slot: idx((e) => e.getAttribute && e.getAttribute("data-hc-history-slot") === "1"),
      news: idx((e) => e.classList && e.classList.contains("hc-news")),
      text: t.innerText.replace(/\s+/g, " ").trim(),
    };
  });
  say("7 the restored history renders, once, and every turn of it",
    order.rendered === HISTORY.length, `${order.rendered} of ${HISTORY.length} rendered`);
  say("8 history sits ABOVE the block that describes today — the ordering defect",
    order.firstHistory >= 0 && order.slot > order.firstHistory && (order.news < 0 || order.news > order.firstHistory),
    `firstHistory@${order.firstHistory} slot@${order.slot} news@${order.news}`);
  say("9 the stored turns stay in seq order among themselves",
    order.text.indexOf("hey") < order.text.indexOf("where would I add a service mysel"),
    "seq 1 before seq 3");

  // RED-PROOF THE ORDERING. Calling the transcript renderer twice must not duplicate the
  // history under itself — the same lie, louder.
  const twice = await rig.page.evaluate(() => {
    const before = document.querySelectorAll('[data-hc-history="1"]').length;
    window.hublyArrivalUI.transcript();
    return { before, after: document.querySelectorAll('[data-hc-history="1"]').length };
  });
  say("10 a second render does not duplicate the history", twice.before === twice.after,
    `${twice.before} -> ${twice.after}`);

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe arrival words are in the DOM after Home settles, the thread is in order, and all three shipped bugs go red.");
process.exit(failed ? 1 : 0);
