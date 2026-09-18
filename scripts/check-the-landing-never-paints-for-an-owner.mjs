#!/usr/bin/env node
/**
 * THE LANDING PAGE MUST NEVER PAINT FOR SOMEONE WHO IS SIGNED IN.
 *
 * ADRIAN, 2026-09-17: "Signed in, I refresh, and I see the landing page before the app."
 *
 * HE WAS RIGHT ABOUT THE CAUSE, and the diagnosis is worth keeping because it is why this check is
 * shaped the way it is. The landing markup (`section.hero`, `.footer`, the "Log in or sign up"
 * button) is in public/platform-home.html and visible by default. The only thing that used to hide
 * it was `body.hc-active`, added by hcRevealApp(), reached for an owner through
 * hcOpenOwnedBusiness <- hcLoadOwnedBusiness <- the boot IIFE — a path that first awaits
 * authGetClient() (which POLLS FOR A CDN SCRIPT FOR UP TO TEN SECONDS) and then an
 * rpc('get_my_businesses') round-trip. So the landing was painted, held for a script load plus a
 * network call, and replaced.
 *
 * WHICH MEANS THE ONLY HONEST WAY TO TEST THE FIX IS WITH THE NETWORK GONE. If the CDN and the
 * backend can answer, a check cannot tell "decided locally in the first frame" from "decided after
 * a fast round-trip on a loopback-quick machine" — it would go green on the broken version as soon
 * as the network was quick enough, which is a check that passes because the office wifi is good.
 * So legs 1-4 ABORT both hosts. Nothing can answer. Anything the page gets right, it got right from
 * what the browser already held.
 *
 * BOTH DIRECTIONS, because a probe that cannot tell ABSENT from BROKEN reports the fix as the
 * defect and vice versa. "The hero never painted" is trivially true of a page where the hero is
 * always hidden, or of a rig that failed to load the stylesheet, or of a sampler that never ran.
 * Leg 5 removes the session and requires the hero to BE there; leg 6 keeps the session but has the
 * account own nothing and requires the landing to come BACK.
 *
 * WHAT THIS CANNOT SEE: it samples animation frames, so it proves "no frame we looked at showed the
 * landing", not "no pixel ever". The guarantee that upgrades that to never is STRUCTURAL and is
 * leg 2: the deciding script and the hiding rule are both above <body> in the served bytes, so the
 * hero's first style resolution already had the answer. Sampling alone would be a floor.
 *
 * LEG LABELS, at write time (Lesson 92):
 *   [RULE]  must never go red because the product improved.
 *   [SHAPE] legitimately goes red when the shape moves; that is not an alarm.
 */
import { readFileSync } from "node:fs";
import { openRig } from "./lib/browser-rig.mjs";
import { servePublic } from "./lib/serve-public.mjs";
import { installOwnerFake } from "./lib/owner-rig.mjs";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = readFileSync(ROOT + "/public/platform-home.html", "utf8");

