// supabase/functions/_shared/hubly_document.ts
//
// The Hubly Document model — a validated tree of nodes with stable ids that
// Hubly can generate, edit, validate, render, and publish. Today this backs
// generated websites; the shape is deliberately not website-specific
// (see `tag` on HublyDocument) so it can extend to booking experiences,
// storefronts, emails, quotes, proposals, and CRM views without a rewrite.
//
// Core rule this file exists to enforce: the AI never writes executable
// code. It emits DATA — a tree of tag/attrs/children — that is validated
// against a closed grammar before it is ever persisted or rendered. Every
// value that reaches the renderer has already been checked against an
// allowlist here; nothing is sanitized after the fact, because nothing
// unvalidated is ever accepted in the first place.
//
// The boundary is behavior, not layout: presentation (structure, copy,
// typography, spacing, color, imagery) is fully open within this grammar.
// Application behavior (booking, CRM, reviews, customer portal, contact
// form submission — anything with a real backend effect) is never
// representable as raw markup here at all — it only exists as a reserved
// element (HublyBooking, HublyReviews, ...) that the AI can configure
// presentationally but never implement.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HublyNodeProvenance = {
  /** Who is responsible for this node's current content. */
  source: "ai" | "user";
  /** Short, human-readable rationale — this is what lets the AI explain
   *  itself later ("why did you put reviews here?"), not a rendering input. */
  reason?: string;
  /** What informed this choice — e.g. "reference: competitor-site.com",
   *  "business understanding: services list", "template default". */
  reference?: string;
  /** 0–1, only meaningful when source is "ai". */
  confidence?: number;
  /** Who last touched this specific node, distinct from who originated it. */
  editedBy?: "ai" | "user";
  lastModifiedAt?: string; // ISO 8601
};

export type HublyDocumentNode = {
  id: string;
  tag: string;
  attrs: Record<string, string>;
  /** Either child nodes, or text content — never both. */
  children: HublyDocumentNode[] | string;
  reasoning?: HublyNodeProvenance;
};

export type HublyDocument = {
  schemaVersion: 1;
  documentId: string;
  businessId: string;
  /** Artifact type. "website" today; "booking" | "storefront" | "email" |
   *  "quote" | "proposal" | "crm_view" reuse this same model later. */
  tag: string;
  version: number;
  generatedBy: "ai" | "user" | "patch";
  createdAt: string;
  root: HublyDocumentNode;
};

export type ValidationIssue = { path: string; message: string };
export type ValidationResult =
  | { ok: true; document: HublyDocument; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[] };

// ---------------------------------------------------------------------------
// Grammar — the exact allowlist. Anything not named here is rejected.
// ---------------------------------------------------------------------------

export const ALLOWED_TAGS = new Set([
  "section", "div", "header", "article", "aside", "figure", "figcaption",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "strong", "em", "blockquote",
  "ul", "ol", "li", "a", "img", "video", "br",
]);

/** Opaque to the AI — configured presentationally, implemented by Hubly. */
export const HUBLY_RESERVED_TAGS = new Set([
  "HublyBooking", "HublyReviews", "HublyCustomerPortal", "HublyContactForm", "HublyMap",
]);

const VOID_TAGS = new Set(["img", "video", "br"]);

// Attributes never allowed on any tag, regardless of anything else — checked
// before any tag-specific logic runs.
const HARD_BANNED_ATTR_RE = /^on|^style$/i;

/** Which attributes a given (non-reserved) tag may carry, beyond the
 *  universal `class` + `id`. */
const TAG_SPECIFIC_ATTRS: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt"],
  video: ["src"],
};

const REQUIRED_ATTRS: Record<string, string[]> = {
  img: ["src", "alt"],
};

// ---------------------------------------------------------------------------
// Utility-class vocabulary — generated from bounded scales, not hand-typed
// one at a time, but still a real, finite, closed set. This is the actual
// mechanism for "typography, spacing, colors, layout are freely composable"
// without the AI ever writing a CSS property/value pair itself.
// ---------------------------------------------------------------------------

function scale(prefix: string, values: string[]): string[] {
  return values.map((v) => `${prefix}-${v}`);
}

