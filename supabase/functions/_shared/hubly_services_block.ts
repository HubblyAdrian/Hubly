/**
 * THE SERVICES BLOCK — added to a page that has no services area at all.
 *
 * WHY THIS EXISTS. 38 of 120 generated pages have no services section and no
 * placeholder rows to overwrite. Until now the only answer we had for an owner who
 * typed his prices was:
 *
 *   "Your page doesn't have a services section to add them to. The only way to add
 *    them is to rebuild the whole page — that starts the page over from scratch."
 *
 * A full rebuild is an enormous response to "here are my prices", and on the signup
 * path it reads as the product being broken. This is the small answer: add the area,
 * with his real services in it, and leave everything else on the page alone.
 *
 * IT IS A COPY OF hubly_contact.ts, DELIBERATELY, including the discipline that makes
 * that one safe: the block is built SERVER-SIDE from real facts (never model prose),
 * inserted at a known point, never restructures what the model wrote, and reports three
 * honest states — inserted / anchor / missed.
 *
 * TWO RULES SPECIFIC TO SERVICES.
 *
 * 1. THE SECTION IS STAMPED data-hubly-section="services" AS IT IS WRITTEN. We built it,
 *    so we know what it is with certainty — that is evidence, not a heuristic, and it
 *    puts the business on the exact path for every future edit.
 *
 * 2. NO PLACEHOLDER ROWS. EVER. The block is built from the services being added and is
 *    only added because there is something real to put in it. Invented rows are the bug
 *    that cost two days — "Use this row for the primary work the company wants to be
 *    known for" sitting on a live customer-facing page — and they are not being
 *    reintroduced in a new function.
 */

export type ServiceFact = { name: string; price?: number; description?: string };

export type ServicesBlockPlacement = {
  html: string;
  changed: boolean;
  inserted: string[];          // service names newly written to the page
  via: "inserted" | "anchor" | "missed";
  detail?: string;
};

function escText(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** House price format, matching fmtServicePrice in the registry. */
function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** One row per real service. The name carries data-hubly-service so every later edit
 *  takes the primary anchor path, and the price its own span, exactly as a page built
 *  with services would have. */
function serviceRows(services: ServiceFact[], donor?: Donor | null): string {
  const headOpen = donor?.itemHeadOpen ? cleanClonedOpen(donor.itemHeadOpen) : null;
  const bodyOpen = donor?.itemBodyOpen ? cleanClonedOpen(donor.itemBodyOpen) : null;
  return services.map((s) => {
    const name = String(s.name || "").trim();
    const price = typeof s.price === "number" && Number.isFinite(s.price) && s.price > 0 ? money(s.price) : null;
    const desc = String(s.description || "").trim();
    return `<div class="hubly-sv-row">` +
      (headOpen
        ? headOpen.replace(/^<h3/i, `<h3 data-hubly-service="${escAttr(name)}"`) + escText(name) + `</h3>`
        : `<h3 data-hubly-service="${escAttr(name)}">${escText(name)}</h3>`) +
      (price ? `<span class="hubly-sv-price" data-hubly-price="${escAttr(name)}">${escText(price)}</span>` : "") +
      // NOT the donor's <p>, and this is part of the DONOR RULE rather than a tuning
      // detail. A page's body-copy class is its most MUTED style — that is what body
      // copy is for — so inheriting it means choosing the page's least readable text for
      // our own. Cloning the donor's <h3> helps, because colour is usually scoped to
      // headings; cloning its <p> took failures from 3 to 20. Measured, not reasoned.
      (desc ? `<p class="hubly-sv-desc" data-hubly-desc="${escAttr(name)}">${escText(desc)}</p>` : "") +
      `</div>`;
  }).join("");
}

/** The block. Heading is one word, derived, never authored copy — same rule as
 *  deriveHeading in the contact block: we do not write marketing prose into a page
 *  the model designed. */
export function servicesBlockHtml(services: ServiceFact[]): string {
  const real = (services || []).filter((s) => s && String(s.name || "").trim());
  if (!real.length) return "";
  return `<section data-hubly-section="services" data-hubly-services-block>` +
    `<h2>Services</h2>` +
    `<div class="hubly-sv-list">${serviceRows(real)}</div>` +
    `</section>`;
}

/** Self-contained, scoped to the block, so it cannot collapse the page's own grid.
 *  Same shape and the same reasoning as contactHoursBlockCss. */
export function servicesBlockCss(accent?: string): string {
  const a = String(accent || "").trim();
  const rule = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a) ? a : "currentColor";
  return (
    "\n<style data-hubly-sv-css>" +
    "[data-hubly-services-block]{max-width:960px;margin:0 auto;padding:48px 24px;" +
    `border-top:2px solid ${rule};font:inherit;color:inherit;line-height:1.5}` +
    "[data-hubly-services-block] h2{font-size:1.5rem;margin:0 0 20px}" +
    "[data-hubly-services-block] .hubly-sv-list{display:grid;gap:18px}" +
    "[data-hubly-services-block] .hubly-sv-row{display:grid;grid-template-columns:1fr auto;gap:8px 24px;align-items:baseline}" +
    "[data-hubly-services-block] .hubly-sv-row h3{margin:0;font-size:1.05rem}" +
    "[data-hubly-services-block] .hubly-sv-price{font-weight:600;white-space:nowrap}" +
    // NO OPACITY. .85 was ours, and on a page whose pair is already marginal it is what
    // pushed the description below AA — 3 of the first 5 pixel failures were this line,
    // on the description and nothing else. If the page's own body text is readable, the
    // description is readable at the same colour; dimming it is us making it worse.
    "[data-hubly-services-block] .hubly-sv-desc{grid-column:1/-1;margin:0}" +
    "</style>"
  );
}

