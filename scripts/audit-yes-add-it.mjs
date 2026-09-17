#!/usr/bin/env node
/**
 * EVERY WAY "YES, ADD IT" CAN FAIL — DRIVEN, NOT READ.
 *
 *   node scripts/audit-yes-add-it.mjs
 *
 * Adrian, 2026-09-17: *"Enumerate the yes-add-it fails — what the user did, what was expected, what
 * happened, and whether each is a DATA / RULES / AI / OWNER-INPUT / RENDERER failure. Use those five
 * layers by name — I want to see which layer is actually leaking."*
 *
 * THE FIVE LAYERS, as used here:
 *   DATA         a row is missing, wrong, or not written — the record is the problem
 *   RULES        our own gate refused something, correctly or not — authorisation, earned-only, caps
 *   AI           the model decided or phrased something and got it wrong
 *   OWNER-INPUT  the person did something we did not handle (declined, double-tapped, left)
 *   RENDERER     the record changed and the screen did not, or vice versa
 *
 * EVERY ROW BELOW IS PRESSED. `hcOfferSidebarTab` is rendered into the real thread and the real
 * "Yes, add it" button is clicked with a real MouseEvent, against a declared backend told to answer
 * each way the RPC actually answers (`add_business_place` returns missing_credential, no_such_business,
 * not_owner, already, re-enabled, created — read from migration 20260908030000). What the owner is
 * TOLD and what the rail DOES are both read back off the surface afterwards.
 *
 * Exit: 0 when nothing leaks · 1 when a layer does · 2 if it could not be driven. It began as an
 * enumeration and became a check the moment it found something: an enumeration that exits 0 while
 * naming a live defect is a red check nobody reads, which is worse than no check.
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake, fakeIntact } from "./lib/owner-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIZ = { id: "5ebedc20-1061-46b9-b393-a6ef57225910", slug: "hubly-classic-fixture", name: "Fixture", hasPage: true };

/* ══ THE CASES, AND WHO PRODUCES EACH ONE ══════════════════════════════════════════════════════
 *
 * THE FIRST RUN OF THIS FILE REPORTED "created: the record says yes and the rail did not change — a
 * green nobody earned", and that was MY FIXTURE, not the product. The override answered
 * `add_business_place` itself, so the fake's own handler never ran and never added the row the rail
 * then correctly failed to show. A probe that intercepts the write and then reports the missing
 * write as a defect is the 2026-09-15 shape exactly.
 *
 * So the success paths are produced by SEEDED STATE and handled by the fake's real
 * `add_business_place`, which implements created / already / re-enabled the way the migration does.
 * Only the answers the fixture cannot reach honestly are overridden, and those rows say so. */
const CASES = [
  { id: "created", seed: [{ kind: "website", visible: true }],
    did: "asked for My Day and pressed Yes — the ordinary case",
    how: "the fixture's own add_business_place, no override" },
  { id: "already", seed: [{ kind: "website", visible: true }, { kind: "planner", visible: true }],
    did: "pressed Yes for a place that is already in his rail",
    how: "the fixture's own handler; the place is seeded visible" },
  { id: "re-enabled", seed: [{ kind: "website", visible: true }, { kind: "planner", visible: false }],
    did: "pressed Yes for a place he had removed before",
    how: "the fixture's own handler; the row exists with visible=false" },
  { id: "not_owner", seed: [{ kind: "website", visible: true }], refuse: true,
    did: "pressed Yes while the session does not own this business",
    how: "the fixture's refuseAddPlace flag — its own not_owner branch" },
  { id: "missing_cred", seed: [{ kind: "website", visible: true }], override: { ok: false, error: "missing_credential" },
    did: "pressed Yes and the call went out with no owner id",
    how: "OVERRIDDEN — the product always sends an owner id, so the fixture cannot reach this honestly" },
  { id: "no_such_biz", seed: [{ kind: "website", visible: true }], override: { ok: false, error: "no_such_business" },
    did: "pressed Yes for a business id that is not there",
    how: "OVERRIDDEN — same reason" },
  { id: "threw", seed: [{ kind: "website", visible: true }], override: "THROW",
    did: "pressed Yes and the connection dropped mid-call",
    how: "OVERRIDDEN — the fixture has no latency or failure (its own documented limit 4)" },
];

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/* THE CDN CANNOT ANSWER. supabase-js arrives as a DEFERRED script and OVERWRITES window.supabase
   after any fake installed post-load — owner-rig's own documented hazard, and it is a RACE, so
   "every shipped check already installs after load" is a fact about timing and not a guarantee.
   The first run of this file died on exactly that. Aborting the host removes the race instead of
   hoping to win it. */