const SPACING_SCALE = ["0", "1", "2", "3", "4", "6", "8", "10", "12", "16", "20", "24", "32"];
const SPACING_PREFIXES = ["p", "pt", "pb", "pl", "pr", "px", "py", "m", "mt", "mb", "ml", "mr", "mx", "my", "gap"];
const TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"];
const FONT_WEIGHTS = ["normal", "medium", "semibold", "bold", "black"];
const TRACKING = ["tighter", "tight", "normal", "wide", "wider", "widest"];
const LEADING = ["none", "tight", "snug", "normal", "relaxed", "loose"];
const COLOR_ROLES = ["ink-900", "ink-700", "ink-400", "ink-100", "white", "brand-100", "brand-300", "brand-500", "brand-600", "brand-700", "brand-800", "brand-900"];
const MAX_WIDTHS = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "full"];
const GRID_COLS = ["1", "2", "3", "4", "5", "6", "12"];
const COL_SPANS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const RADII = ["none", "sm", "md", "lg", "xl", "2xl", "full"];
const ASPECTS = ["square", "video", "[3/4]", "[4/3]", "[16/9]"];
const WIDTH_FRACTIONS = ["full", "1/2", "1/3", "2/3", "1/4", "3/4"];

function buildUtilityClassSet(): Set<string> {
  const s = new Set<string>();
  for (const p of SPACING_PREFIXES) for (const v of SPACING_SCALE) s.add(`${p}-${v}`);
  for (const v of TEXT_SIZES) s.add(`text-${v}`);
  for (const v of FONT_WEIGHTS) s.add(`font-${v}`);
  for (const v of TRACKING) s.add(`tracking-${v}`);
  for (const v of LEADING) s.add(`leading-${v}`);
  for (const v of COLOR_ROLES) { s.add(`text-${v}`); s.add(`bg-${v}`); s.add(`border-${v}`); }
  for (const v of MAX_WIDTHS) s.add(`max-w-${v}`);
  for (const v of GRID_COLS) s.add(`grid-cols-${v}`);
  for (const v of COL_SPANS) s.add(`col-span-${v}`);
  s.add("rounded"); // bare = default/medium radius
  for (const v of RADII) s.add(`rounded-${v}`);
  for (const v of ASPECTS) s.add(`aspect-${v}`);
  for (const v of WIDTH_FRACTIONS) { s.add(`w-${v}`); s.add(`h-${v}`); }
  [
    "font-serif", "font-sans", "font-mono", "italic", "uppercase", "lowercase", "capitalize",
    "text-left", "text-center", "text-right",
    "flex", "grid", "block", "inline-block", "hidden",
    "flex-row", "flex-col", "flex-wrap", "items-center", "items-start", "items-end",
    "justify-center", "justify-between", "justify-start", "justify-end", "justify-around",
    "min-h-screen", "object-cover", "object-contain", "overflow-hidden",
    "shadow", "shadow-md", "shadow-lg", "shadow-xl",
    "border", "border-2",
    "relative", "absolute", "inset-0",
    "bg-gradient-to-br", "bg-gradient-to-r", "bg-gradient-to-b",
    "from-brand-500", "from-brand-600", "from-brand-700", "from-brand-800",
    "to-brand-600", "to-brand-700", "to-brand-800", "to-brand-900",
  ].forEach((c) => s.add(c));
  return s;
}

export const UTILITY_CLASSES = buildUtilityClassSet();
const RESPONSIVE_PREFIXES = ["sm:", "md:", "lg:"];

function isValidClassToken(token: string): boolean {
  for (const p of RESPONSIVE_PREFIXES) {
    if (token.startsWith(p)) return UTILITY_CLASSES.has(token.slice(p.length));
  }
  return UTILITY_CLASSES.has(token);
}

// ---------------------------------------------------------------------------
// href / src validation
// ---------------------------------------------------------------------------

const HUBLY_HREF_SCHEME_RE = /^hubly:(booking|contact)$/;
const ALLOWED_MEDIA_ORIGINS = [
  "https://rtwxxkxpkqdrhclkozma.supabase.co/storage/",
  "https://images.unsplash.com/",
];

