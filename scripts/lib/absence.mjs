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

/** Source with comments removed — JS line and block comments, and HTML comments. A `//` inside a
 *  string or a URL is left alone by requiring the two slashes not to follow a colon. */
export function codeOf(src) {
  return String(src || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

/** The body of one function, brace-counted from its declaration. null when the declaration is not
 *  found — and a caller must treat null as CANNOT MEASURE, never as "the string is absent". */
export function bodyOf(src, decl) {
  const at = String(src || "").indexOf(decl);
  if (at < 0) return null;
  let i = src.indexOf("{", at), depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/** The two together: the code of one function body. */
export function codeInBody(src, decl) {
  const b = bodyOf(src, decl);
  return b === null ? null : codeOf(b);
}
