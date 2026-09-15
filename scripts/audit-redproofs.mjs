#!/usr/bin/env node
/**
 * RED-PROOF THE CHECKS WE HAVE RULED FROM.
 *
 *   node scripts/audit-redproofs.mjs            # every check in the ruled-from set
 *   node scripts/audit-redproofs.mjs --only=X   # one, by check name
 *   node scripts/audit-redproofs.mjs --list     # the set and why each gated a ruling
 *
 * A check's green is worth exactly what its red is worth. Every check listed below was the
 * evidence for a DECISION — a fix ruled done, a defect ruled absent, a number quoted to
 * Adrian. This breaks the thing each one asserts, in the real file, and requires the check to
 * SAY SO. A check that stays green under its own mutation was never measuring the property
 * it is named for, and every ruling that rested on it rests on nothing.
 *
 * WHY MUTATE THE REAL FILE AND NOT A COPY: failure #4 of check-computed-and-dropped was a
 * red-proof that pointed at a mutated copy while the check resolved paths against the repo,
 * so it parsed the real file twice and passed. Mutating in place removes that whole class.
 * The tree must be clean to start, and every file is restored from git in a finally — the
 * restore is verified, and a dirty tree after a run is reported as a failure of THIS script.
 *
 * Exit: 0 every check went red · 1 one or more stayed green · 2 cannot run
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";
const LIST = process.argv.includes("--list");
const TIER = (process.argv.find((a) => a.startsWith("--tier=")) || "").split("=")[1] || "";

/** Replace the first occurrence of `find` with `repl`; throw if the anchor is gone, because a
 *  mutation that silently no-ops produces a "stayed green" verdict about nothing. */
const swap = (find, repl) => (src) => {
  const i = src.indexOf(find);
  if (i < 0) throw new Error(`anchor not present: ${JSON.stringify(find.slice(0, 70))}`);
  return src.slice(0, i) + repl + src.slice(i + find.length);
};
const append = (text) => (src) => src + text;

/** THE MUTATION MUST BREAK CODE, NOT THE COMMENT THAT NAMES IT.
 *
 *  Four mutations in this file's first run hit a comment: the one pointing at
 *  refuseIfClassicSite, the two `p_owner_id:` mentions explaining the rule, the header line
 *  naming composeServicesTruth. Every one produced a "STAYED GREEN" verdict about a check that
 *  was fine. It also found a check making the SAME mistake in the other direction —
 *  check-destructive-confirm counted `// see refuseIfClassicSite()` as a call — so the rule is
 *  worth stating twice: a comment that mentions a symbol is not that symbol. */
/** Every occurrence in code — a store read twice in one query is not un-read by fixing one. */
const swapAllInCode = (find, repl) => (src) => {
  let out = src, guard = 0, n = 0;
  // Stops when no CODE occurrence is left — not when no occurrence is left. A marker that also
  // appears in a comment would otherwise loop until swapInCode threw, and report a mutation
  // failure about a mutation that had already worked.
  for (;;) {
    let next;
    try { next = swapInCode(find, repl)(out); } catch { break; }
    out = next; n++;
    if (guard++ > 200) break;
  }
  if (!n) throw new Error(`anchor not present in CODE: ${JSON.stringify(find.slice(0, 60))}`);
  return out;
};

const swapInCode = (find, repl) => (src) => {
  const masked = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
                    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => " ".repeat(m.length))
                    .replace(/^--[^\n]*/gm, (m) => " ".repeat(m.length));   // SQL comments: the fifth one I hit
  const i = masked.indexOf(find);
  if (i < 0) throw new Error(`anchor not present in CODE (only in comments, if at all): ${JSON.stringify(find.slice(0, 60))}`);
  return src.slice(0, i) + repl + src.slice(i + find.length);
};