function isValidHref(href: string): boolean {
  if (HUBLY_HREF_SCHEME_RE.test(href)) return true;
  if (/^tel:\+?[0-9()\-.\s]+$/.test(href)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) return true;
  if (href.startsWith("#")) return true;
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidMediaSrc(src: string): boolean {
  return ALLOWED_MEDIA_ORIGINS.some((origin) => src.startsWith(origin));
}

// ---------------------------------------------------------------------------
// Id minting
// ---------------------------------------------------------------------------

/** Mint a fresh id from a preferred base, auto-suffixing on collision.
 *  Ids are immutable once minted — a content edit never changes a node's
 *  id, only remove+add ever retires/mints one. */
export function mintId(preferred: string, taken: Set<string>): string {
  const base = preferred && preferred.trim() ? preferred.trim() : "node";
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  const id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

function validateAttrs(tag: string, attrs: Record<string, unknown>, path: string, errors: ValidationIssue[]): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, rawVal] of Object.entries(attrs || {})) {
    if (key === "id") continue; // id is handled separately
    if (HARD_BANNED_ATTR_RE.test(key)) {
      errors.push({ path, message: `attribute "${key}" is never allowed (behavior/style must go through validated class tokens)` });
      continue;
    }
    if (typeof rawVal !== "string") {
      errors.push({ path, message: `attribute "${key}" must be a string` });
      continue;
    }
    const val = rawVal;
    if (key === "class") {
      const tokens = val.split(/\s+/).filter(Boolean);
      const badTokens = tokens.filter((t) => !isValidClassToken(t));
      if (badTokens.length) {
        errors.push({ path, message: `unknown class token(s): ${badTokens.join(", ")}` });
        continue;
      }
      clean.class = tokens.join(" ");
      continue;
    }
    if (key === "href") {
      if (tag !== "a") { errors.push({ path, message: `"href" only allowed on <a>` }); continue; }
      if (!isValidHref(val)) { errors.push({ path, message: `invalid or disallowed href: ${val}` }); continue; }
      clean.href = val;
      continue;
    }
    if (key === "src") {
      if (tag !== "img" && tag !== "video") { errors.push({ path, message: `"src" only allowed on <img>/<video>` }); continue; }
      if (!isValidMediaSrc(val)) { errors.push({ path, message: `src must resolve to an allowlisted media origin: ${val}` }); continue; }
      clean.src = val;
      continue;
    }
    if (key === "alt") {
      if (tag !== "img") { errors.push({ path, message: `"alt" only allowed on <img>` }); continue; }
      clean.alt = val;
      continue;
    }
    const allowedForTag = TAG_SPECIFIC_ATTRS[tag] || [];
    if (!allowedForTag.includes(key)) {
      errors.push({ path, message: `attribute "${key}" is not allowed on <${tag}>` });
      continue;
    }
    clean[key] = val;
  }
  for (const req of REQUIRED_ATTRS[tag] || []) {
    if (!clean[req]) errors.push({ path, message: `<${tag}> requires attribute "${req}"` });
  }
  return clean;
}

function validateReservedAttrs(tag: string, attrs: Record<string, unknown>, path: string, errors: ValidationIssue[]): Record<string, string> {
  // Reserved elements accept only presentational hints — a small, named set
  // per element. Deliberately narrower than the open `class` grammar above:
  // these are configuration knobs for a real component, not free styling.
  const ALLOWED: Record<string, string[]> = {
    HublyBooking: ["variant", "class", "serviceId"],
    HublyReviews: ["variant", "class"],
    HublyCustomerPortal: ["variant", "class"],
    HublyContactForm: ["variant", "class"],
    HublyMap: ["variant", "class"],
  };
  const allowed = ALLOWED[tag] || [];
  const clean: Record<string, string> = {};
  for (const [key, rawVal] of Object.entries(attrs || {})) {
    if (key === "id") continue;
    if (!allowed.includes(key)) { errors.push({ path, message: `"${key}" is not a configurable prop of <${tag}>` }); continue; }
    if (typeof rawVal !== "string") { errors.push({ path, message: `"${key}" must be a string` }); continue; }
    if (key === "class") {
      const tokens = rawVal.split(/\s+/).filter(Boolean);
      const bad = tokens.filter((t) => !isValidClassToken(t));
      if (bad.length) { errors.push({ path, message: `unknown class token(s): ${bad.join(", ")}` }); continue; }
    }
    clean[key] = rawVal;
  }
  return clean;
}

type WalkContext = { takenIds: Set<string>; h1Count: number; errors: ValidationIssue[]; warnings: ValidationIssue[] };

