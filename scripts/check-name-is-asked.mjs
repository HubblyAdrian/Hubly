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
import { readFileSync, writeFileSync } from "node:fs";
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
    headers: {
      "content-type": "application/json", apikey: KEY, authorization: `Bearer ${KEY}`,
      // OUR HARNESSES DECLARE THEMSELVES. Never sniffed server-side from a missing Origin:
      // a heuristic there is wrong in the flattering direction on the day it matters, and
      // an unmarked harness must show up as a visible bug rather than a better number.
      "x-hubly-synthetic": "1",
    },
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

// ─────────────────────────────────────────────────────────────────────────────
// THE PRICE, PRINTED BEFORE ANYTHING IS SPENT.
//
// This script drives the LIVE endpoint: every case creates a real business row and
// generates a real website through the model. That is not free, and on 2026-09-09 it
// stopped being theoretical — roughly 35 signups drained a full OpenAI top-up, twice
// taking signup down for every visitor and every customer chat on every live business
// site. This file used to run inside `npm test`, so an ordinary test run spent money.
// It is opt-in now, and it says what it costs before it costs it.
// ─────────────────────────────────────────────────────────────────────────────
function printPrice(drafts) {
  console.log(
    `\n  THIS RUN WILL CREATE ${drafts} DRAFT BUSINESSES AND GENERATE ${drafts} WEBSITES.\n` +
    `  Cost anchor (2026-09-09, denominator unknown): ~35 signups drained one full top-up,\n` +
    `  so this is roughly ${(drafts / 35 * 100).toFixed(0)}% of a top-up. Drafts are deleted afterwards; quota is not refunded.\n`);
}


// ─────────────────────────────────────────────────────────────────────────────
// ASSERT AT THE LAYER THE HUMAN SEES.
//
// This check used to read the reply JSON and stop. On 2026-09-09 that passed while the
// page carried the wordmark "LOS ANGELES AVIATION PILOT": the record was clean, the
// brief said "Do not invent a business name", and the invention existed only in the
// rendered HTML. Reading the reply and not the page is the same mistake as reading the
// CSS and not the pixels, and the return value and not the bytes — three times in one
// day. So every ASK case now waits for the real document and asserts against it.
// ─────────────────────────────────────────────────────────────────────────────

/** The generated page, once it exists. Builds take 100-150s, so this polls. */
async function waitForDocument(businessId, maxMs = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const rows = sql(`select coalesce(rendered_html,'') as html, coalesce(document::text,'') as doc
                      from business_documents where business_id='${businessId}'
                      order by created_at desc limit 1`);
    const r = rows[0];
    if (r && String(r.html || "").length > 500) return { html: String(r.html), doc: String(r.doc || "") };
    await new Promise((z) => setTimeout(z, 5000));
  }
  return null;
}

/** Elements that present the business's IDENTITY, as opposed to describing it.
 *  Deliberately not "anywhere the words appear": an eyebrow reading PILOT · LOS ANGELES
 *  is TRUE and allowed, and banning the words outright would red-flag the correct page. */
function identityElements(html) {
  const out = [];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) out.push({ where: "<title>", tag: title[0], text: title[1].trim() });
  // Class-named identity slots the generator actually produces, plus our own label.
  const re = /<([a-z0-9]+)([^>]*(?:class="[^"]*(?:brand-name|brandname|wordmark|logotype|logo-text|monogram|lettermark)[^"]*"|data-hc="business\.name")[^>]*)>([\s\S]{0,300}?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    out.push({ where: `<${m[1]} ${(/class="([^"]*)"/i.exec(m[2]) || [, "data-hc=business.name"])[1]}>`,
               tag: `<${m[1]}${m[2]}>`, text: m[3].replace(/<[^>]*>/g, "").trim() });
  }
  return out;
}

/** A NAME is contiguous; a DESCRIPTOR is separated. "Los Angeles Aviation Pilot" reads
 *  as an identity, "PILOT · LOS ANGELES" does not, and the separator is the difference.
 *  Narrow on purpose — it discriminates the failure that shipped without red-flagging
 *  the eyebrow the fix explicitly asks for. */
