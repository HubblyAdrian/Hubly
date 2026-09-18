#!/usr/bin/env node
/**
 * REMOVE EVERY mailto: FROM THE STORED PAGES — BY TARGETED PATCH, NEVER A REBUILD.
 *
 *   node scripts/patch-remove-mailto.mjs            # dry run: says exactly what it would change
 *   node scripts/patch-remove-mailto.mjs --apply    # writes version max+1, created_by='patch'
 *
 * RULED BY ADRIAN, 2026-09-17: fix hubly_contact.ts, do not lift the ban, and patch the four
 * existing pages. A rebuild is forbidden — it would discard the hand-patch work standing on 164 of
 * 188 live pages.
 *
 * ══ THE RULE, PER ANCHOR, AND WHY IT IS TWO RULES AND NOT ONE ═══════════════════════════════
 *
 * A mailto anchor is one of two different things and they cannot be treated the same:
 *
 *   1. IT IS THE ADDRESS ITSELF — the visible text contains the email. That is INFORMATION, and the
 *      validator's own rejection message says to keep it: "show the address as plain text if it is
 *      useful information". So the element becomes a <span>, keeping its inner markup, its `data-hc`
 *      role (click-to-edit and sync-every-occurrence depend on it) and `data-hubly-email` (the
 *      fact-already-present detector depends on it). A `class="button …"` is DROPPED: it is
 *      information now, and a thing that still looks like a button is a control that does nothing.
 *
 *   2. IT IS A CALL TO ACTION — the visible text is "Email the bakery", "Email for availability".
 *      A span here would be a button-shaped dead control, which is a worse defect than the mailto.
 *      So the element is REMOVED. Every page this touches has a working `tel:` call to action on it
 *      (asserted below, per page), so no route to the business is lost.
 *
 * NO `hubly:contact` CTA IS SUBSTITUTED, and that is a measured decision rather than caution:
 * `wireHublyDocumentReserved` binds the hubly: scheme inside `#hc-doc-root` ONLY. Three of these four
 * pages are FULL DOCUMENTS (`rendered_html` begins `<!doctype`), which hcMountDocumentHtml mounts in
 * an IFRAME — where the parent's click handler cannot reach. A hubly:contact link there is dead for
 * every public visitor. Restoring an email CTA on those pages is a build item, named in
 * docs/OWNER_VERIFICATIONS.md, not something to guess at here.
 *
 * HISTORY IS NOT REWRITTEN. Each page gets a NEW version; the old one stays exactly as it was.
 * `graefs-autocare` is never touched — it has no mailto and it is read-only.
 *
 * Exit: 0 ok · 1 a postcondition failed (nothing written) · 2 cannot run
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const q = (sql) => {
  const out = execFileSync("supabase", ["db", "query", "--linked", sql],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 1024 * 1024 * 1024 });
  const i = out.indexOf('"rows"'); let d = 0, s = out.indexOf("[", i), e = -1;
  for (let k = s; k < out.length; k++) { if (out[k] === "[") d++; else if (out[k] === "]") { d--; if (!d) { e = k + 1; break; } } }
  return JSON.parse(out.slice(s, e));
};
const runFile = (sql, label) => {
  const dir = mkdtempSync(join(tmpdir(), "hubly-patch-"));
  const f = join(dir, label + ".sql");
  writeFileSync(f, sql);
  const out = execFileSync("supabase", ["db", "query", "--linked", "-f", f], { encoding: "utf8", cwd: ROOT });
  if (/"_tag"\s*:\s*"Error"/.test(out)) throw new Error("write failed: " + out.slice(0, 400));
  return f;
};
const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/* ── WHICH PAGES. Derived: every latest version in the document store carrying a mailto. ───────
   Not a list of four slugs typed in — if a fifth page has one, it is patched too, and if one of the
   four has already been fixed it is skipped. A hand-written target list is the disease. */
let targets;
try {
  targets = q(`select b.slug, d.business_id, d.tag, d.version, d.format, d.rendered_html, d.document::text as doc
                 from business_documents d join businesses b on b.id = d.business_id
                where d.version = (select max(v2.version) from business_documents v2
                                    where v2.business_id = d.business_id and v2.tag = d.tag)
                  and ( d.rendered_html like '%mailto:%' or d.document::text like '%mailto:%' )
                order by b.slug`);
} catch (err) { console.error("CANNOT RUN — " + String(err.message).slice(0, 300)); process.exit(2); }

if (!targets.length) { console.log("Nothing to patch: no latest stored version carries a mailto:.\n"); process.exit(0); }
console.log(`DERIVED TARGETS — ${targets.length} page(s) whose LATEST version carries a mailto:\n`);

