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

// "5" and margin "auto" were missing from earlier versions of this scale —
// confirmed via 5/5 real generations (landscaping, photography, detailing,
// plumbing, dental) each failing first-attempt validation on exactly these
// two tokens (mx-auto every time, gap-5 in 3/5), because mx-auto is one of
// the most deeply ingrained real-world Tailwind idioms (centering a content
// wrapper) and the model reaches for it regardless of the closed-grammar
// prompt. Not a prompting problem — a real grammar gap, closed here.
// Exported so scripts/generate-hubly-document-css.ts can generate the real
// stylesheet from these same constants — one source of truth for what the
// AI is told, what the validator accepts, and what it actually looks like.
export const SPACING_SCALE = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"];
export const SPACING_PREFIXES = ["p", "pt", "pb", "pl", "pr", "px", "py", "m", "mt", "mb", "ml", "mr", "mx", "my", "gap"];
export const TEXT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"];
export const FONT_WEIGHTS = ["normal", "medium", "semibold", "bold", "black"];
export const TRACKING = ["tighter", "tight", "normal", "wide", "wider", "widest"];
export const LEADING = ["none", "tight", "snug", "normal", "relaxed", "loose"];
export const COLOR_ROLES = ["ink-900", "ink-700", "ink-400", "ink-100", "white", "brand-100", "brand-300", "brand-500", "brand-600", "brand-700", "brand-800", "brand-900"];
export const MAX_WIDTHS = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "full"];
export const GRID_COLS = ["1", "2", "3", "4", "5", "6", "12"];
export const COL_SPANS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
export const RADII = ["none", "sm", "md", "lg", "xl", "2xl", "full"];
export const ASPECTS = ["square", "video", "[3/4]", "[4/3]", "[16/9]"];
export const WIDTH_FRACTIONS = ["full", "1/2", "1/3", "2/3", "1/4", "3/4"];

/**
 * THE CLASS VOCABULARY — one declaration, two consumers.
 *
 * This file's header has always claimed that what the model is told and what
 * the validator enforces "must never be able to drift apart, because they're
 * the same source." That was aspirational: the validator's token set was built
 * by one block of code and the prompt's styling list was hand-written prose
 * beside it. They drifted, and stayed drifted for months.
 *
 * ELEVEN families were accepted by the validator and never mentioned to the
 * model: aspect-*, object-cover, object-contain, overflow-hidden, relative,
 * absolute, inset-0, uppercase/lowercase/capitalize, flex-wrap, inline-block,
 * and the whole gradient set. The cost was not theoretical. Told to build a
 * photo placeholder "with an aspect ratio", the model had no aspect class in
 * the vocabulary it had been shown, so it used min-h-screen — the only height
 * token it had ever been offered — and produced a full-viewport grey rectangle
 * in the hero of every visual business.
 *
 * So the two are now generated from ONE array. `tokens` feeds the validator,
 * `prompt` feeds the model, and a family cannot exist without both because the
 * type requires both. Adding a family to the validator without telling the
 * model is no longer something you can do by forgetting.
 *
 * `prompt` uses compact notation (`p/px/py-{0,1,2…}`) rather than enumerating
 * every token, deliberately — spacing alone is 196 tokens and a prompt that
 * lists them all buys nothing. What the structure guarantees is that no FAMILY
 * is silently missing, which is the failure that actually happened.
 * verifyVocabularyCoverage() below checks the token level too.
 */
type ClassFamily = {
  id: string;
  /** Every token this family contributes to the validator. */
  tokens: string[];
  /** How the family is offered to the model. Required — see above. */
  prompt: string;
};

