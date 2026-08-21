/**
 * Put real images on a generated page — the model marks WHERE and WHAT FOR,
 * this pass decides WITH WHAT. Same split as the booking CTA: the model emits
 * a sentinel, Hubly resolves it. The model does layout; Hubly does sourcing.
 *
 * MARKERS the model emits (see the generation prompt):
 *   <img src="#hubly-logo" alt="...">                     the business's logo
 *   <img src="#hubly-image" data-role="hero"
 *        data-subject="a premium dark close shot of a
 *        detailed car, no people" alt="...">              a content image
 *
 * PRIORITY, non-negotiable and enforced here rather than asked for:
 *   1. THE CUSTOMER'S OWN PHOTOS. Always, whenever they exist. Free to licence,
 *      specific, theirs. A stranger's roof presented as this business's roof is
 *      a lie, so this is not a nicety — it is the line.
 *   2. PEXELS — atmosphere only, fills gaps.
 *   3. A DELIBERATE NOTHING — a colour field drawn from the business's own brand
 *      colour, never a grey box, never a broken frame.
 *
 * TWO RULES, STRUCTURAL (a property of this code, not a hope about a prompt):
 *   - STOCK IS ATMOSPHERE, NEVER THE BUSINESS'S OWN WORK. A marker whose role is
 *     a work role (gallery, portfolio, work, before/after, results, case study)
 *     is filled from CUSTOMER photos or from nothing — never stock. Putting a
 *     stranger's work on the page as this business's work is the lie above.
 *   - NO RECOGNISABLE PEOPLE IN STOCK. Free platforms don't verify model
 *     releases; the liability lands on our customer. Every stock query carries a
 *     no-people constraint, and a candidate whose own description names a person
 *     is rejected. (Honest limit: a photo with a person and a sparse description
 *     can still slip; documented, not hidden.)
 *
 * METADATA: every placed image is recorded in placed_images — provider, asset
 * id, photographer, source url, licence, business id, slot — so "where did this
 * come from?" is a query and a takedown is actionable.
 *
 * COST: zero extra model calls. The purpose ("what for") is emitted inline by
 * the model as it writes the page, exactly like the booking sentinel — so
 * planning every image on the page costs nothing beyond generation itself.
 */

import { scanHtml, spliceAll, type ScannedEl, type Splice } from "./hubly_html_scan.ts";

export const IMAGE_SENTINEL = "#hubly-image";
export const LOGO_SENTINEL = "#hubly-logo";

/** Roles where an image IS the business's own work — stock is forbidden. */
const WORK_ROLES = new Set(["gallery", "portfolio", "work", "before-after", "beforeafter", "results", "case", "casestudy", "project", "projects"]);

/** Words that mean a person is in frame; reject a stock candidate that names one. */
const PERSON_WORDS = /\b(person|people|man|woman|men|women|boy|girl|child|kid|guy|lady|face|smiling|smile|portrait|selfie|model|worker|team|staff|hand|hands|couple|family|crowd|human)\b/i;

export interface CustomerPhoto {
  url: string;
  kind: string;
  caption?: string | null;
}

export interface ImageResolveContext {
  businessId: string;
  documentVersion?: number;
  brandColor?: string | null;
  logoUrl?: string | null;
  photos: CustomerPhoto[];
  businessType?: string | null;
  businessName?: string | null;
  /** Injected so the resolver is testable without network or a live DB. */
  fetchStock?: (query: string) => Promise<StockResult | null>;
  recordPlacement?: (row: PlacedImageRow) => Promise<void> | void;
}

export interface StockResult {
  url: string;
  assetId: string;
  photographer: string;
  sourceUrl: string;
  license: string;
  description: string;
}

export interface PlacedImageRow {
  businessId: string;
  documentVersion?: number;
  provider: "customer" | "pexels";
  assetId?: string | null;
  photographer?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  imageUrl: string;
  slot: string;
  role: string;
  alt: string;
}

