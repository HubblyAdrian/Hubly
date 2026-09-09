#!/usr/bin/env node
/**
 * A BUSINESS NAME IS EXTRACTED OR ASKED FOR. IT IS NEVER CONSTRUCTED.
 *
 * WHY THIS EXISTS, AND WHY IT DRIVES THE LIVE ENDPOINT.
 *
 * On 2026-09-09 Adrian typed "I do mobile detailing in los angeles" at the signup path.
 * Hubly did not ask what the business was called. It named the business "Mobile
 * Detailing in Los Angeles" — a description of a job — and minted
 * mobile-detailing-in-los-angeles.myhubly.app from it, permanently.
 *
 * That shipped because the fix was two deleted prompt lines and `deploy exit=0`. A
 * deleted line and an exit code are not evidence that a MODEL behaves differently. That
 * is Lesson 9 — testing a copy instead of the thing — inside the fix for a bug the same
 * lesson already describes.
 *
 * So this sends real messages at the deployed function and reads what comes back, and
 * what lands in the database.
 *
 * IT TESTS BOTH SIDES, because a rule with one side tested is how the first fix failed:
 *
 *   ASK    — "I do mobile detailing in los angeles"  -> must ask; no row with a
 *            constructed name; no slug minted from one.
 *   EXTRACT— "I run Ridgeline Detail, mobile detailing in LA" -> must NOT ask; the
 *            business is named Ridgeline Detail; the slug follows it.
 *
 * Testing only the first turns the fix into "always ask", which breaks the person who
 * told us their name in their first sentence.
 *
 * IT WRITES REAL ROWS. Everything it creates is deleted at the end and reported if the
 * cleanup fails — a check that litters the corpus is a check nobody will run.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN (never reported as either)
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPA_URL = "https://rtwxxkxpkqdrhclkozma.supabase.co";
const FN = `${SUPA_URL}/functions/v1/hubly-conversation`;

let KEY;
try {
  const src = readFileSync(join(ROOT, "public/journey-os/hubly-public-key.js"), "utf8");
  KEY = /HUBLY_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/.exec(src)?.[1];
} catch (e) { console.error("CANNOT RUN — could not read the publishable key: " + e.message); process.exit(2); }
if (!KEY) { console.error("CANNOT RUN — no publishable key found"); process.exit(2); }

/** Admin read, through the CLI — the same path every other check here uses. */
function sql(q) {
  try {
    const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT });
    const i = out.indexOf('"rows":');
    if (i < 0) return [];
    let d = 0, st = out.indexOf("[", i), en = -1;
    for (let k = st; k < out.length; k++) {
      if (out[k] === "[") d++;
      else if (out[k] === "]") { d--; if (d === 0) { en = k + 1; break; } }
    }
    return JSON.parse(out.slice(st, en));
  } catch (e) { throw new Error("db query failed: " + String(e.message).slice(0, 160)); }
}

async function say(text) {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: KEY, authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ messages: [{ role: "user", content: text }], understanding: {}, draftBusiness: null }),
  });
  // Read the body even on a non-2xx: the server puts its upstream distinction in
  // `detail`, and that is the difference between "the product is broken" and "nothing
  // ran". Throwing on the status alone discards it and manufactures a false red.
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || (body && body.ok === false)) {
    const d = String((body && (body.detail || body.error)) || `endpoint ${res.status}`);
    const e = new Error(d);
    e.cannotRun = true;
    throw e;
  }
  return body;
}

// A model/provider outage is never a product FAIL. Any call that comes back with the
// server's own failure envelope ends the run at exit 2, wherever it happens — the health
// probe passes on messages the server answers without the model, so this has to be live
// for every case too, not just the probe.
function bailIfCannotRun(e) {
  if (e && e.cannotRun) {
    console.error(`CANNOT RUN — the conversation endpoint is up but not answering: ${e.message}`);
    process.exit(2);
  }
}

