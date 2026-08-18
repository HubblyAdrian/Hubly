// Generates public/journey-os/hubly-document.css from the real, closed
// utility-class vocabulary in supabase/functions/_shared/hubly_document.ts —
// never hand-typed, so the prompt (what the AI is told), the validator
// (what's accepted), and this stylesheet (what it actually looks like) can
// never quietly drift apart. Re-run this after any change to that
// vocabulary: `deno run --allow-read --allow-write scripts/generate-hubly-document-css.ts`
//
// Every numeric value below is Tailwind's own public default theme value —
// this vocabulary was deliberately authored to match Tailwind's real scale
// names (xs/sm/base/lg.../7xl, the 0/1/2/3/4/5/6/8/10/12/16/20/24/32
// spacing steps, etc.), so implementing them means writing down already-
// standard, already-documented values, not inventing new ones. The only
// values NOT drawn from a public standard are the brand-color-scale mix
// percentages (a bounded, standard color-mix() interpolation technique
// applied to the business's own real brand_color — never a new color) and
// the ink/neutral scale, which reuses the dashboard's own already-shipped
// --ink/--ink-2/--ink-3/--ink-4 values (see hubly.html's :root), not new
// design decisions either.

import {
  SPACING_SCALE,
  SPACING_PREFIXES,
  TEXT_SIZES,
  FONT_WEIGHTS,
  TRACKING,
  LEADING,
  COLOR_ROLES,
  MAX_WIDTHS,
  GRID_COLS,
  COL_SPANS,
  RADII,
  ASPECTS,
  WIDTH_FRACTIONS,
} from "../supabase/functions/_shared/hubly_document.ts";

// Tailwind's real default spacing scale: 1 unit = 0.25rem.
const SPACING_REM: Record<string, string> = Object.fromEntries(
  SPACING_SCALE.map((v) => [v, v === "0" ? "0" : `${Number(v) * 0.25}rem`])
);

// Tailwind's real default type scale.
const TEXT_SIZE_REM: Record<string, string> = {
  xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem",
  "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem", "5xl": "3rem",
  "6xl": "3.75rem", "7xl": "4.5rem",
};

const FONT_WEIGHT_NUM: Record<string, string> = {
  normal: "400", medium: "500", semibold: "600", bold: "700", black: "900",
};

// Tailwind's real default letter-spacing scale.
const TRACKING_EM: Record<string, string> = {
  tighter: "-0.05em", tight: "-0.025em", normal: "0em", wide: "0.025em",
  wider: "0.05em", widest: "0.1em",
};

// Tailwind's real default line-height scale.
const LEADING_NUM: Record<string, string> = {
  none: "1", tight: "1.25", snug: "1.375", normal: "1.5", relaxed: "1.625", loose: "2",
};

// Tailwind's real default max-width scale.
const MAX_WIDTH_REM: Record<string, string> = {
  xs: "20rem", sm: "24rem", md: "28rem", lg: "32rem", xl: "36rem",
  "2xl": "42rem", "3xl": "48rem", "4xl": "56rem", "5xl": "64rem",
  "6xl": "72rem", "7xl": "80rem", full: "100%",
};

// Tailwind's real default border-radius scale.
const RADIUS_REM: Record<string, string> = {
  none: "0", sm: "0.125rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem",
  "2xl": "1rem", full: "9999px",
};
const RADIUS_DEFAULT = "0.25rem"; // bare "rounded"

const ASPECT_RATIO: Record<string, string> = {
  square: "1 / 1", video: "16 / 9", "[3/4]": "3 / 4", "[4/3]": "4 / 3", "[16/9]": "16 / 9",
};

const WIDTH_FRACTION_PCT: Record<string, string> = {
  full: "100%", "1/2": "50%", "1/3": "33.333333%", "2/3": "66.666667%",
  "1/4": "25%", "3/4": "75%",
};

// Real, already-shipped neutral scale — same values as hubly.html's own
// :root --ink/--ink-2/--ink-3/--ink-4 (light theme), reused verbatim, not
// re-decided. Generated customer-facing pages intentionally stay fixed to
// the light-theme values rather than following the admin dashboard's own
// day/night toggle — a real marketing/business site isn't meant to react
// to the business owner's personal dashboard theme preference.
const INK_SCALE: Record<string, string> = {
  "ink-900": "#141414", "ink-700": "#444444", "ink-400": "#888888", "ink-100": "#bbbbbb",
};

