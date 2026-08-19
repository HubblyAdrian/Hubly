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

/**
 * WHAT THE MODEL TRIED AND WAS REFUSED.
 *
 * The validator has always known this and always thrown it away. On 2026-08-17
 * eleven class families turned out to be valid-but-never-offered, and simply
 * naming them produced structurally different pages with zero renderer work —
 * which means the fence around the model was mostly imaginary, and nobody could
 * have known because nothing recorded where it was actually hitting.
 *
 * The model is the only interface here. There is no toolbar, no inspector, no
 * drag handle. Its vocabulary IS the product's ceiling, so the list of things
 * it reaches for and cannot have is the single most valuable signal about where
 * that ceiling sits. Collected structurally rather than by parsing error
 * strings, so it stays correct when the wording changes.
 */
export type VocabularyRejections = {
  classes: string[];
  tags: string[];
  attrs: string[];
};

function emptyRejections(): VocabularyRejections {
  return { classes: [], tags: [], attrs: [] };
}
export type ValidationResult =
  | { ok: true; document: HublyDocument; warnings: ValidationIssue[]; rejections: VocabularyRejections }
  | { ok: false; errors: ValidationIssue[]; rejections: VocabularyRejections };

// ---------------------------------------------------------------------------
// Grammar — the exact allowlist. Anything not named here is rejected.
// ---------------------------------------------------------------------------



// The closed four-section list (ALLOWED_DOCUMENT_SECTIONS / ALLOWED_SECTION_IDS)
// was removed on 2026-08-18. It prevented the Lehi failure by making the page
// too short to contain a repeated section -- a blunt instrument that also
// stopped a business with eight real things to say from saying them. The count
// was never the defect; sections carrying nothing were. See the Content Value
// Rule in validateHublyDocument and sectionCarriesContent below.

/**
 * THE TAG VOCABULARY — audited 2026-08-18.
 *
 * The rule this list is supposed to enforce is "no state Hubly manages". What
 * it had actually been enforcing was "no interactivity at all", and those are
 * not the same rule. The list also simply had not been revisited: it contained
 * `header` but not `footer`, `ul`/`ol` but no `dl`, and no table elements of
 * any kind, so a restaurant's opening hours had to be faked out of divs.
 *
 * HOW THIS WAS FOUND. Rejection logging over 13 builds produced exactly one
 * hit, because a closed grammar stated plainly in the prompt makes the model
 * self-censor rather than push. Handing it three deliberately ambitious briefs
 * and asking it to enumerate what it wanted and could not build produced 24
 * items and ZERO logged rejections — it attempted none of them. Everything
 * added below traces to that list.
 *
 * THE LINE, restated precisely:
 *   - Static presentation .................. allowed here
 *   - Browser-native behaviour, no script,
 *     no state we own (details/summary) .... allowed here
 *   - State Hubly manages (cart, lightbox,
 *     carousel, filters, modals) ........... a reserved element, never a tag
 *   - Anything executable .................. never, at any level
 *
 * `details`/`summary` is the case that proves the distinction was wrong: an
 * accordion FAQ is one of the most common small-business patterns, needs no
 * JavaScript, and holds no state Hubly is responsible for. The model named
 * those exact two tags as what it would have needed.
 */
import { logoShapeFor, type LogoShape } from "./hubly_image_dims.ts";
export type { LogoShape };

export const ALLOWED_TAGS = new Set([
  // Structure. `footer`/`nav`/`main` were the asymmetry: `header` was already
  // here, and `footer` is the one tag 13 builds actually got rejected for.
  "section", "div", "header", "footer", "nav", "main", "article", "aside",
  "figure", "figcaption", "hgroup", "address",
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Text
  "p", "span", "strong", "em", "blockquote", "q", "cite", "abbr",
  "small", "mark", "sub", "sup", "s", "del", "ins", "code", "pre", "time",
  // Lists. `dl`/`dt`/`dd` is the right shape for menus, spec lists and FAQs,
  // and its absence forced all three into generic divs.
  "ul", "ol", "li", "dl", "dt", "dd",
  // Tables — wanted by two of the three briefs (opening hours, pricing
  // comparison). Entirely static, entirely semantic, and previously absent.
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td",
  "colgroup", "col",
  // Native disclosure. No script, no Hubly state — see the header comment.
  "details", "summary",
  // Media and inline SVG. See SVG_TAGS below for why the icon subset is
  // deliberately narrow.
  "a", "img", "video", "br", "hr", "wbr",
  "svg", "path", "circle", "rect", "line", "polyline", "polygon", "g",
]);

/** The inline-SVG subset, kept narrow ON PURPOSE.
 *
 *  SVG is the one addition here with a real attack surface: `<script>` and
 *  `<foreignObject>` inside an <svg> are script execution, and `<use>` can
 *  reference external documents. None of those appear above, so they are
 *  rejected as unknown tags before any attribute check runs — and the
 *  attribute allowlist below carries no href, no xlink, and no event handler
 *  (already impossible via HARD_BANNED_ATTR_RE). What is left is geometry and
 *  paint, which is inert. */
