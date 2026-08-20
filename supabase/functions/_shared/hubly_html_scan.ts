/**
 * A small, purpose-built HTML scanner. Enough structure to walk a generated
 * page and stamp attributes onto it — and deliberately nothing more.
 *
 * WHY NOT A REAL PARSER
 *
 * The job is "add one attribute to some elements". A DOM library would do that
 * by parsing to a tree and serialising back, and the serialisation is the
 * problem: it re-encodes entities, re-quotes attributes, rewrites void tags,
 * normalises whitespace and can reflow anything it considers mis-nested. The
 * model's HTML would come out subtly different from what it wrote, on every
 * page, forever, and the diff would be invisible until something depended on
 * it.
 *
 * So this never rebuilds the document. It records BYTE RANGES into the original
 * string, and stamping is a splice at a known offset. Every byte we do not
 * touch is preserved exactly.
 *
 * WHAT IT HANDLES, because each of these silently corrupts a naive scanner:
 *   - <script>/<style> raw text — a `<` inside CSS or JS is not a tag, and a
 *     page with an inline <style> is every page we generate.
 *   - attribute values containing `>`  (href="/a?b>c", inline styles)
 *   - comments, doctype, CDATA-ish declarations
 *   - void elements, which never close
 *   - mis-nested/unclosed tags, which the model will produce eventually
 */

/** Elements that never have a closing tag. */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Elements whose contents are raw text, not markup. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

/**
 * Elements that close themselves when a sibling of the same kind opens, or when
 * their parent closes. Without this an unclosed <li> or <p> — which the model
 * writes routinely — nests every following sibling inside it, and the whole
 * section collapses into one element.
 */
