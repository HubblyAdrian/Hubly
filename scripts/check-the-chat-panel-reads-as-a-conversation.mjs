#!/usr/bin/env node
/**
 * [RULE] IN THE CHAT RAIL, THE TWO SPEAKERS LOOK DIFFERENT AND THE TRANSCRIPT SITS ON THE COMPOSER.
 *
 *   node scripts/check-the-chat-panel-reads-as-a-conversation.mjs
 *
 * ══ WHAT HAPPENED ═══════════════════════════════════════════════════════════════════════════
 *
 * `.hc-app.hc-has-draft .hc-msg{max-width:none}` was added so Hubly's replies could use the full
 * width of a 347px panel, which is right. It also stripped the cap off `.hc-msg.user`, which is
 * a FILLED BUBBLE — and a bubble as wide as its column is a beige band. Measured live: the
 * owner's message 347px, Hubly's message 347px, identical, with only the fill to tell them
 * apart. The rule that intended otherwise was ten lines above, still in the file, overridden.
 *
 * And the transcript hung from the ceiling: thread 730px tall, content 388px, so 342px of empty
 * surface sat between the newest message and the box where the owner replies.
 *
 * ══ WHY THESE LEGS ARE PROPORTIONS AND NOT PIXELS ═══════════════════════════════════════════
 *
 * Every assertion here is a RELATIONSHIP — the bubble is narrower than the column, the last
 * message is nearer the composer than the ceiling — never a pixel count. A pixel count would go
 * red the next time the rail, the font or the padding legitimately changes, which would make
 * these [SHAPE] legs wearing [RULE] clothes. What must stay true is that the owner can see who
 * is speaking and that the conversation meets the composer; the numbers that produce it are
 * free to move.
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
  await rig.page.evaluate(installOwnerFake, { uid: "sim", email: "owner@example.com", displayName: "Owner",
    places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
    tables: { jobs: [], tasks: [], customers: [], events: [], services: [] },
    edge: { "hubly-conversation": { ok: true, reply: "Saved.", capability_results: [] } } });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad && !/never took a client/.test(bad)) throw new Error(bad);

  out = await rig.page.evaluate(async ({ biz }) => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const box = (n) => { const b = n.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };

    await window.hublyArrivalUI.simulate(biz, true, []);
    document.querySelector(".hc-app").classList.add("hc-claimed");
    window.hublyNavUI.openWorkspace("website");
    await wait(1200);

    /* THE TRANSCRIPT IS BUILT THROUGH THE PRODUCT'S OWN RENDERER, not by injecting markup —
     * a hand-built .hc-msg would be measuring markup this check invented rather than what the
     * chat actually produces. Short and long turns both, because the bubble cap only shows up
     * on a message long enough to reach for the column's edge. */
    const inner = q(".hc-thread-inner");
    const threadEl0 = q(".hc-thread");
    /* ANCHORING IS MEASURED HERE, ON THE PANEL AS THE OWNER FIRST SEES IT. Taken after the
     * transcript below is built it would be nearly vacuous: content that almost fills the panel
     * sits against the composer whether or not anything anchors it. The slack is asserted. */
    const atArrival = { thread: box(threadEl0), inner: box(inner) };
    const add = (who, text) => {
      const d = document.createElement("div");
      d.className = "hc-msg " + who; d.textContent = text; inner.appendChild(d); return d;
    };
    const u1 = add("user", "Change the price of Spring Aeration Plus to 165.");
    const h1 = add("hubly", "I notice Spring Aeration Plus isn't one of the services on your public page yet — want me to put it on at $165?");
    const u2 = add("user", "Yes please.");
    await wait(500);

    const threadEl = q(".hc-thread");
    const r = {
      column: Math.round(inner.getBoundingClientRect().width -
        (parseFloat(getComputedStyle(inner).paddingLeft) + parseFloat(getComputedStyle(inner).paddingRight))),
      userLong: box(u1), hubly: box(h1), userShort: box(u2),
      thread: box(threadEl), inner: box(inner), atArrival,
      composer: box(q(".hc-input-bar")),
      trust: box(q(".hc-ask-honesty")),
      trustVisible: !!q(".hc-ask-honesty") && getComputedStyle(q(".hc-ask-honesty")).display !== "none",
      // turn grouping: the gap before a new user turn vs. the gap before a reply
      gapBeforeReply: Math.round(h1.getBoundingClientRect().top - u1.getBoundingClientRect().bottom),
      gapBeforeNewTurn: Math.round(u2.getBoundingClientRect().top - h1.getBoundingClientRect().bottom),
      // scrolling still works: can the thread be scrolled when it overflows?
      scroll: null,
    };

    // Overflow the panel and confirm the earliest message is still reachable.
    for (let i = 0; i < 25; i++) add(i % 2 ? "hubly" : "user", "Filler turn " + i + " with enough words to occupy a line or two of the panel.");
    await wait(400);
    threadEl.scrollTop = 0;
    await wait(200);
    const first = qa(".hc-msg")[0];
    r.scroll = { scrollable: threadEl.scrollHeight > threadEl.clientHeight + 4,
                 atTopFirstVisible: first.getBoundingClientRect().top >= threadEl.getBoundingClientRect().top - 2,
                 scrollHeight: threadEl.scrollHeight, clientHeight: threadEl.clientHeight };
    threadEl.scrollTop = threadEl.scrollHeight;
    await wait(200);
    const last = qa(".hc-msg").at(-1);
    r.scroll.bottomReachesLast = last.getBoundingClientRect().bottom <= threadEl.getBoundingClientRect().bottom + 4;

    /* ── HOME: the composer is a centred 760px column, and everything in the bar must share it. ── */
    window.hublyNavUI.openWorkspace("home");
    await wait(1500);
    const bar = q(".hc-input-bar");
    r.home = {
      mode: document.querySelector(".hc-app").getAttribute("data-mode"),
      inner: box(q(".hc-thread-inner")),
      // Home keeps its own ruling: centred, never bottom-anchored.
      innerMarginTop: getComputedStyle(q(".hc-thread-inner")).marginTop,
      innerJustify: getComputedStyle(q(".hc-thread-inner")).justifyContent,
      barChildren: [...bar.children].map((c) => {
        const b = c.getBoundingClientRect();
        return { cls: String(c.className).split(" ")[0], w: Math.round(b.width), x: Math.round(b.left) };
      }),
    };
    return r;
  }, { biz: BIZ });
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

