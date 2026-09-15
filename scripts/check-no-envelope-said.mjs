#!/usr/bin/env node
/**
 * HUBLY NEVER SAYS ITS OWN PROTOCOL.
 *
 *   node scripts/check-no-envelope-said.mjs
 *
 * THE DEFECT, 2026-09-15: Adrian was shown this, in a Hubly message bubble, above his week grid
 * on his own claimed site:
 *
 *     {"action":"reply","message":""}
 *
 * MEASURED BEFORE ANYTHING WAS CHANGED. It is not one bug, it is one bug in four places:
 *
 *   1. supabase/functions/hubly-conversation/index.ts — on JSON.parse failure the fallback was
 *      `message: rawText`, and rawText IS the envelope. extractJson slices first-"{" to
 *      LAST-"}", so a single stray token after a valid envelope makes the slice unparseable.
 *   2. supabase/functions/chatbot-message/index.ts — the identical fallback, three lines of the
 *      same mistake, pointed at the OWNER'S CUSTOMER on the public page.
 *   3. public/platform-home.html hcAppendMessage — `div.textContent = text`, which renders
 *      whatever it is handed, forever, with no opinion about what it is.
 *   4. public/platform-home.html hcRenderTranscript — the replay composer. The envelope is
 *      PERSISTED, so fixing only the live path leaves it printed on his page on every reload.
 *
 * THE CLASS, in one sentence: *machine output reaching a person because a fallback preferred raw
 * text to no text.* This check holds all four ends at once, plus the two that matter most:
 * salvage a real sentence when the envelope carries one, and NEVER trade the envelope for silence
 * (the no-silence floor speaks instead — that is a true sentence about a failed turn).
 *
 * RED-PROOFED on the exact string above (see RED-PROOF at the foot of this file).
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openRig } from "./lib/browser-rig.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const say = (n, ok, d) => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); if (!ok) failed++; };

// THE EXACT STRING, and the shapes it arrives in. Anything here that reaches a person is a fail.
const THE_STRING = '{"action":"reply","message":""}';
const POISON = [
  THE_STRING,
  '{"action":"reply","message":""} ',
  '{"action":"reply","message":""}\n\n```',
  '{"capabilityAction":{"action":"business.addJob"},"message":""}',
  '[{"action":"reply"}]',
  '{"action":"reply","message":"{\\"action\\":\\"reply\\",\\"message\\":\\"\\"}"}',
];
// And the shapes that MUST still be said — refusing these would be the worse bug.
const SAYABLE = [
  ["a plain sentence", "That's saved — your Tuesday is clear now.", "That's saved — your Tuesday is clear now."],
  ["a sentence with a brace in it", "Use {name} in the template.", "Use {name} in the template."],
  ["an envelope carrying a real message", '{"action":"reply","message":"Added it to Tuesday."}', "Added it to Tuesday."],
  ["an envelope with escapes", '{"action":"reply","message":"I said \\"done\\" \\u2014 it is."}', 'I said "done" — it is.'],
];

// ── 1. THE SHARED PREDICATE (both edge functions) ───────────────────────────────────────
// RUN, not read. Node can type-strip the .ts directly on new enough runtimes; where it cannot,
// deno runs it. Either way the assertions below EXECUTE — the first draft of this leg put them
// inside the deno fallback, node imported the module fine, and legs 1 and 2 quietly asserted
// nothing at all (Lesson 84: a leg that can be skipped will be, and it will look green).
{
  let sayableText = null;
  try { ({ sayableText } = await import("../supabase/functions/_shared/hubly_sayable.ts")); }
  catch { /* fall through to deno */ }

  let poison, sayable;
  if (sayableText) {
    poison = POISON.map((p) => sayableText(p));
    sayable = SAYABLE.map(([, i]) => sayableText(i));
  } else {
    const { execFileSync } = await import("node:child_process");
    const script = `
      import { sayableText } from "${join(ROOT, "supabase/functions/_shared/hubly_sayable.ts")}";
      console.log(JSON.stringify({
        poison: ${JSON.stringify(POISON)}.map((p) => sayableText(p)),
        sayable: ${JSON.stringify(SAYABLE)}.map(([, i]) => sayableText(i)),
      }));
    `;
    let out;
    try { out = execFileSync("deno", ["eval", "--ext=ts", script], { encoding: "utf8" }); }
    catch (e) { console.error("CANNOT RUN — no runtime could load hubly_sayable.ts: " + String(e.message).slice(0, 160)); process.exit(2); }
    ({ poison, sayable } = JSON.parse(out.trim().split("\n").pop()));
  }
  say(`0 the shared predicate actually ran (${sayableText ? "node" : "deno"})`,
    Array.isArray(poison) && poison.length === POISON.length, `${poison?.length} inputs evaluated`);
  say("1 server: no envelope survives sayableText", poison.every((v) => v === ""), JSON.stringify(poison));
  SAYABLE.forEach(([name, , want], i) => say(`2.${i + 1} server: ${name} is still said`, sayable[i] === want,
    `got ${JSON.stringify(sayable[i])}`));
}

// ── 2. BOTH EDGE FALLBACKS, FROM SOURCE ─────────────────────────────────────────────────
// The line that did it was `message: rawText`. Assert it is gone from BOTH, by shape, so the
// sibling can never be reintroduced alone.
for (const [label, file] of [["hubly-conversation", "supabase/functions/hubly-conversation/index.ts"],
                             ["chatbot-message", "supabase/functions/chatbot-message/index.ts"]]) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const rawToReply = /(?:message|reply)\s*:\s*rawText\b/.test(src);
  say(`3 ${label}: raw model text is never handed back as the reply`, !rawToReply,
    rawToReply ? "found `reply: rawText`" : "guarded by sayableText");
  say(`4 ${label}: imports the one shared predicate`, /hubly_sayable\.ts/.test(src));
}

