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
  type ChromeOverrides,
  type RenderContext,
} from "./hubly_document.ts";
import { imageDimensions, type ImageDims } from "./hubly_image_dims.ts";
import { stampFreeformHtml } from "./hubly_document_labels.ts";
import { injectHublyRuntime } from "./hubly_page_runtime.ts";
import { resolveImages, collapseEmptyImageSlots, pexelsFetcher, type PlacedImageRow } from "./hubly_image_resolver.ts";
import { annotatePlaceholders } from "./hubly_placeholders.ts";
import { applyFreeformEdit, humanFreeformSummary, labelInventory, labelsPresent, type LabelEntry } from "./hubly_freeform.ts";
// adminHeaders() THROWS when no service/secret key resolves, and omits the
// Authorization header for non-JWT sb_secret_ keys, which PostgREST rejects as
// "Invalid JWT". Both behaviours are load-bearing -- see supabase_admin.ts.
import { adminHeaders, requireSecretKey, resolvePublishableKey, requirePublishableKey } from "./supabase_admin.ts";
import { adminClient } from "./marketplace_provider.ts";
import { getWebsiteAvailability, createWebsiteBookingJob } from "./hubly_booking_execution.ts";
import { buildPageStructureBlock, buildPaletteBlock, paletteById, palettePromptList, sectionOrderFor } from "./site_identity.ts";

const APP_ORIGIN = (Deno.env.get("HUBLY_APP_ORIGIN") || "").trim() || "https://myhubly.app";

export type CapabilityActionArgSchema = {
  type: "object";
  /**
   * `enum` is expressible because some arguments genuinely have a closed set of
   * values (header placement, CTA mode) and prose alone does not stop a model
   * inventing a sixth one. It is a PROMPT, not a gate: every handler that
   * accepts an enum still validates the value it receives against the same list
   * before acting on it, because the schema only ever reaches the model.
   */
  properties: Record<string, { type: string; description: string; enum?: readonly string[] }>;
  required: string[];
};

export type CapabilityActionResult = {
  ok: boolean;
  /** Did genuine backend work actually happen, or is this a best-effort/limited stopgap? */
  real: boolean;
  /** Honest, human-readable account of what happened — consumers should rely on this and nothing more. */
  summary: string;
  /**
   * What to SAY TO THE PERSON, when that differs from `summary`.
   *
   * `summary` is written for the model and the logs: it names versions, URLs
   * and whether the work was real, because those are the things a caller
   * reasoning about the result needs. Read aloud in a chat it is noise.
   *
   * Actions that a person triggers DIRECTLY — click-to-edit, a dropped image —
   * have no model turn to narrate them, so whatever goes here is the only
   * acknowledgement they get. An action that changes the page and sets nothing
   * here changes the page in silence.
   */
  humanNote?: string;
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
  // A missing key now throws rather than returning empty-handed: an absent
  // key and an absent row used to be the same value here.
  const headers = adminHeaders();
  if (!supabaseUrl) return null;
  const res = await fetch(`${supabaseUrl}/functions/v1/marketplace`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
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
  // A missing key now throws rather than returning empty-handed: an absent
  // key and an absent row used to be the same value here.
  const headers = adminHeaders();
  if (!supabaseUrl) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
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
  // A missing key now throws rather than returning empty-handed: an absent
  // key and an absent row used to be the same value here.
  const headers = adminHeaders();
  if (!supabaseUrl) return null;
  const url = `${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}&select=${encodeURIComponent(columns)}&limit=1`;
  const res = await fetch(url, { headers: headers });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Multi-row read with the service role. selectOne's sibling. */
async function selectMany(table: string, filterCol: string, filterVal: string, columns: string, order?: string): Promise<any[]> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  // A missing key now throws rather than returning empty-handed: an absent
  // key and an absent row used to be the same value here.
  const headers = adminHeaders();
  if (!supabaseUrl) return [];
  const ord = order ? `&order=${order}` : "";
  const url = `${supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}&select=${columns}${ord}`;
  const res = await fetch(url, { headers: headers });
  if (!res.ok) return [];
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows : [];
}

/**
 * THE BUSINESS RECORD — what the generator is allowed to know.
 *
 * Until 2026-08-18 generateDocument read six columns, all of them for
 * rendering (name, phone, slug, brand_color, logo_url, section_order), and the
 * only content input was `brief`: a prose paragraph the CONVERSATION model
 * wrote from what the owner typed. Reads of services, pricing, photos, hours
 * and blueprint were each zero. So an entire website was written from a summary
 * of a summary, which is the root cause of vague pages, repeated sections, and
 * the gap against the reference page -- that page got rich input.
 *
 * setServices already writes the real `services` table, so nothing needed
 * bridging; the generator simply never looked.
 *
 * Everything here is READ ONLY and canonical. The Service Engine stays the
 * single source of truth for services and prices: this loads them, it does not
 * copy or re-derive them.
 */
export type BusinessRecord = {
  services: { name: string; price: number | null; description: string | null; duration_hours: number | null; includes: unknown; is_popular: boolean | null }[];
  photos: { url: string; kind: string; caption?: string | null }[];
  reviews: { customer_name: string | null; service_name: string | null; stars: number | null; quote: string | null }[];
  hours: { day: string | number | null; open: string | null; close: string | null; closed: boolean | null }[];
  areaCities: string[];
  city: string | null;
  state: string | null;
  travelRadiusMiles: number | null;
  yearsInBusiness: number | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  businessType: string | null;
  about: string | null;
  tagline: string | null;
};

/**
 * The record, rendered for the model as DATA rather than folded into prose.
 *
 * Deliberately not merged into `brief`. The brief is what the owner said; this
 * is what Hubly actually knows. Keeping them separate means the model can tell
 * a fact from a paraphrase, and means an empty record reads as "we have nothing
 * here yet" instead of quietly looking like the owner never mentioned it.
 *
 * Empty sections are printed as an explicit "none on record" rather than
 * omitted, because a missing heading is ambiguous and "none on record" is not.
 */
export function buildBusinessRecordBlock(rec: BusinessRecord): string {
  const money = (n: number | null) => (typeof n === "number" && n > 0 ? `$${n}` : null);
  const L: string[] = [];

  L.push("THE BUSINESS RECORD — everything Hubly actually knows about this business.");
  L.push("");
  L.push("This is DATA, not the owner's paraphrase. It is the only source of facts you may state.");
  L.push("Anything marked \"none on record\" is genuinely unknown: do not fill the gap, do not estimate, do not write a plausible-sounding substitute.");
  L.push("");

  if (rec.services.length) {
    L.push(`SERVICES (${rec.services.length}) — canonical, from the Service Engine. These are the real services; do not rename, merge, split or invent alongside them:`);
    for (const s of rec.services) {
      const bits = [money(s.price), s.duration_hours ? `${s.duration_hours}h` : null, s.is_popular ? "most popular" : null].filter(Boolean);
      L.push(`- ${s.name}${bits.length ? " (" + bits.join(", ") + ")" : ""}${s.description ? " — " + s.description : ""}`);
      if (Array.isArray(s.includes) && s.includes.length) L.push(`    includes: ${s.includes.join(", ")}`);
    }
    const priced = rec.services.filter((s) => money(s.price)).length;
    if (!priced) L.push("  NOTE: no service has a real price on record. Do not print a price, a range, a \"from\" figure or a guess for any of them.");
  } else {
    L.push("SERVICES: none on record. Do not invent a service list.");
  }
  L.push("");

  if (rec.photos.length) {
    L.push(`PHOTOS (${rec.photos.length}) — real uploaded assets. Use these exact URLs in <img src>; never invent one, and never use a photo the record does not list:`);
    for (const ph of rec.photos.slice(0, 24)) L.push(`- [${ph.kind}] ${ph.url}${ph.caption ? " — " + ph.caption : ""}`);
    const beforeAfter = rec.photos.filter((x) => x.kind === "before" || x.kind === "after").length;
    if (beforeAfter >= 2) L.push("  These include before/after pairs — a comparison section is genuinely supported.");
  } else {
    L.push("PHOTOS: none on record. Build the real structure with honest empty frames (is-placeholder) rather than skipping the section or inventing an image URL.");
  }
  L.push("");

  if (rec.reviews.length) {
    L.push(`REVIEWS (${rec.reviews.length}, approved only) — quote these EXACTLY or not at all:`);
    for (const r of rec.reviews.slice(0, 8)) L.push(`- ${r.stars ? r.stars + "★ " : ""}${r.customer_name || "Anonymous"}${r.service_name ? " (" + r.service_name + ")" : ""}: ${r.quote || "(no quote)"}`);
  } else {
    L.push("REVIEWS: none on record. Do not write testimonials, star ratings, review counts or phrases like \"loved by locals\". Use HublyReviews, which shows an honest empty state.");
  }
  L.push("");

  const area = [rec.city, rec.state].filter(Boolean).join(", ");
  const cities = rec.areaCities.length ? rec.areaCities.join(", ") : null;
  if (area || cities || rec.travelRadiusMiles) {
    L.push("SERVICE AREA:");
    if (area) L.push(`- based in ${area}`);
    if (cities) L.push(`- serves: ${cities}`);
    if (rec.travelRadiusMiles) L.push(`- travels up to ${rec.travelRadiusMiles} miles`);
  } else {
    L.push("SERVICE AREA: none on record. Do not name towns, neighbourhoods or a radius.");
  }
  L.push("");

  if (rec.hours.length) {
    L.push(`OPENING HOURS: ${rec.hours.length} rows on record — state them only as recorded.`);
  } else {
    L.push("OPENING HOURS: none on record. Do not print hours, \"open 7 days\", \"evenings and weekends\" or same-day availability.");
  }
  L.push("");

  L.push("CONTACT:");
  L.push(rec.phone ? `- phone: ${rec.phone}` : "- phone: none on record — do not invent one, and do not write \"call us today\" as if a number existed");
  L.push(rec.email ? `- email: ${rec.email}` : "- email: none on record");
  L.push("");

  const misc: string[] = [];
  if (rec.businessType) misc.push(`type: ${rec.businessType}`);
  if (rec.yearsInBusiness) misc.push(`years in business: ${rec.yearsInBusiness}`);
  if (rec.tagline) misc.push(`tagline: ${rec.tagline}`);
  if (rec.about) misc.push(`about: ${rec.about}`);
  L.push(misc.length ? "ALSO ON RECORD:\n" + misc.map((m) => "- " + m).join("\n") : "No years-in-business, tagline or about text on record — do not claim experience, longevity or credentials.");

  return L.join("\n");
}

/**
 * RE-RENDER AS AN EVENT, NOT A DECISION.
 *
 * The record is empty at exactly the moment the generator runs: turn 1 is
 * startDraft -> generateDocument, setServices lands on turn 2, and the prompt
 * (correctly) forbids calling generateDocument twice so the model cannot
 * rebuild on a whim. The result was that a normal new business got a data-free
 * page forever, and the walk -- "logo, then photos, then services and prices" --
 * collected answers into a black hole.
 *
 * So the model does not decide this. The DATA ARRIVING decides it: a handler
 * that writes real content to the record reports what it wrote, and
 * hubly-conversation fires exactly one rebuild at the end of that turn.
 *
 * TWO SAFETY PROPERTIES, both deliberate:
 *
 *  1. It refuses once the owner has hand-edited their page. Any version with
 *     created_by='patch' means a human changed something, and silently
 *     regenerating over that would destroy their work to show them a price.
 *     Cosmetic changes still re-render, because that only redraws chrome.
 *
 *  2. It never fabricates a brief. The brief it passes is a plain instruction
 *     to rebuild from the record, so every fact still comes from
 *     buildBusinessRecordBlock and nothing is invented to fill the gap.
 */
export type RecordChange = "services" | "photos" | "area" | "hours" | "contact" | "cosmetic";

/** Content changes need a real rebuild; cosmetic ones only need a re-render. */
const CONTENT_CHANGES = new Set<RecordChange>(["services", "photos", "area", "hours", "contact"]);

/** Has a human hand-edited this page? Checked synchronously before a turn
 *  responds, so a skipped rebuild can be MENTIONED rather than logged into a
 *  void the owner never sees. */
export async function documentHasOwnerEdits(draftId: string): Promise<boolean> {
  try {
    const versions = await selectMany("business_documents", "business_id", draftId, "created_by,version", "version.asc");
    return versions.some((v: any) => v.created_by === "patch");
  } catch {
    return false;
  }
}

/**
 * TARGETED UPDATE, record-driven. The owner's phone number changed in the
 * record; the page should say the new one.
 *
 * NO MODEL CALL. The value roles (contact.phone, contact.email,
 * contact.address, business.name) are closed and map one-to-one onto columns,
 * so this is a lookup and a string replace. That is what makes it safe to run
 * automatically on every record change: it is free, instant, deterministic, and
 * it can only ever touch the specific facts that changed.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is regenerate. A change to services, photos,
 * hours or service area cannot be expressed as a value swap, and the fix for
 * that is NOT to quietly rebuild the page — that is precisely the operation
 * that destroys an owner's edits. Those changes report `not_applicable`, and
 * the conversation offers a new page as an explicit choice with its costs
 * stated (see planFreeformRegeneration).
 */
async function syncFreeformFacts(
  draftId: string,
  draftToken: string,
  changes: RecordChange[],
  latest: Extract<LatestBusinessDocument, { format: "html" }>,
): Promise<{ status: "patched" | "not_applicable" | "failed"; detail?: string }> {
  try {
    if (!changes.includes("contact")) {
      // Nothing here can be expressed as a value swap.
      return { status: "not_applicable", detail: changes.join(",") };
    }
    const biz = await selectOne("businesses", "id", draftId, "name,phone,email,address,city,state");
    if (!biz) return { status: "failed", detail: "no_business_row" };

    const wants: { label: string; value: string }[] = [];
    if (biz.phone) wants.push({ label: "contact.phone", value: String(biz.phone) });
    if (biz.email) wants.push({ label: "contact.email", value: String(biz.email) });
    if (biz.name) wants.push({ label: "business.name", value: String(biz.name) });
    const addr = [biz.address, [biz.city, biz.state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
    if (addr) wants.push({ label: "contact.address", value: addr });

    let html = latest.renderedHtml;
    const applied: string[] = [];
    for (const w of wants) {
      const r = applyFreeformEdit(html, { label: w.label, text: w.value });
      // no_match and no_change are both normal: the page may not state this
      // fact, or may already state it correctly. Neither is a failure.
      if (r.ok) { html = r.html; applied.push(`${w.label} (${r.changed})`); }
    }
    if (!applied.length) return { status: "not_applicable", detail: "nothing_to_change" };

    const saved = await callBusinessRpc("create_business_document", {
      p_business_id: draftId,
      p_draft_token: draftToken,
      p_tag: "website",
      p_document: latest.brief,
      p_rendered_html: html,
      p_created_by: "patch",
      p_format: "html",
    });
    return saved && saved.ok === true
      ? { status: "patched", detail: applied.join(", ") }
      : { status: "failed", detail: "save" };
  } catch (e) {
    console.error("syncFreeformFacts failed:", e);
    return { status: "failed", detail: String(e).slice(0, 120) };
  }
}

/**
 * NEW VERSION — the explicit, owner-chosen operation. This function does not
 * regenerate anything. It reports what a regeneration would COST, by name, so
 * the owner can decide.
 *
 * WHY IT IS SPLIT THIS WAY
 *
 * The obvious design is to freeze a page once it has owner edits. That ends the
 * conversation loop permanently after one click, and the loop is the product.
 * So a new page stays available forever — it just stops being something that
 * can happen without the owner knowing what they are giving up.
 *
 * WHAT SURVIVES, AND WHY IT IS KNOWABLE RATHER THAN GUESSED
 *
 *   Value roles (hero.headline, contact.phone, contact.email, business.name…)
 *   name a fact or a fixed part of any page. A new page will have a headline
 *   and a phone number, so an edit to one can be carried across.
 *
 *   Positional roles (section.3.heading, section.2.item.4.body) name a PLACE in
 *   a structure that is about to be replaced. There is no section 3 in a page
 *   that does not exist yet. These do not carry, and this says so explicitly
 *   rather than pretending or silently dropping them.
 */
export interface FreeformRegenerationPlan {
  hasEdits: boolean;
  /** Owner-edited labels that a new page will keep. */
  carried: { label: string; value: string }[];
  /** Owner-edited labels that a new page will lose. */
  lost: { label: string; value: string }[];
  /** One sentence naming the loss, for the owner, not the log. */
  warning: string;
}

/** Labels whose meaning survives a structural rewrite. */
const CARRIES_ACROSS = new Set([
  "hero.headline", "hero.subhead", "hero.cta",
  "contact.phone", "contact.email", "contact.address",
  "business.name", "business.logo",
]);

export async function planFreeformRegeneration(draftId: string): Promise<FreeformRegenerationPlan> {
  const empty: FreeformRegenerationPlan = { hasEdits: false, carried: [], lost: [], warning: "" };
  const latest = await selectLatestBusinessDocument(draftId, "website");
  if (!latest || latest.format !== "html") return empty;

  // What did the OWNER change, as opposed to what the model first wrote? The
  // first version of a page is generated; every later version tagged 'patch' is
  // an edit. Comparing the current page against the first one is what makes the
  // warning name real values instead of listing everything on the page.
  const first = await selectFirstBusinessDocument(draftId, "website");
  if (!first || first.format !== "html") return empty;

  const now = new Map(labelInventory(latest.renderedHtml).map((e: LabelEntry) => [e.label, e.value]));
  const then = new Map(labelInventory(first.renderedHtml).map((e: LabelEntry) => [e.label, e.value]));

  const carried: { label: string; value: string }[] = [];
  const lost: { label: string; value: string }[] = [];
  for (const [label, value] of now) {
    const was = then.get(label);
    if (was === undefined || was === value) continue;
    (CARRIES_ACROSS.has(label) ? carried : lost).push({ label, value });
  }
  const hasEdits = carried.length + lost.length > 0;
  if (!hasEdits) return empty;

  // Named, not counted. "You will lose 3 edits" is not something anyone can
  // make a decision about.
  const say = (xs: { label: string; value: string }[]) =>
    xs.map((x) => `${humanLabelName(x.label)} ("${x.value.length > 40 ? x.value.slice(0, 37) + "…" : x.value}")`).join(", ");
  const warning = lost.length
    ? `You've changed ${say([...carried, ...lost])}. A new page will keep ${carried.length ? say(carried) : "none of those"} and lose ${say(lost)}.`
    : `You've changed ${say(carried)}. A new page will keep ${carried.length === 1 ? "that" : "those"}.`;
  return { hasEdits, carried, lost, warning };
}

/** "section.3.heading" -> "the heading of section 3". Said, not printed. */
function humanLabelName(label: string): string {
  const p = label.split(".");
  if (label === "hero.headline") return "your headline";
  if (label === "hero.subhead") return "your intro line";
  if (label === "contact.phone") return "your phone number";
  if (label === "contact.email") return "your email address";
  if (label === "contact.address") return "your address";
  if (label === "business.name") return "your business name";
  if (p[0] === "section" && p[2] === "heading") return `the heading of section ${p[1]}`;
  if (p[0] === "section" && p[2] === "item") return `item ${p[3]} in section ${p[1]}`;
  if (p[0] === "section") return `text in section ${p[1]}`;
  if (p[0] === "nav") return `a menu link`;
  if (p[0] === "footer") return `footer text`;
  return label;
}

/** The FIRST stored version — what the model originally wrote, before edits. */
async function selectFirstBusinessDocument(businessId: string, tag: string): Promise<LatestBusinessDocument | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const headers = adminHeaders();
  if (!supabaseUrl) return null;
  const url = `${supabaseUrl}/rest/v1/business_documents?business_id=eq.${encodeURIComponent(businessId)}&tag=eq.${encodeURIComponent(tag)}&select=version,format,document,rendered_html&order=version.asc&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[0];
  if (row.format === "html") {
    return { version: row.version, format: "html", brief: (row.document || {}) as FreeformBrief, renderedHtml: String(row.rendered_html || "") };
  }
  return { version: row.version, format: "ast", document: row.document as HublyDocument, renderedHtml: typeof row.rendered_html === "string" ? row.rendered_html : null };
}

export async function rebuildDocumentFromRecord(
  draftId: string,
  draftToken: string,
  changes: RecordChange[],
  opts?: { force?: boolean },
): Promise<{ status: "rebuilt" | "rerendered" | "patched" | "skipped_owner_edited" | "no_document" | "not_applicable" | "failed"; detail?: string }> {
  try {
    const latest = await selectLatestBusinessDocument(draftId, "website");
    if (!latest) return { status: "no_document" };

    // THIS BRANCH IS HAND-WRITTEN BECAUSE THE COMPILER CANNOT DEMAND IT.
    //
    // Every other reader of `document` dereferences it, so the discriminated
    // union forces them to narrow or fail to build. This one only tests
    // `latest` for existence and then hands off — so it type-checked perfectly
    // while being completely unaware that freeform pages exist. It is exactly
    // the "reader that doesn't know" this whole change was meant to prevent,
    // and it was found by re-reading the audit list, not by the type system.
    if (latest.format !== "ast") {
      // A record change must NEVER regenerate a freeform page. Regeneration is
      // the operation that destroys owner edits, and it only ever happens when
      // the owner explicitly asks for a different page (planFreeformRegeneration).
      // What a record change gets is a targeted update: change the facts the
      // page states, leave everything else exactly as it is.
      return await syncFreeformFacts(draftId, draftToken, changes, latest);
    }

    const wantsContent = changes.some((c) => CONTENT_CHANGES.has(c));
    if (!wantsContent) {
      const r = await rerenderLatestDocument(draftId, draftToken, "website");
      if (r === "not_applicable") return { status: "not_applicable" };
      return { status: r === "updated" ? "rerendered" : "failed" };
    }

    // Has a human edited this page? If so, their edits win over our tidiness.
    // force = the OWNER asked for it. The guard exists to stop us silently
    // overwriting their edits, not to stop them choosing to rebuild.
    if (!opts?.force && await documentHasOwnerEdits(draftId)) {
      return { status: "skipped_owner_edited" };
    }

    const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,logo_url,section_order,city,state,service_area_cities,business_type,meta");
    const record = await loadBusinessRecord(draftId);
    const leadWith = Array.isArray(bizRow?.section_order) ? bizRow.section_order[0] : undefined;
    const system = `You generate a real webpage for a real local service business, in the Hubly Document format below. Write real, specific copy for THIS business — never generic placeholder text, never "Lorem ipsum", never a literal business-name placeholder if a real name was given. Only place a reserved Hubly element (booking, reviews, etc.) where it's genuinely relevant to what a visitor needs next — never decorative.\n\n${buildDocumentSchemaPromptBlock()}\n\n${buildPageStructureBlock(leadWith)}\n\n${buildPaletteBlock()}\n\n${buildBusinessRecordBlock(record)}`;

    const brief = `Rebuild this page for ${bizRow?.name || "this business"} using THE BUSINESS RECORD above as the source of every fact. New information has just been added to the record (${changes.join(", ")}), and the current page was written before it existed. Use the real services, prices, photos, service area and contact details exactly as recorded. Do not invent anything the record does not contain.`;

    const gen = await generateAndValidateDocument(system, brief, draftId, "website");
    if (!gen.ok) return { status: "failed", detail: "validation" };

    const html = renderHublyDocument(gen.document, renderContextFor(draftId, bizRow));
    const saved = await callBusinessRpc("create_business_document", {
      p_business_id: draftId,
      p_draft_token: draftToken,
      p_tag: "website",
      p_document: gen.document,
      p_rendered_html: html,
      p_created_by: "ai",
      p_design_rationale: gen.rationale || null,
    });
    return saved && saved.ok === true ? { status: "rebuilt" } : { status: "failed", detail: "save" };
  } catch (e) {
    console.error("rebuildDocumentFromRecord failed:", e);
    return { status: "failed", detail: String(e).slice(0, 120) };
  }
}

/**
 * THE ONE PLACE a RenderContext is built.
 *
 * There were five, assembled by hand, and two of them had already drifted --
 * they omitted businessMapQuery, so the same document rendered a real map or a
 * dashed placeholder depending on which code path happened to re-render it.
 * Adding the chrome inputs to five hand-written literals would have guaranteed
 * a sixth divergence, so they now all come through here.
 *
 * Every field is read off a real businesses row. Nothing is invented, and the
 * caller cannot forget a field it has never heard of.
 */
function renderContextFor(businessId: string, bizRow: any): RenderContext {
  return {
    businessId,
    businessName: bizRow?.name || "",
    businessPhone: bizRow?.phone || undefined,
    businessBrandColor: bizRow?.brand_color || undefined,
    businessLogoUrl: bizRow?.logo_url || undefined,
    businessMapQuery: mapQueryFor(bizRow),
    businessType: bizRow?.business_type || undefined,
    businessLogoAspect: logoAspectFrom(websiteMetaOf(bizRow)),
    chromeOverrides: chromeOverridesFrom(websiteMetaOf(bizRow)),
  };
}

/**
 * businesses.meta -> 'website'. NOT a `website_meta` column: there isn't one.
 * patch_business_in_progress takes a p_website_meta ARGUMENT and merges it into
 * meta->'website', and the argument name reads so much like a column that the
 * first version of this selected `website_meta` — which PostgREST rejects, so
 * every select returned null and the rendered header lost the business name,
 * phone, logo and brand colour at once. Stored as text in some rows and jsonb
 * in others, hence the parse.
 */
function websiteMetaOf(bizRow: any): Record<string, unknown> | undefined {
  const raw = bizRow?.meta;
  if (!raw) return undefined;
  let meta: any = raw;
  if (typeof raw === "string") {
    try { meta = JSON.parse(raw); } catch { return undefined; }
  }
  const w = meta?.website;
  return w && typeof w === "object" ? w as Record<string, unknown> : undefined;
}

/** website_meta.logoAspect, written at upload time by uploadDraftLogo. Guarded
 *  rather than trusted: website_meta is jsonb an older build could have put
 *  anything in, and a NaN here would silently pick a shape at random. */
function logoAspectFrom(meta: unknown): number | undefined {
  const v = (meta as any)?.logoAspect;
  return typeof v === "number" && isFinite(v) && v > 0 ? v : undefined;
}

/** website_meta.chrome, written by website.setChrome. Every value is checked
 *  against the enum it belongs to and dropped if it does not match -- this is
 *  persisted jsonb, so it is untrusted input like any other. */
const CHROME_ENUMS: Record<string, readonly string[]> = {
  logoPlacement: ["left", "centre", "stack"],
  logoScale: ["sm", "md", "lg"],
  logoShape: ["wordmark", "wide", "square", "tall"],
  headerStyle: ["solid", "transparent"],
  nav: ["full", "none"],
  cta: ["book", "call"],
};

function chromeOverridesFrom(meta: unknown): ChromeOverrides | undefined {
  const raw = (meta as any)?.chrome;
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, allowed] of Object.entries(CHROME_ENUMS)) {
    const v = raw[key];
    if (typeof v === "string" && allowed.includes(v)) out[key] = v;
  }
  if (typeof raw.sticky === "boolean") out.sticky = raw.sticky;
  return Object.keys(out).length ? out as ChromeOverrides : undefined;
}

