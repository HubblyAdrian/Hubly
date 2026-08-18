// supabase/functions/_shared/hubly_capability_registry.ts
//
// The Hubly Capability Registry — owned by the Hubly platform, not by any
// one interface. This is Hubly Core infrastructure.
//
// Not the legacy hubly_brain_capabilities.ts. That file belongs to the frozen
// Legacy Brain architecture and must not be extended or reused here — this is
// a deliberately separate, new registry.
//
// Shape: a Capability is a named area of what Hubly can do (Website, Booking,
// CRM, Marketing, ...). A Capability exposes one or more named Actions — the
// concrete, callable operations within it (e.g. Website: analyze, generate,
// update, publish). Consumers (the Hubly Conversation service today; the
// dashboard, Studio, Marketplace, or a future Hubly agent tomorrow) ask
// "which capability solves this?" and then invoke one of its actions. The
// registry doesn't know or care who's asking.
//
// Rules this file exists to satisfy:
// - Every capability and action is defined in exactly one place: this file.
//   Nothing about what a capability does is duplicated anywhere else — any
//   consumer's prompt/UI text describing available capabilities is generated
//   FROM this registry, never hand-written to describe it.
// - This registry dispatches; it never implements. An action's handler either
//   calls an existing backend service (that service remains the source of
//   truth) or, if no real backend exists yet, returns an honest "not real
//   yet" result. `real` must be revisited the moment the underlying
//   capability actually gets built — a stale `real:false` is the same
//   failure mode as fabricated analysis, just delayed.
// - Adding a Hubly Core capability (or a new action on an existing one) means
//   adding one entry here. No consumer's orchestration logic should ever
//   need to change to support it.
//
// Current scope note: capability/action names below cover only what's real
// today (website analysis, and honest stopgaps for social/listing analysis).
// The mapping of these names onto the full 14-group Hubly Core list is not
// finalized — that's a product-design decision, not something to lock in
// here. New capabilities (booking, crm, marketing, ...) get added as they're
// actually built, per "build on demand," not stubbed in speculatively.

import { HublyAI, extractJson } from "./hubly_ai.ts";
import { issueDraftGrant } from "./draft_grant.ts";
import {
  validateStorefrontAst,
  storefrontCatalogPromptBlock,
  buildDefaultStorefront,
  type StorefrontAst,
} from "./storefront_ast.ts";
import {
  validateHublyDocument,
  renderHublyDocument,
  buildDocumentSchemaPromptBlock,
  buildDesignRationaleInstructions,
  applyPatchOps,
  describePatchEffect,
  humanPatchSummary,
  type VocabularyRejections,
  type HublyDocument,
} from "./hubly_document.ts";
import { adminClient } from "./marketplace_provider.ts";
import { getWebsiteAvailability, createWebsiteBookingJob } from "./hubly_booking_execution.ts";
import { buildPageStructureBlock, paletteById, palettePromptList, sectionOrderFor } from "./site_identity.ts";

const APP_ORIGIN = (Deno.env.get("HUBLY_APP_ORIGIN") || "").trim() || "https://myhubly.app";

export type CapabilityActionArgSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type CapabilityActionResult = {
  ok: boolean;
  /** Did genuine backend work actually happen, or is this a best-effort/limited stopgap? */
  real: boolean;
  /** Honest, human-readable account of what happened — consumers should rely on this and nothing more. */
  summary: string;
  raw?: unknown;
  error?: string;
};

export type CapabilityAction = {
  name: string;
  description: string;
  argsSchema: CapabilityActionArgSchema;
  handler: (args: Record<string, unknown>) => Promise<CapabilityActionResult>;
};

export type Capability = {
  name: string;
  description: string;
  actions: CapabilityAction[];
};

async function callImportAnalyze(type: string, url: string): Promise<any> {
  const res = await fetch(`${APP_ORIGIN}/api/import-analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, url }),
  });
  return await res.json().catch(() => null);
}

// Same reuse pattern as callImportAnalyze above, one function over: the
// booking capability wraps the marketplace Edge Function's real,
// already-production booking_slots/booking_create actions over HTTP,
// exactly like a real customer-facing caller would — no booking logic
// lives here, no calendar/provider logic is touched or duplicated.
async function callMarketplace(action: string, payload: Record<string, unknown>): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/functions/v1/marketplace`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return await res.json().catch(() => null);
}

// Same reuse pattern one function over again: the business capability wraps
// the real start_business_in_progress / patch_business_in_progress Postgres
// functions (20260803120000_business_in_progress.sql) directly over
// PostgREST's /rpc/ endpoint — no business-record logic lives here.
async function callBusinessRpc(fn: string, payload: Record<string, unknown>): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

/** Same service-role pattern as callBusinessRpc, for a plain read instead
 *  of a mutation — render context (real name/phone) and the latest stored
 *  Hubly Document both need this. */
async function selectOne(table: string, filterCol: string, filterVal: string, columns: string): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const url = `${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}&select=${encodeURIComponent(columns)}&limit=1`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function selectLatestBusinessDocument(businessId: string, tag: string): Promise<{ version: number; document: HublyDocument } | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const url = `${supabaseUrl}/rest/v1/business_documents?business_id=eq.${encodeURIComponent(businessId)}&tag=eq.${encodeURIComponent(tag)}&select=version,document&order=version.desc&limit=1`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey } });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows) || !rows.length) return null;
  return { version: rows[0].version, document: rows[0].document as HublyDocument };
}

