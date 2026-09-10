/**
 * WOULD THE EYEBROW ANCHOR HAVE BEEN FOUND? Measured over every stored page.
 *
 * Naming a business must patch its page, and a patch needs an anchor stamped at build
 * time. An empty wordmark has no text to find — but the EYEBROW does, and it is composed
 * from trade and city, both of which we hold on the record. That is the same class of
 * known string as a service name, so markServiceAnchorsInFreeform's mechanism applies.
 *
 * This measures the residual risk Adrian asked to have counted rather than argued: the
 * model may phrase the header as something we cannot match ("Portraits & Milestones"
 * rather than trade and place). Costs no quota — it reads stored HTML.
 *
 * Exit: 0 always. This reports, it does not judge.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function sql(q) {
  const out = execFileSync("supabase", ["db", "query", "--linked", q], { encoding: "utf8", cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
  const i = out.indexOf('"rows":');
  if (i < 0) return [];
  let d = 0, st = out.indexOf("[", i), en = -1;
  for (let k = st; k < out.length; k++) {
    if (out[k] === "[") d++;
    else if (out[k] === "]") { d--; if (d === 0) { en = k + 1; break; } }
  }
  return JSON.parse(out.slice(st, en));
}

const norm = (s) => String(s || "").replace(/&amp;/g, "&").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

/** Leaf elements, exactly as findServiceNameElement reads them. */
function leaves(html) {
  const out = [];
  const re = /<([a-z0-9]+)\b([^>]*)>([^<]*)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (text) out.push({ tag: m[1].toLowerCase(), attrs: m[2], text });
  }
  return out;
}

/** The strings we would look for: the name if there is one, else trade/place forms. */
function candidates(row) {
  const out = [];
  if (row.name) out.push(String(row.name));
  const trade = String(row.business_type || "").replace(/_/g, " ").trim();
  const city = String(row.city || "").trim();
  if (trade && city) out.push(`${trade} · ${city}`, `${trade} — ${city}`, `${trade}, ${city}`, `${trade} ${city}`);
  if (trade) out.push(trade);
  if (city) out.push(city);
  return out.filter(Boolean);
}

const rows = sql(`
  select b.slug, b.name, b.business_type, b.city, b.name_unset,
         length(d.rendered_html) as bytes, d.rendered_html as html
  from businesses b
  join lateral (select rendered_html, created_at from business_documents
                 where business_id = b.id and rendered_html is not null
                 order by created_at desc limit 1) d on true
  where length(d.rendered_html) > 500
`);

let hit = 0, miss = 0;
const misses = [];
const byKind = { named: { hit: 0, miss: 0 }, unnamed: { hit: 0, miss: 0 } };

for (const r of rows) {
  const kind = r.name_unset ? "unnamed" : "named";
  const cands = candidates(r).map(norm).filter(Boolean);
  const els = leaves(r.html);
  const found = cands.length > 0 && els.some((e) => {
    const t = norm(e.text);
    return cands.some((c) => t === c || (c.length > 3 && t.startsWith(c)));
  });
  if (found) { hit++; byKind[kind].hit++; }
  else {
    miss++; byKind[kind].miss++;
    const head = els.slice(0, 6).map((e) => e.text.slice(0, 34)).join(" | ");
    misses.push(`${r.slug} (${kind}, trade=${r.business_type || "-"}, city=${r.city || "-"}) — first text: ${head}`);
  }
}

const pct = (a, b) => (b === 0 ? "n/a" : `${((a / b) * 100).toFixed(1)}%`);
console.log(`\nPAGES MEASURED: ${rows.length}  (every business with a stored rendered_html)`);
console.log(`  anchor findable : ${hit}  (${pct(hit, rows.length)})`);
console.log(`  MISSED          : ${miss}  (${pct(miss, rows.length)})`);
console.log(`\n  named pages   : ${byKind.named.hit} found / ${byKind.named.hit + byKind.named.miss} — the name itself is the known text`);
console.log(`  unnamed pages : ${byKind.unnamed.hit} found / ${byKind.unnamed.hit + byKind.unnamed.miss} — the eyebrow is the known text`);
if (misses.length) {
  console.log(`\nMISSES — what the header actually says:`);
  for (const m of misses.slice(0, 25)) console.log(`  ${m}`);
  if (misses.length > 25) console.log(`  ... and ${misses.length - 25} more`);
}