const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "g"]);

/** Opaque to the AI — configured presentationally, implemented by Hubly. */
export const HUBLY_RESERVED_TAGS = new Set([
  "HublyBooking", "HublyReviews", "HublyCustomerPortal", "HublyContactForm", "HublyMap",
  // Ported from the classic renderer on 2026-08-18. Real customers use the
  // classic ws-chat-widget today, and it had NO element in this schema at all —
  // so every site regenerated as a Document silently lost its chatbot. Backed by
  // the deployed chatbot-message function, exactly as classic is.
  "HublyChat",
]);

// True HTML voids only. SVG leaf elements are NOT listed here: they render as
// `<path ...></path>`, which is correct inside foreign content, whereas the
// void branch emits an unclosed tag.
const VOID_TAGS = new Set(["img", "video", "br", "hr", "wbr", "col"]);

// Attributes never allowed on any tag, regardless of anything else — checked
// before any tag-specific logic runs.
const HARD_BANNED_ATTR_RE = /^on|^style$/i;

/** Which attributes a given (non-reserved) tag may carry, beyond the
 *  universal `class` + `id`. */
const TAG_SPECIFIC_ATTRS: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt"],
  video: ["src"],
  // Static table semantics. colspan/rowspan/scope/headers carry no behaviour.
  th: ["colspan", "rowspan", "scope", "headers"],
  td: ["colspan", "rowspan", "headers"],
  col: ["span"],
  colgroup: ["span"],
  // `open` is an initial state written into the markup, not state Hubly keeps.
  details: ["open"],
  time: ["datetime"],
  abbr: ["title"],
  // Geometry and paint only — no href, no xlink, no external reference.
  svg: ["viewBox", "fill", "stroke", "stroke-width", "aria-hidden", "role", "width", "height"],
  path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule"],
  circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width"],
  rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width"],
  line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-linecap"],
  polyline: ["points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"],
  polygon: ["points", "fill", "stroke", "stroke-width"],
  g: ["fill", "stroke", "stroke-width", "transform"],
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
      "flex-1", "grow",
    ],
    prompt: `Flex: flex-row, flex-col, flex-wrap, items-{center,start,end}, justify-{center,between,start,end,around}, and flex-1 / grow to make a child take up the remaining space — pair grow with border-dotted for a leader line`,
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
    tokens: ["border", "border-2", "border-t", "border-b", "border-l", "border-r", "border-dotted", "border-dashed"],
    prompt: `Border: border, border-2 for all sides, border-{t,b,l,r} for one side, and border-dotted / border-dashed for the style. border-b alone is how you separate list rows without drawing boxes; grow + border-b + border-dotted on a spacer is how you get printed-menu leader lines between a dish name and its price`,
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
  {
    // Wanted by the storefront brief for a sticky nav and a sticky mobile bar.
    // Note the page chrome already renders a sticky header, so this is for
    // elements the document itself wants to pin.
    id: "sticky",
    tokens: ["sticky", "fixed", "top-0", "bottom-0", "left-0", "right-0", "z-10", "z-20", "z-30", "z-40", "z-50"],
    prompt: `Pinning: sticky, fixed with top-0/bottom-0/left-0/right-0 and z-{10,20,30,40,50} — for a bar that stays put while the page scrolls. The site header is already sticky and rendered for you; do not build another one`,
  },
  {
    // Wanted by two of three briefs: a draggable "recent weddings" strip and a
    // sideways-scrolling food gallery. Both were flattened into static grids.
    id: "horizontal-scroll",
    tokens: ["overflow-x-auto", "overflow-y-auto", "snap-x", "snap-mandatory", "snap-start", "snap-center", "shrink-0"],
    prompt: `Horizontal scrolling: overflow-x-auto with snap-x, snap-mandatory and snap-start/snap-center on the children, plus shrink-0 so items keep their width — this is how you build a sideways-scrolling strip of photos or cards instead of flattening it into a grid`,
  },
  {
    // Wanted by the portfolio brief. A masonry gallery was approximated as a
    // rigid grid because no column utility existed.
    id: "columns",
    tokens: ["columns-2", "columns-3", "columns-4", "break-inside-avoid"],
    prompt: `Masonry: columns-{2,3,4} with break-inside-avoid on each child — packs items of different heights, which a grid cannot do. Right for a photo gallery where the images are not all the same shape`,
  },
  {
    // Transitions are static declarations; only the hover: VARIANT below makes
    // them move, and that is CSS, not state.
    id: "transition",
    tokens: ["transition", "duration-150", "duration-300", "duration-500", "opacity-0", "opacity-50", "opacity-100", "scale-95", "scale-100", "scale-105", "translate-y-0", "translate-y-2", "translate-y-4"],
    prompt: `Motion: transition with duration-{150,300,500}, and opacity-{0,50,100}, scale-{95,100,105}, translate-y-{0,2,4} — combine with the hover: prefix below for a control that lifts, fades in or slides up under the cursor`,
  },
  {
    // Model-authored scaffolding needs a marker the renderer can act on. The
    // reserved empty states carry data-hd-placeholder; this is the equivalent
    // for the grey photo frames the model composes itself, and it is what makes
    // "suppress placeholders on the public page" possible without guessing
    // which grey box was scaffolding and which was a design choice.
    id: "placeholder",
    tokens: ["is-placeholder"],
    prompt: `Scaffolding: is-placeholder marks a block the OWNER will replace — an empty photo frame, a gallery waiting for real images. Put it on the frame itself. It keeps the block visible in the owner's builder preview and REMOVES it from the public page, so a stranger never lands on "photo goes here". Never put it on real copy.`,
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
// sm:/md:/lg: are breakpoints; hover:/focus: are interaction states. Both are
// pure CSS variants over the same base rules — no script, no state Hubly owns —
// so they belong on the vocabulary side of the line, not the component side.
// Their absence is why "reveal an Add to cart button on hover" came back as
// impossible when the visual half of it is one CSS rule.
const RESPONSIVE_PREFIXES = ["sm:", "md:", "lg:", "hover:", "focus:"];

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

function validateAttrs(tag: string, attrs: Record<string, unknown>, path: string, errors: ValidationIssue[], rejections?: VocabularyRejections): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, rawVal] of Object.entries(attrs || {})) {
    if (key === "id") continue; // id is handled separately
    if (HARD_BANNED_ATTR_RE.test(key)) {
      errors.push({ path, message: `attribute "${key}" is never allowed (behavior/style must go through validated class tokens)` });
      rejections?.attrs.push(`${tag}.${key}`);
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
      rejections?.attrs.push(`${tag}.${key}`);
      continue;
    }
    clean[key] = val;
  }
  for (const req of REQUIRED_ATTRS[tag] || []) {
    if (!clean[req]) errors.push({ path, message: `<${tag}> requires attribute "${req}"` });
  }
  return clean;
}

