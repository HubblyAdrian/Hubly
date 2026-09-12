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

import { scanHtml, type ScannedEl } from "./hubly_html_scan.ts";

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

/** The page's ordinary content sections — the pool every donor is drawn from. One
 *  definition, used by the single-tag clone and by the chain clone alike. */
function eligibleSections(html: string): { start: number; end: number; open: string }[] {
  const headerEnd = (() => { const i = html.toLowerCase().indexOf("</header>"); return i < 0 ? -1 : i; })();
  const footerStart = (() => { const i = html.toLowerCase().lastIndexOf("<footer"); return i < 0 ? html.length : i; })();
  return sectionSpans(html).filter((sp) => {
    const block = html.slice(sp.start, sp.end);
    if (sp.start < headerEnd) return false;
    if (sp.start >= footerStart) return false;
    if (/<h1\b/i.test(block)) return false;
    if (/data-hubly-contact-block|data-hubly-services-block/i.test(block)) return false;
    return /<h2\b[^>]*>/i.test(block);
  });
}

export function pickDonorSection(html: string): Donor | null {
  const eligible = eligibleSections(html);
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

/** ── THE CHAIN CLONE ──────────────────────────────────────────────────────────
 *  THE INSET IS NOT ON THE SECTION, so cloning the section's class cannot fix it.
 *
 *  Measured over 129 pages on 2026-09-12: choosing the wrapper by the modal class
 *  signature among a page's sections changed the wrapper on 60 of them and the rendered
 *  inset on ONE, which it made worse. The reason is that the inset is carried somewhere
 *  different on nearly every page — `div.shell` INSIDE the section on one, the section's
 *  own `padding-left` plus `display:flex` on another, both at once on a third. Cloning one
 *  outer tag reproduces at most one of the three, which is why 63 of 129 blocks landed
 *  full-bleed at 0px while the page's content started at 60px or more, and 7 were pushed
 *  more than 200px to the right of it.
 *
 *  So clone the CHAIN, not the tag: every element from the donor `<section>` down to the
 *  container that actually holds its repeated items, re-emitted around our rows, and each
 *  row wrapped in the donor's own item element. The page's nesting is reproduced by
 *  construction rather than guessed at one level, which is the same move as cloning a
 *  service row instead of authoring one — just carried all the way down.
 *
 *  ONLY OPEN TAGS ARE CLONED. Never the donor's text. Its prose describes something else,
 *  and shipping it as ours is the fabricated-content defect wearing a layout fix.
 */

/** The repeated-item CONTAINER inside a donor section: the deepest element at least two
 *  of whose direct children each hold an <h3>. That is a count of siblings, not a
 *  judgement about layout — a grid of cards, a <ul> of rows and a <dl> all answer it the
 *  same way, and a section with one lone heading answers it not at all. */
function repeatedItemContainer(root: ScannedEl): { container: ScannedEl; items: ScannedEl[] } | null {
  const holdsH3 = (el: ScannedEl): boolean => el.name === "h3" || el.children.some(holdsH3);
  const found: { container: ScannedEl; items: ScannedEl[] }[] = [];
  const visit = (el: ScannedEl) => {
    const items = el.children.filter(holdsH3);
    if (items.length >= 2) found.push({ container: el, items });
    for (const c of el.children) visit(c);
  };
  visit(root);
  if (!found.length) return null;
  // DEEPEST WINS. The section also "contains two items" at every level above the grid;
  // the one we want is the element whose own children are the items.
  return found.reduce((a, b) => (b.container.depth > a.container.depth ? b : a));
}

/** The donor's own <p> opening tag, stamped so a later edit can find the description. */
function descOpen(open: string, name: string): string {
  return open.replace(/^<p/i, `<p data-hubly-desc="${escAttr(name)}"`);
}

const openTagOf = (el: ScannedEl, src: string) => src.slice(el.openStart, el.openEnd);
const firstDescendant = (el: ScannedEl, name: string): ScannedEl | null => {
  if (el.name === name) return el;
  for (const c of el.children) { const f = firstDescendant(c, name); if (f) return f; }
  return null;
};

/**
 * The services block built by cloning the donor's CHAIN — every element from its
 * `<section>` down to the container that holds its repeated items, with our rows inside
 * the donor's own item element.
 *
 * Returns null when the donor has no repeated items to learn from; the caller then falls
 * back to the single-tag clone, which is what shipped before this.
 */
/** What the chain clone needs from a donor, as strings ready to emit. Exported because
 *  the CONTACT/HOURS block takes the identical path — one definition of "the chain", used
 *  by both blocks, so they cannot drift into two answers about where the page's content
 *  column is. That has happened five times in this codebase already. */
export type ChainDonor = {
  /** `<section …>` first, then each wrapper down to the item container's PARENT. Cleaned;
   *  the section tag is left unstamped so each block marks it with its own attribute. */
  opens: string[];
  closes: string;
  headingOpen: string;
  headingTag: string;
  /** The element whose own children are the donor's repeated items. */
  containerOpen: string;
  containerTag: string;
  /** One item, and the elements inside it — open tags only. */
  itemOpen: string;
  itemTag: string;
  itemHeadOpen: string | null;
  itemBodyOpen: string | null;
  insertAt: number;
};

/**
 * THE CHAIN. Every element from the donor `<section>` down to the container that holds
 * its repeated items, as open tags, plus the item template inside it.
 *
 * Returns null when the donor has no repeated items to learn from; callers fall back to
 * the single-tag clone, which is what shipped before this.
 */
/** A SECTION THAT DESCRIBES A SEQUENCE IS NOT A LIST OF OFFERINGS.
 *
 *  The item rule looks for two or more <h3> — and a "how it works" section has three step
 *  cards, so it matches as readily as a services grid. Measured over the 119 pages that would
 *  receive a block: the donor is a sequence section on 67 of them, 56%. It is the majority
 *  case, not an edge, because the generator writes a process section precisely when it has no
 *  services to list — which is exactly when a services block gets added.
 *
 *  On ironwood-fence that meant cloning "From quote request to installed fence" — numbered
 *  step cards — to hold three priced services. Every signal below is a fact about the donor's
 *  own markup or its own words; none is an opinion about layout. A sequence donor is still
 *  used if nothing else qualifies, because a section is better than no section. */
function describesASequence(html: string, sp: { start: number; end: number }, itemOpen: string): boolean {
  const block = html.slice(sp.start, sp.end);
  const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return /class="[^"]*\b(step|steps|process|timeline|how-it-works)\b/i.test(block)
    || /\b(how it works|how we work|the process|our process|what happens next|step by step|from .{3,30} to )\b/i.test(text)
    || /class="[^"]*\b(step-number|step-index)\b/i.test(block)
    || /counter\(/i.test(block)
    || /class="[^"]*\bstep\b/i.test(itemOpen);
}

