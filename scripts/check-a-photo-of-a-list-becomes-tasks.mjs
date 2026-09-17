#!/usr/bin/env node
/**
 * [RULE] A PICTURE OF A TO-DO LIST BECOMES TASKS — through the SAME door as a schedule.
 *
 *   node scripts/check-a-photo-of-a-list-becomes-tasks.mjs
 *
 * Adrian: *"screenshot/paste for TASKS."* The photo door already existed for JOBS
 * (`import-schedule` + `hcProposeImportedJobs`). A to-do list is the same gesture — hand me the
 * thing you already have — so it is the same endpoint, the same review step and the same
 * "nothing is on your day yet" promise. A second door would be a second prompt, a second
 * reviewer and a second idea of what a row means.
 *
 * ── THE PART THAT MATTERS MOST ──────────────────────────────────────────────────────────────
 *
 * A JOB IS SOMEONE EXPECTING HIM. A TASK IS NOT. Getting that wrong in the expensive direction —
 * an errand becoming a job — puts a commitment on his calendar that nobody made, so the prompt
 * rules that an ambiguous row is a TASK, and leg 5 asserts a task never renders as a job.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// ── THE CONTRACT, in the function that ships ─────────────────────────────────────────
const fn = readFileSync(join(ROOT, "supabase/functions/import-schedule/index.ts"), "utf8");
say("1 [RULE] one door reads both — the endpoint returns tasks as well as jobs",
    /"tasks":\[/.test(fn) && /jobs, tasks, unreadable/.test(fn),
    "import-schedule returns { jobs, tasks, unreadable, warnings }");
say("2 [RULE] and the ambiguous row is the CHEAP one — a task, not a commitment nobody made",
    /GENUINELY AMBIGUOUS, IT IS A TASK/.test(fn),
    "the prompt rules ties to tasks");
say("3 [RULE] an undated task is kept — a job needs a date, an errand does not",
    /due_date: okDue && due \? due : null/.test(fn) && /no title I could read/.test(fn),
    "only a task with no title at all is dropped");

// ── AND THE REVIEW STEP, RENDERED BY THE PRODUCT ─────────────────────────────────────
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
  await rig.page.evaluate(installOwnerFake, { uid: "sim-owner", email: "o@example.com", tables: { jobs: [], tasks: [] } });
  const seen = await rig.page.evaluate(async () => {
    window.hublyCaptureUI.withBusiness("5ebedc20-1061-46b9-b393-a6ef57225910");
    const host = document.createElement("div");
    host.className = "hc-thread-inner"; host.id = "hcThreadBody";
    document.body.appendChild(host);
    window.hublyImportUI.propose(
      [{ customer_name: "Leslie Ammons", service_name: "Full Detail", scheduled_date: "2026-09-19",
         scheduled_time: "12:00", amount: 180, source_text: "Leslie 12 full detail 180" }],
      [],
      [{ title: "order glass cleaner", due_date: null, due_time: null, source_text: "order glass cleaner" },
       { title: "call the accountant", due_date: "2026-09-19", due_time: "09:00", source_text: "call acct 9am thu" }],
    );
    await new Promise((r) => setTimeout(r, 200));
    const rows = [...document.querySelectorAll(".hc-import-row")].map((r) => ({
      kind: r.getAttribute("data-hc-import-kind") || "job",
      when: (r.querySelector(".hc-import-when") || {}).textContent || "",
      what: (r.querySelector(".hc-import-what") || {}).textContent || "",
    }));
    return { head: (document.querySelector(".hc-import-h") || {}).textContent || "",
             rows, button: (document.querySelector("[data-hc-import-go]") || {}).textContent || "" };
  });
  say("4 [RULE] the review step shows both, and COUNTS THEM SEPARATELY",
      /1 job and 2 tasks/.test(seen.head), JSON.stringify(seen.head));
  say("5 [RULE] a task renders as a task — no customer, no price, and it says which it is",
      seen.rows.filter((r) => r.kind === "task").length === 2 &&
      seen.rows.filter((r) => r.kind === "task").every((r) => /Task$/.test(r.what.trim())) &&
      !seen.rows.some((r) => r.kind === "task" && /\$/.test(r.what)),
      seen.rows.filter((r) => r.kind === "task").map((r) => r.what).join(" | "));
  say("6 [RULE] an undated task says so rather than borrowing a day it was never given",
      seen.rows.some((r) => r.kind === "task" && /no date yet/i.test(r.when)),
      seen.rows.filter((r) => r.kind === "task").map((r) => r.when).join(" | "));
  say("7 [RULE] one button adds everything that was read, counted over both kinds",
      /all 3 to my day/i.test(seen.button), JSON.stringify(seen.button));

  // ── AND PRESSING IT WRITES THE TASKS THROUGH THE WRITER THAT ALREADY EXISTS ─────────
  const wrote = await rig.page.evaluate(async () => {
    const go = document.querySelector("[data-hc-import-go]");
    go.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 1200));
    const w = window.__rig.writes || [];
    return { tasks: w.filter((x) => x.name === "create_task").map((x) => x.args.p_title),
             jobs: w.filter((x) => x.name === "create_business_job").length,
             said: (document.querySelector(".hc-day-add-msg") || {}).textContent || "" };
  });
  say("8 [RULE] PRESSING it writes the tasks through create_task — not a second creator",
      wrote.tasks.length === 2 && wrote.tasks.some((t) => /glass cleaner/.test(t)),
      `tasks written: ${JSON.stringify(wrote.tasks)} · jobs: ${wrote.jobs}`);
  say("9 [RULE] and it says what landed, counting both kinds together",
      /Added 3 things/.test(wrote.said), JSON.stringify(wrote.said));
} finally { await rig.close(); }

console.log(failed ? `\n${failed} FAILED\n` : "\nPASS — a photo of a to-do list becomes tasks, through the door that already existed.\n");
process.exit(failed ? 1 : 0);