const legs = [];
const leg = (kind, name, pass, detail) => {
  legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`);
};

/* ── THE SESSION KEY IS DERIVED, NEVER TYPED ───────────────────────────────────────────────────
   A handed value is an example of a set. The supabase project ref lives in exactly one place in
   the shipping file; parse it from there, so a project change makes this check follow rather than
   silently seed a key nothing reads. */
function sessionKeyFromSource() {
  const m = SRC.match(/SUPA_URL\s*=\s*['"]https:\/\/([a-z0-9]+)\.supabase\.co['"]/i)
        || SRC.match(/SUPA\s*=\s*['"]https:\/\/([a-z0-9]+)\.supabase\.co['"]/i);
  if (!m) throw new Error("CANNOT RUN — no SUPA_URL literal in public/platform-home.html to derive the session key from");
  return { ref: m[1], key: `sb-${m[1]}-auth-token` };
}
const { ref, key: SB_KEY } = sessionKeyFromSource();

/* THE SAMPLER. Installed before any page script, so it is watching from the first frame the
   browser gives anyone. It records the landing's three visible parts every animation frame, and
   the first frame at which each was VISIBLE — a frame, not a duration, so the answer cannot be a
   timeout in disguise. */
function installLandingSampler() {
  window.__frames = [];
  const vis = (el) => {
    if (!el) return null;                                  // not parsed yet: no frame of it either
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  let n = 0;
  const tick = () => {
    window.__frames.push({
      n: n++,
      t: Math.round(performance.now()),
      hero: vis(document.querySelector(".hero")),
      footer: vis(document.querySelector(".footer")),
      signin: vis(document.getElementById("navSignin")),
      app: vis(document.getElementById("hcApp")),
      active: !!(document.body && document.body.classList.contains("hc-active")),
      bootOwner: !!(document.documentElement && document.documentElement.classList.contains("hc-boot-owner")),
    });
    if (n < 600) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function seedSession(k) {
  // A session that is unexpired by its own clock: exactly the evidence the browser holds after a
  // real sign-in, and the only thing the first-paint decision is allowed to read.
  try {
    localStorage.setItem(k, JSON.stringify({
      access_token: "sim-not-a-real-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));
  } catch (_) {}
}

async function frames(rig, ms) {
  await rig.page.waitForTimeout(ms);
  return rig.page.evaluate(() => window.__frames || []);
}
const firstVisible = (fs, k) => { const h = fs.find((f) => f[k] === true); return h ? h.n : null; };
const summarise = (fs, k) => {
  const seen = fs.filter((f) => f[k] === true).length;
  return `${seen}/${fs.length} frames visible` + (seen ? ` (first at frame ${firstVisible(fs, k)}, t=${fs.find((f) => f[k] === true).t}ms)` : "");
};

(async () => {
  const srv = await servePublic(ROOT);
  const url = srv.url("platform-home.html");
  let rig;
  try { rig = await openRig({ width: 1440, height: 900, quiet: true }); }
  catch (e) { console.log("CANNOT RUN — " + e.message); process.exit(2); }

  try {
    /* ══ LEG 2 FIRST: the structural guarantee, read off the file, before any browser ══════════ */
    // THE REAL TAG, not the "<body>" inside the comment that explains this very fix — which is
    // what this leg found on its first run, and is the miniature of the hand-written-matcher
    // problem: the first thing that LOOKS like the thing is often prose about the thing.
    const bodyAt = SRC.search(/\n<body[\s>]/);
    const bootAt = SRC.indexOf("hc-boot-owner");
    const cssAt  = SRC.indexOf("html.hc-boot-owner .hero");
    leg("SHAPE", "the deciding script and the hiding rule are both above <body>",
      bootAt > 0 && cssAt > 0 && bootAt < bodyAt && cssAt < bodyAt,
      `hc-boot-owner first appears at byte ${bootAt}, its hero rule at ${cssAt}, <body> at ${bodyAt} — ` +
      `a decision below <body> could only hide something already laid out, which is painted-then-hidden`);

    /* ══ ONE READER OF THE SESSION FACT ════════════════════════════════════════════════════════ */
    const keyLits = (SRC.match(/'sb-'\s*\+/g) || []).length;
    const expTests = (SRC.match(/exp\s*\*\s*1000\s*>\s*Date\.now\(\)/g) || []).length;
    leg("SHAPE", "the session key and its expiry test are built in exactly one place each",
      keyLits === 1 && expTests === 1,
      `'sb-' + … key construction: ${keyLits} site(s); the expiry comparison: ${expTests} site(s). ` +
      `hcSbKey/hcIsAuthed delegate to the boot script rather than re-implementing it — two readers of ` +
      `one fact is the defect this file has paid for most`);

    /* ══ THE NETWORK IS GONE FOR LEGS 1, 3, 4 ══════════════════════════════════════════════════ */
    // ══ PREDICATES, NOT GLOBS — the instrument's own first failure ══════════════════════════════
    //
    // The glob form of these two lines matched NOTHING. The script loaded from the real CDN, the app
    // took a real client, its rpc failed against the aborted backend, and the landing came back at
    // 988ms — and the check reported that as the product's defect while its own headline said the
    // CDN was aborted. A route that does not match is silent, and silence from an instrument reads
    // exactly like a finding. A URL predicate cannot be silently wrong about which host it means,
    // and `abortedHosts` turns "the network was down" from an assumption into an observation.
    const abortedHosts = [];
    const abortHost = (h) => rig.addRoute(
      (u) => { const hit = u.hostname === h; if (hit) abortedHosts.push(u.hostname); return hit; },
      (r) => r.abort());
    await abortHost("cdn.jsdelivr.net");
    await abortHost(ref + ".supabase.co");
    await rig.addInitScript(installLandingSampler);
    await rig.addInitScript(`(${seedSession.toString()})(${JSON.stringify(SB_KEY)})`);

    await rig.load(url);
    let fs = await frames(rig, 2500);
    if (!fs.length) throw new Error("CANNOT RUN — the frame sampler produced no frames; it did not arm");

    if (!abortedHosts.length) throw new Error("CANNOT RUN — nothing was aborted, so 'the network cannot answer' was never the condition measured");
    leg("RULE", "with the network unable to answer, no frame of a signed-in load shows the landing",
      firstVisible(fs, "hero") === null && firstVisible(fs, "footer") === null && firstVisible(fs, "signin") === null,
      `over ${fs.length} frames / ${fs[fs.length - 1].t}ms with cdn.jsdelivr.net and ${ref}.supabase.co both ` +
      `aborted — hero: ${summarise(fs, "hero")} · footer: ${summarise(fs, "footer")} · ` +
      `"Log in or sign up": ${summarise(fs, "signin")}. body.hc-active was reached in ` +
      `${fs.filter((f) => f.active).length} of them, which is the point: the landing stayed away WITHOUT it`);

    leg("RULE", "the app ground is on screen from the first frame, not a blank page",
      fs[0] && fs[0].app === true && firstVisible(fs, "app") === 0,
      `#hcApp visible at frame ${firstVisible(fs, "app")} — ${summarise(fs, "app")}. Hiding the landing without ` +
      `revealing the app would trade a wrong screen for an empty one`);

    const inert = await rig.page.evaluate(() => {
      const bar = document.querySelector(".hc-input-bar");
      if (!bar) return { found: false };
      const cs = getComputedStyle(bar);
      return { found: true, pe: cs.pointerEvents, op: cs.opacity,
               active: document.body.classList.contains("hc-active") };
    });
    leg("RULE", "the composer is inert while no business is open behind it",
      inert.found && inert.active === false && inert.pe === "none",
      `.hc-input-bar pointer-events=${inert.pe} opacity=${inert.op} while body.hc-active=${inert.active}. ` +
      `An app ground shown early must not accept a sentence it will drop — that is the ` +
      `silently-discarded-owner-action class, and it is not an acceptable price for a faster paint`);

    /* ══ ABSENT vs BROKEN, DIRECTION ONE: no session at all ════════════════════════════════════ */
    const rig2 = await openRig({ width: 1440, height: 900, quiet: true });
    try {
      await rig2.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());
      await rig2.addRoute((u) => u.hostname === ref + ".supabase.co", (r) => r.abort());
      await rig2.addInitScript(installLandingSampler);        // sampler, and NO session seeded
      await rig2.load(url);
      const fs2 = await frames(rig2, 1500);
      leg("RULE", "with no session in the browser, the landing IS painted",
        firstVisible(fs2, "hero") === 0 && fs2.some((f) => f.signin === true) && !fs2.some((f) => f.bootOwner),
        `over ${fs2.length} frames — hero: ${summarise(fs2, "hero")} · "Log in or sign up": ` +
        `${summarise(fs2, "signin")} · hc-boot-owner on <html> in ${fs2.filter((f) => f.bootOwner).length} frames. ` +
        `Without this leg, "the landing never painted" would also be green on a page whose hero is ` +
        `simply always hidden, or on a rig whose stylesheet never loaded`);
    } finally { await rig2.close(); }

    /* ══ ABSENT vs BROKEN, DIRECTION TWO: the local evidence was stale ═════════════════════════
       A session in storage, unexpired by its own clock, for an account that owns nothing. The
       pre-paint guess is WRONG here, and the requirement is that it undoes itself rather than
       leaving a person stranded on an app shell with no way to the landing. The backend answers
       this time — it has to, because the correction is what is under test. */
    const rig3 = await openRig({ width: 1440, height: 900, quiet: true });
    try {
      await rig3.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());
      await rig3.addInitScript(installLandingSampler);
      await rig3.addInitScript(`(${installOwnerFake.toString()})(${JSON.stringify({
        uid: "sim-owner", email: "sim@example.test", businesses: [], rpcDelayMs: 700 })})`);
      await rig3.load(url);
      const fs3 = await frames(rig3, 2500);
      const late = fs3[fs3.length - 1];
      leg("RULE", "a session for an account that owns nothing gets the landing back",
        fs3.some((f) => f.bootOwner) && late && late.hero === true && late.bootOwner === false,
        `with the fixture declaring rpcDelayMs=700 (without a declared latency this whole window closes ` +
        `before frame 0 and the leg measures the fake) — hc-boot-owner set in ` +
        `${fs3.filter((f) => f.bootOwner).length} of ${fs3.length} frames and removed ` +
        `by the end; hero visible at frame ${firstVisible(fs3, "hero")} (${summarise(fs3, "hero")}). ` +
        `The guess is allowed to be wrong for a browser holding a dead session; it is not allowed to ` +
        `strand that person on a shell with no landing behind it`);

      /* ══ AND THE REAL OWNER, ALL THE WAY THROUGH ════════════════════════════════════════════ */
      const rig4 = await openRig({ width: 1440, height: 900, quiet: true });
      try {
        await rig4.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());
        await rig4.addInitScript(installLandingSampler);
        await rig4.addInitScript(`(${installOwnerFake.toString()})(${JSON.stringify({
          uid: "sim-owner", email: "sim@example.test", rpcDelayMs: 700,
          businesses: [{ id: "biz-sim-1", slug: "sim-detailing", name: "Sim Detailing",
                         url: "https://example.test/sim-detailing", claimed_at: "2026-09-01T00:00:00Z" }] })})`);
        await rig4.load(url);
        const fs4 = await frames(rig4, 3000);
        const opened = fs4.some((f) => f.active === true);
        leg("RULE", "the owner's real load: landing absent in every frame AND the app actually opens",
          opened && firstVisible(fs4, "hero") === null && firstVisible(fs4, "footer") === null,
          `over ${fs4.length} frames, fixture rpcDelayMs=700 so the early frames are attributable to the ` +
          `pre-paint decision alone rather than to hc-active — body.hc-active reached at frame ` +
          `${fs4.findIndex((f) => f.active)} · hero: ${summarise(fs4, "hero")} · footer: ${summarise(fs4, "footer")}. ` +
          `This is the leg that would catch "hid the landing and broke the app to do it"`);

        const handedOff = await rig4.page.evaluate(() => {
          const bar = document.querySelector(".hc-input-bar");
          return { pe: bar ? getComputedStyle(bar).pointerEvents : null,
                   active: document.body.classList.contains("hc-active") };
        });
        /* ══ AND THE ACCOUNT CHIP COMES BACK TOO ══════════════════════════════════════════════════
         * The pre-paint CSS hides "Log in or sign up" because painting it to someone who IS signed in
         * is the landing leaking through the one control that contradicts the state hardest. It has to
         * LIFT — and for a day it did not: `hc-boot-owner` is removed only when the account owns
         * nothing, so on a successful owner load the chip stayed `visibility:hidden` for the life of
         * the page. That chip is the sign-out door, and on a phone the route to settings.
         *
         * Adrian found it on a real session (`.hc-rail-acct` innerText EMPTY — innerText excludes a
         * hidden subtree). The leg beside this one asserted the COMPOSER lifts and passed; nothing
         * asserted the chip did. Two controls in one CSS block, one covered. */
        const chip = await rig4.page.evaluate(() => {
          const b = document.getElementById("navSignin");
          if (!b) return { found: false };
          const cs = getComputedStyle(b);
          const r = b.getBoundingClientRect();
          return { found: true, visibility: cs.visibility, display: cs.display,
                   w: Math.round(r.width), h: Math.round(r.height),
                   inRail: !!b.closest("#hcRailAcct"),
                   active: document.body.classList.contains("hc-active") };
        });
        declareBreak({
          leg: "the account chip is visible once the business is open",
          why: "make the pre-paint hide unconditional again — `hc-boot-owner` is never removed on a " +
               "successful owner load, so the sign-out door stays invisible for the life of the page",
          file: "public/platform-home.html",
          find: "html.hc-boot-owner body:not(.hc-active) #navSignin{visibility:hidden}",
          with: "html.hc-boot-owner #navSignin{visibility:hidden}",
        });
        leg("RULE", "the account chip is visible once the business is open",
          chip.found && chip.active === true && chip.visibility !== "hidden" &&
          chip.display !== "none" && chip.w > 1 && chip.h > 1,
          `#navSignin found=${chip.found} · visibility=${chip.visibility} · ${chip.w}x${chip.h} · ` +
          `in the rail slot=${chip.inRail} · body.hc-active=${chip.active}. The SIZE is part of the ` +
          `assertion: a hidden-but-present chip has a box, and a removed one has none — a leg asserting ` +
          `only "not hidden" would pass on a chip that is not there at all.`);

        leg("RULE", "once the business is open the composer is live again",
          handedOff.active === true && handedOff.pe !== "none",
          `body.hc-active=${handedOff.active}, .hc-input-bar pointer-events=${handedOff.pe}. ` +
          `The inert state must LIFT — a composer permanently disabled by the fast-paint path would be ` +
          `a worse defect than the one it replaced`);
      } finally { await rig4.close(); }

      /* ══ AND THE THIRD OUTCOME, WHICH IS NOT "NOT AN OWNER" ═════════════════════════════════
         The question could not be ASKED — the reader rejected. Answering that with the landing
         would tell a signed-in owner he is not signed in, off a dropped connection, and it is
         the fall-through-to-a-neutral-screen that prohibition 3 names. So the shell stays and
         prohibition 6 applies: it says what happened, in words, rather than sitting there. */
      const rig5 = await openRig({ width: 1440, height: 900, quiet: true });
      try {
        await rig5.addRoute((u) => u.hostname === "cdn.jsdelivr.net", (r) => r.abort());
        await rig5.addInitScript(installLandingSampler);
        await rig5.addInitScript(`(${installOwnerFake.toString()})(${JSON.stringify({
          uid: "sim-owner", email: "sim@example.test", rpcDelayMs: 300,
          failRpc: ["get_my_businesses"] })})`);
        await rig5.load(url);
        const fs5 = await frames(rig5, 2500);
        const said = await rig5.page.evaluate(() => {
          const t = document.getElementById("hcThreadBody");
          return { text: t ? t.innerText : null,
                   active: document.body.classList.contains("hc-active"),
                   boot: document.documentElement.classList.contains("hc-boot-owner") };
        });
        const names = /can't reach Hubly/i.test(said.text || "");
        leg("RULE", "when the ownership question cannot be ASKED, the shell stays and says so",
          names && said.active === true && said.boot === true && firstVisible(fs5, "hero") === null,
          `get_my_businesses rejected; hero: ${summarise(fs5, "hero")} · body.hc-active=${said.active} · ` +
          `hc-boot-owner still on=${said.boot} · the thread names it=${names}` +
          (said.text ? ` ("${String(said.text).replace(/\s+/g, " ").slice(0, 96)}…")` : " (thread empty)") +
          `. "Owns nothing" and "could not ask" are different answers and only one of them is the landing`);
      } finally { await rig5.close(); }
    } finally { await rig3.close(); }
  } catch (e) {
    console.log((e.rigPrecondition ? "" : "ERROR — ") + e.message);
    if (e.rigPrecondition) { await rig.close().catch(() => {}); await srv.close(); process.exit(2); }
    legs.push({ kind: "RULE", name: "the check ran to completion", pass: false, detail: e.message });
  } finally {
    await rig.close().catch(() => {});
    await srv.close();
  }

  const bad = legs.filter((l) => !l.pass);
  console.log(`\n${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs` +
    (bad.length ? `\n\nRED:\n` + bad.map((l) => `  [${l.kind}] ${l.name}\n        ${l.detail}`).join("\n") : ""));
  process.exit(bad.length ? 1 : 0);
})();
