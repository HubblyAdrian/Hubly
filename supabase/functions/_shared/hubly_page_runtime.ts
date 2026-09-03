/**
 * Hubly's machinery, injected into a freeform page.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Booking, chat, forms and the map all attach by wiring from the parent shell
 * to `#hc-doc-root`. A freeform page is a whole document inside an iframe, so
 * nothing reaches it — measured, not assumed: `reservedInParent: 0,
 * reservedInsideIframe: 0`. Every freeform page we have generated is a
 * brochure with a phone number on it.
 *
 * So the machinery goes INSIDE the page. Same principle that made labelling
 * work: the model is never responsible for it, so it cannot be missing.
 *
 * TWO DIFFERENT ANSWERS, BECAUSE THEY ARE DIFFERENT THINGS
 *
 *   CHAT is genuinely self-containable. `chatbot-message` is one Edge Function
 *   call needing only a business_id, so the widget injected here talks straight
 *   to the backend. It has no dependency on the parent at all and works if the
 *   page is opened standalone.
 *
 *   BOOKING is not. The wizard is a multi-step flow (service, address, date,
 *   deposit, payment) living in hubly.html, and rebuilding it inside every
 *   generated page would be a second implementation of the most
 *   correctness-sensitive thing the product does. Instead booking now has a
 *   real URL — `?book=1&svc=…`, added to initApp — and the page links to it
 *   with target="_top". A link is not "wiring from the parent": it works from
 *   an email or a QR code too.
 *
 * WHO PLACES WHAT
 *
 *   The model places the booking CTA, because where a Book button belongs is a
 *   design decision that differs by trade. It marks it `href="#hubly-book"`.
 *   This pass REWRITES that href to the real URL — it does not add a second
 *   button. If the model placed none, this pass injects one, so a page without
 *   a way to book is impossible rather than unlikely.
 *
 *   The model never places chat. It is told not to design one. This pass owns
 *   it, injects exactly one, and would strip a second.
 */

import { scanHtml, spliceAll, type ScannedEl, type Splice } from "./hubly_html_scan.ts";

/** The sentinel the generation prompt asks the model to use for a booking CTA. */
export const BOOK_SENTINEL = "#hubly-book";