function walkAndValidate(raw: unknown, path: string, ctx: WalkContext): HublyDocumentNode | null {
  if (!raw || typeof raw !== "object") {
    ctx.errors.push({ path, message: "node must be an object" });
    return null;
  }
  const r = raw as Record<string, unknown>;
  const tag = typeof r.tag === "string" ? r.tag : "";
  const isReserved = HUBLY_RESERVED_TAGS.has(tag);
  const isAllowed = ALLOWED_TAGS.has(tag);
  if (!isReserved && !isAllowed) {
    ctx.errors.push({ path, message: `tag "${tag}" is not allowed` });
    return null;
  }
  if (tag === "h1") ctx.h1Count++;

  const preferredId = typeof r.id === "string" ? r.id : "";
  const id = mintId(preferredId, ctx.takenIds);
  const nodePath = `${path}[${id}]`;

  const attrs = isReserved
    ? validateReservedAttrs(tag, (r.attrs as Record<string, unknown>) || {}, nodePath, ctx.errors)
    : validateAttrs(tag, (r.attrs as Record<string, unknown>) || {}, nodePath, ctx.errors);

  let children: HublyDocumentNode[] | string;
  if (typeof r.children === "string") {
    if (VOID_TAGS.has(tag)) {
      ctx.warnings.push({ path: nodePath, message: `<${tag}> is a void element — text content ignored` });
      children = [];
    } else {
      children = r.children;
    }
  } else if (Array.isArray(r.children)) {
    if (VOID_TAGS.has(tag) && r.children.length) {
      ctx.errors.push({ path: nodePath, message: `<${tag}> cannot have children` });
    }
    const kids: HublyDocumentNode[] = [];
    r.children.forEach((c, i) => {
      const child = walkAndValidate(c, `${nodePath}/${i}`, ctx);
      if (child) kids.push(child);
    });
    children = kids;
  } else if (r.children == null) {
    children = VOID_TAGS.has(tag) ? [] : "";
  } else {
    ctx.errors.push({ path: nodePath, message: "children must be a string or an array of nodes" });
    children = [];
  }

  const reasoning = validateReasoning(r.reasoning, nodePath, ctx.warnings);

  return { id, tag, attrs, children, ...(reasoning ? { reasoning } : {}) };
}

function validateReasoning(raw: unknown, path: string, warnings: ValidationIssue[]): HublyNodeProvenance | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const source = r.source === "ai" || r.source === "user" ? r.source : undefined;
  if (!source) { warnings.push({ path, message: "reasoning.source missing/invalid — dropped" }); return undefined; }
  const out: HublyNodeProvenance = { source };
  if (typeof r.reason === "string") out.reason = r.reason.slice(0, 280);
  if (typeof r.reference === "string") out.reference = r.reference.slice(0, 280);
  if (typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1) out.confidence = r.confidence;
  if (r.editedBy === "ai" || r.editedBy === "user") out.editedBy = r.editedBy;
  if (typeof r.lastModifiedAt === "string") out.lastModifiedAt = r.lastModifiedAt;
  return out;
}

/** Validates and normalizes a raw candidate document (untrusted — from the
 *  model, or from a hand-authored fixture). Never throws; always returns a
 *  result. Nothing downstream should ever consume an unvalidated document. */
export function validateHublyDocument(raw: unknown, meta: { businessId: string; tag?: string; version: number; generatedBy: "ai" | "user" | "patch" }): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: [{ path: "$", message: "document must be an object" }] };
  const r = raw as Record<string, unknown>;
  const rootRaw = r.root ?? raw; // tolerate a bare root node as input too
  const ctx: WalkContext = { takenIds: new Set(), h1Count: 0, errors, warnings };
  const root = walkAndValidate(rootRaw, "$", ctx);
  if (ctx.h1Count !== 1) {
    errors.push({ path: "$", message: `document must contain exactly one <h1> (found ${ctx.h1Count})` });
  }
  if (errors.length || !root) return { ok: false, errors };
  const document: HublyDocument = {
    schemaVersion: 1,
    documentId: `${meta.businessId}:v${meta.version}`,
    businessId: meta.businessId,
    tag: meta.tag || "website",
    version: meta.version,
    generatedBy: meta.generatedBy,
    createdAt: new Date().toISOString(),
    root,
  };
  return { ok: true, document, warnings };
}