const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const stripTags = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Rewrite the mailto anchors in an HTML string. Returns {html, spans, removed, kept}. */
function fixHtml(html) {
  let spans = 0, removed = 0;
  const out = String(html).replace(
    /<a\b([^>]*\bhref="mailto:[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi,
    (whole, attrs, inner) => {
      const text = stripTags(inner);
      const isAddress = EMAIL_RX.test(text);
      if (!isAddress) { removed++; return ""; }              // rule 2: a CTA leaves no dead button
      spans++;
      const keep = attrs
        .replace(/\s*href="mailto:[^"]*"/i, "")
        .replace(/\s*class="[^"]*\bbutton\b[^"]*"/i, "")      // information, not a control
        .trim();
      return `<span${keep ? " " + keep : ""}>${inner}</span>`;
    });
  return { html: out, spans, removed };
}

/** The same two rules over an AST.
 *
 *  THE FIRST VERSION OF THIS DESCENDED THROUGH `children` ONLY, so for a document shaped
 *  `{ root: { … } }` it never entered the tree at all: it reported "0 anchors rewritten" and the
 *  postcondition below caught the surviving mailto and refused to write. That is the failure mode
 *  this whole round is about — a transform that silently does nothing, reported as success — and it
 *  was caught by an assertion rather than by reading the code, which is the point of having one.
 *
 *  It now descends through EVERY key of every object, so the tree's shape is not something this
 *  function has to know. A node is recognised by what it IS (tag 'a' with a mailto href), never by
 *  where it sits. */
function fixAst(json) {
  let spans = 0, removed = 0;
  const textOf = (n) => typeof n === "string" ? n
    : Array.isArray(n) ? n.map(textOf).join(" ")
    : (n && typeof n === "object") ? Object.values(n).map(textOf).join(" ") : "";
  const walk = (n) => {
    if (Array.isArray(n)) return n.map(walk).filter((x) => x !== null);
    if (!n || typeof n !== "object") return n;
    const href = n.attrs && typeof n.attrs.href === "string" ? n.attrs.href : "";
    if (String(n.tag || "").toLowerCase() === "a" && /^mailto:/i.test(href)) {
      if (!EMAIL_RX.test(textOf(n.children))) { removed++; return null; }        // rule 2
      spans++;
      const attrs = { ...n.attrs }; delete attrs.href;
      if (typeof attrs.class === "string") {
        attrs.class = attrs.class
          .replace(/\b(bg-\S+|text-white|shadow-\S+|rounded-\S+|px-\d+|py-\d+|font-bold)\b/g, "")
          .replace(/\s+/g, " ").trim();
        if (!attrs.class) delete attrs.class;
      }
      const out = { ...n, tag: "span", attrs };
      if (out.children != null) out.children = walk(out.children);
      return out;
    }
    const copy = {};
    for (const [k, v] of Object.entries(n)) copy[k] = walk(v);
    return copy;
  };
  return { ast: walk(json), spans, removed };
}

let failures = 0, written = 0;
for (const t of targets) {
  const before = String(t.rendered_html || "");
  const tels = (before.match(/href="tel:/gi) || []).length;
  const r = fixHtml(before);
  let docOut = null, dSpans = 0, dRemoved = 0;
  if (String(t.doc || "").includes("mailto:")) {
    const { ast, spans, removed } = fixAst(JSON.parse(t.doc));
    docOut = JSON.stringify(ast); dSpans = spans; dRemoved = removed;
  }

  console.log(`  ${t.slug}  ${t.tag} v${t.version} (${t.format})`);
  console.log(`      rendered_html: ${r.spans} address anchor(s) -> <span>, ${r.removed} CTA(s) removed` +
              (docOut ? ` · document AST: ${dSpans} -> span, ${dRemoved} removed` : ""));
  console.log(`      tel: call-to-action(s) still on the page: ${tels}`);

  /* ── POSTCONDITIONS. Asserted before anything is written, and a failure writes NOTHING. ───── */
  const problems = [];
  if (/mailto:/i.test(r.html)) problems.push("a mailto: survived the rewrite of rendered_html");
  if (docOut && /mailto:/i.test(docOut)) problems.push("a mailto: survived the rewrite of the AST");
  if (r.removed > 0 && tels === 0)
    problems.push(`${r.removed} email CTA(s) removed from a page with NO tel: call to action — that ` +
      `would leave a visitor no way to reach the business, which is worse than the mailto`);
  for (const m of before.match(new RegExp(EMAIL_RX.source, "g")) || []) {
    if (!r.html.includes(m)) problems.push(`the address ${m} disappeared entirely — it must survive as text`);
  }
  if (r.html.length > before.length) problems.push("the page got LONGER, which this transform cannot do");
  if (before.length - r.html.length > 1200) problems.push(`removed ${before.length - r.html.length} bytes — too much for ${r.spans + r.removed} anchor(s)`);
  if (problems.length) {
    for (const p of problems) console.error(`      POSTCONDITION FAILED — ${p}`);
    failures++; continue;
  }
  console.log(`      postconditions: mailto gone · every address still present as text · ${before.length - r.html.length} bytes smaller`);

  if (!APPLY) { console.log(`      (dry run — pass --apply to write version ${t.version + 1})\n`); continue; }

  const sql =
    `-- TARGETED PATCH, ${t.slug} ${t.tag}: remove every mailto: anchor. A NEW VERSION — the old one\n` +
    `-- stays exactly as it was, because history is not rewritten and a rebuild is forbidden.\n` +
    `insert into public.business_documents (business_id, tag, version, document, rendered_html, created_by, format)\n` +
    `values (${sq(t.business_id)}, ${sq(t.tag)}, ${t.version + 1}, ${sq(docOut ?? t.doc)}::jsonb, ${sq(r.html)}, 'patch', ${sq(t.format)});\n`;
  runFile(sql, `patch-${t.slug}`);
  const back = q(`select version, (rendered_html like '%mailto:%') as html_has, (document::text like '%mailto:%') as doc_has
                    from business_documents where business_id=${sq(t.business_id)} and tag=${sq(t.tag)}
                   order by version desc limit 1`)[0];
  if (Number(back.version) !== t.version + 1 || back.html_has || back.doc_has) {
    console.error(`      WROTE BUT THE READ-BACK DISAGREES: ${JSON.stringify(back)}`);
    failures++; continue;
  }
  console.log(`      WROTE v${back.version} and read it back: no mailto in either column\n`);
  written++;
}

console.log(`${written} page(s) patched · ${failures} refused on a postcondition.`);
if (!APPLY) console.log(`Dry run. Nothing was written.`);
process.exit(failures ? 1 : 0);