/* ---------------------------------------------------------------------------
 * APPLYING EXTRACTED FACTS
 *
 * Fills BLANKS ONLY. Extraction is a floor under the model, not an authority
 * over it: if a field already holds a value, something -- the owner, or the
 * model acting on a later correction -- put it there deliberately, and
 * re-reading an earlier message must not undo that. "I typed my new number and
 * it went back to the old one" is a worse bug than the one this fixes.
 * ------------------------------------------------------------------------- */

export type ExtractedFactWrite = {
  written: string[];
  skipped: string[];
  recordChange: RecordChange[];
};

export async function applyExtractedFacts(
  draftId: string,
  draftToken: string,
  facts: {
    phone?: string; email?: string; postalCode?: string; city?: string; state?: string;
    address?: string; serviceAreaCities?: string[]; travelRadiusMiles?: number;
    yearsInBusiness?: number;
    hours?: { weekday: number; open: string | null; close: string | null; closed: boolean }[];
  },
  pricedServices?: { name: string; price: number }[],
): Promise<ExtractedFactWrite> {
  const written: string[] = [];
  const skipped: string[] = [];
  const changes = new Set<RecordChange>();
  if (!draftId || !draftToken) return { written, skipped, recordChange: [] };

  const row = await selectOne(
    "businesses",
    "id",
    draftId,
    // NO postal_code -- there is no such column, and PostgREST answers a bad
    // column with a 400 that selectOne turns into null, silently emptying every
    // field in this list. Verified against the live schema before shipping:
    // a 400 means a bad column, a 401 means the list is fine and RLS stopped
    // the read. See the standing rule in KNOWN_ISSUES.
    "phone,email,city,state,address,service_area_cities,travel_radius_miles,years_in_business",
  );

  const patch: Record<string, unknown> = {};
  const fill = (col: string, key: string, value: unknown, change: RecordChange) => {
    if (value === undefined || value === null || value === "") return;
    const existing = (row as Record<string, unknown> | null)?.[col];
    const isBlank = existing === null || existing === undefined || existing === "" ||
      (Array.isArray(existing) && existing.length === 0);
    if (!isBlank) { skipped.push(key); return; }
    patch[col] = value;
    written.push(key);
    changes.add(change);
  };

  fill("phone", "phone", facts.phone, "contact");
  fill("email", "email", facts.email, "contact");
  fill("city", "city", facts.city, "area");
  fill("state", "state", facts.state, "area");
  // The postcode has no column of its own, so it rides with the address it
  // belongs to. Dropped entirely when there is no address rather than invented
  // a home somewhere it does not fit.
  const addressWithZip = facts.address && facts.postalCode && !facts.address.includes(facts.postalCode)
    ? `${facts.address}, ${facts.postalCode}`
    : facts.address;
  fill("address", "address", addressWithZip, "area");
  fill("service_area_cities", "serviceAreaCities", facts.serviceAreaCities, "area");
  fill("travel_radius_miles", "travelRadiusMiles", facts.travelRadiusMiles, "area");
  fill("years_in_business", "yearsInBusiness", facts.yearsInBusiness, "contact");

  if (Object.keys(patch).length) {
    const r = await callBusinessRpc("patch_business_in_progress", {
      p_id: draftId,
      p_draft_token: draftToken,
      p_patch: patch,
      p_website_meta: null,
    });
    if (!r || r.ok !== true) {
      console.error("applyExtractedFacts: patch rejected", Object.keys(patch));
      return { written: [], skipped, recordChange: [] };
    }
  }

  // Hours are a set, written through their own RPC. Only when there are none
  // already: a partial week overwritten by a partial week is worse than either.
  if (facts.hours && facts.hours.length) {
    const existingHours = await selectMany("settings_business_hours", "business_id", draftId, "weekday");
    if (!Array.isArray(existingHours) || existingHours.length === 0) {
      const r = await callBusinessRpc("set_business_hours_in_progress", {
        p_id: draftId,
        p_draft_token: draftToken,
        p_hours: facts.hours,
      });
      if (r?.ok === true) { written.push(`hours(${facts.hours.length})`); changes.add("hours"); }
      else console.error("applyExtractedFacts: hours rejected", r);
    } else {
      skipped.push("hours");
    }
  }

  // Prices are the floor under setServices, not a replacement for it. Written
  // only when the business has NO services at all -- the model's structured
  // version, with descriptions and ordering, is better whenever it exists.
  if (pricedServices && pricedServices.length) {
    const existing = await selectMany("services", "business_id", draftId, "id");
    if (!Array.isArray(existing) || existing.length === 0) {
      const found = findAction("business", "setServices");
      if (found) {
        const res = await found.handler({
          draftId,
          draftToken,
          services: pricedServices.map((s) => ({ name: s.name, price: s.price })),
        });
        if (res.ok) { written.push(`services(${pricedServices.length})`); changes.add("services"); }
      }
    } else {
      skipped.push("services");
    }
  }

  return { written, skipped, recordChange: [...changes] };
}