const SET = [
  // ── source-only, fast ──────────────────────────────────────────────────────
  { check: "check-no-duplicate-ids", tier: "fast",
    ruled: "the dead-nav fix at source — that stripPreviewCloneIds actually removes the id",
    file: "public/hubly.html",
    mutate: swap('<body', '<div id="hc-redproof-dup"></div><div id="hc-redproof-dup"></div><body') },

  { check: "check-one-ask-not-a-list", tier: "fast",
    ruled: "one ask at a time — that the tiered gap ask says exactly one thing",
    file: "public/platform-home.html",
    mutate: append(`\n<script>function hcRedproofBullets(){ hcAppendMessage('hubly', '• ' + n.text); }</script>\n`) },

  { check: "check-one-voluntary-addition", tier: "fast",
    ruled: "the repeating-message gate — one voluntary addition per turn",
    file: "public/platform-home.html",
    mutate: (src) => {
      const m = /function hcMayAddVoluntary\s*\([^)]*\)\s*\{/.exec(src);
      if (!m) throw new Error("hcMayAddVoluntary not found");
      return src.slice(0, m.index + m[0].length) + " return true; " + src.slice(m.index + m[0].length);
    } },

  { check: "check-chain-acknowledgement", tier: "fast", leg: "the hollow acknowledgement",
    ruled: "the chain — an acknowledgement names something that actually changed, or is not said",
    file: "public/platform-home.html",
    // THE RED-PROOF IS THE NO-CHANGE TURN. Praise costs nothing to emit and reads well in a
    // demo; this is the version that emits it with nothing behind it.
    mutate: swapInCode("    if(!ack && !ask) return '';",
                       "    if(!ack) ack = 'Great work!';\n    if(!ack && !ask) return '';") },

  { check: "check-doors-offered-exist", tier: "fast", leg: "offering a door that is not there",
    ruled: "the door count must be non-lying at the point of speech, not only in a document",
    file: "public/platform-home.html",
    // The sentence that reads best and is not true: hours has no show door until the anchor
    // pass lands, so pointing at it would move 96% of pages to nothing.
    mutate: swapInCode('say:"What hours are you open?"',
                       'say:"What hours are you open? I can show you where they go."') },

  { check: "check-unreadiness-is-not-absence", tier: "fast", leg: "the case that bit him",
    ruled: "an unreadiness may not be said as a fact about the owner's page",
    file: "public/platform-home.html",
    // The walk, exactly: the canvas could not look, and the reply asserted absence.
    mutate: swapInCode("      could_not_look: 'I could not get a look at your page just then — try me again in a moment.'",
                       "      could_not_look: 'There is no services area on your page yet.'") },

  { check: "check-one-voluntary-addition", tier: "fast", leg: "the late speaker",
    ruled: "one voluntary addition per turn, held across the whole turn",
    file: "public/platform-home.html",
    // Put the counter back inside the moment: a turn-scoped reset before every check makes
    // the gate green again for a composer that arrives late.
    // The anchor carries no trailing comment on purpose: swapInCode masks comments to find
    // code, so an anchor that includes one can never match. Fourth comment-shaped mistake
    // today, and the first one the tooling caught before I did.
    mutate: swapInCode("if(hcTurn.voluntary > 0) return false;",
                       "hcTurn.voluntary = 0;") },

  { check: "check-denominator-rule", tier: "fast",
    ruled: "every rate quoted this week — that it carries its market/internal/test split",
    file: "scripts/__redproof_rate.mjs", create: true,
    // IN SCOPE MEANS READS THE CORPUS. The first fixture printed a bare rate and this check
    // stayed green, correctly: it only scans scripts that touch the business corpus, so a file
    // mentioning neither `businesses` nor account_kind is none of its business. The fixture now
    // reads the corpus, which is what makes its rate a corpus rate.
    mutate: () => `// a corpus rate with no denominator, exactly the 2026-09-13 shape\n` +
      `const rows = sql("select slug, account_kind from businesses");\n` +
      `console.log(\`pages with a photo: \${(hit / total * 100).toFixed(0)}%\`);\n` },

  { check: "check-paginated-aggregate", tier: "fast",
    ruled: "every aggregate printed off the admin connection",
    file: "public/platform-home.html",
    // MY FIRST MUTATION WAS OUT OF SCOPE, not a blind spot: it summed a `.from().select()`,
    // and this check is deliberately scoped to the three PAGINATED rpc readers so it stays a
    // check rather than a repo-wide "someone summed an array" scanner. The mutation has to
    // speak the language the rule is written in.
    mutate: append(`\n<script>async function hcRedproofAgg(){ var r = await sb.rpc('get_business_customers', {}); var rows = (r && r.data) || []; return rows.reduce(function(a,b){ return a + (b.spend || 0); }, 0); }</script>\n`) },

  { check: "check-no-directives-to-owners", tier: "fast",
    ruled: "Hubly never points at a control it cannot see",
    file: "supabase/functions/_shared/hubly_owner_replies.ts",
    // A DOUBLE-QUOTED STRING WAS THE WRONG MUTATION: both phrase nets tokenise on backticks,
    // which is how the module actually writes owner sentences. The first attempt stayed green
    // and the check was not at fault — but the run did surface a real gap, because "never
    // points at a control it cannot see" had no check anywhere until it was added (net 3).
    mutate: append("\nexport function redproofPointsAtAControl(): string {\n  return `Your page is ready. Click the Publish button in the top right to put it live.`;\n}\n") },

  { check: "check-destructive-confirm", tier: "fast",
    ruled: "the destructive-action shape — a live page is never replaced unasked",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    // The gate is refuseIfClassicSite(); I guessed a name and the harness threw rather than
    // reporting a verdict, which is the behaviour I want from a missing anchor.
    // Twice wrong before it was right, and both mistakes are the reason this comment exists:
    // first I guessed the gate's name (it is refuseIfClassicSite), then I mutated its SECOND
    // mention — which is a comment that points at it. A mutation has to break the CALL.
    mutate: swap("const classicBlock = await refuseIfClassicSite(draftId);",
                 "const classicBlock = await refuseIfClassicSite_REDPROOF(draftId);") },

  { check: "check-owner-id-invariant", tier: "fast",
    ruled: "the claimed-owner write audit — a writer without p_owner_id is dead on a claimed site",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    // The first two `p_owner_id:` in the file are a comment and an error message about the
    // rule. Mutating those left every real payload intact — the same mistake as mutating the
    // comment that points at refuseIfClassicSite. This breaks a payload.
    mutate: swap("p_owner_id: ownerUid || null,", "p_owner_id_REDPROOF: ownerUid || null,") },

  { check: "check-owner-id-invariant", tier: "fast", leg: "derivation",
    ruled: "that the injection list is DERIVED — the hand-written list dropped an entry three times",
    file: "supabase/functions/hubly-conversation/index.ts",
    mutate: swapInCode("const DRAFT_INJECTED_ACTIONS = deriveDraftInjectedActions();",
                       'const DRAFT_INJECTED_ACTIONS = new Set(["places.add", "business.setHours"]);') },

  { check: "check-owner-id-invariant", tier: "fast", leg: "escape hatch",
    ruled: "that NEVER_INJECTED cannot hide a handler that reads the owner",
    file: "supabase/functions/hubly-conversation/index.ts",
    mutate: swapInCode('"business.startDraft": "creates the draft;',
                       '"business.setHours": "redproof — an owner reader hidden behind the escape hatch",\n  "business.startDraft": "creates the draft;') },

  { check: "check-computed-and-dropped", tier: "fast",
    ruled: "the computed-and-dropped audit — a value measured and never returned",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    // OUT OF SCOPE THE FIRST TIME, not a blind spot: leg 1 is scoped to objects named
    // …Counts/Results/Totals/Stats in public/, and leg 2 to functions that await a PLACER.
    // A bare `const verifiedPlaced = …` in a new function is neither. The mutation now takes
    // the shape the rule is about — a function that holds a placement and drops it.
    mutate: append(`\nexport async function redproofDropsThePlacement(args: any) {\n  const placement = await applyServicesToFreeform(args);\n  return { ok: true, summary: placement.status === "placed" ? "Added them to your page." : "Saved." };\n}\n`) },

  { check: "check-facts-are-grounded", tier: "fast", leg: "the library refuses a lift",
    ruled: "never publish a fact the owner did not state — the 801-888-8888 scar",
    file: "supabase/functions/_shared/hubly_grounding.ts",
    // Make the phone check accept anything with ten digits anywhere, which is what a
    // well-meaning "it was too strict" edit looks like.
    mutate: swapInCode("return messageDigits(message).includes(key);",
                       "return messageDigits(message).length >= 10;") },

  { check: "check-facts-are-grounded", tier: "fast", leg: "a writer stops calling it",
    ruled: "that every owner-fact writer grounds its values",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: swapInCode("const rec = reconcileServices(services, existing, userMessage);",
                       "const rec = { allowed: services, droppedLift: [] as string[], changed: true };") },

  { check: "check-facts-are-grounded", tier: "fast", leg: "the silently short list",
    ruled: "a services write may not delete what the owner never asked to remove",
    file: "supabase/functions/_shared/hubly_grounding.ts",
    // THE SHAPE THAT MATTERS: not an empty list — a short one. This restores the old
    // behaviour exactly (walk only the model's list) while keeping the new fields, which is
    // what a red-proof must do: keep the new code and bring back the old defect.
    mutate: swapInCode("    if (sentKeys.has(key)) continue;",
                       "    if (sentKeys.has(key)) continue;\n    if (!sentKeys.has(key)) continue;   // redproof: the omission walks off the end again") },

  { check: "check-job-card-opens", tier: "slow", leg: "the click lands and nothing opens",
    ruled: "floor (c) of the job paste — pressing a job in the conversation opens it",
    file: "public/platform-home.html",
    // The card still renders and the click still LANDS; only the door is gone. If the witness
    // were the proof, this would stay green — which is the distinction the check exists to make.
    mutate: swapInCode("card.addEventListener('click', function(){ hcJobPanel(j); });",
                       "/* redproof: the door removed, the card left */") },

  { check: "check-day-add-by-hand", tier: "slow", leg: "a write nobody read back",
    ruled: "My Day floor (a) — only a write that read back from the table may say it is on the day",
    file: "public/platform-home.html",
    // The writer's own word, taken as the record. This is the shape prohibition 3 exists for.
    mutate: swapInCode("if(res.error === 'not_readable_back') return \"I saved that but could not read it back, so I am not going to tell you it is on your day.\";",
                       "if(res.error === 'not_readable_back') return 'Added to your day.';") },

  { check: "check-classic-claim", tier: "slow",
    ruled: "the two-store split, classic side — the sentence may not outlive the inability",
    file: "supabase/functions/_shared/hubly_owner_replies.ts",
    // Leg 3 is the one worth breaking: the sentence, not the plumbing. This puts the
    // inability back into the branch — the exact sentence that was true for four hours.
    mutate: swapInCode("on your site now", "saved, but not on your site yet") },

  { check: "check-two-store-readers", tier: "slow",
    ruled: "the services reader reads both stores",
    file: "supabase/migrations/20260914080000_services_reader_both_stores.sql",
    // The classic store's marker is `service_catalog`; breaking it makes the reader a
    // one-store reader again, which is the defect this check exists for.
    // A SUFFIXED NAME STILL MATCHED: the store's marker is the substring /service_catalog/, so
    // `service_catalog_REDPROOF` satisfied it. The mutation renames the key outright. The
    // marker's looseness is recorded in the audit — it proves the TEXT appears in the ledger,
    // never that the column exists.
    mutate: swapAllInCode("->'service_catalog'", "->'catalogue_of_services'") },

  { check: "check-registry-knows-every-door", tier: "slow",
    ruled: "the door measurement — 212 capabilities, 8 talk, 20 diy, 3 both",
    file: "supabase/functions/hubly-conversation/index.ts",
    // The rule is "every body.<x> branch is either a registry action or declared not-for-model".
    // The mutation is therefore a NEW DOOR nobody declared — which is what all six of the
    // capabilities measured on 2026-09-14 were.
    mutate: append(`\n// redproof: an undeclared door\nif (body.redproofUndeclaredDoor) { await doSomethingDestructive(body.redproofUndeclaredDoor); }\n`) },

  { check: "check-registry-knows-every-door", tier: "slow", leg: "declared doors are real",
    ruled: "services' and hours' doors — a declared door that is gone is a claimed capability",
    file: "public/hubly.html",
    // ALL of them: the tile's marker appears seven times in that file (two renderers, a
    // selector list, a click delegate), and renaming one leaves the door standing.
    mutate: swapAllInCode('data-pe="add-service"', 'data-pe="add-service-renamed"') },

  { check: "check-draft-capable-writers", tier: "slow",
    ruled: "which writers work on an unclaimed draft",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    mutate: (src) => {
      // The handler is an object property `name: "setHours"`, not a switch case — the same
      // shape blindness that made check-computed-and-dropped see one function where there
      // were two. Refuse before the writer is asked: the 2026-09-08 defect, verbatim.
      const at = src.indexOf('name: "setHours"');
      if (at < 0) throw new Error("the setHours action was not found in the registry");
      const h = src.indexOf("handler:", at);
      const brace = src.indexOf("{", h);
      if (h < 0 || brace < 0) throw new Error("setHours has no handler body");
      return src.slice(0, brace + 1) +
        `\n          if (!ownerUid) return { ok: false, error: "not_signed_in" } as any;\n` +
        src.slice(brace + 1);
    } },

  { check: "check-capability-reachable", tier: "slow",
    ruled: "reachability — a capability the model can name and the router cannot run",
    file: "supabase/functions/_shared/hubly_capability_registry.ts",
    // An ORPHAN: a capability the registry declares and no context allowlist advertises —
    // the model can name it and the router will refuse it.
    // THE UNIT IS THE CAPABILITY GROUP, not the action: `declared` collects objects that have
    // both `name` and `actions`, so renaming an ACTION is invisible to it and my first mutation
    // proved nothing. Renaming the group makes it an orphan in the registry and a ghost in the
    // allowlist at once — both halves of what this check asserts.
    mutate: swapInCode('name: "website",', 'name: "website_redproof",') },

  { check: "check-browser-rig", tier: "slow",
    ruled: "every browser measurement this week ran through it",
    file: "scripts/lib/browser-rig.mjs",
    // Make every click report that it landed. Assertion 2c — "a covered control does not
    // report a landed click" — is what must catch it.
    // THE FIRST MUTATION HERE FOUND A REAL GAP AND IS RECORDED RATHER THAN KEPT: making
    // `landed` always 1 left every assertion green, because assertion 2c (a covered control)
    // is satisfied by Playwright's own actionability error before the rig's witness is ever
    // read. The witness counter has no assertion of its own. What IS asserted is the settle
    // loop, so that is what this breaks: return the first read, at t=0, with no stability
    // window — the exact behaviour Lesson 69 was written about.
    mutate: swapInCode("const v = await page.evaluate(readFn).catch(() => null);",
                       "const v = await page.evaluate(readFn).catch(() => null);\n      return { final: v, ms: 0, trace, label, stableMs };") },
];

