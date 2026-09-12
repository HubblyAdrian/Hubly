/**
 * RED-PROOF FOR THE UNSTYLED-PAGE GUARD.
 *
 * A guard whose every hit would be a false one is worse than no guard, and a guard that
 * has never gone red is a guard nobody knows works. This makes it go red on purpose,
 * against a SYNTHETIC page placed inside the empty gap in the corpus distribution —
 * 1,000 bytes of CSS, between the largest AST fragment (29 B) and the smallest real page
 * (6,656 B) — and confirms it stays green on every shape that is actually healthy.
 *
 *   deno run -A scripts/lib/page-css-guard.check.ts
 *
 * Exit: 0 PASS · 1 FAIL
 */
import { unstyledPageVerdict, pageOwnStyleBytes, MIN_OWN_STYLE_BYTES, isFullDocument } from "../../supabase/functions/_shared/hubly_page_css_guard.ts";

const fails: string[] = [];
const ok = (cond: unknown, msg: string) => { if (!cond) fails.push(msg); };

const css = (n: number) => `<style>${"a{color:#111}".padEnd(n, " ")}</style>`;
const doc = (head: string, body = "<h1>Ridge Paws</h1><p>Dog walking in Ogden.</p>") =>
  `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

// 1. THE RED CASE — a complete document, in the gap. This is the page the guard exists for.
{
  const page = doc(css(1000));
  const v = unstyledPageVerdict(page);
  ok(v.refuse === true, `RED CASE PASSED THE GUARD — a full document with ${v.bytes}B of CSS was accepted; the guard is inert`);
  ok(v.reason === "generation_unstyled_no_css", "the refusal carries no short code for the build-job record");
  ok(!!v.ownerMessage && !/something went wrong/i.test(v.ownerMessage), "the refusal has no distinct human message");
  ok(!/regenerat|try again automatically|retrying/i.test(v.ownerMessage || ""), "the refusal promises a retry — it must refuse, not regenerate");
}

// 2. A DOCUMENT WITH NO <style> AT ALL — the worst version of the same failure.
ok(unstyledPageVerdict(doc("")).refuse === true, "a complete document with no <style> at all was accepted");

// 3. JUST INSIDE THE FLOOR — the guard must not fire on a page that clears it.
{
  const v = unstyledPageVerdict(doc(css(MIN_OWN_STYLE_BYTES + 50)));
  ok(v.refuse === false, `a page with ${v.bytes}B (above the ${MIN_OWN_STYLE_BYTES}B floor) was refused`);
}

// 4. A REAL-SIZED PAGE — the shape of all 160 stored full documents.
ok(unstyledPageVerdict(doc(css(11000))).refuse === false, "a normal-sized page was refused");

// 5. THE SEVEN. An AST fragment carrying 29 bytes and hundreds of utility classes is
//    HEALTHY — its CSS is in the shell — and refusing it is the false alarm this guard
//    was rebuilt to avoid. This is the assertion that keeps the format gate honest.
{
  const fragment = `<style>#hc-doc-root{--brand:#c25a3a}</style>` +
    `<header class="hd-chrome-header"><span class="hd-brand-name">Hearth and Iron</span></header>` +
    `<section class="bg-brand-900 text-white py-20 px-6"><div class="max-w-6xl mx-auto"><h2>Bakes</h2></div></section>`;
  ok(isFullDocument(fragment) === false, "the fragment was read as a full document — the format gate is broken");
  const v = unstyledPageVerdict(fragment);
  ok(v.refuse === false, "AN AST FRAGMENT WAS REFUSED — this is exactly the seven-page false alarm, back again");
  ok(v.format === "ast", "the fragment was not reported as ast");
}

// 6. OUR OWN INJECTED CSS DOES NOT COUNT. A page propped up by the services-block
//    stylesheet is still a page the model failed to design.
{
  const propped = doc(`<style data-hubly-sv-css>${"b{color:#222}".padEnd(9000, " ")}</style>`);
  ok(pageOwnStyleBytes(propped) === 0, "a data-hubly- <style> block was counted as the page's own CSS");
  ok(unstyledPageVerdict(propped).refuse === true, "a page whose only CSS is ours was accepted as styled");
}

// 7. Byte counting is of CONTENT, not of the tag.
ok(pageOwnStyleBytes("<style>x{}</style>") === 3, "style bytes are being counted with the tag included");
ok(pageOwnStyleBytes("no styles here") === 0, "a page with no <style> did not measure zero");

if (fails.length) {
  console.error(`FAIL — ${fails.length} assertion(s):`);
  for (const f of fails) console.error("  " + f);
  Deno.exit(1);
}
console.log(`PASS — the guard refuses a synthetic ${1000}B page in the gap, leaves AST fragments and real pages alone, and does not count our own injected CSS.`);
