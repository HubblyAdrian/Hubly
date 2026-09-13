#!/usr/bin/env node
/**
 * THE SESSION BRIEF — what a person needs before touching anything.
 *
 *   npm run brief              # one screen
 *   npm run brief -- --walk <slug>   # also run the eight walk assertions live (slow)
 *
 * WHY THIS EXISTS. The facts we keep relearning were already written down — CHECKER_LESSONS.md,
 * OPEN_FINDINGS.md, DECISIONS.md, CLAUDE.md — in four files nobody opens at the start of work.
 * That is why the `supabase db push` ban lived in prose while a deploy script ran it, why the
 * 2026-08-20 gap list died inside a commit message, and why a photo rate was quoted off a
 * corpus that is ~96% our own test drafts. A document nobody opens is the failure; this is the
 * thing that gets run.
 *
 * IT REFUSES TO PRINT A CHEERFUL PARTIAL BRIEF. If a source is missing or the database is
 * unreachable, it says CANNOT RUN and exits 2 — the same rule every check here follows, for
 * the same reason: a brief that silently omits the corpus split is worse than no brief.
 *
 * Exit: 0 ok · 2 cannot run
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadKinds, splitOf } from "./lib/kind-split.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const walkSlug = (argv.includes("--walk") ? argv[argv.indexOf("--walk") + 1] : null);

const REQUIRED = ["docs/DECISIONS.md", "docs/OPEN_FINDINGS.md", "docs/CHECKER_LESSONS.md", "CLAUDE.md",
                  "scripts/decisions-open.mjs", "scripts/lib/kind-split.mjs"];
const missing = REQUIRED.filter((f) => !existsSync(join(ROOT, f)));
if (missing.length) { console.error("CANNOT RUN — missing: " + missing.join(", ")); process.exit(2); }

let kinds;
try { kinds = loadKinds(); }
catch (e) { console.error("CANNOT RUN — the corpus split is unavailable (" + String(e.message).slice(0, 90) + "). A brief without it is the defect this exists to prevent."); process.exit(2); }

const line = (s = "") => console.log(s);
const rule = (t) => { line(); line("─".repeat(78)); line(t); line("─".repeat(78)); };

line(`\nHUBLY SESSION BRIEF · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);

// ── 1. STANDING FACTS ──────────────────────────────────────────────────────────
rule("STANDING FACTS — the ones that keep costing us");
const counts = splitOf([...kinds.keys()], kinds);
const market = counts.market || 0, test = counts.test || 0, internal = counts.internal || 0;
let pageCount = "?";
try {
  const o = execFileSync("supabase", ["db", "query", "--linked",
    "select count(distinct business_id) as n from business_documents where rendered_html is not null"],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  pageCount = (/"n":\s*(\d+)/.exec(o) || [])[1] || "?";
} catch { /* the split below is the load-bearing number; this one is context */ }
line(`  THE CORPUS IS OUR OWN TEST DATA. ${kinds.size} businesses: market ${market} · internal ${internal} · test ${test}`);
line(`    of which ${pageCount} have a stored page — the denominator for any PAGE rate, and not the same number.`);
line(`    → market is ${Math.round(market / kinds.size * 100)}% of it. Any behavioural rate quoted off this corpus`);
line(`      describes our drafts, not users. Every script prints the split beside the rate (check-denominator-rule.mjs).`);
line();
line(`  TWO DEPLOY PATHS. Edge functions go live with \`supabase functions deploy\`.`);
line(`    Everything in public/ (hubly.html, platform-home.html) goes live ONLY by git push to Vercel.`);
line(`    Never call a client-side change live until it is pushed, and say which path each change took.`);
line();
line(`  \`supabase db push\` IS BANNED and enforced (scripts/check-no-db-push.mjs). Apply one migration`);
line(`    at a time: supabase db query --linked -f supabase/migrations/<file>.sql`);
line();
line(`  TWO SHELLS. public/platform-home.html is the builder + claimed shell (rail, rooms, canvas).`);
line(`    public/hubly.html is the public site host, the booking wizard and the editor. A bug in one`);
line(`    is usually present in the other — grep for the class before closing it.`);
line();
line(`  SLUG RESOLUTION. A page is served from <slug>.myhubly.app by hubly.html, which mounts the`);
line(`    stored document in a srcdoc iframe — so the frame has NO URL of its own and inherits the`);
line(`    parent's. Relative links (/?book=1) are correct forever; href="#x" needs the injected`);
line(`    fragment-scroll handler or it navigates the frame away.`);
line();
line(`  REFERENCE vs SCRATCH. evergreen-yard-care is the REFERENCE design (docs/SERVICES_BLOCK_SPEC.md)`);
line(`    and a working business — read it, do not break it. payson-chimney is the scratch draft.`);