// Brand scale: every step derives from the business's own real --brand
// custom property (set per-document by renderHublyDocument, see
// hubly_document.ts) via color-mix() — the same technique the dashboard's
// existing --brand/--brand-dark/--brand-light theming already uses, just a
// finer-grained ladder. 500 is the real, unmixed brand color itself (the
// anchor); everything else is a standard, monotonic interpolation toward
// white (lighter steps) or black (darker steps) around it.
const BRAND_SCALE_CSS: Record<string, string> = {
  "brand-100": "color-mix(in srgb, var(--brand) 12%, white)",
  "brand-300": "color-mix(in srgb, var(--brand) 40%, white)",
  "brand-500": "var(--brand)",
  "brand-600": "color-mix(in srgb, var(--brand) 88%, black)",
  "brand-700": "color-mix(in srgb, var(--brand) 74%, black)",
  "brand-800": "color-mix(in srgb, var(--brand) 60%, black)",
  "brand-900": "color-mix(in srgb, var(--brand) 46%, black)",
};

function colorValue(role: string): string {
  if (role === "white") return "#ffffff";
  if (INK_SCALE[role]) return INK_SCALE[role];
  if (BRAND_SCALE_CSS[role]) return BRAND_SCALE_CSS[role];
  throw new Error(`No real value mapped for color role: ${role}`);
}

const lines: string[] = [];
lines.push("/* GENERATED FILE — do not hand-edit.");
lines.push(" * Source of truth: supabase/functions/_shared/hubly_document.ts");
lines.push(" * Regenerate: deno run --allow-read --allow-write scripts/generate-hubly-document-css.ts");
lines.push(" *");
lines.push(" * Backs the closed utility-class vocabulary the Hubly Document AI");
lines.push(" * generator/validator use — see the header comment in the generator");
lines.push(" * script for what's a real Tailwind-standard value vs. a derived one.");
lines.push(" */");
lines.push("");
lines.push("#hc-doc-root { --brand: #D9632D; font-family: 'Inter', sans-serif; color: #141414; }");
lines.push("#hc-doc-root .font-serif { font-family: 'DM Sans', serif; }");
lines.push("#hc-doc-root .font-sans { font-family: 'Inter', sans-serif; }");
lines.push("#hc-doc-root .font-mono { font-family: ui-monospace, monospace; }");
lines.push("#hc-doc-root img, #hc-doc-root video { max-width: 100%; display: block; }");
lines.push("");

function rule(selector: string, decl: string) {
  lines.push(`#hc-doc-root .${cssEscape(selector)} { ${decl} }`);
}

function cssEscape(cls: string): string {
  // Escapes characters Tailwind-style class names use that aren't valid
  // bare CSS identifier characters, so `.max-w-3xl` etc. stay simple while
  // `.aspect-[3/4]`-style tokens remain valid, addressable selectors.
  return cls.replace(/[:/[\].]/g, (m) => `\\${m}`);
}