export interface ImageResolveResult {
  html: string;
  placed: PlacedImageRow[];
  /** Markers that resolved to a deliberate-nothing colour field. */
  blanks: number;
  /** Diagnostic: what each marker became. */
  decisions: { role: string; outcome: "customer" | "pexels" | "logo" | "blank"; subject: string }[];
}

function attrOf(el: ScannedEl, name: string): string {
  return (el.attrs[name] || "").trim();
}

function escAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isImageMarker(el: ScannedEl): boolean {
  return el.name === "img" && attrOf(el, "src").startsWith(IMAGE_SENTINEL);
}
function isLogoMarker(el: ScannedEl): boolean {
  return el.name === "img" && attrOf(el, "src").startsWith(LOGO_SENTINEL);
}

/** The colour-field treatment for a deliberate nothing. Brand-derived, never grey. */
function blankField(brand: string | null | undefined, alt: string, extraStyle: string): string {
  const c = brand && /^#[0-9a-f]{3,8}$/i.test(brand) ? brand : "#1a3a6e";
  // A soft diagonal wash of the brand colour into a darker shade of itself, with
  // the alt text as a faint watermark so the space reads as intentional.
  return `<div class="hubly-img-blank" role="img" aria-label="${escAttr(alt)}" ` +
    `style="${extraStyle}background:linear-gradient(135deg, ${escAttr(c)}, rgba(0,0,0,.55));` +
    `display:flex;align-items:center;justify-content:center;min-height:180px;color:rgba(255,255,255,.32);` +
    `font-family:inherit;font-size:13px;letter-spacing:.08em;text-transform:uppercase;text-align:center;padding:24px;">` +
    `${escAttr(alt).slice(0, 60)}</div>`;
}

/** Copy the marker's non-src attributes onto a real <img>. */
function realImg(el: ScannedEl, url: string): string {
  const keep = ["class", "style", "width", "height", "loading", "id"];
  const attrs = keep
    .map((k) => (el.attrs[k] != null ? ` ${k}="${escAttr(el.attrs[k])}"` : ""))
    .join("");
  const alt = escAttr(attrOf(el, "alt"));
  return `<img src="${escAttr(url)}"${attrs} alt="${alt}" loading="lazy">`;
}