// ---------------------------------------------------------------------------
// Renderer — validated tree to real HTML.
//
// This is meaningfully safer than sanitizing arbitrary HTML after the fact
// (the DOMPurify-CVE-history kind of problem): the input here has already
// been walked node-by-node against a closed grammar by validateHublyDocument
// above, so nothing reaches this function that isn't a known-safe tag with
// known-safe attribute keys. What's left to handle here is purely syntactic:
// text content and attribute VALUES are still free-form (a business name,
// AI-authored copy) and must be HTML-escaped on the way out, the same as
// any dynamic string ever inserted into markup — that's not redundant with
// validation, it's a different layer of the same discipline.
//
// Rendering only ever runs against an already-validated HublyDocument.
// There is deliberately no code path that serializes raw/untrusted input.
// ---------------------------------------------------------------------------

export type RenderContext = {
  businessId: string;
  businessName: string;
  businessPhone?: string;
};

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escAttr(s: string): string {
  return escHtml(s);
}

function renderAttrs(attrs: Record<string, string>, id: string): string {
  const parts = [`data-node="${escAttr(id)}"`];
  for (const [k, v] of Object.entries(attrs)) {
    parts.push(`${k}="${escAttr(v)}"`);
  }
  return parts.join(" ");
}

/** Hubly-owned islands. Presentational `attrs` from the AI are read as
 *  hints only — real data (availability, reviews, CRM state) is Hubly's to
 *  fetch, never the AI's to fabricate. For this vertical slice these render
 *  as honest, clearly-labeled placeholders rather than partially-real
 *  integrations — flagged here, not silently pretended to work. */
function renderReservedElement(node: HublyDocumentNode, ctx: RenderContext): string {
  const cls = node.attrs.class ? ` ${escAttr(node.attrs.class)}` : "";
  const wrap = (inner: string) => `<div data-node="${escAttr(node.id)}" data-hubly-element="${node.tag}" class="hubly-reserved${cls}">${inner}</div>`;
  switch (node.tag) {
    case "HublyBooking": {
      const phone = ctx.businessPhone ? `<a href="tel:${escAttr(ctx.businessPhone)}" class="text-brand-600 font-semibold">${escHtml(ctx.businessPhone)}</a>` : "";
      return wrap(`<p class="text-base text-ink-700">Online booking is coming online here. ${phone ? "Call or text " + phone + " to book for now." : "Contact us to book."}</p>`);
    }
    case "HublyReviews":
      return wrap(`<p class="text-base text-ink-700">Customer reviews will appear here once connected.</p>`);
    case "HublyCustomerPortal":
      return wrap(`<p class="text-base text-ink-700">Customer portal coming online here.</p>`);
    case "HublyContactForm":
      return wrap(`<p class="text-base text-ink-700">Contact form coming online here.</p>`);
    case "HublyMap":
      return wrap(`<p class="text-base text-ink-700">Map coming online here.</p>`);
    default:
      return wrap("");
  }
}

function renderNode(node: HublyDocumentNode, ctx: RenderContext): string {
  if (HUBLY_RESERVED_TAGS.has(node.tag)) return renderReservedElement(node, ctx);
  const attrsStr = renderAttrs(node.attrs, node.id);
  if (VOID_TAGS.has(node.tag)) {
    return `<${node.tag} ${attrsStr}>`;
  }
  const inner = typeof node.children === "string"
    ? escHtml(node.children)
    : node.children.map((c) => renderNode(c, ctx)).join("");
  return `<${node.tag} ${attrsStr}>${inner}</${node.tag}>`;
}

/** Renders an already-validated HublyDocument to a real HTML string.
 *  Never call this with unvalidated input. */
export function renderHublyDocument(document: HublyDocument, ctx: RenderContext): string {
  return renderNode(document.root, ctx);
}

// ---------------------------------------------------------------------------
// Prompt block — generated from the real schema constants above, never
// hand-duplicated prose. Same discipline as buildCapabilitiesPromptBlock in
// the capability registry: what the model is told and what the validator
// enforces must never be able to drift apart, because they're the same
// source.
// ---------------------------------------------------------------------------

