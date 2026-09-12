#!/usr/bin/env node
/**
 * GIVE STORED PAGES THE FRAGMENT-SCROLL HANDLER.
 *
 * A generated page is mounted in a `srcdoc` iframe, whose base URL is the PARENT's. So
 * `<a href="#process">` never scrolled — the browser resolved it against the site root and
 * navigated the frame there, replacing the page. 788 such links across 155 stored pages;
 * every nav link on every freeform page is one of them.
 *
 * `injectHublyRuntime` now emits a capture-phase handler that scrolls instead. New pages get
 * it at generation. This gives it to the pages that already exist, by re-running the runtime
 * injection: strip the runtime blocks, inject the current ones.
 *
 * THE INVERSE PROOF, per page: strip the runtime from the REPAIRED page and require the
 * result to be byte-identical to the stripped original. That proves nothing outside our own
 * injected blocks moved — the strongest form of this we have, and the reason the first
 * version of this repair was caught doing something quite different (a harness bug passed an
 * object where a string was expected and produced a 9KB page from a 32KB one; the proof
 * failed, and nothing was written).
 *
 *   node scripts/repair-fragment-links.mjs            # report
 *   node scripts/repair-fragment-links.mjs --write    # write new versions
 *
 * Exit: 0 ok · 1 a page failed its proof (nothing written for it) · 2 cannot run
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WRITE = process.argv.includes("--write");
const ROOT = new URL("..", import.meta.url).pathname;
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 512 * 1024 * 1024 });
  const i = out.indexOf('"rows":');
  if (i < 0) return [];
  let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
}

/** The runtime lives in Deno TS; Node cannot import it. Shell out to deno for the two
 *  production functions rather than reimplementing either (Lesson 34). */
function reinject(html, slug, accent, name) {
  const dir = mkdtempSync(join(tmpdir(), "hubly-frag-"));
  const inF = join(dir, "in.html"), outF = join(dir, "out.html"), scriptF = join(dir, "run.ts");
  writeFileSync(inF, html);
  writeFileSync(scriptF, `
import { injectHublyRuntime, stripHublyRuntime } from "file://${ROOT}supabase/functions/_shared/hubly_page_runtime.ts";
const stored = await Deno.readTextFile(${JSON.stringify(inF)});
const { html: bare } = stripHublyRuntime(stored);
const r = injectHublyRuntime(bare, { slug: ${JSON.stringify(slug)}, accent: ${JSON.stringify(accent || "#1a3a6e")}, businessName: ${JSON.stringify(name || slug)} } as any);
const { html: bareAgain } = stripHublyRuntime(r.html);
await Deno.writeTextFile(${JSON.stringify(outF)}, r.html);
console.log(JSON.stringify({ ok: bareAgain === bare, bytes: String(r.html).length }));
`);
  const res = execFileSync("deno", ["run", "-A", scriptF], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const verdict = JSON.parse(res.trim().split("\n").pop());
  return { ...verdict, file: outF };
}

let rows;
try {
  rows = sql(`select b.slug, b.name, b.account_kind, b.brand_color, (b.owner_id is not null) as claimed, d.rendered_html as html
              from businesses b
              join lateral (select rendered_html from business_documents where business_id=b.id and rendered_html is not null
                            order by version desc limit 1) d on true
              where d.rendered_html like '%href="#%'`);
} catch (e) { console.error("CANNOT RUN — database unreachable: " + String(e.message).slice(0, 140)); process.exit(2); }

let done = 0, skipped = 0, failed = 0, linksCovered = 0;
for (const r of rows) {
  if (LIMIT && done + skipped >= LIMIT) break;
  const frags = [...new Set([...r.html.matchAll(/href="#([^"]+)"/gi)].map((m) => m[1]))].filter((h) => h !== "top");
  if (!frags.length) { skipped++; continue; }
  if (/data-hubly-runtime="fragment-scroll"/.test(r.html)) { skipped++; continue; }   // already has it

  let v;
  try { v = reinject(r.html, r.slug, r.brand_color, r.name); }
  catch (e) { failed++; console.log(`${r.slug.padEnd(40)} REINJECT FAILED — ${String(e.message).slice(0, 80)}`); continue; }

  console.log(`${r.slug.padEnd(40)} ${r.account_kind.padEnd(7)} ${frags.length} fragment link(s) · ${r.html.length}B -> ${v.bytes}B · outside-the-runtime identical: ${v.ok ? "PASS" : "FAIL"}`);
  if (!v.ok) { failed++; console.log("   NOT WRITTEN"); continue; }
  linksCovered += frags.length;
  if (!WRITE) { done++; continue; }

  const dir = mkdtempSync(join(tmpdir(), "hubly-fragw-"));
  const sqlF = join(dir, "w.sql");
  const html = execFileSync("cat", [v.file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(sqlF, `select create_business_document(
  p_business_id := (select id from businesses where slug = '${r.slug}'),
  p_draft_token := (select draft_token from businesses where slug = '${r.slug}'),
  p_tag := 'website',
  p_document := (select d.document from business_documents d join businesses b on b.id=d.business_id
                 where b.slug = '${r.slug}' order by d.version desc limit 1),
  p_rendered_html := $html$${html}$html$,
  p_created_by := 'patch', p_format := 'html',
  p_owner_id := (select owner_id from businesses where slug = '${r.slug}')
) as result;`);
  const res = execFileSync("supabase", ["db", "query", "--linked", "-f", sqlF], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  console.log(`   written: ${/"ok": true/.test(res) ? "yes" : "NO — " + res.slice(0, 120)}`);
  done++;
}

console.log(`\npages repaired${WRITE ? "" : " (dry run)"}: ${done} · already had it or no fragments: ${skipped} · refused on the proof: ${failed}`);
console.log(`fragment links covered: ${linksCovered}`);
process.exit(failed ? 1 : 0);
