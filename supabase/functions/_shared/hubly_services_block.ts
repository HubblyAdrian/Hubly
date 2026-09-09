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
function serviceRows(services: ServiceFact[]): string {
  return services.map((s) => {
    const name = String(s.name || "").trim();
    const price = typeof s.price === "number" && Number.isFinite(s.price) && s.price > 0 ? money(s.price) : null;
    const desc = String(s.description || "").trim();
    return `<div class="hubly-sv-row">` +
      `<h3 data-hubly-service="${escAttr(name)}">${escText(name)}</h3>` +
      (price ? `<span class="hubly-sv-price" data-hubly-price="${escAttr(name)}">${escText(price)}</span>` : "") +
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
    "[data-hubly-services-block] .hubly-sv-desc{grid-column:1/-1;margin:0;opacity:.85}" +
    "</style>"
  );
}

/** Where a new block goes: before the last <footer>, else before </body>, else the
 *  end. Copied from hubly_contact.ts insertionPoint — one convention, not two. */
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
 * has one would be the destructive thing it exists to avoid. That refusal is `anchor`:
 * an area exists, use the normal insert path.
 */
export function addServicesBlock(html: string, services: ServiceFact[], accent?: string): ServicesBlockPlacement {
  const real = (services || []).filter((s) => s && String(s.name || "").trim());
  if (!real.length) return { html, changed: false, inserted: [], via: "missed", detail: "no_real_services" };

  // Already has a services area, by any of the three signals we trust.
  if (/data-hubly-section="services"/i.test(html) || /data-hubly-service=/i.test(html) || /data-hubly-services-block/i.test(html)) {
    return { html, changed: false, inserted: [], via: "anchor", detail: "already_has_services" };
  }

  const block = servicesBlockHtml(real);
  if (!block) return { html, changed: false, inserted: [], via: "missed", detail: "empty_block" };
  const at = insertionPoint(html);
  const css = /data-hubly-sv-css/i.test(html) ? "" : servicesBlockCss(accent);
  const out = html.slice(0, at) + block + css + html.slice(at);

  // VERIFY IN THE BYTES (Lesson 11). Every name we claim to have added must be in the
  // output, and none of our own attributes may have leaked into visible text.
  const missing = real.filter((s) => !out.includes(escText(String(s.name).trim())));
  if (missing.length || countLeaked(out) > countLeaked(html)) {
    return { html, changed: false, inserted: [], via: "missed", detail: missing.length ? "not_in_output" : "leaked" };
  }
  return { html: out, changed: true, inserted: real.map((s) => String(s.name).trim()), via: "inserted" };
}