const AUTO_CLOSE: Record<string, Set<string>> = {
  li: new Set(["li"]),
  p: new Set(["p", "div", "section", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "figure", "table"]),
  td: new Set(["td", "th", "tr"]),
  th: new Set(["td", "th", "tr"]),
  tr: new Set(["tr"]),
  option: new Set(["option"]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
};

export interface ScannedEl {
  name: string;
  parent: ScannedEl | null;
  children: ScannedEl[];
  /** `<tag ...>` — openStart is at `<`, openEnd just past `>`. */
  openStart: number;
  openEnd: number;
  /** Offset just past the tag name, where a new attribute is spliced in. */
  attrInsertAt: number;
  /** `</tag>` span. For void/self-closing elements both equal openEnd. */
  closeStart: number;
  closeEnd: number;
  attrs: Record<string, string>;
  /**
   * Byte range of each attribute INCLUDING its leading whitespace, so an
   * attribute can be removed or rewritten without disturbing its neighbours.
   * Without this the only way to strip an attribute is a regex over the whole
   * document, which cannot tell an attribute from the same text inside a
   * <script> string.
   */
  attrRanges: Record<string, { start: number; end: number }>;
  /** Direct text children, as ranges into the source. */
  texts: { start: number; end: number }[];
  /** Depth from the root of the scan. */
  depth: number;
}

export interface ScanResult {
  roots: ScannedEl[];
  all: ScannedEl[];
  source: string;
}

const NAME_RE = /[a-zA-Z][a-zA-Z0-9:_.-]*/y;

/** Read the attributes of an open tag, starting just past the tag name. */
function readAttrs(src: string, from: number): { attrs: Record<string, string>; attrRanges: Record<string, { start: number; end: number }>; end: number; selfClosing: boolean } {
  const attrs: Record<string, string> = {};
  const attrRanges: Record<string, { start: number; end: number }> = {};
  let i = from;
  let selfClosing = false;
  while (i < src.length) {
    const wsStart = i;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;
    if (src[i] === ">") { i++; break; }
    if (src[i] === "/" && src[i + 1] === ">") { selfClosing = true; i += 2; break; }
    // Attribute name.
    const nameStart = i;
    while (i < src.length && !/[\s=>/]/.test(src[i])) i++;
    if (i === nameStart) { i++; continue; } // junk byte; don't spin
    const name = src.slice(nameStart, i).toLowerCase();
    while (i < src.length && /\s/.test(src[i])) i++;
    let value = "";
    if (src[i] === "=") {
      i++;
      while (i < src.length && /\s/.test(src[i])) i++;
      const q = src[i];
      if (q === '"' || q === "'") {
        i++;
        const vs = i;
        // THE important line: scan to the matching quote, not to the next '>'.
        while (i < src.length && src[i] !== q) i++;
        value = src.slice(vs, i);
        i++;
      } else {
        const vs = i;
        while (i < src.length && !/[\s>]/.test(src[i])) i++;
        value = src.slice(vs, i);
      }
    }
    attrs[name] = value;
    attrRanges[name] = { start: wsStart, end: i };
  }
  return { attrs, attrRanges, end: i, selfClosing };
}

export function scanHtml(src: string): ScanResult {
  const roots: ScannedEl[] = [];
  const all: ScannedEl[] = [];
  const stack: ScannedEl[] = [];
  let i = 0;

  const top = () => (stack.length ? stack[stack.length - 1] : null);
  const pushText = (start: number, end: number) => {
    if (end <= start) return;
    const t = top();
    if (t) t.texts.push({ start, end });
  };

  let textStart = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { pushText(textStart, src.length); break; }

    // A `<` that cannot begin a tag, comment or declaration is literal text.
    const next = src[lt + 1];
    const isTagStart = next === "!" || next === "/" || (next !== undefined && /[a-zA-Z]/.test(next));
    if (!isTagStart) { i = lt + 1; continue; }

    pushText(textStart, lt);

    if (src.startsWith("<!--", lt)) {
      const e = src.indexOf("-->", lt + 4);
      i = e < 0 ? src.length : e + 3;
      textStart = i;
      continue;
    }
    if (next === "!") {
      const e = src.indexOf(">", lt);
      i = e < 0 ? src.length : e + 1;
      textStart = i;
      continue;
    }

    if (next === "/") {
      NAME_RE.lastIndex = lt + 2;
      const m = NAME_RE.exec(src);
      const name = m ? m[0].toLowerCase() : "";
      const gt = src.indexOf(">", lt);
      const end = gt < 0 ? src.length : gt + 1;
      // Pop to the matching open tag. If there isn't one, the close tag is
      // stray and is ignored rather than unwinding the whole document.
      const idx = (() => { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === name) return k; return -1; })();
      if (idx >= 0) {
        for (let k = stack.length - 1; k > idx; k--) {
          const orphan = stack[k];
          orphan.closeStart = orphan.closeEnd = lt;
        }
        const el = stack[idx];
        el.closeStart = lt;
        el.closeEnd = end;
        stack.length = idx;
      }
      i = end;
      textStart = i;
      continue;
    }

    NAME_RE.lastIndex = lt + 1;
    const m = NAME_RE.exec(src);
    if (!m) { i = lt + 1; continue; }
    const name = m[0].toLowerCase();
    const attrInsertAt = lt + 1 + m[0].length;
    const { attrs, attrRanges, end: openEnd, selfClosing } = readAttrs(src, attrInsertAt);

    // Implicit close of a sibling that never closed itself.
    while (stack.length) {
      const t = stack[stack.length - 1];
      const closers = AUTO_CLOSE[t.name];
      if (closers && closers.has(name)) { t.closeStart = t.closeEnd = lt; stack.pop(); } else break;
    }

    const parent = top();
    const el: ScannedEl = {
      name, parent, children: [],
      openStart: lt, openEnd, attrInsertAt,
      closeStart: openEnd, closeEnd: openEnd,
      attrs, attrRanges, texts: [], depth: stack.length,
    };
    all.push(el);
    if (parent) parent.children.push(el); else roots.push(el);

    if (RAW_TEXT.has(name)) {
      // Contents are text, whatever they look like. Find the real close tag.
      const closeRe = new RegExp(`</${name}\\s*>`, "i");
      const rest = src.slice(openEnd);
      const cm = closeRe.exec(rest);
      if (cm) {
        el.texts.push({ start: openEnd, end: openEnd + cm.index });
        el.closeStart = openEnd + cm.index;
        el.closeEnd = el.closeStart + cm[0].length;
        i = el.closeEnd;
      } else {
        el.texts.push({ start: openEnd, end: src.length });
        el.closeStart = el.closeEnd = src.length;
        i = src.length;
      }
      textStart = i;
      continue;
    }

    if (!selfClosing && !VOID.has(name)) stack.push(el);
    i = openEnd;
    textStart = i;
  }

  // Anything still open at EOF ends at EOF.
  for (const el of stack) { el.closeStart = el.closeEnd = src.length; }
  return { roots, all, source: src };
}

/** Direct text of an element, collapsed. Does not include descendants. */
export function ownText(el: ScannedEl, src: string): string {
  return el.texts.map((t) => src.slice(t.start, t.end)).join("").replace(/\s+/g, " ").trim();
}

/** All text within an element, including descendants. */
export function innerText(el: ScannedEl, src: string): string {
  if (el.closeStart <= el.openEnd) return "";
  return src.slice(el.openEnd, el.closeStart).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Replace [start, end) with `text`. An insertion is start === end. */
export interface Splice {
  start: number;
  end: number;
  text: string;
}

/**
 * Apply splices to the source, back to front so earlier offsets stay valid.
 * Overlapping ranges are a caller bug and throw rather than silently producing
 * mangled HTML — every caller here derives ranges from one scan of one string,
 * so an overlap means the ranges are wrong, not that the input was odd.
 */
export function spliceAll(src: string, edits: Splice[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = src;
  let prevStart = Infinity;
  for (const e of sorted) {
    if (e.end > prevStart) throw new Error(`overlapping splice at ${e.start}..${e.end}`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    prevStart = e.start;
  }
  return out;
}

/** Convenience: insert attribute text just after an element's tag name. */
export function insertAttr(el: ScannedEl, text: string): Splice {
  return { start: el.attrInsertAt, end: el.attrInsertAt, text };
}