export function pickChainDonor(html: string): ChainDonor | null {
  const eligible = eligibleSections(html);
  if (!eligible.length) return null;
  const withItems = eligible.filter((sp) => ((html.slice(sp.start, sp.end).match(/<h3\b/gi) || []).length >= 2));
  if (!withItems.length) return null;
  // Prefer a section that is not describing a sequence; fall back to one only if that is all
  // the page has.
  const notSequence = withItems.filter((sp) => !describesASequence(html, sp, html.slice(sp.start, sp.start + 400)));
  const pool = notSequence.length ? notSequence : withItems;
  const d = pool[pool.length - 1];                        // nearest the insertion point

  const scan = scanHtml(html);
  const section = scan.all.find((el) => el.name === "section" && el.openStart === d.start);
  if (!section) return null;
  const found = repeatedItemContainer(section);
  if (!found) return null;
  const { container, items } = found;

  // section → … → the container's parent. Cloned whole rather than at one level because
  // the inset sits on the section's padding on one page, on an inner `div.shell` on the
  // next, and on both at once on a third.
  const chain: ScannedEl[] = [];
  for (let el: ScannedEl | null = container.parent; el; el = el.parent) {
    chain.unshift(el);
    if (el === section) break;
  }
  if (!chain.length || chain[0] !== section) return null;

  const template = items[0];
  const h3 = firstDescendant(template, "h3");
  const p = firstDescendant(template, "p");
  const h2 = firstDescendant(section, "h2");

  return {
    opens: chain.map((el) => cleanClonedOpen(openTagOf(el, html))),
    closes: chain.map((el) => `</${el.name}>`).reverse().join(""),
    headingOpen: h2 ? cleanClonedOpen(openTagOf(h2, html)) : "<h2>",
    headingTag: h2 ? h2.name : "h2",
    containerOpen: cleanClonedOpen(openTagOf(container, html)),
    containerTag: container.name,
    itemOpen: cleanClonedOpen(openTagOf(template, html)),
    itemTag: template.name,
    itemHeadOpen: h3 ? cleanClonedOpen(openTagOf(h3, html)) : null,
    itemBodyOpen: p ? cleanClonedOpen(openTagOf(p, html)) : null,
    insertAt: d.end,
  };
}