export function buildDocumentSchemaPromptBlock(): string {
  const tags = [...ALLOWED_TAGS].join(", ");
  const reserved = [...HUBLY_RESERVED_TAGS].join(", ");
  return `HUBLY DOCUMENT FORMAT — the only output shape you may produce.

You are not writing JSX or HTML. You are producing a JSON tree of nodes. Each node:
{ "id": "<stable dotted path, e.g. hero.headline>", "tag": "<one allowed tag>", "attrs": { "class": "<space-separated utility tokens>", ... }, "children": [<nodes>] | "<text>", "reasoning": { "source": "ai", "reason": "<why, one short sentence>", "confidence": 0-1 } }

Return the ROOT node only (a single object), not an array, not wrapped in another key.

ALLOWED TAGS (nothing else will be accepted): ${tags}
Never: script, style, iframe, form, input, button, or any "on*"/"style" attribute — these are rejected outright, not filtered.

RESERVED HUBLY ELEMENTS (you configure appearance only, never behavior): ${reserved}
Use these for booking, reviews, customer portal, contact forms, and maps — never write your own <form> or interactive markup for these; place the reserved element instead. Their real data and functionality are Hubly's, not yours to invent.

STYLING — every value must be one of these exact tokens (space-separated in "class"), nothing invented:
- Spacing: ${SPACING_PREFIXES.join("/")}-{${SPACING_SCALE.join(",")}} (e.g. "py-16", "px-8", "gap-6")
- Text size: text-{${TEXT_SIZES.join(",")}}
- Font weight: font-{${FONT_WEIGHTS.join(",")}}; also font-serif, font-sans, font-mono, italic
- Tracking: tracking-{${TRACKING.join(",")}}; leading: leading-{${LEADING.join(",")}}
- Color roles (not raw hex — these map to the business's real brand color + a neutral scale): ${COLOR_ROLES.map((c) => `text-${c}/bg-${c}/border-${c}`).join(", ")}
- Layout: flex, grid, block, hidden, flex-row, flex-col, items-{center,start,end}, justify-{center,between,start,end,around}, grid-cols-{${GRID_COLS.join(",")}}, col-span-{1..12}
- Sizing: max-w-{${MAX_WIDTHS.join(",")}}, w-{${WIDTH_FRACTIONS.join(",")}}, h-{full}, min-h-screen
- Radius/shadow/border: rounded, rounded-{${RADII.join(",")}}, shadow, shadow-{md,lg,xl}, border, border-2
- Responsive: prefix any of the above with sm:/md:/lg: for breakpoint variants
Class tokens not on this list are rejected, not approximated — pick the closest real token.

IMAGES: <img> requires both "src" and "alt". "src" must be a real, already-uploaded Hubly asset URL you were given — never invent a URL.
LINKS: <a href> accepts a real URL, tel:, mailto:, an in-page "#anchor", or the reserved schemes hubly:booking / hubly:contact for built-in flows. Never "javascript:" or an invented href.

STRUCTURE: exactly one <h1> in the whole document — the hero headline. Every node needs a stable, human-readable "id" — dotted path convention, e.g. "services.item-2.title". You choose ids; the system deduplicates automatically, so don't worry about collisions.

REASONING: on nodes where you made a real design choice (not on every trivial span), include "reasoning": {"source":"ai","reason":"<one sentence, honest, specific>","confidence":<0-1>}. This isn't decoration — it's what lets you explain your own choices later if asked "why is this here."`;
}

// ---------------------------------------------------------------------------
// Patch application — editing is patches, not regeneration.
//
// A patch is a small, closed vocabulary of operations, each targeting an
// explicit node id. The apply step below only ever touches the ids named in
// the ops — there is no code path here that can alter anything else, which
// is what makes "editing a living document" a structural guarantee rather
// than a prompting instruction. After applying, the WHOLE resulting tree is
// re-validated through the same validateHublyDocument used at generation
// time — one validator, never two implementations to keep in sync — which
// also mints/dedupes ids for anything newly added or replaced.
// ---------------------------------------------------------------------------

export type PatchOp =
  | { op: "update_text"; id: string; text: string }
  | { op: "update_attrs"; id: string; attrs: Record<string, string> }
  | { op: "move_node"; id: string; newParentId: string; index: number }
  | { op: "remove_node"; id: string }
  | { op: "add_node"; parentId: string; index: number; node: unknown }
  | { op: "replace_node"; id: string; node: unknown };

export type PatchApplyResult =
  | { ok: true; document: HublyDocument; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[] };

function deepCloneNode(n: HublyDocumentNode): HublyDocumentNode {
  return JSON.parse(JSON.stringify(n));
}

function findWithParent(
  node: HublyDocumentNode,
  id: string,
  parent: HublyDocumentNode | null,
): { node: HublyDocumentNode; parent: HublyDocumentNode | null } | null {
  if (node.id === id) return { node, parent };
  if (!Array.isArray(node.children)) return null;
  for (const child of node.children) {
    const found = findWithParent(child, id, node);
    if (found) return found;
  }
  return null;
}