// ── 2. THE OPEN COST OF EVERY CHOICE ───────────────────────────────────────────
rule("OPEN COST OF EVERY CHOICE — scripts/decisions-open.mjs");
try { line(execFileSync("node", [join(ROOT, "scripts/decisions-open.mjs")], { encoding: "utf8" }).trimEnd()); }
catch (e) { console.error("CANNOT RUN — decisions-open.mjs failed: " + String(e.message).slice(0, 120)); process.exit(2); }

// ── 3. WHAT LEADS EACH STAGE ───────────────────────────────────────────────────
rule("OPEN FINDINGS — what leads");
const findings = readFileSync(join(ROOT, "docs/OPEN_FINDINGS.md"), "utf8")
  .split("\n").filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^##\s+/, "").trim());
if (!findings.length) { console.error("CANNOT RUN — OPEN_FINDINGS.md has no headings"); process.exit(2); }
// WHAT LEADS, not file order: the entries that name a stage or a ruling come first, because
// those are the ones that decide what happens next. The rest are history and stay in the file.
const LEADS = /STAGE|TOP OF THE RECORD|RULED|BOUNDARY|LEADS WITH/i;
const leading = findings.filter((f) => LEADS.test(f));
if (!leading.length) line(`  (no entry names a stage — check docs/OPEN_FINDINGS.md by hand)`);
for (const f of leading) line(`  · ${f.slice(0, 104)}`);
line(`  ${findings.length} entries in total; the ${findings.length - leading.length} others are history.`);

// ── 4. HOW MUCH OF THE SUITE HAS EVER FAILED ───────────────────────────────────
rule("INSTRUMENTS — a check that has never failed is a check nobody knows works");
const checks = execFileSync("bash", ["-lc",
  `ls ${JSON.stringify(join(ROOT, "scripts"))}/check-*.mjs ${JSON.stringify(join(ROOT, "scripts/lib"))}/*.check.ts 2>/dev/null | wc -l`], { encoding: "utf8" }).trim();
const proofed = execFileSync("bash", ["-lc",
  `grep -lEi "red-proof|red proof|self-red" ${JSON.stringify(join(ROOT, "scripts"))}/check-*.mjs ${JSON.stringify(join(ROOT, "scripts/lib"))}/*.check.ts 2>/dev/null | wc -l`], { encoding: "utf8" }).trim();
line(`  ${checks} checks · ${proofed} mention a red-proof · ~${Number(checks) - Number(proofed)} have never been shown to fail`);
line(`  (a proxy: it counts the WORD, not a proof. Lesson 40 — every new check self-red-proofs.)`);

// ── 5. THE WALK ────────────────────────────────────────────────────────────────
rule("THE WALK");
if (walkSlug) {
  try { line(execFileSync("node", [join(ROOT, "scripts/check-walk-assertions.mjs"), walkSlug], { encoding: "utf8" }).trimEnd()); }
  catch (e) { line((e.stdout || "").trimEnd() || "  the gate failed to run: " + String(e.message).slice(0, 120)); }
} else {
  line(`  NOT MEASURED IN THIS BRIEF. Run it — it takes a few minutes and it is the only thing here`);
  line(`  that looks at the running product:   node scripts/check-walk-assertions.mjs <slug>`);
  line(`  Recorded 2026-09-13 (a MEMORY of a measurement, not a measurement):`);
  line(`    crestview-window-cleaning  5 green / 3 red — in-page links, "Your Business" on booking,`);
  line(`                               a claim-transition message swallowed`);
  line(`    ironwood-fence             7 green / 1 red — "Your Business" on booking`);
}
line();