// ── Storefront capability helpers ──────────────────────────────────────────
// The owner operates their real Store through the AI. Every write goes through the
// owner-gated Commerce API (commerce-api) authenticated AS THE OWNER — the exact same
// endpoints the Store admin UI uses. Nothing here writes commerce tables directly, and
// there is no second catalog/cart/checkout. The owner's access token + businessId are
// injected by the engine (never seen or transcribed by the model), same discipline as
// booking's businessId and business's draftToken.
async function callCommerceApi(
  ownerToken: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const anon = (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "").trim();
  const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${ownerToken}` };
  if (anon) headers.apikey = anon;
  const res = await fetch(`${supabaseUrl}/functions/v1/commerce-api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function sfNorm(s: unknown): string {
  return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a human name to exactly one item, or report ambiguity/absence — never guess.
 *  An exact match still counts as ambiguous when a superset name exists (e.g. "Premium
 *  Soap" when "Premium Soap 5 Gallon" also exists), so the model is forced to ask. */
function sfResolveByName<T extends Record<string, unknown>>(
  list: T[],
  query: string,
  nameKey = "name",
): { item: T } | { ambiguous: string[] } | { none: true } {
  const q = sfNorm(query);
  if (!q) return { none: true };
  const exact = list.filter((p) => sfNorm(p[nameKey]) === q);
  const supersets = list.filter((p) => sfNorm(p[nameKey]) !== q && sfNorm(p[nameKey]).startsWith(q + " "));
  if (exact.length === 1 && supersets.length === 0) return { item: exact[0] };
  const contains = list.filter((p) => sfNorm(p[nameKey]).includes(q));
  if (contains.length === 1) return { item: contains[0] };
  const candidates = (contains.length ? contains : exact).map((p) => String(p[nameKey]));
  if (!candidates.length) return { none: true };
  return { ambiguous: candidates };
}

async function sfFetchProducts(ownerToken: string, businessId: string): Promise<any[]> {
  const r = await callCommerceApi(ownerToken, "GET", `/products?business_id=${encodeURIComponent(businessId)}`);
  return Array.isArray(r.json?.products) ? r.json.products : [];
}
async function sfFetchCollections(ownerToken: string, businessId: string): Promise<any[]> {
  const r = await callCommerceApi(ownerToken, "GET", `/collections?business_id=${encodeURIComponent(businessId)}`);
  return Array.isArray(r.json?.collections) ? r.json.collections : [];
}
async function sfFetchVariants(ownerToken: string, businessId: string, productId: string): Promise<any[]> {
  const r = await callCommerceApi(ownerToken, "GET", `/products/${encodeURIComponent(productId)}/variants?business_id=${encodeURIComponent(businessId)}`);
  return Array.isArray(r.json?.variants) ? r.json.variants : [];
}

/** Standard "owner context missing" guard for every storefront handler. */
function sfOwnerCtx(args: Record<string, unknown>): { ownerToken: string; businessId: string } | null {
  const ownerToken = String(args._ownerToken || "").trim();
  const businessId = String(args.businessId || "").trim();
  if (!ownerToken || !businessId) return null;
  return { ownerToken, businessId };
}
const SF_NO_CTX: CapabilityActionResult = {
  ok: false, real: false,
  summary: "The Store isn't available in this conversation yet.",
  error: "no_owner_context",
};
function sfDollars(n: unknown): number { return Number(n) || 0; }

/** Generate or patch a Storefront AST with the model, constrained to the block catalog and
 *  the business's REAL Commerce catalog. Falls back to a deterministic default when the AI
 *  is unavailable or returns nothing usable. Never copies product data into the AST — only
 *  references ids, and drops any id the model invented that isn't real (SSOT enforcement). */
async function sfBuildStorefrontAst(
  ownerToken: string,
  businessId: string,
  opts: { brief?: string; instruction?: string; currentAst?: unknown; businessName?: string; accent?: string | null },
): Promise<{ ast: StorefrontAst; real: boolean }> {
  const [products, collections] = await Promise.all([
    sfFetchProducts(ownerToken, businessId),
    sfFetchCollections(ownerToken, businessId),
  ]);
  const pFacts = products.map((p) => ({ id: p.id, name: p.name, price: (Number(p.price_cents) || 0) / 100, status: p.status, featured: !!p.featured }));
  const cFacts = collections.map((c) => ({ id: c.id, name: c.name }));
  const fallback = (): StorefrontAst => buildDefaultStorefront({ businessName: opts.businessName, accent: opts.accent ?? null, products: pFacts, collections: cFacts });

  if (!HublyAI.isConfigured("openai")) return { ast: fallback(), real: false };

  const isPatch = !!opts.currentAst && !!opts.instruction;
  const system =
    `You design a business's standalone online Store presentation as a Storefront AST (JSON). ${storefrontCatalogPromptBlock()}\n` +
    `theme.style is one of: clean, premium, bold, minimal, warm. theme.accent is a hex color or null.\n` +
    `Design for SELLING PRODUCTS — a real store, not a business homepage. Order blocks to merchandise well, reference only real product/collection ids from the catalog, and never place product names or prices in the AST. Return ONLY: {"theme":{"style":...,"accent":...},"blocks":[{"type":...,"variant":...,"visible":true,"config":{...}}]}`;
  const catalogText = `THIS BUSINESS'S REAL COMMERCE CATALOG:\nProducts: ${JSON.stringify(pFacts)}\nCollections: ${JSON.stringify(cFacts)}`;
  const userText = isPatch
    ? `Current Storefront AST:\n${JSON.stringify(opts.currentAst)}\n\n${catalogText}\n\n` +
      `Apply the owner's change as the SMALLEST edit — keep every other block, its order, and its config exactly as-is unless the change requires otherwise. Map plain language to blocks/variants: "bigger/larger product cards" → set the product block's variant to "large"; "smaller cards" → "compact"; "add a best sellers section" → add a bestSellers block; "put X first" → move/feature that product's id to the front of a product block; "more premium" → theme.style="premium" and refine hero copy. Return the COMPLETE updated AST. The change: "${opts.instruction}"`
    : `${catalogText}\n\nBuild a storefront.${opts.brief ? ` The owner's guidance: "${opts.brief}".` : ""}`;
  try {
    const ai = await HublyAI.complete({ feature: "storefront-build", task: "storefront_build", system, messages: [{ role: "user", content: userText }], jsonMode: true });
    // extractJson returns a STRING; validateStorefrontAst needs a parsed object.
    let parsed: unknown = null;
    try { parsed = JSON.parse(extractJson(String(ai?.text || ""))); } catch { parsed = null; }
    const { ast, ok } = validateStorefrontAst(parsed);
    if (!ok) return { ast: fallback(), real: false };
    const validPids = new Set(products.map((p) => String(p.id)));
    const validCids = new Set(collections.map((c) => String(c.id)));
    for (const b of ast.blocks) {
      if (Array.isArray(b.config.productIds)) b.config.productIds = (b.config.productIds as string[]).filter((id) => validPids.has(id));
      if (b.config.collectionId && !validCids.has(String(b.config.collectionId))) b.config.collectionId = null;
    }
    return { ast, real: true };
  } catch (_e) {
    return { ast: fallback(), real: false };
  }
}

type UsageTotal = { promptTokens: number; completionTokens: number; reasoningTokens: number; calls: number };
/** firstAttemptOk/firstAttemptErrors expose whether a retry was actually
 *  needed and, if so, the real validator errors that triggered it — the
 *  honest basis for a retry-rate metric and root-cause diagnosis, never
 *  inferred from call count alone (a retry can also be triggered by an
 *  empty completion or unparseable JSON, which look identical from the
 *  outside without this). */
export type DocGenOutcome =
  | { ok: true; document: HublyDocument; usage: UsageTotal; rejections?: VocabularyRejections; firstAttemptOk: boolean; firstAttemptErrors?: { path: string; message: string }[]; modelUsed?: string; rationale?: string | null }
  | { ok: false; errors: { path: string; message: string }[]; usage: UsageTotal; rejections?: VocabularyRejections; firstAttemptOk: boolean; firstAttemptErrors?: { path: string; message: string }[]; modelUsed?: string; rationale?: string | null };

function emptyUsage(): UsageTotal {
  return { promptTokens: 0, completionTokens: 0, reasoningTokens: 0, calls: 0 };
}
function addUsage(total: UsageTotal, u?: { promptTokens: number; completionTokens: number; reasoningTokens?: number }) {
  if (!u) return;
  total.promptTokens += u.promptTokens;
  total.completionTokens += u.completionTokens;
  total.reasoningTokens += u.reasoningTokens || 0;
  total.calls += 1;
}

/** Calls the model once, validates; on failure, retries exactly once with
 *  the real validation errors fed back verbatim so the model can fix the
 *  specific thing it got wrong, rather than guessing again blind. Never
 *  trusts model output as final — the validator is the actual gate, not
 *  jsonMode, which only guarantees parseable JSON, not a matching shape.
 *  usage accumulates real token counts across every attempt (including a
 *  failed/retried one) — the only honest basis for a real cost figure,
 *  not an estimate. */
export async function generateAndValidateDocument(system: string, brief: string, businessId: string, tag: string, modelOverride?: string, reasoningEffortOverride?: "low" | "medium" | "high"): Promise<DocGenOutcome> {
  const usage = emptyUsage();
  let modelUsed: string | undefined;
  // Standard approach as of 2026-08-06 (see buildDesignRationaleInstructions'
  // header comment for the real benchmark this was decided from) — the
  // model must state its structural reasoning, in-band, as part of the same
  // call, before/alongside the tree. Baked in here rather than left to each
  // caller to remember, since it's now the default behavior, not an opt-in.
  const fullSystem = system + buildDesignRationaleInstructions();
  const attempt = async (messages: { role: "user" | "assistant"; content: string }[]): Promise<{ candidate: any; raw: string } | null> => {
    const ai = await HublyAI.complete({ feature: "hubly-document-generate", task: "document_generate", system: fullSystem, messages, jsonMode: true, model: modelOverride || undefined, reasoningEffort: reasoningEffortOverride || undefined });
    addUsage(usage, ai.usage);
    modelUsed = ai.model;
    const raw = String(ai.text || "");
    if (!raw) {
      // Reasoning-tier models can spend their whole token budget on hidden
      // reasoning and return an empty completion under a tight budget —
      // confirmed empirically at document_generate's old 6000-token cap.
      // Logged, not surfaced to the caller — a budget problem, not a shape one.
      console.error("hubly-document-generate: empty completion (reasoning budget likely exhausted)");
      return null;
    }
    try {
      return { candidate: JSON.parse(extractJson(raw)), raw };
    } catch {
      console.error("hubly-document-generate: unparseable JSON, length=", raw.length);
      return null;
    }
  };

  // The model returns { designRationale, root } — designRationale is real
  // (used by the caller for observability, e.g. logging why a reserved
  // element was included), but it is never itself validated or trusted as
  // a gate. root is the only thing that ever reaches validateHublyDocument
  // — the actual, unmodified validator, same as every other caller.
  const rootOf = (candidate: any) => candidate?.root;
  const rationaleOf = (candidate: any) => (typeof candidate?.designRationale === "string" ? candidate.designRationale : null);

  const first = await attempt([{ role: "user", content: brief }]);
  if (!first) return { ok: false, errors: [{ path: "$", message: "the model did not return valid JSON" }], usage, firstAttemptOk: false, firstAttemptErrors: [{ path: "$", message: "empty completion or unparseable JSON" }], modelUsed, rationale: null };
  if (!rootOf(first.candidate)) return { ok: false, errors: [{ path: "$.root", message: "response was missing the required root field" }], usage, firstAttemptOk: false, firstAttemptErrors: [{ path: "$.root", message: "missing root field" }], modelUsed, rationale: rationaleOf(first.candidate) };
  const firstResult = validateHublyDocument(rootOf(first.candidate), { businessId, tag, version: 1, generatedBy: "ai" });
  // The FIRST attempt is the honest signal: it is what the model reaches for
  // before being told what it may not have. The retry is already contaminated
  // by the rejection messages, so its vocabulary is ours, not the model's.
  const rejections = firstResult.rejections;
  if (firstResult.ok) return { ok: true, document: firstResult.document, usage, rejections, firstAttemptOk: true, modelUsed, rationale: rationaleOf(first.candidate) };

  const retryMsg = `Your previous output's "root" field had these validation errors — fix exactly these, nothing else:\n${firstResult.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")}\n\nReturn the same { "designRationale": ..., "root": ... } shape, with root corrected (a full corrected root node, not just the fixed part).`;
  const second = await attempt([
    { role: "user", content: brief },
    { role: "assistant", content: first.raw },
    { role: "user", content: retryMsg },
  ]);
  if (!second) return { ok: false, errors: [{ path: "$", message: "the model did not return valid JSON on retry" }], usage, firstAttemptOk: false, firstAttemptErrors: firstResult.errors, modelUsed, rationale: rationaleOf(first.candidate) };
  if (!rootOf(second.candidate)) return { ok: false, errors: [{ path: "$.root", message: "retry response was missing the required root field" }], usage, firstAttemptOk: false, firstAttemptErrors: firstResult.errors, modelUsed, rationale: rationaleOf(first.candidate) };
  const secondResult = validateHublyDocument(rootOf(second.candidate), { businessId, tag, version: 1, generatedBy: "ai" });
  const rationale = rationaleOf(second.candidate) ?? rationaleOf(first.candidate);
  return secondResult.ok
    ? { ok: true, document: secondResult.document, usage, rejections, firstAttemptOk: false, firstAttemptErrors: firstResult.errors, modelUsed, rationale }
    : { ok: false, errors: secondResult.errors, usage, rejections, firstAttemptOk: false, firstAttemptErrors: firstResult.errors, modelUsed, rationale };
}

/** Same one-retry-with-real-errors discipline as generateAndValidateDocument,
 *  applied to a patch instead of a full generation. The model never sees or
 *  returns the whole document again — only a short op list, targeted by the
 *  ids already in the current document. */
async function generateAndApplyPatch(document: HublyDocument, instruction: string): Promise<DocGenOutcome> {
  const system = `You make ONE targeted edit to an existing Hubly Document. You do not regenerate the page — you return a short list of patch operations that change ONLY what the instruction actually asks for, nothing else.

Return a JSON OBJECT of exactly this shape: {"ops": [<one or more operations>]}
Each operation is one of:
{"op":"update_text","id":"<existing id>","text":"<new text>"}
{"op":"update_attrs","id":"<existing id>","attrs":{"class":"<new utility classes>"}}
{"op":"move_node","id":"<existing id>","newParentId":"<existing id>","index":<number>}
{"op":"remove_node","id":"<existing id>"}
{"op":"add_node","parentId":"<existing id>","index":<number>,"node":{<a full new node, same node shape as generation>}}
{"op":"replace_node","id":"<existing id>","node":{<a full replacement node>}}

Only use ids that already appear in the current document below — never invent one for update/move/remove/replace (add_node's new node doesn't need a real id, the system assigns one). Only use the same utility-class vocabulary already present in the document's existing classes.

CURRENT DOCUMENT:
${JSON.stringify(document.root)}`;

  const usage = emptyUsage();
  const attempt = async (messages: { role: "user" | "assistant"; content: string }[]): Promise<{ ops: unknown; raw: string } | null> => {
    const ai = await HublyAI.complete({ feature: "hubly-document-patch", task: "document_patch", system, messages, jsonMode: true });
    addUsage(usage, ai.usage);
    const raw = String(ai.text || "");
    try {
      const parsed = JSON.parse(extractJson(raw));
      return { ops: parsed?.ops, raw };
    } catch {
      return null;
    }
  };

  const runPatch = (ops: unknown): DocGenOutcome => {
    if (!Array.isArray(ops) || !ops.length) return { ok: false, errors: [{ path: "$", message: "no patch operations returned" }], usage, firstAttemptOk: false };
    const result = applyPatchOps(document, ops as any);
    return result.ok ? { ok: true, document: result.document, usage, firstAttemptOk: false } : { ok: false, errors: result.errors, usage, firstAttemptOk: false };
  };

  const first = await attempt([{ role: "user", content: instruction }]);
  if (!first) return { ok: false, errors: [{ path: "$", message: "the model did not return valid JSON" }], usage, firstAttemptOk: false, firstAttemptErrors: [{ path: "$", message: "empty completion or unparseable JSON" }] };
  const firstOutcome = runPatch(first.ops);
  if (firstOutcome.ok) return { ...firstOutcome, firstAttemptOk: true };

  const retryMsg = `That patch could not be applied — errors:\n${firstOutcome.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")}\n\nReturn a corrected {"ops":[...]} using only real ids from the document above.`;
  const second = await attempt([
    { role: "user", content: instruction },
    { role: "assistant", content: first.raw },
    { role: "user", content: retryMsg },
  ]);
  if (!second) return { ok: false, errors: [{ path: "$", message: "the model did not return valid JSON on retry" }], usage, firstAttemptOk: false, firstAttemptErrors: firstOutcome.errors };
  const secondOutcome = runPatch(second.ops);
  return { ...secondOutcome, firstAttemptOk: false, firstAttemptErrors: firstOutcome.errors };
}

export type DirectPatchOpInput = { op: string; id?: string; text?: string; attrs?: Record<string, string> };

/** Click-to-edit's counterpart to website.patchDocument — the exact target
 *  and new value are already known (the click supplied them directly), so
 *  there's nothing for a model to decide. Applies one op straight through
 *  applyPatchOps, no OpenAI call, same as directEdit/directImageEdit does
 *  for the three hardcoded legacy fields — this is that same pattern
 *  generalized to any node in a Hubly Document. */
export async function applyDirectDocumentPatch(
  draftId: string,
  draftToken: string,
  op: DirectPatchOpInput,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to edit.", error: "missing_draft" };
  }
  if (op.op !== "update_text" && op.op !== "update_attrs") {
    // Click-to-edit only ever needs these two — move/remove/add/replace are
    // conversational-edit territory (they require judgment about what else
    // on the page should shift), not something a single click unambiguously means.
    return { ok: false, real: false, summary: "That kind of edit isn't supported via direct click.", error: "unsupported_op" };
  }
  if (!op.id) {
    return { ok: false, real: false, summary: "No element was specified to edit.", error: "missing_id" };
  }
  const latest = await selectLatestBusinessDocument(draftId, "website");
  if (!latest) {
    return { ok: false, real: false, summary: "No page exists yet to edit.", error: "no_document" };
  }
  const patchResult = applyPatchOps(latest.document, [op as any]);
  if (!patchResult.ok) {
    return { ok: false, real: false, summary: "That edit could not be applied safely — nothing changed.", error: "patch_failed", raw: patchResult.errors };
  }
    // Same guarantee as the conversational path: a click that changes nothing
    // must not report that it changed something.
    const directEffect = describePatchEffect(latest.document.root, patchResult.document.root);
    if (!directEffect.changed) {
      return { ok: false, real: false, summary: "That edit produced no change to the page.", error: "patch_no_effect" };
    }
  const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color");
  const html = renderHublyDocument(patchResult.document, { businessId: draftId, businessName: bizRow?.name || "", businessPhone: bizRow?.phone || undefined, businessBrandColor: bizRow?.brand_color || undefined });
  const r = await callBusinessRpc("create_business_document", {
    p_business_id: draftId,
    p_draft_token: draftToken,
    p_tag: "website",
    p_document: patchResult.document,
    p_rendered_html: html,
    p_created_by: "patch",
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The edit was computed but could not be saved.", error: "rpc_failed" };
  }
  const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return { ok: true, real: true, summary: `Real edit applied — ${humanPatchSummary(directEffect)}. ${url} now reflects it (version ${r.version}).`, raw: { id: r.id, version: r.version, url } };
}

const HUBLY_DOMAIN = (Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "").trim() || "myhubly.app";

const LOGO_EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

type StorageUploadOutcome =
  | { ok: true; url: string }
  | { ok: false; result: CapabilityActionResult };

/**
 * Shared by uploadDraftLogo and uploadDraftHeroImage — the only two places
 * that ever handle raw image bytes, both direct-dispatched outside the
 * model's decision loop for the same reason (see uploadDraftLogo's comment
 * below). Everything about the upload itself lives here once, not
 * duplicated per field.
 */
async function uploadImageToStorage(
  draftId: string,
  imageBase64: string,
  mediaType: string,
  fileLabel: string,
): Promise<StorageUploadOutcome> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, result: { ok: false, real: false, summary: "Storage isn't configured right now.", error: "storage_unconfigured" } };
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(imageBase64.replace(/^data:[^,]+,/, ""));
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.length < 16) throw new Error("too small to be a real image");
  } catch {
    return { ok: false, result: { ok: false, real: false, summary: "That image couldn't be read.", error: "invalid_image_data" } };
  }

  const type = (mediaType || "image/png").trim().toLowerCase();
  const ext = LOGO_EXT_BY_MEDIA_TYPE[type] || "png";
  const path = `drafts/${draftId}/${fileLabel}-${Date.now()}.${ext}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/brand-assets/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": type,
      "x-upsert": "true",
    },
    // Deno's runtime fetch accepts a Uint8Array body fine — this cast is
    // purely for the DOM lib typings used here, not a runtime concern.
    body: bytes as unknown as BodyInit,
  });
  if (!uploadRes.ok) {
    return { ok: false, result: { ok: false, real: false, summary: "The image could not be uploaded right now.", error: "storage_upload_failed" } };
  }
  return { ok: true, url: `${supabaseUrl}/storage/v1/object/public/brand-assets/${path}` };
}

/** Click-to-replace for any <img> node in a Hubly Document — the click
 *  already supplies the exact target, so no model call. Real upload (same
 *  storage path as the logo/hero-image uploads), then the exact same
 *  applyDirectDocumentPatch used for text edits, just with a new "src".
 *  The uploaded URL always starts with this project's own storage origin,
 *  so it passes the validator's media-origin check without special-casing. */
export async function uploadAndPatchDocumentImage(
  draftId: string,
  draftToken: string,
  nodeId: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to edit.", error: "missing_draft" };
  }
  if (!nodeId) {
    return { ok: false, real: false, summary: "No image was specified to replace.", error: "missing_id" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "doc-image");
  if (!uploaded.ok) return uploaded.result;
  return applyDirectDocumentPatch(draftId, draftToken, { op: "update_attrs", id: nodeId, attrs: { src: uploaded.url } });
}

/**
 * Uploads a draft's logo directly to real Storage (the same brand-assets
 * bucket the authenticated editor uses — see hostBrandImage/uploadBrandAsset
 * in public/hubly.html) and patches the real businesses.logo_url.
 *
 * Deliberately NOT a CapabilityAction the model invokes via the JSON tool
 * schema, unlike everything else in this file. A model cannot reliably
 * reproduce a multi-KB base64 image as generated output — asking it to
 * would risk silently corrupting the upload, which is worse than not
 * offering the tool at all. The image bytes are supplied directly by the
 * client and passed straight through server-side (hubly-conversation/
 * index.ts calls this directly, outside the model's decision loop) — the
 * model only ever sees and narrates the real result afterward, the same
 * CAPABILITY RESULT convention as every other action here.
 */
export async function uploadDraftLogo(
  draftId: string,
  draftToken: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to attach a logo to.", error: "missing_draft" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "logo");
  if (!uploaded.ok) return uploaded.result;

  const r = await callBusinessRpc("patch_business_in_progress", {
    p_id: draftId,
    p_draft_token: draftToken,
    p_patch: { logo_url: uploaded.url },
    p_website_meta: null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The logo uploaded but couldn't be attached to the business — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const siteUrl = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real logo uploaded and live — ${siteUrl} now shows it in the header.`,
    raw: { id: r.id, slug: r.slug, url: siteUrl, logoUrl: uploaded.url },
  };
}