/** What to SAY after a header change — in terms of what moved, not the enum
 *  values that moved it. "logoPlacement=centre" is a log line, not an answer to
 *  "put the logo in the middle". */
const CHROME_NOTES: Record<string, Record<string, string>> = {
  logoPlacement: { left: "the logo is on the left now", centre: "the logo is centred now", stack: "the logo has its own row above the menu now" },
  logoScale: { sm: "the logo is smaller now", md: "the logo is back to its normal size", lg: "the logo is bigger now" },
  headerStyle: { solid: "the header has a solid bar again", transparent: "the header sits over the hero now, with no bar behind it" },
  nav: { full: "the section links are back", none: "the section links are gone" },
  cta: { book: "the header button books an appointment again", call: "the header button is your phone number now" },
};

function chromeChangeNote(chrome: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(chrome)) {
    if (k === "sticky") { parts.push(v ? "the header follows the page down now" : "the header stays at the top of the page now"); continue; }
    const note = CHROME_NOTES[k]?.[String(v)];
    if (note) parts.push(note);
  }
  if (!parts.length) return "Done — the header is updated.";
  return "Done — " + parts.join(", and ") + ".";
}

/** Same query classic builds: the town, or the service area, or nothing. */
function mapQueryFor(bizRow: any): string | undefined {
  if (!bizRow) return undefined;
  const cities = Array.isArray(bizRow.service_area_cities) ? bizRow.service_area_cities.filter((c: unknown) => typeof c === "string") : [];
  const parts = [bizRow.city, bizRow.state].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (cities.length) return cities[0];
  return undefined;
}

async function loadBusinessRecord(businessId: string): Promise<BusinessRecord> {
  // NO addons, NO gallery_items.
  //
  // Both were read here and neither has a writer anywhere in the conversational
  // path -- no capability produces them, and no client upload does either. They
  // are editor-era tables, and the decision of 2026-08-18 was that existing
  // classic customers never migrate, so a Document business will never have a
  // row in either. Unlike hours and service area, their empty state carried no
  // useful negative constraint for the prompt, so reading them bought nothing
  // and cost two queries on every generation.
  const [biz, services, portfolio, reviews, hours] = await Promise.all([
    selectOne("businesses", "id", businessId, "city,state,phone,email,logo_url,business_type,about,tagline,service_area_cities,travel_radius_miles,years_in_business"),
    selectMany("services", "business_id", businessId, "name,price,description,duration_hours,includes,is_popular", "sort_order.asc"),
    selectMany("portfolio_photos", "business_id", businessId, "url", "sort_order.asc"),
    selectMany("review_submissions", "business_id", businessId, "customer_name,service_name,stars,quote,status"),
    selectMany("settings_business_hours", "business_id", businessId, "*"),
  ]);

  const photos: BusinessRecord["photos"] = [];
  for (const p of portfolio) if (p?.url) photos.push({ url: p.url, kind: "portfolio" });

  const rawCities = biz?.service_area_cities;
  const areaCities = Array.isArray(rawCities) ? rawCities.filter((c: unknown) => typeof c === "string") : [];

  return {
    services: services.map((x: any) => ({ name: x.name, price: x.price ?? null, description: x.description ?? null, duration_hours: x.duration_hours ?? null, includes: x.includes ?? null, is_popular: x.is_popular ?? null })),
    photos,
    // Only approved reviews. An unmoderated quote is exactly the kind of thing
    // that must never reach a public page.
    reviews: reviews.filter((r: any) => r?.status === "approved").map((r: any) => ({ customer_name: r.customer_name ?? null, service_name: r.service_name ?? null, stars: r.stars ?? null, quote: r.quote ?? null })),
    hours: Array.isArray(hours) ? hours : [],
    areaCities,
    city: biz?.city ?? null,
    state: biz?.state ?? null,
    travelRadiusMiles: biz?.travel_radius_miles ?? null,
    yearsInBusiness: biz?.years_in_business ?? null,
    phone: biz?.phone ?? null,
    email: biz?.email ?? null,
    logoUrl: biz?.logo_url ?? null,
    businessType: biz?.business_type ?? null,
    about: biz?.about ?? null,
    tagline: biz?.tagline ?? null,
  };
}

/** What a freeform row keeps in `document`. Not a tree — the inputs the page was
 *  generated from, which is the only place they exist and exactly what a "build
 *  me a different page" request needs in order to stay about the same business.
 *  It deliberately does NOT carry the format: that lives in the column. */
export interface FreeformBrief {
  brief?: string;
  images?: { url: string; alt?: string }[];
  generatedAt?: string;
  [k: string]: unknown;
}

/**
 * The latest stored page, discriminated by what `document` actually holds.
 *
 * A UNION rather than an optional `format` field, on purpose. Five callers read
 * this and every one of them used to assume a tree. With a union, none of them
 * can reach `.document` without narrowing first, so a reader that forgets the
 * freeform case is a compile error instead of a page quietly destroyed by a
 * re-render that had nothing to re-render from.
 */
export type LatestBusinessDocument =
  | { version: number; format: "ast"; document: HublyDocument; renderedHtml: string | null }
  | { version: number; format: "html"; brief: FreeformBrief; renderedHtml: string };