/** Put a block's own inner content inside the donor's chain, stamping the section with
 *  whatever attributes the block marks itself by. Shared with hubly_contact.ts. */
export function wrapInChain(donor: ChainDonor, sectionAttrs: string, inner: string, innermostAttrs?: string): string {
  const last = donor.opens.length - 1;
  const opens = donor.opens.map((o, i) => {
    let t = i === 0 ? o.replace(/^<section/i, `<section ${sectionAttrs}`) : o;
    // The INNERMOST wrapper can be marked too, because a later edit that adds a row to
    // this block has to put it INSIDE the chain. Before the chain existed, "append before
    // </section>" was the same place; now it is outside the wrapper that carries the
    // page's inset, and the added row would land full-bleed — the exact defect the chain
    // fixes, reintroduced by the next edit.
    if (innermostAttrs && i === last) t = t.replace(/^<([a-z][a-z0-9]*)/i, (_m, tag) => `<${tag} ${innermostAttrs}`);
    return t;
  });
  return opens.join("") + inner + donor.closes;
}

/** The services block built by cloning the donor's chain, with our rows inside the
 *  donor's own item element. */
export function chainClonedServicesBlock(html: string, services: ServiceFact[]): { block: string; insertAt: number } | null {
  const donor = pickChainDonor(html);
  if (!donor) return null;

  const heading = `${donor.headingOpen}Services</${donor.headingTag}>`;

  // THE DONOR'S OWN ITEM, RESTORED — with the colour question answered at the right level.
  //
  // S1.1 stopped cloning the item element because cloning it put our rows on the card's
  // tinted ground while their colour came from rules written for the SECTION's ground: seven
  // blocks fell below AA. Dropping the clone fixed contrast and cost the thing the page
  // actually looks like — Adrian: "services should be in boxes like they used to be."
  //
  // Both are fixable at once, because the failure was never the card. It was that our OWN
  // elements — the price span and the description — carried no colour rule of the card's, so
  // they inherited one from elsewhere. The name never failed: it clones the donor's <h3>,
  // which is inside the card and matches whatever rule the card sets.
  //
  // So: clone the item, clone its heading, and give our two additions `color: inherit` (in
  // servicesBlockLayoutCss) so they take the colour of the element they are inside rather
  // than a rule written for a different ground. Colour from the level the block occupies.
  const rows = services.map((s) => {
    const name = String(s.name || "").trim();
    const price = typeof s.price === "number" && Number.isFinite(s.price) && s.price > 0 ? money(s.price) : null;
    const desc = String(s.description || "").trim();
    const headOpen = donor.itemHeadOpen ?? "<h3>";
    return donor.itemOpen.replace(new RegExp(`^<${donor.itemTag}`, "i"), `<${donor.itemTag} data-hubly-sv-row`) +
      headOpen.replace(/^<h3/i, `<h3 data-hubly-service="${escAttr(name)}"`) + escText(name) + `</h3>` +
      (price ? `<span class="hubly-sv-price" data-hubly-price="${escAttr(name)}">${escText(price)}</span>` : "") +
      // NOT the donor's <p> — a page's body-copy class is its most MUTED style, and cloning
      // it took pixel failures from 3 to 20 when that was measured. Our own class, inheriting
      // the card's colour.
      (desc ? `<p class="hubly-sv-desc" data-hubly-desc="${escAttr(name)}">${escText(desc)}</p>` : "") +
      `</${donor.itemTag}>`;
  }).join("");

  // STAMPED, because the column override is a rule we own on an element we built. The
  // marker goes on AFTER cleanClonedOpen, which strips data-hubly-* off a clone.
  const containerOpen = donor.containerOpen
    .replace(new RegExp(`^<${donor.containerTag}`, "i"), `<${donor.containerTag} data-hubly-sv-list`);
  const inner = heading + containerOpen + rows + `</${donor.containerTag}>`;
  return {
    block: wrapInChain(donor, `data-hubly-section="services" data-hubly-services-block`, inner),
    insertAt: donor.insertAt,
  };
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
export function addServicesBlock(html: string, services: ServiceFact[], accent?: string, existingAnchorCount = 0): ServicesBlockPlacement {
  const real = (services || []).filter((s) => s && String(s.name || "").trim());
  if (!real.length) return { html, changed: false, inserted: [], via: "missed", detail: "no_real_services" };

  // ONE PREDICATE, PASSED IN. This used to run its own test:
  //   /data-hubly-section="services"/ || /data-hubly-service=/ || /data-hubly-services-block/
  // — a presence check on an attribute, which is a SECOND definition of "does this page
  // have a services area". On 2026-09-12 the two definitions disagreed about the same
  // page: this one refused with "that page already has a services area" because a header
  // strapline carried data-hubly-service, while the inserter had just told the same owner
  // it could not get his services onto the page. Both statements reached him; neither was
  // right about what the element was.
  //
  // The count comes from allServiceAnchors, which requires findServiceEntryBounds to
  // succeed — i.e. an entry a service could actually join. Second definitions are the
  // disease; there is only one question now and only one function answers it.
  if (existingAnchorCount > 0) {
    return { html, changed: false, inserted: [], via: "anchor", detail: "already_has_services" };
  }

  const donor = pickDonorSection(html);
  let block: string, at: number, css: string, mode: string;
  // THE CHAIN CLONE FIRST. It reproduces the donor's whole nesting — the level that
  // carries the inset, whichever level that is on this page — and puts each row inside
  // the donor's own item element, so the block reads as a list the way the page's own
  // lists read. It returns null when the donor has no repeated items to learn from, and
  // then the single-tag clone below is exactly what shipped before.
  const chained = chainClonedServicesBlock(html, real);
  if (chained) {
    block = chained.block;
    at = chained.insertAt;
    css = /data-hubly-sv-css/i.test(html) ? "" : servicesBlockLayoutCss();
    mode = "chain";
  } else if (donor) {
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
    // THE COLUMN TEMPLATE IS A FACT ABOUT THE DONOR'S CONTENT, NOT ABOUT THE PAGE'S
    // SPACING. The chain clone takes the donor's nesting, classes and ground — that is
    // where the page's inset lives, and it is why the block finally sits in the content
    // column. What it must NOT take is how many columns the donor's items are laid out
    // in: the donor chose three because it had three things to say. Three services then
    // fill three cells and two leave one empty; two services in a three-up grid on
    // ironside-barbers-a9fa2 rendered as two cards and a visible empty one, and on
    // aviation-lessons-in-lehi as 148px columns with "Express Wash" wrapped onto two
    // lines. Measured over the 129 pages that receive a block: every container we clone
    // is a grid (121) or a plain block (8) — not one flex row — so one property covers
    // the corpus, and it is scoped to the marker we stamp on our own container.
    // The second declaration is the gap under our heading, which the single-tag path has
    // always had (`.hubly-sv-list{margin-top:18px}`). Inside the chain our heading sits
    // outside the cloned container, so without it "Services" lands directly on the first
    // row — visible on ridgeline-pressure-washing. Same rule, same marker, our element.
    "[data-hubly-services-block] [data-hubly-sv-list]{grid-template-columns:1fr!important;margin-top:18px}" +
    // THE DONOR'S NUMBERING IS THE DONOR'S CONTENT TOO. The item class we clone often
    // paints a step badge from a CSS counter (`.step:before{content:counter(steps)}`).
    // Cloned onto our rows the counter never increments, so every service gets a "0" or
    // "00" circle — and even when it numbered correctly it would be wrong, because
    // services are a list and not a sequence (the same reason stripDecorativeOrdinals
    // exists). Measured across the 129 pages that receive a block: 9 paint a pseudo
    // element on our rows and ALL NINE are counters — no icons, no rules, nothing worth
    // keeping. Found on ridgeline-pressure-washing, on the page Adrian walked.
    "[data-hubly-services-block] [data-hubly-sv-row]::before," +
    "[data-hubly-services-block] [data-hubly-sv-row]::after{content:none!important}" +
    // COLOUR FROM THE LEVEL THE BLOCK OCCUPIES. Our two additions — the price and the
    // description — are the only elements in the row that match no rule of the donor's, so
    // they inherit from wherever the cascade reaches. Inside a cloned card that must be the
    // CARD's colour, not a rule written for the section's ground: that mismatch is what put
    // seven blocks below AA when the item clone was first tried.
    "[data-hubly-services-block] [data-hubly-sv-row] .hubly-sv-price," +
    "[data-hubly-services-block] [data-hubly-sv-row] .hubly-sv-desc{color:inherit}" +
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