await rig.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());

const results = [];
try {
  for (const c of CASES) {
    await rig.load(srv.url("platform-home.html"));
    await rig.page.evaluate(installOwnerFake, {
      uid: "sim-owner", email: "o@example.com", displayName: "Adrian",
      refuseAddPlace: !!c.refuse,
      places: c.seed.map((p, i) => ({ kind: p.kind, scope: "workspace", visible: p.visible, sort_order: (i + 1) * 10 })),
      tables: { jobs: [], tasks: [], customers: [], events: [] },
    });
    const why = await rig.page.evaluate(fakeIntact);
    if (why && !/never took a client/.test(why)) { console.error("CANNOT RUN — " + why); break; }
    // "INTACT BUT NEVER USED" IS NOT A FAILURE HERE. The fake is installed after load, so the boot
    // path has not asked for a client yet; the press below is what asks. fakeIntact() cannot know
    // that, so the one branch meaning "too early" is distinguished from the two that mean "you
    // measured a different program".
    await rig.page.evaluate(async ({ biz }) => {
      await window.hublyArrivalUI.simulate(biz, true, []);
      await new Promise((r) => setTimeout(r, 500));
    }, { biz: BIZ });

    const r = await rig.page.evaluate(async ({ override }) => {
      const client = window.supabase.createClient();     // the fixture hands out ONE client object
      if (override) {
        const real = client.rpc;
        client.rpc = (name, args) => {
          if (name !== "add_business_place") return real(name, args);
          if (override === "THROW") return Promise.reject(new Error("connection dropped"));
          return Promise.resolve({ data: override, error: null });
        };
      }
      const railBefore = [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim());
      const offered = window.hublyDayUI.offerTab("planner", "My Day");
      const btn = [...document.querySelectorAll("[data-hc-tab-offer] .hc-arrival-act")]
        .filter((b) => /yes/i.test(b.textContent))[0];
      if (!offered || !btn) {
        return { offered, pressed: false, railBefore, railAfter: railBefore,
                 places: (window.__rig.places || []).map((p) => p.kind + (p.visible ? "" : "(hidden)")) };
      }
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await new Promise((res) => setTimeout(res, 1200));
      return {
        offered, pressed: true, railBefore,
        said: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()).slice(-1)[0] || null,
        offerStillOnScreen: !!document.querySelector("[data-hc-tab-offer]"),
        railAfter: [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()),
        wrote: (window.__rig.writes || []).filter((w) => w.name === "add_business_place").length,
        places: (window.__rig.places || []).map((p) => p.kind + (p.visible ? "" : "(hidden)")),
      };
    }, { override: c.override || null });
    results.push({ ...c, ...r });
  }
} finally { await rig.close(); srv.close(); }