// ── 3. BOTH CLIENT COMPOSERS, RUN ───────────────────────────────────────────────────────
let rig;
try { rig = await openRig(); }
catch (e) { console.error("CANNOT RUN — " + e.message); process.exit(2); }
try {
  await rig.load("file://" + join(ROOT, "public/platform-home.html"));
  if (!(await rig.page.evaluate(() => typeof window.hublyComposer === "object" && typeof window.hublyComposer.sayable === "function"))) {
    console.error("CANNOT RUN — window.hublyComposer is not exposed."); await rig.close(); process.exit(2);
  }
  const r = await rig.page.evaluate(({ POISON, SAYABLE }) => {
    const S = window.hublyComposer.sayable;
    return { poison: POISON.map((p) => S(p)), sayable: SAYABLE.map(([, i]) => S(i)) };
  }, { POISON, SAYABLE });
  say("5 client: no envelope survives hcSayable", r.poison.every((v) => v === ""), JSON.stringify(r.poison));
  SAYABLE.forEach(([name, , want], i) => say(`6.${i + 1} client: ${name} is still said`, r.sayable[i] === want,
    `got ${JSON.stringify(r.sayable[i])}`));

  // THE LIVE COMPOSER: the bubble itself. Not the predicate — the function that writes the DOM.
  const live = await rig.page.evaluate((THE_STRING) => {
    const thread = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    if (!thread) return { err: "no thread" };
    const before = thread.querySelectorAll(".hc-msg").length;
    const el = window.hublyComposer.append ? window.hublyComposer.append("hubly", THE_STRING) : null;
    return {
      appended: !!el,
      grew: thread.querySelectorAll(".hc-msg").length - before,
      text: (thread.textContent || ""),
    };
  }, THE_STRING);
  if (!live.err) {
    say("7 the live composer renders no bubble for the envelope", live.appended === false && live.grew === 0,
      `appended=${live.appended} grew=${live.grew}`);
    say("8 the envelope is nowhere in the thread", !live.text.includes('"action"'), "thread text clean");
  }

  // THE REPLAY COMPOSER: a PERSISTED envelope, on reload. This is the one that would have kept
  // printing on Adrian's page for good.
  const replay = await rig.page.evaluate((THE_STRING) => {
    const out = window.hublyComposer.replay
      ? window.hublyComposer.replay([
          { role: "user", content: "add friday" },
          { role: "assistant", content: THE_STRING },
          { role: "assistant", content: '{"action":"reply","message":"Added it to Friday."}' },
          { role: "assistant", content: "And your Friday is set." },
        ])
      : null;
    return out;
  }, THE_STRING);
  if (replay) {
    say("9 the replay composer drops a persisted envelope", !replay.text.includes('"action"'),
      `rendered ${replay.n} of 4`);
    say("10 the replay composer still salvages and still says the real lines",
      replay.text.includes("Added it to Friday.") && replay.text.includes("And your Friday is set."),
      JSON.stringify(replay.text).slice(0, 160));
    say("11 a person's own JSON is never edited out of their message", replay.text.includes("add friday"));
  }

  // ── 4. AND SILENCE IS NOT THE PRICE ───────────────────────────────────────────────────
  // Refusing the envelope must hand the turn to the floor, not to nothing. A turn whose only
  // content was the envelope has to end with a true sentence about a turn that failed.
  const floor = await rig.page.evaluate((THE_STRING) => {
    const U = window.hublySilenceUI;
    if (!U) return null;
    const thread = document.getElementById("hcThreadBody") || document.getElementById("hcThread");
    const before = (thread && thread.textContent) || "";
    window.hublyComposer.append("hubly", THE_STRING);   // says nothing
    const spoke = U.ensure({ actions: [] });                                  // the floor must step in
    const after = ((thread && thread.textContent) || "").slice(before.length);
    return { spoke, after };
  }, THE_STRING);
  if (floor) {
    say("12 the turn still ends with a sentence (the floor speaks)", floor.spoke === true && floor.after.trim().length > 20,
      JSON.stringify(floor.after.trim()).slice(0, 140));
    say("13 and that sentence is not the envelope", !floor.after.includes('"action"'));
  }
} catch (e) {
  console.error("FAIL — " + String(e.message).slice(0, 240));
  failed++;
} finally {
  try { await rig.close(); } catch (_) {}
}

console.log(failed ? `\n${failed} assertion(s) failed.` : "\nHubly never says its own protocol — and never goes quiet instead.");
process.exit(failed ? 1 : 0);

/* ── RED-PROOF (2026-09-15) ──────────────────────────────────────────────────────────────
 * The defect was restored at each of the four ends in turn, and at the over-correction, and the
 * check went red every time. Which assertions fired:
 *
 *   END 1  hubly-conversation fallback back to `message: rawText`    -> FAIL 3 (hubly-conversation)
 *   END 2  chatbot-message fallback back to `reply: rawText`         -> FAIL 3 (chatbot-message)
 *   END 3  hcAppendMessage renders whatever it is handed             -> FAIL 7, 8, 13
 *   END 4  hcRenderTranscript replays the persisted envelope         -> FAIL 9
 *   OVER   sayableText returns "" for every envelope (no salvage)    -> FAIL 2.3, 2.4
 *
 * Leg 13 firing on END 3 is the one worth reading twice: with the composer unguarded, the
 * no-silence floor was reached and then the envelope was printed UNDER it. Guarding only the
 * server would have left that.
 *
 * And leg 0 exists because the first draft of legs 1-2 lived inside a deno fallback that node
 * never reached — they asserted nothing and printed nothing, and the check looked green.
 * ─────────────────────────────────────────────────────────────────────────────────────── */
