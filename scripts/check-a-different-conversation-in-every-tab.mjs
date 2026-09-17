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
 * ══ AND THE STORAGE WAS ALREADY BUILT ═══════════════════════════════════════════════════════
 *
 * `ask_hubly_conversations` + `ask_hubly_messages` have existed since 2026-07-27 — a titled
 * conversation per business per owner, messages linked to it, owner RLS on both, so an
 * authenticated owner can read and write them with no RPC at all. **0 rows, and not one reference
 * anywhere in public/ or supabase/functions/.** Built, authorised and unreachable: the missing
 * piece was one column saying which PLACE a conversation belongs to.
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srv = await servePublic(ROOT);
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture", hasPage: true };
const PLACES = [
  { kind: "website", scope: "workspace", visible: true, sort_order: 10 },
  { kind: "planner", scope: "workspace", visible: true, sort_order: 20 },
  { kind: "jobs", scope: "workspace", visible: true, sort_order: 30 },
];

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

const press = (label) => rig.page.evaluate(async (label) => {
  const tab = [...document.querySelectorAll(".hc-rail-tab")].filter((b) => new RegExp(label, "i").test(b.textContent))[0];
  if (!tab) return false;
  tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await new Promise((r) => setTimeout(r, 800));
  return true;
}, label);
const thread = () => rig.page.evaluate(() =>
  [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()));

try {
  console.log("SIMULATED OWNER — no session, no network. The rail tabs are pressed for real.\n");
  await rig.load(srv.url("platform-home.html"));
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

  say("0 the seam is published so this can be driven at all",
      await rig.page.evaluate(() => !!(window.hublyChatUI && window.hublyChatUI.load)), "window.hublyChatUI");

  const home = await thread();
  say("1 [RULE] Home opens the MAIN chat — the one with the history",
      home.length > 0, `${home.length} message(s) on Home`);

  await press("my day");
  const day = await rig.page.evaluate(() => ({
    msgs: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()),
    convos: (window.__rig.tables.ask_hubly_conversations || []).map((c) => ({ place: c.place, title: c.title })),
    current: window.hublyChatUI.current(),
  }));
  say("2 [RULE] pressing a tab opens THAT tab's conversation, not Home's",
      day.current.place === "planner" && !!day.current.id,
      `current: ${JSON.stringify(day.current)}`);
  say("3 [RULE] a place with no conversation yet gets one, named for the place",
      day.convos.length === 1 && day.convos[0].place === "planner" && /my day/i.test(day.convos[0].title),
      JSON.stringify(day.convos));
  say("4 [RULE] and it SAYS it is a separate conversation — the interface does not change shape in silence",
      day.msgs.some((m) => /separate conversation/i.test(m) && /my day/i.test(m)),
      JSON.stringify(day.msgs.slice(-1)[0] || null));

  // ── SAY SOMETHING HERE, AND IT STAYS HERE ────────────────────────────────────────────
  const said = await rig.page.evaluate(async () => {
    // THE ROUTER, NOT THE WRITER. Calling hcPersistToPlace directly proves a row can be written;
    // it does NOT prove a message said in a room goes there instead of into the main chat — and
    // red-proofing showed exactly that: deleting the routing left this leg green. hcPersist is the
    // function every turn actually calls.
    window.hublyChatUI.persistRouted("user", "move the 2pm to Thursday");
    await new Promise((r) => setTimeout(r, 900));
    return {
      msgs: (window.__rig.tables.ask_hubly_messages || []).map((m) => ({ role: m.role, content: m.content })),
      mainChat: (window.__rig.writes || []).filter((w) => w.name === "persist_business_message").length,
    };
  });
  say("5 [RULE] what he says in a room is stored in THAT room's conversation",
      said.msgs.length === 1 && /2pm to Thursday/.test(said.msgs[0].content),
      JSON.stringify(said.msgs));

  // ── ANOTHER TAB IS ANOTHER CONVERSATION ──────────────────────────────────────────────
  await press("jobs");
  const jobs = await rig.page.evaluate(() => ({
    current: window.hublyChatUI.current(),
    convos: (window.__rig.tables.ask_hubly_conversations || []).map((c) => c.place),
    msgs: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()),
  }));
  say("6 [RULE] a different tab is a DIFFERENT conversation",
      jobs.current.place === "jobs" && jobs.current.id !== day.current.id && jobs.convos.length === 2,
      `places with a conversation: ${jobs.convos.join(", ")}`);
  say("7 [RULE] and the day's message is not in it",
      !jobs.msgs.some((m) => /2pm to Thursday/.test(m)),
      "the jobs thread does not hold what was said about the day");

  // ── AND COMING BACK FINDS IT AGAIN ───────────────────────────────────────────────────
  await press("my day");
  const back = await thread();
  say("8 [RULE] coming back to a tab finds what was said there — a saved chat, not a fresh one",
      back.some((m) => /2pm to Thursday/.test(m)),
      `${back.length} message(s), including what he said last time`);

  // ── HOME IS STILL HOME ───────────────────────────────────────────────────────────────
  await press("home");
  const homeAgain = await rig.page.evaluate(() => ({
    msgs: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()),
    current: window.hublyChatUI.current(),
  }));
  say("9 [RULE] Home restores the MAIN chat and does not show the room's messages",
      homeAgain.current.place === null && !homeAgain.msgs.some((m) => /2pm to Thursday/.test(m)),
      `back on the main chat: ${homeAgain.msgs.length} message(s)`);
} finally { await rig.close(); srv.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — every tab keeps its own conversation, and Home keeps the main one.\n");
process.exit(failed ? 1 : 0);
