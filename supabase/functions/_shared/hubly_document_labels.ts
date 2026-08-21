/**
 * data-hc — the editing handles on a freeform page.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 * Labels are applied by THIS deterministic pass, not by the model. We take
 * whatever HTML came back, walk it, and stamp `data-hc` on every element the
 * editor could offer. The model is never asked for labels and its labels are
 * never trusted — any it emits are stripped before ours go on, so the result
 * cannot depend on it having cooperated.
 *
 * The alternative — validate the model's labels and regenerate when they're
 * wrong — is what the Content Value Rule already does elsewhere in this
 * codebase, and it currently costs a full second model call on EVERY build
 * (~$0.17-0.48 and ~60-90s a page, on a 150s wall-clock ceiling). Labelling is
 * fixable in post. It is fixed in post.
 *
 * THE COVERAGE INVARIANT
 *
 * After stamping, a page is either fully labelled or this pass has a bug. A
 * partially labelled page must never be reachable, because a half-labelled page
 * is worse than an unlabelled one: the owner clicks two things, one works, and
 * the product looks broken in a way nothing reports.
 *
 * Coverage is guaranteed BY CONSTRUCTION (a final catch-all sweep labels
 * anything the structural rules missed) and then ASSERTED. If the assertion
 * ever fires it means the walk and the coverage definition disagree — a code
 * bug — and it throws. It is never resolved by regenerating the page.
 *
 * WHY NOT data-node
 *
 * `data-node` means "a node with this id exists in the AST" and the whole patch
 * path is built on that promise. A freeform page has no AST. Reusing the
 * attribute would make `applyDirectDocumentPatch` receive ids it will look up
 * in a tree that does not exist. Different guarantee, different attribute.
 *
 * THE SCHEME:  data-hc="<role>.<ordinal>..."  — closed roles, open ordinals.
 *
 *   Value roles  — identify a FACT and may legitimately appear several times on
 *                  one page (a phone number in the header, the contact block and
 *                  the footer). Editing one edits all of them, which is the
 *                  behaviour an owner expects from "change my phone number".
 *                  These are also the labels that survive a regenerated page.
 *
 *   Positional roles — identify a PLACE (section.3.heading). Unique by
 *                  construction, and meaningless once the page is rebuilt with
 *                  a different structure.
 */

import { type ScannedEl, type Splice, innerText, insertAttr, ownText, scanHtml, spliceAll } from "./hubly_html_scan.ts";

/** Every token that may appear in a label. Ordinals are open; roles are not. */
export const HC_ROLE_TOKENS: ReadonlySet<string> = new Set([
  "business", "name", "logo",
  "nav", "item",
  "hero", "headline", "subhead", "cta",
  "section", "heading", "subheading", "body", "title",
  "contact", "phone", "email", "address", "hours",
  "footer", "page", "image", "text",
]);

/**
 * Roles whose label may repeat on a page. Everything else must be unique.
 * These are exactly the roles that mean "this is the business's phone number",
 * not "this is the third thing in the second section".
 */
export const HC_VALUE_ROLES: ReadonlySet<string> = new Set([
  "contact.phone", "contact.email", "contact.address", "contact.hours",
  "business.name", "business.logo",
]);

export function isValidHcLabel(label: string): boolean {
  if (!label || label.length > 120) return false;
  const segs = label.split(".");
  if (!segs.length) return false;
  for (const s of segs) {
    if (/^[1-9][0-9]{0,3}$/.test(s)) continue;
    if (HC_ROLE_TOKENS.has(s)) continue;
    return false;
  }
  // A label must start with a role, never an ordinal.
  return HC_ROLE_TOKENS.has(segs[0]);
}

/** Elements whose subtree is never editable content. */
const OPAQUE = new Set(["script", "style", "head", "title", "meta", "link", "svg", "noscript", "template", "iframe", "canvas", "video", "audio", "map", "object", "picture"]);

/** Leaf tags that can carry editable text. */
const TEXTY = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "li", "td", "th",
  "blockquote", "figcaption", "strong", "em", "b", "i", "small", "label",
  "button", "address", "time", "dt", "dd", "div", "cite", "q", "summary", "abbr", "mark",
]);

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const BANDS = new Set(["header", "footer", "nav", "section", "article", "aside", "main", "div"]);

export type HcKind = "text" | "image";

export interface HcLabel {
  label: string;
  tag: string;
  kind: HcKind;
  /** A short excerpt, for reporting only. */
  sample: string;
}

