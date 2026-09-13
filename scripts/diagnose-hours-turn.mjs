#!/usr/bin/env node
/**
 * WHICH OF THE FOUR WAYS DID THIS BUSINESS'S HOURS DIE?
 *
 *   node scripts/diagnose-hours-turn.mjs <slug>
 *
 * Hours can fail in four places, and three of them look identical to the owner — the page
 * shows nothing either way:
 *
 *   A. THE WRITE was refused         → no rows in settings_business_hours
 *   B. THE WRITE went to one store   → rows exist, businesses.meta.hours is null
 *                                      (set_business_hours_in_progress, not set_business_hours)
 *   C. PLACEMENT refused             → a rebuild_outcome_events row, missed=hours, because
 *                                      pageHasHoursSection said the page already shows a
 *                                      schedule (a "Schedule the …" heading counts)
 *   D. PLACEMENT did nothing at all  → no anchor, no section, no else branch, NO ROW.
 *                                      135 of 172 pages sit here (Lesson 47)
 *
 * ACCEPTANCE AND APPEARANCE ARE TWO RESULTS. This prints them separately, because the reply
 * saying "saved" and the page showing hours are different questions with different answers.
 *
 * Read-only. Exit: 0 always (it is a diagnosis, not a gate); 2 if it cannot run.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const slug = process.argv[2];
if (!slug) { console.error("usage: node scripts/diagnose-hours-turn.mjs <slug>"); process.exit(2); }
const ROOT = new URL("..", import.meta.url).pathname;

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

let biz, hours, events, convo;
try {
  [biz] = sql(`select b.id::text as id, b.slug, b.account_kind, (b.owner_id is not null) as claimed,
                      (b.meta::jsonb)->'hours' as meta_hours, d.rendered_html as html, d.version, d.format
               from businesses b
               left join lateral (select rendered_html, version, format from business_documents
                                  where business_id=b.id and rendered_html is not null order by version desc limit 1) d on true
               where b.slug = '${slug}'`);
  if (!biz) { console.error(`CANNOT RUN — no business with slug ${slug}`); process.exit(2); }
  hours = sql(`select weekday, open_time::text as o, close_time::text as c, closed from settings_business_hours where business_id='${biz.id}' order by weekday`);
  events = sql(`select changes, status, detail, landed, created_at::text as at from rebuild_outcome_events where business_id='${biz.id}' order by created_at`);
  convo = sql(`select seq, role, left(content::text, 240) as content, created_at::text as at from business_conversations where business_id='${biz.id}' order by seq`);
} catch (e) { console.error("CANNOT RUN — " + String(e.message).slice(0, 160)); process.exit(2); }

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
console.log(`\n${biz.slug} [${biz.account_kind}${biz.claimed ? ", claimed" : ", draft"}] document v${biz.version ?? "-"} (${biz.format ?? "-"})\n`);

// ── 1. DID IT ACCEPT? ──────────────────────────────────────────────────────────
console.log("1. ACCEPTED — did the write happen?");
console.log(`   settings_business_hours : ${hours.length} row(s)` +
  (hours.length ? "  " + hours.map((h) => `${DAY[h.weekday]} ${h.closed ? "closed" : `${(h.o||"").slice(0,5)}-${(h.c||"").slice(0,5)}`}`).join(", ") : ""));
console.log(`   businesses.meta.hours   : ${biz.meta_hours ? Object.keys(biz.meta_hours).join(", ") : "null"}`);
if (!hours.length) console.log("   -> A. THE WRITE WAS REFUSED. Nothing reached the record.");
else if (!biz.meta_hours) console.log("   -> B. WRITTEN TO ONE STORE ONLY (the table, not meta.hours) — set_business_hours_in_progress,\n         which is applyExtractedFacts' writer, not the setHours capability's.");
else console.log("   -> BOTH STORES WRITTEN. This is what today's set_business_hours does.");

// ── 2. WHAT DID HUBLY SAY? ─────────────────────────────────────────────────────
const hourTurns = convo.filter((c) => /hour|open|close|\b\d{1,2}\s*(am|pm|to|-)\s*\d{1,2}\b/i.test(c.content));
console.log(`\n2. WHAT THE OWNER WAS TOLD (${hourTurns.length} turn(s) mentioning hours):`);
for (const t of hourTurns.slice(-6)) console.log(`   [${String(t.seq).padStart(3)}] ${t.at.slice(11, 19)} ${t.role.padEnd(9)} ${t.content.replace(/\s+/g, " ").slice(0, 150)}`);

// ── 3. DID IT APPEAR? ──────────────────────────────────────────────────────────
console.log("\n3. APPEARED — did the page show it? (a separate question with a separate answer)");
const placement = events.filter((e) => e.changes === "contact-hours-placement");
console.log(`   contact-hours-placement rows: ${placement.length}`);
for (const e of placement) console.log(`     ${e.at.slice(0, 19)}  ${e.status.padEnd(16)} landed=${String(e.landed).padEnd(5)} ${e.detail ?? ""}`);

if (biz.html) {
  const dir = mkdtempSync(join(tmpdir(), "hubly-hours-"));
  const f = join(dir, "p.html"), s = join(dir, "p.ts");
  writeFileSync(f, biz.html);
  writeFileSync(s, `
import { pageHasHoursSection, hoursOnPage } from "file://${ROOT}supabase/functions/_shared/hubly_contact.ts";
const html = await Deno.readTextFile(${JSON.stringify(f)});
const vis = html.replace(/<(script|style)[\\s\\S]*?<\\/\\1>/gi," ").replace(/<[^>]+>/g," ").replace(/\\s+/g," ");
const times = /\\d{1,2}[:.]\\d{2}|\\b\\d{1,2}\\s?(am|pm)\\b/i.test(vis);
const days = new Set([...vis.toLowerCase().matchAll(/\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\\b/g)].map((m)=>m[1].slice(0,3)));
const heads = (html.match(/<(h[1-6]|dt|th|strong|b|p|span|div|li)\\b[^>]*>([^<]{1,30})<\\/\\1>/gi)||[])
  .map((x)=>x.replace(/<[^>]+>/g,"").trim()).filter((t)=>/^(opening |business |our |store |shop )?hours\\b|^(listed )?schedule\\b|hours of operation/i.test(t));
console.log(JSON.stringify({ anchor: hoursOnPage(html), section: pageHasHoursSection(html), times, days: days.size, heads }));
`);
  const v = JSON.parse(execFileSync("deno", ["run", "-A", s], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split("\n").pop());
  console.log(`   page has a data-hubly-hours anchor : ${v.anchor}`);
  console.log(`   pageHasHoursSection says           : ${v.section}` + (v.heads.length ? `   (matched heading(s): ${v.heads.join(" | ")})` : ""));
  console.log(`   page actually shows times          : ${v.times}     weekday names on the page: ${v.days}`);
  if (hours.length) {
    if (v.anchor) console.log("   -> placement CAN update this page in place.");
    else if (v.section && !v.times && v.days < 3) console.log(`   -> C. FALSE POSITIVE. No times and ${v.days} weekday name(s), but a heading matched, so\n         placement refused to place real hours to avoid duplicating a schedule that is not there.`);
    else if (v.section) console.log("   -> C. placement skipped: the page genuinely shows a schedule already.");
    else console.log("   -> D. THE SILENT BRANCH. No anchor, no section, no else — placement did nothing and\n         recorded nothing. Expect NO row above for the turn that wrote the hours.");
  }
}
console.log("\nACCEPTANCE and APPEARANCE are reported separately above. Do not merge them into one verdict.\n");