function validateReservedAttrs(tag: string, attrs: Record<string, unknown>, path: string, errors: ValidationIssue[], rejections?: VocabularyRejections): Record<string, string> {
  // Reserved elements accept only presentational hints — a small, named set
  // per element. Deliberately narrower than the open `class` grammar above:
  // these are configuration knobs for a real component, not free styling.
  const ALLOWED: Record<string, string[]> = {
    HublyBooking: ["variant", "class", "serviceId"],
    HublyChat: ["variant", "class"],
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

type WalkContext = { takenIds: Set<string>; h1Count: number; intentElementCount: number; errors: ValidationIssue[]; warnings: ValidationIssue[]; rejections: VocabularyRejections };

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
    ctx.rejections.tags.push(tag);
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
    ? validateReservedAttrs(tag, (r.attrs as Record<string, unknown>) || {}, nodePath, ctx.errors, ctx.rejections)
    : validateAttrs(tag, (r.attrs as Record<string, unknown>) || {}, nodePath, ctx.errors, ctx.rejections);

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
/** Does this section carry at least one concrete datum?
 *
 *  Deliberately structural rather than semantic: it asks what the section
 *  CONTAINS, not what it appears to be about, so it cannot be satisfied by
 *  confident-sounding copy. A prompt-only version of this rule would be, and
 *  the rule it replaced had to be enforced here for the same reason.
 *
 *  NUMBERS COUNT BY POSITION, NOT BY SIZE. The first version accepted any
 *  2+ digit token, which a year, a street number or a phone fragment satisfies
 *  — so an "about" section could pass on an incidental figure while carrying
 *  nothing a visitor can use. A bare number now only counts where its position
 *  makes it data: inside a list item or a table cell. Anywhere else it needs a
 *  currency symbol or a real unit next to it.
 */
function sectionCarriesContent(node: HublyDocumentNode): boolean {
  let listItems = 0;
  let found = false;

  // A figure that is unambiguous wherever it appears: money, or a number with
  // a unit attached. "$120", "2 hours", "25 miles", "15 min".
  const QUALIFIED_FIGURE = /(\$\s?\d|\d+\s?(hours?|hrs?|mins?|minutes?|miles?|km|days?|years?|%|sq\s?ft))/i;
  // A bare number, which only counts in a structured position.
  const BARE_NUMBER = /\d/;

  const walk = (n: HublyDocumentNode, inDataCell: boolean) => {
    if (found) return;
    // A real Hubly element is a working thing, not prose about one.
    if (HUBLY_RESERVED_TAGS.has(n.tag)) {
      // ...except HublyReviews, whose whole point when empty is to say nothing
      // is there. It cannot be the thing that justifies a section existing.
      if (n.tag !== "HublyReviews") { found = true; return; }
    }
    if (n.tag === "img" || n.tag === "video") { found = true; return; }
    if (n.tag === "table" || n.tag === "details" || n.tag === "dl") { found = true; return; }
    if (n.tag === "li") listItems++;
    if (listItems >= 2) { found = true; return; }

    // li / td / th / dd are positions where a number IS the content.
    const positional = inDataCell || n.tag === "li" || n.tag === "td" || n.tag === "th" || n.tag === "dd";

    if (typeof n.children === "string") {
      if (QUALIFIED_FIGURE.test(n.children)) { found = true; return; }
      if (positional && BARE_NUMBER.test(n.children)) { found = true; return; }
    } else if (Array.isArray(n.children)) {
      for (const c of n.children) { walk(c, positional); if (found) return; }
    }
  };
  walk(node, false);
  return found || listItems >= 2;
}

export function validateHublyDocument(raw: unknown, meta: { businessId: string; tag?: string; version: number; generatedBy: "ai" | "user" | "patch" }): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: [{ path: "$", message: "document must be an object" }], rejections: emptyRejections() };
  const r = raw as Record<string, unknown>;
  const rootRaw = r.root ?? raw; // tolerate a bare root node as input too
  const rejections = emptyRejections();
  const ctx: WalkContext = { takenIds: new Set(), h1Count: 0, intentElementCount: 0, errors, warnings, rejections };
  const root = walkAndValidate(rootRaw, "$", ctx);
  // THE CONTENT VALUE RULE — replaces the six-section limit, which is gone.
  //
  // The old rule capped the page at four sections. It stopped the Lehi failure
  // (Reassurance and Benefits both restating the hero) by making the page too
  // short to contain them, which is a blunt instrument: it also stopped a
  // business with eight real things to say from saying them.
  //
  // The real defect was never the COUNT. It was sections that carry nothing.
  // So the test is now structural and per-section: does this section contain at
  // least one concrete datum, or is it only headings and prose?
  //
  // Concrete means an actual thing a visitor can use — a price or number, a
  // list of two or more items, a table, an expandable question, an image, or a
  // real Hubly element. Two paragraphs of warm sentiment about the business is
  // not concrete, however well written.
  //
  // The hero is exempt: it is the one section whose job IS a statement.
  //
  // This is also what finally removes the empty reviews section. Placeholder
  // stripping already works -- measured on a live public page, 0 placeholders
  // and 0 empty islands survive -- but the model routes around it by NARRATING
  // the absence ("Reviews will appear here once we connect them"), which is
  // prose, so nothing removed it and it held 414px of a real customer's page.
  if (root && meta.generatedBy === "ai") {
    const kids = Array.isArray(root.children) ? root.children : [];
    const hollow: string[] = [];
    for (const child of kids) {
      if (child.tag !== "section" && child.tag !== "article") continue;
      const base = String(child.id || "").replace(/-\d+$/, "").toLowerCase();
      if (/^hero\b/.test(base)) continue;
      if (!sectionCarriesContent(child)) hollow.push(child.id);
    }
    if (hollow.length) {
      errors.push({
        path: "$",
        message:
          `these sections carry no concrete content and must be removed or filled: ${hollow.join(", ")}. A section earns its place with something a visitor can use — a price, a number, a list of two or more items, a table, an expandable question, an image, or a Hubly element. Headings and paragraphs about the business are not enough. If a section has nothing real yet (no reviews, no photos, no prices on record), DELETE IT rather than writing copy explaining that it is empty.`,
      });
    }
  }
  if (errors.length || !root) return { ok: false, errors, rejections };
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
  return { ok: true, document, warnings, rejections };
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
  /** businesses.logo_url — a real uploaded asset, never invented. When present
   *  it replaces the monogram in the page header. Absent is the normal state
   *  for a brand-new draft, which is why the monogram exists at all. */
  businessLogoUrl?: string;
  /** City, or the service-area cities, for the map embed. Classic builds the
   *  same query from `areaDisp.mapQuery || city || areaZips`. */
  businessMapQuery?: string;
  /** businesses.business_type — free text the model wrote ("landscaping",
   *  "mobile dog grooming"). Used ONLY to decide whether the header's primary
   *  action is a phone number or a booking pill, matched on word families. */
  businessType?: string;
  /** Width / height of the uploaded logo, measured from the asset's own header
   *  bytes at upload time (see hubly_image_dims.ts) and stored on
   *  website_meta.logoAspect. Absent means "unknown", which renders exactly as
   *  every site does today. Never estimated and never inferred from the URL. */
  businessLogoAspect?: number;
  /** businesses.website_meta.chrome — what the OWNER asked for, which beats
   *  anything derived. Set by website.setChrome, which is what "put the logo
   *  in the middle" and "make the logo bigger" resolve to. */
  chromeOverrides?: ChromeOverrides;
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
      // Scaffolding, not simulation. It describes what goes here and shows
      // nothing that could be mistaken for a review: no sample text, no
      // names, no avatars, no stars. A fake five-star row on a brand-new
      // business's page is a lie with a customer on the other end of it.
      //
      // data-hd-placeholder is what lets the PUBLIC page drop this while the
      // builder preview keeps it — see hd-public in hubly.html.
      return wrap(`<div class="hd-empty-island" data-hd-empty="reviews" data-hd-placeholder="1">
<p class="hd-ph-title">Space for real customer reviews</p>
<p class="hd-ph-sub">Once reviews come in through Hubly they appear here, in the customer's own words.</p>
</div>`);
    case "HublyCustomerPortal":
      return wrap(`<div class="hd-empty-island" data-hd-empty="portal" data-hd-placeholder="1"><p>Existing customers will be able to sign in here.</p></div>`);
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
    case "HublyMap": {
      // A REAL MAP, not a dashed island. Classic has rendered a Google embed
      // from city/service-area for as long as it has existed; this schema
      // rendered a placeholder saying a map would appear, which is what "the
      // map degraded to prose" meant. Same embed, same query construction.
      //
      // <iframe> is banned in the document grammar and stays banned — the model
      // cannot write one. The SHELL emits this, which is the whole point of a
      // reserved element: Hubly implements it, the AI only places it.
      const q = (ctx.businessMapQuery || "").trim();
      if (!q) {
        return wrap(`<div class="hd-empty-island" data-hd-empty="map" data-hd-placeholder="1"><p>A map of the service area appears here once an address is added.</p></div>`);
      }
      return wrap(`<div class="hd-map"><iframe title="Service area map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${escAttr(encodeURIComponent(q))}&z=11&output=embed"></iframe></div>`);
    }
    case "HublyChat":
      // Markup only; wireHublyDocumentReserved in hubly.html gives it behaviour,
      // talking to the same chatbot-message function classic uses. Rendered
      // collapsed so it never covers the page on arrival.
      return wrap(`<div class="hd-chat" data-hd-chat data-business-id="${escAttr(ctx.businessId)}">
<button type="button" class="hd-chat-launch" aria-expanded="false" aria-controls="hd-chat-panel">Ask a question</button>
<div class="hd-chat-panel" id="hd-chat-panel" hidden>
<div class="hd-chat-log" role="log" aria-live="polite"></div>
<form class="hd-chat-form" novalidate>
<input class="hd-chat-input" type="text" autocomplete="off" placeholder="Type your question…" aria-label="Your question">
<button class="hd-chat-send" type="submit">Send</button>
</form>
</div>
</div>`);
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

// ---------------------------------------------------------------------------
// CHROME VARIANTS
//
// The header is chrome, drawn by the shell, so the generator cannot vary it.
// That was the right call for sections — handing the header to the model would
// lose the validated logo handling and the booking CTA that actually work — but
// it meant the FIRST thing anyone saw was byte-identical on every business's
// site but for two initials. Three real generated headers, pulled from stored
// rendered_html: "PF", "TW", "LM", in the same rounded square, in the same bar,
// with the same pill on the right. It reads as templated because it is.
//
// So: not freedom, a vocabulary. The shell still owns every pixel; it just
// owns more than one arrangement of them, and picks between them from facts
// about the business rather than from randomness or the model's taste.
//
// THE SELECTION RULE, in precedence order. Every input is a real, observable
// property. Nothing here consults the model, and nothing is random — the same
// business always renders the same header, which is what makes "put the logo in
// the middle" a thing you can ask for rather than a thing you hope for.
//
//  0. OWNER OVERRIDE wins on any axis it sets (website_meta.chrome). This is
//     how "put the logo in the middle" and "make the logo bigger" work: they
//     select a variant, they do not restyle an element.
//  1. LOGO SHAPE, from the asset's own intrinsic aspect ratio, decides
//     placement and mark treatment:
//       none/monogram -> left      wordmark (>=2.2) -> left, and the name text
//       is suppressed because the mark already IS the name
//       wide          -> left      square           -> left
//       tall (<0.8)   -> stack     — a mark taller than it is wide cannot share
//       a horizontal bar without shrinking to nothing, so it gets its own row
//       above the nav
//  2. NAVIGABLE SECTION COUNT decides nav and sticky:
//       0-2 -> no nav, not sticky   (a two-link nav is noise, and a page this
//                                    short has no "back to the top" problem)
//       3-4 -> nav, not sticky
//       5+  -> nav, sticky          (long enough that you need the way back)
//     With no nav and a left logo the bar is a logo and a lot of empty space,
//     so a nav-less header centres its brand instead.
//  3. HERO DARKNESS decides solid vs transparent. If the first section paints
//     itself a dark or branded background, the header sits ON it rather than
//     above it in a white strip — read from the section's own class tokens,
//     which is the same information the browser uses.
//  4. BUSINESS TYPE decides the CTA. Trades people CALL get their phone number
//     as the primary action; trades people BOOK get the booking pill. Matched
//     on word families rather than exact strings, because business_type is
//     free text the model wrote.
// ---------------------------------------------------------------------------

export type ChromeLogoPlacement = "left" | "centre" | "stack";
export type ChromeLogoScale = "sm" | "md" | "lg";
export type ChromeHeaderStyle = "solid" | "transparent";
export type ChromeNavMode = "full" | "none";
export type ChromeCtaMode = "book" | "call";

export type ChromeVariant = {
  placement: ChromeLogoPlacement;
  scale: ChromeLogoScale;
  shape: LogoShape | "monogram";
  style: ChromeHeaderStyle;
  sticky: boolean;
  nav: ChromeNavMode;
  cta: ChromeCtaMode;
  /** True when the mark carries the name, so printing it again is duplication. */
  suppressName: boolean;
};

/** Owner-set overrides, from businesses.website_meta.chrome. Every field
 *  optional — an override sets one axis and leaves the rest derived. */
export type ChromeOverrides = {
  logoPlacement?: ChromeLogoPlacement;
  logoScale?: ChromeLogoScale;
  logoShape?: LogoShape;
  headerStyle?: ChromeHeaderStyle;
  sticky?: boolean;
  nav?: ChromeNavMode;
  cta?: ChromeCtaMode;
};

/** Trades where the customer's next move is a phone call, not a form. Word
 *  families rather than exact matches: business_type is free text. */
// STEM-PREFIXED, NOT WORD-BOUNDED. `/\broof\b/` does not match "roofing",
// which is what business_type actually contains, so the first version of this
// sent every trade to the booking pill and the whole CTA axis was dead. Stems
// only, with no trailing boundary, and chosen long enough not to collide
// ("towing" not "tow", which also matches "towel").
const CALL_FIRST_RE =
  /\b(?:plumb|hvac|heating|cooling|furnace|air.?condition|electric|roof|towing|locksmith|garage.?door|septic|pest|exterminat|glass|windshield|restoration|water.?damage|chimney|appliance|handyman|junk|hauling|moving|movers|tree.?(?:service|removal|trimming)|stump|paving|asphalt|concrete|excavat|drain|sewer|emergency|repair|fence|gutter|foundation|masonry|welding|septic)/i;

/** Trades where the customer books an appointment for a future date. Checked
 *  FIRST, because "dog grooming" and "mobile detailing" both contain words the
 *  call-first family also claims. */
const BOOK_FIRST_RE =
  /\b(?:groom|salon|spa\b|barber|massage|photograph|photo\b|videograph|tutor|lesson|yoga|pilates|dental|dentist|therapy|therapist|training|trainer|coach|nail|lash|brow|aesthet|clean|maid|housekeep|detail|wash|landscap|lawn|dog|cat\b|veterinar|catering|event|wedding|makeup|hair|chiropract|acupunct|wellness)/i;

function ctaModeFor(businessType: string | undefined, phone: string | undefined): ChromeCtaMode {
  if (!phone) return "book";                       // can't call what we don't have
  const t = (businessType || "").trim();
  if (!t) return "book";
  if (BOOK_FIRST_RE.test(t)) return "book";
  if (CALL_FIRST_RE.test(t)) return "call";
  return "book";
}

/** Dark-background tokens the generated hero can legitimately carry. Read from
 *  the class string because that is where the truth is — the same tokens the
 *  browser will act on. */
const DARK_HERO_RE = /\b(bg-(?:brand|ink-[6-9]00|black)|bg-gradient-to-\w+|from-(?:brand|ink-[6-9]00))/;

function heroIsDark(root: HublyDocumentNode): boolean {
  const kids = Array.isArray(root.children) ? root.children : [];
  for (const child of kids) {
    if (child.tag !== "section" && child.tag !== "article") continue;
    return DARK_HERO_RE.test(String(child.attrs?.class || ""));   // first section only
  }
  return false;
}

/**
 * The whole selection rule in one place, so it can be read, tested, and argued
 * with without rendering anything.
 */
export function selectChromeVariant(
  root: HublyDocumentNode,
  ctx: RenderContext,
): ChromeVariant {
  const o = ctx.chromeOverrides || {};
  const hasLogo = !!(ctx.businessLogoUrl || "").trim() && isValidMediaSrc((ctx.businessLogoUrl || "").trim());
  const derivedShape = hasLogo ? (o.logoShape || logoShapeFor(ctx.businessLogoAspect)) : null;
  const shape: LogoShape | "monogram" = hasLogo ? (derivedShape || "square") : "monogram";

  const navCount = deriveNav(root).length;
  const nav: ChromeNavMode = o.nav || (navCount >= 3 ? "full" : "none");

  let placement: ChromeLogoPlacement;
  if (o.logoPlacement) placement = o.logoPlacement;
  else if (shape === "tall") placement = "stack";
  else if (nav === "none") placement = "centre";
  else placement = "left";

  const style: ChromeHeaderStyle = o.headerStyle || (heroIsDark(root) ? "transparent" : "solid");
  const wantsSticky = typeof o.sticky === "boolean" ? o.sticky : navCount >= 5;

  return {
    placement,
    scale: o.logoScale || (shape === "wordmark" ? "md" : shape === "tall" ? "lg" : "md"),
    shape,
    style,
    // TRANSPARENT IMPLIES NOT STICKY, whatever anything else says.
    //
    // A transparent header is styled for the hero it sits on -- white type, a
    // white pill, no bar. Follow it down the page and it becomes white type on
    // white sections: a fixed, invisible header with a floating logo and a
    // button hovering over the contact form. Seen on the yoga studio's page,
    // which is how this rule got written rather than assumed.
    //
    // Solving it properly means swapping the header to solid on scroll, which
    // is JavaScript in the shell for a problem the layout can avoid: a header
    // that belongs to the hero belongs at the top. So the two are exclusive,
    // and this is deliberately not overridable -- an owner asking for both
    // would be asking for the broken one.
    sticky: style === "transparent" ? false : wantsSticky,
    nav,
    cta: o.cta || ctaModeFor(ctx.businessType, ctx.businessPhone),
    // A wordmark already spells the business out; printing the name beside it
    // is the same words twice at two sizes. Only true for a REAL wordmark, not
    // for an override that merely places a square mark centrally.
    suppressName: shape === "wordmark",
  };
}

function renderChromeHeader(root: HublyDocumentNode, ctx: RenderContext): string {
  const name = ctx.businessName || "";
  const v = selectChromeVariant(root, ctx);

  const navHtml = v.nav === "none"
    ? ""
    : deriveNav(root)
      .map((n) => `<a class="hd-nav-link" href="#${escAttr(ANCHOR_PREFIX + n.id)}">${escHtml(n.label)}</a>`)
      .join("");

  // hubly:booking is resolved by wireHublyDocumentReserved in hubly.html —
  // it opens the same real booking wizard the classic renderer uses.
  const cta = v.cta === "call" && ctx.businessPhone
    ? `<a class="hd-chrome-cta" href="tel:${escAttr(ctx.businessPhone)}">Call ${escHtml(ctx.businessPhone)}</a>`
    : `<a class="hd-chrome-cta" href="hubly:booking">Book now</a>`;
  // The secondary phone line is redundant when the CTA already IS the phone.
  const phone = ctx.businessPhone && v.cta !== "call"
    ? `<a class="hd-chrome-phone" href="tel:${escAttr(ctx.businessPhone)}">${escHtml(ctx.businessPhone)}</a>`
    : "";

  // A real logo replaces the monogram outright. The monogram was always a
  // stand-in — honest, but identical in shape on every site (PF, TW, LM) — and
  // the owner uploading their mark is the single most visible improvement a
  // generated page gets. Validated against the same storage origins as any
  // other asset so a logo_url cannot smuggle in an arbitrary remote image.
  const logo = (ctx.businessLogoUrl || "").trim();
  const mark = v.shape !== "monogram"
    ? `<img class="hd-logo" src="${escAttr(logo)}" alt="${escAttr(name)}">`
    : `<span class="hd-monogram">${escHtml(monogram(name))}</span>`;
  const brandName = v.suppressName ? "" : `<span class="hd-brand-name">${escHtml(name)}</span>`;
  const brand = `<a class="hd-brand" href="#hd-top">${mark}${brandName}</a>`;

  const cls = [
    "hd-chrome-header",
    `hd-h-${v.placement}`,
    `hd-h-${v.style}`,
    `hd-mark-${v.shape}`,
    `hd-logo-${v.scale}`,
    v.sticky ? "hd-h-sticky" : "hd-h-static",
    v.nav === "none" ? "hd-h-nonav" : "",
  ].filter(Boolean).join(" ");

  const actions = `<div class="hd-chrome-actions">${phone}${cta}</div>`;

  // `stack` is a genuinely different DOM order, not the same row re-flowed:
  // the mark owns a row, and the nav and actions share the one beneath it.
  // Trying to express that with flex-wrap on the single-row markup put the CTA
  // above the nav at some widths and below it at others.
  if (v.placement === "stack") {
    return `<header class="${cls}">
<div class="hd-h-row-brand">${brand}</div>
<div class="hd-h-row-nav"><nav class="hd-nav">${navHtml}</nav>${actions}</div>
</header>`;
  }

  return `<header class="${cls}">
${brand}
<nav class="hd-nav">${navHtml}</nav>
${actions}
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
Never: script, style, iframe, form, input, select, button, textarea, dialog, canvas, or any "on*"/"style" attribute — these are rejected outright, not filtered.

WHAT THE TAGS ABOVE LET YOU DO — several of these are new and easy to overlook:
- <details> + <summary> — a real expand/collapse. THIS IS HOW YOU BUILD AN ACCORDION FAQ. It needs no JavaScript and is fully supported. Put the question in <summary> and the answer in the <details> after it. Add open="true" to the first one if you want it expanded on arrival. Use this instead of stacking every answer permanently on the page.
- <table>, <thead>, <tbody>, <tr>, <th>, <td>, <caption> — real tabular data. Opening hours, a price list, a package comparison with a column per tier. Use a table when the content IS a table; do not fake one out of divs and do not use one for page layout.
- <dl>, <dt>, <dd> — a term-and-description list. The right shape for a menu (dish then description), a spec list, or short Q&A that does not need collapsing.
- <svg> with <path>, <circle>, <rect>, <line>, <polyline>, <polygon>, <g> — real inline icons. Ticks, crosses, stars, arrows, dietary or spice markers. Write the path data yourself; keep icons simple and set aria-hidden="true" on decorative ones. This replaces using emoji as interface icons.
- <footer>, <nav>, <main>, <hgroup>, <address> — real page structure. NOTE: the site header, its navigation and the page footer are rendered around your document automatically. Do not build a second site-wide header or footer; use <footer> for section-level footers and <nav> for in-page jump links only.
- <time datetime="...">, <small>, <mark>, <sub>, <sup>, <abbr title="...">, <s>, <del>, <ins>, <code>, <pre>, <q>, <cite>, <hr> — ordinary typography. <s> or <del> is how you show a struck-through original price.

STILL IMPOSSIBLE, and do not approximate it with markup that pretends otherwise: a shopping cart or any cart badge, an image lightbox, a carousel or auto-advancing slider, a modal or popup, filter or tab controls that change what is shown, a before/after drag slider, a date picker, anything that reacts to a click beyond following a link, and anything that depends on the current date or live data. These need real components Hubly has not built. If a brief asks for one, build the closest honest static version and say what you left out — never fake the interactive part.

RESERVED HUBLY ELEMENTS (you configure appearance only, never behavior): ${reserved}
Never write your own <form> or interactive markup for these — place the reserved element instead. Their real data and functionality are Hubly's, not yours to invent. What each one actually is:
- HublyBooking — Hubly's real, working online booking system: the customer picks a service, sees genuine availability, and books. It is fully built and live. It does NOT need services, prices or opening hours to exist before you place it — the owner sets those up right after this page is generated, and the element handles the not-yet-configured state itself. The question to ask is "does this business take appointments or jobs?", not "have the services been entered yet". For any business that books work in — grooming, detailing, trades, salons, photography, cleaning — booking is the thing that earns them money, and a page without it sends a ready customer away to find a phone number.
- HublyContactForm — a real working enquiry form. Submissions land on the owner's leads board. Right for open-ended or quote-first enquiries ("tell me about your wedding date", "how big is the job?"), and for a business where the first step genuinely is a conversation rather than a booking.
- HublyReviews — real customer reviews once connected. Shows an honest empty state until then.
- HublyMap — the service area, once an address exists. Honest empty state until then.
- HublyCustomerPortal — sign-in for existing customers. Only for businesses with ongoing client relationships.
- HublyChat — a real assistant that answers visitor questions about THIS business, backed by the business's own services and details. Place it once, near the end of the page; it renders as a collapsed launcher, not a panel that covers the content. Almost every service business benefits from it: it answers the questions that would otherwise be a phone call the owner has to take.
- HublyMap — a real embedded map of the service area. It renders an actual map when the business has a city or service-area on record, and an honest empty state when it does not. Place it in the service-area section.
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
    // Only the NEW value. Quoting both ran to ~180 characters for a headline
    // edit, and the old string is the one thing the person definitely already
    // knows -- they were looking at it a second ago.
    parts.push(`set the text to "${t.to}"`);
  }
  if (effect.attrsChanged.length) {
    const styling = effect.attrsChanged.filter((c) => c.keys.includes("class")).length;
    if (styling) parts.push(`restyled ${styling} element${styling === 1 ? "" : "s"}`);
    // Only `class` used to be reported here, so a dropped image — which changes
    // `src` and nothing else — summarised as "no visible change" on a patch
    // that visibly changed the page. That was tolerable while this string only
    // reached the logs; it stopped being tolerable when it became the sentence
    // the person reads back (CapabilityActionResult.humanNote).
    const media = effect.attrsChanged.filter((c) => c.keys.includes("src")).length;
    if (media) parts.push(`replaced ${media === 1 ? "an image" : media + " images"}`);
    const links = effect.attrsChanged.filter((c) => c.keys.includes("href")).length;
    if (links) parts.push(`repointed ${links} link${links === 1 ? "" : "s"}`);
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