export interface StampResult {
  html: string;
  labels: HcLabel[];
  coverage: {
    editable: number;
    labelled: number;
    /** Always empty on success. Non-empty means this pass has a bug. */
    missed: { tag: string; sample: string }[];
  };
  /** True when the incoming HTML already carried data-hc attributes we discarded. */
  strippedModelLabels: number;
  /** What the content-safety pass removed, and why. Empty on a clean page. */
  removed: SanitizerRemoval[];
}

export interface SanitizerRemoval {
  what: string;
  reason: string;
  sample: string;
}

/**
 * REMOVE THE MECHANICS OF CREDENTIAL HARVESTING, deterministically, with no
 * model involvement — same discipline as labelling.
 *
 * A Hubly page never needs an arbitrary form: booking is a Hubly widget, chat is
 * a Hubly widget, contact is ours (injected by hubly_page_runtime.ts, after this
 * pass). So a generated page has no legitimate reason to contain a <form>, a
 * password field, a third-party <script>, or a cross-origin <iframe>. Rather
 * than try to detect malicious INTENT, this removes the CAPABILITY.
 *
 * STRIP, NOT REFUSE. Refusing a page means regenerating it — a full model call,
 * which is exactly the cost the freeform format exists to avoid, and the same
 * "reject and regenerate" the labelling pass was built to never do. A stripped
 * page still serves, still labels, still works; it has simply lost a capability
 * it should never have had. So every case below strips, and records what it
 * removed so the removal is auditable rather than silent.
 *
 * WHAT AND WHY, per the brief:
 *   <form>                     -> unwrapped (children kept, the <form> tags and
 *                                 its action/method removed). The visible copy a
 *                                 designer wrote stays; the submission mechanism
 *                                 does not.
 *   <input>/<select>/<textarea>/<button type=submit>
 *                              -> removed. No field, no capture. A password or
 *                                 card field is the acute case but ALL of them go,
 *                                 because a text field posting to an attacker is
 *                                 the same attack without the word "password".
 *   <script> not Hubly's       -> removed whole. hubly_page_runtime injects its
 *                                 own AFTER this pass, so nothing legitimate is
 *                                 in the model's output.
 *   <iframe> cross-origin      -> removed whole. A same-origin frame (our own
 *                                 booking deep-link, say) is allowed; anything
 *                                 pointing elsewhere is a place to host a login.
 */