const CLASS_FAMILIES: ClassFamily[] = [
  {
    id: "spacing",
    tokens: SPACING_PREFIXES.flatMap((p) => SPACING_SCALE.map((v) => `${p}-${v}`)),
    prompt: `Spacing: ${SPACING_PREFIXES.join("/")}-{${SPACING_SCALE.join(",")}} (e.g. "py-16", "px-8", "gap-6")`,
  },
  {
    // margin "auto" is a distinct CSS value, not a spacing-scale number — real
    // Tailwind only defines it for margin (m/mx/my), never padding or gap.
    id: "margin-auto",
    tokens: ["m-auto", "mx-auto", "my-auto"],
    prompt: `Centering: m-auto, mx-auto, my-auto — the ONLY non-numeric spacing values`,
  },
  {
    id: "text-size",
    tokens: TEXT_SIZES.map((v) => `text-${v}`),
    prompt: `Text size: text-{${TEXT_SIZES.join(",")}}`,
  },
  {
    id: "font-weight",
    tokens: FONT_WEIGHTS.map((v) => `font-${v}`),
    prompt: `Font weight: font-{${FONT_WEIGHTS.join(",")}}`,
  },
  {
    id: "font-family",
    tokens: ["font-serif", "font-sans", "font-mono", "italic"],
    prompt: `Typeface: font-serif, font-sans, font-mono, italic`,
  },
  {
    id: "tracking",
    tokens: TRACKING.map((v) => `tracking-${v}`),
    prompt: `Tracking: tracking-{${TRACKING.join(",")}}`,
  },
  {
    id: "leading",
    tokens: LEADING.map((v) => `leading-${v}`),
    prompt: `Leading: leading-{${LEADING.join(",")}}`,
  },
  {
    id: "color",
    tokens: COLOR_ROLES.flatMap((v) => [`text-${v}`, `bg-${v}`, `border-${v}`]),
    prompt: `Color roles (not raw hex — these map to the business's real brand color + a neutral scale): ${COLOR_ROLES.map((c) => `text-${c}/bg-${c}/border-${c}`).join(", ")}`,
  },
  {
    id: "text-align",
    tokens: ["text-left", "text-center", "text-right"],
    prompt: `Alignment: text-left, text-center, text-right`,
  },
  {
    id: "text-transform",
    tokens: ["uppercase", "lowercase", "capitalize"],
    prompt: `Text transform: uppercase, lowercase, capitalize`,
  },
  {
    id: "display",
    tokens: ["flex", "grid", "block", "inline-block", "hidden"],
    prompt: `Display: flex, grid, block, inline-block, hidden`,
  },
  {
    id: "flexbox",
    tokens: [
      "flex-row", "flex-col", "flex-wrap",
      "items-center", "items-start", "items-end",
      "justify-center", "justify-between", "justify-start", "justify-end", "justify-around",
    ],
    prompt: `Flex: flex-row, flex-col, flex-wrap, items-{center,start,end}, justify-{center,between,start,end,around}`,
  },
  {
    id: "grid",
    tokens: [
      ...GRID_COLS.map((v) => `grid-cols-${v}`),
      ...COL_SPANS.map((v) => `col-span-${v}`),
    ],
    prompt: `Grid: grid-cols-{${GRID_COLS.join(",")}}, col-span-{${COL_SPANS.join(",")}}`,
  },
  {
    id: "sizing",
    tokens: [
      ...MAX_WIDTHS.map((v) => `max-w-${v}`),
      ...WIDTH_FRACTIONS.map((v) => `w-${v}`),
      ...WIDTH_FRACTIONS.map((v) => `h-${v}`),
      "min-h-screen",
    ],
    prompt: `Sizing: max-w-{${MAX_WIDTHS.join(",")}}, w-{${WIDTH_FRACTIONS.join(",")}}, h-{${WIDTH_FRACTIONS.join(",")}}, min-h-screen`,
  },
  {
    id: "aspect",
    tokens: ASPECTS.map((v) => `aspect-${v}`),
    prompt: `Proportion: aspect-{${ASPECTS.join(",")}} — USE THESE to size an image or an image placeholder. min-h-screen makes a box a whole viewport tall and is for a full-height hero SECTION only; on a picture frame it produces a giant grey rectangle, which is the single most common way one of these pages comes out broken`,
  },
  {
    id: "media-fit",
    tokens: ["object-cover", "object-contain", "overflow-hidden"],
    prompt: `Media fit: object-cover, object-contain, overflow-hidden — object-cover on an <img> inside an aspect-* box is how a photo fills its frame without distorting`,
  },
  {
    id: "position",
    tokens: ["relative", "absolute", "inset-0"],
    prompt: `Positioning: relative, absolute, inset-0 — an absolute child with inset-0 inside a relative parent fills it exactly. This is how you put text OVER a full-bleed image, or lay a scrim across one`,
  },
  {
    id: "radius",
    tokens: ["rounded", ...RADII.map((v) => `rounded-${v}`)],
    prompt: `Radius: rounded, rounded-{${RADII.join(",")}}`,
  },
  {
    id: "shadow",
    tokens: ["shadow", "shadow-md", "shadow-lg", "shadow-xl"],
    prompt: `Shadow: shadow, shadow-{md,lg,xl}`,
  },
  {
    id: "border",
    tokens: ["border", "border-2"],
    prompt: `Border: border, border-2`,
  },
  {
    id: "gradient",
    tokens: [
      "bg-gradient-to-br", "bg-gradient-to-r", "bg-gradient-to-b",
      "from-brand-500", "from-brand-600", "from-brand-700", "from-brand-800",
      "to-brand-600", "to-brand-700", "to-brand-800", "to-brand-900",
    ],
    prompt: `Gradients: bg-gradient-to-{r,b,br} with from-brand-{500,600,700,800} and to-brand-{600,700,800,900} — for a hero wash or a scrim that keeps text readable over an image`,
  },
];