console.log(`"YES, ADD IT" — ${results.length} answer(s) the RPC really gives, each one PRESSED.\n`);
const layer = (r) => {
  const railGrew = (r.railAfter || []).length > (r.railBefore || []).length;
  const told = String(r.said || "");
  const saysAdded = /added My Day/i.test(told);
  const saysFailed = /couldn.t add/i.test(told);
  if (!r.offered) return ["—", "the offer was NOT MADE at all, which is correct: hcOfferSidebarTab refuses a place already in the rail, so there is no button to press and nothing to get wrong"];
  if (!r.pressed) return ["RENDERER", "the offer was made and produced no pressable button"];
  if (r.override === "THROW") return [saysFailed ? "—" : "DATA", saysFailed ? "the write never landed and he is told his sidebar has not changed — correct" : "the call threw and he was not told"];
  if (r.override && r.override.ok === false) return [saysFailed && !railGrew ? "—" : "RULES", saysFailed && !railGrew ? `refused (${r.override.error}) and said so, rail unchanged — correct` : `refused (${r.override.error}) and the screen or the sentence disagrees`];
  if (r.refuse) return [saysFailed && !railGrew ? "—" : "RULES", saysFailed && !railGrew ? "refused (not_owner) and said so, rail unchanged — correct" : "refused and the screen or the sentence disagrees"];
  if (saysAdded && railGrew) return ["—", "the row was written, the rail grew, and it was said"];
  if (saysAdded && !railGrew) return ["RENDERER", "the record says yes and the rail did not change — a confirmation nobody earned"];
  if (saysFailed) return ["RULES", "refused and said so"];
  return ["?", "unclassified — read the row"];
};
for (const r of results) {
  const [L, why] = layer(r);
  console.log(`  ${r.id.padEnd(13)} [${L}]`);
  console.log(`      the owner did : ${r.did}`);
  console.log(`      expected      : the rail either gains My Day or it does not, and he is told which`);
  console.log(`      produced by   : ${r.how}`);
  console.log(`      what happened : offer made=${r.offered}  · rail ${JSON.stringify(r.railBefore)} -> ${JSON.stringify(r.railAfter)}`);
  console.log(`                      places row(s) after: ${JSON.stringify(r.places)}  · rpc writes ${r.wrote ?? 0}  · offer cleared=${!r.offerStillOnScreen}`);
  console.log(`      he was told   : ${r.said ? '"' + String(r.said).replace(/\s+/g, " ").slice(0, 100) + '"' : "NOTHING"}`);
  console.log(`      leaking layer : ${why}\n`);
}
const bad = results.filter((r) => layer(r)[0] !== "—");
/* ══ AND TWO THINGS NO RPC ANSWER CAN REACH ════════════════════════════════════════════════════
 *
 * The table above exhausts what the SERVER can say. It says nothing about what the OWNER can do, and
 * "every server answer is handled correctly" is not "the feature works". Both of these are pressed
 * the same way. */
const extra = [];
try {
  const rig2 = await openRig({ quiet: true });
  const srv2 = await servePublic(ROOT);
  try {
    await rig2.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());
    for (const probe of ["second-place-same-sitting", "double-press"]) {
      await rig2.load(srv2.url("platform-home.html"));
      await rig2.page.evaluate(installOwnerFake, {
        uid: "sim-owner", email: "o@example.com", displayName: "Adrian",
        places: [{ kind: "website", scope: "workspace", visible: true, sort_order: 10 }],
        tables: { jobs: [], tasks: [], customers: [], events: [] },
      });
      await rig2.page.evaluate(async ({ biz }) => {
        await window.hublyArrivalUI.simulate(biz, true, []);
        await new Promise((r) => setTimeout(r, 500));
      }, { biz: BIZ });
      const r = await rig2.page.evaluate(async (probe) => {
        const press = async () => {
          const b = [...document.querySelectorAll("[data-hc-tab-offer] .hc-arrival-act")].filter((x) => /yes/i.test(x.textContent))[0];
          if (!b) return false;
          b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          return true;
        };
        if (probe === "second-place-same-sitting") {
          // He asks for his day, accepts the tab. Then, in the same sitting, he asks for Jobs.
          const first = window.hublyDayUI.offerTab("planner", "My Day");
          await press(); await new Promise((r) => setTimeout(r, 900));
          const second = window.hublyDayUI.offerTab("jobs", "Jobs");
          await new Promise((r) => setTimeout(r, 400));
          return { probe, first, second,
                   buttonForSecond: !!document.querySelector('[data-hc-tab-offer="jobs"]'),
                   rail: [...document.querySelectorAll(".hc-rail-tab")].map((b) => b.textContent.trim()),
                   said: [...document.querySelectorAll("#hcThreadBody .hc-msg")].map((m) => m.textContent.trim()).slice(-1)[0] };
        }
        // ══ A DOUBLE TAP IS TWO TASKS, NOT TWO DISPATCHES IN ONE ════════════════════════════════
        //
        // The first version of this probe fired two `dispatchEvent`s back to back in the same task
        // and reported TWO writes and TWO confirmations. That was the PROBE. `dispatchEvent` invokes
        // listeners on a disabled button by specification; a real tap on a disabled button does not
        // fire at all. So it was measuring something no human can do, and the handler's
        // `yes.disabled = true` — which runs synchronously before its first await — was being
        // bypassed by the instrument rather than failing.
        //
        // `.click()` respects `disabled`, and a second task is what a fast double tap really is.
        window.hublyDayUI.offerTab("planner", "My Day");
        const b = [...document.querySelectorAll("[data-hc-tab-offer] .hc-arrival-act")].filter((x) => /yes/i.test(x.textContent))[0];
        b.click();
        await new Promise((r) => setTimeout(r, 0));     // the gap between two taps, as short as it gets
        b.click();
        await new Promise((r) => setTimeout(r, 1400));
        return { probe,
                 writes: (window.__rig.writes || []).filter((w) => w.name === "add_business_place").length,
                 confirmations: [...document.querySelectorAll("#hcThreadBody .hc-msg")]
                   .filter((m) => /added My Day/i.test(m.textContent)).length,
                 rail: [...document.querySelectorAll(".hc-rail-tab")].map((x) => x.textContent.trim()) };
      }, probe);
      extra.push(r);
    }
  } finally { await rig2.close(); srv2.close(); }
} catch (e) { console.log("  (the two owner-input probes could not run: " + e.message + ")"); }