const FORMY_LEAF = new Set(["input", "select", "textarea"]);
const SELF_ORIGIN_RE = /^(\/|#|\.|https?:\/\/[^/]*\.myhubly\.app(\/|$|#|\?))/i;

export function sanitizeFreeformHtml(html: string): { html: string; removed: SanitizerRemoval[] } {
  let src = String(html || "");
  const removed: SanitizerRemoval[] = [];

  // Iterate to a fixed point: removing a wrapping element shifts offsets, and a
  // form can contain a script can contain a field. Re-scan after each pass;
  // bounded because every pass strictly removes bytes.
  for (let pass = 0; pass < 12; pass++) {
    const scan = scanHtml(src);
    const cuts: Splice[] = [];
    let unwrappedForm = false;

    for (const el of scan.all) {
      // Whole-element removals (open tag through close tag).
      const cutWhole = (what: string, reason: string) => {
        cuts.push({ start: el.openStart, end: Math.max(el.closeEnd, el.openEnd), text: "" });
        removed.push({ what, reason, sample: src.slice(el.openStart, Math.min(el.openStart + 80, el.openEnd)) });
      };

      if (el.name === "script") {
        // Hubly injects its own runtime AFTER stamping, so any <script> present
        // in the model's output is the model's, and not wanted.
        cutWhole("<script>", "the page must not carry model-authored script");
        continue;
      }
      if (el.name === "iframe") {
        const srcAttr = (el.attrs.src || "").trim();
        if (srcAttr && !SELF_ORIGIN_RE.test(srcAttr)) {
          cutWhole("<iframe> (cross-origin)", `points off-domain: ${srcAttr.slice(0, 60)}`);
        }
        continue;
      }
      if (FORMY_LEAF.has(el.name)) {
        cutWhole(`<${el.name}>`, "no field may collect input on a generated page");
        continue;
      }
      if (el.name === "button") {
        const t = (el.attrs.type || "").toLowerCase();
        if (t === "submit" || t === "" ) {
          // A default-type button inside a form submits it. Once the form is
          // unwrapped it is inert, but remove it so a "Sign in" button cannot
          // imply a working login.
          cutWhole("<button type=submit>", "no submit control on a generated page");
        }
        continue;
      }
      if (el.name === "form" && !unwrappedForm) {
        // Unwrap: drop the <form ...> open tag and its </form> close, keep the
        // children. The action/method (where a harvest would post) go with the
        // open tag. Only one per pass — offsets shift — then re-scan.
        const openTagEnd = el.openEnd;
        cuts.push({ start: el.openStart, end: openTagEnd, text: "" });
        if (el.closeEnd > el.closeStart) cuts.push({ start: el.closeStart, end: el.closeEnd, text: "" });
        removed.push({ what: "<form>", reason: "unwrapped — submission mechanism removed, copy kept", sample: src.slice(el.openStart, Math.min(el.openStart + 80, openTagEnd)) });
        unwrappedForm = true;
      }
    }

    if (!cuts.length) break;
    // Non-overlapping by construction within a pass? A form and a field inside
    // it can both match. Drop any cut fully contained in another, keep the outer.
    cuts.sort((a, b) => a.start - b.start || b.end - a.end);
    const kept: Splice[] = [];
    let lastEnd = -1;
    for (const c of cuts) {
      if (c.start < lastEnd) continue; // contained in a prior (outer) cut
      kept.push(c);
      lastEnd = c.end;
    }
    src = spliceAll(src, kept);
  }

  return { html: src, removed };
}

function isOpaque(el: ScannedEl): boolean {
  for (let n: ScannedEl | null = el; n; n = n.parent) if (OPAQUE.has(n.name)) return true;
  return false;
}

function elementChildren(el: ScannedEl): ScannedEl[] {
  return el.children.filter((c) => !OPAQUE.has(c.name) && c.name !== "br");
}

/**
 * THE COVERAGE DEFINITION, and it is deliberately the same predicate the editor
 * uses to decide what is clickable. hubly.html's handler bails on any element
 * with element children (`if (target.children.length > 0) return`) and treats
 * <img> specially — so "editable" is exactly: an image, or a leaf with text.
 * If these two definitions ever drift, the product grows clickable-but-
 * unlabelled elements again, so they are stated together here.
 */
export function isEditableLeaf(el: ScannedEl, src: string): HcKind | null {
  if (isOpaque(el)) return null;
  if (el.name === "img") return "image";
  if (!TEXTY.has(el.name)) return null;
  if (elementChildren(el).length > 0) return null;
  return ownText(el, src) ? "text" : null;
}

/** Assign labels, keeping positional labels unique and letting value roles repeat. */
class Labeller {
  readonly assigned = new Map<ScannedEl, HcLabel>();
  private usedPositional = new Set<string>();

  constructor(private readonly src: string) {}

  has(el: ScannedEl): boolean {
    return this.assigned.has(el);
  }

  /** Returns true if it took. Positional collisions are refused, not renamed. */
  put(el: ScannedEl, label: string, kind: HcKind): boolean {
    if (this.assigned.has(el)) return false;
    if (!isValidHcLabel(label)) return false;
    const isValue = HC_VALUE_ROLES.has(label);
    if (!isValue) {
      if (this.usedPositional.has(label)) return false;
      this.usedPositional.add(label);
    }
    const sample = kind === "image" ? (el.attrs.src || "").slice(-48) : ownText(el, this.src).slice(0, 60);
    this.assigned.set(el, { label, tag: el.name, kind, sample });
    return true;
  }
}

/** Depth-first list of an element's descendants, document order. */
function descendants(el: ScannedEl, out: ScannedEl[] = []): ScannedEl[] {
  for (const c of el.children) { out.push(c); descendants(c, out); }
  return out;
}

function firstMatching(root: ScannedEl, pred: (e: ScannedEl) => boolean): ScannedEl | null {
  for (const d of descendants(root)) if (pred(d)) return d;
  return null;
}

/**
 * Repeated item blocks inside a band — service cards, a price list, a grid.
 * Found structurally: the shallowest container whose element children are two
 * or more and share one tag name. That is what a card list IS, and it does not
 * depend on class names, which the model picks freely.
 */
function findItemContainer(band: ScannedEl): ScannedEl | null {
  // Same tag is NOT enough. A section usually looks like
  //   <section><div class="head">…</div><div class="grid">…6 cards…</div></section>
  // and "two children, both <div>" matches the OUTER pair first, making the
  // heading block "item 1" and the entire card grid "item 2" — which is what
  // the first run did to a six-item menu. Siblings must also have the same
  // internal SHAPE, which is what actually distinguishes a card list from a
  // header sitting next to a card list.
  const shape = (el: ScannedEl) => elementChildren(el).map((c) => c.name).join(">");
  let best: ScannedEl | null = null;
  let bestCount = 0;
  for (const el of [band, ...descendants(band)]) {
    const kids = elementChildren(el);
    if (kids.length < 2) continue;
    const tag = kids[0].name;
    if (HEADINGS.has(tag)) continue;
    if (!kids.every((k) => k.name === tag)) continue;
    const s0 = shape(kids[0]);
    if (!kids.every((k) => shape(k) === s0)) continue;
    if (!kids.every((k) => elementChildren(k).length > 0 || innerText(k, band.name) !== "")) continue;
    // Widest wins: a 6-card grid beats an incidental pair of matching wrappers.
    if (kids.length > bestCount) { best = el; bestCount = kids.length; }
  }
  return best;
}

/**
 * The page's top-level regions.
 *
 * WRAPPERS ARE NOT BANDS. <main> is a wrapper, and so is the lone <div id="app">
 * that many generated pages put everything inside. Treating one as a band makes
 * the whole page a single region: the <h1> lands in it, the hero rule claims it,
 * and every real section on the page ends up labelled `hero.text.N`. That is
 * exactly what the first run of this pass did to a real generated page — 40 of
 * 51 labels were `hero.text.*` and the section ordinals never advanced past
 * zero. Coverage was 100% and the labels were useless, which is why coverage
 * alone is not the test.
 */
function expandBands(container: ScannedEl): ScannedEl[] {
  let list = elementChildren(container);
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const next: ScannedEl[] = [];
    for (const el of list) {
      const kids = elementChildren(el);
      // A lone container is only a wrapper if what it contains is ITSELF bands.
      // Requiring merely "two or more children" unwraps a single <section>
      // into its own <h1> and <p>, which are not bands — leaving the page with
      // no bands at all and sending every label to the page.* catch-all.
      const wrapper =
        el.name === "main" ||
        (list.length === 1 && (el.name === "div" || el.name === "section") &&
          kids.filter((k) => BANDS.has(k.name)).length >= 2);
      if (wrapper && kids.length) { next.push(...kids); changed = true; } else next.push(el);
    }
    list = next;
    if (!changed) break;
  }
  const bands = list.filter((e) => BANDS.has(e.name) || e.name === "form");
  // A page with no band-level structure at all (fragments, or content written
  // straight into <body>) is still one region, not zero. Without this the hero
  // and section rules never run and everything lands in page.text.*.
  return bands.length ? bands : [container];
}