console.log(`  column ${out.column}px · user(long) ${out.userLong.w} · hubly ${out.hubly.w} · user(short) ${out.userShort.w}`);
console.log(`  gaps: before a reply ${out.gapBeforeReply}px · before a new turn ${out.gapBeforeNewTurn}px`);
console.log(`  at arrival: thread ${out.atArrival.thread.h}px tall, content ${out.atArrival.inner.h}px ` +
  `(slack ${out.atArrival.thread.h - out.atArrival.inner.h}px)`);
console.log(`  thread ${out.thread.h}px tall, content ${out.inner.h}px · composer top ${out.composer.top} · trust ${out.trust.h}px\n`);

const slack = out.atArrival.thread.h - out.atArrival.inner.h;
if (slack < 100) {
  console.error(`CANNOT RUN — only ${slack}px of slack in the panel at arrival, so a transcript pinned ` +
                `to the ceiling and one resting on the composer are not distinguishable. Leg 2 would ` +
                `pass either way.`);
  process.exit(2);
}

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 the owner's bubble is narrower than the column and Hubly's turn is not",
  why: "remove the cap that was restored for .hc-msg.user, leaving the blanket max-width:none. " +
       "Both speakers go back to the full column width and the bubble stops reading as a bubble.",
  file: "public/platform-home.html",
  find: ".hc-app.hc-has-draft .hc-msg.user{max-width:min(560px,88%)}",
  with: ".hc-app.hc-has-draft .hc-msg.user{max-width:none}",
});
leg("RULE", "1 the owner's bubble is narrower than the column and Hubly's turn is not",
  out.userLong.w < out.column - 20 && out.hubly.w >= out.column - 2,
  `column ${out.column}px: the owner's long message ${out.userLong.w}px (a ${out.column - out.userLong.w}px ` +
  `gutter), Hubly's ${out.hubly.w}px (full width, as intended for plain text). Stated as a RELATIONSHIP ` +
  `between the two, not a pixel target — before the fix both measured 347 of a 347px column.`);

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the transcript sits on the composer rather than hanging from the ceiling",
  why: "drop the auto top margin so the transcript returns to the top of the panel, leaving the " +
       "newest message as far from the cursor as the panel allows.",
  file: "public/platform-home.html",
  find: '.hc-app.hc-has-draft[data-mode="website"] .hc-thread-inner{margin-top:auto}',
  with: '.hc-app.hc-has-draft[data-mode="website"] .hc-thread-inner{margin-top:0}',
});
leg("RULE", "2 the transcript sits on the composer rather than hanging from the ceiling",
  out.atArrival.inner.bottom >= out.atArrival.thread.bottom - 24,
  `at arrival the content is ${out.atArrival.inner.h}px inside a ${out.atArrival.thread.h}px panel — ` +
  `${slack}px of slack, so where it rests is a real choice — and its bottom edge is ` +
  `${out.atArrival.thread.bottom - out.atArrival.inner.bottom}px from the panel's, i.e. against the ` +
  `composer. Before the fix a short transcript left 342px of empty surface below it. The check exits ` +
  `2 rather than asserting if the slack ever drops below 100px.`);

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 a question and its answer are grouped more tightly than two separate turns",
  why: "equalise the gaps again, so 'the owner asks / Hubly answers' is spaced exactly like 'and " +
       "now a different subject' and the transcript stops grouping into turns.",
  file: "public/platform-home.html",
  find: ".hc-app.hc-has-draft .hc-msg.hubly + .hc-msg.user{margin-top:8px}",
  with: ".hc-app.hc-has-draft .hc-msg.hubly + .hc-msg.user{margin-top:0}",
});
leg("RULE", "3 a question and its answer are grouped more tightly than two separate turns",
  out.gapBeforeNewTurn > out.gapBeforeReply,
  `${out.gapBeforeReply}px between a question and its answer, ${out.gapBeforeNewTurn}px before the next ` +
  `question. Only the ORDER of the two is asserted: which numbers produce it is a styling choice, ` +
  `and pinning them would make this leg go red on any legitimate change to the rail's rhythm.`);

