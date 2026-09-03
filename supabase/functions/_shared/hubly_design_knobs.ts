/**
 * DESIGN KNOBS — the anchor pattern, applied to design instead of facts.
 *
 * THE PROBLEM. Every generated page carries its own CSS, written by the model, so
 * "make the header bigger" meant finding an unpredictable value in an unpredictable
 * stylesheet and editing it — recognising layout after the fact, which is the single
 * thing that has bitten this codebase most often (the service anchor, the price scan,
 * the hours detector). A knob must not be a matcher.
 *
 * WHAT THE CORPUS SAYS (129 stored freeform pages, latest version each, 2026-09-02):
 *   - 128 already define :root custom properties and use var(); ~11 declarations each,
 *     entirely unprompted. --radius on 94 pages, --max on 76, --line on 117.
 *   - font-size: ~24 declarations per page, ZERO via var().
 *   - padding: ~24 per page, ZERO via var(). One page in 129 has any spacing variable.
 * So the generator is already fluent in custom properties, and the exact two things an
 * owner asks for first — a bigger header, tighter margins — are the two it never makes
 * variable. This module closes that gap without asking the model to change how it works.
 *
 * MULTIPLY, DON'T REPLACE. Twenty-four font-sizes are a designed SCALE and must not
 * collapse into one value. Each becomes `calc(<what the model wrote> * var(--knob, 1))`:
 * the scale survives, one knob moves all of it, and the `, 1` fallback means an unbound
 * or unstamped page renders byte-identically. Nothing is lost if a knob is never touched.
 *
 * SCOPE FOR FREE. Custom properties inherit, so scoping needs no new selectors:
 *   [data-hc^="hero"] { --hubly-type-scale: var(--hubly-hero-scale, 1) }
 * makes "bigger header" resolve differently inside the hero — against labels we already
 * stamp at generation, never against layout we re-recognise.
 *
 * WHERE THE VALUE LIVES. In the stored page's own :root. That is deliberate: setting a
 * knob rewrites the stored HTML, which IS a new document version, so Undo
 * (restore_prev_business_document, which copies the previous rendered_html forward)
 * reverses a knob change exactly like any other edit, with no extra machinery.
 *
 * WHAT A KNOB CANNOT BE. Knobs are global or scoped SCALARS. Per-element intent, section
 * order, image crop/focal point and bespoke decoration are not numbers and belong to the
 * contextual inspector on data-hc labels, not here.
 */

/** A length we are willing to scale. Unitless 0 is deliberately absent — scaling zero
 *  achieves nothing and matching it would catch line-height:1.5 and z-index:2. */
const LENGTH_RE = /(\d*\.?\d+)(px|rem|em|ch|vw|vh|vmin|vmax)\b/g;

export type KnobId =
  | "typeScale"
  | "heroScale"
  | "spaceScale"
  | "measureScale"
  | "radiusScale"
  | "mediaRatio"
  | "background"
  | "ink";

type KnobDef = {
  /** The CSS custom property an owner control sets. */
  varName: string;
  /** Owner-facing name, for read-backs. */
  label: string;
  /** "scale" multiplies every matching length; "value" substitutes with a fallback. */
  kind: "scale" | "value";
  /** The declaration properties this knob binds to. */
  props: string[];
  /** Default when untouched — 1 for a scale; a value knob defaults to what was there. */
  def: string;
  /** Withheld from the owner's controls even though it binds — see `background`. */
  offered?: boolean;
  /** WHY it is withheld, said to the person. A refusal that explains itself is the
   *  difference between a control we chose not to ship and one that looks broken.
   *  Read by setDesignKnob's `not_offered` branch and by the model's action result. */
  withheld?: string;
  /** Steps an owner may choose. NEVER a raw field: every step stays inside the page's
   *  own scale, because a scale step is a multiple of what the generator chose rather
   *  than an absolute size. This is what makes "full autonomy, guarded mechanism"
   *  literally true instead of a slogan. */
  steps?: string[];
};

