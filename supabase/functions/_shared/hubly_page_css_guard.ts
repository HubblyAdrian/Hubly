/**
 * A PAGE WITH NO STYLING MUST NEVER BE PRESENTED AS FINISHED.
 *
 * A generated page that reaches an owner unstyled is unrecoverable: they see the product
 * fail once, in the one moment the product has to be convincing. This refuses it at
 * generation, before anything is stored, and says so honestly — it never regenerates. A
 * silent retry doubles the cost, hides the defect, and changes the page out from under the
 * person (prohibition 1).
 *
 * IT IS FORMAT-GATED, AND THAT IS THE WHOLE DESIGN. A stored page is mounted one of two
 * ways (hcMountDocumentHtml, public/hubly.html):
 *
 *   full document (doctype) → a srcdoc iframe. Nothing outside reaches in, so every byte of
 *                             CSS it needs must be in the page. THIS is what the guard checks.
 *   AST fragment (no doctype) → innerHTML on #hc-doc-root, where the app shell's own
 *                             journey-os/hubly-document.css applies — 158KB of closed
 *                             utility CSS, scoped. Such a page carries ~29 bytes of its own
 *                             (the `--brand` hookup) and is perfectly healthy.
 *
 * The check written without that gate — "framework-shaped class names plus few style bytes"
 * — was measured against the corpus on 2026-09-12 and fired on seven pages, ALL of them
 * healthy AST pages, and on nothing else. Every hit would have been a false one, and a guard
 * whose every alarm is false is worse than no guard: it trains us to dismiss it.
 *
 * THE THRESHOLD IS FROM THE DISTRIBUTION, NOT FROM TASTE. Across all 167 stored pages:
 *
 *   full documents (160)   own <style> bytes: min 6,656 · median 11,892 · max 17,339
 *   AST fragments  (7)     own <style> bytes: min 0 · median 29 · max 29
 *
 * Nothing at all sits between 29 and 6,656 bytes. 2,000 is inside that empty gap — 3.3×
 * below the smallest real page and 70× above the largest fragment — so a healthy page would
 * have to lose two thirds of its stylesheet before this fires.
 *
 * CURRENT HITS: 0 of 160. That is the point, not a disappointment: it costs nothing until
 * the day a model stops emitting <style> or a prompt change breaks the page's head, and on
 * that day it is the difference between an honest failure and a live unstyled site.
 * Held by scripts/check-page-has-css.ts, which runs it over every stored page.
 */

/** THE MOUNT DECISION. Identical to hcIsFullDocument in public/hubly.html and to
 *  FULL_DOCUMENT_RE in scripts/lib/mount-as-product.mjs; the three are compared by
 *  scripts/check-mount-predicate.mjs, which goes red if any of them drifts. */
export const FULL_DOCUMENT_RE = /^\s*(<!doctype\s+html|<html[\s>])/i;
export function isFullDocument(html: string): boolean {
  return FULL_DOCUMENT_RE.test(String(html || ""));
}

/** Bytes of stylesheet the PAGE ITSELF carries. Our own injected blocks
 *  (`<style data-hubly-sv-css>`, the name-protection rule, the layout net) are excluded:
 *  they are ours, and a page standing up only because we propped it is still a page the
 *  model failed to design. */
export function pageOwnStyleBytes(html: string): number {
  let own = 0;
  const re = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html || "")))) {
    if (/data-hubly-/i.test(m[1])) continue;
    own += m[2].length;
  }
  return own;
}

/** The empty gap in the corpus distribution: 29 B (highest fragment) → 6,656 B (lowest
 *  real page). Moving this number is a decision about real pages and needs the
 *  distribution re-measured, not an opinion. */
export const MIN_OWN_STYLE_BYTES = 2000;

export type UnstyledVerdict = {
  refuse: boolean;
  format: "full" | "ast";
  bytes: number;
  /** A short code for the build job record — never model output. */
  reason?: string;
  /** What the person is told. Distinct and human, never "something went wrong". */
  ownerMessage?: string;
};

/**
 * Does this generated page have a stylesheet of its own, given how it will be mounted?
 *
 * An AST fragment is never refused here — its CSS is not supposed to be in the page, so
 * counting its bytes answers a question nobody asked. If a fragment path ever needs a
 * guard, the question there is whether the served closed stylesheet DEFINES the classes
 * the page uses (measured at 95–99% on the seven stored fragments), which is a different
 * check and not this one.
 */
export function unstyledPageVerdict(html: string): UnstyledVerdict {
  const s = String(html || "");
  if (!isFullDocument(s)) return { refuse: false, format: "ast", bytes: pageOwnStyleBytes(s) };
  const bytes = pageOwnStyleBytes(s);
  if (bytes >= MIN_OWN_STYLE_BYTES) return { refuse: false, format: "full", bytes };
  return {
    refuse: true,
    format: "full",
    bytes,
    reason: "generation_unstyled_no_css",
    ownerMessage:
      "The page came back without its styling — the layout was there but the design was not, " +
      "so it was not saved. Nothing on your site changed. Ask me to build it again and I will.",
  };
}