async function selectLatestBusinessDocument(businessId: string, tag: string): Promise<LatestBusinessDocument | null> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  // A missing key now throws rather than returning empty-handed: an absent
  // key and an absent row used to be the same value here.
  const headers = adminHeaders();
  if (!supabaseUrl) return null;
  // rendered_html comes back on BOTH branches even though only the freeform one
  // needs it. The alternative is a second round trip once the format is known,
  // which costs a whole request to save ~40KB on a call made a handful of times
  // per turn. If that ratio ever inverts, split it -- don't guess at the format
  // before reading it.
  const url = `${supabaseUrl}/rest/v1/business_documents?business_id=eq.${encodeURIComponent(businessId)}&tag=eq.${encodeURIComponent(tag)}&select=version,format,document,rendered_html&order=version.desc&limit=1`;
  const res = await fetch(url, { headers: headers });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[0];
  const version = row.version as number;
  // Absent/unknown format reads as 'ast'. Every row written before this column
  // existed is a tree, and the column default says so -- but a null arriving
  // from an older PostgREST cache must not be allowed to mean "freeform".
  if (row.format === "html") {
    return {
      version,
      format: "html",
      brief: (row.document && typeof row.document === "object" ? row.document : {}) as FreeformBrief,
      renderedHtml: typeof row.rendered_html === "string" ? row.rendered_html : "",
    };
  }
  return {
    version,
    format: "ast",
    document: row.document as HublyDocument,
    renderedHtml: typeof row.rendered_html === "string" ? row.rendered_html : null,
  };
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
  // SUPABASE_PUBLISHABLE_KEY (singular) is set nowhere -- the platform injects
  // the PLURAL SUPABASE_PUBLISHABLE_KEYS. resolvePublishableKey reads the real
  // one. The owner's own JWT stays in Authorization; the publishable key is an
  // apikey and must never be sent as a Bearer token.
  const anon = resolvePublishableKey();
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
  ownerId?: string | null,
): Promise<CapabilityActionResult> {
  if (!draftId || (!draftToken && !ownerId)) {
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
  if (latest.format !== "ast") {
    // A node id has no meaning on a freeform page — there is no tree to look it
    // up in. The client sends label-shaped messages for those, so reaching here
    // means the two got crossed; say so rather than failing inside a tree walk.
    return { ok: false, real: false, summary: "That page is freeform HTML, not a Hubly Document — click edits there go through the label path.", error: "wrong_format" };
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
  const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,logo_url,city,state,service_area_cities,business_type,meta");
  const html = renderHublyDocument(patchResult.document, renderContextFor(draftId, bizRow));
  const r = await callBusinessRpc("create_business_document", {
    p_business_id: draftId,
    p_draft_token: draftToken,
    p_tag: "website",
    p_document: patchResult.document,
    p_rendered_html: html,
    p_created_by: "patch",
    p_owner_id: ownerId ?? null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The edit was computed but could not be saved.", error: "rpc_failed" };
  }
  const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real edit applied — ${humanPatchSummary(directEffect)}. ${url} now reflects it (version ${r.version}).`,
    // The same diff, said to the person instead of to the log. This is the only
    // acknowledgement a click-to-edit gets — there is no model turn behind it.
    humanNote: sentence(humanPatchSummary(directEffect)),
    raw: { id: r.id, version: r.version, url },
  };
}

/** A humanPatchSummary clause ("changed the text ... to ...") as something you
 *  can say out loud. Kept trivial on purpose: the value is in the diff being
 *  reported at all, not in dressing it up. */
function sentence(clause: string): string {
  if (!clause || clause === "no visible change") return "That didn't change anything on the page.";
  return "Done — " + clause + ".";
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
  | { ok: true; url: string; dims: ImageDims | null }
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
  // adminHeaders() throws on a missing key. Kept as a caught error rather than
  // a bare throw here because this path already has an honest "not configured"
  // result to return -- but it is now reached because the key is genuinely
  // absent, not because an empty string quietly passed a truthiness check.
  let storageHeaders: Record<string, string>;
  try {
    storageHeaders = adminHeaders();
  } catch (e) {
    console.error("uploadImageToStorage: no service key", e);
    return { ok: false, result: { ok: false, real: false, summary: "Storage isn't configured right now.", error: "storage_unconfigured" } };
  }
  if (!supabaseUrl) {
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
    headers: { ...storageHeaders, "content-type": type, "x-upsert": "true" },
    // Deno's runtime fetch accepts a Uint8Array body fine — this cast is
    // purely for the DOM lib typings used here, not a runtime concern.
    body: bytes as unknown as BodyInit,
  });
  if (!uploadRes.ok) {
    return { ok: false, result: { ok: false, real: false, summary: "The image could not be uploaded right now.", error: "storage_upload_failed" } };
  }
  // Measured from the bytes we already have in hand, before they go anywhere.
  // The header needs the SHAPE of a logo to lay it out -- a wordmark and a
  // round mark are different design problems -- and this is the only moment
  // the raw asset exists in this process. Null when the header is unreadable,
  // which renders exactly as every site does today.
  return {
    ok: true,
    url: `${supabaseUrl}/storage/v1/object/public/brand-assets/${path}`,
    dims: imageDimensions(bytes),
  };
}

/** Click-to-replace for any <img> node in a Hubly Document — the click
 *  already supplies the exact target, so no model call. Real upload (same
 *  storage path as the logo/hero-image uploads), then the exact same
 *  applyDirectDocumentPatch used for text edits, just with a new "src".
 *  The uploaded URL always starts with this project's own storage origin,
 *  so it passes the validator's media-origin check without special-casing. */
/**
 * The freeform save path. Deliberately short, and that is the point.
 *
 * The AST path is: load the tree, walk it to the node, apply ops, re-validate
 * the WHOLE tree, diff it, re-render every element back to HTML, store both.
 * None of that exists here. The HTML is the page: find the labelled elements,
 * change the text or the src, append a version. No tree load, no
 * validateHublyDocument, no renderHublyDocument.
 *
 * The stored `document` (the design brief) is carried through UNCHANGED. It
 * describes what the page was generated from, not what it currently says, and
 * an owner edit does not retroactively change the brief.
 */
export async function applyDirectFreeformEdit(
  draftId: string,
  draftToken: string,
  edit: { label: string; text?: string; src?: string; prevText?: string },
  ownerId?: string | null,
): Promise<CapabilityActionResult> {
  // An unclaimed draft authorises by token; a claimed business authorises by the
  // verified owner (ownerId, set by the edge function after checking the JWT).
  if (!draftId || (!draftToken && !ownerId)) {
    return { ok: false, real: false, summary: "No draft business exists yet to edit.", error: "missing_draft" };
  }
  if (!edit?.label) {
    return { ok: false, real: false, summary: "No element was specified to edit.", error: "missing_label" };
  }
  const latest = await selectLatestBusinessDocument(draftId, "website");
  if (!latest) {
    return { ok: false, real: false, summary: "No page exists yet to edit.", error: "no_document" };
  }
  if (latest.format !== "html") {
    return { ok: false, real: false, summary: "That page is a Hubly Document, not a freeform page — click edits there go through the node path.", error: "wrong_format" };
  }

  const result = applyFreeformEdit(latest.renderedHtml, edit);
  if (!result.ok) {
    // Same guarantee as the AST path: a click that changed nothing must not
    // report that it changed something.
    if (result.error === "no_change") {
      return { ok: false, real: false, summary: "That edit produced no change to the page.", error: "patch_no_effect" };
    }
    if (result.error === "no_match") {
      return { ok: false, real: false, summary: "That part of the page could not be found — it may have been rebuilt since.", error: "label_not_found" };
    }
    return { ok: false, real: false, summary: "That edit could not be applied safely — nothing changed.", error: result.error || "patch_failed" };
  }

  const r = await callBusinessRpc("create_business_document", {
    p_business_id: draftId,
    p_draft_token: draftToken,
    p_tag: "website",
    // The brief, unchanged. An owner edit does not rewrite the brief.
    p_document: latest.brief,
    p_rendered_html: result.html,
    p_created_by: "patch",
    p_format: "html",
    p_owner_id: ownerId ?? null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The edit was computed but could not be saved.", error: "rpc_failed" };
  }
  const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
  const said = humanFreeformSummary(result, edit.label);
  return {
    ok: true,
    real: true,
    summary: `Real edit applied — ${said}. ${url} now reflects it (version ${r.version}).`,
    humanNote: sentence(said),
    raw: { id: r.id, version: r.version, url, label: edit.label, changed: result.changed },
  };
}

/**
 * Generate a freeform page: one model call, a whole standalone HTML document,
 * no AST and no section vocabulary. The only hard constraint is the one that
 * protects the business — never invent a price, name, review, rating or
 * guarantee — because everything else the format used to enforce structurally
 * is now the model's to choose.
 *
 * The returned HTML is STAMPED before it is returned. There is no path in this
 * file that stores freeform HTML without labelling it first, which is what
 * makes "a partially labelled page must not be reachable" true of the system
 * and not just of the stamping function.
 */

/**
 * NAME-PROTECTION PASS — the business name is never truncated, anywhere. A person
 * who sees their own name clipped stops trusting the page, so this is a hard
 * guarantee enforced deterministically, not left to the prompt.
 *
 * It does two things and REMOVES/overrides only — it never regenerates:
 *   1. Tags every element whose own text is the business name (nav wordmark, hero
 *      headline, footer, announcement bar) with `data-hubly-name`, and strips any
 *      clip-causing INLINE style off it (text-overflow:ellipsis, white-space:
 *      nowrap, a fixed height).
 *   2. Injects one !important rule, last in the head so it wins over the page's
 *      own CSS: the name may WRAP (break a too-long word if it must) but can never
 *      be ellipsised, clipped, or cut by oversized type overflowing an
 *      overflow:hidden ancestor. That last case — an h1 at ~118px whose word is
 *      wider than its column — is the one actually observed, and overflow-wrap
 *      is what defuses it: the word wraps instead of overflowing to be clipped.
 */
export function protectBusinessName(html: string, rawName: string | null | undefined): string {
  const name = String(rawName || "").trim();
  if (name.length < 2) return html;
  // Match the name allowing entity-encoded & and flexible whitespace.
  const pattern = name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/&(?:amp;)?/g, "(?:&|&amp;)")
    .replace(/\s+/g, "\\s+");
  const nameRe = new RegExp(pattern, "i");
  // Tag leaf-ish elements whose text is (or contains) the name, and clean inline styles.
  let out = html.replace(/<([a-z0-9]+)([^>]*)>([^<]+)/gi, (m, tag, attrs, text) => {
    if (/data-hubly-name/i.test(attrs)) return m;
    if (!nameRe.test(text)) return m;
    let a = String(attrs);
    const sm = /style\s*=\s*"([^"]*)"/i.exec(a);
    if (sm) {
      const cleaned = sm[1]
        .replace(/text-overflow\s*:\s*ellipsis\s*;?/gi, "")
        .replace(/white-space\s*:\s*nowrap\s*;?/gi, "")
        .replace(/(?<!min-)(?<!max-)height\s*:\s*\d+(px|rem|em)\s*;?/gi, "");
      a = a.replace(sm[0], `style="${cleaned}"`);
    }
    return `<${tag}${a} data-hubly-name>${text}`;
  });
  const guard =
    "<style>[data-hubly-name]{overflow-wrap:break-word!important;white-space:normal!important;" +
    "text-overflow:clip!important;max-height:none!important;-webkit-line-clamp:none!important;}</style>";
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, guard + "</head>") : guard + out;
  return out;
}

/**
 * DECORATIVE-NUMBERING PASS — removal only, never a regeneration.
 *
 * Cards get badged 01 / 02 / 03 when nothing about them is sequential — a list of
 * what a place offers is not a sequence, and the numbering is a tell that a
 * template wrote it. This strips two forms:
 *   - an element whose ENTIRE text is a bare ordinal (zero-padded 01–09, or a
 *     1–2 digit number carrying a number/step/count/index badge class), and
 *   - CSS counters on a card grid (a ::before/::after whose content is a
 *     counter(), plus the counter-increment/reset that feeds it).
 * The one exception is a genuinely ordered PROCESS (a "how it works" / "steps"
 * block): a 500-char context window is checked and left alone. Returns the count
 * so the caller can log it.
 */
export function stripDecorativeOrdinals(html: string): { html: string; removed: number } {
  let removed = 0;
  const src = html;
  const isProcess = (ctx: string) =>
    /how it works|how it goes|the process\b|step\s*\d|\bsteps?\b|what to expect|first,|then,/i.test(ctx);
  // (A) Bare-ordinal badge elements.
  let out = src.replace(
    /<(span|div|p|b|strong|em|small)\b([^>]*)>\s*(0[1-9]|[1-9]\d?)\s*[.)]?\s*<\/\1>/gi,
    (m: string, _tag: string, attrs: string, num: string, offset: number) => {
      if (isProcess(src.slice(Math.max(0, offset - 500), offset))) return m;
      const zeroPadded = /^0[1-9]$/.test(num);
      const badgeClass = /class="[^"]*(?:num|count|index|step|badge|ordinal)/i.test(attrs);
      if (!zeroPadded && !badgeClass) return m; // a lone 1–2 digit with no badge cue: leave it
      removed++;
      return "";
    },
  );
  // (B) CSS-counter numbering on card grids.
  out = out.replace(/[^{}]*::(?:before|after)\s*\{[^}]*content:\s*counter\([^{}]*\}/gi, () => {
    removed++;
    return "";
  });
  out = out.replace(/counter-(?:increment|reset)\s*:[^;}]*;?/gi, () => {
    removed++;
    return "";
  });
  return { html: out, removed };
}

/**
 * Deterministic svh-companion repair.
 *
 * The registry prompt tells the model that full-height sections must pair bare vh
 * with svh (`min-height:100vh; min-height:100svh;`) so the block does not JUMP as
 * the mobile address bar shows/hides. Measured compliance is ~90%: one page in ten
 * ships a bare vh height with no svh companion. A prompt rule at 90% is not a rule.
 *
 * This closes the gap without the model: wherever a stylesheet sizing declaration
 * (height / min-height / max-height) uses a bare `vh` length and does NOT already
 * have an svh companion for the same property immediately after it, append the
 * companion. vh stays FIRST as the older-browser fallback; svh follows and wins
 * where supported — exactly the pattern the prompt asks for.
 *
 * Scope is deliberately narrow and safe:
 *  - Only inside <style> blocks. The companion pattern is two declarations of the
 *    same property, which only works in a stylesheet — an inline style="" attribute
 *    keeps just the last value, so there is nothing to repair there.
 *  - Only the three viewport-height SIZING properties, where the address-bar jump
 *    actually manifests. It never touches font-size, transforms, etc.
 *  - Only bare `vh` (\d+vh). dvh / lvh / svh are left alone (the digit-before-v
 *    test never matches them), so re-running is a no-op — this cannot cascade.
 *
 * Deterministic, single-pass, and it CANNOT trigger a second generation: it edits
 * the string in place and returns it. `added` is the number of companions inserted.
 */
export function pairViewportUnits(html: string): { html: string; added: number } {
  let added = 0;
  // A bare-vh sizing declaration NOT already followed by an svh companion for a
  // height-family property. The lookahead is what makes the pass idempotent.
  const decl = /\b(min-height|max-height|height)\s*:\s*([^;{}]*?\d*\.?\d+vh\b[^;{}]*?)\s*;(?!\s*(?:min-height|max-height|height)\s*:[^;{}]*svh)/gi;
  const out = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (block: string, css: string) => {
    const fixedCss = css.replace(decl, (m: string, prop: string, val: string) => {
      const svhVal = val.replace(/(\d*\.?\d+)vh\b/gi, "$1svh");
      if (svhVal === val) return m; // nothing bare-vh to pair (defensive)
      added++;
      return `${prop}: ${val}; ${prop}: ${svhVal};`;
    });
    return block.replace(css, fixedCss);
  });
  return { html: out, added };
}

export async function generateFreeformPage(
  businessId: string,
  brief: string,
  record: Record<string, unknown>,
  jobId?: string | null,
): Promise<{ ok: true; html: string; plan: string; brief: FreeformBrief; labels: number; usage: UsageTotal; modelUsed?: string; imagesPlaced?: number; imageBlanks?: number; placeholders?: number; strippedCredentials?: number } | { ok: false; error: string }> {
  // WHAT HUBLY SUPPLIES, told to the model so it can DESIGN for it.
  //
  // The first three freeform pages were call-only brochures for one reason:
  // nobody told the model that booking exists. It cannot lay out a page around
  // a capability it has not been told about. So the capabilities are stated,
  // and WHERE they go is left to the model — a Book button in the header suits
  // a roofer, a "check availability" line suits a photographer, and a bakery
  // may want neither above the fold.
  //
  // The sentinel is the contract. The model marks its booking CTA
  // href="#hubly-book"; injectHublyRuntime rewrites that to the real booking
  // URL. The model is responsible for PLACEMENT, this codebase is responsible
  // for it WORKING, and neither can silently fail: a sentinel that is never
  // rewritten is a dead link, so the pass injects its own button when it finds
  // none, and asserts afterwards.
  const capabilities =
    "WHAT HUBLY GIVES THIS PAGE — design for these, they are real:\n" +
    "1. ONLINE BOOKING. This business can take bookings online; Hubly supplies the whole booking flow. " +
    "Place a booking call-to-action wherever it genuinely belongs for this trade, and give it exactly " +
    'href="#hubly-book". To preselect one service, use href="#hubly-book?svc=NAME" with a service name from the record. ' +
    "AT MOST THREE booking CTAs on the whole page, each placed where someone would naturally be ready to book — no more. " +
    "Secondary links like 'view services' or 'see pricing' are fine and do not count. " +
    "Treat the phone number as the SECONDARY option, not the only one — do not build a page whose only action is a phone call.\n" +
    "2. A CHAT ASSISTANT. Every Hubly site carries one; it is added automatically after you finish and it floats in the bottom-right corner. " +
    "Do NOT design a chat window, a message form, or a support widget yourself, and do not put anything in the bottom-right corner that it would cover.\n" +
    "Do not write any other <script>, and do not build a booking form of your own — the sentinel link is how booking is reached.";

  // IMAGES ARE MARKERS, RESOLVED AFTER YOU FINISH — same contract as booking.
  //
  // The model used to be told "design a page that does not need photos", so
  // every page came out image-free. It now marks WHERE an image belongs and
  // WHAT IT IS FOR; a deterministic pass fills each marker with the business's
  // own photo, then stock, then a designed colour field — the model never
  // handles a URL. Purpose is emitted inline (data-subject), so planning every
  // image costs zero extra model calls.
  const rec = record as Record<string, unknown>;
  const hasLogo = !!rec.logo_url || !!rec.logoUrl;
  const photoCount = Array.isArray(rec.photos) ? (rec.photos as unknown[]).length : 0;
  const imageBlock =
    "IMAGES — design WITH them, do not avoid them:\n" +
    "Where an image belongs, emit a marker and let Hubly source it. Never write a real image URL yourself.\n" +
    '- A content image: <img src="#hubly-image" data-role="ROLE" data-subject="DESCRIBE THE IDEAL SHOT" alt="...">. ' +
    "ROLE is hero, section, feature, or background for atmosphere; gallery, portfolio, work, results, or before-after for the business's OWN work. " +
    "data-subject is a specific art-direction phrase — the subject, the mood, the framing — e.g. " +
    '"a barber mid-cut at the chair, focused on the work", or "a wide, straight-on shot of a finished roofline against open sky, no people", or "a tray of fresh bread cooling on the counter, no people", or "close on a detailer\'s hands wiping down a clean panel" — different trades, different registers. Not just "a car", and NOT always the glossy premium hero: choose the framing that actually suits THIS trade, and prefer the ordinary real thing over a luxury version of it. ' +
    "PEOPLE: decide per subject whether a person belongs. For people-facing work — a barber at the chair, a detailer's hands on a panel, a roofer up on a roof — a real person in frame reads as a real shop, and you should write the subject WITH the person in it. For object or result shots — a finished roofline, a coated wheel, a tray of bread — add \"no people\" so the photo stays on the thing. Do NOT default to empty rooms: an empty barber chair is the sterile stock look that makes a page read as machine-made. When you want no people, the words \"no people\" must be in the data-subject; when a person belongs, leave them out and the photo may include people.\n" +
    (hasLogo
      ? '- THE LOGO: this business has uploaded a logo. Use <img src="#hubly-logo" alt="LOGO"> for the brand mark, placed wherever the design calls for it. Do NOT draw a monogram or initials — the real logo exists and must be used.\n'
      : "- No logo is on file, so a clean typographic wordmark or monogram, placed wherever the design calls for it, is correct.\n") +
    (photoCount > 0
      ? `- This business has ${photoCount} of its OWN photo(s). Give it a section that shows its work (role="gallery" or "work") so those real photos are used.\n`
      : "- This business has no photos of its own yet. Still mark hero/atmosphere images; they will be filled with fitting stock or a designed colour field.\n") +
    "Design as if every marker will be a real photograph.";

  const markingBlock =
    "MARK WHAT YOU GUESS. Some copy you write will be a reasonable proposal rather than a fact from the record — an invented tagline, a process you assumed, a value proposition, a section heading you chose. " +
    'On any element whose text you INVENTED (not grounded in the record above), add the attribute data-hubly-guess="a few words naming what it is" — e.g. data-hubly-guess="a suggested tagline". ' +
    "You know what you invented; mark it. Do NOT mark anything that comes straight from the record (the real name, phone, city, services, prices). " +
    "This is not an error — it is you flagging your own suggestions so the owner can replace them in one click.\n" +
    "THE HARD LINE, even as a guess: NEVER write a price, a customer name, a review, a testimonial, a star rating, a review count, 'trusted by N', years in business, a licence, insurance, a certification, an award or a guarantee unless it is in the record. Do not mark these — do not write them at all. Fake the shape and the voice of a page; never fake its credentials.";

  const system =
    "You write a complete, standalone HTML page for one real local service business — a single file, with its own <style> block in the head. " +
    "No frameworks, no external requests, no scripts of your own. Use real, specific copy for THIS business, drawn only from the record below. " +
    "Write the page you think this business should have — you choose the sections, the order and the layout.\n\n" +
    "PALETTE — decide it from what this business IS, then commit. The palette comes from the trade, the materials it works in, the place it's in, and the light people associate with it: a barbershop is not a bakery, a roofer is not a florist. Let the trade pull you somewhere specific — dark and high-contrast, metal and concrete, deep and saturated, cool and clinical, earthy and matte, bright and fresh — and carry ONE deliberate scheme through the background, the type and the accents so the whole page reads as one considered thing. The background is a decision, not a canvas colour. NAME THE FAILURE, because it is specific and it is the thing to avoid: warm off-white (cream, ivory, #faf…, #fff…f0) paired with a serif is the internet's default for 'tasteful small business website,' and reaching for it makes every Hubly page look like every other one regardless of trade. Do NOT default to it — use it only when THIS particular business genuinely calls for it (a patisserie, a stationer, a wedding florist might), never as the safe choice because nothing else came to mind.\n\n" +
    "WRITE LIKE THE PERSON WHO RUNS THIS PLACE, NOT LIKE A BROCHURE. This is what separates a real page from an obviously-generated one, and it matters more than the layout:\n" +
    "- FACTS, NOT ADJECTIVES. Prefer a concrete fact over an evaluation, every time. NEVER describe the business as warm, welcoming, cosy, inviting, calm, relaxed, comfortable, thoughtful, curated, lived-in, charming, quaint, vibrant, bespoke, or any cousin of those — they tell the reader nothing and they are the single loudest sign nobody wrote this. Real small-business copy is specific and comes from the RECORD: hours ('open until eight'), services and what they cost, location, how to reach you, how long they've been going. When you have no fact for a slot, write a SHORTER sentence — or drop the slot entirely. Never reach for an adjective to fill space.\n" +
    "- THE FULL NAME STAYS OUT OF BODY COPY. The full business name belongs in the nav, hero, footer and announcement bar — nowhere else. Inside a sentence, refer to the business the way its owner would out loud: a short form ('the shop', 'the cafe side', 'the studio'), 'we', or nothing at all. NEVER write the full name inside a descriptive sentence. This reads worst with long names, which is exactly when the temptation is highest.\n" +
    "- USE CONTRACTIONS — WRITE THE WAY THE OWNER TALKS. it's, you're, we'll, don't, here's, that's, we've, you'll. Formal uncontracted prose ('if it is urgent', 'ask what is on the shelf') is the loudest remaining sign a machine wrote this — nobody speaks that way. Uncontracted forms ONLY where the emphasis genuinely calls for it ('we do not charge for a callout'), which is rare.\n" +
    "- THE HERO HEADLINE IS ONE SENTENCE WORTH SAYING about this business — what it is, what it's for, or what someone gets by coming in. It is NOT the services list read back ('Weekly bouquets, wedding flowers, and workshops' is inventory, not a reason to walk in). The business name is ONE legitimate option among several, NOT the default — lead with the name only when the name genuinely is the strongest thing to say; otherwise say the thing. (The services get their own section further down.)\n" +
    "- NUMBER THINGS ONLY WHEN THE ORDER IS REAL. Do not badge a set of offerings 01 / 02 / 03, and do not add CSS counters to a card grid — a list of what a place offers is not a sequence; nothing happens first. Number ONLY a genuinely ordered process (how booking works, step 1 then 2 then 3) where the reader actually needs the order.\n\n" +
    "How the brand mark and navigation appear is entirely yours to decide: a top nav bar is ONE option, not a requirement. A full-bleed hero with the business name set in the headline, a slim side rail, a minimal footer-only nav, or something else the trade suggests are all equally available. The only things that must be true: the brand is identifiable somewhere, and booking is reachable. Two different trades should not open with the same shape.\n\n" +
    "THE BUSINESS NAME IS NEVER TRUNCATED, ELLIPSISED OR CLIPPED — anywhere it appears (nav wordmark, hero headline, footer, announcement bar). This is a hard rule: someone who sees their own name cut off will not trust the page. Size the type for a LONG name, not a short one — a name may be forty characters or contain a long single word, and it must still fit or WRAP, never overflow its container. So: keep hero headline maximums modest (a clamp topping out around 64–80px is plenty; do NOT reach 100px+ where a long word overflows its column), let the name wrap (do not force it onto one line with white-space:nowrap), and never put text-overflow:ellipsis, a fixed height, or an overflow:hidden container around the name that could cut it. A name that wraps to two lines is fine; a name with a letter missing is a trust failure.\n\n" +
    "THIS PAGE MUST WORK ON A PHONE — most local-business visitors are on one. Two hard rules:\n" +
    "1. FULL-HEIGHT SECTIONS USE svh, NOT bare vh. A hero or section sized to fill the screen must use svh (the small viewport height) so it does not JUMP as the mobile address bar shows and hides — bare 100vh does exactly that. Write BOTH, the vh line first as a fallback for older browsers, then svh: e.g. `min-height: 100vh; min-height: 100svh;`. Never a bare `min-height:100vh` on its own for a full-height block.\n" +
    "2. HERO PHOTOGRAPHS STAY FULL-BLEED AND LANDSCAPE ON MOBILE. The stock photos are landscape (roughly 1200×627). On a phone, never squeeze a hero photo into a tall narrow portrait box with indents — object-fit:cover then shows a thin vertical SLICE of the image, which looks broken. In your mobile layout, give the hero image the full column width and keep a landscape-ish shape (an aspect-ratio around 3/2 or 16/9, or a bounded height like 240–300px) so the whole photograph reads as a photograph. This applies to the hero image specifically; smaller in-content images can be shaped however suits.\n" +
    "3. THE PRIMARY ACTION MUST BE REACHABLE WITHOUT SCROLLING. The main hero action — the button that starts a booking or contact — must be FULLY VISIBLE on first load, its entire box above the fold, on a phone (≈390×844) and on a laptop (≈1440×900). How you achieve that is yours: a shorter headline, a smaller type scale, a shorter hero, placing the action higher, or something else. The only requirement is the outcome on both screens — never a prescribed layout. A common failure is a full-height hero that vertically CENTERS a tall headline: the action then lands at the bottom of the first screen and clips below the fold. Whatever you do, the button a visitor came to press cannot start its life off-screen.\n\n" +
    markingBlock + "\n\n" +
    imageBlock + "\n\n" +
    capabilities + "\n\n" +
    `THE BUSINESS RECORD:\n${JSON.stringify(record, null, 1)}`;

  // STAGE: creating (the model call is running). Understanding already returned.
  await updateDocumentBuildStage(jobId, "creating");
  let text = "";
  let finishReason = "";
  const usage = emptyUsage();
  let modelUsed: string | undefined;
  // ── TWO-PASS: a cheap planning call commits to THIS page's shape in plain words BEFORE any
  // HTML exists; the generation then executes that commitment (prepended to the system prompt,
  // ahead of the general rules). Reasoning stays LOW on both; the planner is capped small so
  // total build stays near ~40s. The plan is persisted in design_rationale (cheapest debugging
  // artifact: when a page comes out wrong we can read what it MEANT to build).
  let plan = "";
  try {
    const planResp = await HublyAI.complete({
      feature: "hubly-freeform-plan",
      task: "chat",
      reasoningEffort: "low",
      maxTokens: 500,
      system:
        "You decide what ONE web page should BE for a specific local business, before any HTML exists. You are NOT writing the page — you commit to its shape in plain words so a builder executes exactly that. Think about THIS trade specifically: in the first three seconds, what must a visitor see to know they're in the right place and can act; what would be a WASTE of space for this trade (a section generic templates include but this business does not need); what is the ONE thing this page is for; and what SHAPE that implies. Be opinionated and trade-specific — a roofer after a hailstorm is not a bakery is not a bookkeeper, and they should NOT end up the same shape. Do NOT default to 'top nav + hero-with-image-on-the-right + three service cards' unless it is genuinely right for THIS trade. Then COMMIT in 3-5 sentences: the overall shape, the one hero image or none, nav or no nav, how many sections and what each is for, and where the single action lives. Concrete, e.g. 'One full-bleed photo of a finished roof, the phone number huge over it, three sentences of what you do and a request-a-look button — no top nav, no card grid; roofing is an emergency, not a browse.' Output ONLY the commitment. No preamble, no options, no bullet lists of alternatives.",
      messages: [{ role: "user", content: `THE BUSINESS RECORD:\n${JSON.stringify(record, null, 1)}\n\nThe owner's own words: ${brief}` }],
      jsonMode: false,
    });
    plan = String(planResp.text || "").trim();
    addUsage(usage, planResp.usage);
    if (!plan) throw new Error("planner returned an empty plan");
  } catch (e) {
    // LOUD + COUNTABLE — never a silent fallback. If the planner starts failing, every page
    // quietly regresses to single-pass; this makes "how often did the planner not run" a query,
    // not a guess (same discipline as postbuild_fallback_events). The build still proceeds
    // single-pass so the owner still gets a page — but the degradation is on the record, and a
    // page built without a plan has a NULL design_rationale so it is distinguishable after the fact.
    plan = "";
    console.error(`freeform-planner FAILED [${businessId}] — building single-pass without a plan: ${String((e as Error)?.message || e).slice(0, 200)}`);
    try { await callBusinessRpc("record_planner_fallback", { p_business_id: businessId, p_error: String((e as Error)?.message || e).slice(0, 300) }); } catch (_r) { /* recording must not fail the build */ }
  }
  const genBrief = plan
    ? `THE PLAN — build EXACTLY this page. Execute its shape faithfully; do NOT fall back to a generic nav+hero+cards layout if the plan says otherwise:\n${plan}\n\nThe owner's own words: ${brief}`
    : brief;
  try {
    const ai = await HublyAI.complete({
      feature: "hubly-freeform-generate",
      task: "document_generate",
      system,
      messages: [{ role: "user", content: genBrief }],
      // The document_generate route sets jsonMode because the AST path returns
      // JSON. This one returns an HTML document, and leaving JSON mode on makes
      // the provider wrap or refuse it.
      jsonMode: false,
    });
    text = String(ai.text || "");
    finishReason = String((ai as { finishReason?: string }).finishReason || "");
    addUsage(usage, ai.usage);
    modelUsed = (ai as { model?: string }).model;
  } catch (e) {
    return { ok: false, error: `model_call_failed: ${String(e).slice(0, 120)}` };
  }

  // Fenced code blocks are the normal shape of this answer; unwrap rather than
  // scolding the model for it.
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  if (!/<html[\s>]|<body[\s>]|<!doctype/i.test(raw)) {
    return { ok: false, error: "model did not return an HTML document" };
  }
  // TRUNCATION GUARD. A page cut off at the token cap renders as a nav and then a
  // void, and until now the only check was "does it START like HTML" — so a
  // half-page was stored as a success. Reject it two ways: an explicit length
  // finish reason from the provider, and — for when the finish reason isn't
  // captured — an HTML string with no closing </html>, which a complete document
  // always has. A truncated page fails HONESTLY (the build can retry) instead of
  // storing a broken half. Fewer complete pages beat one broken one.
  if (/^(length|max_tokens|max_output_tokens)$/i.test(finishReason)) {
    return { ok: false, error: "generation_truncated_length" };
  }
  if (!/<\/html\s*>/i.test(raw)) {
    return { ok: false, error: "generation_incomplete_no_close" };
  }
  // STAGE: photos (the model produced a valid page; now resolving images).
  await updateDocumentBuildStage(jobId, "photos");

  // IMAGE RESOLUTION, before stamping so labels land on resolved <img>s (or on
  // nothing, for a marker that collapsed to a colour field). The model marked
  // where images go; this fills them: the business's own photos first, then
  // Pexels for atmosphere gaps, then a designed brand-coloured field. Work-role
  // markers are never filled with stock, and no stock query allows people —
  // both enforced here in code, not in the prompt.
  const imgCtx = {
    businessId,
    documentVersion: undefined as number | undefined,
    brandColor: (rec.brand_color as string) || null,
    logoUrl: (rec.logo_url as string) || (rec.logoUrl as string) || null,
    photos: Array.isArray(rec.photos) ? (rec.photos as { url: string; kind: string; caption?: string | null }[]) : [],
    businessType: (rec.business_type as string) || (rec.businessType as string) || null,
    businessName: (rec.name as string) || null,
    fetchStock: pexelsFetcher((Deno.env.get("PEXELS_API_KEY") || "").trim() || null),
    recordPlacement: async (row: PlacedImageRow) => {
      const url = (Deno.env.get("SUPABASE_URL") || "").trim();
      if (!url) return;
      await fetch(`${url}/rest/v1/placed_images`, {
        method: "POST",
        headers: { ...adminHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          business_id: row.businessId, document_version: row.documentVersion ?? null,
          provider: row.provider, asset_id: row.assetId ?? null, photographer: row.photographer ?? null,
          source_url: row.sourceUrl ?? null, license: row.license ?? null, image_url: row.imageUrl,
          slot: row.slot, role: row.role, alt: row.alt,
        }),
      }).catch(() => {});
    },
  };
  const resolved = await resolveImages(raw, imgCtx);
  // IMAGE-SLOT TELEMETRY (additive, countable). One row per slot: the model's
  // art-direction phrase, the query we sent, how many stock results came back,
  // how many survived filtering, and what the slot became. Feeds image_slot_probe
  // so "how often does a slot end empty, and why" is a query, not a guess. A write
  // failure here never fails a build (best-effort, like recordPlacement).
  try {
    const purl = (Deno.env.get("SUPABASE_URL") || "").trim();
    if (purl && resolved.probes?.length) {
      await fetch(`${purl}/rest/v1/image_slot_probe`, {
        method: "POST",
        headers: { ...adminHeaders(), "content-type": "application/json" },
        body: JSON.stringify(resolved.probes.map((p) => ({
          business_id: businessId, role: p.role, subject: p.subject, query: p.query,
          wants_no_people: p.wantsNoPeople, is_work_role: p.isWorkRole, stock_queried: p.stockQueried,
          raw_count: p.rawCount, raw_count_any_orient: p.rawCountAnyOrient, eligible_count: p.eligibleCount,
          outcome: p.outcome,
        }))),
      }).catch(() => {});
    }
  } catch { /* telemetry must not fail a build */ }
  // THE EMPTY-SLOT COLLAPSE PASS. resolveImages leaves a dark "blank" div wherever
  // no customer photo and no honest stock image could fill a slot. A business with
  // no photographs of its own work should not get an empty work section — not a
  // gradient, not a placeholder, not a void. So this removes each unfillable slot,
  // any wrapper it leaves empty, and any whole section (work/gallery) left with no
  // real content. The model's art-direction intent for each removed slot is kept as
  // an HTML comment at the point of removal, so when the owner sends photos of their
  // own work we can put a real photo exactly where the model meant one. Removal only;
  // no model call, no regeneration.
  const collapsed = collapseEmptyImageSlots(resolved.html);
  if (collapsed.removed.length) {
    console.log(`freeform [${businessId}] collapsed ${collapsed.removed.length} empty image slot(s)/section(s): ${JSON.stringify(collapsed.removed)}`);
  }
  // STAGE: booking (photos resolved; labelling + booking/chat injection next).
  await updateDocumentBuildStage(jobId, "booking");

  // PLACEHOLDER PASS. Strips ungrounded credentials (prices/ratings/reviews/
  // years/licence/insurance/certification/guarantee — the never-invent list)
  // and keeps the model's own data-hubly-guess marks, adding a light backstop
  // for forgotten ones. Deterministic, no model call, no regeneration. Runs
  // before stamping so labels land on what survives, not on a stripped element.
  const annotated = annotatePlaceholders(collapsed.html, {
    services: Array.isArray((record as any).services) ? (record as any).services : [],
    yearsInBusiness: ((record as any).yearsInBusiness ?? (rec.years_in_business as number)) || null,
    reviews: Array.isArray((record as any).reviews) ? (record as any).reviews : [],
    city: (rec.city as string) || null,
    state: (rec.state as string) || null,
    areaCities: Array.isArray((record as any).areaCities) ? (record as any).areaCities : [],
  });

  // THE STAMPING PASS. Not a validation gate: it cannot reject the page and it
  // never triggers a regeneration. It takes whatever came back and labels it.
  const stamped = stampFreeformHtml(annotated.html);
  // THE DECORATIVE-NUMBERING PASS. Removes 01/02/03 badges and card-grid CSS
  // counters that imply an order where there is none. Removal only.
  const deordinal = stripDecorativeOrdinals(stamped.html);
  if (deordinal.removed > 0) {
    console.log(`freeform [${businessId}] stripped ${deordinal.removed} decorative ordinal(s)/counter(s)`);
  }
  // THE NAME-PROTECTION PASS. The business name must NEVER be truncated — a
  // person who sees their own name clipped trusts nothing else on the page. The
  // observed cause is not ellipsis or nowrap: it's oversized hero type (an h1 up
  // to ~118px) whose long word overflows its column and gets cut by an
  // ancestor's overflow:hidden. So this removes the clip behaviours from every
  // name-bearing element AND guarantees the name can wrap/break rather than
  // overflow. It only removes/overrides; it never regenerates.
  const named = protectBusinessName(deordinal.html, (record as Record<string, unknown>)?.name as string);
  // THE svh-COMPANION PASS. The prompt asks full-height sections to pair vh with
  // svh so they don't jump with the mobile address bar; ~10% of pages ship a bare
  // vh anyway. This adds the missing companion deterministically. Runs BEFORE the
  // runtime injection so it only repairs the model's stylesheet, not our widget.
  const paired = pairViewportUnits(named);
  if (paired.added > 0) {
    console.log(`freeform [${businessId}] paired ${paired.added} bare-vh height(s) with an svh companion`);
  }
  // THEN HUBLY'S MACHINERY. Also not a gate: it rewrites the model's booking
  // CTA to a working URL, adds one if there is none, and injects the chat
  // widget. Ordered after stamping so the injected runtime is not itself
  // labelled as editable content — the owner edits their page, not our widget.
  const wired = injectHublyRuntime(paired.html, {
    businessId,
    businessName: String((record as Record<string, unknown>)?.name || "this business"),
    slug: String((record as Record<string, unknown>)?.slug || ""),
    supabaseUrl: (Deno.env.get("SUPABASE_URL") || "").trim(),
    publishableKey: requirePublishableKey(),
    accent: String((record as Record<string, unknown>)?.brand_color || ""),
  });
  // STAGE: finalizing (booking wired; the document is about to be stored).
  await updateDocumentBuildStage(jobId, "finalizing");
  return {
    ok: true,
    html: wired.html,
    plan,
    brief: { brief, images: resolved.placed.map((p) => ({ url: p.imageUrl, provider: p.provider, slot: p.slot })), generatedAt: new Date().toISOString() },
    labels: stamped.coverage.labelled,
    usage,
    modelUsed,
    imagesPlaced: resolved.placed.length,
    imageBlanks: resolved.blanks,
    placeholders: annotated.placeholders.length,
    strippedCredentials: annotated.stripped.length,
  };
}