export const KNOBS: Record<KnobId, KnobDef> = {
  typeScale: { varName: "--hubly-type-scale", label: "text size", kind: "scale", props: ["font-size"], def: "1", steps: ["0.9", "1", "1.1", "1.25"] },
  // Scoped, not bound to declarations of its own: it overrides typeScale for anything
  // inside the hero, via the inherited-variable rule appended by stampDesignKnobs.
  heroScale: { varName: "--hubly-hero-scale", label: "header size", kind: "scale", props: [], def: "1", steps: ["0.9", "1", "1.15", "1.3"] },
  spaceScale: { varName: "--hubly-space-scale", label: "spacing", kind: "scale", props: ["padding", "margin", "gap", "row-gap", "column-gap"], def: "1", steps: ["0.8", "0.9", "1", "1.15"] },
  measureScale: { varName: "--hubly-measure-scale", label: "content width", kind: "scale", props: ["max-width"], def: "1", steps: ["0.9", "1", "1.15", "1.3"] },
  radiusScale: { varName: "--hubly-radius-scale", label: "corner rounding", kind: "scale", props: ["border-radius"], def: "1", steps: ["0", "0.5", "1", "1.6"] },
  // WITHHELD 2026-09-02 — held back from the first owner control, deliberately, and
  // held at the WRITER rather than merely left out of the UI (same reasoning as
  // background/ink below: a control that is only hidden is still reachable by anything
  // that calls this, and as of today that includes the model).
  //
  // It binds and it works. The problem is that its cost is invisible from where the
  // owner chooses. Measured at 390px on evergreen (7 cards, so it compounds):
  // 16/9 = 4,418px, 16/10 = 4,574, 3/2 = 4,677, 4/3 = 4,885, 1/1 = 5,508 — six and a
  // half phone screens, +1,090px. Worse, the knob OVERRIDES the generator's
  // per-breakpoint choice: evergreen deliberately uses 16/9 on phones and 16/10 on
  // desktop, so even picking "16/10" costs +156px on a phone. An owner setting this on
  // a 1440px screen cannot see what it does to the width their customers are actually
  // on, and the public page at phone width is the thing that decides whether anyone
  // books (OPEN_FINDINGS #10).
  //
  // The fix is not a warning — it is to make the ratio PER-BREAKPOINT so the page keeps
  // its own phone choice, and to drop the square step. Until that exists this stays
  // withheld: the first control an owner ever touches must not be the one that silently
  // adds a phone-screen of scroll. (STATE.md "The image knob's mobile cost".)
  mediaRatio: {
    varName: "--hubly-media-ratio", label: "image shape", kind: "value", props: ["aspect-ratio"],
    def: "", steps: ["16/9", "16/10", "4/3", "1/1"], offered: false,
    withheld:
      "I'm holding image shape back for now. It works, but it replaces the shape your page picks " +
      "for phones as well as desktop, and on a phone the taller shapes add about a screen and a half " +
      "of scrolling that you can't see from here. I'd rather fix that than let you set it blind.",
  },
  // NOT OFFERED YET — and this is a deliberate hold, not an oversight.
  //
  // The binding works and the contrast maths is right; what is missing is knowing WHICH
  // text sits on the page background. A generated page paints text in many colours
  // (sixteen on evergreen) and scopes them to sections: dark copy on the light body,
  // white copy inside a dark band. Checking only the body's ink passed a dark background
  // at 5.1:1 while the h1 rendered invisible. Checking ALL of them is correct but
  // unsatisfiable — no single background clears both the dark copy and the white copy,
  // including the page's CURRENT background — because the question "is this text on this
  // background" is structural, and structure is exactly what this whole approach refuses
  // to re-recognise. Rendering would answer it; the edge runtime has no layout engine.
  // So the control stays withheld until it can be answered, rather than shipping a knob
  // that can make a customer's site unreadable. See the 390px evidence in the session
  // report — the defect was invisible at desktop and in every unit test.
  background: {
    varName: "--hubly-bg", label: "background", kind: "value", props: [], def: "", offered: false,
    withheld:
      "I can't change the background yet. Your page paints text in a lot of different colours — " +
      "dark copy on the light areas, white copy inside the dark bands — and I can't yet tell which " +
      "of them would end up sitting on a new background, so I'd risk making some of your text " +
      "invisible. Ask me to rebuild the page in a different colour and I can do that properly.",
  },
  ink: {
    varName: "--hubly-ink", label: "text colour", kind: "value", props: [], def: "", offered: false,
    withheld:
      "I can't set the text colour on its own yet — it moves with the background, and the background " +
      "is on hold until I can tell which text would land on it.",
  },
};

/** Which knobs actually bind ON THIS PAGE — the single source of truth for the gate.
 *
 *  ONE function on purpose. The read (what controls to show) and the write (what may be
 *  set) have to agree exactly: a control the reader offers and the writer refuses looks
 *  broken, and a knob the writer accepts but the reader hides is a change nobody can undo
 *  from the UI. They drifted apart the moment there were two copies of this, so there is
 *  one.
 *
 *  An unstamped page is measured by asking what a stamp WOULD bind, so the answer is right
 *  on the very first read rather than only after the first change. */