/** ── THE DONOR ────────────────────────────────────────────────────────────────
 *  Painting our own background is guessing, and the first version of this proved it:
 *  the block inherited body's dark-on-light text colour and landed on the dark end of a
 *  radial gradient. Unreadable, and the only clearly visible part was our own border.
 *
 *  THE PAGE ALREADY CONTAINS SECTIONS THAT ARE READABLE ON ITS OWN GROUND, because the
 *  model designed them against it. So clone one instead of composing a new one — the
 *  same move as cloning a service row rather than authoring an entry.
 *
 *  THE RULE FOR PICKING IT, and it follows from what went wrong: a page's ground can be
 *  a GRADIENT, so how readable a colour is depends on WHERE ON THE PAGE it sits. A donor
 *  from the top of the page proves nothing about the bottom. So take the LAST eligible
 *  content section — the one nearest where the block is going — and insert immediately
 *  after it, so the clone sits on the ground its donor just proved.
 *
 *  Excluded, and why:
 *    - the hero band (holds the <h1>): its type scale is display-sized, not section-sized
 *    - <header> and <footer> chrome: different colour context by design
 *    - an existing contact or services block: ours, and not evidence about the page
 */
type Donor = { open: string; close: number; insertAt: number; headingOpen: string; headingTag: string;
  /** The donor's OWN item elements. A page often scopes its colours to the elements it
   *  contains (`.final-cta h2 {color:…}`), so emitting a bare <h3> lands outside every
   *  rule and inherits the section background. Cloning the donor's own <h3>/<p> opening
   *  tags carries their classes — one level deeper than cloning the shell, same move. */
  itemHeadOpen: string | null; itemHeadTag: string; itemBodyOpen: string | null; itemBodyTag: string };

function sectionSpans(html: string): { start: number; end: number; open: string }[] {
  const out: { start: number; end: number; open: string }[] = [];
  const re = /<section\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const close = html.indexOf("</section>", m.index);
    if (close > 0) out.push({ start: m.index, end: close + 10, open: m[0] });
  }
  return out;
}

export function pickDonorSection(html: string): Donor | null {
  const spans = sectionSpans(html);
  const headerEnd = (() => { const i = html.toLowerCase().indexOf("</header>"); return i < 0 ? -1 : i; })();
  const footerStart = (() => { const i = html.toLowerCase().lastIndexOf("<footer"); return i < 0 ? html.length : i; })();
  const eligible = spans.filter((sp) => {
    const block = html.slice(sp.start, sp.end);
    if (sp.start < headerEnd) return false;
    if (sp.start >= footerStart) return false;
    if (/<h1\b/i.test(block)) return false;
    if (/data-hubly-contact-block|data-hubly-services-block/i.test(block)) return false;
    return /<h2\b[^>]*>/i.test(block);
  });
  if (!eligible.length) return null;

  // PREFER A SECTION SHAPED LIKE OURS — two or more <h3> items, i.e. a repeated content
  // list. This is not a preference, it is the whole point: a donor's colour is often
  // scoped to the elements it actually contains.
  //
  // The failure that produced this rule: on marsh-bloom the last eligible section was
  // `.final-cta`, a dark call-to-action whose light text colour is set on `.final-cta h2`
  // and nowhere else. The clone kept the dark background and our <h3> rows fell outside
  // that rule — dark green on dark green, 1.00:1, ink identical to ground. A section that
  // already contains <h3> items has a proved style for the exact element we emit.
  const withItems = eligible.filter((sp) => ((html.slice(sp.start, sp.end).match(/<h3\b/gi) || []).length >= 2));
  const pool = withItems.length ? withItems : eligible;
  const d = pool[pool.length - 1];               // nearest the insertion point: same ground
  const block = html.slice(d.start, d.end);
  const hm = /<h2\b[^>]*>/i.exec(block);
  if (!hm) return null;
  const im = /<h3\b[^>]*>/i.exec(block);
  const pm = /<p\b[^>]*>/i.exec(block);
  return { open: d.open, close: d.end, insertAt: d.end, headingOpen: hm[0], headingTag: "h2",
    itemHeadOpen: im ? im[0] : null, itemHeadTag: "h3",
    itemBodyOpen: pm ? pm[0] : null, itemBodyTag: "p" };
}

