/**
 * ONE LEXER, TWO CHECKS. Extracted from no-directives.check.ts on 2026-09-14, when a second
 * check needed the same question answered: what are the actual string literals in this file?
 * Copying it would have meant two lexers drifting apart — and the whole reason this exists is
 * that the regex it replaced was wrong in a way nobody could see for months.
 */
/**
 * EVERY STRING LITERAL IN A SOURCE FILE, LEXED — not matched by a pairing regex.
 *
 * THE REGEX MISSED A WHOLE FILE'S WORTH OF SENTENCES AND NOBODY KNEW. The scan used to be
 * /`([^`]{20,500})`/g, which pairs backticks in document order: the first with the second, the
 * third with the fourth. One nested template (`${`…`}`) anywhere in the file flips the parity
 * of everything after it, so half the module's sentences were being read as the GAPS BETWEEN
 * literals and the other half not read at all. Proved 2026-09-14: appending
 * `Your page is ready. Click the Publish button in the top right.` to the owner module left
 * every net green while the scanned-sentence count went up by one — it was counted and not
 * seen. Double- and single-quoted strings were never scanned at all, so the same sentence in
 * "…" was invisible by construction.
 *
 * So: a lexer. It tracks comments, all three quote styles, escapes, and `${}` nesting inside
 * templates, and returns each literal's TEXT. A sentence an owner could read is a string in
 * this module, whatever quote it wears.
 */
export function stringLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  // depth stack: each entry is "`" for a template we are inside, "{" for a ${ } expression
  const stack: string[] = [];
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === "'" || c === '"') {
      const quote = c; let text = ""; i++;
      while (i < n) {
        if (src[i] === "\\") { text += src[i + 1] === "n" ? "\n" : src[i + 1]; i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        if (src[i] === "\n") break;                       // unterminated: not a literal
        text += src[i++];
      }
      out.push(text); continue;
    }
    if (c === "`") {
      i++; let text = "";
      while (i < n) {
        if (src[i] === "\\") { text += src[i + 1] === "n" ? "\n" : src[i + 1]; i += 2; continue; }
        if (src[i] === "`") { i++; break; }
        if (src[i] === "$" && src[i + 1] === "{") {
          // recurse through the expression, which may contain further templates
          i += 2; let depth = 1; const from = i;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            else if (src[i] === "`" || src[i] === "'" || src[i] === '"') {
              const q = src[i]; i++;
              while (i < n) { if (src[i] === "\\") { i += 2; continue; } if (src[i] === q) break; i++; }
            }
            i++;
          }
          for (const inner of stringLiterals(src.slice(from, Math.max(from, i - 1)))) out.push(inner);
          text += " \u2026 ";                              // the slot, not its contents
          continue;
        }
        text += src[i++];
      }
      out.push(text); continue;
    }
    i++;
  }
  if (stack.length) { /* unbalanced input: the literals collected so far still stand */ }
  return out;
}