export function boundKnobsFor(html: string): Record<string, number> {
  return knobBinding(html).bound;
}

/** What we know about this page's bindings, INCLUDING what we don't know.
 *
 *  Three cases, and the third is the one that matters:
 *
 *  1. NOT STAMPED — ask what a stamp would bind. Authoritative: we are about to do it.
 *  2. STAMPED WITH RECORDED COUNTS — read them. Authoritative: they were computed with
 *     the stylesheet in hand.
 *  3. STAMPED BY AN OLDER PASS, no recorded counts — this is evergreen, and every page
 *     stamped before this change. Here the honest answer differs PER KNOB, and the
 *     difference was measured rather than assumed (2026-09-02, stale-stamp repro):
 *
 *       - the four declaration-anchored knobs (type/space/measure/radius) can still be
 *         counted truthfully, because their predicate counts `var(--hubly-x-scale)` in
 *         declarations THE GENERATOR wrote. On the repro they refused correctly: type 0
 *         moved 0, space 0 moved 0, measure 5 moved 8, radius 4 moved 8.
 *       - heroScale CANNOT. Its only evidence is the `[data-hc^="hero"]` rule we inject
 *         ourselves, so on the same repro it said "bound: 1" and moved ZERO elements.
 *         That is the lie, verbatim.
 *
 *  So heroScale on an unrecorded page is UNKNOWN — never 0 and never bound. It must not
 *  fall back to the old predicate (that changes nothing for the pages that have the bug),
 *  and it must not report 0 either, because "there is nothing on your page this would
 *  change" is a claim we cannot support here. The caller says "I can't tell" and does
 *  nothing. Verifying it properly needs a layout engine — flip the variable, diff the
 *  computed styles — and the edge runtime has no DOM. That is precisely why the count is
 *  recorded at stamp time now.
 *
 *  Re-stamping an old page is the real repair (STATE: "upgrade in place, never unwrap").
 *  It is deliberately NOT done here. */
export type KnobBinding = { bound: Record<string, number>; unknown: KnobId[] };

export function knobBinding(html: string): KnobBinding {
  if (!hasDesignKnobs(html)) return { bound: stampDesignKnobs(html).bound, unknown: [] };
  const recorded = readRecordedBound(html);
  if (recorded) return { bound: recorded, unknown: [] };
  const derived = readDesignKnobs(html).bound;
  delete derived.heroScale;
  return { bound: derived, unknown: ["heroScale"] };
}

/** Resolve "bigger" / "smaller" into an actual step, from where the page is NOW.
 *
 *  This exists because of how people ask. Nobody says "set the header scale to 1.15";
 *  they say "make my headings bigger", and a model answering that has to know the
 *  current value or it guesses — and a guess here is a silent no-op ("set it to 1" when
 *  it is already 1) that reports success. Reading the page and stepping from it is the
 *  only version that cannot lie.
 *
 *  Returns `atEnd` rather than clamping silently: "that's already as large as I can make
 *  it" is a true answer, and pretending a change happened is the failure this whole
 *  mechanism exists to avoid. */
export function stepKnob(
  html: string,
  knob: KnobId,
  direction: "up" | "down",
): { value: string } | { atEnd: true; current: string } | { error: string } {
  const def = KNOBS[knob];
  if (!def || !def.steps || !def.steps.length) return { error: "no_steps" };
  const current = readDesignKnobs(html).values[knob] || def.def;
  // Match on normalised text: a stored "1" and a step "1" must meet, and a value knob's
  // "16/9" has no numeric ordering to fall back on.
  const norm = (s: string) => String(s).trim().replace(/\s+/g, "");
  let i = def.steps.findIndex((s) => norm(s) === norm(current));
  // Not sitting on a step (an owner-set page from an older step list, or a value knob
  // still on the generator's own value): start from the default so a direction still
  // means something, rather than refusing.
  if (i === -1) {
    const d = def.steps.findIndex((s) => norm(s) === norm(def.def));
    i = d === -1 ? 0 : d;
  }
  const next = direction === "up" ? i + 1 : i - 1;
  if (next < 0 || next >= def.steps.length) return { atEnd: true, current };
  return { value: def.steps[next] };
}

export type StampResult = {
  html: string;
  /** How many declarations each knob actually binds ON THIS PAGE.
   *  THE GATE: a control is offered only where its count is > 0. A knob that binds
   *  nothing is a control that does nothing, and showing it is a green checkmark we
   *  did not earn — the same rule as navigation appearing only once it is earned. */
  bound: Record<string, number>;
};

