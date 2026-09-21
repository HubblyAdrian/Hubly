#!/usr/bin/env node
/**
 * [RULE] A STORED SESSION THAT CAN STILL BE REFRESHED KEEPS THE OWNER IN HIS OWN PRODUCT.
 *
 *   node scripts/check-an-expired-token-is-not-a-signed-out-owner.mjs
 *
 * ══ WHAT HAPPENED ═══════════════════════════════════════════════════════════════════════════
 *
 * MEASURED on the live app, 2026-09-20: access token expired 366 seconds earlier, refresh token
 * present, and platform-home rendered the PUBLIC MARKETING PAGE — hero, "Log in or sign up" —
 * and stayed there. Polled for twenty-five seconds; the shell never arrived. getSession() by hand
 * refreshed it at once and returned a live session with an hour of new life. The session was
 * never dead; the predicate said it was.
 *
 * `HublyBoot.isAuthed()` asked "is the access token still in date". Access tokens last an hour BY
 * DESIGN, with a refresh token beside them precisely so that expiry costs a round trip. Worse,
 * `hcLoadOwnedBusiness()` opens with `if(!hcIsAuthed()) return false`, so no client was ever
 * built and NO REFRESH WAS EVER ATTEMPTED — the expiry was self-fulfilling.
 *
 * ══ WHAT THIS CHECK CAN AND CANNOT SEE ══════════════════════════════════════════════════════
 *
 * It asserts the RENDERED OUTCOME at the moment the decision is made — is this session shown the
 * marketing hero — across four real stored-session shapes. It does NOT perform a token refresh:
 * there is no auth server here, so "the refresh succeeds" is not something this environment can
 * witness. That half is verified by hand against the live account, by expiring the stored expiry
 * of a real session and reloading. Stating the boundary because a check that stubs the very round
 * trip in question and reports green is a failure this repo has already paid for.
 *
 * AND THE LANDING COMES BACK HERE FOR EVERY SHAPE, CORRECTLY. With no backend the ownership
 * question cannot be answered, so the async path calls HublyBoot.notOwner() and the landing
 * returns — by design ("it undoes itself if the evidence was stale"). That is why the legs below
 * read a TRACE recorded as it happens rather than the DOM after it settles: settled state here is
 * the same for a live session and a dead one, and a check reading it would be measuring the
 * absent backend rather than the predicate. The trace records, at every change, whether this
 * session was being treated as an owner's AND whether the hero was on screen at that instant —
 * so "hidden" is an observed paint, not an inference from a class name.
 *
 * The three shapes are the whole argument. Asserting only the refreshable one would pass just as
 * well against `return true`, which would put a signed-out stranger into a shell that cannot
 * load. The dead shapes are what make the live one mean something.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "sb-rtwxxkxpkqdrhclkozma-auth-token";
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

const now = Math.floor(Date.now() / 1000);
/* Token VALUES are meaningless strings — nothing here is a credential, and nothing here reaches a
 * network. What is under test is the SHAPE: which fields are present, and what the clock says. */
const SHAPES = {
  refreshable: { label: "expired access token, refresh token present (the live failure)",
    session: { access_token: "expired-access", refresh_token: "live-refresh", expires_at: now - 366 } },
  stranded:    { label: "expired access token, NO refresh token",
    session: { access_token: "expired-access", expires_at: now - 366 } },
  none:        { label: "no stored session at all", session: null },
  /* NO refresh token on purpose: with one present the new first branch answers and the ORIGINAL
   * expiry test is never reached, so leg 3 would be guarding a line nothing executes. */
  live:        { label: "unexpired access token, no refresh token (the preserved original test)",
    session: { access_token: "fresh-access", expires_at: now + 3600 } },
};

const srv = await servePublic(ROOT);
let rig;
try { rig = await openRig({ width: 1280, height: 900, quiet: true }); }
catch (e) { console.error("CANNOT RUN — " + e.message); srv.close(); process.exit(2); }

/** Boot the real page with one stored-session shape and read what a person would SEE. */
async function boot(shape) {
  const payload = SHAPES[shape].session;
  /* ONE INIT SCRIPT PER BOOT, CARRYING BOTH THE FIXTURE AND THE RECORDER. Registered on the rig
   * (not the page) so it survives load({fresh:true}), and it runs BEFORE the head script that
   * makes this decision — the only ordering that tests it at all. They accumulate across boots,
   * which is harmless because each one sets the key outright and the last registered wins. */
  await rig.addInitScript(new Function(
    `try{ var k=${JSON.stringify(KEY)}; var v=${JSON.stringify(payload && JSON.stringify(payload))};` +
    ` if(v){ localStorage.setItem(k, v); } else { localStorage.removeItem(k); } }catch(e){}` +
    `try{` +
    `  window.__bootTrace = [];` +
    `  var snap = function(){` +
    `    var de = document.documentElement; if(!de) return;` +
    `    var hero = document.querySelector('.hero');` +
    `    window.__bootTrace.push({` +
    `      owner: de.classList.contains('hc-boot-owner'),` +
    `      heroPainted: !!hero && getComputedStyle(hero).display !== 'none'` +
    `    });` +
    `  };` +
    `  snap();` +
    // OBSERVE `document`, NOT `document.documentElement`. An init script runs before parsing
    // starts, so documentElement is still null and .observe(null) THROWS — which aborted this
    // whole block and left the trace permanently empty while every leg quietly failed. `document`
    // always exists, and subtree:true reaches the <html> class attribute the moment it is set.
    `  new MutationObserver(snap).observe(document, { attributes:true, subtree:true, attributeFilter:['class'] });` +
    `  document.addEventListener('DOMContentLoaded', snap);` +
    `  setTimeout(snap, 0);` +
    `}catch(e){}`));
  await rig.load(srv.url("platform-home.html"));
  await new Promise((r) => setTimeout(r, 2500));
  return await rig.page.evaluate(() => {
    const trace = window.__bootTrace || [];
    const vis = (sel) => { const n = document.querySelector(sel);
      return !!n && getComputedStyle(n).display !== "none" && n.getBoundingClientRect().height > 0; };
    return {
      // Was this session EVER treated as an owner's, and was the hero ever on screen while it was?
      treatedAsOwner: trace.some((t) => t.owner),
      heroPaintedWhileOwner: trace.some((t) => t.owner && t.heroPainted),
      // Did the hero reach the screen at any recorded moment before the async correction?
      heroPaintedEarly: trace.length ? trace[0].heroPainted : null,
      traceLen: trace.length,
      settledHero: vis(".hero"),
    };
  });
}

