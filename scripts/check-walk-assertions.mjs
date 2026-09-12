#!/usr/bin/env node
/**
 * THE GATE. Eight assertions about what a real walk leaves behind.
 *
 * WHY IT EXISTS. On 2026-09-12 Adrian walked crestview-window-cleaning through claim and
 * found seven defects by clicking. 432 tests passed while a live page's Book button sent
 * customers to a dead address. Not one check was watching the happy path a person actually
 * takes, so this checks that path and nothing else.
 *
 * IT IS BUILT TO GO RED FIRST (Lesson 9). Every assertion below was written against a
 * failure that had already shipped, and each one is expected to fail on
 * crestview-window-cleaning as it stands. A check that has never failed is a check nobody
 * knows works.
 *
 *   node scripts/check-walk-assertions.mjs <slug>        # default: crestview-window-cleaning
 *
 * It reads the stored bytes and the transcript from the database, and renders the public
 * surfaces through the real mount path (scripts/lib/mount-as-product.mjs, Lesson 37).
 * It creates nothing and writes nothing.
 *
 * Exit: 0 all green · 1 one or more red · 2 cannot run (never reported as either)
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mountAndEvaluate } from "./lib/mount-as-product.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = process.argv[2] || "crestview-window-cleaning";
const require_ = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require_("playwright")); }
catch (e) { console.error("CANNOT RUN — playwright not loadable: " + e.message); process.exit(2); }

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows":');
  if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

// ── THE SUBJECT ───────────────────────────────────────────────────────────────
let biz, page, convo, services;
try {
  [biz] = sql(`select b.id, b.slug, b.name, b.account_kind, (b.owner_id is not null) as claimed
               from businesses b where b.slug = '${SLUG}'`);
  if (!biz) { console.error(`CANNOT RUN — no business with slug ${SLUG}`); process.exit(2); }
  [page] = sql(`select d.version, d.rendered_html as html from business_documents d
                join businesses b on b.id = d.business_id
                where b.slug = '${SLUG}' and d.rendered_html is not null
                order by d.version desc limit 1`);
  convo = sql(`select c.seq, c.role, c.content::text as content from business_conversations c
               join businesses b on b.id = c.business_id where b.slug = '${SLUG}' order by c.seq`);
  services = sql(`select s.name, s.price from services s join businesses b on b.id = s.business_id
                  where b.slug = '${SLUG}' order by s.name`);
} catch (e) { console.error("CANNOT RUN — database unreachable: " + String(e.message).slice(0, 160)); process.exit(2); }
if (!page) { console.error(`CANNOT RUN — ${SLUG} has no stored document`); process.exit(2); }

const html = page.html;
const results = [];
const record = (n, name, ok, detail) => { results.push({ n, name, ok, detail }); };

// ── 1. EVERY IN-PAGE ANCHOR RESOLVES ──────────────────────────────────────────
{
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/gi)].map((m) => m[1]));
  const hrefs = [...new Set([...html.matchAll(/href="#([^"]+)"/gi)].map((m) => m[1]))].filter((h) => h && h !== "top");
  const dead = hrefs.filter((h) => !ids.has(h));
  record(1, "every in-page href=\"#…\" resolves to an element that exists", dead.length === 0,
    dead.length ? `dead: ${dead.join(", ")} (of ${hrefs.length} anchor links)` : `${hrefs.length} anchor link(s), all resolve`);
}

// ── 2. EVERY myhubly.app LINK IS THIS BUSINESS'S OWN ADDRESS ──────────────────
{
  const links = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9-]+)\.myhubly\.app/gi)].map((m) => m[1].toLowerCase()))];
  const foreign = links.filter((s) => s !== biz.slug);
  record(2, "every *.myhubly.app link matches this business's current slug", foreign.length === 0,
    foreign.length ? `points at: ${foreign.join(", ")} — this business is ${biz.slug}` : `${links.length} self-link(s), all current`);
}

// ── 3. REQUESTED SERVICES APPEAR BY NAME AND BY PRICE ─────────────────────────
{
  // The visible text only — a price that appears in a hex colour or a padding value is
  // not a price on the page. This is the check the production verification skipped.
  const visible = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&");
  const missing = [];
  for (const s of services) {
    const nameIn = visible.includes(s.name);
    const price = s.price == null ? null : (Number.isInteger(Number(s.price)) ? `$${Number(s.price)}` : `$${Number(s.price).toFixed(2)}`);
    const priceIn = price == null ? true : visible.includes(price);
    if (!nameIn || !priceIn) missing.push(`${s.name}${price ? " " + price : ""} — name ${nameIn ? "on page" : "MISSING"}, price ${price ? (priceIn ? "on page" : "MISSING") : "n/a"}`);
  }
  record(3, "services on the record appear in the rendered bytes, by name and price", services.length > 0 && missing.length === 0,
    services.length === 0 ? "no services on record — nothing to assert" : (missing.length ? missing.join(" | ") : `${services.length} service(s), names and prices all present`));
}

// ── 7. A MESSAGE SENT DURING THE CLAIM TRANSITION IS ANSWERED ─────────────────
// (Run before the browser section so the cheap checks report even if a render fails.)
{
  const turns = convo.map((c) => ({ ...c, text: String(c.content).replace(/^"|"$/g, "") }));
  const unanswered = [];
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role !== "user") continue;
    const next = turns[i + 1];
    // A user turn is answered if the next turn is an assistant turn that is ABOUT it.
    // The claim welcome is not an answer to anything: it is emitted by the shell change.
    const isWelcome = next && /you're in — this is your site|is live\. .* is a real address/i.test(next.text);
    if (!next || next.role !== "assistant" || isWelcome) {
      unanswered.push(`seq ${turns[i].seq}: "${turns[i].text.slice(0, 70)}" → ${next ? (isWelcome ? "the post-claim welcome, not an answer" : "another user turn") : "nothing"}`);
    }
  }
  record(7, "a message sent during the claim transition is answered", unanswered.length === 0,
    unanswered.length ? unanswered.join(" | ") : `${turns.filter((t) => t.role === "user").length} owner message(s), all answered`);
}

// ── 8. THE TWO SHELLS AGREE ON BRAND ──────────────────────────────────────────
{
  const { readFileSync } = await import("node:fs");
  const home = readFileSync(join(ROOT, "public/platform-home.html"), "utf8");
  const app = readFileSync(join(ROOT, "public/hubly.html"), "utf8");
  const tok = (src, name) => {
    const m = new RegExp(`--${name}\\s*:\\s*([^;}]+)`).exec(src);
    return m ? m[1].trim() : "(undefined)";
  };
  const diffs = [];
  for (const t of ["brand", "font"]) {
    const a = tok(home, t), b = tok(app, t);
    if (a !== b) diffs.push(`--${t}: platform-home ${a} vs hubly ${b}`);
  }
  // A token referenced with a fallback but never defined renders the fallback — which is
  // how the claimed rail became dark green with a yellow wordmark.
  for (const v of ["sidebar", "brand-400"]) {
    const usedIn = /var\(--/.test(home) && new RegExp(`var\\(--${v}\\s*,`).test(home);
    const defined = new RegExp(`--${v}\\s*:`).test(home) || new RegExp(`--${v}\\s*:`).test(app);
    if (usedIn && !defined) diffs.push(`--${v} is used with a fallback in platform-home.html and defined NOWHERE — the fallback is what renders`);
  }
  record(8, "the post-claim shell's brand tokens match the builder shell's", diffs.length === 0,
    diffs.length ? diffs.join(" | ") : "brand and font tokens identical, no undefined tokens in use");
}

// ── BROWSER SECTION: 4, 5, 6 ──────────────────────────────────────────────────
/** Copy that must never render on a surface a customer can see. */
const OWNER_DIRECTED = [
  "Add services to show them here",
  "Agrega servicios para mostrarlos aquí",
];
const PLACEHOLDER = [
  "Your Business",
  "clear packages, easy booking",
  "Professional business",
  "Use this row for",
];