function constructedIdentity(text, trade, place) {
  const t = " " + text.toLowerCase().replace(/\s+/g, " ").trim() + " ";
  for (const tr of trade) {
    for (const pl of place) {
      if (new RegExp(`\\b${pl}\\s+${tr}\\b`).test(t)) return `"${pl} ${tr}" (place + trade, contiguous)`;
      if (new RegExp(`\\b${tr}\\s+${pl}\\b`).test(t)) return `"${tr} ${pl}" (trade + place, contiguous)`;
    }
  }
  return null;
}

const fails = [];
const created = [];
// PER-SHAPE, NOT ONE AGGREGATE. If the ask survives four shapes and dies on two, that
// tells us what to fix; a single pass/fail would not. Flushed after every case, because
// the run that teaches you most is the one that dies before the end (Lesson 16) — and
// this one costs eight signups, so losing it costs real money.
const results = [];
// Rows already attributed to an earlier case, so a case that creates nothing owns nothing.
const seenBefore = new Set();
const OUT = join(ROOT, "docs/NAME_ASK_BY_SHAPE.json");
function flush(done) {
  try {
    writeFileSync(OUT, JSON.stringify({ measured_at: new Date().toISOString(), complete: !!done, results }, null, 2));
  } catch { /* reporting must not break the run */ }
}

