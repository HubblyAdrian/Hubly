#!/usr/bin/env node
/**
 * REPAIR THE PAGES THAT CARRY A DEAD ADDRESS.
 *
 * Six stored pages link to `https://<old-slug>.myhubly.app/?book=1` — the temporary slug the
 * draft carried before the owner named the business. The slug moved; the link did not. On a
 * live site that is a customer clicking Book and landing on a booking page with an empty
 * name and a "BR" monogram.
 *
 * The generator no longer writes an absolute self-URL (hubly_page_runtime.ts writes
 * `/?book=1`), so this is a one-time repair of pages built before that, not a pass that has
 * to run forever.
 *
 * ATTRIBUTE AND HREF ONLY. It rewrites the href text and nothing else — no re-render, no
 * regeneration, no reformatting. The proof is in the bytes: every byte outside the rewritten
 * hrefs is identical, and that is asserted per page before anything is written.
 *
 *   node scripts/repair-stale-self-links.mjs            # report what it would do
 *   node scripts/repair-stale-self-links.mjs --write    # write new versions via the RPC
 *
 * Exit: 0 ok · 1 a page failed its byte proof (nothing written for it) · 2 cannot run
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WRITE = process.argv.includes("--write");
const ROOT = new URL("..", import.meta.url).pathname;

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows":');
  if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

let rows;
try {
  rows = sql(`select b.slug, b.account_kind, (b.owner_id is not null) as claimed, d.version, d.rendered_html as html
              from businesses b
              join lateral (select rendered_html, version from business_documents
                            where business_id = b.id and rendered_html is not null
                            order by version desc limit 1) d on true`);
} catch (e) { console.error("CANNOT RUN — database unreachable: " + String(e.message).slice(0, 140)); process.exit(2); }

const HOST = /https?:\/\/([a-z0-9-]+)\.myhubly\.app/gi;
let repaired = 0, failed = 0, clean = 0;
for (const r of rows) {
  const hosts = [...new Set([...r.html.matchAll(HOST)].map((m) => m[1].toLowerCase()))];
  const foreign = hosts.filter((h) => h !== r.slug);
  if (!foreign.length) { clean++; continue; }

  // Rewrite ONLY absolute self-links, to a relative one. Any *.myhubly.app link that is not
  // this business's own and not a booking link is left alone and reported — a link to
  // another business would be a different finding and must not be silently rewritten.
  let out = r.html;
  let rewritten = 0;
  for (const h of foreign) {
    const re = new RegExp(`https?://${h}\\.myhubly\\.app/?(\\?book=1)`, "gi");
    out = out.replace(re, (_m, q) => { rewritten++; return q; });
  }
  const left = [...new Set([...out.matchAll(HOST)].map((m) => m[1].toLowerCase()))].filter((h) => h !== r.slug);

  // ── THE BYTE PROOF ────────────────────────────────────────────────────────
  // Reconstruct the original from the repaired bytes by putting the old absolute URLs
  // back. If that does not reproduce the stored page byte for byte, something other than
  // the hrefs changed and this page is not written.
  let back = out;
  for (const h of foreign) back = back.replace(/(?<!\.myhubly\.app)\?book=1/g, `https://${h}.myhubly.app/?book=1`);
  const exact = back === r.html;
  const delta = r.html.length - out.length;

  console.log(`${r.slug.padEnd(44)} ${r.account_kind.padEnd(8)} ${r.claimed ? "claimed  " : "unclaimed"} v${r.version}`);
  console.log(`   stale host(s): ${foreign.join(", ")} · hrefs rewritten: ${rewritten} · bytes removed: ${delta} · remaining foreign hosts: ${left.length ? left.join(", ") : "none"}`);
  console.log(`   byte proof (everything outside the hrefs identical): ${exact ? "PASS" : "FAIL"}`);
  if (!exact || left.length) { failed++; console.log(`   NOT WRITTEN`); continue; }

  if (!WRITE) { repaired++; continue; }

  const dir = mkdtempSync(join(tmpdir(), "hubly-repair-"));
  const file = join(dir, "repair.sql");
  writeFileSync(file, `select create_business_document(
  p_business_id := (select id from businesses where slug = '${r.slug}'),
  p_draft_token := (select draft_token from businesses where slug = '${r.slug}'),
  p_tag := 'website',
  p_document := (select d.document from business_documents d join businesses b on b.id = d.business_id
                 where b.slug = '${r.slug}' order by d.version desc limit 1),
  p_rendered_html := $html$${out}$html$,
  p_created_by := 'patch',
  p_format := 'html',
  -- A CLAIMED BUSINESS AUTHORISES BY OWNER, NOT BY DRAFT TOKEN. Passing null here returned
  -- "not_owner" for crestview-window-cleaning on the first repair run — the same claimed-vs-
  -- draft door that has caught every write path in this codebase. Read from the row rather
  -- than assuming: null for a draft, the real owner for a claimed site.
  p_owner_id := (select owner_id from businesses where slug = '${r.slug}')
) as result;`);
  const res = execFileSync("supabase", ["db", "query", "--linked", "-f", file], { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  console.log(`   written: ${/"ok": true/.test(res) ? "yes, new version" : "NO — " + res.slice(0, 120)}`);
  repaired++;
}

console.log(`\npages already clean: ${clean} · repaired${WRITE ? "" : " (dry run)"}: ${repaired} · refused on the byte proof: ${failed}`);
if (!WRITE) console.log(`\nnothing was written. Re-run with --write at a deploy boundary.`);
process.exit(failed ? 1 : 0);