/** Already stamped? Idempotence matters: the stamp runs at generation AND retroactively
 *  on an existing page, and double-wrapping would square every scale. */
export function hasDesignKnobs(html: string): boolean {
  return /--hubly-type-scale\s*:/.test(String(html || ""));
}

/** Wrap every scalable length in one declaration value. Skips a value already carrying
 *  a hubly knob (idempotence) and anything inside url(), where a "16px" is a filename. */
function scaleValue(value: string, varName: string): { out: string; hits: number } {
  if (value.includes("--hubly-")) return { out: value, hits: 0 };
  let hits = 0;
  // A VAR REFERENCE IS A LENGTH TOO. The generator very often writes
  // `border-radius: var(--radius)` / `max-width: var(--max)` — 94 and 76 pages carry
  // those variables — and the literal then lives in :root, which this pass deliberately
  // never rewrites. Matching only numbers meant those declarations counted as BOUND and
  // moved nothing: the control reported itself as working and the page sat still, which
  // is the unearned checkmark one level down. Multiplying the reference itself fixes it
  // without touching the page's own variable.
  const out = value.replace(
    /url\([^)]*\)|var\(\s*--[a-z0-9-]+\s*(?:,[^()]*)?\)|(\d*\.?\d+)(px|rem|em|ch|vw|vh|vmin|vmax)\b/gi,
    (m) => {
      if (m.startsWith("url(")) return m;
      hits++;
      return `calc(${m} * var(${varName}, 1))`;
    },
  );
  return { out, hits };
}

/** Substitute a whole value, keeping the original as the fallback so an untouched knob
 *  renders exactly what the generator chose. */
function valueWithFallback(value: string, varName: string): string {
  const v = value.trim();
  if (v.includes("--hubly-")) return value;
  return `var(${varName}, ${v})`;
}

/** Which knob owns a given CSS property. */
function knobForProp(prop: string): { id: KnobId; def: KnobDef } | null {
  const p = prop.toLowerCase().trim();
  for (const [id, def] of Object.entries(KNOBS) as [KnobId, KnobDef][]) {
    if (def.props.includes(p)) return { id, def };
  }
  return null;
}

/** Transform one run of declarations — a rule body or the contents of a style="" attr.
 *  Deliberately text-level: this NEVER asks what an element is or where it sits, only
 *  what a declaration says, which is why it cannot fail the way a layout matcher does. */
function transformDeclarations(css: string, bound: Record<string, number>, opts: { bodyRule?: boolean } = {}): string {
  return css.replace(/([a-z-]+)\s*:\s*([^;{}]+)(;|$)/gi, (whole, rawProp: string, rawValue: string, tail: string) => {
    const prop = rawProp.toLowerCase();
    // Never rewrite a custom property's own definition — that is where knob values live.
    if (prop.startsWith("--")) return whole;
    const hit = knobForProp(prop);
    if (hit) {
      if (hit.def.kind === "scale") {
        const { out, hits } = scaleValue(rawValue, hit.def.varName);
        if (hits) bound[hit.id] = (bound[hit.id] || 0) + hits;
        return `${rawProp}: ${out}${tail}`;
      }
      const out = valueWithFallback(rawValue, hit.def.varName);
      if (out !== rawValue) bound[hit.id] = (bound[hit.id] || 0) + 1;
      return `${rawProp}: ${out}${tail}`;
    }
    // BACKGROUND AND INK BIND TO THE BODY RULE ONLY. Replacing every colour on the page
    // with one variable would destroy the design; the page background and its reading
    // colour are the two an owner means by "change the background".
    if (opts.bodyRule && (prop === "background" || prop === "background-color")) {
      const out = valueWithFallback(rawValue, KNOBS.background.varName);
      if (out !== rawValue) bound.background = (bound.background || 0) + 1;
      return `${rawProp}: ${out}${tail}`;
    }
    if (opts.bodyRule && prop === "color") {
      const out = valueWithFallback(rawValue, KNOBS.ink.varName);
      if (out !== rawValue) bound.ink = (bound.ink || 0) + 1;
      return `${rawProp}: ${out}${tail}`;
    }
    return whole;
  });
}

/** Walk a stylesheet rule by rule so the body rule can be recognised by its SELECTOR
 *  (the one place selectors are read, and only to find `body`/`html` — not layout). */