/**
 * A phone number written as plain text, not a link. Strict on purpose: a price,
 * a year, a street number and an opening time must never match.
 */
const PHONE_TEXT_RE = /^[\s(+]*[\d][\d\s().+-]{7,20}\d[\s)]*$/;
const EMAIL_TEXT_RE = /^[^\s<>@]+@[^\s<>@]+\.[a-z]{2,}$/i;

function looksLikePhone(text: string): boolean {
  if (!PHONE_TEXT_RE.test(text)) return false;
  const digits = text.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15;
}

/**
 * tel:/mailto:/<address> are facts wherever they appear — AND SO IS A PHONE
 * NUMBER TYPED AS PLAIN TEXT.
 *
 * This started as links only, and a real generated page put the number in a
 * "Call us" button (a tel: link) and again in a contact card as a bare <div>.
 * The link got contact.phone, the card got section.4.body.2, and changing the
 * owner's phone number updated one of them. The published page then showed two
 * different phone numbers — the exact silent-wrong-answer failure that syncing
 * the tel: href exists to prevent, arriving through the other door.
 *
 * So the role follows the VALUE, not the markup.
 */
function valueRoleFor(el: ScannedEl, src: string): string | null {
  if (el.name === "a") {
    const href = (el.attrs.href || "").trim().toLowerCase();
    if (href.startsWith("tel:")) return "contact.phone";
    if (href.startsWith("mailto:")) return "contact.email";
  }
  if (el.name === "address") return "contact.address";
  const text = ownText(el, src);
  if (!text) return null;
  if (looksLikePhone(text)) return "contact.phone";
  if (EMAIL_TEXT_RE.test(text)) return "contact.email";
  return null;
}