if (LIST) {
  for (const s of SET) console.log(`${s.check.padEnd(34)} ${s.tier.padEnd(5)} ${s.ruled}`);
  console.log(`\n${SET.length} checks in the ruled-from set.`);
  process.exit(0);
}

// ── the tree must be clean, or the restore cannot be trusted ──────────────────
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();
if (dirty) { console.error("CANNOT RUN — working tree is dirty; the restore would not be trustworthy:\n" + dirty); process.exit(2); }

function runCheck(name) {
  const r = spawnSync("node", [`scripts/${name}.mjs`], { cwd: ROOT, encoding: "utf8", timeout: 600000 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const rows = [];
for (const s of SET) {
  if (ONLY && s.check !== ONLY) continue;
  if (TIER && s.tier !== TIER) continue;
  const path = resolve(ROOT, s.file);
  let before = null;
  try {
    // 1. green first — a check already red proves nothing about the mutation
    const green = runCheck(s.check);
    if (green.code === 2) { rows.push({ ...s, verdict: "CANNOT RUN", note: green.out.trim().split("\n")[0].slice(0, 90) }); continue; }
    if (green.code !== 0) { rows.push({ ...s, verdict: "ALREADY RED", note: "this check does not currently pass; red-proof is meaningless until it does" }); continue; }

    // 2. break the thing it asserts
    if (s.create) { writeFileSync(path, s.mutate("")); }
    else { before = readFileSync(path, "utf8"); writeFileSync(path, s.mutate(before)); }

    // 3. it must say so
    const red = runCheck(s.check);
    rows.push({
      ...s,
      verdict: red.code === 1 ? "RED-PROVED" : red.code === 2 ? "CANNOT RUN UNDER MUTATION" : "STAYED GREEN",
      note: red.code === 1 ? (red.out.split("\n").find((l) => /FAIL/.test(l)) || "").trim().slice(0, 100)
                           : red.out.trim().split("\n").slice(-1)[0].slice(0, 100),
    });
  } catch (e) {
    rows.push({ ...s, verdict: "MUTATION FAILED", note: String(e.message).slice(0, 100) });
  } finally {
    if (s.create) { if (existsSync(path)) unlinkSync(path); }
    else if (before !== null) writeFileSync(path, before);
  }
}

const after = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim();

const W = { "RED-PROVED": "✅", "STAYED GREEN": "❌", "ALREADY RED": "⚠️ ", "CANNOT RUN": "⚠️ ", "MUTATION FAILED": "⚠️ ", "CANNOT RUN UNDER MUTATION": "⚠️ " };
console.log();
for (const r of rows) {
  console.log(`${W[r.verdict] || "  "} ${(r.check + (r.leg ? ` (${r.leg})` : "")).padEnd(34)} ${r.verdict}`);
  console.log(`   gated: ${r.ruled}`);
  if (r.note) console.log(`   ${r.note}`);
}
const bad = rows.filter((r) => r.verdict !== "RED-PROVED");
// not-a-corpus-rate: counts checks in this audit, not businesses
console.log(`\nchecks red-proofed: ${rows.filter((r) => r.verdict === "RED-PROVED").length} of ${rows.length}`);
if (after) { console.log(`\nTREE NOT RESTORED — this script failed, regardless of the verdicts above:\n${after}`); process.exit(1); }
console.log("tree restored clean.");
if (bad.length) { console.log(`\n${bad.length} check(s) did not go red under their own mutation. Every ruling that rested on them rests on nothing until this is resolved.`); process.exit(1); }
process.exit(0);