/* ── LEG 4 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "4 the panel still scrolls end to end",
  why: "stop the thread scrolling. The transcript still overflows, so the earliest turns are on " +
       "the page and unreachable — the failure mode that anchoring the content to the bottom " +
       "could plausibly introduce, which is why it is asserted rather than assumed. " +
       "`clip` and not `hidden`: the first attempt used hidden and came back NOT RED, because " +
       "hidden still permits PROGRAMMATIC scrolling and this check scrolls by setting scrollTop. " +
       "The rule's own comment, twelve lines above it, already said so about overflow-x.",
  file: "public/platform-home.html",
  find: ".hc-thread{flex:1;min-height:0;overflow-y:auto;overflow-x:clip}",
  with: ".hc-thread{flex:1;min-height:0;overflow-y:clip;overflow-x:clip}",
});
leg("RULE", "4 the panel still scrolls end to end",
  out.scroll.scrollable && out.scroll.atTopFirstVisible && out.scroll.bottomReachesLast,
  `with 28 turns the panel scrolls (${out.scroll.scrollHeight} > ${out.scroll.clientHeight}); at ` +
  `scrollTop 0 the FIRST message is reachable (${out.scroll.atTopFirstVisible}) and at the bottom the ` +
  `LAST one is (${out.scroll.bottomReachesLast}). The first-message half is the point: ` +
  `justify-content:flex-end would strand it above the scroll origin, which is exactly the trap ` +
  `margin-top:auto avoids — this leg is why that choice is safe rather than merely claimed.`);

/* ── LEG 5 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "5 the trust line is still on the surface the owner types on",
  why: "hide the honesty line. It is one sentence — 'Hubly uses your real data. I won't make up " +
       "information.' — printed where the owner decides whether to believe an answer, and it is " +
       "the kind of thing a layout pass removes without noticing.",
  file: "public/platform-home.html",
  find: ".hc-ask-honesty{margin:8px 2px 0;font-size:12px;",
  with: ".hc-ask-honesty{display:none;margin:8px 2px 0;font-size:12px;",
});
leg("RULE", "5 the trust line is still on the surface the owner types on",
  out.trustVisible && out.trust.h > 0 && out.trust.top >= out.composer.top,
  `trust line ${out.trust.h}px tall, displayed, and below the composer's top edge ` +
  `(${out.trust.top} >= ${out.composer.top}). Given its own leg because this phase moved things ` +
  `around it and a sentence that quietly disappears is the easiest casualty of a spacing change.`);

/* ── LEG 6 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "6 in Home every child of the composer bar shares the composer's column",
  why: "name .ask-wrap alone again, which is how this shipped. The box gets the 760px column " +
       "and the honesty line stays at full bar width, three hundred pixels to its left — a " +
       "stray caption in the corner rather than the composer's own footnote.",
  file: "public/platform-home.html",
  find: '.hc-app.hc-has-draft[data-mode="home"] .hc-input-bar > *,',
  with: '.hc-app.hc-has-draft[data-mode="home"] .hc-input-bar > .ask-wrap:not(*),',
});
{
  const kids = out.home.barChildren.filter((c) => c.w > 0);
  const widths = [...new Set(kids.map((c) => c.w))];
  const lefts = [...new Set(kids.map((c) => c.x))];
  leg("RULE", "6 in Home every child of the composer bar shares the composer's column",
    out.home.mode === "home" && kids.length > 0 && widths.length === 1 && lefts.length === 1,
    `${kids.length} rendered bar children at widths [${widths}] and left edges [${lefts}] — one ` +
    `column, so the honesty line sits under the box it describes. Asserted as "they all agree" ` +
    `rather than "each is 760px": the column's width is a design choice that may move, while the ` +
    `bar disagreeing with itself is the defect. Measured before the fix: box 760px at x=565, ` +
    `honesty line 1406px at x=242.`);
}

/* ── LEG 7 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "7 Home is still the centred reading column, not bottom-anchored like the rail",
  why: "move Home's thread off centre. Home is a centred reading column by an explicit ruling " +
       "(.hc-home-centred) and this phase must not restyle it while fixing the rail beside it.\n" +
       "The obvious break — broadening the rail's `margin-top:auto` to every mode — was tried " +
       "first and came back NOT RED, and the reason is worth keeping: Home's thread is " +
       "display:block, so an auto top margin is inert there no matter what the selector says. " +
       "The blast radius is smaller than the selector implies, but a leg that cannot go red is " +
       "not evidence of that, so the break aims at the property the leg actually names.",
  file: "public/platform-home.html",
  find: ".hc-app.hc-home-centred .hc-thread-inner{justify-content:center;min-height:100%}",
  with: ".hc-app.hc-home-centred .hc-thread-inner{justify-content:flex-end;min-height:100%}",
});
leg("RULE", "7 Home is still the centred reading column, not bottom-anchored like the rail",
  out.home.innerJustify === "center" && out.home.innerMarginTop === "0px",
  `Home's thread: justify-content ${out.home.innerJustify}, margin-top ${out.home.innerMarginTop}. ` +
  `The rail's anchoring is scoped [data-mode="website"] on purpose, and this leg is what keeps it ` +
  `scoped — a blast-radius assertion, guarding the surface the change was NOT meant to touch.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
