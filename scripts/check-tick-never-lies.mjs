#!/usr/bin/env node
/**
 * A TICK MAY NOT LIE.
 *
 *   node scripts/check-tick-never-lies.mjs
 *
 * Adrian, 2026-09-15: *"A day you cannot tick is a report."* `set_task_status` was written
 * 2026-09-09, tested by its own migration, and called by NOTHING — the seventh instance of
 * built-and-doorless, inside the screen the feature is named after.
 *
 * THE CHECKBOX IS OPTIMISTIC AND HONEST, WHICH ARE NOT IN TENSION. The tick goes on immediately,
 * because a checkbox that waits for a round trip feels broken. But the write is real, it is READ
 * BACK from the table, and **if it fails the tick comes back off and says so**. A tick that stays
 * on over a failed write is prohibition 2 in its purest form: a green the surface never earned,
 * on the one control whose whole meaning is "this is done".
 *
 * THE WRITE ITSELF was exercised against the live database separately (see the commit): wrong
 * owner refused `not_owner`, a bad status refused `bad_status`, the row untouched by both, a real
 * tick read back `done` with `done_at` set, and the untick restored it. What runs here is the
 * CONTROL — its optimism, its revert, and its sentences.
 *
 * SIMULATED AND SAID SO: no session; the RPC is a declared fake whose answer each leg chooses.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "file://" + join(ROOT, "public/platform-home.html");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** The fake: `mode` decides what the write does. Installed after load, before the tick. */
function installTaskFake(mode) {
  const W = window;
  W.__tick = { rpc: [], rowStatus: "open" };
  const ok = (data) => Promise.resolve({ data, error: null });
  const client = {
    auth: { getUser: () => ok({ user: { id: "u1" } }), getSession: () => ok({ session: { access_token: "sim" } }) },
    from: () => ({
      select: function () { return this; },
      eq: function () { return this; },
      // THE READ-BACK. In "silent" mode the RPC claims success and the row never changed —
      // the exact shape a lying tick needs, and the one the product must catch.
      maybeSingle: () => ok(mode === "unreadable" ? null : { id: "t1", status: W.__tick.rowStatus, done_at: null }),
    }),
    rpc: (name, args) => {
      W.__tick.rpc.push({ name, args });
      if (name !== "set_task_status") return ok(null);
      if (mode === "refuse") return ok({ ok: false, error: "not_owner" });
      if (mode === "throw") return Promise.resolve({ data: null, error: { message: "boom" } });
      if (mode === "silent") return ok({ ok: true, status: args.p_status });      // claims ok, row unchanged
      W.__tick.rowStatus = args.p_status;                                          // the honest path
      return ok({ ok: true, status: args.p_status });
    },
  };
  W.supabase = { createClient: () => client };
  try { localStorage.setItem("sb-rtwxxkxpkqdrhclkozma-auth-token", JSON.stringify({ access_token: "sim", expires_at: Math.floor(Date.now() / 1000) + 3600 })); } catch (_) {}
  W.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
}

/** Tick the box and report what the DOM and the thread ended up saying. */
async function tick(rig, mode) {
  await rig.load(PAGE);
  await rig.page.evaluate(installTaskFake, mode);
  const seam = await rig.page.evaluate(() => !!(window.hublyTaskUI && window.hublyTaskUI.tick));
  if (!seam) throw new Error("window.hublyTaskUI.tick is not exposed");
  return await rig.page.evaluate(async () => {
    const t = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    t.innerHTML = "";
    const host = document.createElement("div"); document.body.appendChild(host);
    const task = { id: "t1", title: "Order glass cleaner", status: "open" };
    const box = window.hublyTaskUI.tick(task, () => {});
    host.appendChild(box);
    const wasChecked = box.checked;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    for (let i = 0; i < 80; i++) {          // poll for the write to settle, never a fixed wait
      if (!box.disabled) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    await new Promise((r) => setTimeout(r, 40));
    return { wasChecked, nowChecked: box.checked, taskStatus: task.status,
             said: t.innerText.replace(/\s+/g, " ").trim(), rpc: window.__tick.rpc.map((x) => x.name) };
  });
}

let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }

