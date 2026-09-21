#!/usr/bin/env node
/**
 * [RULE] THE ASSISTANT REACHES COMMERCE ONLY THROUGH commerce-api, AND WHAT IT IMPORTS IS A DRAFT.
 *
 *   node scripts/check-the-ai-writes-commerce-only-through-the-api.mjs
 *
 * ══ THE ARCHITECTURE THIS DEFENDS ═══════════════════════════════════════════════════════════
 *
 *     AI  →  capability action  →  commerce-api  →  commerce_products
 *
 * The model supplies CONTENT. The server owns ids, business_id, slugs, validation, persistence
 * and authorisation. `callCommerceApi` sends the OWNER'S OWN JWT, so the endpoint applies exactly
 * the authorisation it applies to the owner's Store screen — the assistant never holds
 * service-role and never touches a table.
 *
 * ══ WHY THE HANDLER IS EXECUTED AND NOT READ ════════════════════════════════════════════════
 *
 * These legs bundle the real registry, take the real `importProducts` action, and CALL it with
 * `fetch` stubbed — so what is asserted is the request the shipping handler actually makes. A leg
 * that grepped the source for "callCommerceApi" would pass just as well against a handler that
 * called it and then wrote a table anyway.
 *
 * Exit: 0 PASS · 1 FAIL · 2 CANNOT RUN
 */
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { declareBreak } from "./lib/redproof.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const legs = [];
const leg = (kind, name, pass, detail) => { legs.push({ kind, name, pass: !!pass, detail });
  console.log(`  ${pass ? "ok  " : "FAIL"} [${kind}] ${name}\n        ${detail}`); };

/* The edge runtime's globals, minimally, so the shipping module can execute here. */
globalThis.Deno = globalThis.Deno || { env: { get: () => "https://stub.invalid" } };

let REGISTRY;
try {
  const js = execFileSync("npx", ["--yes", "esbuild", "--bundle", "--format=esm", "--platform=neutral",
    "--log-level=error", join(ROOT, "supabase/functions/_shared/hubly_capability_registry.ts")],
    { encoding: "utf8", cwd: ROOT, timeout: 240000, maxBuffer: 128 * 1024 * 1024 });
  /* The bundle keeps one remote import (`https://esm.sh/@supabase/supabase-js@2`) that Node's ESM
   * loader cannot fetch. It is replaced with a local stub rather than mocked away: nothing in the
   * path under test constructs a supabase client — this action goes over HTTP — so the stub being
   * inert is itself part of what is being asserted. If a future handler DID build a client, it
   * would fail loudly here rather than quietly writing a table. */
  const stubbed = js.replace(
    /import\s*\{([^}]*)\}\s*from\s*"https:\/\/esm\.sh\/@supabase\/supabase-js@2";?/g,
    (_m, names) => names.split(",").map((n) => {
      const local = n.trim().split(/\s+as\s+/).pop().trim();
      return `const ${local} = () => { throw new Error("supabase client constructed in a path that must go through commerce-api"); };`;
    }).join("\n"),
  );
  ({ HUBLY_CAPABILITY_REGISTRY: REGISTRY } = await import("data:text/javascript;base64," + Buffer.from(stubbed).toString("base64")));
} catch (e) {
  console.error("CANNOT RUN — could not load the capability registry: " + String(e.message).split("\n")[0]);
  process.exit(2);
}
const storefront = (REGISTRY || []).find((c) => c.name === "storefront");
const action = storefront && (storefront.actions || []).find((a) => a.name === "importProducts");
if (!action) { console.error("CANNOT RUN — storefront.importProducts is not in the registry"); process.exit(2); }

/* ── DRIVE THE REAL HANDLER, capturing what it sends ────────────────────────────────────────── */
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  let body = null; try { body = JSON.parse(String((init || {}).body || "null")); } catch (_) {}
  sent.push({ url: String(url), method: (init || {}).method, headers: (init || {}).headers || {}, body });
  return { status: 201, json: async () => ({
    imported: 2, created: 2, skipped: 1, failed: 0, products: [{ id: "srv-1" }, { id: "srv-2" }],
    rejected: [{ sourceIndex: 2, name: "House Salad", slug: "house-salad", reason: "duplicate_in_request",
                 detail: '"House Salad" produces the same web address (house-salad) as row 2 in this same import.' }],
  }) };
};
let result;
try {
  result = await action.handler({
    _ownerToken: "owner-jwt-stub",
    businessId: "biz-1",
    /* THE MODEL TRIES TO SEND WHAT IT MUST NOT. A fixture of well-behaved rows would prove only
     * that this model did not attempt it; leg 2 has to show the handler REFUSING. The extra keys
     * here are exactly the ones the server owns. */
    products: [
      { name: "Burger", price: 12.5, description: "Quarter pound." },
      { name: "House Salad", price: 8 },
      { name: "House Salad", price: 9 },
      { name: "Coke", price: 3, status: "active", id: "model-invented-id",
        business_id: "some-other-business", slug: "model-chosen-slug" },
    ],
  });
} catch (e) {
  globalThis.fetch = realFetch;
  console.error("CANNOT RUN — the handler threw: " + String(e.message).split("\n")[0]);
  process.exit(2);
} finally { globalThis.fetch = realFetch; }