function transformStylesheet(css: string, bound: Record<string, number>, depth = 0): string {
  // BRACE-AWARE, because @media MATTERS MOST. The first cut used one flat regex and
  // skipped anything whose selector began with "@" — which threw away the entire body of
  // every media query. That is precisely where a page's PHONE styling lives: evergreen
  // re-declares .card img{aspect-ratio:16/9} at narrow widths, so the image knob bound
  // its desktop declaration, moved the desktop render, and did nothing at all on a phone.
  // A control that works on the width the owner isn't looking at is worse than none.
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) { out += css.slice(i); break; }
    const selector = css.slice(i, open);
    let d = 1, j = open + 1;
    while (j < css.length && d > 0) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
      j++;
    }
    const body = css.slice(open + 1, Math.max(open + 1, j - 1));
    const sel = selector.trim().toLowerCase();
    // @keyframes / @font-face bodies are not page rules — scaling a keyframe's type
    // would animate against the owner's control. Left exactly as written.
    if (/^@(keyframes|-webkit-keyframes|font-face|supports\s*\(\s*not)/.test(sel)) {
      out += selector + "{" + body + "}";
    } else if (sel.startsWith("@") && body.includes("{") && depth < 4) {
      out += selector + "{" + transformStylesheet(body, bound, depth + 1) + "}";
    } else {
      const bodyRule = /(^|,)\s*(body|html)\s*(,|$)/.test(sel);
      out += selector + "{" + transformDeclarations(body, bound, { bodyRule }) + "}";
    }
    i = j;
  }
  return out;
}

/**
 * Stamp a page so its design becomes adjustable.
 *
 * Runs at generation AND retroactively on an already-built page — the retro case is why
 * every substitution keeps the original as a fallback: an existing page renders exactly
 * as before until an owner moves something.
 */
export function stampDesignKnobs(html: string): StampResult {
  const src = String(html || "");
  const bound: Record<string, number> = {};
  if (!src.trim()) return { html: src, bound };
  if (hasDesignKnobs(src)) return { html: src, bound };

  // 1. Every <style> block, including rules inside @media.
  let out = src.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open: string, css: string, close: string) =>
    open + transformStylesheet(css, bound) + close
  );

  // 2. INLINE style="" ATTRIBUTES. Measured at ~9 per page, 7 of them touching a
  //    knobbable property (some are ours: the contact block, the price span, the photo
  //    slot). Inline styles beat the stylesheet, so skipping them would make a knob
  //    visibly miss elements — a control that works on most of the page and not the
  //    rest is worse than no control, because nobody can explain it.
  out = out.replace(/\sstyle="([^"]*)"/gi, (whole, css: string) => {
    const t = transformDeclarations(css, bound);
    return t === css ? whole : ` style="${t}"`;
  });

  // 3. The knob defaults and the hero scope. Appended last so it wins the cascade for
  //    the scope rule, and so :root carries the values an owner control will edit.
  const defaults = (Object.entries(KNOBS) as [KnobId, KnobDef][])
    .filter(([, d]) => d.kind === "scale")
    .map(([, d]) => `${d.varName}:${d.def}`)
    .join(";");
  // heroScale binds through the inherited scope rule rather than declarations of its
  // own, so it has to be counted here — and counted HONESTLY: the scope only reaches
  // elements labelled hero.*, so on a page whose generator labelled no hero the control
  // must not appear. The gate is the same either way (a control only where it does
  // something); this is just the one knob whose binding isn't a declaration count.
  //
  // COUNTED BEFORE THE BLOCK IS WRITTEN, because the block now RECORDS the counts.
  const heroLabels = (out.match(/data-hc="hero[.\"]/g) || []).length;
  if (heroLabels > 0 && (bound.typeScale || 0) > 0) bound.heroScale = heroLabels;

  // RECORD THE COUNTS. This is the anchor pattern applied to the gate itself.
  //
  // Everything needed to answer "does this knob bind anything" is in hand RIGHT HERE,
  // while the stylesheet is being rewritten and the hero labels counted. Throwing it
  // away and re-deriving it later by regex is re-recognition after the fact — the exact
  // thing this codebase forbids for page facts, and it produced a real lie: heroScale's
  // read-time predicate matched the `[data-hc^="hero"]` rule on the next line, which is
  // OURS, so it reported "bound" on every page we had ever stamped whether or not a
  // single hero-scoped font-size existed. Measured 2026-09-02: strip this block and
  // heroScale's count went 106 -> 0 across the corpus, while the other four knobs held
  // at 106 because they are anchored to the generator's own declarations.
  const css =
    `<style data-hubly-knobs data-hubly-bound="${serializeBound(bound)}">:root{${defaults}}` +
    // Inherited override: anything inside the hero reads the hero scale instead of the
    // page scale. No new selectors on the page's own elements, no layout recognition.
    `[data-hc^="hero"]{--hubly-type-scale:var(--hubly-hero-scale,1)}</style>`;
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, css + "</head>") : out + css;

  return { html: out, bound };
}

