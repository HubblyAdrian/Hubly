/**
 * EVERY STORED PAGE, RUN THROUGH THE PRODUCTION UNSTYLED-PAGE GUARD.
 *
 *   deno run -A scripts/check-page-has-css.ts
 *
 * The guard should hit NOTHING. That is not a weak result — it is the result: the threshold
 * was derived from this distribution with a 3.3× margin below the smallest healthy page, so
 * a hit means either a real unstyled page reached storage, or the corpus has moved and the
 * threshold needs re-deriving. Either is worth a night.
 *
 * It imports `unstyledPageVerdict` from the product rather than re-implementing it — a
 * harness that re-implements a production predicate is measuring its replica (Lesson 34).
 * And it re-exports the corpus from the database every run: a reused export silently
 * undercounts, which is how a sweep comes back clean about pages it never saw.
 *
 * Exit: 0 PASS · 1 FAIL (a page would have been refused) · 2 CANNOT RUN.
 */
import { unstyledPageVerdict, pageOwnStyleBytes, MIN_OWN_STYLE_BYTES, isFullDocument } from "../supabase/functions/_shared/hubly_page_css_guard.ts";

const SQL = `
  select b.slug, b.account_kind,
         to_char(d.created_at,'YYYY-MM-DD') as built_on,
         d.rendered_html as html
  from businesses b
  join lateral (select rendered_html, created_at from business_documents
                 where business_id = b.id and rendered_html is not null
                 order by created_at desc limit 1) d on true
  where length(d.rendered_html) > 500
`;

let out = "";
try {
  const cmd = new Deno.Command("supabase", { args: ["db", "query", "--linked", SQL], stdout: "piped", stderr: "piped" });
  const r = await cmd.output();
  out = new TextDecoder().decode(r.stdout);
  if (!r.success && !out.includes('"rows"')) {
    console.error("CANNOT RUN — supabase db query failed: " + new TextDecoder().decode(r.stderr).slice(0, 300));
    Deno.exit(2);
  }
} catch (e) {
  console.error("CANNOT RUN — supabase CLI not usable: " + String((e as Error).message).slice(0, 200));
  Deno.exit(2);
}

const i = out.indexOf('"rows":');
if (i < 0) { console.error("CANNOT RUN — no rows in the query output"); Deno.exit(2); }
let depth = 0, start = out.indexOf("[", i), end = -1;
for (let k = start; k < out.length; k++) {
  if (out[k] === "[") depth++;
  else if (out[k] === "]") { depth--; if (depth === 0) { end = k + 1; break; } }
}
const rows: { slug: string; account_kind: string; built_on: string; html: string }[] = JSON.parse(out.slice(start, end));
if (!rows.length) { console.error("CANNOT RUN — the corpus came back empty"); Deno.exit(2); }

const hits: string[] = [];
const full: number[] = [], ast: number[] = [];
for (const r of rows) {
  const v = unstyledPageVerdict(r.html);
  (isFullDocument(r.html) ? full : ast).push(pageOwnStyleBytes(r.html));
  if (v.refuse) hits.push(`${r.slug} (${r.account_kind}, built ${r.built_on}) — ${v.bytes}B of its own CSS, mounted in an iframe where nothing else reaches it`);
}
const stat = (a: number[]) => {
  if (!a.length) return "none";
  const s = [...a].sort((x, y) => x - y);
  return `min ${s[0]} · median ${s[Math.floor(s.length / 2)]} · max ${s[s.length - 1]}`;
};
console.log(`pages measured: ${rows.length}   (re-exported from the database this run)`);
console.log(`  full documents (iframe-mounted, guarded): ${full.length}   own <style> bytes: ${stat(full)}`);
console.log(`  AST fragments (shell-styled, not guarded): ${ast.length}   own <style> bytes: ${stat(ast)}`);
console.log(`  floor: ${MIN_OWN_STYLE_BYTES}B`);

if (hits.length) {
  console.error(`\nFAIL — ${hits.length} stored page(s) would be refused by the guard:`);
  for (const h of hits) console.error("  " + h);
  console.error("\nEither a page reached storage unstyled, or the corpus has moved under the threshold. Re-derive the distribution before touching the number.");
  Deno.exit(1);
}
console.log(`\nPASS — no stored page is below the floor. The guard is armed and hits nothing, which is the intended state.`);