const req = sent[0] || {};
console.log(`  requests made: ${sent.length}`);
console.log(`  → ${req.method} ${req.url}`);
console.log(`  rows sent: ${JSON.stringify((req.body || {}).rows)}`);
console.log(`  summary: ${result && result.summary}\n`);

/* ── LEG 1 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "1 the action reaches commerce_products only through the commerce-api import route",
  why: "point the action at a different route. The boundary this whole phase exists to keep — " +
       "one owner-gated endpoint owning every Commerce write — stops being the only way in.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: `        const r = await callCommerceApi(ctx.ownerToken, "POST", "/products/import", {`,
  with: `        const r = await callCommerceApi(ctx.ownerToken, "POST", "/products", {`,
});
{
  const one = sent.length === 1;
  const route = /\/functions\/v1\/commerce-api\/products\/import$/.test(req.url || "");
  const ownerJwt = String((req.headers || {}).authorization || "") === "Bearer owner-jwt-stub";
  const noTableWrite = !/\.from\(\s*["'`]commerce_/.test(String(action.handler));
  leg("RULE", "1 the action reaches commerce_products only through the commerce-api import route",
    one && route && ownerJwt && noTableWrite,
    `exactly one outbound request (${sent.length}), to ${req.url}, carrying the OWNER'S token ` +
    `(${ownerJwt}) rather than any service-role key; and the shipping handler contains no ` +
    `\`.from("commerce_…")\` table write (${noTableWrite}). Executed, not grepped — a handler that ` +
    `called the API and then wrote a table anyway would pass a source scan.`);
}

/* ── LEG 2 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "2 the model cannot supply an id, a business_id, a slug or a status",
  why: "let a model-supplied status through. The assistant can then publish on import — twenty " +
       "items it read off a photograph in front of customers, with nobody having looked.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: `          if (p?.inventory != null) row.inventory = Number(p.inventory);
          // PROVENANCE, so the owner's Store can tell what a model produced from what he typed.`,
  with: `          if (p?.inventory != null) row.inventory = Number(p.inventory);
          if (p?.status != null) row.status = String(p.status);
          // PROVENANCE, so the owner's Store can tell what a model produced from what he typed.`,
});
{
  const rows = (req.body || {}).rows || [];
  const forbidden = ["id", "business_id", "slug", "status"];
  const rowsClean = rows.every((r) => forbidden.every((k) => !(k in r)));
  const itemProps = ((action.argsSchema || {}).properties || {}).products?.items?.properties || {};
  const schemaClean = forbidden.every((k) => !(k in itemProps)) && !("makeAvailable" in itemProps) &&
                      !("makeAvailable" in ((action.argsSchema || {}).properties || {}));
  const serverOwnsBiz = (req.body || {}).business_id === "biz-1";
  leg("RULE", "2 the model cannot supply an id, a business_id, a slug or a status",
    rowsClean && schemaClean && serverOwnsBiz,
    `no row carries id/business_id/slug/status (${rowsClean}); the action's own schema offers the ` +
    `model none of them and has no publish switch (${schemaClean}); business_id on the envelope ` +
    `comes from the owner context, not the model (${serverOwnsBiz}). The schema half matters as ` +
    `much as the payload half — a model cannot send a field it was never offered.`);
}

/* ── LEG 3 ────────────────────────────────────────────────────────────────────────────────── */
declareBreak({
  leg: "3 rejected rows are named back to the owner, not collapsed into a count",
  why: "report only the number that went in. The owner is told 'added 2' and never learns that " +
       "his second House Salad is missing — the original defect, moved one layer up.",
  file: "supabase/functions/_shared/hubly_capability_registry.ts",
  find: `          summary: problems.length
            ? \`\${head} \${problems.length} didn't go in — \${problems.join(" ")} What would you like to do about \${problems.length === 1 ? "it" : "those"}?\``,
  with: `          summary: problems.length
            ? \`\${head}\``,
});
{
  const s = String((result || {}).summary || "");
  const namesIt = s.includes("House Salad");
  const asks = /what would you like|which|\?/i.test(s);
  const saysDraft = /draft/i.test(s);
  leg("RULE", "3 rejected rows are named back to the owner, not collapsed into a count",
    namesIt && asks && saysDraft,
    `the reply names the rejected row ("House Salad": ${namesIt}), asks what to do about it ` +
    `(${asks}), and says what was created is a draft (${saysDraft}). Reporting "added 2" and ` +
    `stopping would re-create the swallowed-row defect one layer above the endpoint that was ` +
    `just fixed.`);
}

const bad = legs.filter((l) => !l.pass);
// not-a-corpus-rate: this check's own leg count, not a corpus
console.log(`\n  ${bad.length ? "FAIL" : "PASS"} — ${legs.length - bad.length}/${legs.length} legs`);
process.exit(bad.length ? 1 : 0);