/** Strip the attributes that would make the clone a duplicate of its donor rather than
 *  a section of its own: ids collide, our own marks would be inherited wholesale, and a
 *  data-hc label belongs to the donor's position, not ours. */
export function cleanClonedOpen(open: string): string {
  return open
    .replace(/\s+id="[^"]*"/gi, "")
    .replace(/\s+data-hc="[^"]*"/gi, "")
    .replace(/\s+data-hubly-[a-z-]+(?:="[^"]*")?/gi, "")
    .replace(/\s+aria-labelledby="[^"]*"/gi, "");
}

/** Where a new block goes when there is NO donor to sit beside: before the last
 *  <footer>, else before </body>, else the end. Copied from hubly_contact.ts. */
function insertionPoint(html: string): number {
  const foot = html.toLowerCase().lastIndexOf("<footer");
  if (foot >= 0) return foot;
  const body = html.toLowerCase().lastIndexOf("</body>");
  if (body >= 0) return body;
  return html.length;
}

/** Our own markers leaked into VISIBLE text — always 0 on success. */
function countLeaked(html: string): number {
  const vis = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  return (vis.match(/data-hubly-[a-z-]+\s*=/gi) || []).length;
}

/**
 * Add a services area to a page that has none.
 *
 * REFUSES when the page already has one — this function's whole justification is that
 * there is nowhere to put a service, and adding a second services section to a page that
 * has one would be the destructive thing it exists to avoid. That refusal is `anchor`.
 */
export function addServicesBlock(html: string, services: ServiceFact[], accent?: string): ServicesBlockPlacement {
  const real = (services || []).filter((s) => s && String(s.name || "").trim());
  if (!real.length) return { html, changed: false, inserted: [], via: "missed", detail: "no_real_services" };

  if (/data-hubly-section="services"/i.test(html) || /data-hubly-service=/i.test(html) || /data-hubly-services-block/i.test(html)) {
    return { html, changed: false, inserted: [], via: "anchor", detail: "already_has_services" };
  }

  const donor = pickDonorSection(html);
  let block: string, at: number, css: string, mode: string;
  if (donor) {
    // CLONED SHELL. The wrapper, its classes and inline styles, and the page's own
    // heading element — so the block inherits the page's type scale and colour context
    // instead of a number we picked. Our 24px <h2> against the page's 64px was the tell.
    const openTag = cleanClonedOpen(donor.open).replace(/^<section/i, `<section data-hubly-section="services" data-hubly-services-block`);
    const headOpen = cleanClonedOpen(donor.headingOpen);
    block = `${openTag}${headOpen}Services</${donor.headingTag}>` +
      `<div class="hubly-sv-list">${serviceRows(real, donor)}</div></section>`;
    at = donor.insertAt;
    css = /data-hubly-sv-css/i.test(html) ? "" : servicesBlockLayoutCss();
    mode = "cloned";
  } else {
    // NO DONOR — a page with no ordinary content section to copy. Then, and only then,
    // paint our own ground, and say so.
    block = servicesBlockHtml(real);
    if (!block) return { html, changed: false, inserted: [], via: "missed", detail: "empty_block" };
    at = insertionPoint(html);
    css = /data-hubly-sv-css/i.test(html) ? "" : servicesBlockCss(accent);
    mode = "standalone";
  }
  const out = html.slice(0, at) + block + css + html.slice(at);

  // VERIFY IN THE BYTES (Lesson 11).
  const missing = real.filter((s) => !out.includes(escText(String(s.name).trim())));
  if (missing.length || countLeaked(out) > countLeaked(html)) {
    return { html, changed: false, inserted: [], via: "missed", detail: missing.length ? "not_in_output" : "leaked" };
  }
  return { html: out, changed: true, inserted: real.map((s) => String(s.name).trim()), via: "inserted", detail: mode };
}

/** LAYOUT ONLY — no colours, no background, no borders. The cloned shell brings the
 *  page's own ground and type with it; anything we add on top of that is us overriding
 *  a design that already works. */
export function servicesBlockLayoutCss(): string {
  return (
    "\n<style data-hubly-sv-css>" +
    "[data-hubly-services-block] .hubly-sv-list{display:grid;gap:18px;margin-top:18px}" +
    "[data-hubly-services-block] .hubly-sv-row{display:grid;grid-template-columns:1fr auto;gap:8px 24px;align-items:baseline}" +
    "[data-hubly-services-block] .hubly-sv-row h3{margin:0}" +
    "[data-hubly-services-block] .hubly-sv-price{font-weight:600;white-space:nowrap}" +
    // NO OPACITY. .85 was ours, and on a page whose pair is already marginal it is what
    // pushed the description below AA — 3 of the first 5 pixel failures were this line,
    // on the description and nothing else. If the page's own body text is readable, the
    // description is readable at the same colour; dimming it is us making it worse.
    "[data-hubly-services-block] .hubly-sv-desc{grid-column:1/-1;margin:0}" +
    "</style>"
  );
}