/**
 * Same shape as uploadDraftLogo, for the hero image specifically — the
 * canvas's inline "click the hero photo" edit. banner_url alone isn't
 * enough to make the renderer actually show it: wsPageEl('ws-hero-media')
 * only paints a photo when S.headerMode is also 'banner' (confirmed by
 * reading hubly.html directly, not assumed) — meta.headerMode is set here
 * in the same patch, the same way meta.businessType already is.
 */
export async function uploadDraftHeroImage(
  draftId: string,
  draftToken: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to attach a hero image to.", error: "missing_draft" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "hero");
  if (!uploaded.ok) return uploaded.result;

  const r = await callBusinessRpc("patch_business_in_progress", {
    p_id: draftId,
    p_draft_token: draftToken,
    p_patch: { banner_url: uploaded.url, header_mode: "banner" },
    p_website_meta: null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The image uploaded but couldn't be attached to the business — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const siteUrl = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real hero image uploaded and live — ${siteUrl} now shows it.`,
    raw: { id: r.id, slug: r.slug, url: siteUrl, bannerUrl: uploaded.url },
  };
}

function isValidUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const urlArgSchema = (description: string): CapabilityActionArgSchema => ({
  type: "object",
  properties: { url: { type: "string", description } },
  required: ["url"],
});

const bookingArgSchema = (
  extra: Record<string, { type: string; description: string }>,
  required: string[],
): CapabilityActionArgSchema => ({
  type: "object",
  properties: {
    businessId: {
      type: "string",
      description:
        "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here (e.g. \"current_business\"); do not decline to invoke just because you don't have a real business id.",
    },
    ...extra,
  },
  required: ["businessId", ...required],
});

/** Shared by the three social/listing actions — none have a real integration yet. */
function socialStopgapHandler(platform: "facebook" | "instagram" | "google_business") {
  return async (args: Record<string, unknown>): Promise<CapabilityActionResult> => {
    const url = String(args?.url || "").trim();
    if (!isValidUrl(url)) {
      return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
    }
    const r = await callImportAnalyze(platform, url);
    const handle = r?.analysis?.handle || "";
    // Deliberately ignore r.analysis.note / r.analysis.queued from the legacy
    // analyzer — those claim work ("enrichment continues in Builder") that
    // never actually happens anywhere in this codebase today.
    const label = platform === "google_business" ? "Google Business" : platform === "facebook" ? "Facebook" : "Instagram";
    return {
      ok: true,
      real: false,
      summary: `No live integration exists for ${label} yet, so its content could not be read. Only the link itself was recognized${handle ? ` (handle: "${handle}")` : ""}.`,
      raw: { platform, handle, profileUrl: url },
    };
  };
}


/**
 * Append-only record of what the model tried to use and was refused.
 *
 * Best-effort by design: this is instrumentation, and instrumentation must
 * never be able to fail a real page build. Every error is swallowed after being
 * logged, exactly like notifyBookingReal.
 */
async function recordVocabularyRejections(
  businessId: string,
  tag: string,
  result: { rejections?: VocabularyRejections; firstAttemptOk?: boolean; modelUsed?: string },
  outcome: "succeeded" | "retried" | "failed",
): Promise<void> {
  try {
    const r = result.rejections;
    const classes = r?.classes || [];
    const tags = r?.tags || [];
    const attrs = r?.attrs || [];
    // Nothing was refused and the first attempt passed: no signal, no row.
    if (!classes.length && !tags.length && !attrs.length) return;
    const admin = adminClient();
    await admin.from("document_vocabulary_rejections").insert({
      business_id: businessId || null,
      tag,
      outcome: outcome === "succeeded" && result.firstAttemptOk === false ? "retried" : outcome,
      rejected_classes: [...new Set(classes)],
      rejected_tags: [...new Set(tags)],
      rejected_attrs: [...new Set(attrs)],
      model_used: result.modelUsed || null,
    });
  } catch (e) {
    console.error("recordVocabularyRejections failed (ignored):", e);
  }
}

export const HUBLY_CAPABILITY_REGISTRY: Capability[] = [
  {
    name: "website",
    description: "Build and manage a business's website.",
    actions: [
      {
        name: "analyze",
        description:
          "Fetches and reads a real, existing website: title, description, headings, service-like content, contact details, and dominant brand colors. This one is real and works today.",
        argsSchema: urlArgSchema("The business's website URL to read."),
        handler: async (args) => {
          const url = String(args?.url || "").trim();
          if (!isValidUrl(url)) {
            return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
          }
          const r = await callImportAnalyze("website", url);
          if (!r?.ok || r.partial) {
            return {
              ok: true,
              real: false,
              summary: "The website could not be reached, so nothing was actually read from it.",
              raw: r?.analysis || null,
            };
          }
          return {
            ok: true,
            real: true,
            summary:
              "Real content was fetched and read from this website — title, description, headings, service-like list items, contact details, and dominant colors.",
            raw: r.analysis,
          };
        },
      },
      {
        name: "generateDocument",
        description:
          "Generates a real, live Hubly Document — a validated, fully-editable page (not a template pick) — for the draft business, using OpenAI to compose real layout, copy, typography, color, and imagery from what's actually known. Call this once, the moment there's enough to build from (a real business name/type and, ideally, a chosen direction or real reference data from website.analyze) — never call it again for the same conversation, use website.patchDocument for any change after this point. Runs in the background and genuinely takes about a minute — the result you get back this turn confirms it STARTED, not that it's done (real:false on purpose). Say something honest and brief about that ('Building it now — it'll appear in a moment' or similar), never imply the page is already live or ready to look at.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            brief: {
              type: "string",
              description:
                "Everything relevant to building this page, written richly: business name, type, city, tone/character or chosen direction, real services if known, and — critically — any REAL brandColors/headline text/services from a prior website.analyze result, cited as real. This is the only context the generation step receives; don't under-write it.",
            },
          },
          required: ["brief"],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          const brief = String(args?.brief || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet to generate a page for — call business.startDraft first.", error: "missing_draft" };
          }
          if (!brief) {
            return { ok: false, real: false, summary: "No brief was given to generate from.", error: "missing_brief" };
          }
          const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,section_order");
          const schemaBlock = buildDocumentSchemaPromptBlock();
          // section_order[0] is what startDraft chose for this business to lead
          // with. renderHublyDocument does not read section_order at all — that
          // column drives the classic renderer — so on this path the choice has
          // to reach the model as prompt text or it does nothing whatsoever,
          // which is exactly what it did until 2026-08-17.
          const leadWith = Array.isArray(bizRow?.section_order) ? bizRow.section_order[0] : undefined;
          const structureBlock = buildPageStructureBlock(leadWith);
          const system = `You generate a real webpage for a real local service business, in the Hubly Document format below. Write real, specific copy for THIS business — never generic placeholder text, never "Lorem ipsum", never a literal business-name placeholder if a real name was given. Only place a reserved Hubly element (booking, reviews, etc.) where it's genuinely relevant to what a visitor needs next — never decorative.\n\n${schemaBlock}\n\n${structureBlock}`;
          // __benchmarkModel is intentionally absent from argsSchema/description —
          // the conversational AI never sees or sets it. Internal-only override
          // for the model benchmark harness so the exact same code path can be
          // run against different candidate models without touching production
          // secrets or per-task config.
          const benchmarkModel = String((args as any)?.__benchmarkModel || "").trim() || undefined;
          const genStarted = Date.now();
          const genResult = await generateAndValidateDocument(system, brief, draftId, "website", benchmarkModel);
          const generationMs = Date.now() - genStarted;
          if (!genResult.ok) {
            // The double-failure case left no trace at all before this. It is
            // also the most informative: whatever the model wanted badly enough
            // to reach for twice is a genuine gap, not a slip.
            await recordVocabularyRejections(draftId, "website", genResult, "failed");
            return { ok: false, real: false, summary: "The generated page didn't pass validation, twice — nothing was published.", error: "validation_failed", raw: { errors: genResult.errors, usage: genResult.usage, generationMs, firstAttemptOk: genResult.firstAttemptOk, firstAttemptErrors: genResult.firstAttemptErrors, modelUsed: genResult.modelUsed, rationale: genResult.rationale } };
          }
          const html = renderHublyDocument(genResult.document, { businessId: draftId, businessName: bizRow?.name || "", businessPhone: bizRow?.phone || undefined, businessBrandColor: bizRow?.brand_color || undefined });
          // generateDocument runs as a fire-and-forget background task in
          // hubly-conversation (EdgeRuntime.waitUntil) -- nothing awaits or
          // reads this handler's return value, only errors get caught. The
          // real designRationale text was previously computed and then
          // discarded every time. Logged here (visible in real time via
          // function logs) AND persisted below (queryable after the fact,
          // tied to the exact version it explains) -- this is the actual
          // debugging tool for "why did it make that choice", not optional
          // polish, confirmed live: a real conversation-driven generation
          // produced a correctly-reasoned document with no way to see why
          // afterward, before this fix.
          console.log(`hubly-document-generate rationale [${draftId}]:`, genResult.rationale || "(none captured)");
          // Record what the model reached for and was refused. See
          // 20260818000000_document_vocabulary_rejections.sql for why this
          // exists: the model is the only interface, so its vocabulary is the
          // product ceiling, and nothing recorded where it was hitting.
          await recordVocabularyRejections(draftId, "website", genResult, "succeeded");

          const r = await callBusinessRpc("create_business_document", {
            p_business_id: draftId,
            p_draft_token: draftToken,
            p_tag: "website",
            p_document: genResult.document,
            p_rendered_html: html,
            p_created_by: "ai",
            p_design_rationale: genResult.rationale || null,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The page was generated but could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
            summary: `Real page generated and live — ${url} (version ${r.version}). Every element on it is individually editable.`,
            raw: { id: r.id, version: r.version, url, usage: genResult.usage, generationMs, firstAttemptOk: genResult.firstAttemptOk, firstAttemptErrors: genResult.firstAttemptErrors, modelUsed: genResult.modelUsed, rationale: genResult.rationale },
          };
        },
      },
      {
        name: "patchDocument",
        description:
          "Applies a targeted edit to the live Hubly Document — changes ONLY the specific element(s) the request refers to, never regenerates the page. Use this for any conversational edit once a document exists (a headline change, moving an image, removing a section, adding one). Never call generateDocument again to make an edit.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            instruction: {
              type: "string",
              description: "The person's edit request, in their own words or your restatement of it — e.g. \"make the headline larger\" or \"remove the FAQ section\".",
            },
          },
          required: ["instruction"],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          const instruction = String(args?.instruction || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet — call business.startDraft and generateDocument first.", error: "missing_draft" };
          }
          if (!instruction) {
            return { ok: false, real: false, summary: "No edit instruction was given.", error: "missing_instruction" };
          }
          const latest = await selectLatestBusinessDocument(draftId, "website");
          if (!latest) {
            return { ok: false, real: false, summary: "No page exists yet to edit — call generateDocument first.", error: "no_document" };
          }
          const patchStarted = Date.now();
          const patchResult = await generateAndApplyPatch(latest.document, instruction);
          const patchMs = Date.now() - patchStarted;
          if (!patchResult.ok) {
            return { ok: false, real: false, summary: "That edit could not be applied safely — nothing changed.", error: "patch_failed", raw: { errors: patchResult.errors, usage: patchResult.usage, patchMs, firstAttemptOk: patchResult.firstAttemptOk, firstAttemptErrors: patchResult.firstAttemptErrors } };
          }
            // VERIFY THE EDIT LANDED BEFORE CLAIMING IT DID.
            //
            // "The ops applied" and "the page changed" are different facts, and
            // this handler reported the second while checking only the first.
            // An op aimed at a real-but-wrong node applies cleanly. So does
            // setting a class that is already present. So does whatever the
            // model invents when a request cannot be expressed in this format
            // at all -- "make the background black", where no page-background
            // knob exists. Each produced a confident "Real edit applied" over
            // an unchanged page: three exchanges, three Dones, nothing moved.
            const effect = describePatchEffect(latest.document.root, patchResult.document.root);
            if (!effect.changed) {
              return {
                ok: false,
                real: false,
                summary:
                  "Nothing on the page actually changed. The edit was computed and applied cleanly, but comparing the page before and after shows no difference, so this is something the page format cannot currently express rather than an edit that worked. Tell the owner plainly that you cannot make this change yet. Do not retry the same edit, and do not describe it as done.",
                error: "patch_no_effect",
                raw: { instruction, patchMs, usage: patchResult.usage },
              };
            }
          const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color");
          const html = renderHublyDocument(patchResult.document, { businessId: draftId, businessName: bizRow?.name || "", businessPhone: bizRow?.phone || undefined, businessBrandColor: bizRow?.brand_color || undefined });
          const r = await callBusinessRpc("create_business_document", {
            p_business_id: draftId,
            p_draft_token: draftToken,
            p_tag: "website",
            p_document: patchResult.document,
            p_rendered_html: html,
            p_created_by: "patch",
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The edit was computed but could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
              // Say WHAT changed, not merely that something did. A wrong removal
              // is obvious the moment it is named, invisible behind a generic "Done".
              summary: `Real edit applied — ${humanPatchSummary(effect)}. ${url} now reflects it (version ${r.version}). Nothing else changed. Tell the owner specifically what changed, in those terms.`,
            raw: { id: r.id, version: r.version, url, usage: patchResult.usage, patchMs, firstAttemptOk: patchResult.firstAttemptOk, firstAttemptErrors: patchResult.firstAttemptErrors },
          };
        },
      },
    ],
  },
  {
    name: "online_presence",
    description: "Help a business be found — website, business listings, and social presence.",
    actions: [
      {
        name: "analyze_facebook",
        description:
          "Looks at a Facebook page URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Facebook page URL."),
        handler: socialStopgapHandler("facebook"),
      },
      {
        name: "analyze_instagram",
        description:
          "Looks at an Instagram profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Instagram profile URL."),
        handler: socialStopgapHandler("instagram"),
      },
      {
        name: "analyze_google_business",
        description:
          "Looks at a Google Business Profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Google Business Profile URL."),
        handler: socialStopgapHandler("google_business"),
      },
    ],
  },
  {
    name: "booking",
    description:
      "Real availability and real booking creation. Execution target depends on channel: a Marketplace consumer booking a matched provider reuses the production Marketplace booking engine as-is (marketplace_bookings); a business's own website visitor becomes a real Hubly Job (jobs/customers, Calendar, Google Calendar) through the same operations createJob() already performs. No calendar or provider logic is duplicated here either way — this only wraps what already exists, per channel.",
    actions: [
      {
        name: "getAvailability",
        description:
          "Real bookable time slots for this business, computed from their actual schedule, connected calendar, and business hours. Returns real slots or an honest reason none exist yet — never invented times.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service to check availability for. Omit to use the business's first bookable service." },
            date: { type: "string", description: "A specific date (YYYY-MM-DD) to check. Omit to get the soonest available times." },
          },
          [],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          if (!businessId) {
            return { ok: false, real: false, summary: "No business was specified.", error: "missing_business_id" };
          }
          // Structural, engine-injected context (see hubly-conversation/
          // index.ts) — never something the model supplies or controls,
          // same treatment as businessId itself just above.
          if (String(args?.bookingChannel || "") === "website") {
            const date = String(args?.date || "").trim() || new Date().toISOString().slice(0, 10);
            let admin;
            try { admin = adminClient(); } catch {
              return { ok: false, real: false, summary: "Availability could not be checked right now.", error: "server_not_configured" };
            }
            const r = await getWebsiteAvailability(admin, { businessId, date });
            if (!r.ok) {
              return { ok: true, real: false, summary: "This business isn't set up for real-time booking yet.", raw: r };
            }
            if (r.closed) {
              return { ok: true, real: true, summary: `Closed on ${date} — no bookings that day.`, raw: r };
            }
            const slots = r.slots || [];
            return {
              ok: true,
              real: true,
              summary: slots.length
                ? `Found ${slots.length} real available time${slots.length === 1 ? "" : "s"} on ${date}.`
                : `No real availability found on ${date}.`,
              raw: r,
            };
          }
          const r = await callMarketplace("booking_slots", {
            business_id: businessId,
            service_id: String(args?.serviceId || "").trim() || undefined,
            date: String(args?.date || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "Availability could not be checked right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            // A real, honest outcome (e.g. this business isn't set up for
            // real-time booking yet) — not a client input error, so ok:true,
            // real:false, same convention as the website-couldn't-be-reached case.
            return {
              ok: true,
              real: false,
              summary: r.error === "Provider not found" || r.error === "Business not found"
                ? "This business isn't set up for real-time booking yet."
                : (r.error || "No availability could be found."),
              raw: r,
            };
          }
          const slotCount = Array.isArray(r.slots) ? r.slots.length : 0;
          return {
            ok: true,
            real: true,
            summary: slotCount
              ? `Found ${slotCount} real available time${slotCount === 1 ? "" : "s"} for ${r.service?.name || "this service"}, starting ${r.nextAvailable || "soon"}.`
              : `No real availability found for ${r.service?.name || "this service"} right now.`,
            raw: r,
          };
        },
      },
      {
        name: "create",
        description:
          "Creates a real booking — writes a real record and triggers real calendar sync. A structured confirmation card (business, service, date/time, address, price, recurring info if real) is shown to the customer automatically — you do not need to restate those details yourself, and must never invent or reformat them differently than the result shows. No SMS or booking-management link is sent by this action. An email is attempted, best-effort — only say an email was sent if the result's confirmation.emailSent is true; if it's false, do not mention email at all (never say one was sent, and never say one failed, just don't bring it up) — the booking is confirmed either way. If asked how they'll be reminded and no email was sent, say the booking is confirmed here in this conversation. Only call this once the customer has chosen a real time from getAvailability and given their contact details. Only set frequency when the customer explicitly said they want this to repeat (e.g. \"every month\") — never infer or default it; omitting it creates a normal one-time booking. If the result includes real membership facts (plan name, price, cadence, status), you may state them if relevant — never invent membership benefits, discounts, or coverage that aren't given, and never proactively pitch a membership to a customer who doesn't have one.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service is being booked." },
            startsAt: { type: "string", description: "The exact start time the customer chose — must be a real slot from getAvailability, never invented." },
            customerName: { type: "string", description: "The customer's name." },
            customerEmail: { type: "string", description: "The customer's email, if given." },
            customerPhone: { type: "string", description: "The customer's phone, if given." },
            address: { type: "string", description: "Service address, if relevant/given." },
            notes: { type: "string", description: "Any special requests or notes the customer mentioned." },
            frequency: { type: "string", description: "Only if the customer explicitly asked for this to repeat: one of weekly, biweekly, monthly, quarterly. Omit entirely for a one-time booking." },
          },
          ["serviceId", "startsAt", "customerName"],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          const serviceId = String(args?.serviceId || "").trim();
          const startsAt = String(args?.startsAt || "").trim();
          const customerName = String(args?.customerName || "").trim();
          if (!businessId || !serviceId || !startsAt || !customerName) {
            return { ok: false, real: false, summary: "Missing required booking details.", error: "missing_required_args" };
          }
          if (String(args?.bookingChannel || "") === "website") {
            let admin;
            try { admin = adminClient(); } catch {
              return { ok: false, real: false, summary: "The booking could not be created right now.", error: "server_not_configured" };
            }
            // startsAt arrives as an ISO-ish "YYYY-MM-DDTHH:MM" or
            // "YYYY-MM-DD HH:MM" from getAvailability's own slot values
            // combined with the date — split rather than re-deriving.
            const [datePart, timePartRaw] = startsAt.split(/[T ]/);
            const timePart = (timePartRaw || "").slice(0, 5);
            const r = await createWebsiteBookingJob(admin, {
              businessId,
              serviceId,
              date: datePart || startsAt.slice(0, 10),
              time: timePart || undefined,
              customerName,
              customerEmail: String(args?.customerEmail || "").trim() || undefined,
              customerPhone: String(args?.customerPhone || "").trim() || undefined,
              address: String(args?.address || "").trim() || undefined,
              notes: String(args?.notes || "").trim() || undefined,
              frequency: String(args?.frequency || "").trim() || undefined,
            });
            if (!r.ok) {
              return { ok: true, real: false, summary: r.error || "The booking could not be created.", raw: r };
            }
            let summary = `Real job booked for ${startsAt}.`;
            if (r.recurringScheduleId) {
              summary = `Real job booked for ${startsAt} and a recurring schedule was set up for future visits.`;
            } else if (r.existingScheduleConflict) {
              const c = r.existingScheduleConflict as { frequency?: string; service_name?: string; next_occurrence_date?: string };
              summary = `Real job booked for ${startsAt}. This customer already has an active ${c.frequency || "recurring"} schedule` +
                `${c.service_name ? ` for ${c.service_name}` : ""}${c.next_occurrence_date ? ` (next visit ${c.next_occurrence_date})` : ""} — ` +
                `no second schedule was created. Tell the customer their existing recurring visits are unaffected; if they want to change the cadence or service on that existing schedule, that needs to be handled separately, not by booking again.`;
            }
            // #187: membership is a fact independent of the schedule outcome
            // above — a customer can have both, either, or neither. Only
            // real, present fields are ever stated; nothing here implies
            // this specific booking is covered or discounted by the
            // membership unless the amount already reflects that (it
            // doesn't today — see hubly_booking_execution.ts). Do not
            // pitch a membership when one is absent — that's out of scope.
            if (r.membership) {
              const m = r.membership as {
                planName?: string; status?: string; price?: number | null;
                cadence?: string | null; serviceName?: string | null; includes?: string[] | null;
              };
              const priceBit = m.price != null ? `$${m.price}${m.cadence ? "/" + m.cadence : ""}` : "";
              summary += ` This customer has a ${m.status || "active"} membership: ${m.planName || "Membership"}` +
                `${priceBit ? ` (${priceBit})` : ""}${m.serviceName ? `, service: ${m.serviceName}` : ""}` +
                `${m.includes && m.includes.length ? `. Includes: ${m.includes.join(", ")}` : ""}. ` +
                `This is real membership data you may reference if relevant — it does not by itself mean this specific booking is covered or discounted; only say that if the price already reflects it.`;
            }
            // #188: a structured confirmation card is already shown to the
            // customer automatically — don't restate service/date/price/
            // address in prose, that's the card's job. Only state whether
            // an email genuinely went out; never mention it at all when it
            // didn't (no "no email was sent" — just silence on the topic).
            summary += r.confirmation.emailSent
              ? " A confirmation email was sent."
              : "";
            summary += " A confirmation card with the booking details is already shown to the customer — do not repeat service/date/time/price/address in your reply.";
            return {
              ok: true,
              real: true,
              summary,
              raw: r,
            };
          }
          const r = await callMarketplace("booking_create", {
            business_id: businessId,
            service_id: serviceId,
            starts_at: startsAt,
            customer_name: customerName,
            customer_email: String(args?.customerEmail || "").trim() || undefined,
            customer_phone: String(args?.customerPhone || "").trim() || undefined,
            address: String(args?.address || "").trim() || undefined,
            notes: String(args?.notes || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "The booking could not be created right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            return { ok: true, real: false, summary: r.error || "The booking could not be created.", raw: r };
          }
          const needsCheckout = !!r.checkout?.required;
          return {
            ok: true,
            real: true,
            summary: needsCheckout
              ? `Real booking created (${r.confirmation?.status || "pending"}) — a payment of $${((r.checkout.amount_cents || 0) / 100).toFixed(2)} (${r.checkout.charge_kind}) is required to confirm it.`
              : `Real booking confirmed for ${r.confirmation?.starts_at || startsAt}.`,
            raw: r,
          };
        },
      },
    ],
  },
  {
    name: "business",
    description:
      "Create and grow a real, live business record and website — even before the person has an account. Reuses the real renderer (25 layouts) and the real businesses table, just with owner_id left unset until they actually sign up.",
    actions: [
      {
        name: "startDraft",
        description:
          "Creates a REAL business row and a real live website at <slug>.myhubly.app — visitable immediately, even with almost nothing filled in yet. Call this once, the first time you have a business name and (ideally) a chosen visual direction — not before. Calling it again for the same conversation creates a second, unwanted business — use updateDraft after this point, never call startDraft twice.",
        argsSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The business's real name if they gave one, exactly as given. If they have NOT " +
                "given a name, DERIVE a descriptive one from what they actually said — " +
                "'Mobile Dog Grooming in Lehi', 'Lehi Wedding Photography' — and pass that. " +
                "NEVER invent a generic placeholder like 'Your Business', 'My Company' or " +
                "'New Business': a site called Your Business is one nobody wants to keep, and " +
                "four already exist in production because this was left vague. Only ask for a " +
                "name if you genuinely cannot derive anything meaningful from what they said.",
            },
            palette: {
              type: "string",
              description:
                "Pick ONE palette id that suits this business — never a hex colour, only an id " +
                "from this list: " + palettePromptList() + ". Choose for the trade and how it wants " +
                "to feel, not for your own preference. Omitting this leaves the site on the default " +
                "navy, which is what made every Hubly site look identical.",
            },
            leadWith: {
              type: "string",
              description:
                "Which section the page leads with: \"services\", \"portfolio\", \"about\" or " +
                "\"reviews\". Lead with what sells THIS business — a photographer's work IS the " +
                "pitch, so \"portfolio\"; a groomer's customer wants to know what you do and what " +
                "it costs, so \"services\". Never lead with \"reviews\" or \"portfolio\" for a " +
                "brand-new business that has neither yet. Defaults to services-first.",
            },
            businessType: {
              type: "string",
              description:
                "One short lowercase category if it's genuinely clear (e.g. \"detailing\", \"landscaping\", \"cleaning\", \"photography\", \"windows\", \"pressure_washing\"). Omit if unclear — never guess.",
            },
          },
          // NOT required. The system prompt says "don't wait for a business name
          // first — a real site with placeholder content beats a perfect question
          // every time", and a schema demanding one directly contradicted it. The
          // model resolved that contradiction two ways, both bad: invent "Your
          // Business" (4 of 6 production drafts) or decline to build and answer
          // conversationally instead — a stranger describes their business, gets
          // advice, and leaves with nothing, invisibly, because it writes no row.
          required: [],
        },
        handler: async (args) => {
          const name = String(args?.name || "").trim();
          if (!name) {
            // Reached only if the model passed nothing at all. The RPC needs a
            // name for the slug so it cannot be silently defaulted — but the fix
            // is to derive one, never to fall back to a placeholder.
            return {
              ok: false,
              real: false,
              summary:
                "Derive a name from what they told you (their trade and town is enough, e.g. " +
                "'Mobile Dog Grooming in Lehi') and call this again. Do not use a generic " +
                "placeholder, and do not stop to ask unless you truly have nothing to work from.",
              error: "derive_name_and_retry",
            };
          }
          const businessType = String(args?.businessType || "").trim() || undefined;
          const r = await callBusinessRpc("start_business_in_progress", {
            p_name: name,
            p_business_type: businessType || null,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The business record could not be created right now.", error: r?.error || "rpc_unreachable" };
          }
          // Structural safety net, not reliance on the model remembering to
          // set seoTitle on the very same turn: businessType defaults to
          // 'detailing' at the schema level, and the legacy blueprint
          // fallback silently mislabels anything else as "Auto Detailing"
          // (see 20260803... history) — without this, the very first paint,
          // before anything is really known yet, can show a wrong category
          // in the browser tab. A neutral, honest title (just the name)
          // beats that every time; updateDraft can always make it richer
          // once the business is actually understood.
          // Visual identity, chosen for THIS business. Without it every site
          // inherits the same column defaults — brand_color '#1a3a6e' and
          // section_order services/portfolio/reviews/about — which is why dog
          // grooming, photography and detailing all produced the same page with
          // different words. The palette is selected by id from a curated list,
          // never free hex: a model picking arbitrary colours will eventually
          // produce something illegible, and nobody reviews it before a stranger
          // sees their new site.
          const chosen = paletteById((args as Record<string, unknown>)?.palette);
          const sections = sectionOrderFor((args as Record<string, unknown>)?.leadWith);
          const identityPatch: Record<string, unknown> = { section_order: sections };
          if (chosen) {
            identityPatch.brand_color = chosen.brand;
            identityPatch.bg_color = chosen.background;
          }
          await callBusinessRpc("patch_business_in_progress", {
            p_id: r.id,
            p_draft_token: r.draft_token,
            p_patch: identityPatch,
            p_website_meta: { seoTitle: name },
          });
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          // A grant, so whoever just built this can claim it later. NOT
          // r.draft_token: that is a permanent bearer credential for an
          // unclaimed business and stays server-side, per the rule at
          // hubly-conversation:591. The grant is 10 minutes, scoped to this
          // business, and worthless once exchanged for an httpOnly cookie.
          //
          // Null when HUBLY_DRAFT_SECRET is unset — the site is still created,
          // it simply cannot be claimed until the secret exists. Failing closed
          // beats minting something unsigned.
          const draftGrant = await issueDraftGrant(String(r.id));
          return {
            ok: true,
            real: true,
            summary: `Real business created and live at ${url} — this is a real, visitable site, not a mockup.`,
            raw: { id: r.id, slug: r.slug, draftToken: r.draft_token, url, draftGrant },
          };
        },
      },
      {
        name: "updateDraft",
        description:
          "Updates the real business/website created by startDraft — real headline, subhead, about copy, contact info, or visual direction (layout). Every call here changes what's actually live at the site right now. Only ever call this after startDraft has already run in this conversation.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            name: { type: "string", description: "Updated business name, if it changed." },
            tagline: { type: "string", description: "A short real tagline, if you drafted one." },
            about: { type: "string", description: "A real about/description paragraph, if you drafted one." },
            businessType: { type: "string", description: "Updated category, only if it's now clearer than before." },
            phone: { type: "string", description: "Phone number, if given." },
            email: { type: "string", description: "Email, if given." },
            city: { type: "string", description: "City / service area, if given." },
            brandColor: { type: "string", description: "A hex color, only if the person actually specified or approved one." },
            heroHeadline: { type: "string", description: "The real homepage headline you're drafting or refining right now." },
            heroSubhead: { type: "string", description: "The real homepage subheadline." },
            seoTitle: {
              type: "string",
              description:
                "Always include this alongside heroHeadline: a short, accurate title like \"<Business Name> | <what they actually do>\" (e.g. \"Bark and Bubbles | Dog Grooming\"). businessType only recognizes a handful of fixed categories and silently mislabels anything outside them, so this is what makes the browser tab and page title actually correct.",
            },
            layout: {
              type: "string",
              description: "The chosen real visual direction's id (from the real layout list you were given) — only when the person picked or changed direction.",
            },
          },
          required: [],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet to update — call startDraft first.", error: "missing_draft" };
          }
          const patch: Record<string, unknown> = {};
          const map: Record<string, string> = {
            name: "name", tagline: "tagline", about: "about", businessType: "business_type",
            phone: "phone", email: "email", city: "city", brandColor: "brand_color",
            heroHeadline: "gen_hero_headline", heroSubhead: "gen_hero_subhead", seoTitle: "gen_seo_title",
          };
          for (const [argKey, col] of Object.entries(map)) {
            const v = args?.[argKey];
            if (typeof v === "string" && v.trim()) patch[col] = v.trim();
          }
          // The renderer (public/hubly.html: applyBizMeta -> "if(meta.website)
          // S.website=meta.website") reads hero headline/subhead/SEO title
          // from meta.website, NOT from the gen_* columns above — those are
          // a separate AI-draft staging area that only reaches the live site
          // through a different, owner-authenticated flow. Writing here is
          // what actually makes the live preview change.
          const layout = String(args?.layout || "").trim();
          const heroHeadline = typeof args?.heroHeadline === "string" ? args.heroHeadline.trim() : "";
          const heroSub = typeof args?.heroSubhead === "string" ? args.heroSubhead.trim() : "";
          const seoTitle = typeof args?.seoTitle === "string" ? args.seoTitle.trim() : "";
          const websiteMeta: Record<string, unknown> = {};
          if (layout) websiteMeta.layout = layout;
          if (heroHeadline) { websiteMeta.heroHeadline = heroHeadline; websiteMeta.customHeroHeadline = true; }
          if (heroSub) { websiteMeta.heroSub = heroSub; websiteMeta.customHeroSub = true; }
          if (seoTitle) websiteMeta.seoTitle = seoTitle;
          const r = await callBusinessRpc("patch_business_in_progress", {
            p_id: draftId,
            p_draft_token: draftToken,
            p_patch: patch,
            p_website_meta: Object.keys(websiteMeta).length ? websiteMeta : null,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The business record could not be updated — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          const changed = Object.keys(patch).concat(layout ? ["layout"] : []);
          return {
            ok: true,
            real: true,
            summary: changed.length
              ? `Real update applied — ${url} now reflects: ${changed.join(", ")}.`
              : `No fields changed — nothing new was given to update.`,
            raw: { id: r.id, slug: r.slug, url },
          };
        },
      },
      {
        name: "setServices",
        description:
          "Writes the real services list — the live site's Services section renders these for real, immediately. Pass the COMPLETE current list every time (replaces what's there, same convention as everything else here) — never just the newly-mentioned one.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            services: {
              type: "array",
              description: "Every service currently known, in order. Each: { name (required), price (number, omit if truly unknown), description (one line, optional) }.",
              items: {},
            } as any,
          },
          required: ["services"],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet — call startDraft first.", error: "missing_draft" };
          }
          const list = Array.isArray(args?.services) ? args.services : [];
          const services = list
            .filter((s: any) => s && typeof s.name === "string" && s.name.trim())
            .map((s: any) => ({
              name: String(s.name).trim(),
              price: typeof s.price === "number" && Number.isFinite(s.price) ? s.price : undefined,
              description: typeof s.description === "string" && s.description.trim() ? s.description.trim() : undefined,
            }));
          const r = await callBusinessRpc("set_business_draft_services", {
            p_id: draftId,
            p_draft_token: draftToken,
            p_services: services,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The services list could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
            summary: `Real update — ${url} now shows ${r.count} real service${r.count === 1 ? "" : "s"}.`,
            raw: { id: r.id, slug: r.slug, url, count: r.count },
          };
        },
      },
    ],
  },
];