/**
 * A conversational edit to a freeform page — "make the headline punchier",
 * "change the price of the sourdough to $12".
 *
 * THE TARGETED UPDATE. It changes the labels it was asked to change and
 * nothing else, so it can run automatically, cheaply, and without ever
 * threatening work the owner did by hand. It is the default and it must keep
 * working forever; asking for a whole new page is a separate, explicit
 * operation (see planFreeformRegeneration).
 *
 * The model never sees the HTML. It sees a list of labels and what each one
 * currently says, and returns which to change. That is what keeps a request for
 * one sentence from becoming a rewritten page.
 */
export async function applyFreeformInstruction(
  draftId: string,
  draftToken: string,
  instruction: string,
  latest: Extract<LatestBusinessDocument, { format: "html" }>,
): Promise<CapabilityActionResult> {
  const inventory = labelInventory(latest.renderedHtml).filter((e: LabelEntry) => e.kind === "text");
  if (!inventory.length) {
    return { ok: false, real: false, summary: "That page has no editable text yet.", error: "no_labels" };
  }
  const system =
    "You are editing one specific local business web page. You are shown its editable parts, each with a stable label and its current text. " +
    "Return ONLY the parts that must change to satisfy the request, as JSON {\"edits\":[{\"label\":\"...\",\"text\":\"...\"}]}. " +
    "Change as FEW parts as possible. Never invent a price, name, review, rating or guarantee that is not already present. " +
    "If the request cannot be satisfied by changing text on this page, return {\"edits\":[]} and nothing else.";
  const brief =
    `REQUEST: ${instruction}\n\nEDITABLE PARTS OF THE PAGE:\n` +
    inventory.map((e: LabelEntry) => `${e.label}: ${JSON.stringify(e.value)}`).join("\n");

  const started = Date.now();
  let edits: { label?: string; text?: string }[] = [];
  try {
    const ai = await HublyAI.complete({
      feature: "hubly-freeform-edit",
      task: "document_patch",
      system,
      messages: [{ role: "user", content: brief }],
      jsonMode: true,
    });
    const parsed = JSON.parse(extractJson(String(ai.text || "")));
    if (Array.isArray(parsed?.edits)) edits = parsed.edits;
  } catch {
    edits = [];
  }
  const ms = Date.now() - started;
  if (!edits.length) {
    return {
      ok: false,
      real: false,
      summary:
        "Nothing on the page changed. The request could not be expressed as a change to the page's existing text, so tell the owner plainly that you cannot make this change yet rather than describing it as done.",
      error: "patch_no_effect",
      raw: { instruction, ms },
    };
  }

  let html = latest.renderedHtml;
  const applied: string[] = [];
  for (const e of edits) {
    if (!e?.label || typeof e.text !== "string") continue;
    const r = applyFreeformEdit(html, { label: e.label, text: e.text });
    if (r.ok) { html = r.html; applied.push(`${e.label} → "${e.text.slice(0, 60)}"`); }
  }
  if (!applied.length) {
    return { ok: false, real: false, summary: "That edit produced no change to the page.", error: "patch_no_effect", raw: { instruction, ms, proposed: edits.length } };
  }

  const r = await callBusinessRpc("create_business_document", {
    p_business_id: draftId,
    p_draft_token: draftToken,
    p_tag: "website",
    p_document: latest.brief,
    p_rendered_html: html,
    p_created_by: "patch",
    p_format: "html",
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The edit was computed but could not be saved.", error: "rpc_failed" };
  }
  const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real edit applied — ${applied.join("; ")}. ${url} now reflects it (version ${r.version}).`,
    humanNote: sentence(applied.length === 1 ? `changed ${applied[0]}` : `changed ${applied.length} parts of the page`),
    raw: { id: r.id, version: r.version, url, applied, ms },
  };
}

/** The freeform twin of uploadAndPatchDocumentImage: upload, then swap the src. */
export async function uploadAndPatchFreeformImage(
  draftId: string,
  draftToken: string,
  label: string,
  imageBase64: string,
  mediaType: string,
  ownerId?: string | null,
): Promise<CapabilityActionResult> {
  if (!draftId || (!draftToken && !ownerId)) {
    return { ok: false, real: false, summary: "No draft business exists yet to edit.", error: "missing_draft" };
  }
  if (!label) {
    return { ok: false, real: false, summary: "No image was specified to replace.", error: "missing_label" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "doc-image");
  if (!uploaded.ok) return uploaded.result;
  const patched = await applyDirectFreeformEdit(draftId, draftToken, { label, src: uploaded.url }, ownerId);
  return patched.ok ? { ...patched, humanNote: "Done — that photo is on the page now." } : patched;
}

export async function uploadAndPatchDocumentImage(
  draftId: string,
  draftToken: string,
  nodeId: string,
  imageBase64: string,
  mediaType: string,
  ownerId?: string | null,
): Promise<CapabilityActionResult> {
  if (!draftId || (!draftToken && !ownerId)) {
    return { ok: false, real: false, summary: "No draft business exists yet to edit.", error: "missing_draft" };
  }
  if (!nodeId) {
    return { ok: false, real: false, summary: "No image was specified to replace.", error: "missing_id" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "doc-image");
  if (!uploaded.ok) return uploaded.result;
  const patched = await applyDirectDocumentPatch(draftId, draftToken, { op: "update_attrs", id: nodeId, attrs: { src: uploaded.url } }, ownerId);
  // Said in terms of what the person just did — they dropped a picture on a
  // picture — rather than the generic diff clause the patch path produces.
  return patched.ok ? { ...patched, humanNote: "Done — that photo is on the page now." } : patched;
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

  // The SHAPE of the mark, measured from its own header bytes, persisted so the
  // page header can lay it out as what it is. A wide wordmark and a circular
  // mark are different design problems; before this they were both squeezed
  // into the same square box, which is why a good logo made a generated header
  // look no better than initials did. Omitted when unreadable -- never guessed.
  const aspect = uploaded.dims ? uploaded.dims.width / uploaded.dims.height : null;
  const r = await callBusinessRpc("patch_business_in_progress", {
    p_id: draftId,
    p_draft_token: draftToken,
    p_patch: { logo_url: uploaded.url },
    p_website_meta: aspect ? { logoAspect: Math.round(aspect * 1000) / 1000 } : null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The logo uploaded but couldn't be attached to the business — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const siteUrl = `https://${r.slug}.${HUBLY_DOMAIN}`;

  // A Hubly Document stores its RENDERED html, so patching businesses.logo_url
  // alone changes nothing a visitor sees — the header keeps its monogram
  // forever. This summary used to say "now shows it in the header" regardless,
  // which is the same false-success failure that patchDocument was fixed for.
  //
  // So re-render the stored tree through the current renderer, which now reads
  // businessLogoUrl. No model call, no change to the document itself: the same
  // operation scripts/rerender-business-document.ts performs, and the reason
  // that script exists.
  const rerendered = await rerenderLatestDocument(draftId, draftToken, "website");

  return {
    ok: true,
    real: true,
    summary: rerendered === "updated"
      ? `Real logo uploaded — ${siteUrl} now shows it in the header in place of the initials.`
      : rerendered === "no_document"
      ? `Real logo uploaded and saved to the business. There is no generated page yet, so it will appear in the header as soon as one is built.`
      : rerendered === "not_applicable"
      // Not a failure. This page's header was written by the model as part of
      // the page itself, so there is no chrome to re-render the logo into. The
      // logo IS saved and will be used by anything built from the record later.
      // Saying "could not be re-rendered" here would report a bug that is not
      // happening; saying "now shows it" would be the false success this whole
      // code path exists to prevent.
      ? `Real logo uploaded and saved to the business. This page's header is part of the page itself rather than Hubly chrome, so the logo does not appear there automatically — offer to put it in the header as an edit, and do not claim it is already showing.`
      : `Real logo uploaded and saved, but the live page could not be re-rendered, so it may still show the initials. Say that plainly rather than claiming the header changed.`,
    raw: { id: r.id, slug: r.slug, url: siteUrl, logoUrl: uploaded.url, rerender: rerendered, recordChange: ["cosmetic"] },
  };
}

/**
 * Re-render a business's latest document through the CURRENT renderer and save
 * it as a new version. Never calls the model and never alters the document
 * tree — only the HTML derived from it.
 *
 * Needed because rendered_html is stored, so anything that changes how a page
 * is DRAWN (a logo, and later a theme) reaches existing sites only if something
 * re-runs the renderer over them.
 */
async function rerenderLatestDocument(
  businessId: string,
  draftToken: string,
  tag: string,
): Promise<"updated" | "no_document" | "not_applicable" | "failed"> {
  try {
    const latest = await selectLatestBusinessDocument(businessId, tag);
    if (!latest) return "no_document";
    // A FREEFORM PAGE CANNOT BE RE-RENDERED, and that is not a gap to fill.
    //
    // This function exists because a Document stores rendered HTML, so a change
    // to the chrome inputs (logo, header variant, brand colour) only becomes
    // visible by drawing the tree again. A freeform page has no tree and no
    // chrome: the model wrote the header, the colours and the markup together,
    // as one artefact. There is nothing to redraw from, and "redrawing" it
    // would mean regenerating the page — which is a different operation with a
    // different cost that must never happen behind the owner's back.
    //
    // So callers get an honest "not_applicable" and say so, rather than a
    // "failed" that reads like a bug or an "updated" that is a lie.
    if (latest.format !== "ast") return "not_applicable";
    const bizRow = await selectOne("businesses", "id", businessId, "name,phone,slug,brand_color,logo_url,city,state,service_area_cities,business_type,meta");
    const html = renderHublyDocument(latest.document, renderContextFor(businessId, bizRow));
    const saved = await callBusinessRpc("create_business_document", {
      p_business_id: businessId,
      p_draft_token: draftToken,
      p_tag: tag,
      p_document: latest.document,
      p_rendered_html: html,
      p_created_by: "patch",
    });
    return saved && saved.ok === true ? "updated" : "failed";
  } catch (e) {
    console.error("rerenderLatestDocument failed:", e);
    return "failed";
  }
}

/**
 * Same shape as uploadDraftLogo, for the hero image specifically — the
 * canvas's inline "click the hero photo" edit. banner_url alone isn't
 * enough to make the renderer actually show it: wsPageEl('ws-hero-media')
 * only paints a photo when S.headerMode is also 'banner' (confirmed by
 * reading hubly.html directly, not assumed) — meta.headerMode is set here
 * in the same patch, the same way meta.businessType already is.
 */
/**
 * A real business photo — the third leg of the walk, and the one that never
 * shipped.
 *
 * "Your logo" and "Your photos" were added to the attach menu together, but
 * only the logo half was ever wired: the photo entry opened the INSPIRATION
 * input, so a photo of the owner's work was sent as "Here's a screenshot for
 * inspiration" and never became a business asset. Clicking it did nothing
 * visible, which is exactly how it was reported.
 *
 * This uploads the bytes to storage and writes a portfolio_photos row, which is
 * what loadBusinessRecord already reads — so a photo added in chat reaches the
 * generator, and the recordChange marker rebuilds the page around it.
 *
 * Direct-dispatched outside the model's decision loop, same as the logo: a
 * model cannot reliably reproduce multi-KB base64, and asking it to would risk
 * silently corrupting the upload.
 */
export async function uploadDraftPhoto(
  draftId: string,
  draftToken: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to attach a photo to.", error: "missing_draft" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "photo");
  if (!uploaded.ok) return uploaded.result;

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const photoHeaders = adminHeaders();
  const existing = await selectMany("portfolio_photos", "business_id", draftId, "id");
  const res = await fetch(`${supabaseUrl}/rest/v1/portfolio_photos`, {
    method: "POST",
    headers: { ...photoHeaders, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ business_id: draftId, url: uploaded.url, sort_order: existing.length }),
  });
  if (!res.ok) {
    return { ok: false, real: false, summary: "The photo uploaded but could not be attached to the business.", error: "photo_row_failed" };
  }
  const count = existing.length + 1;
  return {
    ok: true,
    real: true,
    summary: `Real photo added — the business now has ${count} photo${count === 1 ? "" : "s"} on record, and the page is being rebuilt to use ${count === 1 ? "it" : "them"}.`,
    raw: { url: uploaded.url, count, recordChange: ["photos"] },
  };
}

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
    humanNote: "Done — that's your new header image.",
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

