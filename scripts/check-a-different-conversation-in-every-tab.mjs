#!/usr/bin/env node
/**
 * [RULE] EVERY TAB HAS ITS OWN CONVERSATION. HOME HAS THE MAIN ONE. THEY DO NOT MIX.
 *
 *   node scripts/check-a-different-conversation-in-every-tab.mjs
 *
 * ══ ADRIAN, 2026-09-17 ══════════════════════════════════════════════════════════════════════
 *
 *   "CONVERSATION IDENTITY — a different conversation in every tab except Home, and chats SAVED
 *    the way ChatGPT and Claude save them. This is a feature, not polish, and it has been open
 *    since the beginning."
 *
 * ══ AND THEN, THE SAME DAY: "HOME'S CONVERSATION IS GOING INTO THE WEBSITE TAB." ════════════
 *
 * THE FIRST VERSION OF THIS CHECK IS WHY HE HAD TO REPORT THAT. It carried a HAND-WRITTEN list of
 * three places — website, planner, jobs — and exercised TWO of them. Website was in the list and
 * never pressed. So the check said "every tab keeps its own conversation" while the one tab every
 * business has by default was untested, and the defect lived in exactly that gap.
 *
 * That is Lesson 97, and this file is its first application: **the instances are DERIVED FROM THE
 * PRODUCT** — `window.hublyListUI.surfaces` is HC_PLACE_SURFACES itself — and every one of them is
 * pressed. A place added to that map tomorrow is covered tomorrow, with no edit here. A list of
 * tabs written in a check is a hand-maintained set and it goes stale the way every other one has.
 *
 * ══ AND THE DEFECT ITSELF WAS NOT THE READ ══════════════════════════════════════════════════
 *
 * Website WAS wired: hcOpenWorkspace loads a place conversation for every key in that map. The bug
 * was a LATE PAINT — hcOpenOwnedBusiness starts the room's load, and then, on a promise that
 * resolves afterwards, hcMaybeShowArrival ends with an unconditional hcRenderHome() that wipes the
 * thread and paints Home's. So leg R1 drives that exact ordering rather than a tidier one, because
 * a check that presses tabs in a calm sequence cannot see it.
 *
 * Every leg drives the real shell: the rail tab is PRESSED, and what the product stores is read
 * back out of the declared backend.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";
import { readFileSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srv = await servePublic(ROOT);
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture", hasPage: true };

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

const press = (label) => rig.page.evaluate(async (label) => {
  const rx = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const tab = [...document.querySelectorAll(".hc-rail-tab")].filter((b) => rx.test(b.textContent))[0];
  if (!tab) return false;
  tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await new Promise((r) => setTimeout(r, 900));
  return true;
}, label);
const state = () => rig.page.evaluate(() => ({
  msgs: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()),
  current: window.hublyChatUI.current(),
  mode: (document.getElementById("hcApp") || {}).dataset ? document.getElementById("hcApp").dataset.mode : null,
  convos: (window.__rig.tables.ask_hubly_conversations || []).map((c) => ({ place: c.place, title: c.title, id: c.id })),
  stored: (window.__rig.tables.ask_hubly_messages || []).map((m) => ({ cid: m.conversation_id, content: m.content })),
}));

try {
  console.log("SIMULATED OWNER — no session, no network. The rail tabs are pressed for real.\n");
  await rig.load(srv.url("platform-home.html"));

  /* ══ THE INSTANCES COME FROM THE PRODUCT (Lesson 97) ══════════════════════════════════════
     Read HC_PLACE_SURFACES off the published seam, then seed a business_places row for each so
     every one of them is EARNED and therefore pressable. A hand-written list here would have
     exactly the hole that let "Home's conversation is going into the Website tab" ship. */
  const surfaces = await rig.page.evaluate(() => {
    const s = window.hublyListUI && window.hublyListUI.surfaces;
    return s ? Object.keys(s).map((k) => ({ key: k, label: s[k].label })) : null;
  });
  if (!surfaces || !surfaces.length) {
    console.error("CANNOT RUN — window.hublyListUI.surfaces did not answer, so the tab list could not be derived from the product");
    await rig.close(); srv.close(); process.exit(2);
  }
  console.log(`  derived ${surfaces.length} place(s) from HC_PLACE_SURFACES: ` +
    surfaces.map((s) => `${s.key} ("${s.label}")`).join(" · ") + "\n");

  const PLACES = surfaces.map((s, i) => ({ kind: s.key, scope: "workspace", visible: true, sort_order: (i + 1) * 10 }));
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "o@example.com", displayName: "Adrian", places: PLACES,
    tables: { jobs: [], tasks: [], customers: [], events: [], ask_hubly_conversations: [], ask_hubly_messages: [] },
  });
  await rig.page.evaluate(async ({ biz }) => {
    await window.hublyArrivalUI.simulate(biz, true, []);
    await new Promise((r) => setTimeout(r, 600));
  }, { biz: BIZ });
  const bad = await rig.page.evaluate(fakeIntact);
  if (bad) { console.error("CANNOT RUN — " + bad); await rig.close(); srv.close(); process.exit(2); }

  /* NOT A LEG — A PRECONDITION. Removing the seam does not make this file report a failure; it
     makes it throw four calls later, because every reading below goes through window.hublyChatUI.
     A "leg" that can only ever crash or pass is not a leg, so it says CANNOT RUN instead of
     pretending to be a green assertion about the product. */
  if (!await rig.page.evaluate(() => !!(window.hublyChatUI && window.hublyChatUI.load))) {
    console.error("CANNOT RUN — window.hublyChatUI.load is not published, so the conversation seam cannot be driven");
    await rig.close(); srv.close(); process.exit(2);
  }
  console.log("  precondition: window.hublyChatUI is published\n");

  const home0 = await state();
  say("1 [RULE] Home opens the MAIN chat — the one with the history",
      home0.msgs.length > 0 && home0.current.place === null, `${home0.msgs.length} message(s) on Home`);

  /* ══ EVERY DERIVED PLACE, ONE AT A TIME ═══════════════════════════════════════════════════
     Each place gets the same four questions, and the SENTENCE said in it is unique to it — so
     "the previous tab's message is not here" is a real assertion and not a coincidence. */
  const sentences = {};
  const seen = [];
  for (const s of surfaces) {
    const pressed = await press(s.label);
    if (!pressed) { say(`2.${s.key} the tab is in the rail to be pressed`, false, `no rail tab matching "${s.label}"`); continue; }
    const st = await state();
    say(`2.${s.key} [RULE] pressing "${s.label}" opens THAT place's conversation, not Home's`,
        st.current.place === s.key && !!st.current.id && st.mode === s.key,
        `mode=${st.mode} current=${JSON.stringify(st.current)}`);
    const mine = st.convos.filter((c) => c.place === s.key);
    say(`3.${s.key} [RULE] it has exactly one conversation of its own, titled for the place`,
        mine.length === 1 && String(mine[0].title || "").toLowerCase() === s.label.toLowerCase(),
        `${mine.length} conversation(s) for ${s.key}: ${JSON.stringify(mine.map((m) => m.title))}`);

    // NOTHING FROM ANY PLACE VISITED EARLIER IS ON SCREEN HERE.
    // ONLY ONCE THERE IS SOMETHING TO LEAK. For the first place visited this compares against an
    // empty set, which is a leg that cannot fail — and a leg that cannot fail is a green nobody
    // earned. It is emitted from the second place onwards.
    if (seen.length) {
      const leaked = seen.filter((prev) => st.msgs.some((m) => m.includes(sentences[prev])));
      say(`4.${s.key} [RULE] no earlier tab's message is visible in it`,
          leaked.length === 0,
          leaked.length ? `LEAKED FROM: ${leaked.join(", ")}` : `checked against ${seen.length} earlier place(s)`);
    }

    const line = `only in ${s.key}: ` + Math.random().toString(36).slice(2, 8);
    sentences[s.key] = line;
    await rig.page.evaluate(async (t) => {
      // THE ROUTER, NOT THE WRITER. hcPersistToPlace proves a row can be written; only hcPersist
      // proves a message said in a room GOES there rather than into the main chat — red-proofing
      // showed that deleting the routing left the old leg green.
      window.hublyChatUI.persistRouted("user", t);
      await new Promise((r) => setTimeout(r, 500));
    }, line);
    const after = await state();
    const convId = (after.convos.filter((c) => c.place === s.key)[0] || {}).id;
    const rows = after.stored.filter((m) => m.content === line);
    say(`5.${s.key} [RULE] what he says there is stored in THAT conversation`,
        rows.length === 1 && rows[0].cid === convId,
        `stored under ${JSON.stringify(rows.map((r) => r.cid))}, this place's conversation is ${convId}`);
    seen.push(s.key);
  }

  /* ══ COMING BACK, AND HOME ════════════════════════════════════════════════════════════════ */
  const first = surfaces[0];
  await press(first.label);
  const back = await state();
  say(`6 [RULE] coming back to "${first.label}" finds what was said there — a saved chat, not a fresh one`,
      back.msgs.some((m) => m.includes(sentences[first.key])),
      `${back.msgs.length} message(s), including what he said the first time`);

  await press("home");
  const homeAgain = await state();
  const anyLeak = surfaces.filter((s) => sentences[s.key] && homeAgain.msgs.some((m) => m.includes(sentences[s.key])));
  say("7 [RULE] Home restores the MAIN chat and holds no room's messages",
      homeAgain.current.place === null && anyLeak.length === 0,
      anyLeak.length ? `LEAKED INTO HOME FROM: ${anyLeak.map((s) => s.key).join(", ")}` :
        `back on the main chat: ${homeAgain.msgs.length} message(s), none of them from ${surfaces.length} places`);

  /* ══ R1 — THE REGRESSION ADRIAN REPORTED, IN ITS OWN ORDERING ═════════════════════════════
     Not a calm tab press. The boot path starts a room's conversation load and THEN, on a promise
     that resolves later, hcMaybeShowArrival runs and its last line is hcRenderHome(). That late
     paint is the bug, and it is invisible to any sequence that lets each step finish. */
  await press("website");
  const beforeLate = await state();
  const late = await rig.page.evaluate(async ({ biz }) => {
    // Exactly what hcOpenOwnedBusiness does on a reload carrying '#website': the room is already
    // open when the arrival path resolves.
    await window.hublyArrivalUI.simulate(biz, true, [{ role: "user", content: "a line of Home's history" }]);
    await new Promise((r) => setTimeout(r, 700));
    return {
      mode: document.getElementById("hcApp").dataset.mode,
      current: window.hublyChatUI.current(),
      msgs: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()),
    };
  }, { biz: BIZ });
  /* THE FIRST VERSION OF THIS LEG WAS A FALSE GREEN, AND THE BREAK IS WHAT SAID SO.
     It asserted that a line of Home's TRANSCRIPT was absent — and Home does not dump the
     transcript (it renders a calm greeting), so that string could never appear and the leg stayed
     green with the fix removed. The thing the wipe actually destroys is what was ALREADY in this
     tab's thread, so that is what the leg reads: hcRenderHome's first statement is
     `thread.innerHTML = ''`, and Website's own saved message either survives it or does not. */
  const survived = late.msgs.some((m) => m.includes(sentences.website));
  say("R1 [RULE] a late Home render cannot repaint the thread of whatever tab is open",
      late.mode === "website" && late.current.place === "website" && survived,
      `still on ${late.mode} (${beforeLate.msgs.length} message(s) before the late Home render, ` +
      `${late.msgs.length} after); Website's own saved message survived it=${survived}. ` +
      `THIS is the leg the hand-written three-place list never reached`);

  /* ══ R2 — AND THE REVERSE DIRECTION, WHICH HE ASKED FOR BY NAME ═══════════════════════════ */
  await press("home");
  const homeLine = "HOME-SIDE-" + Math.random().toString(36).slice(2, 8);
  await rig.page.evaluate(async (t) => {
    window.hublyChatUI.persistRouted("user", t);
    document.getElementById("hcThreadBody").insertAdjacentHTML("beforeend",
      '<div class="hc-msg hc-msg-user">' + t + "</div>");
    await new Promise((r) => setTimeout(r, 400));
  }, homeLine);
  await press("website");
  const onSite = await state();
  say("R2 [RULE] a message sent on Home is not visible in Website",
      onSite.current.place === "website" && !onSite.msgs.some((m) => m.includes(homeLine)),
      `on ${onSite.current.place}; Home's message present=${onSite.msgs.some((m) => m.includes(homeLine))}`);
  /* ══ R5 — THE RAIL'S DATA SURVIVES ENTERING A ROOM DIRECTLY ═══════════════════════════════
     `hcLoadIdentity` had ONE call site, inside `hcRenderHome`, and R1's fix makes hcRenderHome return
     early when the open tab is not Home. Correct — and it silently took the identity load with it, so
     a reload straight to `#website` left the rail with no location and no logo. Collateral damage from
     a correct fix, which is exactly the pattern being guarded here. The observable is
     `hcIdentity.loaded`, not the rail's text: the declared fixture returns a null city, so the rail
     reads the same either way and a leg on its text would be vacuous. */
  declareBreak({
    leg: "R5 [SHAPE] the identity load is reachable from outside hcRenderHome",
    why: "put the identity load back inside hcRenderHome, where R1's guard makes it unreachable on " +
         "any entry path that is not Home — the rail loses its location and its logo",
    file: "public/platform-home.html",
    find: "    try{ hcLoadIdentity(hc.draftBusiness).then(function(){ try{ hcRenderRail(); }catch(e){} }); }catch(e){}",
    with: "    /* BREAK: the load goes back to living only inside hcRenderHome, which R1's guard makes unreachable when a room is entered directly */",
  });
  /* AND IT IS A SOURCE ASSERTION, BECAUSE THE RUNTIME ONE COULD NOT BE RED-PROOFED. The first version
   * read `hcIdentity.loaded` at the end of this run and came back NOT RED under the break: by then
   * Home has rendered (via hublyArrivalUI.simulate -> hcMaybeShowArrival -> hcRenderHome with mode
   * 'home'), which loads the identity whatever the boot path does. The path that carries the fix is
   * `hcOpenOwnedBusiness`, and NO SEAM DRIVES IT — `simulate` deliberately bypasses it. So rather than
   * record a break that does not fire, the leg asserts the SHAPE the fix has, labelled as such, plus
   * the runtime value as a second clause so it is not a pure source grep. The gap is named: a check
   * that boots through the real hcOpenOwnedBusiness does not exist, and until it does this leg cannot
   * observe the defect it guards — only the code that prevents it. */
  const identSrc = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
  const loadSites = (identSrc.match(/hcLoadIdentity\(/g) || []).length;
  const insideRenderHomeOnly = (() => {
    const i = identSrc.indexOf("async function hcRenderHome(");
    if (i < 0) return true;
    let d = 0, st = identSrc.indexOf("{", i), en = st;
    for (let k = st; k < identSrc.length; k++) { if (identSrc[k] === "{") d++; else if (identSrc[k] === "}") { d--; if (!d) { en = k; break; } } }
    const inHome = (identSrc.slice(st, en).match(/hcLoadIdentity\(/g) || []).length;
    return loadSites - 1 <= inHome;     // -1 for the declaration itself
  })();
  const ident = await rig.page.evaluate(() => ({
    loaded: !!(window.hublyIdentityUI && window.hublyIdentityUI.loaded()) }));
  say("R5 [SHAPE] the identity load is reachable from outside hcRenderHome, and it loaded in this run",
      loadSites >= 3 && !insideRenderHomeOnly && ident.loaded === true,
      `${loadSites} mention(s) of hcLoadIdentity in the shell (declaration + call sites); reachable ` +
      `only from inside hcRenderHome=${insideRenderHomeOnly}; hcIdentity.loaded=${ident.loaded} in this ` +
      `run. [SHAPE] because it asserts where the call SITS: R1's guard makes hcRenderHome unreachable ` +
      `when a room is entered directly, so an identity load that lives only there leaves the rail with ` +
      `no location and no logo on that one entry path.`);

  /* ══ R4 — TWO TAPS, NO PAUSE ══════════════════════════════════════════════════════════════
     `if(hcPlaceChat.loading) return false;` stood at the top of the place loader, so tapping
     Website and then Jobs before the first load finished DROPPED the second one: Jobs open,
     Website's conversation on screen, no error and nothing to retry. Same shape as the style
     queue and the dropped second tap — an owner action discarded silently while something else
     is in flight. A check that waits 900ms between presses cannot see it. */
  const fast = await rig.page.evaluate(async () => {
    const tab = (rx) => [...document.querySelectorAll(".hc-rail-tab")].filter((b) => rx.test(b.textContent))[0];
    const hit = (b) => b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    hit(tab(/website/i));
    hit(tab(/jobs/i));            // in the SAME task: the first load is still in flight
    await new Promise((r) => setTimeout(r, 1200));
    return { mode: document.getElementById("hcApp").dataset.mode, current: window.hublyChatUI.current() };
  });
  say("R4 [RULE] a second tab pressed while the first is still loading is not discarded",
      fast.mode === "jobs" && fast.current.place === "jobs",
      `two presses in one task ended on mode=${fast.mode} with the conversation of ` +
      `${JSON.stringify(fast.current.place)} — they must agree, or the owner is looking at another ` +
      `room's thread with nothing to tell him`);

  say("R3 [RULE] …and it was not stored in Website's conversation either",
      !onSite.stored.some((m) => m.content === homeLine),
      `ask_hubly_messages holds ${onSite.stored.length} row(s), none of them Home's — Home keeps business_conversations`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — every tab keeps its own conversation, and Home keeps the main one.\n");
process.exit(failed ? 1 : 0);