export async function resolveImages(html: string, ctx: ImageResolveContext): Promise<ImageResolveResult> {
  const src = String(html || "");
  const scan = scanHtml(src);
  const edits: Splice[] = [];
  const placed: PlacedImageRow[] = [];
  const decisions: ImageResolveResult["decisions"] = [];
  let blanks = 0;

  // Customer photos are a consumable pool — each is used once, so a two-photo
  // business does not show the same van three times as three distinct pieces of
  // work. WORK-role markers get first claim on the pool: a "gallery" or "our
  // work" section is exactly where the business's own photos belong, and stock
  // is forbidden there, so a customer photo spent on the hero instead would
  // leave the work section empty. So we allocate the pool to work markers first,
  // then to atmosphere markers, before touching stock.
  const pool = [...(ctx.photos || [])].filter((p) => p && p.url);
  const imgMarkers = scan.all.filter((e) => isImageMarker(e));
  const claimed = new Map<ScannedEl, CustomerPhoto>();
  {
    const workFirst = [
      ...imgMarkers.filter((e) => WORK_ROLES.has((attrOf(e, "data-role") || "").toLowerCase())),
      ...imgMarkers.filter((e) => !WORK_ROLES.has((attrOf(e, "data-role") || "").toLowerCase())),
    ];
    let i = 0;
    for (const el of workFirst) {
      if (i >= pool.length) break;
      claimed.set(el, pool[i++]);
    }
  }

  for (const el of scan.all) {
    // ---- LOGO ----
    if (isLogoMarker(el)) {
      if (ctx.logoUrl) {
        edits.push({ start: el.openStart, end: el.openEnd, text: realImg(el, ctx.logoUrl) });
        placed.push({ businessId: ctx.businessId, documentVersion: ctx.documentVersion, provider: "customer", imageUrl: ctx.logoUrl, slot: "logo", role: "logo", alt: attrOf(el, "alt") || (ctx.businessName || "logo") });
        decisions.push({ role: "logo", outcome: "logo", subject: "" });
      } else {
        // No logo on file: remove the marker so the header's own text/monogram
        // shows. A missing logo is the ONLY case a monogram is acceptable.
        edits.push({ start: el.openStart, end: el.openEnd, text: "" });
        decisions.push({ role: "logo", outcome: "blank", subject: "" });
      }
      continue;
    }
    if (!isImageMarker(el)) continue;

    // ---- CONTENT IMAGE ----
    const role = (attrOf(el, "data-role") || "section").toLowerCase();
    const subject = attrOf(el, "data-subject") || attrOf(el, "alt") || `${ctx.businessType || "local business"}`;
    const alt = attrOf(el, "alt") || subject;
    const isWork = WORK_ROLES.has(role);
    // Preserve the container's own dimensions on the blank fallback.
    const inlineStyle = el.attrs.style ? `${el.attrs.style};` : "";

    // 1. CUSTOMER PHOTO — this marker's claim from the work-first allocation.
    const own = claimed.get(el);
    if (own) {
      edits.push({ start: el.openStart, end: el.openEnd, text: realImg(el, own.url) });
      placed.push({ businessId: ctx.businessId, documentVersion: ctx.documentVersion, provider: "customer", imageUrl: own.url, slot: role, role, alt });
      decisions.push({ role, outcome: "customer", subject });
      continue;
    }

    // 2. STOCK — atmosphere roles only, never a work role, only if configured.
    if (!isWork && ctx.fetchStock) {
      const query = `${subject} — no people`;
      let stock: StockResult | null = null;
      try { stock = await ctx.fetchStock(query); } catch { stock = null; }
      // Reject a candidate whose own description names a person.
      if (stock && PERSON_WORDS.test(stock.description || "")) stock = null;
      if (stock) {
        edits.push({ start: el.openStart, end: el.openEnd, text: realImg(el, stock.url) });
        placed.push({
          businessId: ctx.businessId, documentVersion: ctx.documentVersion, provider: "pexels",
          assetId: stock.assetId, photographer: stock.photographer, sourceUrl: stock.sourceUrl, license: stock.license,
          imageUrl: stock.url, slot: role, role, alt,
        });
        decisions.push({ role, outcome: "pexels", subject });
        continue;
      }
    }

    // 3. DELIBERATE NOTHING — a brand-coloured field, not a grey box.
    edits.push({ start: el.openStart, end: el.openEnd, text: blankField(ctx.brandColor, alt, inlineStyle) });
    blanks++;
    decisions.push({ role, outcome: "blank", subject });
  }

  const out = edits.length ? spliceAll(src, edits) : src;

  if (ctx.recordPlacement) {
    for (const row of placed) { try { await ctx.recordPlacement(row); } catch { /* provenance write must not fail a build */ } }
  }

  return { html: out, placed, blanks, decisions };
}

/**
 * Pexels fetcher. Gated on PEXELS_API_KEY; returns null when absent so the
 * resolver falls through to the deliberate-nothing treatment rather than
 * erroring. Landscape orientation and a no-people query are the structural
 * bias; the description filter in the resolver is the second line.
 */
export function pexelsFetcher(apiKey: string | null | undefined): ((query: string) => Promise<StockResult | null>) | undefined {
  if (!apiKey) return undefined;
  return async (query: string): Promise<StockResult | null> => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as { photos?: PexelsPhoto[] } | null;
    const photos = json?.photos || [];
    // First candidate whose alt text does not name a person.
    for (const p of photos) {
      if (PERSON_WORDS.test(p.alt || "")) continue;
      return {
        url: p.src?.landscape || p.src?.large || p.src?.original || "",
        assetId: String(p.id),
        photographer: p.photographer || "",
        sourceUrl: p.url || "",
        license: "Pexels License (https://www.pexels.com/license/)",
        description: p.alt || "",
      };
    }
    return null;
  };
}

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  alt: string;
  src: { original?: string; large?: string; landscape?: string };
}
