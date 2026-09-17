#!/usr/bin/env node
/**
 * [RULE] THE TAIL: A NAME IS CAPITALISED AT DISPLAY ONLY, AND roll_task HAS A DOOR.
 *
 *   node scripts/check-tail-doors.mjs
 *
 * TWO ITEMS FROM ADRIAN'S TAIL LIST (2026-09-16), and both are the same shape underneath: something
 * the product already had, reached or presented wrongly.
 *
 * ══ CAPITALISED AT DISPLAY, NEVER AT STORAGE ══════════════════════════════════════════════════
 *
 * "Nice to meet you, austin." reads like we were not paying attention, and it is the first sentence he
 * ever gets. But rewriting his name on the way INTO the record is the same act as correcting his phone
 * number — a value nobody gave us — and if his name genuinely is "k.d. lang" we would have destroyed
 * it. So the record keeps exactly what he typed and the DISPLAY capitalises.
 *
 * IT ONLY RAISES FIRST LETTERS. A title-caser that forced the tail to lowercase turns "JT" into "Jt",
 * which is worse than the problem it fixes — so "McDonald", "O'Brien" and "JT" all survive.
 *
 * ══ roll_task HAD NO CALLER ═══════════════════════════════════════════════════════════════════
 *
 * It has existed since 20260909160000 and its own comment says why: "NEVER A GROWING PILE OF RED. An
 * undone task is ROLLED, not accumulated as overdue shame." Without a door that is exactly what it
 * becomes, because the only thing an owner could do with a task he did not get to was tick it or leave
 * it red. The third roll gets a different sentence, because a task that has moved three times is a
 * decision he has not made yet — which is the sentence the roll count was recorded for.
 *
 * [RULE]: the legs are "what is stored is what he typed", "what is shown is capitalised", "the door
 * exists and says what it did". None asserts a phrasing beyond the ones Adrian named.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { codeOf, bodyOf } from "./lib/absence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "public/platform-home.html");
const PAGE = "file://" + FILE;
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session, no network. The formatter, the panel and the sentences are the product's.\n");
  await rig.load(PAGE);
  await rig.page.evaluate(installOwnerFake, {
    uid: "sim-owner", email: "sim@example.com", displayName: "austin", tables: { jobs: [], tasks: [] },
  });

  const seam = await rig.page.evaluate(() => ({
    name: typeof window.hublyDayUI?.nameForDisplay === "function",
    roll: typeof window.hublyTaskUI?.roll === "function",
    rollLine: typeof window.hublyTaskUI?.rollLine === "function",
    panel: typeof window.hublyTaskUI?.panel === "function",
  }));
  if (!seam.name || !seam.rollLine) { console.error("CANNOT RUN — the tail seams are not on this page"); await rig.close(); process.exit(2); }

  const names = await rig.page.evaluate(() => {
    const f = window.hublyDayUI.nameForDisplay;
    const cases = ["austin", "Austin", "AUSTIN", "mcdonald", "McDonald", "o'brien", "O'Brien",
                   "JT", "van der berg", "jose maria", "a@b.com", "", null, "  austin  "];
    return Object.fromEntries(cases.map((c) => [String(c), f(c)]));
  });
  say("1 a lowercase name is capitalised for display",
      names["austin"] === "Austin" && names["  austin  "] === "Austin",
      `"austin" -> ${JSON.stringify(names["austin"])}`);
  say("2 an already-capitalised name passes through untouched",
      names["Austin"] === "Austin" && names["McDonald"] === "McDonald" && names["O'Brien"] === "O'Brien",
      "McDonald and O'Brien survive");
  say("3 it does NOT lowercase the tail — \"JT\" and \"AUSTIN\" are not mangled into \"Jt\"",
      names["JT"] === "JT" && names["AUSTIN"] === "AUSTIN", `JT -> ${JSON.stringify(names["JT"])}`);
  say("4 every word gets its first letter, including after an apostrophe or a hyphen",
      names["van der berg"] === "Van Der Berg" && names["o'brien"] === "O'Brien",
      JSON.stringify(names["van der berg"]));
  say("5 an email is never title-cased — an email is not a name",
      names["a@b.com"] === "a@b.com", JSON.stringify(names["a@b.com"]));
  say("6 nothing in, nothing out", names[""] === "" && names["null"] === "", "empty stays empty");

  // ── AND THE RECORD IS NOT TOUCHED. Scoped to the writer's own body. ────────────────────
  const src = readFileSync(FILE, "utf8");
  const writer = codeOf(bodyOf(src, "async function hcSaveOwnerName("));
  say("7 the WRITE stores exactly what he typed — the capitaliser is not in the writer (scoped)",
      !!writer && !/hcNameForDisplay/.test(writer),
      writer ? `scope = hcSaveOwnerName body, ${writer.length} chars of code` : "could not slice the writer");

  // ── roll_task's DOOR ──────────────────────────────────────────────────────────────────
  const door = await rig.page.evaluate(() => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    window.hublyTaskUI.panel({ id: "t1", title: "order glass cleaner", due_date: "2026-09-16",
                               band: "B", band_source: "proposed", lane: "work", roll_count: 0 });
    const btn = document.querySelector('[data-hc-task="roll"]');
    return { exists: !!btn, label: btn ? btn.textContent : null };
  });
  say("8 the task panel has a door to roll_task, and it says what it does",
      door.exists === true && /tomorrow/i.test(door.label || ""), JSON.stringify(door.label));
  // ══ AND A PERSON CAN PRESS IT. Added 2026-09-17. ═══════════════════════════════════════════
  // Leg 8 proved the button EXISTS. That is not the same as a person being able to use it — the
  // "Double-click to add something" line existed too, with no handler behind it anywhere. So this
  // dispatches a real click on the real button and asserts the product wrote and said so.
  const rolled = await rig.page.evaluate(async () => {
    window.hublyCaptureUI.withBusiness("5ebedc20-1061-46b9-b393-a6ef57225910");
    window.__rig.writes.length = 0;
    const btn = document.querySelector('[data-hc-task="roll"]');
    if (!btn) return { pressed: false };
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 600));
    const note = [...document.querySelectorAll(".hc-event-sub")].map((e) => e.textContent).join(" ");
    return { pressed: true, calls: window.__rig.rpc.filter((n) => n === "roll_task").length, note };
  });
  say("8b CLICKING it calls roll_task and says what happened — the control, not the function",
      rolled.pressed === true && rolled.calls >= 1 && rolled.note.length > 5,
      `${rolled.calls} roll_task call(s) · ${JSON.stringify(rolled.note.slice(0, 70))}`);

  const lines = await rig.page.evaluate(() => {
    const L = window.hublyTaskUI.rollLine;
    return {
      nul: L(null), signedOut: L({ ok: false, error: "not_signed_in" }),
      noTask: L({ ok: false, error: "no_task" }), other: L({ ok: false, error: "x" }),
      once: L({ ok: true, to: "2026-09-18", rolls: 1 }),
      thrice: L({ ok: true, to: "2026-09-18", rolls: 3 }),
    };
  });
  say("9 every outcome says something, and no failure claims it moved",
      [lines.nul, lines.signedOut, lines.noTask, lines.other].every((l) => l && !/^Moved/.test(l)) &&
      new Set([lines.nul, lines.signedOut, lines.noTask, lines.other]).size === 4,
      "4 distinct refusals, none claiming success");
  say("10 a successful move says where it went",
      /^Moved to/.test(lines.once), JSON.stringify(lines.once));
  say("11 the THIRD move says more than \"moved\" — it asks the question the roll count exists for",
      /3 times now/.test(lines.thrice) && /drop it/i.test(lines.thrice) && lines.thrice !== lines.once,
      JSON.stringify(lines.thrice));

  // ── AND THE RPC IS THE ONE THAT ALREADY EXISTED, not a second write path. ──────────────
  const roller = codeOf(bodyOf(src, "async function hcRollTask(t){"));
  say("12 it calls the roll_task RPC that has existed since 20260909160000 — not a new writer",
      !!roller && /rpc\('roll_task'/.test(roller) && !/\.from\('tasks'\)/.test(roller),
      "roll_task, and no direct table write");
  // ══ get_task_progress — THE LAST DOORLESS TASK FUNCTION. ═══════════════════════════════════
  //
  // Written with the tasks table on 2026-09-09, no caller until now. Its migration states the
  // constraint on the surface, not just the shape of the return: "At 7am with nothing done this
  // returns 0 of N — WHICH THE SURFACE MUST RENDER AS THE START OF A DAY, NEVER AS FAILURE."
  //
  // So leg 15 is the one that matters: 0 of 5 must never read "0 of 5". This owner has abandoned
  // planners for exactly the monument-to-failure reason the roll rule names.
  const prog = await rig.page.evaluate(() => {
    const w = window.hublyDayUI.progressWords;
    return { none5: w(0, 5), none1: w(0, 1), some: w(1, 5), nearly: w(4, 5),
             all: w(5, 5), nothing: w(0, 0), odd: w(3, 0) };
  });
  say("13 nothing done yet reads as WORK AHEAD — never \"0 of 5\", never a score of nought",
      /^5 things to do/.test(prog.none5) && !/\b0\b/.test(prog.none5) &&
      /^1 thing to do/.test(prog.none1),
      `${JSON.stringify(prog.none5)} · ${JSON.stringify(prog.none1)}`);
  say("14 once something is done it counts UP, and finishing is said as finishing",
      prog.some === "1 of 5 done." && prog.nearly === "4 of 5 done." && /everything done/i.test(prog.all),
      `${JSON.stringify(prog.some)} -> ${JSON.stringify(prog.all)}`);
  say("15 no tasks at all is not a score — it prints nothing rather than 0 of 0",
      prog.nothing === "" && prog.odd === "", "empty, not a zero");
  const readFail = await rig.page.evaluate(async () => {
    // A READ FAILURE IS NOT "0 of 0". The fake answers this RPC with null, which is what a failed read
    // looks like to the caller — the line must simply not appear.
    const head = document.createElement("div");
    head.id = "progtest";
    document.body.appendChild(head);
    // THE REAL FUNCTION, against the fake's null answer for get_task_progress — which is exactly what
    // a failed read looks like to this caller. The first version of this leg counted elements that had
    // never been created by anything, which is true of every possible product.
    await window.hublyDayUI.progressLine(head, { id: "5ebedc20-1061-46b9-b393-a6ef57225910" }, "2026-09-16");
    const any = head.querySelectorAll("[data-hc-progress]").length;
    head.remove();
    return { any };
  });
  say("16 a progress line is a claim about his day, so a read that did not run prints nothing",
      readFail.any === 0, "no [data-hc-progress] from a null read");
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nALL PASS — the name is his in the record and capitalised on screen, and a task can be moved.\n");
process.exit(failed ? 1 : 0);
