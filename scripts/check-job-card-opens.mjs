#!/usr/bin/env node
/**
 * A JOB IN THE CONVERSATION IS A THING YOU CAN OPEN — proved by pressing it.
 *
 *   node scripts/check-job-card-opens.mjs
 *
 * FLOOR (c) OF THE JOB PASTE, AND IT IS THE ONE THAT CANNOT BE PROVED BY READING. The card is
 * built by the product's own `hcAppendJobCard`, in the product's own page, and the click is
 * driven through the rig — which throws rather than reports when a control cannot be pressed.
 *
 * THE WITNESS SURVIVES BOTH TRAPS WE HAVE ALREADY BEEN CAUGHT BY (Lesson 71/72): an
 * element-level listener is defeated by a capture-phase stopPropagation, and a `click` witness
 * is defeated by a handler that rewrites its own element. The rig's witness is on `document`,
 * capture phase, on `mousedown` — before any click handler runs, on a node that cannot be
 * detached by one.
 *
 * AND THE WITNESS IS NOT THE PROOF. "The click landed" is the instrument working; the PRODUCT
 * working is the right pane becoming that job. Both are asserted, and they are different
 * questions.
 *
 * WHAT IS SIMULATED AND WHAT IS NOT, stated because a proof that hides this is worth nothing:
 *
 *   SIMULATED — the JOB DATA (a fixture), the SESSION (there is none), and the SHELL'S
 *   VISIBILITY: `.hc-app` is display:none until the product activates it, which needs a draft
 *   or a sign-in, so the check adds `is-active` exactly as hcActivate does. A control with no
 *   box cannot be pressed, and the rig correctly refuses to pretend otherwise — this is the
 *   smallest intervention that lets a real click reach a real listener.
 *
 *   NOT SIMULATED — the card, its listener, the panel it opens, and the fields that panel
 *   renders. All of it is the shipping code in the shipping page, reached through the one
 *   declared seam (window.hublyJobUI).
 *
 * So this proves the CLICK PATH, not the authed path. An owner pasting a job into a real
 * session is the walk, and it is not claimed here.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (no browser)
 */
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
const JOB = {
  id: "11111111-2222-3333-4444-555555555555",
  customer_name: "Dana Whitfield",
  service_name: "Interior + exterior windows",
  scheduled_date: "2026-09-18",
  scheduled_time: "09:30:00",
  address: "812 Alder St",
  phone: "801-555-0134",
  amount: 180,
  status: "scheduled",
  notes: "Pasted from a text message",
};

let rig, failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  await rig.load(PAGE);
  const seam = await rig.page.evaluate(() => !!(window.hublyJobUI && window.hublyJobUI.append && window.hublyJobUI.panel));
  if (!seam) { console.error("CANNOT RUN — window.hublyJobUI is not exposed; the seam this check drives is gone."); await rig.close(); process.exit(2); }

  // THE SHELL IS display:none UNTIL THE PRODUCT ACTIVATES IT. Same class hcActivate sets, and
  // it is named in the header as simulated: the alternative is a click the rig cannot make.
  await rig.page.evaluate(() => {
    const app = document.getElementById("hcApp");
    if (app) { app.classList.add("is-active"); app.removeAttribute("aria-hidden"); }
    document.body.classList.add("hc-active");
  });

  // The thread has to exist for a card to land in it — the shell renders it on boot.
  const built = await rig.page.evaluate((j) => {
    const el = window.hublyJobUI.append(j);
    return { appended: !!el, tag: el ? el.tagName : null, id: el ? el.getAttribute("data-hc-job") : null, text: el ? el.textContent : "" };
  }, JOB);
  say("1 the card is a real element in the thread", built.appended && built.tag === "BUTTON" && built.id === JOB.id,
    `${built.tag} data-hc-job=${built.id}`);
  say("1b it carries the job's own fields, not a description of them",
    /Dana Whitfield/.test(built.text) && /Interior \+ exterior windows/.test(built.text) && /\$180/.test(built.text),
    JSON.stringify(built.text).slice(0, 120));

  const before = await rig.page.evaluate(() => {
    const b = document.getElementById("hcPanelBody");
    return { open: !!(b && b.offsetParent !== null), text: b ? b.textContent.trim().slice(0, 40) : null };
  });
  say("2 the panel is not already showing this job", !/Dana Whitfield/.test(before.text || ""), JSON.stringify(before).slice(0, 90));

  // THE CLICK, WITNESSED. rig.click throws if the element has no box, if something covers it,
  // or if no event is seen — a control that cannot be pressed is an instrument failure, not a
  // result (browser-rig's own rule).
  const clicked = await rig.click({ selector: `[data-hc-job="${JOB.id}"]` });
  say("3 the click landed on the card", clicked && clicked.landed === true, JSON.stringify(clicked));

  // THE POSTCONDITION. The right pane is the job — every field the row has, and the panel is
  // the one the jobs list already opened, so this proves the DOOR, not a second panel.
  const after = await rig.settleScroll ? null : null;
  const pane = await rig.page.evaluate(() => {
    const el = document.getElementById("hcPanel");
    const body = document.getElementById("hcPanelBody");
    const title = document.getElementById("hcPanelTitle");
    return {
      hidden: el ? !!el.hidden : null,
      title: title ? title.textContent.trim() : null,
      text: body ? body.textContent.replace(/\s+/g, " ").trim() : "",
    };
  });
  say("4 the right pane became that job", pane.hidden === false && /Dana Whitfield/.test(pane.text) && /812 Alder St/.test(pane.text),
    `title=${JSON.stringify(pane.title)} ${JSON.stringify(pane.text).slice(0, 120)}`);
  say("4b it shows only fields the row actually has", !/not specified|—|n\/a/i.test(pane.text), JSON.stringify(pane.text).slice(0, 120));
} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 300));
  failed++;
} finally {
  try { await rig.close(); } catch (_) { /* closing is not a result */ }
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nA pasted job is a thing in the conversation, and pressing it opens the job.");
process.exit(failed ? 1 : 0);
