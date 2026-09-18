#!/usr/bin/env node
/**
 * WHICH SUBTREES OF `businesses.meta` HOLD SOMETHING A PERSON WOULD CALL PRIVATE?
 *
 *   node scripts/measure-private-meta-subtrees.mjs
 *
 * Adrian, 2026-09-18: *"Whether any OTHER subtree of meta holds something that is not page content.
 * Same shape detector you already wrote — contact records, message history, notes, anything a person
 * would call private. I want to know if pipeline is the only one before I decide the scope."*
 *
 * DETECTED BY SHAPE, NEVER BY KEY NAME. A key-name list is the hand-maintained-set disease and would
 * miss the next one — which is how `meta.pipeline` went unnoticed inside a column an anon reader
 * returns. Three shapes, each stated:
 *
 *   CONTACT RECORDS   an array of objects each carrying a name plus a phone or an email
 *   MESSAGE HISTORY   an array of objects carrying a body/text/message plus a timestamp or a sender
 *   FREE NOTES        a string field called notes/note/comment with real prose in it (> 20 chars)
 *
 * NO VALUE IS PRINTED. Paths, counts and field NAMES only: a measurement that leaks the data it is
 * complaining about has made the problem worse, and a transcript is where data goes to stay.
 *
 * SCOPED: this reads CLAIMED businesses only, because `get_public_business` returns nothing for an
 * unclaimed draft. An unclaimed draft's meta could hold anything and would not be exposed by THAT
 * function — `get_draft_business` is a separate question, noted at the end.
 */
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib/redproof.mjs";

const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};

const isContactRecords = (v) => Array.isArray(v) && v.length > 0 &&
  v.every((e) => e && typeof e === "object" && !Array.isArray(e) &&
    typeof e.name === "string" && (typeof e.phone === "string" || typeof e.email === "string"));
const isMessageHistory = (v) => Array.isArray(v) && v.length > 0 &&
  v.every((e) => e && typeof e === "object" && !Array.isArray(e) &&
    (typeof e.body === "string" || typeof e.text === "string" || typeof e.message === "string") &&
    (e.at || e.ts || e.createdAt || e.created_at || e.from || e.role || e.who));
const isFreeNotes = (v, key) => typeof v === "string" && v.trim().length > 20 &&
  /^(notes?|comment|comments|memo|remarks?)$/i.test(key);

let rows;
try {
  rows = q(`select slug, account_kind, meta::text as m from businesses where owner_id is not null`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

const byPath = new Map();
const add = (path, kind, slug, kindOf, n, fields) => {
  const k = `${path}  [${kind}]`;
  if (!byPath.has(k)) byPath.set(k, { biz: new Map(), fields: new Set(), n: 0 });
  const e = byPath.get(k);
  e.biz.set(slug, kindOf); e.n += n;
  for (const f of fields) e.fields.add(f);
};

let examined = 0;
for (const r of rows) {
  let o; try { o = JSON.parse(r.m || "null"); } catch (_) { continue; }
  if (!o || typeof o !== "object") continue;
  examined++;
  const walk = (v, path, key) => {
    if (isContactRecords(v)) { add(path, "contact records", r.slug, r.account_kind, v.length,
      [...new Set(v.flatMap((e) => Object.keys(e)))]); return; }
    if (isMessageHistory(v)) { add(path, "message history", r.slug, r.account_kind, v.length,
      [...new Set(v.flatMap((e) => Object.keys(e)))]); return; }
    if (isFreeNotes(v, key)) { add(path, "free notes", r.slug, r.account_kind, 1, [key]); return; }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[*]`, key));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k2, x]) => walk(x, `${path}.${k2}`, k2));
  };
  Object.entries(o).forEach(([k2, v]) => walk(v, `meta.${k2}`, k2));
}

console.log(`${examined} CLAIMED businesses examined (get_public_business returns nothing for an unclaimed draft).\n`);
const paths = [...byPath.keys()].sort();
console.log(`PRIVATE-SHAPED SUBTREES FOUND: ${paths.length}\n`);
for (const p of paths) {
  const e = byPath.get(p);
  const kinds = {};
  for (const k of e.biz.values()) kinds[k] = (kinds[k] || 0) + 1;
  console.log(`  ${p}`);
  console.log(`      ${e.biz.size} business(es) — ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(" · ")} · ${e.n} record(s) total`);
  console.log(`      field names: ${[...e.fields].sort().join(", ").slice(0, 300)}`);
}
const top = [...new Set(paths.map((p) => p.split(".")[1].split(/[.\[ ]/)[0]))];
console.log(`\nTOP-LEVEL meta KEYS IMPLICATED: ${top.length} — ${top.join(", ")}`);
console.log(`\nSCOPED: three shapes are looked for (contact records, message history, free notes). A private`);
console.log(`thing in a FOURTH shape is invisible here — the list of shapes is the same kind of`);
console.log(`hand-maintained set this repo keeps paying for, and the honest mitigation is that it enumerates`);
console.log(`the SMALL side (what private data looks like) rather than the large one (what page content`);
console.log(`looks like), so a miss costs one more round rather than a wrong all-clear on page content.`);
console.log(`get_draft_business is a SEPARATE whole-row reader (drafts only, gated by a draft token) and`);
console.log(`is not measured here.`);