/* ---------------------------------------------------------------------------
 * BUILD JOBS — making a lost build visible.
 *
 * generateDocument is dispatched, not awaited: ~100-150s of model call riding
 * on an isolate the runtime may recycle the moment the response is sent. When
 * that happens the work vanishes and NOTHING knows. Measured 2026-08-18: three
 * of eight real builds never wrote a document, and a person watched a skeleton
 * for ninety seconds for a site that was never coming.
 *
 * The silence was the structural part. With no record that a build was owed,
 * no code could tell "still working" from "died forty seconds ago", nothing
 * could retry, and nothing could count. So the row is written BEFORE the work
 * is dispatched and survives whatever happens to the isolate.
 * ------------------------------------------------------------------------- */

export type BuildJobStart = { jobId: string; expectedBy: string } | null;

/** Written synchronously and awaited, before anything is dispatched. If this
 *  fails we still build — a missing job row costs visibility, not the page. */
export async function startDocumentBuildJob(
  businessId: string,
  tag: string,
  brief: string,
  previousJobId?: string,
): Promise<BuildJobStart> {
  try {
    const admin = adminClient();
    // A retry continues the same job rather than starting a rival one, so
    // `attempts` counts what actually happened to this page.
    if (previousJobId) {
      const { data, error } = await admin
        .from("document_build_jobs")
        .update({
          status: "running",
          error: null,
          started_at: new Date().toISOString(),
          expected_by: new Date(Date.now() + BUILD_WINDOW_MS).toISOString(),
          finished_at: null,
        })
        .eq("id", previousJobId)
        .select("id,expected_by,attempts")
        .single();
      if (!error && data) {
        await admin.from("document_build_jobs")
          .update({ attempts: (data.attempts || 1) + 1 })
          .eq("id", previousJobId);
        return { jobId: data.id, expectedBy: data.expected_by };
      }
    }
    const { data, error } = await admin
      .from("document_build_jobs")
      .insert({ business_id: businessId, tag, brief })
      .select("id,expected_by")
      .single();
    if (error || !data) {
      console.error("startDocumentBuildJob failed (building anyway):", error);
      return null;
    }
    return { jobId: data.id, expectedBy: data.expected_by };
  } catch (e) {
    console.error("startDocumentBuildJob threw (building anyway):", e);
    return null;
  }
}

