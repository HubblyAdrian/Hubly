/**
 * MOUNT A STORED PAGE THE WAY THE PRODUCT MOUNTS IT. One place, every harness.
 *
 * WHY THIS EXISTS (Lesson 37). On 2026-09-12 a sweep measured stored `rendered_html`
 * by rendering the bytes directly, concluded that seven pages had 29 bytes of CSS and
 * were therefore broken, and that conclusion was repeated to Adrian as fact. It was
 * false. The product mounts a page one of two ways, and the seven were the other one:
 *
 *   FULL DOCUMENT (starts with a doctype)  → a same-origin `srcdoc` iframe, sized to the
 *     viewport. Nothing outside reaches in, so all of its CSS must be in the page.
 *   AST FRAGMENT (no doctype)              → `innerHTML` on `#hc-doc-root`, where the app
 *     shell's own stylesheets apply: journey-os/hubly-document.css (a closed utility set
 *     scoped `#hc-doc-root .py-20{…}`) and journey-os/hubly-document-chrome.css.
 *
 * Rendering the stored bytes alone renders a document no customer ever sees. So no
 * measurement script chooses for itself any more — it calls mountAndEvaluate() and gets
 * back a frame that is mounted the way a person's browser mounts it.
 *
 * The predicate below is the SAME TEST as hcIsFullDocument in public/hubly.html, and
 * scripts/check-mount-predicate.mjs fails if the two ever drift apart. Two copies of one
 * fact is the bug we keep paying for; this is the copy we cannot delete (a browser file
 * cannot import from here), so it is the copy we check.
 */

/** THE MOUNT DECISION. Identical to hcIsFullDocument in public/hubly.html. */
export const FULL_DOCUMENT_RE = /^\s*(<!doctype\s+html|<html[\s>])/i;
export function isFullDocument(html) {
  return FULL_DOCUMENT_RE.test(String(html || ""));
}

/** The stylesheets the shell links for an AST page, in hubly.html's order. */
export const SHELL_STYLESHEETS = [
  "public/journey-os/hubly-document.css",
  "public/journey-os/hubly-document-chrome.css",
];

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The outer page for an AST fragment: the shell's stylesheets and #hc-doc-root,
 *  which is exactly what hcMountDocumentHtml sets innerHTML on. */
function astShell(html) {
  const links = SHELL_STYLESHEETS.map((p) => `<link rel="stylesheet" href="file://${join(ROOT, p)}">`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">${links}</head>` +
    `<body style="margin:0"><div id="hc-doc-root">${html}</div></body></html>`;
}

/** The outer page for a full document: #hc-doc-root holding the fixed, viewport-sized
 *  srcdoc iframe hcMountDocumentHtml builds. The page scrolls INSIDE this frame — that
 *  is the viewport a visitor actually has, and it is not the same as one the harness
 *  invents. */
function iframeShell() {
  return `<!doctype html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0"><div id="hc-doc-root"></div></body></html>`;
}

/**
 * Mount `html` the way the product would, then run `fn` in the frame that holds the page.
 *
 * Returns { format, value, frame, page } — `value` is fn's result, `frame` is the frame
 * the page lives in (the iframe's content frame for a full document, the main frame for
 * an AST fragment) so a caller can screenshot or probe further. The caller owns the
 * context and closes it.
 *
 *   const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
 *   const { format, value } = await mountAndEvaluate(ctx, html, () => document.title);
 *   await ctx.close();
 */
export async function mountAndEvaluate(context, html, fn, arg) {
  const page = await context.newPage();
  const full = isFullDocument(html);
  if (!full) {
    await page.setContent(astShell(html), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    return { format: "ast", page, frame: page.mainFrame(), value: await page.evaluate(fn, arg) };
  }
  await page.setContent(iframeShell(), { waitUntil: "domcontentloaded" });
  // Built exactly as hcMountDocumentHtml builds it: srcdoc (not a blob or data URL,
  // which would be an opaque origin and unreadable), fixed and filling the viewport.
  await page.evaluate((doc) => {
    const root = document.getElementById("hc-doc-root");
    root.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.setAttribute("data-hc-freeform", "1");
    frame.setAttribute("title", "Website");
    frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#fff;";
    root.appendChild(frame);
    frame.srcdoc = doc;
  }, html);
  // IMAGES LOADED. Aborting them makes an <img> fall back to its width attribute and
  // manufactures collapses that do not happen on the real page.
  await page.waitForTimeout(400);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (!frame) throw new Error("srcdoc frame never appeared");
  await frame.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { format: "full", page, frame, value: await frame.evaluate(fn, arg) };
}