console.log(`TWO THINGS NO SERVER ANSWER CAN REACH — the owner's own hand.\n`);
for (const r of extra) {
  if (r.probe === "second-place-same-sitting") {
    const leak = r.first && !r.second;
    console.log(`  second place in one sitting  [${leak ? "RENDERER" : "—"}]`);
    console.log(`      the owner did : accepted My Day as a tab, then asked for Jobs in the same sitting`);
    console.log(`      expected      : Jobs is offered too — the offer is per PLACE, and declining one is`);
    console.log(`                      remembered per place (hcTabOfferDeclined takes a kind)`);
    console.log(`      what happened : first offer made=${r.first} · second offer made=${r.second} · ` +
                `a button for jobs on screen=${r.buttonForSecond} · rail ${JSON.stringify(r.rail)}`);
    console.log(`      leaking layer : ${leak
      ? "hc._tabOfferShown is ONE BOOLEAN for the whole sitting, not one per place. After any offer, " +
        "every other place is silently never offered — the owner asks for Jobs, sees it in the thread, " +
        "and the one mechanism that would give it a tab does not fire and says nothing. That is " +
        "prohibition 4 (the interface changing shape in silence) and prohibition 6 (a request that " +
        "succeeds without confirmation) in the same line."
      : "the second place was offered too"}\n`);
  } else {
    const leak = (r.writes > 1) || (r.confirmations > 1);
    console.log(`  double-press Yes            [${leak ? "DATA" : "—"}]`);
    console.log(`      the owner did : tapped Yes twice before the first tap could disable the button`);
    console.log(`      expected      : one row written, one confirmation said`);
    console.log(`      what happened : ${r.writes} write(s), ${r.confirmations} confirmation(s), rail ${JSON.stringify(r.rail)}`);
    console.log(`      leaking layer : ${leak ? "two presses became two calls — the dropped/duplicated second-tap class" :
      "the button disables inside the handler before its first await, so a second real tap does not fire"}\n`);
  }
}

const extraLeaks = extra.filter((r) => r.probe === "second-place-same-sitting" ? (r.first && !r.second)
  : ((r.writes || 0) > 1 || (r.confirmations || 0) > 1));
console.log(`${bad.length} of ${results.length} server answers leave something wrong` +
  (bad.length ? `. By layer: ` + Object.entries(bad.reduce((a, r) => { const k = layer(r)[0]; a[k] = (a[k] || 0) + 1; return a; }, {}))
    .map(([k, n]) => `${k} ${n}`).join(" · ") : " — every one of the seven is handled."));
console.log(`${extraLeaks.length} of ${extra.length} owner-input probes leave something wrong.`);
if (!results.length || extra.length < 2) {
  console.error("\nCANNOT RUN — not every probe was driven, so silence here is not an answer.");
  process.exit(2);
}
process.exit(bad.length + extraLeaks.length ? 1 : 0);
