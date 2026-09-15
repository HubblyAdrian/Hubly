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
    return { r, before, cards: t.querySelectorAll('[data-hc-view-row="day"]').length,
             head: !!t.querySelector('[data-hc-thread-view="day"]'),
             text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  say("1 'show me my day' renders the day IN THE THREAD", shown.r.ok === true && shown.head && shown.cards === 2,
    `header=${shown.head} cards=${shown.cards} (expected 2)`);
  say("2 each row is a real record carrying its own fields, in 12-hour time",
    /doctor’s appointment/.test(shown.text) && /7:00 AM/.test(shown.text) && /driveway/.test(shown.text) &&
    /2:00 PM/.test(shown.text) && /14 Maple St/.test(shown.text) && /\$180/.test(shown.text),
    JSON.stringify(shown.text.slice(-190)));
  say("3 no 24-hour clock anywhere in the rendered day", !/(?<!\d)\d{1,2}:\d{2}(?!\s*[AP]M)/i.test(shown.text),
    "12-hour only");

  // IT IS THE JOB CARD, NOT A SECOND THING BESIDE IT.
  const oneMechanism = await rig.page.evaluate(() => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const viewCard = t.querySelector('[data-hc-view-row="day"]');
    window.hublyJobUI.append({ id: "j9", customer_name: "Dana", service_name: "windows", scheduled_date: "2026-09-18", scheduled_time: "09:30:00", amount: 180 });
    const jobCard = t.querySelector("[data-hc-job]");
    return { viewCls: viewCard && viewCard.className, jobCls: jobCard && jobCard.className,
             viewTag: viewCard && viewCard.tagName, jobTag: jobCard && jobCard.tagName };
  });
  say("4 the day's rows ARE the job card, not a second card beside it",
    oneMechanism.viewTag === "BUTTON" && oneMechanism.jobTag === "BUTTON" &&
    /hc-job-card/.test(oneMechanism.viewCls) && /hc-job-card/.test(oneMechanism.jobCls),
    `${oneMechanism.viewCls} | ${oneMechanism.jobCls}`);

  // PRESSING ONE OPENS THE RECORD IN THE RIGHT PANE — the thing a human already did.
  const opened = await rig.page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-hc-view-row="day"]')];
    const target = rows.find((r) => /driveway/i.test(r.innerText));
    if (!target) return { clicked: false };
    target.click();
    const p = document.getElementById("hcPanel") || document.querySelector(".hc-panel");
    return { clicked: true, panel: p ? p.innerText.replace(/\s+/g, " ").trim() : "" };
  });
  say("5 pressing a row opens that record in the right pane",
    opened.clicked && /driveway/i.test(opened.panel) && /14 Maple St/.test(opened.panel) && /2:00 PM/.test(opened.panel),
    JSON.stringify(opened.panel.slice(0, 130)));

  // ══ 2+3. A FULL DAY IS NEVER REPORTED AS ABSENT, AND NOTHING IS ANNOUNCED FIRST. ═════
  const goRes = await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    t.innerHTML = "";
    const r = await window.hublyGoUI.go("planner");
    return { r, text: t.innerText.replace(/\s+/g, " ").trim() };
  });
  say("6 a day holding rows is NOT reported as 'not set up on this account'",
    !/isn’t set up|isn't set up|not set up/i.test(goRes.text),
    JSON.stringify(goRes.text.slice(0, 150)));
  say("7 and nothing announces the action before the outcome is known",
    !/^Opening|Opening your/i.test(goRes.text) && !/pulling up|fetching/i.test(goRes.text),
    "no optimistic line from the client");

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
  say("8 an genuinely empty day says so plainly, and renders no cards",
    emptyRes.r.ok === true && emptyRes.r.count === 0 && /Nothing is on your day/i.test(emptyRes.text) &&
    !/not set up/i.test(emptyRes.text),
    JSON.stringify(emptyRes.text));

  say("9 with no jobs, no customers, no sales and no bookings, none of those doors is offered",
    !empties.labels.includes("schedule") && !empties.labels.includes("customers") &&
    !empties.labels.includes("sales") && !empties.labels.includes("q-bookings") &&
    !empties.labels.includes("q-regulars") && !empties.labels.includes("q-earned"),
    `offered: ${JSON.stringify(empties.labels)}`);

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
  say("12 a name is never derived from the email local-part",
    noName.label.indexOf("@") >= 0 && !/^Adriansmithee$/i.test(noName.label),
    "the local-part heuristic is gone");
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