function emitBaseRules() {
  // Spacing: p/pt/pb/pl/pr/px/py/m/mt/mb/ml/mr/mx/my/gap
  const SIDE_PROP: Record<string, string[]> = {
    p: ["padding"], pt: ["padding-top"], pb: ["padding-bottom"], pl: ["padding-left"], pr: ["padding-right"],
    px: ["padding-left", "padding-right"], py: ["padding-top", "padding-bottom"],
    m: ["margin"], mt: ["margin-top"], mb: ["margin-bottom"], ml: ["margin-left"], mr: ["margin-right"],
    mx: ["margin-left", "margin-right"], my: ["margin-top", "margin-bottom"],
    gap: ["gap"],
  };
  for (const prefix of SPACING_PREFIXES) {
    for (const v of SPACING_SCALE) {
      const props = SIDE_PROP[prefix];
      const decl = props.map((p) => `${p}: ${SPACING_REM[v]};`).join(" ");
      rule(`${prefix}-${v}`, decl);
    }
  }
  // margin auto — a distinct, non-numeric value, margin properties only.
  rule("m-auto", "margin: auto;");
  rule("mx-auto", "margin-left: auto; margin-right: auto;");
  rule("my-auto", "margin-top: auto; margin-bottom: auto;");

  for (const v of TEXT_SIZES) rule(`text-${v}`, `font-size: ${TEXT_SIZE_REM[v]};`);
  for (const v of FONT_WEIGHTS) rule(`font-${v}`, `font-weight: ${FONT_WEIGHT_NUM[v]};`);
  for (const v of TRACKING) rule(`tracking-${v}`, `letter-spacing: ${TRACKING_EM[v]};`);
  for (const v of LEADING) rule(`leading-${v}`, `line-height: ${LEADING_NUM[v]};`);

  for (const v of COLOR_ROLES) {
    const val = colorValue(v);
    rule(`text-${v}`, `color: ${val};`);
    rule(`bg-${v}`, `background-color: ${val};`);
    rule(`border-${v}`, `border-color: ${val};`);
  }

  for (const v of MAX_WIDTHS) rule(`max-w-${v}`, `max-width: ${MAX_WIDTH_REM[v]};`);
  for (const v of GRID_COLS) rule(`grid-cols-${v}`, `grid-template-columns: repeat(${v}, minmax(0, 1fr));`);
  for (const v of COL_SPANS) rule(`col-span-${v}`, `grid-column: span ${v} / span ${v};`);

  rule("rounded", `border-radius: ${RADIUS_DEFAULT};`);
  for (const v of RADII) rule(`rounded-${v}`, `border-radius: ${v === "full" ? "9999px" : RADIUS_REM[v]};`);

  for (const v of ASPECTS) rule(`aspect-${v}`, `aspect-ratio: ${ASPECT_RATIO[v]};`);

  for (const v of WIDTH_FRACTIONS) {
    rule(`w-${v}`, `width: ${WIDTH_FRACTION_PCT[v]};`);
    rule(`h-${v}`, `height: ${WIDTH_FRACTION_PCT[v]};`);
  }

  const layout: [string, string][] = [
    ["italic", "font-style: italic;"],
    ["uppercase", "text-transform: uppercase;"],
    ["lowercase", "text-transform: lowercase;"],
    ["capitalize", "text-transform: capitalize;"],
    ["text-left", "text-align: left;"],
    ["text-center", "text-align: center;"],
    ["text-right", "text-align: right;"],
    ["flex", "display: flex;"],
    ["grid", "display: grid;"],
    ["block", "display: block;"],
    ["inline-block", "display: inline-block;"],
    ["hidden", "display: none;"],
    ["flex-row", "flex-direction: row;"],
    ["flex-col", "flex-direction: column;"],
    ["flex-wrap", "flex-wrap: wrap;"],
    ["items-center", "align-items: center;"],
    ["items-start", "align-items: flex-start;"],
    ["items-end", "align-items: flex-end;"],
    ["justify-center", "justify-content: center;"],
    ["justify-between", "justify-content: space-between;"],
    ["justify-start", "justify-content: flex-start;"],
    ["justify-end", "justify-content: flex-end;"],
    ["justify-around", "justify-content: space-around;"],
    ["min-h-screen", "min-height: 100vh;"],
    ["object-cover", "object-fit: cover;"],
    ["object-contain", "object-fit: contain;"],
    ["overflow-hidden", "overflow: hidden;"],
    ["shadow", "box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);"],
    ["shadow-md", "box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);"],
    ["shadow-lg", "box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);"],
    ["shadow-xl", "box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);"],
    ["border", "border-width: 1px; border-style: solid; border-color: #e5e7eb;"],
    ["border-2", "border-width: 2px; border-style: solid; border-color: #e5e7eb;"],
    ["relative", "position: relative;"],
    ["absolute", "position: absolute;"],
    ["inset-0", "top: 0; right: 0; bottom: 0; left: 0;"],
    ["bg-gradient-to-br", "background-image: linear-gradient(to bottom right, var(--hc-grad-from), var(--hc-grad-to));"],
    ["bg-gradient-to-r", "background-image: linear-gradient(to right, var(--hc-grad-from), var(--hc-grad-to));"],
    ["bg-gradient-to-b", "background-image: linear-gradient(to bottom, var(--hc-grad-from), var(--hc-grad-to));"],
    // Added 2026-08-18 — see the ALLOWED_TAGS header in hubly_document.ts for
    // how these were found. Every one is a static declaration; none holds state.
    ["sticky", "position: sticky;"],
    ["fixed", "position: fixed;"],
    ["top-0", "top: 0;"],
    ["bottom-0", "bottom: 0;"],
    ["left-0", "left: 0;"],
    ["right-0", "right: 0;"],
    ["overflow-x-auto", "overflow-x: auto;"],
    ["overflow-y-auto", "overflow-y: auto;"],
    ["snap-x", "scroll-snap-type: x var(--hc-snap-strictness, proximity);"],
    ["snap-mandatory", "--hc-snap-strictness: mandatory;"],
    ["snap-start", "scroll-snap-align: start;"],
    ["snap-center", "scroll-snap-align: center;"],
    ["shrink-0", "flex-shrink: 0;"],
    ["break-inside-avoid", "break-inside: avoid;"],
    ["transition", "transition-property: color, background-color, border-color, opacity, transform, box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;"],
    ["duration-150", "transition-duration: 150ms;"],
    ["duration-300", "transition-duration: 300ms;"],
    ["duration-500", "transition-duration: 500ms;"],
    ["opacity-0", "opacity: 0;"],
    ["opacity-50", "opacity: 0.5;"],
    ["opacity-100", "opacity: 1;"],
    ["scale-95", "transform: scale(0.95);"],
    ["scale-100", "transform: scale(1);"],
    ["scale-105", "transform: scale(1.05);"],
    ["translate-y-0", "transform: translateY(0);"],
    ["translate-y-2", "transform: translateY(0.5rem);"],
    ["translate-y-4", "transform: translateY(1rem);"],
  ];
  for (const [cls, decl] of layout) rule(cls, decl);

    for (const n of ["2", "3", "4"]) rule(`columns-${n}`, `columns: ${n};`);
    for (const z of ["10", "20", "30", "40", "50"]) rule(`z-${z}`, `z-index: ${z};`);

  for (const step of ["500", "600", "700", "800"]) {
    rule(`from-brand-${step}`, `--hc-grad-from: ${colorValue(`brand-${step}`)};`);
  }
  for (const step of ["600", "700", "800", "900"]) {
    rule(`to-brand-${step}`, `--hc-grad-to: ${colorValue(`brand-${step}`)};`);
  }
}