export interface RuntimeInjectionResult {
  html: string;
  /** Booking CTAs whose href was rewritten to the real URL. */
  rewrittenCtas: number;
  /** True when this pass had to add a booking entry because the page had none. */
  injectedFallbackCta: boolean;
  chatWidgets: number;
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The chat widget. Deliberately dependency-free, inline, and small enough to
 * read: no framework, no external request, no reliance on anything in the
 * parent document. It posts to `chatbot-message` exactly as hubly.html's
 * `.ws-chat-panel` does, with the same three fields.
 */
function chatWidgetHtml(opts: { businessId: string; businessName: string; supabaseUrl: string; publishableKey: string; accent: string }): string {
  const { businessId, businessName, supabaseUrl, publishableKey, accent } = opts;
  // JSON-encoded so a quote or a backslash cannot break out of the config.
  //
  // AND `<` re-escaped to \u003c, which JSON.stringify does NOT do. A business
  // name is user input: it comes from a sentence somebody typed. A name
  // containing `</script><script>alert(1)</script>` closes this script tag and
  // everything after it is executable markup on every visitor's page. The HTML
  // parser looks for the literal characters `</script`, so escaping `<` inside
  // the JS string literal is what actually closes the hole — quoting does not,
  // because the parser never sees the quotes.
  const cfg = JSON.stringify({ businessId, businessName, supabaseUrl, publishableKey, accent })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `
<div id="hubly-chat" data-hubly-runtime="chat" style="position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <button id="hubly-chat-fab" type="button" aria-label="Chat with ${escapeAttr(businessName)}"
    style="width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:${escapeAttr(accent)};color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:0;">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  </button>
  <!-- display:none, NOT the hidden attribute: an inline display:flex beats the
       UA's [hidden]{display:none} rule, so the panel shipped permanently open
       and empty -- the greeting only renders when open() runs. -->
  <div id="hubly-chat-panel"
    style="position:absolute;right:0;bottom:68px;width:min(340px,calc(100vw - 40px));max-height:min(460px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.26);overflow:hidden;">
    <div style="padding:13px 15px;background:${escapeAttr(accent)};color:#fff;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <span>${escapeAttr(businessName)}</span>
      <button id="hubly-chat-close" type="button" aria-label="Close chat" style="background:none;border:none;color:inherit;font-size:20px;line-height:1;cursor:pointer;padding:0 2px;">&times;</button>
    </div>
    <div id="hubly-chat-log" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff;"></div>
    <form id="hubly-chat-form" style="display:flex;gap:8px;padding:10px;border-top:1px solid #eef1f5;background:#fff;">
      <input id="hubly-chat-input" type="text" autocomplete="off" placeholder="Type a message…"
        style="flex:1;padding:9px 11px;border:1px solid #d8dee7;border-radius:9px;font-size:14px;font-family:inherit;color:#111;background:#fff;min-width:0;">
      <button type="submit" style="background:${escapeAttr(accent)};color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;">Send</button>
    </form>
  </div>
</div>
<script data-hubly-runtime="chat-script">
(function(){
  var CFG = ${cfg};
  var root = document.getElementById('hubly-chat');
  if (!root || root.getAttribute('data-wired') === '1') return;
  root.setAttribute('data-wired','1');
  var fab = document.getElementById('hubly-chat-fab');
  var panel = document.getElementById('hubly-chat-panel');
  var log = document.getElementById('hubly-chat-log');
  var form = document.getElementById('hubly-chat-form');
  var input = document.getElementById('hubly-chat-input');
  var messages = [];
  var conversationId = null;
  var busy = false;

  function bubble(text, mine){
    var d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = 'max-width:85%;padding:9px 11px;border-radius:12px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;' +
      (mine ? 'align-self:flex-end;background:' + CFG.accent + ';color:#fff;' : 'align-self:flex-start;background:#f1f4f8;color:#111;');
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function isOpen(){ return panel.style.display !== 'none'; }
  function open(){
    panel.style.display = 'flex';
    if (!messages.length) bubble("Hi! I'm " + CFG.businessName + "'s assistant. What can I help you with?", false);
    input.focus();
  }
  fab.addEventListener('click', function(){ isOpen() ? (panel.style.display = 'none') : open(); });
  document.getElementById('hubly-chat-close').addEventListener('click', function(){ panel.style.display = 'none'; });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var text = (input.value || '').trim();
    if (!text || busy) return;
    input.value = '';
    bubble(text, true);
    // 'customer', NOT 'user'. chatbot-message validates the last message with
    // \`lastMsg.role !== "customer"\` and 400s otherwise -- checked in the
    // function, not assumed from the shape of every other chat API.
    messages.push({ role: 'customer', content: text });
    busy = true;
    var thinking = bubble('…', false);
    fetch(CFG.supabaseUrl + '/functions/v1/chatbot-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: CFG.publishableKey },
      body: JSON.stringify({ business_id: CFG.businessId, conversation_id: conversationId, messages: messages })
    }).then(function(r){ return r.json(); }).then(function(j){
      if (j && j.conversation_id) conversationId = j.conversation_id;
      var reply = (j && (j.reply || j.message || j.text)) || "Sorry — I couldn't answer that just now. Please call us instead.";
      thinking.textContent = reply;
      messages.push({ role: 'assistant', content: reply });
    }).catch(function(){
      thinking.textContent = "Sorry — I couldn't reach the assistant. Please call us instead.";
    }).then(function(){ busy = false; });
  });
})();
</script>`;
}

/**
 * CTA-TEXT-CONTRAST RESCUE (named for exactly what it repairs, not "contrast check").
 *
 * It repairs ONE failure mode: a button/CTA whose TEXT is unreadable against its own
 * background (the observed bug: "Book online" as near-black text on a near-black pill,
 * measured at ratio ~1.1–1.6). It recolours ONLY that text — nothing else on the page,
 * no backgrounds, no non-button text.
 *
 * Why it runs in the page instead of a server pass: contrast needs the RESOLVED cascade
 * — CSS variables, transparency, inheritance, the element's real ancestor background.
 * The server has the HTML string but not the computed styles; the browser has both. So
 * this asks the browser (getComputedStyle) rather than parsing CSS, which is the only way
 * to get it right for var()-based and transparent-on-coloured-header cases.
 *
 * Honest scope + limits, recorded not assumed (prohibition 2 / rule):
 *  - It acts only on genuinely UNREADABLE CTAs (contrast < 3.0, the WCAG floor for large/UI
 *    text). CTAs in the 3.0–4.5 "sub-AA but legible" band are LEFT ALONE and counted, not
 *    silently "handled".
 *  - When it can't reach AA by flipping to white or near-black — a mid-tone or image/gradient
 *    background where neither works — it does NOT touch the element and records it as
 *    could-not-fix, with the reason.
 *  - It reports its outcome two ways: a console line, and a data-hubly-cta-contrast attribute
 *    on <html> (fixed / left-sub-aa / could-not-fix counts), so what it did and did NOT do is
 *    inspectable, never a belief nobody checked.
 *  - Known downside: it runs on DOMContentLoaded, so a page can paint the unreadable colour
 *    for a moment before the rescue lands (a brief flash). And it is Hubly's code adjusting the
 *    owner's design at runtime — but only to make an illegible action legible, reversibly (the
 *    stored HTML is unchanged; nothing here regenerates anything).
 *  - Our own injected furniture ([data-hubly-runtime]) is excluded — we own those.
 */
export function contrastRescueHtml(): string {
  return `
<script data-hubly-runtime="contrast">
(function(){
  function run(){
    try{
      var MIN_READABLE = 3.0, TARGET_AA = 4.5;
      function chan(v){ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
      function lum(c){ return 0.2126*chan(c[0])+0.7152*chan(c[1])+0.0722*chan(c[2]); }
      function parse(s){ var m=s&&s.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; var p=m[1].split(',').map(function(x){return parseFloat(x);}); return {rgb:[p[0],p[1],p[2]], a:p.length>3?p[3]:1}; }
      function ratio(a,b){ var L1=lum(a),L2=lum(b),hi=Math.max(L1,L2),lo=Math.min(L1,L2); return (hi+0.05)/(lo+0.05); }
      function effBg(el){ var n=el; while(n && n.nodeType===1){ var cs=getComputedStyle(n); if(cs.backgroundImage && cs.backgroundImage!=='none') return {image:true}; var bg=parse(cs.backgroundColor); if(bg && bg.a>0) return {rgb:bg.rgb}; n=n.parentElement; } return {rgb:[255,255,255]}; }
      var sel='a.button,a.btn,button,.button,.btn,[class*="button"],[class*="btn"],[role="button"]';
      var els=document.querySelectorAll(sel);
      var fixed=0, leftSubAA=0, couldNotFix=0, unfixReasons={};
      for(var i=0;i<els.length;i++){
        var el=els[i];
        if(el.closest('[data-hubly-runtime]')) continue;      // our furniture, not the model's
        var cs=getComputedStyle(el);
        var fg=parse(cs.color); if(!fg) continue;
        var bgc=effBg(el);
        if(bgc.image){ couldNotFix++; unfixReasons.imageBg=(unfixReasons.imageBg||0)+1; continue; }
        var cur=ratio(fg.rgb,bgc.rgb);
        if(cur>=TARGET_AA) continue;                          // already fine
        if(cur>=MIN_READABLE){ leftSubAA++; continue; }        // legible but sub-AA: leave it, count it
        // unreadable — try white then near-black, take whichever is best
        var white=[255,255,255], ink=[17,17,17];
        var rW=ratio(white,bgc.rgb), rI=ratio(ink,bgc.rgb);
        var best=rW>=rI?{c:'#ffffff',r:rW}:{c:'#111111',r:rI};
        // Apply the best of white/near-black if it makes the text READABLE (>= 3.0, the
        // WCAG floor for large/UI text) and actually improves on the current ratio. The
        // goal is legibility, not AA-perfection: on a mid-tone background where neither
        // pure colour reaches 4.5, going 1.4 -> 4.4 is still the difference between
        // invisible and readable, and refusing it would leave the button unreadable.
        if(best.r>=MIN_READABLE && best.r>cur){ el.style.setProperty('color',best.c,'important'); fixed++; }
        else { couldNotFix++; unfixReasons.midToneBg=(unfixReasons.midToneBg||0)+1; }  // even best stays unreadable
      }
      var summary='fixed:'+fixed+';left-sub-aa:'+leftSubAA+';could-not-fix:'+couldNotFix;
      document.documentElement.setAttribute('data-hubly-cta-contrast', summary);
      if(fixed||couldNotFix) console.log('[hubly] cta-text-contrast-rescue', summary, unfixReasons);
    }catch(e){ /* a rescue must never break the page */ }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
</script>`;
}

/** Does this page already give a visitor a way to book?
 *
 *  ONE predicate, shared by the decision to inject a fallback CTA and by the assertion
 *  that the page has a way to book. They were separate expressions that happened to
 *  agree on a freshly generated page and disagreed on a stored one — the decision asked
 *  "did I rewrite a sentinel just now", which is a fact about this pass, not about the
 *  page. Counts both our own injected entry and a real `?book=1` link the pass rewrote
 *  on some earlier run. */
function countBookingEntries(els: ScannedEl[]): number {
  return els.filter((e) =>
    e.attrs["data-hubly-runtime"] === "book" ||
    (e.name === "a" && (e.attrs.href || "").includes("book=1"))
  ).length;
}

/** A booking button, for pages where the model placed none. */
function fallbackBookingHtml(bookUrl: string, accent: string): string {
  return `
<a data-hubly-runtime="book" href="${escapeAttr(bookUrl)}" target="_top"
   style="position:fixed;left:20px;bottom:20px;z-index:2147483000;background:${escapeAttr(accent)};color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.28);">Book online</a>`;
}

// PROVENANCE LIVES ON THE ELEMENT, NOT IN A COMMENT.
// These blocks used to be introduced by an HTML comment ("<!-- Hubly chat — injected
// by ... -->"). A comment cannot carry an attribute, so stripHublyRuntime could not
// remove it, and every strip/re-inject cycle left another orphaned comment behind —
// the page grew 166 bytes per re-stamp and the cycle was not a fixed point. The rule
// that falls out is simple and general: IF WE CANNOT MARK IT, WE DO NOT INJECT IT.
// data-hubly-runtime says whose it is, and unlike a comment it is machine-checkable.
/**
 * THE PRECISE INVERSE OF THE INJECTION — remove every piece of Hubly's own furniture,
 * leaving the model's page as the sanitiser and the labeller expect to see it.
 *
 * WHY THIS EXISTS. `sanitizeFreeformHtml` runs on MODEL OUTPUT and strips every form,
 * field and script, because a generated page has no legitimate reason to contain one.
 * That contract is correct and must not be weakened. But it means a STORED page — which
 * is model output *plus* our injected chat widget and contrast script — cannot be fed
 * back through the labeller without our own furniture being destroyed. Measured
 * 2026-09-02: doing exactly that would have stripped the chat widget from 98 of 107
 * pages.
 *
 * WHY NOT AN ALLOWLIST IN THE SANITISER. The only handle available is this attribute,
 * and THE MODEL AUTHORS THE MARKUP. A rule saying "content carrying data-hubly-runtime
 * is exempt" hands the model the key: emit `<div data-hubly-runtime="chat"><form>…`
 * and the credential-harvesting pass waves it through. You cannot allowlist by a marker
 * that untrusted content can write. So the order is: strip ours, sanitise + stamp what
 * remains, re-inject ours — the same order generation already runs in, replayed.
 *
 * WHY EVERY PIECE IS MARKED. This function used to be impossible to write correctly:
 * the chat <div> carried the attribute but neither <script> did, so identifying them
 * meant grepping their source for `MIN_READABLE` — content-sniffing, which is banned
 * here for the same reason it is banned everywhere else. Both scripts now carry the
 * marker, so this is an attribute query rather than a guess.
 *
 * EACH PIECE GETS A DISTINCT VALUE — "chat" (the widget div), "chat-script",
 * "contrast", "book". The strip wants "everything we injected"; the injection assertion
 * wants "exactly one chat WIDGET". Marking the script "chat" too made that assertion
 * count two and fail on all 129 stored pages — the assertion catching a bug introduced
 * one function away, which is what it is for. One attribute, distinct values, both
 * questions answerable.
 */
export function stripHublyRuntime(html: string): { html: string; removed: number } {
  const src = String(html || "");
  const scan = scanHtml(src);
  // Outermost-first, so a marked node inside another marked node is not double-cut.
  const marked = scan.all.filter((e) => typeof e.attrs["data-hubly-runtime"] === "string");
  const tops = marked.filter((e) => {
    for (let p = e.parent; p; p = p.parent) if (marked.includes(p)) return false;
    return true;
  });
  if (!tops.length) return { html: src, removed: 0 };
  // SWALLOW THE WHITESPACE WE BROUGHT WITH US. Each injected block begins with a
  // newline, so cutting the element alone leaves that newline behind and the next
  // injection adds another: measured at +3 bytes per strip/re-inject cycle, growing
  // without bound over repeated re-stamps and — more to the point — making the cycle
  // not a fixed point, which is the property the whole re-stamp path rests on.
  const cuts: Splice[] = tops.map((e) => {
    let start = e.openStart;
    while (start > 0 && /\s/.test(src[start - 1])) start--;
    return { start, end: e.closeEnd, text: "" };
  });
  return { html: spliceAll(src, cuts), removed: tops.length };
}

export interface RuntimeContext {
  businessId: string;
  businessName: string;
  slug: string;
  supabaseUrl: string;
  publishableKey: string;
  accent?: string;
  /** Used to preselect a service when the model links a specific one. */
  serviceNames?: string[];
}

/**
 * Inject Hubly's runtime into a generated page.
 *
 * Coverage is guaranteed by construction and then asserted, the same way label
 * stamping is: a generated page with no chat widget, or no way to book, is
 * impossible rather than unlikely. If the assertion fires it means this pass
 * has a bug — it is never resolved by regenerating the page.
 */
export function injectHublyRuntime(html: string, ctx: RuntimeContext): RuntimeInjectionResult {
  const src = String(html || "");
  const accent = ctx.accent && /^#[0-9a-f]{3,8}$/i.test(ctx.accent) ? ctx.accent : "#1a3a6e";
  const bookBase = `https://${ctx.slug}.${(Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "myhubly.app")}/?book=1`;

  const scan = scanHtml(src);
  const edits: Splice[] = [];
  let rewrittenCtas = 0;

  // 1. THE MODEL'S BOOKING CTAs. Rewrite the ones we keep, remove the surplus.
  //
  // CAP AT THREE PRIMARY BOOKING CTAs. Earlier builds placed 6–7 per page, which
  // reads as spam. The target is one in the header, one in the hero, one at the
  // end — and in document order that is the first two markers plus the last.
  // Enforced here deterministically (never by regenerating — see the standing
  // rule in KNOWN_ISSUES): the model is also asked for three, but the pass is
  // what makes it true. Secondary links ("view services") carry no sentinel and
  // are untouched.
  const allBookEls = scan.all.filter((el) =>
    el.name === "a" && ((el.attrs.href || "").trim() === BOOK_SENTINEL || (el.attrs.href || "").trim().startsWith(BOOK_SENTINEL + "?"))
  );

  // THE CAP IS FOR LOOSE CTAs, NOT FOR A GRID OF SERVICE CARDS.
  //
  // A card that shows a service and a price and has no button cannot sell anything.
  // On evergreen the cap left ONE card with a "Book Basic Mow" button and six cards
  // without — a price a customer can read and no way to act on it. That is the
  // opposite of what the cap is for: it exists because early builds sprayed 6-7
  // standalone CTAs down a brochure page and it read as spam.
  //
  // A card CTA is identifiable from data already on the page at this point, so this
  // is not layout re-recognition: markServiceAnchorsInFreeform runs BEFORE this pass,
  // so a service card is an element containing a data-hubly-service anchor. A sentinel
  // carrying its own svc= parameter is the same signal from the other direction — the
  // model naming which service this button books.
  const isCardCta = (el: ScannedEl): boolean => {
    if ((el.attrs.href || "").includes("svc=")) return true;
    for (let p = el.parent; p; p = p.parent) {
      if (typeof p.attrs["data-hubly-service"] === "string") return true;
      // Stop at the band: past it we are looking at the page, not a card.
      if (typeof p.attrs["data-hc-section"] === "string") break;
      const kids = p.children || [];
      if (kids.some((k) => typeof k.attrs["data-hubly-service"] === "string")) return true;
    }
    return false;
  };
  const cardCtas = allBookEls.filter(isCardCta);
  const bookEls = allBookEls.filter((el) => !isCardCta(el));

  const MAX_CTAS = 3;
  const keep = new Set<ScannedEl>(cardCtas);   // every card keeps its own button
  if (bookEls.length <= MAX_CTAS) {
    for (const el of bookEls) keep.add(el);
  } else {
    keep.add(bookEls[0]);                    // header
    keep.add(bookEls[1]);                    // hero
    keep.add(bookEls[bookEls.length - 1]);   // end
  }

  // Iterate EVERY sentinel, not just the capped ones: a card CTA is in `keep` but
  // not in `bookEls`, so looping the capped list left card buttons pointing at the
  // dead `#hubly-book` sentinel — kept on the page and inert. Caught by counting
  // rewritten links rather than surviving ones.
  for (const el of allBookEls) {
    if (!keep.has(el)) {
      // Surplus CTA: remove the whole <a>…</a>. Booking stays reachable from the
      // kept ones, so nothing is orphaned.
      edits.push({ start: el.openStart, end: Math.max(el.closeEnd, el.openEnd), text: "" });
      continue;
    }
    const href = (el.attrs.href || "").trim();
    // Preserve a service the model named: #hubly-book?svc=Half-day%20coverage
    let target = bookBase;
    const q = href.indexOf("?");
    if (q !== -1) {
      const svc = new URLSearchParams(href.slice(q + 1)).get("svc");
      if (svc) target += `&svc=${encodeURIComponent(svc)}`;
    }
    const r = el.attrRanges["href"];
    if (r) edits.push({ start: r.start, end: r.end, text: ` href="${escapeAttr(target)}"` });
    // target="_top" or the click navigates the IFRAME, and the visitor ends up
    // with the booking wizard rendered inside a 100%-height frame on a page
    // that still thinks it is showing a website.
    if (!el.attrRanges["target"]) {
      edits.push({ start: el.attrInsertAt, end: el.attrInsertAt, text: ` target="_top"` });
    }
    rewrittenCtas++;
  }

  let out = edits.length ? spliceAll(src, edits) : src;

  // 2. THE RUNTIME ITSELF, appended just before </body> (or at the end if the
  //    model wrote no body tag — it is not required to).
  //
  // THE FALLBACK IS FOR "NO WAY TO BOOK", NOT "NO SENTINEL REWRITTEN THIS PASS".
  //
  // This used to be `rewrittenCtas === 0`, which is the same thing ONLY on a fresh
  // generation. Rewriting is a MUTATION of the model's own markup: `#hubly-book`
  // becomes a real `?book=1` URL. Run this pass a second time over a stored page and
  // there are no sentinels left to rewrite — so the old test concluded "no booking
  // entry" about a page covered in working booking links, and appended a second,
  // fixed-position CTA. Every re-stamp would have added one more.
  //
  // The honest question is whether the page HAS a way to book, which is exactly what
  // the assertion below already asks. One predicate, used by both, so the thing that
  // decides and the thing that verifies cannot drift apart.
  const existingBookingEntries = countBookingEntries(scan.all);
  const injectedFallbackCta = rewrittenCtas === 0 && existingBookingEntries === 0;
  const payload =
    chatWidgetHtml({ businessId: ctx.businessId, businessName: ctx.businessName, supabaseUrl: ctx.supabaseUrl, publishableKey: ctx.publishableKey, accent }) +
    (injectedFallbackCta ? fallbackBookingHtml(bookBase, accent) : "") +
    // Recolours only unreadable button/CTA text at runtime (see contrastRescueHtml).
    // New pages only — existing stored pages carry the older runtime without it.
    contrastRescueHtml();

  const closeBody = out.toLowerCase().lastIndexOf("</body>");
  out = closeBody === -1 ? out + payload : out.slice(0, closeBody) + payload + out.slice(closeBody);

  // 3. ASSERT. Same contract as the stamping pass.
  const after = scanHtml(out);
  const chatWidgets = after.all.filter((e) => e.attrs["data-hubly-runtime"] === "chat").length;
  const bookingEntries = countBookingEntries(after.all);
  if (chatWidgets !== 1) {
    throw new Error(`hubly_page_runtime: expected exactly 1 chat widget, found ${chatWidgets}. This is a bug in the injection pass.`);
  }
  if (bookingEntries < 1) {
    throw new Error(`hubly_page_runtime: page has no way to book. This is a bug in the injection pass.`);
  }

  return { html: out, rewrittenCtas, injectedFallbackCta, chatWidgets };
}