async function run() {
  printPrice(8);
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

  // A RULE PROVED ON ONE PHRASING IS NOT PROVED.
  //
  // This check went green on "I do mobile detailing in los angeles" and the rule then
  // failed on the second sentence a real person typed: "Im an aviation pilot in Los
  // Angeles I need a website" got the packages-and-prices question and no name ask at
  // all. One sentence is not a rule; it is an anecdote that passed.
  //
  // So the ASK side spans SHAPES, not wordings — how people actually open. `trade` and
  // `place` are the words a construction would be assembled FROM, and drive the
  // constructed-identity assertions against the rendered page.
  // A FIRST TURN THAT FAILS MUST STILL BE COUNTED — asserted first, and it costs nothing.
  //
  // recordFirstTurn was wired to the success returns only, so a failed first turn wrote no
  // business row, no conversation row and no counter row: the instrument built to make
  // invisible turns visible was blind to exactly those. It read Adrian's night as one
  // first turn instead of two, and the build rate as 100% instead of 50%.
  //
  // An invalid `content` shape reaches the real catch block without any provider call, so
  // this exercises the failure path for free.
  {
    const before = Number((sql(`select count(*) as n from first_turn_outcomes`)[0] || {}).n || 0);
    try {
      await fetch(FN, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: KEY, authorization: `Bearer ${KEY}`, "x-hubly-synthetic": "1" },
        body: JSON.stringify({ messages: [{ role: "user", content: { not: "a string" } }], understanding: {}, draftBusiness: null, conversationKey: `failcount-${Date.now()}` }),
      });
    } catch { /* the 502 is the point */ }
    await new Promise((z) => setTimeout(z, 1500));
    const after = Number((sql(`select count(*) as n from first_turn_outcomes`)[0] || {}).n || 0);
    if (after <= before) {
      fails.push("FAILED-TURN COUNTING — a first turn that errored wrote no first_turn_outcomes row; the counter can only ever report the turns that succeeded");
    } else {
      sql(`delete from first_turn_outcomes where reply like 'content.map%' and is_synthetic = true`);
    }
    console.log(`\n[failed-turn counting] ${after > before ? "a failing first turn is recorded" : "NOT RECORDED"}`);
  }

  const CASES = [
    // The shape that failed on 2026-09-09: a stated NEED, not a described job.
    { id: "NEED", say: "Im an aviation pilot in Los Angeles I need a website", mustAsk: true,
      trade: ["aviation", "pilot"], place: ["los angeles", "la"] },
    // A request with no trade in it at all. NOT a mustAsk case: with nothing to build
    // from, asking what kind of business it is IS the right answer (763 makes a
    // DESCRIPTION of the work the go-ahead, and this is not one). Kept because the shape
    // is common and we still want to see what it does — asserted only on not inventing.
    { id: "ASK-BUILD", say: "can you build me a site", mustAsk: false, expectNoDraft: true, trade: [], place: [] },
    // A trade with no place — nothing to pair it with, which is its own temptation.
    { id: "BARE-TRADE", say: "i do lawn care", mustAsk: true, trade: ["lawn care", "lawn"], place: [] },
    // The one that already passes. Kept, because a fix that breaks it is not a fix.
    { id: "TRADE-PLACE", say: "I do mobile detailing in los angeles", mustAsk: true,
      trade: ["mobile detailing", "detailing"], place: ["los angeles", "la"] },
    // Prose with no assertion verb. The extraction-gate scar says this is the shape we
    // undercount, and it carries the two highest-value facts we capture.
    { id: "PROSE", say: "Im looking to make a storefront to sell detailing chemicals", mustAsk: true,
      trade: ["detailing chemicals", "detailing"], place: [] },
    // The shortest real opener on record.
    { id: "FIRST-PERSON", say: "I'm a nail tech", mustAsk: true, trade: ["nail tech", "nails", "nail"], place: [] },

    // THE OTHER SIDE OF THE RULE. Without these, "always ask" passes — and that breaks
    // the person who told us their name in their first sentence.
    { id: "EXTRACT", say: "I run Ridgeline Detail, mobile detailing in LA", mustAsk: false, expectName: /ridgeline detail/i },
    // THE AWKWARD MIDDLE, and it is extraction: they said the word, Hubly reads it.
    // Nothing is assembled. Asserted rather than reported, because an untested side of
    // a rule is exactly how this failed twice.
    { id: "MIDDLE", say: "I do detailing, people just call it Ridgeline", mustAsk: false, expectName: /ridgeline/i },
  ];

  for (const c of CASES) {
    const caseStarted = new Date(Date.now() - 3000).toISOString();
    let r;
    try { r = await say(c.say); }
    catch (e) { bailIfCannotRun(e); fails.push(`${c.id} — endpoint error: ${e.message}`); continue; }
    // WHAT A PERSON ACTUALLY SEES — never a JSON dump.
    //
    // This line used to fall back to JSON.stringify(r) when `reply` was empty, which it
    // is on a build turn. That dump contains the CAPABILITY RESULTS, and the startDraft
    // summary literally contains the words "ask what the business is called" — our own
    // instruction to the model. So ASKS_FOR_NAME matched OUR text and reported that the
    // model had asked, on every ASK case, whether or not it had. A guaranteed false
    // green, caught on case 1 of a run that costs eight signups.
    //
    // So: only the text the client renders. reply, the interim messages it shows, and the
    // last assistant turn — and explicitly never a system/capability message.
    const visible = [
      String(r.reply || ""),
      ...(Array.isArray(r.interimMessages) ? r.interimMessages.map((m) => String(m || "")) : []),
      ...(Array.isArray(r.messages)
        ? r.messages.filter((m) => m && m.role === "assistant").slice(-1).map((m) => String(m.content || ""))
        : []),
    ].filter(Boolean);
    const reply = visible.join("  ").slice(0, 1200);
    if (!reply.trim()) fails.push(`${c.id} — the turn produced no visible text at all; a person would see silence`);
    const grantSeen = !!r.draftGrant;
    // THE BUILD, ASSERTED IN-BAND. document_build_jobs is written asynchronously, so
    // reading it the instant the response lands made this check FLAKY — it failed three
    // times on code that was working. The capability result is in the response itself and
    // is immediate; the row poll below is the belt to its braces.
    const capResults = (r.messages || []).filter((m) => m && m.role === "system").map((m) => String(m.content || ""));
    const generateRan = capResults.some((c) => /CAPABILITY RESULT for website\.generateDocument/i.test(c));
    const asked = ASKS_FOR_NAME.test(reply);
    // THE ROW THIS CASE CREATED — or nothing. This used to be "newest row since the run
    // started", which quietly handed a case that created NO draft the PREVIOUS case's
    // business: on 2026-09-09 three shapes were scored against another shape's page, and
    // reported a missing draft grant and a foreign wordmark. A case owns a row only if
    // that row did not exist before the case began.
    const rows = sql(`select b.id, b.name, b.slug, b.created_at, b.brand_color, b.section_order is not null as has_sections,
      (select count(*) from document_build_jobs j where j.business_id=b.id) as build_jobs
      from businesses b where b.created_at > '${caseStarted}' order by b.created_at desc limit 5`);
    for (const row of rows) if (!created.find((x) => x.id === row.id)) created.push(row);
    const mine = rows.find((r) => !seenBefore.has(r.id)) || null;
    for (const r of rows) seenBefore.add(r.id);

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
      // The RECORD-level construction check, from the same trade/place words the page
      // check uses. A slug is written once and is permanent, so it matters most.
      if (mine) {
        const recHit = constructedIdentity(String(mine.name || ""), c.trade, c.place);
        if (recHit) fails.push(`${c.id} — created a business named ${JSON.stringify(mine.name)}: ${recHit} is a description of a job, not a name`);
        const slugWords = String(mine.slug || "").replace(/-/g, " ");
        const slugHit = constructedIdentity(slugWords, c.trade, c.place);
        if (slugHit) fails.push(`${c.id} — minted the permanent slug "${mine.slug}" from a constructed name: ${slugHit}`);
        for (const tr of c.trade) {
          if (new RegExp(`\\b${tr.replace(/\s+/g, "[ -]")}\\b`, "i").test(slugWords)) {
            fails.push(`${c.id} — the slug "${mine.slug}" carries the trade "${tr}"; an unnamed draft gets site-<hex> and nothing else`);
            break;
          }
        }
      }
      // The build still happens — it just happens unnamed. A draft with no row at all
      // would mean the ask replaced the build, which is the trade we refused to make.
      if (!mine) fails.push(`${c.id} — no draft was created at all; the ask must ride INSIDE the build, not replace it`);
      else if (mine.name !== null) fails.push(`${c.id} — created a draft named ${JSON.stringify(mine.name)}; it should be unnamed until they answer`);

      // ── THE PAGE, WHICH IS WHERE THE FAILURE LIVED ──────────────────────────────
      if (mine && mine.name === null) {
        const page = await waitForDocument(mine.id);
        if (!page) {
          fails.push(`${c.id} — no page was rendered within 4 minutes, so nothing could be checked on it`);
        } else {
          const ids = identityElements(page.html);

          // 1. NO CONSTRUCTED NAME, IN ANY IDENTITY SLOT.
          for (const el of ids) {
            const hit = constructedIdentity(el.text, c.trade, c.place);
            if (hit) fails.push(`${c.id} — the page names the business ${hit} in ${el.where}: ${JSON.stringify(el.text.slice(0, 70))}`);
          }

          // 2. THE PAGE MUST AGREE WITH ITS OWN BRIEF. The brief is the instruction and
          //    the page is the result; they may never contradict each other. This is the
          //    assertion that would have caught 2026-09-09 with nobody knowing what to
          //    look for — the brief said "unnamed" and "Do not invent a business name",
          //    and the wordmark said otherwise.
          const briefSaysUnnamed = /unnamed|no business name|do not invent a business name|has not (?:yet )?provided a business name/i.test(page.doc);
          if (briefSaysUnnamed) {
            for (const el of ids) {
              if (el.where === "<title>") continue;   // the title is trade + place by instruction
              // A NAME IS CONTIGUOUS; A DESCRIPTOR IS SEPARATED. "Aviation Pilot · Los
              // Angeles" is the eyebrow the fix asks for and must pass; "Los Angeles
              // Aviation Pilot" is the invention that shipped and must fail. Banning all
              // text here fails the correct page, which this check did on its first run.
              const hit = constructedIdentity(el.text, c.trade, c.place);
              if (hit) {
                fails.push(`${c.id} — the brief says this business is unnamed and instructs against inventing one, but the page renders ${hit} as its identity in ${el.where}: ${JSON.stringify(el.text.slice(0, 70))}`);
              }
            }
          }

          // 3. NO data-hubly-guess ON AN IDENTITY ELEMENT, EVER.
          //    The wordmark that shipped carried data-hubly-guess="provisional site
          //    identity". The model MARKED ITS OWN INVENTION and we rendered it as the
          //    business's name. Second time in one day the flag was raised and ignored
          //    (the first: guess service rows reaching customers on a live market page).
          //    A guess may be a proposed tagline; it may never be who the business IS.
          for (const el of ids) {
            const g = /data-hubly-guess="([^"]*)"/i.exec(el.tag);
            if (g) fails.push(`${c.id} — an identity element in ${el.where} is flagged data-hubly-guess="${g[1]}" and rendered anyway; the model said it invented this and nothing listened`);
          }

          console.log(`   page identity    : ${ids.length ? ids.map((e) => `${e.where}=${JSON.stringify(e.text.slice(0, 40))}`).join("  ") : "none — no wordmark, no monogram"}`);
        }
      }
    } else if (c.expectNoDraft) {
      // Nothing to build from. The only failures here are inventing a business anyway,
      // or answering with a menu instead of the one question that unblocks the build.
      if (mine) fails.push(`${c.id} — created ${JSON.stringify(mine.name)} (${mine.slug}) from a message that names no business at all`);
    } else {
      if (asked) fails.push(`${c.id} — asked for a name the person had already given`);
      if (!mine) fails.push(`${c.id} — gave a name and no business was created`);
      else {
        if (!c.expectName.test(String(mine.name || ""))) fails.push(`${c.id} — created ${JSON.stringify(mine.name)}, expected the name they said`);
        if (!/ridgeline/i.test(String(mine.slug || ""))) fails.push(`${c.id} — slug "${mine.slug}" did not follow the given name`);
        if (String(mine.name || "").length > 40) fails.push(`${c.id} — name ${JSON.stringify(mine.name)} looks constructed, not extracted`);
      }
    }

    const mine_fails = fails.filter((f) => f.startsWith(`${c.id} —`));
    results.push({
      shape: c.id, said: c.say, mustAsk: !!c.mustAsk,
      askedForName: asked, built: generateRan,
      recordName: mine ? mine.name : null, slug: mine ? mine.slug : null,
      reply: reply.replace(/\s+/g, " ").slice(0, 300),
      pass: mine_fails.length === 0, failures: mine_fails,
    });
    flush(false);
    console.log(`   VERDICT          : ${mine_fails.length === 0 ? "pass" : `FAIL (${mine_fails.length})`}`);
  }
  flush(true);
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

console.log("\nBY SHAPE — does the rule survive how people actually open?");
console.log("  " + "shape".padEnd(14) + "asked".padEnd(8) + "built".padEnd(8) + "verdict");
for (const r of results) {
  console.log("  " + r.shape.padEnd(14) +
    (r.mustAsk ? (r.askedForName ? "yes" : "NO") : (r.askedForName ? "WRONGLY" : "n/a")).padEnd(8) +
    (r.built ? "yes" : "NO").padEnd(8) +
    (r.pass ? "pass" : "FAIL"));
}
const askShapes = results.filter((r) => r.mustAsk);
if (askShapes.length) {
  const askedOk = askShapes.filter((r) => r.askedForName).length;
  console.log(`\n  the name was asked on ${askedOk} of ${askShapes.length} ASK shapes; built on ${results.filter((r) => r.built).length} of ${results.length} overall.`);
}
console.log(`  per-shape detail: ${OUT}`);

if (fails.length) {
  console.error(`\nFAIL — ${fails.length}:`);
  for (const f of fails) console.error("  " + f);
  process.exit(1);
}
console.log("PASS — a name is extracted when given and asked for when not; never constructed.");
process.exit(0);