emitBaseRules();

// Responsive variants (sm:/md:/lg:) — same base declarations, wrapped in
// real Tailwind-standard min-width breakpoints, generated from the exact
// same rule set above rather than hand-duplicated.
const BREAKPOINTS: Record<string, string> = { sm: "640px", md: "768px", lg: "1024px" };
const baseRuleLines = lines.slice(lines.findIndex((l) => l.startsWith("#hc-doc-root .")));
for (const [prefix, minWidth] of Object.entries(BREAKPOINTS)) {
  lines.push("");
  lines.push(`@media (min-width: ${minWidth}) {`);
  for (const l of baseRuleLines) {
    // Rewrite `#hc-doc-root .cls { decl }` -> `  #hc-doc-root .sm\:cls { decl }`
    const m = l.match(/^#hc-doc-root \.(\S+) \{ (.+) \}$/);
    if (!m) continue;
    lines.push(`  #hc-doc-root .${prefix}\\:${m[1]} { ${m[2]} }`);
  }
  lines.push("}");
}

  // Interaction variants. Same base declarations again, keyed to a pseudo-class
  // rather than a breakpoint. This is CSS, not behaviour: nothing here holds
  // state, and it covers the most ordinary affordance there is — a control that
  // responds to the cursor. Its absence is why "reveal an Add to cart button on
  // hover" came back as impossible when the visual half is one CSS rule.
  for (const pseudo of ["hover", "focus"]) {
    lines.push("");
    for (const l of baseRuleLines) {
      const m = l.match(/^#hc-doc-root \.(\S+) \{ (.+) \}$/);
      if (!m) continue;
      lines.push(`#hc-doc-root .${pseudo}\\:${m[1]}:${pseudo} { ${m[2]} }`);
    }
  }

const outPath = new URL("../public/journey-os/hubly-document.css", import.meta.url).pathname;
await Deno.writeTextFile(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${lines.length} lines to ${outPath}`);