let R = {};
try {
  for (const k of Object.keys(SHAPES)) R[k] = await boot(k);
} catch (e) {
  console.error("CANNOT RUN — " + String(e.message).split("\n")[0]);
  try { await rig.close(); } catch (_) {}
  srv.close(); process.exit(2);
}
await rig.close(); srv.close();

for (const k of Object.keys(SHAPES)) {
  console.log(`  ${k.padEnd(12)} ${SHAPES[k].label}`);
  console.log(`  ${"".padEnd(12)}   treated as an owner at boot: ${R[k].treatedAsOwner} · ` +
              `hero on screen while it was: ${R[k].heroPaintedWhileOwner} · ` +
              `(${R[k].traceLen} trace points, landing after the ownership question went unanswered: ` +
              `${R[k].settledHero})`);
}
console.log("");

/* THE FIXTURE MUST BE ABLE TO SHOW A LANDING AT ALL. If `.hero` never renders in this harness,
 * every leg below is asserting the absence of something that was never going to appear. */
if (!R.none.settledHero) {
  console.error("CANNOT RUN — with no stored session the landing hero did not render, so 'the hero " +
                "is hidden' is not evidence of anything and every leg would pass vacuously.");
  process.exit(2);
}

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 an expired access token with a live refresh token keeps the owner out of the landing",
  why: "ask the old question — is the ACCESS token still in date — which is what shipped. An " +
       "owner who has been away for sixty-one minutes is shown the marketing page for his own " +
       "product, and because the same reader gates hcLoadOwnedBusiness, no refresh is attempted.",
  file: "public/platform-home.html",
  find: "      if(s.refresh_token) return true;",
  with: "      if(s.refresh_token && false) return true;",
});
leg("RULE", "1 an expired access token with a live refresh token keeps the owner out of the landing",
  R.refreshable.treatedAsOwner && !R.refreshable.heroPaintedWhileOwner,
  `token expired 366s ago, refresh token present: treated as an owner's session at boot ` +
  `(${R.refreshable.treatedAsOwner}), and the marketing hero was never on screen while it was ` +
  `(${!R.refreshable.heroPaintedWhileOwner}). Live, this exact shape put the owner on the ` +
  `marketing page and left him there for the twenty-five seconds anyone bothered to watch.`);

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 a session with nothing left to refresh still shows the landing",
  why: "over-correct to `always authed`, which is the obvious wrong fix for this defect. Every " +
       "visitor, signed out or not, is then dropped into an owner shell that has nothing to " +
       "load — the landing replaced by a permanent empty room.",
  file: "public/platform-home.html",
  find: "      if(s.refresh_token) return true;",
  with: "      if(s) return true;",
});
leg("RULE", "2 a session with nothing left to refresh still shows the landing",
  !R.stranded.treatedAsOwner && R.stranded.settledHero && !R.none.treatedAsOwner && R.none.settledHero,
  `expired with no refresh token → treated as an owner: ${R.stranded.treatedAsOwner}, hero ` +
  `${R.stranded.settledHero ? "shown" : "HIDDEN"}; no session at all → treated as an owner: ` +
  `${R.none.treatedAsOwner}, hero ${R.none.settledHero ? "shown" : "HIDDEN"}. This is the leg ` +
  `that stops leg 1 being satisfied by "always authed" — which would drop a signed-out stranger ` +
  `into a shell with nothing to load. Without this pair the fix is indistinguishable from ` +
  `\`return true\`.`);

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 the ordinary unexpired session is unaffected",
  why: "break the expiry test that was already here and is meant to survive this change. A " +
       "session whose access token is still perfectly valid would be sent to the landing — the " +
       "original defect widened from the expiry edge to every reload.",
  file: "public/platform-home.html",
  find: "      var exp = s.expires_at;\n      return !exp || (exp * 1000 > Date.now());",
  with: "      var exp = s.expires_at;\n      return !exp && (exp * 1000 > Date.now());",
});
leg("RULE", "3 the ordinary unexpired session is unaffected",
  R.live.treatedAsOwner && !R.live.heroPaintedWhileOwner,
  `unexpired token: treated as an owner ${R.live.treatedAsOwner}, hero never on screen while it ` +
  `was ${!R.live.heroPaintedWhileOwner}. The ` +
  `common path every owner takes on every reload, asserted so that a change aimed at the expiry ` +
  `edge cannot quietly cost the ninety-nine percent case.`);

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
