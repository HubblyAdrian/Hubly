/**
 * ABSENCE, ASSERTED SAFELY — the shared half of SETTLED rule 31.
 *
 * "THIS STRING IS GONE" OVER A WHOLE FILE WILL ALWAYS TRIP ON THE COMMENT EXPLAINING THE
 * DELETION. It has fired four times now: `openSmartQuote`, `toggleWsSvcCard`, once inside a check
 * of its own, and then leg 10 of check-band-rule-is-one-place — whose marker `p_band: 'B'` is
 * named in the comment that explains why it is gone. Every one of those was a red leg against a
 * CORRECT product, which is the expensive kind of false alarm: it sends someone to fix code that
 * is already right, and the second time it happens the honest response starts to look like
 * deleting the check.
 *
 * TWO DISCIPLINES, AND THEY ARE DIFFERENT:
 *   · `codeOf(src)`  — strip comments first. Prose about code is not code. This is the one that
 *                      applies ALWAYS, including to a genuinely file-wide claim ("this string
 *                      appears nowhere in the shipped page" is a legitimate assertion).
 *   · `bodyOf(src, decl)` — anchor the claim to the construct that carries it, brace-counted from
 *                      the declaration. Used when the claim is about one function, not the file.
 *                      Brace-counted rather than a character window, because a containment window
 *                      sized to a guess has already produced two false greens this week.
 *
 * A bare identifier is never a scope, and `confirm-served` already refuses one.
 */

/** Source with comments removed — JS line and block comments, and HTML comments.
 *
 *  ══ HTML IS HANDLED SEPARATELY, AND THAT IS NOT A REFINEMENT — IT IS A CORRECTNESS FIX. ═══════
 *
 *  The first version ran `/\*…*\/` over the WHOLE document. In `public/hubly.html` an attribute
 *  value at line 10337 contains a literal `/*` (`accept="ima…` follows `/*" onchange=…`), and the
 *  next `*\/` is **216,251 characters later** in a real JS comment. Everything between them —
 *  thousands of lines of markup, including `id="sq-record-list"` — was silently deleted, and a leg
 *  that looked for that markup reported the PRODUCT wrong.
 *
 *  **A stripper that removes what it was asked to preserve is the absent-vs-broken defect inside the
 *  tool built to prevent it.** So for HTML, comments are stripped only where they are comments: the
 *  `<!-- -->` form anywhere, and the JS/CSS forms only INSIDE `<script>` and `<style>` bodies.
 *
 *  A non-HTML source (a .ts, a .mjs, a .sql passed through) takes the plain path, unchanged. */
export function codeOf(src) {
  const text = String(src || "");
  const looksHtml = /^\s*(?:<!doctype|<html|<!--|<div|<script|<meta)/i.test(text) || /<\/html>|<\/body>/i.test(text);
  const stripJs = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (!looksHtml) return stripJs(text);
  // HTML: drop <!-- --> everywhere, then JS/CSS comments ONLY inside script/style bodies.
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
             (_, open, tag, body, close) => open + stripJs(body) + close);
}

/** The body of one function, brace-counted from its declaration. null when the declaration is not
 *  found — and a caller must treat null as CANNOT MEASURE, never as "the string is absent".
 *
 *  THE PARAMETER LIST IS SKIPPED BEFORE COUNTING, and that is not cosmetic. The first version took
 *  `src.indexOf("{", at)`, which for
 *
 *      async function writeAbandonedBookingRequest(opts={}){
 *
 *  found the `{` of the DEFAULT PARAMETER `opts={}`, counted one brace up and one down, and returned
 *  a body of exactly two characters: `{}`. Two absence legs then passed — vacuously, against a
 *  window containing no code at all — and one of them only failed because it also asserted a string
 *  was PRESENT. An absence assertion over an empty window is the worst false green available: it is
 *  green for every possible product.
 *
 *  So the parameter list is matched first, and a body that cannot be found returns null rather than
 *  something small. A caller that treats a 2-char window as a scope has been handed a probe failure
 *  wearing a pass. */
export function bodyOf(src, decl) {
  const s = String(src || "");
  const at = s.indexOf(decl);
  if (at < 0) return null;
  // Walk the parameter list to its matching ")", so a default value's braces cannot be mistaken
  // for the body's. If the declaration has no "(" before the first "{", it is not a function.
  const openParen = s.indexOf("(", at);
  const firstBrace = s.indexOf("{", at);
  let bodyStart;
  if (openParen >= 0 && (firstBrace < 0 || openParen < firstBrace)) {
    let i = openParen, depth = 0;
    for (; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") { depth--; if (depth === 0) break; }
    }
    if (i >= s.length) return null;
    bodyStart = s.indexOf("{", i);
  } else {
    bodyStart = firstBrace;
  }
  if (bodyStart < 0) return null;
  let i = bodyStart, depth = 0;
  for (; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") { depth--; if (depth === 0) return s.slice(bodyStart, i + 1); }
  }
  return null;
}

/** The two together: the code of one function body. */
export function codeInBody(src, decl) {
  const b = bodyOf(src, decl);
  return b === null ? null : codeOf(b);
}