try {
  console.log("SIMULATED — no session. The control, its revert and its sentences are the product's.\n");

  // ── 1. THE HONEST PATH. ─────────────────────────────────────────────────────────────
  const good = await tick(rig, "ok");
  say("1 the tick calls the writer that was built and never called", good.rpc.includes("set_task_status"),
    JSON.stringify(good.rpc));
  say("2 a real tick stays on, and the task is done", good.nowChecked === true && good.taskStatus === "done",
    `checked=${good.nowChecked} status=${good.taskStatus}`);
  say("3 success says nothing — the tick IS the confirmation", good.said === "",
    JSON.stringify(good.said));

  // ── 4. A REFUSED WRITE. The tick must come back off AND say so. ─────────────────────
  const refused = await tick(rig, "refuse");
  say("4 a refused write puts the tick back", refused.nowChecked === false && refused.taskStatus === "open",
    `checked=${refused.nowChecked} status=${refused.taskStatus}`);
  say("5 and it says so rather than reverting in silence", refused.said.length > 8 && !/\bdone\b/i.test(refused.said),
    JSON.stringify(refused.said));

  // ── 6. THE SHARP ONE: the RPC claims success and the row never moved. ───────────────
  //
  // This is the case a writer's own word cannot catch. Without the read-back the tick stays on
  // over a task that is still open — a green the surface never earned, on the one control whose
  // entire meaning is "this is done".
  const silent = await tick(rig, "silent");
  say("6 an ok:true over an unchanged row does NOT leave the tick on",
    silent.nowChecked === false, `checked=${silent.nowChecked} (the RPC said ok; the row said open)`);
  say("7 and it tells the owner it did not save", /didn.t save|still open/i.test(silent.said),
    JSON.stringify(silent.said));

  // ── 8. WRITTEN BUT NOT READABLE IS NOT SUCCESS EITHER. ─────────────────────────────
  const unread = await tick(rig, "unreadable");
  say("8 a write that cannot be read back does not claim the tick took",
    unread.nowChecked === false && /couldn.t read it back/i.test(unread.said),
    JSON.stringify(unread.said));

  // ── 9. EVERY OUTCOME HAS ITS OWN SENTENCE, AND NONE CLAIMS SUCCESS. ────────────────
  const lines = await rig.page.evaluate(() => {
    const L = window.hublyTaskUI.line;
    return { ok: L({ ok: true }), signedOut: L({ ok: false, error: "not_signed_in" }),
             notOwner: L({ ok: false, error: "not_owner" }), unread: L({ ok: false, error: "not_readable_back" }),
             didNot: L({ ok: false, error: "did_not_take" }), unknown: L({ ok: false, error: "x" }), none: L(null) };
  });
  const fails = [lines.signedOut, lines.notOwner, lines.unread, lines.didNot, lines.unknown, lines.none];
  say("9 success is silent; every failure speaks, and they differ",
    lines.ok === "" && fails.every((s) => s && s.length > 8) && new Set(fails).size === fails.length,
    `${new Set(fails).size} distinct sentences over ${fails.length} failures`);
  say("10 no failure sentence claims the thing is done",
    !fails.some((s) => /\b(done|saved|marked)\b/i.test(s) && !/couldn|didn/i.test(s)),
    JSON.stringify(fails.filter((s) => /\bdone\b/i.test(s))));

} catch (e) {
  console.error("FAIL — " + String(e.stack || e.message).slice(0, 400));
  failed++;
} finally { try { await rig.close(); } catch (_) {} }

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nThe tick is optimistic, the write is real, and a tick that did not save comes back off and says so.");
process.exit(failed ? 1 : 0);
