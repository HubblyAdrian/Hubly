#!/usr/bin/env node
/**
 * THE CONVERSATION IS THE SURFACE — and six things from the 2026-09-15 walk.
 *
 *   node scripts/check-conversation-is-the-surface.mjs
 *
 * ADRIAN'S RULING, in his words: "if someone says open my schedule or take me to my schedule
 * the schedule should show up on this chat. that way they can see it easy. its the same thing
 * as looking at leads jobs etc"
 *
 * SIMULATED AND SAID SO: no session. window.supabase is a declared fake; the views, the cards,
 * the gates and the sentences are the shipping code in public/platform-home.html.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture",
              name: "Hubly Classic Fixture", url: "https://hubly-classic-fixture.myhubly.app", hasPage: true };
const iso = (d) => { const x = new Date(Date.now() + d * 864e5);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

/** THE REAL ROWS from his walk account, in the measured shape. */
function fakeBackend(opts) {
  const W = window;
  W.__rig = { rpc: [] };
  const ok = (data) => Promise.resolve({ data, error: null });
  const q = (rows) => { let held = rows.slice();
    const t = { select: (_c, o) => (o && o.count ? Object.assign(t, { __count: true }) : t),
      in: () => t, gte: () => t, lte: () => t, order: () => t, limit: () => t,
      eq: (c, v) => { held = held.filter((r) => String(r[c]) === String(v)); return t; },
      maybeSingle: () => ok(held[0] || null), single: () => ok(held[0] || null),
      then: (res, rej) => Promise.resolve(t.__count ? { data: null, count: held.length, error: null } : { data: held, error: null }).then(res, rej) };
    return t; };
  const client = {
    auth: { getUser: () => ok({ user: { id: opts.uid, email: opts.email, user_metadata: opts.meta || {} } }),
            getSession: () => ok({ session: { access_token: "sim", expires_at: Math.floor(Date.now() / 1000) + 3600 } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (t) => q(opts.tables[t] || []),
    rpc: (name) => { W.__rig.rpc.push(name);
      if (name === "get_owner_profile") return ok([{ display_name: opts.displayName, name_source: opts.displayName ? "owner" : "unknown", welcomed_at: "2026-09-14T22:01:24Z" }]);
      if (name === "get_business_customers") return ok(opts.tables.customers || []);
      if (name === "get_business_customer_count") return ok((opts.tables.customers || []).length);
      if (name === "get_business_hours") return ok(opts.hours || []);
      if (name === "get_public_business") return ok([{ brand_color: null, city: null, state: null, meta: null }]);
      // THE REAL PLACES ROWS. His walk account has exactly ONE (website) — which is why the old
      // gate said his schedule "isn't set up". Returning [] here would make hcWorkspaces FAIL
      // OPEN and treat every place as earned, and the red-proof for leg 6 would pass while the
      // defect was restored. It did exactly that on the first attempt.
      if (name === "get_public_business_places") return ok(opts.places || [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }]);
      return ok(null); },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: () => {},
  };
  W.supabase = { createClient: () => client };
  try { localStorage.setItem("sb-rtwxxkxpkqdrhclkozma-auth-token", JSON.stringify({ access_token: "sim", expires_at: Math.floor(Date.now() / 1000) + 3600 })); } catch (_) {}
  W.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
}

const JOBS = [
  { id: "block-1", business_id: BIZ.id, customer_name: null, service_name: "doctor’s appointment", scheduled_date: iso(1),
    scheduled_time: "07:00:00", duration_hours: 2, amount: null, status: "scheduled", address: null, is_block: true, paid: false },
  { id: "job-1", business_id: BIZ.id, customer_name: null, service_name: "driveway", scheduled_date: iso(2),
    scheduled_time: "14:00:00", duration_hours: null, amount: 180, status: "scheduled", address: "14 Maple St", is_block: false, paid: false },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

async function boot(opts) {
  await rig.load(PAGE);
  await rig.page.evaluate(fakeBackend, opts);
  const seams = await rig.page.evaluate(() => ({
    views: !!(window.hublyThreadViews && window.hublyThreadViews.show),
    name: !!(window.hublyOwnerName && window.hublyOwnerName.label),
    arrival: !!(window.hublyArrivalUI && window.hublyArrivalUI.simulate),
  }));
  if (!seams.views || !seams.name || !seams.arrival) throw new Error("seams missing: " + JSON.stringify(seams));
  await rig.page.evaluate((b) => { window.hublyArrivalUI.simulate(b, true); }, BIZ);
  await rig.settle(() => !!document.getElementById("hcRail"), "boot", { stableMs: 500, ceilingMs: 6000 });
}

try {
  console.log("SIMULATED — no session. Rows are the measured shape from the walk.\n");

  // ══ 1. THE ROOM COMES TO HIM. ════════════════════════════════════════════════════════
  await boot({ uid: "f3f11707-783f-4cce-b4c3-dfdccfde2e57", email: "adriansmithee+ever@gmail.com",
               displayName: "Adrian", tables: { jobs: JOBS, customers: [] }, hours: [{}] });
  const shown = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const before = t.innerText;
    const r = await window.hublyThreadViews.show("day");
    return { r, before,
      // BOTH ROW SHAPES: the old thread view's rows, and My Day's — today's band rows and the
      // "Later this week" rows, which is where a job dated past today correctly lands.
      cards: t.querySelectorAll('[data-hc-view-row="day"], .hcmd-row, .hcmd-laterrow').length,
             head: !!t.querySelector('[data-hc-thread-view="day"]'),
             text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  // RETARGETED 2026-09-16, INTENT UNCHANGED. "Show me my day" now renders MY DAY into the thread —
  // the same renderer Home uses — rather than a thinner list built only for the conversation. Two
  // views of the same rows is how they come to disagree, and the copy in the transcript is the one
  // the owner would be looking at when he acts. The rule these legs assert is unchanged: the day
  // appears IN THE CONVERSATION, its rows are real records, and pressing one opens the job.
  say("1 'show me my day' renders the day IN THE THREAD", shown.r.ok === true && shown.cards >= 2,
    `rows=${shown.cards} (expected the 2 real rows, in bands or under Later this week)`);
  say("2 each row is a real record carrying its own fields, in 12-hour time",
    /doctor’s appointment/.test(shown.text) && /7:00 AM/.test(shown.text) && /driveway/.test(shown.text) &&
    /2:00 PM/.test(shown.text) && /14 Maple St/.test(shown.text) && /\$180/.test(shown.text),
    JSON.stringify(shown.text.slice(-190)));
  say("3 no 24-hour clock anywhere in the rendered day", !/(?<!\d)\d{1,2}:\d{2}(?!\s*[AP]M)/i.test(shown.text),
    "12-hour only");

  // IT IS THE JOB CARD, NOT A SECOND THING BESIDE IT.
  const oneMechanism = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    // RETARGETED: My Day's own rows are the day's rows now. The RULE is unchanged — the thing the
    // owner presses on the day must open the job, not sit beside a second card that does.
    const viewCard = t.querySelector('[data-hc-view-row="day"], .hc-inthread-day .hcmd-row, .hc-inthread-day .hcmd-laterrow');
    window.hublyJobUI.append({ id: "j9", customer_name: "Dana", service_name: "windows", scheduled_date: "2026-09-18", scheduled_time: "09:30:00", amount: 180 });
    const jobCard = t.querySelector("[data-hc-job]");
    return { viewCls: viewCard && viewCard.className, jobCls: jobCard && jobCard.className,
             viewTag: viewCard && viewCard.tagName, jobTag: jobCard && jobCard.tagName };
  });
  // RETARGETED 2026-09-16, AND THE OLD LEG ENCODED A COMPONENT, NOT A RULE. It asserted the day's
  // row IS literally an `hc-job-card` BUTTON, which was true while the thread view was a list of
  // job cards. The approved design specifies a ROW — `What | When | Where | Type` (ruling 4) — so
  // My Day's rows cannot be that component, and "make them job cards again" would be the check
  // arguing for the wrong product (Lesson 92).
  //
  // THE RULE UNDERNEATH SURVIVES INTACT: one mechanism. Pressing a row on the day and pressing a
  // job card must open THE SAME PANEL — not two surfaces for one record. That is what is asserted
  // now, by opening each and comparing the element that answered.
  const oneP = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const panelOf = () => document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    const row = t.querySelector('.hc-inthread-day .hcmd-row, .hc-inthread-day .hcmd-laterrow');
    if (!row) return { ok: false, why: "no day row" };
    row.click();
    const a = panelOf();
    const aTxt = a ? a.innerText.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    const card = t.querySelector("[data-hc-job]");
    if (!card) return { ok: false, why: "no job card" };
    card.click();
    const b = panelOf();
    return { ok: true, same: !!a && a === b, aTxt, bTxt: b ? b.innerText.replace(/\s+/g, " ").trim().slice(0, 60) : "" };
  });
  say("4 a day row and a job card open the SAME panel — one mechanism, not two",
    oneP.ok === true && oneP.same === true,
    oneP.ok ? `row -> ${JSON.stringify(oneP.aTxt)} · card -> ${JSON.stringify(oneP.bTxt)}` : oneP.why);

  // PRESSING ONE OPENS THE RECORD IN THE RIGHT PANE — the thing a human already did.
  const opened = await rig.page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-hc-view-row="day"], .hc-inthread-day .hcmd-row, .hc-inthread-day .hcmd-laterrow')];
    const target = rows.find((r) => /driveway/i.test(r.innerText));
    if (!target) return { clicked: false };
    target.click();
    const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    return { clicked: true, panel: p ? p.innerText.replace(/\s+/g, " ").trim() : "" };
  });
  // ══ ONE MECHANISM: THE CARD AND THE SENTENCE DO THE SAME THING. ══════════════════════
  //
  // 2026-09-15, Adrian: typing "take me to my schedule" did nothing while the card worked. The
  // card called hcOpenWorkspace('planner') — a ROOM in the right pane — and the sentence called
  // hcShowInThread. Two code paths, two surfaces, two failure modes, for one request. Screen 2
  // of owner-home-2026-09-06-flow.png (approved 2026-09-06) settles which wins: the view is
  // rendered INSIDE THE CONVERSATION. So the card is now the same call.
  const wiring = await rig.page.evaluate(() => {
    const src = [...document.querySelectorAll("script")].map((s) => s.textContent).join("\n");
    const i = src.indexOf("id:'schedule'");
    // A WIDE ENOUGH WINDOW. 900 chars stopped short of `view:'day'` because the comment
    // explaining the change sits between them — so the leg reported the fix absent while it was
    // present twelve lines below. A window sized to yesterday's code is not a measurement.
    const seg = i >= 0 ? src.slice(i, i + 2400) : "";
    const j = src.indexOf("id:'customers'");
    const seg2 = j >= 0 ? src.slice(j, j + 700) : "";
    return { schedule: /view:'day'/.test(seg) && !/open:'planner'/.test(seg),
             customers: /view:'customers'/.test(seg2) && !/open:'customers'/.test(seg2),
             handler: /if\(p\.view\) hcShowInThread\(p\.view\)/.test(src) };
  });
  say("4a the schedule card renders in the conversation, the same call the sentence makes",
    wiring.schedule && wiring.handler, `schedule=${wiring.schedule} handler=${wiring.handler}`);
  say("4b and so does the customers card", wiring.customers, `customers=${wiring.customers}`);

  say("5 pressing a row opens that record in the right pane",
    opened.clicked && /driveway/i.test(opened.panel) && /14 Maple St/.test(opened.panel) && /2:00 PM/.test(opened.panel),
    JSON.stringify(opened.panel.slice(0, 130)));

  // ══ 2+3. A FULL DAY IS NEVER REPORTED AS ABSENT, AND NOTHING IS ANNOUNCED FIRST. ═════
  /* ══ WHAT WAS SAID DURING THE TURN, NOT WHAT IS ON SCREEN AFTER IT ═══════════════════════════
   *
   * The first version read the thread's innerText after the call. That cannot see an optimistic
   * line, because entering a room LOADS THAT ROOM'S CONVERSATION, which begins
   * `thread.innerHTML = ''` — so anything said before the room opened is wiped by the room opening,
   * and leg 7 stayed green with an "Opening your day…" deliberately inserted. A DOM snapshot after
   * a turn is not a transcript of the turn.
   *
   * A MutationObserver accumulates every node added while the call runs, so the question becomes
   * "was this ever said" instead of "is it still on screen". */
  const goRes = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    t.innerHTML = "";
    const said = [];
    const obs = new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        const s = (n.innerText || n.textContent || "").replace(/\s+/g, " ").trim();
        if (s) said.push(s);
      }
    });
    obs.observe(t, { childList: true, subtree: true });
    const r = await window.hublyGoUI.go("planner");
    await new Promise((res) => setTimeout(res, 250));
    obs.disconnect();
    return { r, text: t.innerText.replace(/\s+/g, " ").trim(), said };
  });
  /* ══ L98 — THE #1 VACUOUS LEG IN THE REPO, AND OF ALL THE LEGS TO BE ONE ═════════════════════
   *
   * It asserted ONLY that "not set up on this account" was ABSENT. A blank render has no text at
   * all, so it passed on an unrendered room, a failed load, and a thread wiped and never refilled —
   * every state that looks exactly like the defect. **This is the leg guarding the sentence that
   * told Graef he had no schedule**: the check written to prevent Lesson 86 contained Lesson 86's
   * own defect, being unable to tell an emptiness from a failure to look.
   *
   * AND WRITING THE POSITIVE CLAUSE FOUND A SECOND THING. The leg read the THREAD TEXT after
   * `go("planner")`, on the assumption that the day lands there. It does not: entering a room puts
   * the day in the CANVAS and the room's own conversation in the thread (ruled 2026-09-17 — "Home
   * is the conversation; if he ASKS for his day it renders in the thread", which is
   * hcShowInThread, leg 1 above). So the old leg was reading a surface that never carries the
   * sentence it was looking for — vacuous twice over.
   *
   * THE POSITIVE CLAUSE IS THE DOOR'S OWN RECEIPT: it COUNTED rows and it opened. That cannot be
   * true of a blank render, and `counted > 0` is the exact fact the 2026-09-15 defect got wrong. */
  declareBreak({
    leg: "6 the day's rows were COUNTED",
    why: "RESTORE LESSON 86's OWN DEFECT — gate hcGoToPlace on business_places ROWS instead of on " +
         "content, so a day holding a driveway job and a doctor's appointment is told it 'isn't set " +
         "up on this account yet'. That sentence was said to a real owner on 2026-09-15",
    file: "public/platform-home.html",
    find: "    var n = await hcViewCount(kind === 'planner' ? 'day' : kind);",
    with: "    var n = hcWorkspaces().some(function(w){ return w.id === kind; }) ? 1 : 0;\n" +
          "    if(n === 0){ hcAppendMessage('hubly', 'Your ' + p.say + ' isn\u2019t set up on this account yet.'); return { ok:false, error:'not_set_up' }; }",
  });
  say("6 the day's rows were COUNTED and the door opened, and it was NOT called 'not set up on this account'",
    !!goRes.r && goRes.r.ok === true && Number(goRes.r.counted) > 0 &&
    !/isn’t set up|isn't set up|not set up/i.test(goRes.text),
    `the door counted ${goRes.r && goRes.r.counted} row(s) and opened (ok=${goRes.r && goRes.r.ok}); the ` +
    `blames-the-account sentence is absent. The POSITIVE clause is the point — the old leg asserted ` +
    `only the absence and passed on every state that looks like the defect.`);
  /* ALSO PURELY NEGATIVE, in the same block: "nothing was announced first" is trivially true of a
   * thread with nothing in it. The positive clause is that the door RETURNED A RECEIPT, so a turn
   * demonstrably happened and the absence is a statement about it. */
  declareBreak({
    leg: "7 the door returned a receipt",
    why: "announce the action before the outcome is known — the premature 'Adding X' class, which " +
         "claims a placement before it has landed",
    file: "public/platform-home.html",
    // ANCHORED ON A LINE UNIQUE TO hcGoToPlace. `var p = HC_GO_PLACES[kind];` appears TWICE —
    // here and in hcGoToPlaceLine, its message composer — and the runner refused the break rather
    // than picking one, which is the behaviour that makes a declared break trustworthy.
    find: "    if(!p){ hcAppendMessage('hubly', 'I cannot take you there yet.'); return { ok:false, error:'unknown_place' }; }",
    with: "    if(!p){ hcAppendMessage('hubly', 'I cannot take you there yet.'); return { ok:false, error:'unknown_place' }; }\n    hcAppendMessage('hubly', 'Opening your ' + p.say + '\u2026');",
  });
  say("7 the door returned a receipt, and nothing optimistic was EVER said during the turn",
    !!goRes.r && typeof goRes.r === "object" && goRes.said.length > 0 &&
    !goRes.said.some((l) => /^Opening|Opening your|pulling up|fetching/i.test(l)),
    `hcGoToPlace returned ${JSON.stringify(goRes.r).slice(0, 60)} and ${goRes.said.length} thing(s) ` +
    `were said during the turn, none of them announcing the action before its outcome. Read from a ` +
    `MutationObserver, not the final DOM — the room's own conversation load wipes the thread, so a ` +
    `snapshot afterwards cannot see an optimistic line at all`);

  // AN EMPTY COLLECTION IS SAID TO BE EMPTY — not 'not set up', which blames the account.
  await boot({ uid: "u2", email: "x@y.com", displayName: "Adrian", tables: { jobs: [], customers: [] }, hours: [] });
  // ══ 4. NO DOORS TO EMPTY ROOMS — READ BEFORE ANYTHING TOUCHES THE THREAD. ════════════
  //
  // The first version of this check read the promise buttons AFTER the empty-day test below,
  // which begins `t.innerHTML = ""`. It therefore found zero buttons and passed — with the
  // defect restored, it still found zero and still passed. A check that clears the surface it
  // is about to measure is Lesson 83 exactly, written the same night the lesson was.
  await rig.settle(() => document.querySelectorAll("[data-promise]").length, "promises", { stableMs: 700, ceilingMs: 8000 });
  const empties = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    return { labels: [...t.querySelectorAll("[data-promise]")].map((b) => b.getAttribute("data-promise")) };
  });
  say("9a the furniture actually rendered, so leg 9 is measuring something",
    empties.labels.length > 0, `${empties.labels.length} promise(s) on screen: ${JSON.stringify(empties.labels)}`);
  const emptyRes = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    t.innerHTML = "";
    const r = await window.hublyThreadViews.show("day");
    return { r, text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  // RETARGETED, AND THE OLD LEG NOW CONTRADICTS A RULING. "renders no cards" was true of the old
  // thin list; My Day renders THREE BANDS ALWAYS — "every day has an A, a B and a C" (Adrian,
  // 2026-09-16). What must still hold is the honest part: an empty day SAYS it is empty, offers
  // the ways that work, and renders NO GHOST ROWS — ruling 2, "grey placeholder rows read as
  // loading and make an empty state look broken."
  const emptyRows = await rig.page.evaluate(() =>
    document.querySelectorAll('.hc-inthread-day .hcmd-row, .hc-inthread-day .hcmd-laterrow').length);
  say("8 a genuinely empty day says so plainly, and renders NO ghost rows",
    emptyRes.r.ok === true && emptyRows === 0
      && /Nothing on it yet/i.test(emptyRes.text) && !/not set up/i.test(emptyRes.text),
    `${emptyRows} row(s) · ${JSON.stringify(emptyRes.text.slice(-120))}`);
  // WRITTEN STALE AND CAUGHT THE SAME DAY. This leg first read "…and NOT a screenshot clause,
  // because that route is not wired" — a statement about the state on the hour it was written. The
  // hour import-schedule shipped it went red against a correct product: Lesson 92, by the person
  // who had just written Lesson 92 into a check one file over.
  //
  // The rule is that the sentence is COMPOSED, not typed. So it is compared against what the
  // registry composes, which stays true through every wiring change in either direction.
  const composed = await rig.page.evaluate(() => window.hublyWaysUI.clause("day"));
  say("8b the empty state's offer IS the composed one, not a typed copy of it",
    emptyRes.text.includes(composed) && composed.length > 12,
    JSON.stringify(composed));

  /* FOUR `!includes` OVER A LIST THAT IS EMPTY ON AN UNRENDERED THREAD. Leg 9a beside it measures
   * that the furniture rendered, but a leg must not depend on its neighbour having run: the
   * guarantee belongs inside the assertion that makes the claim. */
  declareBreak({
    leg: "9 the promises rendered",
    why: "offer a door to an empty room — drop the needs(ctx) gate so every card renders whether " +
         "its room holds anything or not, which is prohibition 5 inverted",
    file: "public/platform-home.html",
    // THE CARD RENDERER SPECIFICALLY. The same gate line exists in hcRenderSuggestions (the chips),
    // so the bare line matched twice and was refused; the `kind !== 'card'` line above it is unique.
    find: "      if(p.kind !== 'card') return false;\n      try{ return p.needs(ctx); }catch(e){ return false; }",
    with: "      if(p.kind !== 'card') return false;\n      return true;",
  });
  say("9 the promises rendered, and none of them is a door to an empty room",
    !empties.labels.includes("schedule") && !empties.labels.includes("customers") &&
    !empties.labels.includes("sales") && !empties.labels.includes("q-bookings") &&
    !empties.labels.includes("q-regulars") && !empties.labels.includes("q-earned") &&
    empties.labels.length > 0,
    `${empties.labels.length} promise(s) actually rendered, and none of the four empty-room doors is ` +
    `among them — offered: ${JSON.stringify(empties.labels)}`);

  // ══ 6. WHAT WE CALL HIM. ═════════════════════════════════════════════════════════════
  //
  // A FRESH BOOT, because the empty-day leg above begins `t.innerHTML = ""` and the greeting
  // lives in that thread. Reading it afterwards measures a wiped surface — which is how leg 9
  // came to pass vacuously the first time this file was written. Here it failed loudly instead,
  // which is the better of the two outcomes and still the same mistake.
  await boot({ uid: "u4", email: "adriansmithee+ever@gmail.com", displayName: "Adrian",
               tables: { jobs: [], customers: [] }, hours: [] });
  const names = await rig.page.evaluate(() => {
    const N = window.hublyOwnerName;
    const chip = () => { const b = document.getElementById("navSignin"); return b ? b.innerText.replace(/\s+/g, " ").trim() : ""; };
    const out = {};
    out.withName = { label: N.label(), first: N.first(), isEmail: N.isEmail(), chip: chip() };
    return out;
  });
  say("10 with a stored name, that name is what he is called — not his email",
    names.withName.label === "Adrian" && names.withName.first === "Adrian" && names.withName.isEmail === false &&
    !/@/.test(names.withName.chip),
    `label=${JSON.stringify(names.withName.label)} chip=${JSON.stringify(names.withName.chip)}`);

  // ══ AND EVERY SURFACE THAT NAMES HIM MUST ACTUALLY USE IT. ═══════════════════════════
  //
  // Adrian, 2026-09-15: "the name is captured and NOTHING USES IT. That is the entire point of
  // asking." The header read "Good morning." and the chip read his email.
  //
  // AN EMAIL-ONLY CHECK WOULD HAVE PASSED BOTH. "Good morning." contains no email, so a leg
  // asserting "no raw email on an owner-facing surface" is green while the name is silently
  // dropped. So this asserts the POSITIVE: where a display name exists, the surfaces that name
  // a person SAY IT.
  const surfaces = await rig.page.evaluate(() => {
    const t = (s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; };
    return { greeting: t(".hc-idw-hi"), chip: t("#navSignin") };
  });
  say("10a the greeting uses the stored name, and does not silently drop it",
    !!surfaces.greeting && /\bAdrian\b/.test(surfaces.greeting) && !/@/.test(surfaces.greeting),
    JSON.stringify(surfaces.greeting));
  say("10b the account chip uses it too",
    !!surfaces.chip && /\bAdrian\b/.test(surfaces.chip) && !/@/.test(surfaces.chip),
    JSON.stringify(surfaces.chip));

  await boot({ uid: "u3", email: "adriansmithee+ever@gmail.com", displayName: null,
               tables: { jobs: [], customers: [] }, hours: [] });
  const noName = await rig.page.evaluate(() => {
    const N = window.hublyOwnerName;
    const b = document.getElementById("navSignin");
    return { label: N.label(), first: N.first(), isEmail: N.isEmail(), chip: b ? b.innerText.replace(/\s+/g, " ").trim() : "" };
  });
  say("11 with NO name anywhere, the email is the fallback and is not passed off as a name",
    noName.isEmail === true && noName.first === null && /@/.test(noName.label),
    `label=${JSON.stringify(noName.label)} first=${JSON.stringify(noName.first)}`);
  // AND NO NAME IS MANUFACTURED FROM THE CREDENTIAL.
  /* `indexOf("@") >= 0` looks positive and is not: it is satisfied by the RAW EMAIL, so a reader
   * that never ran and one that correctly fell back to the address are indistinguishable. The
   * positive clause that matters is that the reader ANSWERED — a non-empty label, an explicit
   * isEmail verdict, and a first name of exactly null. */
  declareBreak({
    leg: "12 the name reader answered",
    why: "manufacture a name out of the credential — the email local-part heuristic, which passes " +
         "off 'Adriansmithee' as something the owner told us",
    file: "public/platform-home.html",
    find: "    var em = String(hcIdentity.email || '').trim();\n    return em || '';",
    with: "    var em = String(hcIdentity.email || '').trim();\n    if(em) return em.split('@')[0].replace(/^./, function(c){ return c.toUpperCase(); });\n    return em || '';",
  });
  say("12 the name reader answered, and no name was derived from the email local-part",
    typeof noName.label === "string" && noName.label.length > 0 && noName.isEmail === true &&
    noName.label.indexOf("@") >= 0 && !/^Adriansmithee$/i.test(noName.label),
    `the reader returned ${JSON.stringify(noName.label)} and called it an email — it is not the ` +
    `local-part dressed up as a name`);
  // WITH NOTHING ON RECORD, "Good morning." IS CORRECT — and it is the only case in which it is.
  const bare = await rig.page.evaluate(() => {
    const e = document.querySelector(".hc-idw-hi");
    return e ? e.innerText.replace(/\s+/g, " ").trim() : null;
  });
  say("12a with no name on record the greeting drops it rather than using his email",
    !!bare && !/@/.test(bare) && /^Good (morning|afternoon|evening)\.$/.test(bare),
    JSON.stringify(bare));

  // ══ AND THE CAPTURE DOES NOT DEPEND ON OUR QUESTION. ═════════════════════════════════
  //
  // hcOwner.awaitingName is set in ONE place — hcRenderArrival — which fires once per account
  // against welcomed_at. His answer was dropped (the fix shipped 26 minutes later) and the
  // window is now closed forever: a one-shot whose answer was lost leaves no way to ask again.
  // So the model reports a stated name on ANY turn, and the client grounds it.
  const idx2 = readFileSync(resolve(ROOT, "supabase/functions/hubly-conversation/index.ts"), "utf8");
  say("16a a name stated on any turn is captured, not only an answer to our question",
    /"ownerName" is optional[\s\S]{0,200}ANY turn/.test(idx2) && /never from their email/.test(idx2),
    "the standing prompt rule, not only the nameAnswer turn");

  // ── SOURCE-SIDE: the pieces a rig cannot exercise without a real turn. ───────────────
  const src = readFileSync(resolve(ROOT, "public/platform-home.html"), "utf8");
  say("13 the deferred furniture is released at the END of the turn, after the reply",
    /hcEnsureTurnSpoke\(data\);[\s\S]{0,400}?hcReleaseHeldFurniture\(\)/.test(src) &&
    !/hcReleaseHeldFurniture\(\);\s*\n\s*hc\.messages\.push/.test(src),
    "released after hcEnsureTurnSpoke, not before hcCall");
  const reg = readFileSync(resolve(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts"), "utf8");
  say("14 the model has a showMe capability and is told to announce nothing",
    /name: "showMe"/.test(reg) && /SAY NOTHING ABOUT IT/.test(reg) && /do not predict what they will see/i.test(reg),
    "business.showMe");
  say("15 goToPlace no longer competes for 'show me'",
    /USE business\.showMe INSTEAD FOR ANYTHING THEY WANT TO SEE/.test(reg), "de-conflicted");
  const idx = readFileSync(resolve(ROOT, "supabase/functions/hubly-conversation/index.ts"), "utf8");
  say("16 a name answer the shape list missed is read by the model and written by the client",
    /nameAnswer === true/.test(idx) && /ownerName/.test(idx) && /hcAcceptOwnerName/.test(src),
    "nameAnswer -> ownerName -> grounded client write");

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally { try { await rig.close(); } catch (_) {} }

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe room comes to the conversation, nothing is announced before it is known, and he is called by his name.");
process.exit(failed ? 1 : 0);