const ASKS_FOR_NAME = /what(?:'s| is| do you| are you)?[^.?!]{0,40}\b(call(?:ed)?|name)\b|name (?:of|for) (?:the|your) business|what.{0,15}\bcalled\b/i;
const started = new Date(Date.now() - 5000).toISOString();
const fails = [];
const created = [];

async function run() {
  let health;
  try { health = await say("hello"); }
  catch (e) { bailIfCannotRun(e); console.error("CANNOT RUN — the conversation endpoint is unreachable: " + e.message); process.exit(2); }
  if (!health || typeof health !== "object") { console.error("CANNOT RUN — endpoint returned no JSON"); process.exit(2); }
  // THE MODEL BEING UNAVAILABLE IS NOT A PRODUCT FAILURE. On 2026-09-09 the OpenAI
  // account ran out of quota mid-session and every case here went red — a false red that
  // says "the name rule is broken" when the real answer is "nothing ran". Same rule the
  // key/reachability guards above follow: a check that cannot run reports cannot run.
  // `detail` is the server's own upstream distinction, the same field platform-home.html
  // reads to decide whether retrying could possibly help.
  if (health.ok === false) {
    const d = String(health.detail || health.error || "upstream refused the request");
    console.error(`CANNOT RUN — the conversation endpoint is up but not answering: ${d}`);
    process.exit(2);
  }

  const CASES = [
    { id: "ASK", say: "I do mobile detailing in los angeles", mustAsk: true, banned: /mobile detailing in los angeles|detailing (business|company|services)/i },
    { id: "EXTRACT", say: "I run Ridgeline Detail, mobile detailing in LA", mustAsk: false, expectName: /ridgeline detail/i },
    // THE AWKWARD MIDDLE, and it is extraction: they said the word, Hubly reads it.
    // Nothing is assembled. Asserted rather than reported, because an untested side of
    // a rule is exactly how this failed twice.
    { id: "MIDDLE", say: "I do detailing, people just call it Ridgeline", mustAsk: false, expectName: /ridgeline/i },
  ];

  for (const c of CASES) {
    let r;
    try { r = await say(c.say); }
    catch (e) { bailIfCannotRun(e); fails.push(`${c.id} — endpoint error: ${e.message}`); continue; }
    const reply = String(r.reply || r.message || JSON.stringify(r)).slice(0, 900);
    const grantSeen = !!r.draftGrant;
    // THE BUILD, ASSERTED IN-BAND. document_build_jobs is written asynchronously, so
    // reading it the instant the response lands made this check FLAKY — it failed three
    // times on code that was working. The capability result is in the response itself and
    // is immediate; the row poll below is the belt to its braces.
    const capResults = (r.messages || []).filter((m) => m && m.role === "system").map((m) => String(m.content || ""));
    const generateRan = capResults.some((c) => /CAPABILITY RESULT for website\.generateDocument/i.test(c));
    const asked = ASKS_FOR_NAME.test(reply);
    const rows = sql(`select b.id, b.name, b.slug, b.created_at, b.brand_color, b.section_order is not null as has_sections,
      (select count(*) from document_build_jobs j where j.business_id=b.id) as build_jobs
      from businesses b where b.created_at > '${started}' order by b.created_at desc limit 5`);
    for (const row of rows) if (!created.find((x) => x.id === row.id)) created.push(row);
    const mine = rows[0] || null;

    console.log(`\n[${c.id}] "${c.say}"`);
    console.log(`   asked for a name : ${asked}`);
    console.log(`   business created : ${mine ? `${mine.name!==null?JSON.stringify(mine.name):"null"} -> ${mine.slug}` : "none"}`);
    console.log(`   reply            : ${reply.replace(/\s+/g, " ").slice(0, 200)}`);

    // SIGNUP MUST PRODUCE A SITE, not just a row. Every one of these was broken by a
    // parallel path that returned before the code that sets them.
    if (mine) {
      let jobs = Number(mine.build_jobs);
      // Give the async dispatch a few seconds before calling it absent.
      for (let t = 0; t < 8 && jobs < 1; t++) {
        await new Promise((z) => setTimeout(z, 1000));
        jobs = Number((sql(`select count(*) as n from document_build_jobs where business_id='${mine.id}'`)[0] || {}).n || 0);
      }
      if (!generateRan && jobs < 1) fails.push(`${c.id} — no document build was dispatched; signup produced a row, not a site`);
      if (String(mine.brand_color || "") === "#1a3a6e") fails.push(`${c.id} — brand_color is the column default #1a3a6e, so no palette was chosen and every trade gets the same navy page`);
      if (mine.has_sections !== true) fails.push(`${c.id} — section_order was not set`);
    }
    if (mine && !grantSeen) fails.push(`${c.id} — no draft grant was issued, so this draft can never be claimed`);
    if (c.mustAsk) {
      if (!asked) fails.push(`${c.id} — did not ask what the business is called`);
      if (mine && c.banned.test(String(mine.name || ""))) fails.push(`${c.id} — created a business named ${JSON.stringify(mine.name)}, which is a constructed description, not a name`);
      if (mine && c.banned.test(String(mine.slug || ""))) fails.push(`${c.id} — minted the slug "${mine.slug}" from a constructed name`);
      // The build still happens — it just happens unnamed. A draft with no row at all
      // would mean the ask replaced the build, which is the trade we refused to make.
      if (!mine) fails.push(`${c.id} — no draft was created at all; the ask must ride INSIDE the build, not replace it`);
      else if (mine.name !== null) fails.push(`${c.id} — created a draft named ${JSON.stringify(mine.name)}; it should be unnamed until they answer`);
    } else {
      if (asked) fails.push(`${c.id} — asked for a name the person had already given`);
      if (!mine) fails.push(`${c.id} — gave a name and no business was created`);
      else {
        if (!c.expectName.test(String(mine.name || ""))) fails.push(`${c.id} — created ${JSON.stringify(mine.name)}, expected the name they said`);
        if (!/ridgeline/i.test(String(mine.slug || ""))) fails.push(`${c.id} — slug "${mine.slug}" did not follow the given name`);
        if (String(mine.name || "").length > 40) fails.push(`${c.id} — name ${JSON.stringify(mine.name)} looks constructed, not extracted`);
      }
    }
  }
}

let cleanupNote = "";
try { await run(); }
finally {
  if (created.length) {
    const ids = created.map((r) => `'${r.id}'`).join(",");
    try {
      sql(`delete from businesses where id in (${ids}); select count(*) as n from businesses where id in (${ids})`);
      cleanupNote = `cleaned up ${created.length} draft(s) this check created`;
    } catch (e) { cleanupNote = `COULD NOT CLEAN UP ${created.length} draft(s): ${created.map((r) => r.slug).join(", ")}`; }
  } else cleanupNote = "no rows created";
}

console.log(`\n${cleanupNote}`);
if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — a name is extracted when given and asked for when not; never constructed.");
process.exit(0);