export function findCapability(name: string): Capability | undefined {
  return HUBLY_CAPABILITY_REGISTRY.find((c) => c.name === name);
}

export function findAction(capabilityName: string, actionName: string): CapabilityAction | undefined {
  return findCapability(capabilityName)?.actions.find((a) => a.name === actionName);
}

/** Generates the capability/action description block for a consumer's prompt — the ONLY place this text is produced. */
export function buildCapabilitiesPromptBlock(registry: Capability[] = HUBLY_CAPABILITY_REGISTRY): string {
  return registry
    .map((cap) => {
      const actions = cap.actions
        .map((a) => {
          const args = Object.entries(a.argsSchema.properties)
            .map(([key, spec]) => {
              const req = a.argsSchema.required.includes(key) ? ", required" : ", optional";
              return `${key} (${spec.type}${req}): ${spec.description}`;
            })
            .join("; ");
          return `  - ${a.name}(${args})\n    ${a.description}`;
        })
        .join("\n");
      return `${cap.name}: ${cap.description}\n${actions}`;
    })
    .join("\n\n");
}

// Shared arg every storefront action carries: the engine injects the real businessId
// (and, separately, the owner's token) before the handler runs — the model never sees or
// needs the real value, same as booking's businessId / business's draftId.
const sfBusinessIdArg = {
  type: "string",
  description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
};