/** Counts, serialised onto the knob style block. Every knob id appears, zeros included,
 *  so a missing id means "this page predates recording" and never "we checked, it's 0". */
function serializeBound(bound: Record<string, number>): string {
  return (Object.keys(KNOBS) as KnobId[]).map((k) => `${k}:${bound[k] || 0}`).join(";");
}

/** The counts stamping wrote, or null if this page was stamped before we recorded them. */
export function readRecordedBound(html: string): Record<string, number> | null {
  const m = /<style\s+data-hubly-knobs[^>]*\sdata-hubly-bound="([^"]*)"/i.exec(String(html || ""));
  if (!m) return null;
  const out: Record<string, number> = {};
  for (const part of m[1].split(";")) {
    const [k, v] = part.split(":");
    if (k && v != null && (k in KNOBS)) out[k] = Number(v) || 0;
  }
  return Object.keys(out).length ? out : null;
}

/** Read the knob values currently stored in the page's :root, plus which knobs are
 *  bound (so a caller can offer exactly the controls that do something). */
export function readDesignKnobs(html: string): { values: Record<string, string>; bound: Record<string, number> } {
  const src = String(html || "");
  const values: Record<string, string> = {};
  const bound: Record<string, number> = {};
  for (const [id, def] of Object.entries(KNOBS) as [KnobId, KnobDef][]) {
    const m = new RegExp(`${def.varName}\\s*:\\s*([^;}]+)`).exec(src);
    if (m) values[id] = m[1].trim();
    // A knob is bound if any declaration references it OUTSIDE the :root definition.
    const uses = (src.match(new RegExp(`var\\(\\s*${def.varName}`, "g")) || []).length;
    if (uses) bound[id] = uses;
  }
  // heroScale binds through the scope rule rather than declarations of its own.
  if (/--hubly-type-scale\s*:\s*var\(\s*--hubly-hero-scale/.test(src)) bound.heroScale = 1;
  return { values, bound };
}

/** sRGB relative luminance (WCAG 2.1). */
function luminance(rgb: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

/** Parse #rgb, #rrggbb and rgb()/rgba(). Returns null for anything else (a gradient,
 *  a named colour we don't know) — and null must mean REFUSE, never "assume it's fine". */
export function parseColor(v: string): [number, number, number] | null {
  const s = String(v || "").trim().toLowerCase();
  const named: Record<string, [number, number, number]> = {
    white: [255, 255, 255], black: [0, 0, 0],
  };
  if (named[s]) return named[s];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return null;
  const la = luminance(ca), lb = luminance(cb);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * CONTRAST IS CHECKED, NOT ASSUMED.
 *
 * Pairing background with ink is the right shape but does not by itself stop a dark
 * background against dark ink. So a background change computes the REAL ratio: if the
 * page's current ink fails, try the page's own alternatives and adopt the first that
 * passes; if none does, REFUSE the whole change. A customer's site that cannot be read
 * is the worst possible outcome of a feature meant to make an owner proud of it, and it
 * is worse than the owner not getting the colour they asked for.
 *
 * WCAG AA body text = 4.5:1. We use it as the floor, not a target.
 */
export const CONTRAST_FLOOR = 4.5;
export function resolveInkFor(bg: string, currentInk: string, candidates: string[]): { ink: string; ratio: number } | { refuse: string } {
  const tryOne = (ink: string) => {
    const r = contrastRatio(bg, ink);
    return r !== null && r >= CONTRAST_FLOOR ? r : null;
  };
  const keep = tryOne(currentInk);
  if (keep) return { ink: currentInk, ratio: keep };
  for (const c of [...candidates, "#111111", "#ffffff"]) {
    const r = tryOne(c);
    if (r) return { ink: c, ratio: r };
  }
  const got = contrastRatio(bg, currentInk);
  return {
    refuse: got === null
      ? `I couldn't read that colour well enough to know it would stay legible, so I left it alone.`
      : `That background would leave the text at ${got.toFixed(1)}:1 against it — under the ${CONTRAST_FLOOR}:1 needed to stay readable — so I didn't apply it.`,
  };
}

/** Every colour the page defines in :root, so a background control offers THIS PAGE'S
 *  palette rather than colours we invented. The corpus names them differently on every
 *  page (--paper, --clay, --steel, --gold), which is exactly why they are read, not assumed. */
export function pagePalette(html: string): { name: string; value: string }[] {
  const root = /:root\s*\{([^}]*)\}/.exec(String(html || ""));
  if (!root) return [];
  const out: { name: string; value: string }[] = [];
  for (const m of root[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/gi)) {
    const value = m[2].trim();
    if (parseColor(value)) out.push({ name: m[1], value });
  }
  return out;
}

/** Resolve a CSS colour that may be a var() chain, against the page's own :root.
 *  A generated page writes `color: var(--hubly-ink, var(--green-deep))`, so the value
 *  that actually paints is two hops away — and reading it wrong is how a contrast check
 *  ends up grading a colour the page never uses. */
function resolveCssColor(html: string, value: string, depth = 0): string | null {
  const v = String(value || "").trim();
  if (!v || depth > 3) return null;
  if (parseColor(v)) return v;
  const m = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/i.exec(v);
  if (!m) return null;
  const def = new RegExp(`${m[1]}\\s*:\\s*([^;}]+)`).exec(html);
  if (def) { const r = resolveCssColor(html, def[1], depth + 1); if (r) return r; }
  return m[2] ? resolveCssColor(html, m[2], depth + 1) : null;
}

/** THE COLOUR THE PAGE ACTUALLY PAINTS ITS TEXT IN — read from the body rule, not
 *  guessed. The first cut picked the current ink by searching the palette for a colour
 *  that PASSED against the new background, which is circular: it always found one, always
 *  concluded nothing needed to change, and shipped evergreen's own #10271c text onto a
 *  #10271c background. Caught by rendering it, not by reading the code. */
function currentInkOf(html: string): string | null {
  for (const r of String(html || "").matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const sel = r[1].trim().toLowerCase();
    if (sel.startsWith("@") || !/(^|,)\s*(body|html)\s*(,|$)/.test(sel)) continue;
    const c = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(r[2]);
    if (c) { const v = resolveCssColor(html, c[1]); if (v) return v; }
  }
  return null;
}

/** EVERY colour the page paints text in, resolved through its own variables.
 *
 *  The body's `color` is ONE of them. On evergreen there are sixteen — headings use
 *  --green-deep, kickers --green, card copy #31473a — and each carries its own
 *  declaration, so moving the body ink rescues none of them. Checking only the body was
 *  how a dark background passed a 5.1:1 measurement while the h1 rendered invisible and
 *  "SERVICE PLANS" sat unreadable on it. Found by looking at the page at 390px; no
 *  amount of reading the contrast code would have shown it.
 */
function textColorsOf(html: string): string[] {
  const out = new Set<string>();
  for (const m of String(html || "").matchAll(/(?:^|[;{])\s*color\s*:\s*([^;}]+)/g)) {
    const v = m[1].trim();
    if (/^(inherit|currentcolor|transparent|unset|initial)/i.test(v)) continue;
    const r = resolveCssColor(html, v);
    if (r) out.add(r.toLowerCase());
  }
  return [...out];
}

export type KnobSetResult =
  | { ok: true; html: string; knob: KnobId; value: string; label: string; note?: string }
  | { ok: false; error: string; summary: string };

/**
 * Set one knob on a page, returning the new HTML for the caller to persist as a version.
 *
 * Stamps first if the page has never been stamped, so an owner never has to know whether
 * their page predates knobs. Refuses a value outside the knob's steps: the steps ARE the
 * guardrail, and accepting a raw value here would quietly reintroduce the pixel field
 * the interaction rule exists to prevent.
 */
export function setDesignKnob(html: string, knob: KnobId, value: string): KnobSetResult {
  const def = KNOBS[knob];
  if (!def) return { ok: false, error: "unknown_knob", summary: "That isn't something I can change." };
  // A withheld knob is refused at the WRITE, not just hidden in the UI: a control that
  // is only hidden is still reachable by anything that calls this.
  if (def.offered === false) {
    return { ok: false, error: "not_offered", summary: def.withheld || "I can't change that one yet." };
  }
  let out = String(html || "");
  if (!hasDesignKnobs(out)) out = stampDesignKnobs(out).html;

  const v = String(value).trim();
  if (def.steps && !def.steps.includes(v) && knob !== "background" && knob !== "ink") {
    return { ok: false, error: "not_a_step", summary: "That isn't one of the sizes I can set." };
  }

  // Contrast gate for the background, before anything is written.
  let note: string | undefined;
  let inkWrite: string | null = null;
  if (knob === "background") {
    if (!parseColor(v)) return { ok: false, error: "bad_colour", summary: "I couldn't read that colour." };
    const palette = pagePalette(out).map((p) => p.value);
    // The ink the page really paints, resolved through its own variables. NEVER a
    // palette entry chosen because it passes — that question answers itself.
    const currentInk = currentInkOf(out) || "#111111";

    // THE WHOLE PAGE HAS TO STAY READABLE, not just the body.
    //
    // The body ink is the one colour this knob can move, so it is excluded here and
    // rescued below. Every OTHER text colour belongs to the generator's design and this
    // control does not get to change it — so if the new background would put any of them
    // under the floor, the background is refused. In practice that keeps a background
    // inside the page's own lightness family, which is the honest boundary: turning a
    // light page dark is a redesign, not a knob, and pretending otherwise ships a site
    // whose headings have disappeared.
    const others = textColorsOf(out).filter((c) => c !== currentInk.toLowerCase());
    const failing = others
      .map((c) => ({ c, r: contrastRatio(v, c) }))
      .filter((x) => x.r !== null && (x.r as number) < CONTRAST_FLOOR);
    if (failing.length) {
      const worst = Math.min(...failing.map((f) => f.r as number));
      const safe = pagePalette(out)
        .filter((p) => others.every((c) => (contrastRatio(p.value, c) || 0) >= CONTRAST_FLOOR))
        .map((p) => p.value);
      return {
        ok: false,
        error: "contrast_page",
        summary:
          `That background would make ${failing.length} of the colours on your page unreadable against it ` +
          `(the worst lands at ${worst.toFixed(1)}:1, and text needs ${CONTRAST_FLOOR}:1), so I left it as it was.` +
          (safe.length ? ` These do work with the way your page is designed: ${safe.slice(0, 4).join(", ")}.` : ""),
      };
    }

    const resolved = resolveInkFor(v, currentInk, palette);
    if ("refuse" in resolved) return { ok: false, error: "contrast", summary: resolved.refuse };
    if (resolved.ink !== currentInk) {
      inkWrite = resolved.ink;
      note = `I moved the text colour with it so it stays readable (${resolved.ratio.toFixed(1)}:1).`;
    }
  }

  const write = (h: string, varName: string, val: string) => {
    const re = new RegExp(`(${varName}\\s*:\\s*)([^;}]*)`);
    if (re.test(h)) return h.replace(re, (_m, p1) => p1 + val);
    // Not present yet (a value knob has no default until first set) — add it to our
    // own :root block, never the model's.
    // `[^>]*` because the block now carries data-hubly-bound. An exact-tag match here
    // would silently stop finding our own :root and a first-time value knob would never
    // get written — the same shape of bug as the one this whole change is fixing.
    return h.replace(/(<style\s+data-hubly-knobs[^>]*>:root\{)/, (_m, p1) => `${p1}${varName}:${val};`);
  };

  out = write(out, def.varName, v);
  if (inkWrite) out = write(out, KNOBS.ink.varName, inkWrite);
  return { ok: true, html: out, knob, value: v, label: def.label, note };
}

/** Reset — one knob, or all of them, back to what the generator chose.
 *
 *  Cheap by construction: a scale's default is 1 and a value knob's default is the
 *  fallback already sitting in the declaration, so "reset" is deleting an override, not
 *  restoring a backup. It matters out of proportion to its size — being able to get back
 *  is what makes someone brave enough to try the controls at all, which is the entire
 *  point of having them. */
export function resetDesignKnob(html: string, knob?: KnobId): { html: string; reset: string[] } {
  let out = String(html || "");
  const ids = knob ? [knob] : (Object.keys(KNOBS) as KnobId[]);
  const reset: string[] = [];
  for (const id of ids) {
    const def = KNOBS[id];
    if (def.kind === "scale") {
      const re = new RegExp(`(${def.varName}\\s*:\\s*)([^;}]*)`);
      if (re.test(out)) {
        const before = out;
        out = out.replace(re, (_m, p1) => p1 + def.def);
        if (out !== before) reset.push(def.label);
      }
    } else {
      // A value knob resets by REMOVING the override so the declaration's own fallback —
      // the generator's original value — takes over again.
      const re = new RegExp(`${def.varName}\\s*:\\s*[^;}]*;?`, "g");
      if (re.test(out)) { out = out.replace(re, ""); reset.push(def.label); }
    }
  }
  return { html: out, reset };
}
