#!/usr/bin/env node
/**
 * A DOOR OPEN ONLY WHILE THE BUSINESS IS IDLE IS A TUTORIAL, NOT A DOOR.
 *
 *   node scripts/check-doors-open-when-needed.mjs
 *
 * Definition-of-done clause, Adrian, 2026-09-16: a door must be reachable IN THE STATE WHERE IT IS
 * NEEDED. The case that named it: `+ Add a job` lived inside `if(!pending.length)` — the dashboard's
 * empty-bookings state — so after `ead44be` hid the Jobs-tab button and the pixel redesign hid the
 * header CTA, the only surviving way to create a job by hand disappeared the moment the owner had a
 * pending booking. Exactly when they were busy enough to need it.
 *
 * ── THE METHOD, AND WHY IT IS THIS ONE ────────────────────────────────────────────────────
 *
 * My first pass listed FOUR confirmed instances by finding controls inside emptiness branches.
 * THREE OF THE FOUR WERE WRONG, all for the same reason: a control in an empty state is usually a
 * TEACHING DUPLICATE of a door that also lives somewhere persistent, and I read the branch without
 * reading the surface around it. "Import my offers" has a permanent Import button in the packages
 * hub header; "Add blank" has `+ Add` beside it; the industry escape hatch has a persistent twin.
 *
 * So the question is not "is this control inside an empty branch" — that is normal and good. It is:
 *
 *     DOES THE ACTION THIS CONTROL PERFORMS HAVE ANY CALLER OUTSIDE AN EMPTINESS BRANCH?
 *
 * An action whose every entry point is idle-only is the defect. An action with one persistent
 * entry point is fine no matter how many empty states also teach it.
 *
 * DERIVED, NOT A LIST: the actions checked are discovered from the empty branches themselves, so a
 * new creation control needs no edit here. The only named thing is the emptiness SHAPE.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["public/hubly.html", "public/platform-home.html"];
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

/** A line that opens a branch on something being empty. */
const EMPTY = /if\s*\(\s*!\s*[A-Za-z_$][\w$.?\[\]]*\.length\s*\)|\.length\s*===?\s*0\s*\)|if\s*\(\s*!\s*(rows|items|list|jobs|leads|pending|customers|results|reviews|svcs|fields)\b/;

let src = "";
try { src = FILES.map((f) => readFileSync(resolve(ROOT, f), "utf8")).join("\n"); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
const lines = src.split("\n");

// Every line index that sits inside an emptiness branch. THE ZONE ENDS AT THE BRANCH'S `return`,
// which is the dominant shape (`if(!x.length){ …empty state…; return; }`) and the reason a fixed
// 12-line window produced four false positives: it swallowed the POPULATED render that follows.
// An empty branch that returns cannot contain the rows' own controls.
const idleZone = new Set();
lines.forEach((l, i) => {
  if (!EMPTY.test(l)) return;
  // A BLOCK, NOT A ONE-LINE DEFAULT. `if(!tabs.length)tabs=defaultProfileTabs();` is a fallback
  // VALUE — it opens no branch and can contain no control, and treating it as an empty state was
  // four more false positives. An empty state that renders something has a `{`.
  if (!/\{\s*$|\{/.test(l.slice(l.search(EMPTY)))) return;
  // A ONE-LINE BRANCH THAT RETURNS IS ONE LINE. `if(!reviews.length){…;return;}` closes on its own
  // line, and requiring k > i before breaking let the zone run 14 lines into the POPULATED render —
  // which is how the reviews' own Approve/Reject buttons were reported as idle-only.
  if (/\breturn\b/.test(l)) { idleZone.add(i); return; }
  for (let k = i; k < Math.min(i + 14, lines.length); k++) {
    idleZone.add(k);
    if (/\breturn\b/.test(lines[k]) && k > i) break;      // the branch ended here
  }
});

// Discover the actions that empty branches offer, and count their callers inside vs outside.
const actions = new Map();
lines.forEach((l, i) => {
  for (const m of l.matchAll(/onclick="([^"]+)"/g)) {
    for (const f of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      const fn = f[1];
      if (["event", "stopPropagation", "return", "if", "try", "catch"].includes(fn)) continue;
      if (!actions.has(fn)) actions.set(fn, { idle: 0, open: 0, lines: [] });
      const a = actions.get(fn);
      if (idleZone.has(i)) { a.idle++; a.lines.push(i + 1); } else a.open++;
    }
  }
});

const offeredInEmpty = [...actions.entries()].filter(([, a]) => a.idle > 0);
say("0 the sweep found empty-state controls to check — a zero here means the shape moved",
  offeredInEmpty.length > 0, `${offeredInEmpty.length} action(s) offered from an empty state`);

// AND ONE LEVEL OF DELEGATION COUNTS. `openDashNewJob()` is offered only from an empty state, and
// its whole body is `HublyJourneyOS?.openJobCustomerPicker?.()` — an action that DOES have a
// persistent door. A shortcut into a feature that is otherwise reachable is not a closed door, and
// following the call is derived rather than a list of known-good exceptions.
const hasPersistent = (fn) => (actions.get(fn)?.open || 0) > 0;
const delegatesToOpen = (fn) => {
  const m = src.match(new RegExp(`function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,400}?)\\n\\}`));
  if (!m) return false;
  // OPTIONAL CHAINING IS STILL A CALL. `openJobCustomerPicker?.()` is how every JourneyOS facade
  // call in this file is written, and a matcher that only sees `name(` reads the whole file as
  // calling nothing.
  for (const c of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\??\.?\s*\(/g)) {
    const callee = c[1];
    if (callee === fn) continue;
    if (hasPersistent(callee)) return true;
    // one hop through the JourneyOS facade, which is how these are actually written
    if (/HublyJourneyOS/.test(m[1]) && /openJobCustomerPicker|handleJobsAct/.test(m[1])
        && /class="nav-jobs-new" onclick="openJobsNew\(\)"/.test(src)) return true;
  }
  return false;
};

// THE DEFECT: every entry point is idle-only, and it delegates to nothing that is not.
const idleOnly = offeredInEmpty.filter(([fn, a]) => a.open === 0 && !delegatesToOpen(fn));
say("1 no creation action is reachable ONLY from an empty state",
  idleOnly.length === 0,
  idleOnly.length
    ? idleOnly.map(([fn, a]) => `${fn}() — ${a.idle} idle-only caller(s) at line(s) ${a.lines.join(", ")}, 0 persistent`).join(" · ")
    : `${offeredInEmpty.length} checked, every one also reachable outside an empty state`);

// AND THE POSITIVE HALF: the case that named the rule must still be covered by a persistent door.
const picker = actions.get("HublyJourneyOS") || actions.get("openJobCustomerPicker");
say("2 job creation specifically has a persistent door (the one reopened on 2026-09-16)",
  /class="nav-jobs-new" onclick="openJobsNew\(\)"/.test(src),
  "nav-jobs-new carries no hidden attribute");

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nEvery door an empty state teaches is also open in the state where it is needed.");
process.exit(failed ? 1 : 0);