function buildUtilityClassSet(): Set<string> {
  const s = new Set<string>();
  for (const family of CLASS_FAMILIES) for (const t of family.tokens) s.add(t);
  return s;
}

export const UTILITY_CLASSES = buildUtilityClassSet();

/** The styling section of the prompt, generated from the same array the
 *  validator is built from. */
export function buildStylingPromptBlock(): string {
  return CLASS_FAMILIES.map((f) => `- ${f.prompt}`).join("\n");
}

/**
 * Fails loudly when the validator accepts something the model was never told
 * about. This is the check that would have caught the aspect-* gap on the day
 * it was introduced instead of months later.
 *
 * Two levels, because they catch different mistakes:
 *   - a family with an empty prompt (someone added tokens and left the text)
 *   - a token whose family prompt never mentions its head, e.g. adding
 *     "sticky" to the position family without updating that family's text
 *
 * Returns problems rather than throwing, so callers choose: the test asserts
 * it is empty, and buildDocumentSchemaPromptBlock logs rather than taking a
 * live generation down over a prompt-wording issue.
 */
export function verifyVocabularyCoverage(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of CLASS_FAMILIES) {
    if (!f.prompt.trim()) problems.push(`family "${f.id}" has no prompt text`);
    if (!f.tokens.length) problems.push(`family "${f.id}" contributes no tokens`);
    for (const t of f.tokens) {
      if (seen.has(t)) continue;
      seen.add(t);
      // "aspect-square" -> head "aspect"; bare tokens are their own head.
      const head = t.includes("-") ? t.slice(0, t.indexOf("-")) : t;
      if (!f.prompt.includes(head)) {
        problems.push(`token "${t}" (family "${f.id}") is accepted by the validator but its family prompt never mentions "${head}"`);
      }
    }
  }
  return problems;
}
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

/**
 * Hosts whose entire purpose is to capture a customer's intent somewhere Hubly
 * cannot see it. A link to one of these turns a Hubly-built page into a
 * funnel for a competing system: the business gets the booking, Hubly gets no
 * lead, no record and nothing to follow up.
 *
 * This is a DENYLIST and denylists leak — someone can always self-host a form.
 * It is here because the common cases are common, not because it is complete.
 * The guarantee that actually holds is the document-level rule in
 * validateHublyDocument: every generated page must contain a real Hubly intent
 * element. This list stops the obvious ways to undermine that.
 */
const OFF_PLATFORM_CAPTURE_HOSTS = [
  "calendly.com", "typeform.com", "docs.google.com", "forms.gle", "forms.office.com",
  "jotform.com", "acuityscheduling.com", "squareup.com", "setmore.com", "booksy.com",
  "wufoo.com", "formstack.com", "mailchi.mp", "hubspot.com", "square.site",
];

function isOffPlatformCaptureUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  return OFF_PLATFORM_CAPTURE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