const BUILD_WINDOW_MS = 3 * 60 * 1000;

/** Terminal status. `reason` is a SHORT CODE, never model output — it is
 *  surfaced to the public through get_document_build_status. */
export async function finishDocumentBuildJob(
  jobId: string | null | undefined,
  status: "succeeded" | "failed",
  reason?: string,
): Promise<void> {
  if (!jobId) return;
  try {
    await adminClient()
      .from("document_build_jobs")
      .update({
        status,
        error: status === "failed" ? String(reason || "unknown").slice(0, 64) : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (e) {
    console.error("finishDocumentBuildJob failed (ignored):", e);
  }
}

/** Non-terminal progress marker, best-effort. Lets the builder tick the REAL
 *  stages of a build as each one genuinely completes — the value is written the
 *  moment the prior stage's work finished (see get_document_build_status.stage
 *  and hcRenderStepsCard). A build never fails on a status write, so this
 *  swallows its own errors. STAGES, in order:
 *    creating   — the model call is running (understanding already returned)
 *    photos     — model done; resolveImages is running
 *    booking    — images done; labelling + booking/chat injection running
 *    finalizing — injection done; storing the document
 *  succeeded/failed are the terminal states written by finishDocumentBuildJob. */
export async function updateDocumentBuildStage(
  jobId: string | null | undefined,
  stage: "creating" | "photos" | "booking" | "finalizing",
): Promise<void> {
  if (!jobId) return;
  try {
    await adminClient().from("document_build_jobs").update({ stage }).eq("id", jobId);
  } catch (_e) { /* visibility only — never fail a build on a progress write */ }
}

/** The most recent job for a business, for deciding whether to resume one. */
export async function latestDocumentBuildJob(
  businessId: string,
  tag = "website",
): Promise<{ id: string; status: string; brief: string | null; attempts: number; expiredAt: boolean } | null> {
  try {
    const { data } = await adminClient()
      .from("document_build_jobs")
      .select("id,status,brief,attempts,expected_by")
      .eq("business_id", businessId)
      .eq("tag", tag)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      status: data.status,
      brief: data.brief,
      attempts: data.attempts || 1,
      expiredAt: new Date(data.expected_by).getTime() < Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * OUT OF waitUntil, INTO ITS OWN INVOCATION.
 *
 * The build used to ride EdgeRuntime.waitUntil on the REQUEST isolate — the one
 * the runtime is free to recycle the instant the response is sent, which is
 * exactly when it recycles. This posts to a dedicated function instead, so the
 * work runs in a fresh isolate whose only job is the build, with the whole
 * function lifetime to itself rather than competing with a response that has
 * already gone.
 *
 * Deliberately not awaited: the caller must return in under a second. The
 * request is fire-and-forget, and the job row is what notices if it never
 * arrives — this call failing silently is the case that row exists for.
 */
export function dispatchDocumentBuild(input: {
  draftId: string;
  draftToken: string;
  brief: string;
  tag?: string;
  jobId?: string | null;
}): void {
  const url = (Deno.env.get("SUPABASE_URL") || "").trim();
  // requireSecretKey() throws on a missing key, and SUPABASE_SECRET_KEYS is a
  // JSON object -- the old chain would have sent `{"default":"sb_secret_..."}`
  // verbatim as a bearer token and called it credentials.
  let key: string;
  try {
    key = requireSecretKey().key;
  } catch (e) {
    console.error("dispatchDocumentBuild: no service credentials — build not started", e);
    return;
  }
  if (!url) {
    console.error("dispatchDocumentBuild: no SUPABASE_URL — build not started");
    return;
  }
  fetch(`${url}/functions/v1/hubly-document-build`, {
    method: "POST",
    // apikey carries the credential for BOTH key eras; Authorization is sent
    // only for a legacy JWT, because the receiving function's gateway rejects a
    // non-JWT Bearer before our own handler ever runs.
    headers: { ...adminHeaders(), "content-type": "application/json" },
    // Stamped here so the receiving function can measure the round trip plus
    // its own cold boot -- the slice of the job clock nothing could see.
    body: JSON.stringify({ ...input, tag: input.tag || "website", dispatchedAt: Date.now() }),
  })
    .then((r) => { if (!r.ok) console.error("dispatchDocumentBuild non-ok", r.status); })
    .catch((e) => console.error("dispatchDocumentBuild failed", e));
}

/**
 * THE GENERATION ITSELF, callable from more than one place.
 *
 * Lifted out of the capability handler so the dedicated hubly-document-build
 * function can run the identical code path. It matters that it is identical:
 * a build started by the conversation and a build started by a retry must
 * produce the same thing, or "retry" quietly means "get a different site".
 */
/**
 * WHERE THE TIME ACTUALLY GOES.
 *
 * Measured 2026-08-20: a 144s build contained an 86s model call, and a 126s
 * build a 56s one. Fifty-eight to sixty-nine seconds of every build was
 * somewhere other than the model -- roughly half the budget, and therefore the
 * real cause of the 150s stalls, bigger than the prompt and bigger than the
 * plan tier.
 *
 * Nobody could say where, because nothing between "job started" and "job
 * finished" was timed. This records each step so the answer is a log line
 * rather than an argument. Cheap enough to leave in permanently: it is
 * performance.now() and one console.log.
 */
function stopwatch() {
  const t0 = performance.now();
  let last = t0;
  const marks: Record<string, number> = {};
  return {
    mark(name: string) {
      const now = performance.now();
      marks[name] = Math.round(now - last);
      last = now;
    },
    done() {
      return { ...marks, TOTAL: Math.round(performance.now() - t0) };
    },
  };
}

/**
 * Build a page the freeform way: one model call, a whole standalone HTML
 * document, stamped with data-hc and stored. The default path for any new draft.
 *
 * What is deliberately absent compared with the AST path next door: no schema
 * prompt block, no LAYOUT_BLOCK, no class vocabulary, no validation pass, no
 * second model call when validation fails, and no render step — the model's
 * HTML IS the page. That is where the time goes.
 */
async function runFreeformGeneration(
  draftId: string,
  draftToken: string,
  brief: string,
  sw: ReturnType<typeof stopwatch>,
  jobId?: string | null,
): Promise<CapabilityActionResult> {
  const bizRow = await selectOne("businesses", "id", draftId, "name,phone,email,address,slug,brand_color,logo_url,city,state,service_area_cities,business_type,years_in_business,meta");
  sw.mark("selectBusinessRow");
  // THE RECORD, not a paraphrase of it — same reasoning as the AST path: until
  // the record was passed as data, the generator wrote an entire website from
  // one prose paragraph and had never seen a price, a service or an opening hour.
  const record = await loadBusinessRecord(draftId);
  sw.mark("loadBusinessRecord");

  const genStarted = Date.now();
  const gen = await generateFreeformPage(draftId, brief, { ...(record as any), ...(bizRow || {}) }, jobId);
  sw.mark("modelAndStamp");
  const generationMs = Date.now() - genStarted;
  if (!gen.ok) {
    return { ok: false, real: false, summary: `The page could not be generated (${gen.error}).`, error: "generation_failed", raw: { generationMs } };
  }

  const r = await callBusinessRpc("create_business_document", {
    p_business_id: draftId,
    p_draft_token: draftToken,
    p_tag: "website",
    p_document: gen.brief,
    p_rendered_html: gen.html,
    p_created_by: "ai",
    p_format: "html",
    p_design_rationale: (gen as { plan?: string }).plan || null,
  });
  sw.mark("persistDocument");
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The page was generated but could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const timing = sw.done();
  // Same one-line-per-build shape as the AST path, so the two are directly
  // comparable in the function logs without a join.
  console.log(`build-timing-freeform [${draftId}] ${JSON.stringify({ ...timing, labels: gen.labels, bytes: gen.html.length, promptTokens: gen.usage.promptTokens, completionTokens: gen.usage.completionTokens, reasoningTokens: gen.usage.reasoningTokens, calls: gen.usage.calls, model: gen.modelUsed })}`);
  const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real page generated and live — ${url} (version ${r.version}). Every element on it is individually editable.`,
    raw: { id: r.id, version: r.version, url, format: "html", labels: gen.labels, usage: gen.usage, generationMs, timing, modelUsed: gen.modelUsed },
  };
}

export async function runDocumentGeneration(
  draftId: string,
  draftToken: string,
  brief: string,
  benchmarkModel?: string,
  jobId?: string | null,
): Promise<CapabilityActionResult> {
  const sw = stopwatch();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet to generate a page for — call business.startDraft first.", error: "missing_draft" };
          }
          if (!brief) {
            return { ok: false, real: false, summary: "No brief was given to generate from.", error: "missing_brief" };
          }

          // FREEFORM IS HOW A NEW PAGE IS BUILT. AST IS HOW AN OLD ONE IS REBUILT.
          //
          // Until now every new draft dispatched an AST build, and a freeform
          // page only ever existed when that build FAILED — freeform was not a
          // path anyone could choose, it was where you landed on a timeout.
          // This is the flip: nothing already built changes, but nothing new is
          // built as an AST.
          //
          // The decision is made from what is already stored, not from a flag,
          // so it cannot drift: an existing AST page keeps the AST generator
          // (that is what "retry" and "rebuild from the record" mean for the
          // pages already on it), and everything else — no document at all, or
          // a freeform one — gets freeform.
          //
          // A side effect worth stating: no AST build is dispatched for a new
          // draft, so there is no long-running AST job left to resume later and
          // overwrite a page the owner has since replaced. That race is closed
          // by removal rather than by a guard.
          const existing = await selectLatestBusinessDocument(draftId, "website");
          sw.mark("readExistingDocument");
          if (!existing || existing.format === "html") {
            return await runFreeformGeneration(draftId, draftToken, brief, sw, jobId);
          }
          const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,logo_url,section_order,city,state,service_area_cities,business_type,meta");
          sw.mark("selectBusinessRow");
          const schemaBlock = buildDocumentSchemaPromptBlock();
          sw.mark("buildSchemaBlock");
          // section_order[0] is what startDraft chose for this business to lead
          // with. renderHublyDocument does not read section_order at all — that
          // column drives the classic renderer — so on this path the choice has
          // to reach the model as prompt text or it does nothing whatsoever,
          // which is exactly what it did until 2026-08-17.
          const leadWith = Array.isArray(bizRow?.section_order) ? bizRow.section_order[0] : undefined;
          const structureBlock = buildPageStructureBlock(leadWith);
          // THE RECORD, not a paraphrase of it. Loaded and passed as data
          // alongside the brief -- see loadBusinessRecord for why this is the
          // highest-value change available: until now the generator wrote an
          // entire website from one prose paragraph and had never seen a price,
          // a service, a photo or an opening hour.
          const record = await loadBusinessRecord(draftId);
          sw.mark("loadBusinessRecord");
          const recordBlock = buildBusinessRecordBlock(record);
          sw.mark("buildRecordBlock");
          const system = `You generate a real webpage for a real local service business, in the Hubly Document format below. Write real, specific copy for THIS business — never generic placeholder text, never "Lorem ipsum", never a literal business-name placeholder if a real name was given. Only place a reserved Hubly element (booking, reviews, etc.) where it's genuinely relevant to what a visitor needs next — never decorative.\n\n${schemaBlock}\n\n${structureBlock}\n\n${buildPaletteBlock()}\n\n${recordBlock}`;
          // benchmarkModel is intentionally absent from argsSchema/description —
          // the conversational AI never sees or sets it. Internal-only override
          // for the model benchmark harness so the exact same code path can be
          // run against different candidate models without touching production
          // secrets or per-task config.
          const genStarted = Date.now();
          const genResult = await generateAndValidateDocument(system, brief, draftId, "website", benchmarkModel);
          sw.mark("modelAndValidate");
          // WHY THE SECOND MODEL CALL HAPPENS.
          //
          // Instrumenting the build on 2026-08-20 showed generation is 99% of a
          // 147s job -- and that it is TWO model calls, not one, on every build
          // measured. The retry doubles both the time and the cost of the single
          // most expensive thing this product does.
          //
          // Nothing recorded why. recordVocabularyRejections returns early when
          // no class/tag/attr was refused, so a retry caused by any OTHER
          // validation error left no trace at all -- one row exists across every
          // build ever made. These are the errors that actually triggered it.
          if (genResult.firstAttemptOk === false) {
            console.log(
              `first-attempt-failed [${draftId}] ` +
                JSON.stringify((genResult.firstAttemptErrors || []).slice(0, 12)),
            );
          }
          const generationMs = Date.now() - genStarted;
          if (!genResult.ok) {
            // The double-failure case left no trace at all before this. It is
            // also the most informative: whatever the model wanted badly enough
            // to reach for twice is a genuine gap, not a slip.
            await recordVocabularyRejections(draftId, "website", genResult, "failed");
            return { ok: false, real: false, summary: "The generated page didn't pass validation, twice — nothing was published.", error: "validation_failed", raw: { errors: genResult.errors, usage: genResult.usage, generationMs, firstAttemptOk: genResult.firstAttemptOk, firstAttemptErrors: genResult.firstAttemptErrors, modelUsed: genResult.modelUsed, rationale: genResult.rationale } };
          }
          // RE-READ THE ROW. Do not render from the one loaded ~100s ago.
          //
          // Generation reads businesses once and then spends 100-150s in the
          // model. The walk asks for the logo immediately after the build
          // starts, so the single most likely moment for someone to upload one
          // is exactly the window where the row goes stale and the upload is
          // discarded -- the page renders with the initials, and "I uploaded my
          // logo and nothing happened" is a completely accurate description of
          // what occurred.
          //
          // Anything the owner changed while waiting matters the same way: a
          // phone number, a brand colour, a business name. Cheap to re-read,
          // and the only alternative is a page built from facts that were true
          // two minutes ago.
          const freshRow = (await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,logo_url,section_order,city,state,service_area_cities,business_type,meta")) || bizRow;
          sw.mark("reReadBusinessRow");
          const html = renderHublyDocument(genResult.document, renderContextFor(draftId, freshRow));
          sw.mark("render");
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
          sw.mark("recordRejections");

          const r = await callBusinessRpc("create_business_document", {
            p_business_id: draftId,
            p_draft_token: draftToken,
            p_tag: "website",
            p_document: genResult.document,
            p_rendered_html: html,
            p_created_by: "ai",
            p_design_rationale: genResult.rationale || null,
          });
          sw.mark("persistDocument");
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The page was generated but could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          // ONE LINE, every build. Read it with:
          //   select event_message from function_logs where event_message like '%build-timing%'
          const timing = sw.done();
          console.log(`build-timing [${draftId}] ${JSON.stringify(timing)}`);
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
            summary: `Real page generated and live — ${url} (version ${r.version}). Every element on it is individually editable.`,
            raw: { id: r.id, version: r.version, url, usage: genResult.usage, generationMs, timing, firstAttemptOk: genResult.firstAttemptOk, firstAttemptErrors: genResult.firstAttemptErrors, modelUsed: genResult.modelUsed, rationale: genResult.rationale },
          };
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
        handler: async (args) =>
          runDocumentGeneration(
            String(args?.draftId || "").trim(),
            String((args as any)?.draftToken || "").trim(),
            String(args?.brief || "").trim(),
            String((args as any)?.__benchmarkModel || "").trim() || undefined,
          ),
      },
      {
        name: "newPage",
        description:
          "Builds a COMPLETELY NEW page from scratch, replacing the current one. Only call this when the owner has explicitly asked for a different page — 'start over', 'try something completely different', 'I don't like this, do another one'. NEVER call it to make a change to the existing page; that is website.patchDocument, which is cheaper, faster and safe. This action is deliberately two-step: call it first WITHOUT confirm, and it tells you what the owner would lose by name. Repeat that back to them in your own words and wait for them to say yes. Only then call it again with confirm:true. Do not confirm on their behalf.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: { type: "string", description: "Automatically supplied by the system before this runs — put any placeholder here." },
            brief: { type: "string", description: "What the owner wants this time, richly written: what they disliked about the current page and what they want instead, plus the business facts. This is the only context the generation receives." },
            confirm: { type: "boolean", description: "Omit or false on the FIRST call. Only true after the owner has been told what they will lose and has said yes." },
          },
          required: ["brief"],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          const brief = String(args?.brief || "").trim();
          const confirm = (args as any)?.confirm === true;
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet.", error: "missing_draft" };
          }
          const latest = await selectLatestBusinessDocument(draftId, "website");
          // No page yet is a perfectly good starting point — there is simply
          // nothing to lose, so the confirmation step below has nothing to say
          // and does not fire. An AST page is a different matter: replacing a
          // Hubly Document with freeform HTML is a format migration, not an
          // edit, and it is not something a conversational turn should do.
          if (latest && latest.format !== "html") {
            return { ok: false, real: false, summary: "That page is a Hubly Document, not a freeform page. Converting between the two formats is not something this action does.", error: "wrong_format" };
          }

          // STEP ONE: say what it costs. Never regenerate on this call.
          const plan = await planFreeformRegeneration(draftId);
          if (!confirm && plan.hasEdits) {
            return {
              ok: true,
              real: false,
              summary:
                `NOT DONE YET — nothing has been built. The owner has hand-edited this page and a new page would discard some of that. ${plan.warning} ` +
                `Tell them this in your own words, naming what goes, and ask whether to go ahead. Only call newPage again with confirm:true if they say yes.`,
              humanNote: plan.warning + " Do you want me to go ahead?",
              raw: { carried: plan.carried, lost: plan.lost, confirmed: false },
            };
          }

          const bizRow = await selectOne("businesses", "id", draftId, "name,phone,email,address,city,state,business_type,years_in_business,service_area_cities,brand_color,logo_url,slug");
          const record = await loadBusinessRecord(draftId);
          const gen = await generateFreeformPage(draftId, brief, { ...(record as any), ...(bizRow || {}) });
          if (!gen.ok) return { ok: false, real: false, summary: `The new page could not be built (${gen.error}).`, error: "generation_failed" };

          // CARRY THE EDITS THAT STILL MEAN SOMETHING. A value role names a
          // fact, and the new page has the same facts, so the owner's wording
          // is re-applied. A positional role names a place in a structure that
          // no longer exists, so it cannot be and is not.
          let html = gen.html;
          const kept: string[] = [];
          for (const e of plan.carried) {
            const r = applyFreeformEdit(html, { label: e.label, text: e.value });
            if (r.ok) { html = r.html; kept.push(e.label); }
          }

          const saved = await callBusinessRpc("create_business_document", {
            p_business_id: draftId,
            p_draft_token: draftToken,
            p_tag: "website",
            p_document: gen.brief,
            p_rendered_html: html,
            p_created_by: "ai",
            p_format: "html",
          });
          if (!saved || saved.ok !== true) {
            return { ok: false, real: false, summary: "The new page was built but could not be saved.", error: "rpc_failed" };
          }
          const url = `https://${saved.slug}.${HUBLY_DOMAIN}`;
          const lostNote = plan.lost.length ? ` ${plan.lost.length} earlier edit(s) did not carry across, as warned.` : "";
          return {
            ok: true,
            real: true,
            summary: `A new page is live at ${url} (version ${saved.version}). Kept: ${kept.length ? kept.join(", ") : "nothing to carry"}.${lostNote}`,
            humanNote: `Here's a completely new page.${kept.length ? " I kept your " + kept.map(humanLabelName).join(" and ") + "." : ""}`,
            raw: { version: saved.version, url, kept, lost: plan.lost.map((l) => l.label), labels: gen.labels },
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
          if (latest.format !== "ast") {
            // TARGETED UPDATE, not regeneration. The model is shown the page's
            // labels and their current contents and asked which to change —
            // never the markup, so it cannot rewrite the page as a side effect
            // of being asked for one sentence. This is the operation that must
            // keep working forever and must never threaten an owner's edits.
            return await applyFreeformInstruction(draftId, draftToken, instruction, latest);
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
          const bizRow = await selectOne("businesses", "id", draftId, "name,phone,slug,brand_color,logo_url,city,state,service_area_cities,business_type,meta");
          const html = renderHublyDocument(patchResult.document, renderContextFor(draftId, bizRow));
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
      {
        name: "setChrome",
        description:
          "Changes the LAYOUT OF THE PAGE HEADER — where the logo sits, how big it is, whether " +
          "the bar is solid or sits over the hero, whether there is a nav, and whether the main " +
          "button books or dials. Use this for anything about the header or the logo: 'put the " +
          "logo in the middle', 'make the logo bigger', 'lose the menu', 'I want people to call, " +
          "not book'. Do NOT use patchDocument for these — the header is not part of the document " +
          "and patching it silently does nothing. Every field is optional; send only what was " +
          "asked for, and leave the rest alone so the derived choices stand.",
        argsSchema: {
          type: "object",
          properties: {
            logoPlacement: { type: "string", enum: ["left", "centre", "stack"], description: "'centre' puts the mark in the middle of the bar; 'stack' gives it a row of its own above the nav." },
            logoScale: { type: "string", enum: ["sm", "md", "lg"], description: "'lg' is what 'make the logo bigger' means." },
            headerStyle: { type: "string", enum: ["solid", "transparent"], description: "'transparent' lays the header over the hero with no bar behind it. Only looks right over a dark hero." },
            sticky: { type: "boolean", description: "Whether the header follows the page down." },
            nav: { type: "string", enum: ["full", "none"], description: "'none' removes the section links." },
            cta: { type: "string", enum: ["book", "call"], description: "'call' makes the header button the phone number instead of Book now. Needs a phone number on the record." },
          },
          required: [],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet to restyle.", error: "missing_draft" };
          }
          // Validated against the same enums the renderer reads, here rather
          // than trusting the argsSchema: the schema is a prompt, not a gate.
          const chrome: Record<string, unknown> = {};
          for (const [key, allowed] of Object.entries(CHROME_ENUMS)) {
            const v = (args as any)?.[key];
            if (typeof v === "string" && allowed.includes(v)) chrome[key] = v;
          }
          if (typeof (args as any)?.sticky === "boolean") chrome.sticky = (args as any).sticky;
          if (!Object.keys(chrome).length) {
            return { ok: false, real: false, summary: "No recognisable header change was requested, so nothing was altered.", error: "no_valid_fields" };
          }
          // 'call' with no phone number would render a dead tel: link.
          const biz = await selectOne("businesses", "id", draftId, "phone,meta");
          if (chrome.cta === "call" && !String(biz?.phone || "").trim()) {
            return { ok: false, real: false, summary: "There is no phone number on the record yet, so the header cannot show one. Ask for the number first.", error: "no_phone" };
          }
          // MERGED, not replaced: two separate asks ("centre it" then "bigger")
          // must both survive, and website_meta carries unrelated keys.
          const existing = (websiteMetaOf(biz) as any)?.chrome;
          const merged = { ...(existing && typeof existing === "object" ? existing : {}), ...chrome };
          const r = await callBusinessRpc("patch_business_in_progress", {
            p_id: draftId,
            p_draft_token: draftToken,
            p_patch: {},
            p_website_meta: { chrome: merged },
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The header change could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          // A Document stores its RENDERED html, so saving the preference alone
          // changes nothing anyone can see. Same re-render the logo upload does.
          const rerendered = await rerenderLatestDocument(draftId, draftToken, "website");
          const said = Object.entries(chrome).map(([k, v]) => `${k}=${v}`).join(", ");
          if (rerendered !== "updated") {
            return {
              ok: true,
              real: rerendered === "no_document",
              summary: rerendered === "no_document"
                ? `Header preference saved (${said}). There is no generated page yet, so it applies as soon as one is built.`
                : rerendered === "not_applicable"
                // Hubly chrome preferences do not reach a freeform page: its
                // header is part of the page the model wrote, not a variant this
                // setting selects. Saved for anything built later, and said
                // plainly rather than implying the header just moved.
                ? `Header preference saved (${said}), but this page's header is part of the page itself rather than Hubly chrome, so the setting does not change it. Say that, and offer to change the header as an edit instead.`
                : `Header preference saved (${said}), but the live page could not be re-rendered, so it may still show the old header. Say that plainly rather than claiming the header changed.`,
              humanNote: rerendered === "no_document"
                ? "Saved — I'll use that when I build the page."
                : rerendered === "not_applicable"
                ? "Saved — though this page's header is part of the page itself, so that setting won't move it. I can change the header directly if you like."
                : "I saved that, but I couldn't rebuild the page just now, so it may still look the same.",
              raw: { chrome: merged, rerender: rerendered },
            };
          }
          return {
            ok: true,
            real: true,
            summary: `Header layout changed (${said}) and the page re-rendered. Tell the owner specifically what moved.`,
            humanNote: chromeChangeNote(chrome),
            raw: { chrome: merged, rerender: rerendered, recordChange: ["cosmetic"] },
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
          // DECLARE THE CHANGE, or the page never learns about it.
          //
          // A Document stores its RENDERED html. updateDraft reported no
          // recordChange, so the Session 6 rebuild never fired and a phone
          // number saved after the build reached the row and stopped there.
          // Verified: phone "801-555-0611" written, header kept its booking
          // button, and every check short of looking at the page said success.
          //
          // Split by what a visitor would notice: contact details and copy are
          // content; a colour or a layout token is cosmetic and only needs the
          // cheaper re-render.
          const CONTENTFUL_COLS = new Set([
            "name", "tagline", "about", "phone", "email", "city", "business_type",
            "gen_hero_headline", "gen_hero_subhead", "gen_seo_title",
          ]);
          const recordChange: RecordChange[] = changed.some((c) => CONTENTFUL_COLS.has(c))
            ? ["contact"]
            : changed.length
            ? ["cosmetic"]
            : [];
          return {
            ok: true,
            real: true,
            summary: changed.length
              ? `Real update applied — ${url} now reflects: ${changed.join(", ")}.`
              : `No fields changed — nothing new was given to update.`,
            raw: { id: r.id, slug: r.slug, url, ...(recordChange.length ? { recordChange } : {}) },
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
            // recordChange is what makes the rebuild an EVENT rather than a decision:
            // hubly-conversation reads it after the turn and fires exactly one rebuild.
            // The model never chooses to rebuild, so the guard against calling
            // generateDocument twice stays intact.
            raw: { id: r.id, slug: r.slug, url, count: r.count, recordChange: ["services"] },
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
