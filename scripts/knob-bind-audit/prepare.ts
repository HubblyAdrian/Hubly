// Prepare the HONEST measurement: for each page and each offered knob, the set of
// SELECTORS whose declarations read that knob's variable — plus whether any INLINE
// style attribute does (an inline style is, by definition, on a real element).
//
// The browser step then asks the only question that matters: does at least one element
// on this page actually match one of those selectors?
//
// @media bodies are FLATTENED, not skipped. A rule inside a media query still targets
// elements; whether it wins at a given width is a different question, and skipping
// at-rules wholesale is the exact mistake that made the image knob work on desktop and
// do nothing on a phone.
import { KNOBS, hasDesignKnobs, stampDesignKnobs, type KnobId }
  from "../../supabase/functions/_shared/hubly_design_knobs.ts";

// Re-export corpus.json into THIS folder before every run — see README.
const corpus = JSON.parse(await Deno.readTextFile(
  new URL("./corpus.json", import.meta.url))) as
  { format: string; html: string; kind: string; slug: string }[];
const pages = corpus.filter((p) => p.format === "html" && p.html && p.html.length > 500);
const OFFERED = (Object.keys(KNOBS) as KnobId[]).filter((k) => KNOBS[k].offered !== false);

/** Walk CSS with a brace counter, yielding (selector, declarations) and descending
 *  into at-rules so nested rules are seen with their own selectors. */
function* rules(css: string, depth = 0): Generator<{ sel: string; body: string }> {
  let i = 0, start = 0, brace = 0, selStart = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === "{") {
      if (brace === 0) { selStart = start; start = i + 1; }
      brace++;
    } else if (c === "}") {
      brace--;
      if (brace === 0) {
        const sel = css.slice(selStart, start - 1).trim();
        const body = css.slice(start, i);
        if (/^@(media|supports|layer|container)/i.test(sel)) {
          if (depth < 4) yield* rules(body, depth + 1);
        } else if (sel && !sel.startsWith("@")) {
          yield { sel, body };
        }
        start = i + 1;
      }
    }
    i++;
  }
}

const out: {
  slug: string; kind: string; html: string;
  sels: Record<string, string[]>; inline: Record<string, boolean>; stale?: string;
}[] = [];

for (const p of pages) {
  const html = hasDesignKnobs(p.html) ? p.html : stampDesignKnobs(p.html).html;
  const sels: Record<string, string[]> = {};
  const inline: Record<string, boolean> = {};
  // All stylesheet rules across every <style> block.
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const collected: Record<string, Set<string>> = {};
  for (const k of OFFERED) collected[k] = new Set();
  for (const r of rules(css)) {
    for (const k of OFFERED) {
      const v = KNOBS[k].varName;
      if (r.body.includes(`var(${v}`) || r.body.includes(`var( ${v}`)) {
        // Split a selector list so one unmatched member doesn't hide a matched one.
        for (const one of r.sel.split(",")) {
          const t = one.trim();
          if (t) collected[k].add(t);
        }
      }
    }
  }
  // Inline style attributes.
  const inlineStyles = [...html.matchAll(/\sstyle="([^"]*)"/gi)].map((m) => m[1]);
  for (const k of OFFERED) {
    const v = KNOBS[k].varName;
    inline[k] = inlineStyles.some((s) => s.includes(`var(${v}`));
    sels[k] = [...collected[k]];
  }
  out.push({ slug: p.slug, kind: p.kind, html, sels, inline });
}

// TWO POPULATIONS. `html` is the page stamped by the CURRENT pass. `stale` is the same
// page carrying our block but WITHOUT the wrappers or the recorded counts — what a page
// stamped by an older pass looks like, and where the bug actually lived. A run over the
// first population alone structurally cannot see it.
for (const o of out) {
  o.stale = o.html
    .replace(/calc\(\s*([^()]*?)\s*\*\s*var\(\s*--hubly-[a-z-]+-scale\s*,\s*1\s*\)\s*\)/g, "$1")
    .replace(/\sdata-hubly-bound="[^"]*"/, "");
}
await Deno.writeTextFile(new URL("./audit_input.json", import.meta.url), JSON.stringify(out));
console.log(`prepared ${out.length} pages`);
for (const k of OFFERED) {
  const withSel = out.filter((o) => o.sels[k].length > 0 || o.inline[k]).length;
  console.log(`  ${k.padEnd(14)} has a declaration on ${withSel}/${out.length} pages`);
}