function childrenArray(node: HublyDocumentNode): HublyDocumentNode[] {
  if (!Array.isArray(node.children)) node.children = [];
  return node.children;
}

/** Applies a list of patch ops to a document and re-validates the result.
 *  Never mutates the input document — operates on a deep clone. */
export function applyPatchOps(document: HublyDocument, ops: PatchOp[]): PatchApplyResult {
  const root = deepCloneNode(document.root);
  const opErrors: ValidationIssue[] = [];

  for (const [i, rawOp] of ops.entries()) {
    const path = `patch[${i}]`;
    switch (rawOp.op) {
      case "update_text": {
        const found = findWithParent(root, rawOp.id, null);
        if (!found) { opErrors.push({ path, message: `no node with id "${rawOp.id}"` }); break; }
        found.node.children = rawOp.text;
        break;
      }
      case "update_attrs": {
        const found = findWithParent(root, rawOp.id, null);
        if (!found) { opErrors.push({ path, message: `no node with id "${rawOp.id}"` }); break; }
        found.node.attrs = { ...found.node.attrs, ...rawOp.attrs };
        break;
      }
      case "remove_node": {
        if (rawOp.id === root.id) { opErrors.push({ path, message: "cannot remove the root node" }); break; }
        const found = findWithParent(root, rawOp.id, null);
        if (!found || !found.parent) { opErrors.push({ path, message: `no node with id "${rawOp.id}"` }); break; }
        const siblings = childrenArray(found.parent);
        const idx = siblings.indexOf(found.node);
        if (idx !== -1) siblings.splice(idx, 1);
        break;
      }
      case "move_node": {
        if (rawOp.id === root.id) { opErrors.push({ path, message: "cannot move the root node" }); break; }
        const found = findWithParent(root, rawOp.id, null);
        if (!found || !found.parent) { opErrors.push({ path, message: `no node with id "${rawOp.id}"` }); break; }
        const target = findWithParent(root, rawOp.newParentId, null);
        if (!target) { opErrors.push({ path, message: `no target parent with id "${rawOp.newParentId}"` }); break; }
        const oldSiblings = childrenArray(found.parent);
        const oldIdx = oldSiblings.indexOf(found.node);
        if (oldIdx !== -1) oldSiblings.splice(oldIdx, 1);
        const newSiblings = childrenArray(target.node);
        const insertAt = Math.max(0, Math.min(rawOp.index, newSiblings.length));
        newSiblings.splice(insertAt, 0, found.node);
        break;
      }
      case "add_node": {
        const target = findWithParent(root, rawOp.parentId, null);
        if (!target) { opErrors.push({ path, message: `no parent with id "${rawOp.parentId}"` }); break; }
        const siblings = childrenArray(target.node);
        const insertAt = Math.max(0, Math.min(rawOp.index, siblings.length));
        // Inserted as the raw candidate — validated (and its id minted) by
        // the whole-tree re-validation pass below, same as generation.
        siblings.splice(insertAt, 0, rawOp.node as HublyDocumentNode);
        break;
      }
      case "replace_node": {
        if (rawOp.id === root.id) { opErrors.push({ path, message: "cannot replace the root node" }); break; }
        const found = findWithParent(root, rawOp.id, null);
        if (!found || !found.parent) { opErrors.push({ path, message: `no node with id "${rawOp.id}"` }); break; }
        const siblings = childrenArray(found.parent);
        const idx = siblings.indexOf(found.node);
        if (idx === -1) { opErrors.push({ path, message: `internal: node not found in parent's children` }); break; }
        // A replacement mints a fresh id rather than inheriting the old
        // one — semantically this is "remove old content, add new", not
        // "edit this node in place", so id stability rules don't promise
        // continuity here (unlike update_text/update_attrs, which never
        // touch id).
        siblings[idx] = rawOp.node as HublyDocumentNode;
        break;
      }
      default: {
        opErrors.push({ path, message: `unknown op "${(rawOp as { op?: string }).op}"` });
      }
    }
  }

  if (opErrors.length) return { ok: false, errors: opErrors };

  const result = validateHublyDocument(root, {
    businessId: document.businessId,
    tag: document.tag,
    version: document.version + 1,
    generatedBy: "patch",
  });
  return result.ok ? { ok: true, document: result.document, warnings: result.warnings } : { ok: false, errors: result.errors };
}