const browser = await chromium.launch();
try {
  // 4 + 5: the stored page itself, mounted the way the product mounts it.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const { frame } = await mountAndEvaluate(ctx, html, () => document.body.innerText.slice(0, 200000));
  const pageText = await frame.evaluate(() => document.body.innerText);
  const ownerHits = OWNER_DIRECTED.filter((s) => pageText.includes(s));
  const placeholderHits = PLACEHOLDER.filter((s) => pageText.includes(s));
  await ctx.close();

  // 6: follow the page's own Book link and see whose record loads.
  const bookHref = (/href="(https?:\/\/[^"]*\?book=1[^"]*)"/i.exec(html) || [])[1] || null;
  let bookDetail = "no ?book=1 link on the page", bookOk = false;
  let bookOwnerHits = [], bookPlaceholderHits = [];
  if (bookHref) {
    const bctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const bp = await bctx.newPage();
    try {
      await bp.goto(bookHref, { waitUntil: "networkidle", timeout: 45000 });
      await bp.waitForTimeout(3500);
      const seen = await bp.evaluate(() => ({
        text: document.body.innerText,
        name: (document.getElementById("bkland-name") || {}).textContent || "",
        logo: (document.getElementById("bkland-logo") || {}).textContent || "",
      }));
      bookOk = seen.name.trim() === String(biz.name).trim();
      bookDetail = `${bookHref} → booking page shows name "${seen.name.trim() || "(empty)"}", monogram "${seen.logo.trim()}" — this business is "${biz.name}"`;
      bookOwnerHits = OWNER_DIRECTED.filter((s) => seen.text.includes(s));
      bookPlaceholderHits = PLACEHOLDER.filter((s) => seen.text.includes(s));
    } catch (e) { bookDetail = `${bookHref} → could not load: ${String(e.message).slice(0, 80)}`; }
    await bctx.close();
  }

  record(4, "no owner-directed instructional copy renders on a public surface",
    ownerHits.length === 0 && bookOwnerHits.length === 0,
    [...ownerHits.map((s) => `page: "${s}"`), ...bookOwnerHits.map((s) => `booking page: "${s}"`)].join(" | ") || "none found on the page or the booking flow");
  record(5, "no placeholder or generic-business copy renders on a public surface",
    placeholderHits.length === 0 && bookPlaceholderHits.length === 0,
    [...placeholderHits.map((s) => `page: "${s}"`), ...bookPlaceholderHits.map((s) => `booking page: "${s}"`)].join(" | ") || "none found on the page or the booking flow");
  record(6, "the booking flow reached from the page loads this business's own record", bookOk, bookDetail);
} finally {
  await browser.close();
}

// ── REPORT ────────────────────────────────────────────────────────────────────
results.sort((a, b) => a.n - b.n);
console.log(`\nWALK ASSERTIONS — ${biz.name} (${biz.slug}, ${biz.account_kind}, ${biz.claimed ? "claimed" : "unclaimed"}), document v${page.version}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "GREEN" : "RED  "}  ${r.n}. ${r.name}`);
  console.log(`         ${r.detail}`);
}
const red = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - red.length} green, ${red.length} red.`);
process.exit(red.length ? 1 : 0);