// The Storefront capability — appended to the registry via push so the big literal above
// stays readable. Every handler wraps the owner-gated Commerce API; none writes tables.
HUBLY_CAPABILITY_REGISTRY.push({
  name: "storefront",
  description:
    "Operate the business's real online Store — the products/supplies they sell to customers (distinct from their services/booking). List the catalog, create and edit products, add and edit variants (sizes/options with their own price and stock), publish or hide products, organize products into collections, and turn the store on or configure it. Everything here changes their real, live Commerce catalog through the same system the owner's Store screen uses.",
  actions: [
    {
      name: "listCatalog",
      description:
        "Read the current Store: every product (with whether it's published/live or a draft, and its price) and every collection. Call this whenever the owner asks what they're selling, and BEFORE editing/publishing/hiding anything so you know the exact product/collection names and can tell if a name they used is ambiguous.",
      argsSchema: { type: "object", properties: { businessId: sfBusinessIdArg }, required: [] },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const [products, collections] = await Promise.all([
          sfFetchProducts(ctx.ownerToken, ctx.businessId),
          sfFetchCollections(ctx.ownerToken, ctx.businessId),
        ]);
        const lines = products.map((p) => {
          const price = ((Number(p.price_cents) || 0) / 100).toFixed(2);
          const live = p.status === "active" && (!(p.visibility) || p.visibility.website !== false);
          return `${p.name} — $${price} — ${live ? "live on store" : "draft (hidden)"}`;
        });
        const summary = products.length
          ? `Current products: ${lines.join("; ")}.` + (collections.length ? ` Collections: ${collections.map((c) => c.name).join(", ")}.` : "")
          : "The store has no products yet.";
        return { ok: true, real: true, summary, raw: { products, collections } };
      },
    },
    {
      name: "createProduct",
      description:
        "Create a new product in the Store. IMPORTANT: new products are created as a DRAFT that is NOT visible to customers, so an accidental product never appears on the store. Only pass makeAvailable:true when the owner EXPLICITLY says to publish/sell/make it available now (e.g. \"add a $49.99 soap and put it on my store\"); otherwise leave it a draft and tell them you can publish it when they're ready. Write a short real description yourself when it helps.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          name: { type: "string", description: "The product's real name, e.g. \"5-Gallon Car Wash Soap\"." },
          price: { type: "number", description: "Price in dollars, e.g. 49.99." },
          description: { type: "string", description: "A short real product description, if useful." },
          type: { type: "string", description: "\"physical\" (default), \"digital\", or \"gift_card\". Omit for physical." },
          inventory: { type: "number", description: "Starting stock quantity, if the owner gave one." },
          category: { type: "string", description: "A category/label like \"Detailing supplies\", if natural." },
          makeAvailable: { type: "boolean", description: "TRUE only when the owner explicitly wants it published/live now. Default/omit = create as a hidden draft." },
        },
        required: ["name"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const name = String(args.name || "").trim();
        if (!name) return { ok: false, real: false, summary: "I need a name for the product.", error: "missing_name" };
        const makeAvailable = args.makeAvailable === true;
        const body: Record<string, unknown> = {
          business_id: ctx.businessId,
          name,
          price: sfDollars(args.price),
          type: args.type ? String(args.type) : "physical",
          status: makeAvailable ? "active" : "draft",
          visibility: { website: makeAvailable, booking: true, customerPortal: true, quoteBuilder: true, email: true, memberships: false },
        };
        if (args.description) body.description = String(args.description);
        if (args.category) body.metadata = { category: String(args.category) };
        if (args.inventory != null) body.inventory = Number(args.inventory);
        const r = await callCommerceApi(ctx.ownerToken, "POST", "/products", body);
        if (r.status === 201 && r.json?.product) {
          return {
            ok: true, real: true,
            summary: makeAvailable
              ? `Created "${name}" and published it — it's live on the store now.`
              : `Created "${name}" as a hidden draft — it's not visible to customers yet. Tell me when you want it on your store and I'll publish it.`,
            raw: { id: r.json.product.id, status: r.json.product.status },
          };
        }
        return { ok: false, real: false, summary: "I couldn't create that product just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "updateProduct",
      description:
        "Change an existing product's details (name, price, description, stock, category). Identify it by the owner's words in productName. If that name matches more than one product, or none, this returns without changing anything and tells you — ask the owner which one; never guess.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          productName: { type: "string", description: "The product to change, in the owner's words." },
          name: { type: "string", description: "New name, if renaming." },
          price: { type: "number", description: "New price in dollars." },
          description: { type: "string", description: "New description." },
          inventory: { type: "number", description: "New stock quantity." },
          category: { type: "string", description: "New category/label." },
        },
        required: ["productName"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const products = await sfFetchProducts(ctx.ownerToken, ctx.businessId);
        const found = sfResolveByName(products, String(args.productName || ""));
        if ("none" in found) return { ok: false, real: false, summary: `I couldn't find a product called "${args.productName}". You have: ${products.map((p) => p.name).join(", ") || "(none)"}.`, error: "not_found" };
        if ("ambiguous" in found) return { ok: false, real: false, summary: `More than one product matches "${args.productName}": ${found.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const patch: Record<string, unknown> = { business_id: ctx.businessId };
        if (args.name) patch.name = String(args.name);
        if (args.price != null) patch.price = sfDollars(args.price);
        if (args.description != null) patch.description = String(args.description);
        if (args.inventory != null) patch.inventory = Number(args.inventory);
        if (args.category != null) patch.metadata = { category: String(args.category) };
        const r = await callCommerceApi(ctx.ownerToken, "PATCH", `/products/${found.item.id}`, patch);
        if (r.status === 200 && r.json?.product) return { ok: true, real: true, summary: `Updated "${found.item.name}".`, raw: { id: found.item.id } };
        return { ok: false, real: false, summary: "I couldn't update that product just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "setProductVisibility",
      description:
        "Publish or hide a product, and/or control whether it shows on the website/store. Use visible:true to publish (\"put it on my store\", \"start selling it\") and visible:false to hide (\"hide the old soap\", \"take it down\"). onWebsite specifically controls the website/store surface (\"put the towels on my website\"). Identify the product by productName; ambiguous/none returns without changing anything and asks.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          productName: { type: "string", description: "The product to publish or hide, in the owner's words." },
          visible: { type: "boolean", description: "TRUE = publish/make live; FALSE = hide from customers." },
          onWebsite: { type: "boolean", description: "Optional: specifically show (true) or hide (false) on the website/store surface. Defaults to match `visible`." },
        },
        required: ["productName", "visible"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const products = await sfFetchProducts(ctx.ownerToken, ctx.businessId);
        const found = sfResolveByName(products, String(args.productName || ""));
        if ("none" in found) return { ok: false, real: false, summary: `I couldn't find a product called "${args.productName}". You have: ${products.map((p) => p.name).join(", ") || "(none)"}.`, error: "not_found" };
        if ("ambiguous" in found) return { ok: false, real: false, summary: `More than one product matches "${args.productName}": ${found.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const visible = args.visible === true;
        const onWebsite = args.onWebsite === undefined ? visible : args.onWebsite === true;
        const currentVis = (found.item.visibility && typeof found.item.visibility === "object") ? found.item.visibility : {};
        const patch = {
          business_id: ctx.businessId,
          status: visible ? "active" : "draft",
          visibility: { ...currentVis, website: onWebsite },
        };
        const r = await callCommerceApi(ctx.ownerToken, "PATCH", `/products/${found.item.id}`, patch);
        if (r.status === 200 && r.json?.product) {
          return { ok: true, real: true, summary: visible ? `"${found.item.name}" is now live on the store.` : `"${found.item.name}" is now hidden from customers.`, raw: { id: found.item.id } };
        }
        return { ok: false, real: false, summary: "I couldn't change that just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "addVariant",
      description:
        "Add a variant (a size/option with its own price and stock) to an existing product — e.g. a \"12-pack\" option, or a \"5 Gallon\" size. Identify the parent product by productName; ambiguous/none returns without changing anything and asks.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          productName: { type: "string", description: "The parent product, in the owner's words." },
          variantName: { type: "string", description: "The variant/option name, e.g. \"12-pack\" or \"5 Gallon\"." },
          price: { type: "number", description: "Variant price in dollars." },
          inventory: { type: "number", description: "Variant stock quantity, if given." },
        },
        required: ["productName", "variantName"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const products = await sfFetchProducts(ctx.ownerToken, ctx.businessId);
        const found = sfResolveByName(products, String(args.productName || ""));
        if ("none" in found) return { ok: false, real: false, summary: `I couldn't find a product called "${args.productName}". You have: ${products.map((p) => p.name).join(", ") || "(none)"}.`, error: "not_found" };
        if ("ambiguous" in found) return { ok: false, real: false, summary: `More than one product matches "${args.productName}": ${found.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const variantName = String(args.variantName || "").trim();
        if (!variantName) return { ok: false, real: false, summary: "I need a name for the variant.", error: "missing_variant_name" };
        const body: Record<string, unknown> = { business_id: ctx.businessId, name: variantName };
        if (args.price != null) body.price = sfDollars(args.price);
        if (args.inventory != null) body.inventory = Number(args.inventory);
        const r = await callCommerceApi(ctx.ownerToken, "POST", `/products/${found.item.id}/variants`, body);
        if (r.status === 201 && r.json?.variant) return { ok: true, real: true, summary: `Added the "${variantName}" option to "${found.item.name}".`, raw: { id: r.json.variant.id } };
        return { ok: false, real: false, summary: "I couldn't add that variant just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "updateVariant",
      description:
        "Change an existing variant's price, stock, or name — e.g. \"change the 12-pack to $24.99\" — without recreating it. Identify the parent product by productName and the variant by variantName; ambiguity at either level returns without changing anything and asks.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          productName: { type: "string", description: "The parent product, in the owner's words." },
          variantName: { type: "string", description: "The variant/option to change, e.g. \"12-pack\"." },
          price: { type: "number", description: "New variant price in dollars." },
          inventory: { type: "number", description: "New variant stock quantity." },
          newName: { type: "string", description: "New variant name, if renaming." },
        },
        required: ["productName", "variantName"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const products = await sfFetchProducts(ctx.ownerToken, ctx.businessId);
        const pf = sfResolveByName(products, String(args.productName || ""));
        if ("none" in pf) return { ok: false, real: false, summary: `I couldn't find a product called "${args.productName}". You have: ${products.map((p) => p.name).join(", ") || "(none)"}.`, error: "not_found" };
        if ("ambiguous" in pf) return { ok: false, real: false, summary: `More than one product matches "${args.productName}": ${pf.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const variants = await sfFetchVariants(ctx.ownerToken, ctx.businessId, pf.item.id);
        const vf = sfResolveByName(variants, String(args.variantName || ""));
        if ("none" in vf) return { ok: false, real: false, summary: `"${pf.item.name}" has no option called "${args.variantName}". Its options: ${variants.map((v) => v.name).join(", ") || "(none)"}.`, error: "variant_not_found" };
        if ("ambiguous" in vf) return { ok: false, real: false, summary: `More than one option matches "${args.variantName}": ${vf.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const patch: Record<string, unknown> = { business_id: ctx.businessId };
        if (args.price != null) patch.price = sfDollars(args.price);
        if (args.inventory != null) patch.inventory = Number(args.inventory);
        if (args.newName) patch.name = String(args.newName);
        const r = await callCommerceApi(ctx.ownerToken, "PATCH", `/variants/${vf.item.id}`, patch);
        if (r.status === 200 && r.json?.variant) return { ok: true, real: true, summary: `Updated the "${vf.item.name}" option on "${pf.item.name}".`, raw: { id: vf.item.id } };
        return { ok: false, real: false, summary: "I couldn't update that variant just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "createCollection",
      description:
        "Create a collection to group products (e.g. \"Detailing Supplies\"). Use this before or alongside addProductsToCollection when the owner wants products organized under a named group.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          name: { type: "string", description: "The collection name, e.g. \"Detailing Supplies\"." },
        },
        required: ["name"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const name = String(args.name || "").trim();
        if (!name) return { ok: false, real: false, summary: "I need a name for the collection.", error: "missing_name" };
        const r = await callCommerceApi(ctx.ownerToken, "POST", "/collections", { business_id: ctx.businessId, name, published: true });
        if (r.status === 201 && r.json?.collection) return { ok: true, real: true, summary: `Created the "${name}" collection.`, raw: { id: r.json.collection.id } };
        return { ok: false, real: false, summary: "I couldn't create that collection just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "addProductsToCollection",
      description:
        "Put products into a collection. Identify the collection by collectionName. Either pass productNames (the specific products, in the owner's words) or allProducts:true for \"put all of them in\". Any product name that's ambiguous or missing stops the whole action and asks — never guess.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          collectionName: { type: "string", description: "The target collection, in the owner's words." },
          productNames: { type: "string", description: "A comma-separated list of product names to add (in the owner's words). Omit if using allProducts." },
          allProducts: { type: "boolean", description: "TRUE to add every product in the store to the collection." },
        },
        required: ["collectionName"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const collections = await sfFetchCollections(ctx.ownerToken, ctx.businessId);
        const cf = sfResolveByName(collections, String(args.collectionName || ""));
        if ("none" in cf) return { ok: false, real: false, summary: `I couldn't find a collection called "${args.collectionName}". You have: ${collections.map((c) => c.name).join(", ") || "(none)"}.`, error: "not_found" };
        if ("ambiguous" in cf) return { ok: false, real: false, summary: `More than one collection matches "${args.collectionName}": ${cf.ambiguous.join(" and ")}. Which one?`, error: "ambiguous" };
        const products = await sfFetchProducts(ctx.ownerToken, ctx.businessId);
        let ids: string[] = [];
        if (args.allProducts === true) {
          ids = products.map((p) => p.id);
        } else {
          const names = String(args.productNames || "").split(",").map((s) => s.trim()).filter(Boolean);
          if (!names.length) return { ok: false, real: false, summary: "Which products should go in the collection?", error: "no_products" };
          for (const nm of names) {
            const pf = sfResolveByName(products, nm);
            if ("none" in pf) return { ok: false, real: false, summary: `I couldn't find a product called "${nm}". Nothing was changed. You have: ${products.map((p) => p.name).join(", ") || "(none)"}.`, error: "not_found" };
            if ("ambiguous" in pf) return { ok: false, real: false, summary: `"${nm}" matches more than one product: ${pf.ambiguous.join(" and ")}. Which one? Nothing was changed.`, error: "ambiguous" };
            ids.push(pf.item.id);
          }
        }
        if (!ids.length) return { ok: false, real: false, summary: "There are no products to add yet.", error: "no_products" };
        const r = await callCommerceApi(ctx.ownerToken, "POST", `/collections/${cf.item.id}/products`, { business_id: ctx.businessId, product_ids: ids });
        if (r.status === 200) return { ok: true, real: true, summary: `Added ${ids.length} product${ids.length === 1 ? "" : "s"} to "${cf.item.name}".`, raw: { collectionId: cf.item.id, count: ids.length } };
        return { ok: false, real: false, summary: "I couldn't update that collection just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "configureStore",
      description:
        "Turn the store on/off or set its headline text. Use enabled:true when the owner wants to start selling (\"I want to start selling supplies\", \"turn on my store\"). heroTitle/heroSubtitle set the store's headline copy.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          enabled: { type: "boolean", description: "TRUE to turn the store on, FALSE to turn it off." },
          heroTitle: { type: "string", description: "Store headline, e.g. \"Detailing Supplies\"." },
          heroSubtitle: { type: "string", description: "Store subheadline." },
        },
        required: [],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const patch: Record<string, unknown> = { business_id: ctx.businessId };
        if (args.enabled !== undefined) patch.enabled = args.enabled === true;
        if (args.heroTitle != null) patch.heroTitle = String(args.heroTitle);
        if (args.heroSubtitle != null) patch.heroSubtitle = String(args.heroSubtitle);
        if (Object.keys(patch).length === 1) return { ok: false, real: false, summary: "What would you like to change about the store?", error: "no_change" };
        const r = await callCommerceApi(ctx.ownerToken, "PATCH", "/settings", patch);
        if (r.status === 200 && r.json?.settings) {
          const on = r.json.settings.enabled !== false;
          return { ok: true, real: true, summary: args.enabled !== undefined ? (on ? "Your store is on." : "Your store is turned off.") : "Updated your store settings.", raw: {} };
        }
        return { ok: false, real: false, summary: "I couldn't update the store settings just now.", error: r.json?.error || `http_${r.status}` };
      },
    },
    {
      name: "generateStorefront",
      description:
        "Design (or completely redesign) the standalone Store's PRESENTATION — its layout, theme, hero, and which products/collections are featured — from the business's real Commerce catalog. Use when the owner says things like \"build me a premium store\" or \"design my storefront\". This changes only the Store's look, never the products/prices/inventory themselves. Returns a Storefront layout the editor applies + previews.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          brief: { type: "string", description: "The owner's guidance in their own words, e.g. \"premium detailing supply store\", \"clean and minimal\". Optional — omit for a sensible default." },
        },
        required: [],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const res = await sfBuildStorefrontAst(ctx.ownerToken, ctx.businessId, {
          brief: args.brief ? String(args.brief) : undefined,
          businessName: args._businessName ? String(args._businessName) : undefined,
          accent: args._accent ? String(args._accent) : null,
        });
        return {
          ok: true, real: res.real,
          summary: "Designed your store — take a look at the preview.",
          raw: { storefrontAst: res.ast },
        };
      },
    },
    {
      name: "patchStorefront",
      description:
        "Refine the Store's PRESENTATION with a plain-language instruction — e.g. \"make it more premium\", \"put ceramic coating first\", \"make the product cards bigger\", \"add a best sellers section\", \"use my brand colors\". Only changes the Store's look/merchandising (order, featured products, block sizes, theme), never the Commerce products/prices themselves. Returns the updated Storefront layout the editor applies + previews.",
      argsSchema: {
        type: "object",
        properties: {
          businessId: sfBusinessIdArg,
          instruction: { type: "string", description: "The owner's change request, in their own words." },
        },
        required: ["instruction"],
      },
      handler: async (args) => {
        const ctx = sfOwnerCtx(args);
        if (!ctx) return SF_NO_CTX;
        const instruction = String(args.instruction || "").trim();
        if (!instruction) return { ok: false, real: false, summary: "What would you like to change about the store's look?", error: "missing_instruction" };
        const res = await sfBuildStorefrontAst(ctx.ownerToken, ctx.businessId, {
          instruction,
          currentAst: args._storefrontAst || { version: 1, theme: { style: "clean", accent: null }, blocks: [] },
          businessName: args._businessName ? String(args._businessName) : undefined,
          accent: args._accent ? String(args._accent) : null,
        });
        return {
          ok: true, real: res.real,
          summary: "Updated your store — take a look.",
          raw: { storefrontAst: res.ast },
        };
      },
    },
  ],
});
