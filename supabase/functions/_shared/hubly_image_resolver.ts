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

import { scanHtml, spliceAll, ownText, innerText, type ScannedEl, type Splice } from "./hubly_html_scan.ts";

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
  // A soft diagonal wash of the brand colour into a darker shade of itself.
  //
  // THE ART-DIRECTION PHRASE IS NEVER SHOWN. It used to be watermarked into the
  // field, which put stage directions on the stage — a visitor read
  // "A CLEAN RESIDENTIAL ROOFLINE UNDER A DRAMATIC SKY" on the live page. The
  // phrase stays in the markup, on `data-art-direction`, for the owner and the
  // resolver; it is not rendered. What the visitor sees is a plain, deliberate
  // colour field — a design decision, not a note to self. A faint hairline
  // adds a little craft without saying anything.
  return `<div class="hubly-img-blank" role="presentation" aria-hidden="true" ` +
    `data-art-direction="${escAttr(alt)}" ` +
    `style="${extraStyle}min-height:200px;` +
    `background:linear-gradient(135deg, ${escAttr(c)} 0%, rgba(0,0,0,.45) 100%);` +
    `border:1px solid rgba(255,255,255,.06);border-radius:inherit;"></div>`;
}

/** Copy the marker's non-src attributes onto a real <img>. */
function realImg(el: ScannedEl, url: string): string {
  // NOT loading="lazy". A freeform page renders inside a srcdoc iframe, and lazy
  // loading there has no reliable intersection root — verified live: with lazy,
  // all three images (the in-view hero included) stayed unloaded and the hero
  // showed a blank white box; forcing eager loaded all three. The model may have
  // emitted a `loading` attribute of its own, so it is dropped from the keep
  // list too. A freeform page carries 2–3 images, so eager loading costs
  // nothing and lazy costs a broken hero.
  const keep = ["class", "style", "width", "height", "id"];
  let attrs = keep
    .map((k) => (el.attrs[k] != null ? ` ${k}="${escAttr(el.attrs[k])}"` : ""))
    .join("");
  // If the marker carries no intrinsic size, take it from the rendition URL's
  // w/h params (Pexels renditions are e.g. w=1200&h=627). Intrinsic width/height
  // let the browser reserve the aspect ratio before the image decodes, so the
  // layout doesn't shift as it lands. object-fit in the page CSS still governs
  // the displayed box, so these never distort the image.
  if (el.attrs["width"] == null && el.attrs["height"] == null) {
    const w = /[?&]w=(\d+)/.exec(url);
    const h = /[?&]h=(\d+)/.exec(url);
    if (w && h) attrs += ` width="${w[1]}" height="${h[1]}"`;
  }
  const alt = escAttr(attrOf(el, "alt"));
  return `<img src="${escAttr(url)}"${attrs} alt="${alt}">`;
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

    // 3. DELIBERATE NOTHING — a brand-coloured field, not a grey box. The
    //    art-direction phrase (subject) is stored on the div for the owner and a
    //    future stock retry, never shown.
    edits.push({ start: el.openStart, end: el.openEnd, text: blankField(ctx.brandColor, subject, inlineStyle) });
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
/**
 * COLLAPSE EMPTY IMAGE SLOTS — removal only, never a regeneration.
 *
 * A work-role slot with no customer photo (and any slot stock legitimately can't
 * fill) resolves to blankField: a dark gradient block. Refusing stock for a work
 * role is correct — a stock photo of someone else's job presented as "our work"
 * would be a lie. Rendering a void is the only mistake. So:
 *   - collapse the slot (remove the blank and any now-empty wrapper around it), and
 *   - if a section is left with no real content — or it's a work/gallery section
 *     with no real photo — remove the whole section. The page closes up around it.
 *
 * The model's art-direction INTENT for each removed slot is preserved as an HTML
 * comment at the point of removal, so when the owner sends photos of their own
 * work we can put a real photo exactly where the model meant one.
 *
 * Returns the removals so the caller can log how often this fires.
 */
export function collapseEmptyImageSlots(
  html: string,
): { html: string; removed: Array<{ kind: "section" | "slot"; where: string; artDirection: string }> } {
  const src = html;
  const removed: Array<{ kind: "section" | "slot"; where: string; artDirection: string }> = [];
  const scan = scanHtml(src);
  const els = scan.all;
  const hasClass = (e: ScannedEl, c: string) => new RegExp(`(^|\\s)${c}(\\s|$)`).test(e.attrs["class"] || "");
  const blanks = els.filter((e) => hasClass(e, "hubly-img-blank"));
  if (blanks.length === 0) return { html: src, removed };

  const contains = (p: ScannedEl, c: ScannedEl) => p.openStart < c.openStart && c.closeEnd <= p.closeEnd && p !== c;
  const sections = els.filter((e) => e.name === "section");
  const nearestSection = (el: ScannedEl): ScannedEl | null => {
    let best: ScannedEl | null = null;
    for (const s of sections) if (contains(s, el) && (!best || s.openStart > best.openStart)) best = s;
    return best;
  };
  const isRealImg = (e: ScannedEl) =>
    e.name === "img" && !!(e.attrs["src"] || "").trim() && !(e.attrs["src"] || "").trim().startsWith("#");
  const realImgIn = (c: ScannedEl) => els.some((e) => isRealImg(e) && contains(c, e));
  const headingIn = (c: ScannedEl) => {
    const h = els.find((e) => /^h[1-6]$/.test(e.name) && contains(c, e));
    return h ? innerText(h, src) : "";
  };
  const isWorkSection = (s: ScannedEl) => {
    const cid = ((s.attrs["class"] || "") + " " + (s.attrs["id"] || "")).toLowerCase();
    if (/\b(work|gallery|portfolio|showcase|projects)\b/.test(cid)) return true;
    return /our work|recent work|portfolio|gallery|our projects|the work|see our work|past projects/i.test(headingIn(s));
  };
  const parentOf = (el: ScannedEl): ScannedEl | null => {
    let best: ScannedEl | null = null;
    for (const e of els) if (contains(e, el) && (!best || e.openStart > best.openStart)) best = e;
    return best;
  };
  const esc = (v: string) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const artOf = (e: ScannedEl) => e.attrs["data-art-direction"] || "";

  const splices: Splice[] = [];
  const removedRanges: Array<[number, number]> = [];
  const within = (a: number, b: number) => removedRanges.some(([s, e]) => a >= s && b <= e);
  const doneSections = new Set<number>();

  // PASS 1 — a work/gallery section with no real photo: the whole section goes.
  for (const b of blanks) {
    const sec = nearestSection(b);
    if (!sec || doneSections.has(sec.openStart)) continue;
    if (isWorkSection(sec) && !realImgIn(sec)) {
      doneSections.add(sec.openStart);
      const dirs = blanks.filter((x) => contains(sec, x)).map(artOf).filter(Boolean);
      removed.push({ kind: "section", where: sec.attrs["id"] || sec.attrs["class"] || "section", artDirection: dirs.join(" | ") });
      splices.push({ start: sec.openStart, end: sec.closeEnd, text: `<!--hubly-collapsed-section role="work" reason="no-owner-photos" art-direction="${esc(dirs.join(" | "))}"-->` });
      removedRanges.push([sec.openStart, sec.closeEnd]);
    }
  }

  // PASS 2 — collapse each remaining blank plus any now-empty wrapper around it.
  for (const b of blanks) {
    if (within(b.openStart, b.closeEnd)) continue;
    const sec = nearestSection(b);
    let target: ScannedEl = b;
    for (let up = 0; up < 4; up++) {
      const p = parentOf(target);
      if (!p || p.name === "section" || p === sec) break;
      if (ownText(p, src)) break; // the wrapper has its own words -> not a pure wrapper
      const otherKids = els.some((e) => parentOf(e) === p && !(e.openStart === target.openStart && e.closeEnd === target.closeEnd));
      if (otherKids) break; // the wrapper holds something else too
      target = p;
    }
    if (within(target.openStart, target.closeEnd)) continue;
    removed.push({ kind: "slot", where: sec ? (sec.attrs["id"] || sec.attrs["class"] || "section") : "(page)", artDirection: artOf(b) });
    splices.push({ start: target.openStart, end: target.closeEnd, text: `<!--hubly-image-slot art-direction="${esc(artOf(b))}"-->` });
    removedRanges.push([target.openStart, target.closeEnd]);
  }

  let out = spliceAll(src, splices);

  // PASS 3 — remove any section now left with no real content at all.
  const scan2 = scanHtml(out);
  const els2 = scan2.all;
  const contains2 = (p: ScannedEl, c: ScannedEl) => p.openStart < c.openStart && c.closeEnd <= p.closeEnd && p !== c;
  const sp2: Splice[] = [];
  for (const s of els2.filter((e) => e.name === "section")) {
    if (innerText(s, out).replace(/\s+/g, "")) continue; // still has visible text
    const keep = els2.some(
      (e) =>
        contains2(s, e) &&
        ((e.name === "img" && !!(e.attrs["src"] || "").trim() && !(e.attrs["src"] || "").trim().startsWith("#")) ||
          e.name === "form" || e.name === "input" || e.name === "iframe"),
    ) || out.slice(s.openStart, s.closeEnd).includes("#hubly-book");
    if (keep) continue;
    removed.push({ kind: "section", where: s.attrs["id"] || s.attrs["class"] || "section", artDirection: "" });
    sp2.push({ start: s.openStart, end: s.closeEnd, text: `<!--hubly-collapsed-section reason="empty-after-collapse"-->` });
  }
  if (sp2.length) out = spliceAll(out, sp2);
  return { html: out, removed };
}

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
      const s = p.src || {};
      // Prefer a SIZED rendition, never the raw original (which is multi-MB).
      // `landscape` is ~1200x627 (~150KB) and ideal for a hero; `large`/`large2x`
      // are already sized. Only if all are missing do we fall back to `original`,
      // and then we append compression + a width cap so it can never serve a
      // full-resolution file.
      const sized = s.landscape || s.large2x || s.large ||
        (s.original ? s.original + (s.original.includes("?") ? "&" : "?") + "auto=compress&cs=tinysrgb&w=1600" : "");
      return {
        url: sized,
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
  src: { original?: string; large?: string; large2x?: string; landscape?: string };
}