export function stampFreeformHtml(html: string): StampResult {
  // 0. CONTENT SAFETY, before anything else. Strip the mechanics of credential
  //    harvesting (forms, fields, foreign scripts, cross-origin frames) so a
  //    labelled, served page cannot be a phishing form. Runs first so labelling
  //    never stamps an element that is about to be removed.
  const sanitized = sanitizeFreeformHtml(html);
  const source = sanitized.html;

  // 1. Discard any data-hc the model emitted, precisely (by attribute range,
  //    not by regex over the document — a regex cannot tell an attribute from
  //    the same characters inside a <script> string). Ours are authoritative,
  //    so an inherited label could only introduce a duplicate or a lie.
  const pre = scanHtml(source);
  const strips: Splice[] = [];
  for (const el of pre.all) {
    const r = el.attrRanges["data-hc"];
    if (r) strips.push({ start: r.start, end: r.end, text: "" });
  }
  const strippedModelLabels = strips.length;
  const clean = strips.length ? spliceAll(source, strips) : source;

  const scan = scanHtml(clean);
  const src = clean;
  const L = new Labeller(src);

  // 2. Content root: <body> if there is one, else everything.
  const body = scan.all.find((e) => e.name === "body") || null;
  const rootKids = body ? elementChildren(body) : scan.roots.filter((e) => !OPAQUE.has(e.name) && e.name !== "html" && e.name !== "body");
  const searchRoot: ScannedEl = body || ({ name: "#root", parent: null, children: scan.roots, openStart: 0, openEnd: 0, attrInsertAt: 0, closeStart: src.length, closeEnd: src.length, attrs: {}, attrRanges: {}, texts: [], depth: -1 } as ScannedEl);

  const allEls = descendants(searchRoot);
  const editable = allEls.filter((e) => isEditableLeaf(e, src) !== null);

  // 3. Value roles first — they beat position wherever they occur, and they may
  //    occur many times.
  for (const el of editable) {
    const role = valueRoleFor(el, src);
    if (role) L.put(el, role, isEditableLeaf(el, src)!);
  }

  // 4. Bands: the top-level regions of the page.
  const bands = expandBands(searchRoot);
  const headerBand = bands.find((b) => b.name === "header") || bands.find((b) => firstMatching(b, (e) => e.name === "nav")) || null;
  const footerBand = [...bands].reverse().find((b) => b.name === "footer") || null;

  const h1 = firstMatching(searchRoot, (e) => e.name === "h1" && !isOpaque(e));
  const heroBand = h1 ? (bands.find((b) => b === h1 || descendants(b).includes(h1)) || null) : null;

  // 5. Header: logo, business name, nav items.
  if (headerBand) {
    const logo = firstMatching(headerBand, (e) => e.name === "img");
    if (logo) L.put(logo, "business.logo", "image");
    const nameEl = firstMatching(headerBand, (e) => isEditableLeaf(e, src) === "text" && !L.has(e));
    if (nameEl) L.put(nameEl, "business.name", "text");
    let navN = 1;
    const nav = firstMatching(headerBand, (e) => e.name === "nav") || headerBand;
    for (const d of descendants(nav)) {
      if (L.has(d)) continue;
      if (isEditableLeaf(d, src) === "text" && d.name === "a") L.put(d, `nav.item.${navN++}`, "text");
    }
  }

  // 6. Hero.
  if (heroBand && h1) {
    L.put(h1, "hero.headline", "text");
    const after = descendants(heroBand);
    const sub = after.find((e) => e !== h1 && !L.has(e) && isEditableLeaf(e, src) === "text" && (e.name === "p" || HEADINGS.has(e.name)) && after.indexOf(e) > after.indexOf(h1));
    if (sub) L.put(sub, "hero.subhead", "text");
    const img = after.find((e) => e.name === "img" && !L.has(e));
    if (img) L.put(img, "hero.image", "image");
    const cta = after.find((e) => e.name === "a" && !L.has(e) && isEditableLeaf(e, src) === "text");
    if (cta) L.put(cta, "hero.cta", "text");
    let k = 1;
    for (const d of after) {
      if (L.has(d)) continue;
      const kind = isEditableLeaf(d, src);
      if (kind === "text") L.put(d, `hero.text.${k++}`, "text");
    }
    let ik = 1;
    for (const d of after) {
      if (L.has(d)) continue;
      if (isEditableLeaf(d, src) === "image") L.put(d, `hero.image.${ik++}`, "image");
    }
  }

  // 7. Sections — every band that is not header, footer or hero, numbered in
  //    document order. The ordinal is the section's position on the page, which
  //    is exactly why these labels do not survive a regenerated page.
  let sectionN = 0;
  for (const band of bands) {
    if (band === headerBand || band === footerBand || band === heroBand) continue;
    sectionN++;
    const p = `section.${sectionN}`;
    const inner = descendants(band);

    const heading = inner.find((e) => HEADINGS.has(e.name) && !L.has(e) && isEditableLeaf(e, src) === "text");
    if (heading) L.put(heading, `${p}.heading`, "text");
    const subheading = inner.find((e) => e !== heading && !L.has(e) && isEditableLeaf(e, src) === "text" && (HEADINGS.has(e.name) || e.name === "p"));
    if (subheading) L.put(subheading, `${p}.subheading`, "text");

    // Repeated cards, if this section has them.
    const itemHost = findItemContainer(band);
    if (itemHost) {
      const items = elementChildren(itemHost);
      let m = 0;
      for (const item of items) {
        m++;
        const ip = `${p}.item.${m}`;
        const kids = [item, ...descendants(item)];
        const t = kids.find((e) => !L.has(e) && isEditableLeaf(e, src) === "text" && (HEADINGS.has(e.name) || e.name === "strong" || e.name === "dt"));
        if (t) L.put(t, `${ip}.title`, "text");
        const bimg = kids.find((e) => !L.has(e) && isEditableLeaf(e, src) === "image");
        if (bimg) L.put(bimg, `${ip}.image`, "image");
        let bk = 0;
        for (const e of kids) {
          if (L.has(e)) continue;
          if (isEditableLeaf(e, src) !== "text") continue;
          bk++;
          L.put(e, bk === 1 ? `${ip}.body` : `${ip}.body.${bk}`, "text");
        }
      }
    }

    let bk = 1, ik = 1;
    for (const e of inner) {
      if (L.has(e)) continue;
      const kind = isEditableLeaf(e, src);
      if (kind === "text") L.put(e, `${p}.body.${bk++}`, "text");
      else if (kind === "image") L.put(e, `${p}.image.${ik++}`, "image");
    }
  }

  // 8. Footer.
  if (footerBand) {
    let k = 1, ik = 1;
    for (const e of descendants(footerBand)) {
      if (L.has(e)) continue;
      const kind = isEditableLeaf(e, src);
      if (kind === "text") L.put(e, `footer.text.${k++}`, "text");
      else if (kind === "image") L.put(e, `footer.image.${ik++}`, "image");
    }
  }

  // 9. THE CATCH-ALL. Anything editable that no structural rule claimed — a
  //    page with no <header>, content outside every band, a layout nobody
  //    anticipated. This is what makes coverage total by construction rather
  //    than by hoping the rules above were exhaustive.
  {
    let k = 1, ik = 1;
    for (const e of allEls) {
      if (L.has(e)) continue;
      const kind = isEditableLeaf(e, src);
      if (kind === "text") L.put(e, `page.text.${k++}`, "text");
      else if (kind === "image") L.put(e, `page.image.${ik++}`, "image");
    }
  }

  // 10. Assert, then stamp. The assertion can only fire if the walk and
  //     isEditableLeaf disagree, which is a bug in this file — never something
  //     to fix by asking the model again.
  const missed = editable.filter((e) => !L.has(e)).map((e) => ({ tag: e.name, sample: ownText(e, src).slice(0, 60) || (e.attrs.src || "").slice(-40) }));
  if (missed.length) {
    throw new Error(`hubly_document_labels: coverage invariant broken — ${missed.length} of ${editable.length} editable elements unlabelled (${missed.slice(0, 5).map((m) => m.tag).join(", ")}). This is a bug in the stamping pass.`);
  }

  const edits: Splice[] = [];
  const labels: HcLabel[] = [];
  for (const [el, info] of L.assigned) {
    edits.push(insertAttr(el, ` data-hc="${info.label}"`));
    labels.push(info);
  }
  labels.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));

  return {
    html: spliceAll(src, edits),
    labels,
    coverage: { editable: editable.length, labelled: L.assigned.size, missed: [] },
    strippedModelLabels,
    removed: sanitized.removed,
  };
}