function isValidHref(href: string): boolean {
  if (HUBLY_HREF_SCHEME_RE.test(href)) return true;
  if (/^tel:\+?[0-9()\-.\s]+$/.test(href)) return true;
  // mailto: is deliberately NOT accepted. An email address may appear as text
  // — that is information, and useful. A clickable mailto is a lead-capture
  // CTA that routes into someone's inbox instead of into Leads, which is the
  // exact failure this rule exists to prevent. Use HublyContactForm.
  if (href.startsWith("#")) return true;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return !isOffPlatformCaptureUrl(u);
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
      if (!isValidHref(val)) {
        // Say WHY for the two cases the model will hit deliberately, so the
        // one retry can actually repair them instead of guessing.
        const why = val.startsWith("mailto:")
          ? `mailto: links are not allowed — an enquiry sent by email never reaches Hubly. Show the address as plain text if it is useful information, and use HublyContactForm for the actual call to action`
          : /^https?:/i.test(val)
          ? `this link sends the customer to an off-platform booking or form service — use HublyBooking or HublyContactForm so the lead reaches the business inside Hubly`
          : `invalid or disallowed href: ${val}`;
        errors.push({ path, message: why });
        continue;
      }
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

type WalkContext = { takenIds: Set<string>; h1Count: number; intentElementCount: number; errors: ValidationIssue[]; warnings: ValidationIssue[] };

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
  // The two reserved elements that actually capture a customer's intent and
  // route it into Hubly. HublyReviews/HublyMap/HublyCustomerPortal display or
  // serve existing customers; neither turns a stranger into a lead.
  if (tag === "HublyBooking" || tag === "HublyContactForm") ctx.intentElementCount++;

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
  const ctx: WalkContext = { takenIds: new Set(), h1Count: 0, intentElementCount: 0, errors, warnings };
  const root = walkAndValidate(rootRaw, "$", ctx);
  if (ctx.h1Count !== 1) {
    errors.push({ path: "$", message: `document must contain exactly one <h1> (found ${ctx.h1Count})` });
  }
  // INTENT CAPTURE MUST ROUTE INTO HUBLY.
  //
  // A site that looks good and sends its enquiries somewhere Hubly cannot see
  // leaves the business no better off. HublyContactForm writes booking_requests
  // and lands in Leads; a mailto: link lands in an inbox and Hubly never learns
  // the lead existed -- no record, no follow-up, nothing to chase. There were
  // sixteen mailto: links across the documents generated before this rule,
  // including one to a real business's real address.
  //
  // Enforced for `ai` generations only. A patch is an owner deliberately
  // editing their own page, and blocking them from removing a form would be
  // overriding the person who owns the business.
  if (meta.generatedBy === "ai" && ctx.intentElementCount === 0) {
    errors.push({
      path: "$",
      message:
        "the page gives a visitor no way to make contact that Hubly can see. Include a HublyBooking or HublyContactForm element. A phone number is information, not a route into Hubly",
    });
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
  /** The business's real, already-chosen brand_color (see businesses table)
   *  — never a new color invented here. The brand-* color-role scale
   *  (see hubly-document.css, generated by scripts/generate-hubly-document-css.ts)
   *  derives its tints/shades from this single real value via color-mix(),
   *  the same technique the dashboard's own --brand/--brand-dark/--brand-light
   *  theming already uses. Falls back to Hubly's own default brand color
   *  (#D9632D, the dashboard's --brand) if a business hasn't set one. */
  businessBrandColor?: string;
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FALLBACK_BRAND_COLOR = "#D9632D";

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

/** Anchor ids are namespaced before they reach the DOM.
 *
 *  The document is injected with innerHTML into #hc-doc-root, which lives
 *  inside hubly.html — a ~2.8MB SPA with its own id space. A document node
 *  called "contact" or "services" would collide with the app's own elements,
 *  so every id is emitted as "hd-<nodeid>" and in-page hrefs are rewritten to
 *  match. Without this, `href="#anchor"` — which the prompt advertises and the
 *  validator accepts — pointed at nothing at all, because renderAttrs never
 *  emitted an `id` in the first place. */
const ANCHOR_PREFIX = "hd-";

function renderAttrs(attrs: Record<string, string>, id: string): string {
  const parts = [`data-node="${escAttr(id)}"`, `id="${escAttr(ANCHOR_PREFIX + id)}"`];
  for (const [k, v] of Object.entries(attrs)) {
    const value = k === "href" && v.startsWith("#") ? "#" + ANCHOR_PREFIX + v.slice(1) : v;
    parts.push(`${k}="${escAttr(value)}"`);
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
      // Opens the same real booking wizard the classic renderer uses —
      // wireHublyDocumentReserved in hubly.html binds the click.
      const phone = ctx.businessPhone
        ? `<a class="hd-alt-action" href="tel:${escAttr(ctx.businessPhone)}">or call ${escHtml(ctx.businessPhone)}</a>`
        : "";
      return wrap(`<div class="hd-booking">
<a class="hd-primary-action" href="hubly:booking">Check availability</a>
${phone}
</div>`);
    }
    case "HublyReviews":
      return wrap(`<div class="hd-empty-island" data-hd-empty="reviews"><p>Reviews from real customers appear here as they come in.</p></div>`);
    case "HublyCustomerPortal":
      return wrap(`<div class="hd-empty-island" data-hd-empty="portal"><p>Existing customers will be able to sign in here.</p></div>`);
    case "HublyContactForm":
      // A real form, posting to the same booking_requests table the classic
      // public site writes to, so a message lands on the owner's Leads board
      // exactly like any other enquiry. Submission is wired client-side
      // (innerHTML never executes script) by wireHublyDocumentReserved.
      return wrap(`<form class="hd-form" data-hd-form="contact" novalidate>
<div class="hd-field"><label for="hd-cf-name">Your name</label><input id="hd-cf-name" name="name" type="text" autocomplete="name" required></div>
<div class="hd-field"><label for="hd-cf-email">Email</label><input id="hd-cf-email" name="email" type="email" autocomplete="email"></div>
<div class="hd-field"><label for="hd-cf-phone">Phone</label><input id="hd-cf-phone" name="phone" type="tel" autocomplete="tel"></div>
<div class="hd-field"><label for="hd-cf-message">What do you need?</label><textarea id="hd-cf-message" name="message" rows="4"></textarea></div>
<p class="hd-form-note">We need an email or a phone number so we can reply.</p>
<button class="hd-primary-action" type="submit">Send enquiry</button>
<p class="hd-form-status" role="status" aria-live="polite"></p>
</form>`);
    case "HublyMap":
      return wrap(`<div class="hd-empty-island" data-hd-empty="map"><p>A map of the service area appears here once an address is added.</p></div>`);
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
 *  Never call this with unvalidated input.
 *
 *  Prepends a small <style> block scoping --brand to #hc-doc-root (the real
 *  mount point — see loadPublicProfile in hubly.html) rather than :root, so
 *  a generated document's brand color never leaks into or collides with the
 *  admin dashboard's own --brand variable, which is a completely separate,
 *  already-real CSS custom property defined at :root for the app shell. */
// ---------------------------------------------------------------------------
// Page chrome — shell, not document.
//
// The generated document had no header, nav or logo, which is a straight
// regression against the classic renderer: a visitor landing on a Hubly
// Document page could not navigate it at all.
//
// Chrome is rendered AROUND the document rather than by it, deliberately. If
// the model wrote its own header, every site would get a differently-shaped
// one — a different logo treatment, a different nav, a different idea of where
// the phone number goes — and the one part of a site that most benefits from
// being consistent and predictable would become the most variable. It would
// also be the part most likely to be quietly wrong, since the model does not
// know which sections exist until it has finished writing them.
//
// So the nav is DERIVED from the finished document: the top-level sections
// that actually exist, in the order the model put them, minus the hero. The
// model never names a nav item and cannot invent one that goes nowhere.
// ---------------------------------------------------------------------------

const NAV_MAX_ITEMS = 5;
/** Ids whose sentence-case form reads badly or wrongly in a nav. */
const NAV_LABEL_OVERRIDES: Record<string, string> = {
  faq: "FAQ",
  faqs: "FAQ",
  "how-it-works": "How it works",
  "service-area": "Service area",
  "closing-cta": "Get started",
  inquire: "Enquire",
};

/** "how-mobile-grooming-works" -> "How mobile grooming works". Never invented,
 *  always derived from an id that already exists in the rendered page. */
function navLabel(id: string): string {
  const key = id.toLowerCase();
  if (NAV_LABEL_OVERRIDES[key]) return NAV_LABEL_OVERRIDES[key];
  const words = key.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type NavItem = { id: string; label: string };

function deriveNav(root: HublyDocumentNode): NavItem[] {
  const kids = Array.isArray(root.children) ? root.children : [];
  const items: NavItem[] = [];
  for (const child of kids) {
    if (child.tag !== "section" && child.tag !== "article") continue;
    const id = String(child.id || "");
    // The hero is where the visitor already is; a nav link to it is noise.
    if (!id || /^hero\b/i.test(id)) continue;
    const label = navLabel(id);
    // A nav item long enough to wrap is worse than no nav item.
    if (!label || label.length > 24) continue;
    items.push({ id, label });
    if (items.length >= NAV_MAX_ITEMS) break;
  }
  return items;
}

/** Two initials from the business name, as a stand-in until a real logo is
 *  uploaded. Deliberately not a generated image — an invented mark is worse
 *  than an honest monogram. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderChromeHeader(root: HublyDocumentNode, ctx: RenderContext): string {
  const name = ctx.businessName || "";
  const nav = deriveNav(root)
    .map((n) => `<a class="hd-nav-link" href="#${escAttr(ANCHOR_PREFIX + n.id)}">${escHtml(n.label)}</a>`)
    .join("");
  const phone = ctx.businessPhone
    ? `<a class="hd-chrome-phone" href="tel:${escAttr(ctx.businessPhone)}">${escHtml(ctx.businessPhone)}</a>`
    : "";
  // hubly:booking is resolved by wireHublyDocumentReserved in hubly.html —
  // it opens the same real booking wizard the classic renderer uses.
  const cta = `<a class="hd-chrome-cta" href="hubly:booking">Book now</a>`;
  return `<header class="hd-chrome-header">
<a class="hd-brand" href="#hd-top"><span class="hd-monogram">${escHtml(monogram(name))}</span><span class="hd-brand-name">${escHtml(name)}</span></a>
<nav class="hd-nav">${nav}</nav>
<div class="hd-chrome-actions">${phone}${cta}</div>
</header>`;
}

function renderChromeFooter(ctx: RenderContext): string {
  const name = ctx.businessName || "";
  const phone = ctx.businessPhone
    ? `<a class="hd-foot-link" href="tel:${escAttr(ctx.businessPhone)}">${escHtml(ctx.businessPhone)}</a>`
    : "";
  return `<footer class="hd-chrome-footer">
<div class="hd-foot-name">${escHtml(name)}</div>
<div class="hd-foot-meta">${phone}</div>
</footer>`;
}

export function renderHublyDocument(document: HublyDocument, ctx: RenderContext): string {
  const raw = (ctx.businessBrandColor || "").trim();
  const brand = HEX_COLOR_RE.test(raw) ? raw : FALLBACK_BRAND_COLOR;
  const styleBlock = `<style>#hc-doc-root{--brand:${brand}}</style>`;
  return styleBlock +
    renderChromeHeader(document.root, ctx) +
    `<div id="hd-top" class="hd-doc-body">` + renderNode(document.root, ctx) + `</div>` +
    renderChromeFooter(ctx);
}

// ---------------------------------------------------------------------------
// Prompt block — generated from the real schema constants above, never
// hand-duplicated prose. Same discipline as buildCapabilitiesPromptBlock in
// the capability registry: what the model is told and what the validator
// enforces must never be able to drift apart, because they're the same
// source.
// ---------------------------------------------------------------------------

export function buildDocumentSchemaPromptBlock(): string {
  // Second line of defence behind tests/hubly-document-vocabulary.test.mjs.
  // Logged rather than thrown: a prompt-wording gap should not take a live
  // generation down, but it must never again be able to sit there unnoticed
  // for months. This fires once per generation, into the function logs.
  const coverage = verifyVocabularyCoverage();
  if (coverage.length) {
    console.error(`hubly-document vocabulary drift (${coverage.length}):`, coverage.slice(0, 8).join(" | "));
  }
  const tags = [...ALLOWED_TAGS].join(", ");
  const reserved = [...HUBLY_RESERVED_TAGS].join(", ");
  return `HUBLY DOCUMENT FORMAT — the only output shape you may produce.

You are not writing JSX or HTML. You are producing a JSON tree of nodes. Each node:
{ "id": "<stable dotted path, e.g. hero.headline>", "tag": "<one allowed tag>", "attrs": { "class": "<space-separated utility tokens>", ... }, "children": [<nodes>] | "<text>", "reasoning": { "source": "ai", "reason": "<why, one short sentence>", "confidence": 0-1 } }

Return the ROOT node only (a single object), not an array, not wrapped in another key.

ALLOWED TAGS (nothing else will be accepted): ${tags}
Never: script, style, iframe, form, input, button, or any "on*"/"style" attribute — these are rejected outright, not filtered.

RESERVED HUBLY ELEMENTS (you configure appearance only, never behavior): ${reserved}
Never write your own <form> or interactive markup for these — place the reserved element instead. Their real data and functionality are Hubly's, not yours to invent. What each one actually is:
- HublyBooking — Hubly's real, working online booking system: the customer picks a service, sees genuine availability, and books. It is fully built and live. It does NOT need services, prices or opening hours to exist before you place it — the owner sets those up right after this page is generated, and the element handles the not-yet-configured state itself. The question to ask is "does this business take appointments or jobs?", not "have the services been entered yet". For any business that books work in — grooming, detailing, trades, salons, photography, cleaning — booking is the thing that earns them money, and a page without it sends a ready customer away to find a phone number.
- HublyContactForm — a real working enquiry form. Submissions land on the owner's leads board. Right for open-ended or quote-first enquiries ("tell me about your wedding date", "how big is the job?"), and for a business where the first step genuinely is a conversation rather than a booking.
- HublyReviews — real customer reviews once connected. Shows an honest empty state until then.
- HublyMap — the service area, once an address exists. Honest empty state until then.
- HublyCustomerPortal — sign-in for existing customers. Only for businesses with ongoing client relationships.
Booking and the contact form are not alternatives to each other and a page may carry both: booking for the customer who already knows what they want, the form for the one who has a question first. Choose on what this business's customers need — not on how much data happens to exist at this moment.

STYLING — every value must be one of these exact tokens (space-separated in "class"), nothing invented:
${buildStylingPromptBlock()}
- Responsive: prefix any of the above with sm:/md:/lg: for breakpoint variants
Class tokens not on this list are rejected, not approximated — pick the closest real token.

IMAGES: <img> requires both "src" and "alt". "src" must be a real, already-uploaded Hubly asset URL you were given — never invent a URL.
LINKS: <a href> accepts a real URL, tel:, an in-page "#anchor", or the reserved schemes hubly:booking / hubly:contact for built-in flows. Never "javascript:" or an invented href. mailto: is NOT accepted, and neither are links to Calendly, Google Forms, Typeform, Acuity or similar.

CAPTURING INTENT — the rule this page exists to satisfy:
Everything on this page that captures what a customer WANTS must route into Hubly. A visitor who books, enquires or asks a question has to end up as a real lead the business can see and follow up. An enquiry that arrives as an email or a phone call is a lead Hubly never learns about — no record, no reminder, nothing to chase.
- The primary call to action in any section that asks the visitor to act MUST be a HublyBooking or HublyContactForm element, or an <a href="hubly:booking"> / <a href="hubly:contact"> link. Never a mailto:, never an external form.
- A phone number is fine as INFORMATION — in a header, a footer, beside a form ("or call us on ..."). It must not be the only or the primary way to make contact.
- Every page you generate must contain at least one HublyBooking or HublyContactForm. This is enforced by the validator, not a preference: a document without one is rejected.

STRUCTURE: exactly one <h1> in the whole document — the hero headline. Every node needs a stable, human-readable "id" — dotted path convention, e.g. "services.item-2.title". You choose ids; the system deduplicates automatically, so don't worry about collisions.

REASONING: on nodes where you made a real design choice (not on every trivial span), include "reasoning": {"source":"ai","reason":"<one sentence, honest, specific>","confidence":<0-1>}. This isn't decoration — it's what lets you explain your own choices later if asked "why is this here."`;
}

/** Standard approach for document_generate (see generateAndValidateDocument)
 *  as of 2026-08-06 — adopted after a real benchmark comparing it against
 *  reasoningEffort:"medium": designRationale moved the actual measured
 *  target (cross-business class-usage overlap, 65.1% -> 58.2%) further
 *  than the 45%-costlier reasoning bump did (which only reached 62.8%),
 *  while running at or below the baseline's cost/latency — the model's
 *  differentiation reasoning was already available almost for free once
 *  asked for explicitly in-band, not hiding behind a reasoning-token
 *  budget it wasn't using anyway (confirmed empirically: ~1% of
 *  completion tokens were reasoning tokens under the shipped "low"
 *  setting, before this change).
 *
 *  Kept separate from buildDocumentSchemaPromptBlock() (patchDocument
 *  doesn't use this — forcing a full rationale on a small targeted edit
 *  isn't what was tested or approved). */
export function buildDesignRationaleInstructions(): string {
  return `\n\nBEFORE you decide on the page's structure, think through — in your own words, as real text in the "designRationale" field below — what makes THIS business's page different from a generic template: which sections it actually needs (and which common ones it doesn't), what the visual/structural approach should emphasize given its specific character, and at least one deliberate way this page should NOT look like a default template. This includes deciding whether each reserved Hubly element (booking, reviews, contact form, map, customer portal) genuinely belongs on this page — only include one because your own stated reasoning justifies it for THIS business, never by default or because a similar business would typically have one; if you include one, your designRationale must say why. Justify it on what this business's customers need to do, NOT on how much data has been entered so far — a booking element is not unjustified merely because services and prices have not been filled in yet, since the owner does that immediately after this page is built. Then apply that reasoning when you build the tree.\n\nReturn a single JSON object: { "designRationale": "<3-6 sentences, your real reasoning, specific to this business>", "root": <the root node, exactly as specified above> } — "root" must still be exactly the ROOT node shape described above. Nothing else in the response.`;
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

/**
 * WHAT A PATCH ACTUALLY DID — measured, not asserted.
 *
 * patchDocument used to report `ok: true, "Real edit applied"` whenever the ops
 * applied cleanly and the row saved. Neither of those facts means the owner's
 * page changed. An op that targets a real-but-wrong node applies perfectly. An
 * update_attrs that sets a class already present applies perfectly. A request
 * the format cannot express at all — "make the background black", when there is
 * no page-background knob — becomes some op that applies perfectly and does
 * nothing visible.
 *
 * The result was the worst failure this system can have: three exchanges, three
 * confident "Done"s, and an unchanged page. An owner who is told their site
 * changed and then looks at it has been given something worse than a refusal.
 *
 * So the handler now diffs the tree it started from against the tree it
 * produced, and reports what genuinely moved. No change means no success
 * message.
 */
export type PatchEffect = {
  changed: boolean;
  removed: { id: string; tag: string; label: string }[];
  added: { id: string; tag: string; label: string }[];
  textChanged: { id: string; from: string; to: string }[];
  attrsChanged: { id: string; keys: string[] }[];
};

/** First readable text inside a node — what a person would call it. */
function nodeLabel(n: HublyDocumentNode, depth = 0): string {
  if (typeof n.children === "string") return n.children.trim().slice(0, 80);
  if (depth > 5 || !Array.isArray(n.children)) return "";
  for (const c of n.children) {
    const t = nodeLabel(c, depth + 1);
    if (t) return t;
  }
  return "";
}

function indexById(
  n: HublyDocumentNode,
  into: Map<string, HublyDocumentNode>,
  parents?: Map<string, string | null>,
  parentId: string | null = null,
): Map<string, HublyDocumentNode> {
  into.set(n.id, n);
  parents?.set(n.id, parentId);
  if (Array.isArray(n.children)) for (const c of n.children) indexById(c, into, parents, n.id);
  return into;
}

/** True when an ancestor of `id` is itself in `gone`. Removing a section also
 *  removes its heading; reporting both as separate removals is noise that
 *  makes a real mistake harder to spot, not easier. */
function hasRemovedAncestor(id: string, parents: Map<string, string | null>, gone: Set<string>): boolean {
  let p = parents.get(id) ?? null;
  while (p) {
    if (gone.has(p)) return true;
    p = parents.get(p) ?? null;
  }
  return false;
}

export function describePatchEffect(before: HublyDocumentNode, after: HublyDocumentNode): PatchEffect {
  const aParents = new Map<string, string | null>();
  const bParents = new Map<string, string | null>();
  const a = indexById(before, new Map(), aParents);
  const b = indexById(after, new Map(), bParents);
  const effect: PatchEffect = { changed: false, removed: [], added: [], textChanged: [], attrsChanged: [] };

  const goneIds = new Set([...a.keys()].filter((id) => !b.has(id)));
  const newIds = new Set([...b.keys()].filter((id) => !a.has(id)));
  for (const id of goneIds) {
    if (hasRemovedAncestor(id, aParents, goneIds)) continue; // reported via its ancestor
    const node = a.get(id)!;
    effect.removed.push({ id, tag: node.tag, label: nodeLabel(node) });
  }
  for (const id of newIds) {
    if (hasRemovedAncestor(id, bParents, newIds)) continue; // reported via its ancestor
    const node = b.get(id)!;
    effect.added.push({ id, tag: node.tag, label: nodeLabel(node) });
  }
  for (const [id, oldNode] of a) {
    const newNode = b.get(id);
    if (!newNode) continue;
    if (typeof oldNode.children === "string" && typeof newNode.children === "string" && oldNode.children !== newNode.children) {
      effect.textChanged.push({ id, from: oldNode.children.slice(0, 80), to: newNode.children.slice(0, 80) });
    }
    const keys = new Set([...Object.keys(oldNode.attrs || {}), ...Object.keys(newNode.attrs || {})]);
    const diff = [...keys].filter((k) => (oldNode.attrs || {})[k] !== (newNode.attrs || {})[k]);
    if (diff.length) effect.attrsChanged.push({ id, keys: diff });
  }
  // Counted from the raw id sets, not the de-duplicated report: a change is
  // a change even when its description rolls up into an ancestor.
  effect.changed = !!(goneIds.size || newIds.size || effect.textChanged.length || effect.attrsChanged.length);
  return effect;
}

/** Plain-language description of a real change, for the owner. Concrete on
 *  purpose: "removed the section 'Ready to make grooming easier'" lets someone
 *  catch a wrong removal immediately, where a generic "Done" hides it. */
export function humanPatchSummary(effect: PatchEffect): string {
  const parts: string[] = [];
  for (const r of effect.removed.slice(0, 3)) {
    parts.push(r.label ? `removed the ${r.tag === "section" ? "section" : r.tag} "${r.label}"` : `removed a ${r.tag}`);
  }
  for (const x of effect.added.slice(0, 3)) {
    parts.push(x.label ? `added "${x.label}"` : `added a ${x.tag}`);
  }
  for (const t of effect.textChanged.slice(0, 3)) {
    parts.push(`changed the text "${t.from}" to "${t.to}"`);
  }
  if (effect.attrsChanged.length) {
    const styling = effect.attrsChanged.filter((c) => c.keys.includes("class")).length;
    if (styling) parts.push(`restyled ${styling} element${styling === 1 ? "" : "s"}`);
  }
  const extra = effect.removed.length + effect.added.length + effect.textChanged.length - 9;
  if (extra > 0) parts.push(`and ${extra} more change${extra === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "no visible change";
}

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
