/**
 * Re-render an existing Hubly Document through the CURRENT renderer.
 *
 * WHY THIS EXISTS
 *
 * business_documents stores both the document JSON and the rendered_html, and
 * the public site reads the stored HTML. That means every improvement to
 * renderHublyDocument reaches only documents generated AFTER it. Existing sites
 * keep whatever markup they were born with, forever.
 *
 * This was invisible until it wasn't: on 2026-08-17 renderAttrs began emitting
 * anchor ids (it never had, so every `href="#anchor"` on every page ever
 * generated pointed at nothing) and a header/footer was added. Documents from
 * an hour earlier still had neither, and a reasonable person looking at one
 * concluded the fix had not worked. It had — it just is not retroactive.
 *
 * WHAT IT DOES NOT DO
 *
 * It never calls the model and never changes the document JSON. It reads the
 * stored tree, re-runs the renderer over it, and writes a NEW VERSION through
 * create_business_document — the same RPC the capability uses. Nothing is
 * overwritten, the previous version stays queryable, and rolling back means
 * ignoring the new row.
 *
 * AUTHORISATION
 *
 * A draft_token is required per business, exactly as for any other draft edit.
 * There is deliberately no bulk "re-render everything" mode: a business whose
 * token you do not hold is a business you have no business rewriting.
 *
 * Usage:
 *   deno run --allow-net --allow-env scripts/rerender-business-document.ts \
 *     <business_id> <draft_token> [tag]
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { renderHublyDocument } from "../supabase/functions/_shared/hubly_document.ts";

const URL_ = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_ANON_KEY");
if (!URL_ || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY must be set.");
  Deno.exit(1);
}

const [businessId, draftToken, tagArg] = Deno.args;
if (!businessId || !draftToken) {
  console.error("usage: rerender-business-document.ts <business_id> <draft_token> [tag]");
  Deno.exit(1);
}
const tag = tagArg || "website";
const headers = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function get(path: string) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return await r.json();
}

const bizRows = await get(
  `businesses?select=id,name,phone,slug,brand_color&id=eq.${businessId}`,
);
const biz = bizRows[0];
if (!biz) {
  console.error(`No business ${businessId}.`);
  Deno.exit(1);
}

const docRows = await get(
  `business_documents?select=document,version,design_rationale&business_id=eq.${businessId}&tag=eq.${tag}&order=version.desc&limit=1`,
);
const latest = docRows[0];
if (!latest?.document) {
  console.error(`No ${tag} document for ${biz.slug}.`);
  Deno.exit(1);
}

const doc = latest.document.root ? latest.document : { root: latest.document };
const html = renderHublyDocument(doc, {
  businessId,
  businessName: biz.name || "",
  businessPhone: biz.phone || undefined,
  businessBrandColor: biz.brand_color || undefined,
});

// Report what actually changed, rather than claiming success. The two counts
// below are the exact things that were broken before 2026-08-17, so a re-render
// that does not move them is a re-render that did nothing.
const anchorIds = (html.match(/ id="hd-/g) || []).length;
const hasChrome = /hd-chrome-header/.test(html);
console.log(`${biz.slug}  v${latest.version} -> re-rendered`);
console.log(`  anchor ids: ${anchorIds}   chrome: ${hasChrome ? "yes" : "NO"}   bytes: ${html.length}`);

const res = await fetch(`${URL_}/rest/v1/rpc/create_business_document`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    p_business_id: businessId,
    p_draft_token: draftToken,
    p_tag: tag,
    p_document: doc,
    p_rendered_html: html,
    p_created_by: "patch",
    p_design_rationale: latest.design_rationale || null,
  }),
});
const out = await res.json();
if (!res.ok || out?.ok === false) {
  console.error("  write FAILED:", JSON.stringify(out));
  Deno.exit(1);
}
console.log(`  wrote v${out.version ?? "(new)"}`);
