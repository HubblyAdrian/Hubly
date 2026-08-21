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
<!-- Hubly chat — injected by hubly_page_runtime.ts, not written by the model. -->
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
<script>
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

/** A booking button, for pages where the model placed none. */
function fallbackBookingHtml(bookUrl: string, accent: string): string {
  return `
<!-- Hubly booking entry — injected because the page had none. -->
<a data-hubly-runtime="book" href="${escapeAttr(bookUrl)}" target="_top"
   style="position:fixed;left:20px;bottom:20px;z-index:2147483000;background:${escapeAttr(accent)};color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.28);">Book online</a>`;
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
  const bookEls = scan.all.filter((el) =>
    el.name === "a" && ((el.attrs.href || "").trim() === BOOK_SENTINEL || (el.attrs.href || "").trim().startsWith(BOOK_SENTINEL + "?"))
  );
  const MAX_CTAS = 3;
  const keep = new Set<ScannedEl>();
  if (bookEls.length <= MAX_CTAS) {
    for (const el of bookEls) keep.add(el);
  } else {
    keep.add(bookEls[0]);                    // header
    keep.add(bookEls[1]);                    // hero
    keep.add(bookEls[bookEls.length - 1]);   // end
  }

  for (const el of bookEls) {
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
  const injectedFallbackCta = rewrittenCtas === 0;
  const payload =
    chatWidgetHtml({ businessId: ctx.businessId, businessName: ctx.businessName, supabaseUrl: ctx.supabaseUrl, publishableKey: ctx.publishableKey, accent }) +
    (injectedFallbackCta ? fallbackBookingHtml(bookBase, accent) : "");

  const closeBody = out.toLowerCase().lastIndexOf("</body>");
  out = closeBody === -1 ? out + payload : out.slice(0, closeBody) + payload + out.slice(closeBody);

  // 3. ASSERT. Same contract as the stamping pass.
  const after = scanHtml(out);
  const chatWidgets = after.all.filter((e) => e.attrs["data-hubly-runtime"] === "chat").length;
  const bookingEntries = after.all.filter((e) =>
    e.attrs["data-hubly-runtime"] === "book" || (e.name === "a" && (e.attrs.href || "").includes("book=1"))
  ).length;
  if (chatWidgets !== 1) {
    throw new Error(`hubly_page_runtime: expected exactly 1 chat widget, found ${chatWidgets}. This is a bug in the injection pass.`);
  }
  if (bookingEntries < 1) {
    throw new Error(`hubly_page_runtime: page has no way to book. This is a bug in the injection pass.`);
  }

  return { html: out, rewrittenCtas, injectedFallbackCta, chatWidgets };
}
