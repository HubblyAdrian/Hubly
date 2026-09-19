/**
 * THE ONE PARSER AND THE ONE FORMATTER FOR A SERVICE PRICE, read by BOTH shells.
 *
 * RULED BY ADRIAN, 2026-09-18: "Accept what a human types — separators, currency symbol, spaces —
 * parse it to a number, store the number, render it through svcDisplayPrice. One value, one
 * formatter, one rendering, everywhere. If a typed value cannot be parsed to a number, REFUSE IT AND
 * SAY SO at the point of entry. Do not store an unparseable string and do not silently substitute
 * zero."
 *
 * WHY IT IS A SHARED FILE AND NOT A FUNCTION IN EACH SHELL. It shipped in hubly.html first, for the
 * canvas's inline price edit. Then the SAME parse turned out to be needed in platform-home.html, in
 * the "Edit details" panel, which was doing `priceRaw ? Number(priceRaw) : null` — and `Number('$95')`
 * is NaN, as is `Number('111.222.333')`. Two shells, one rule: that is the status-words.js situation
 * exactly (five quote words hand-maintained in both files), and the answer is the same one.
 *
 * ONE CALLER MUST NEVER SEE A DIFFERENT ANSWER FROM THE OTHER. That is the whole point, and it is why
 * this is not "a helper" — it is the definition of what a price IS in this product.
 */
(function () {
  var W = typeof window !== "undefined" ? window : globalThis;

  /** Accepts what a human types. Returns a Number, or null for anything it cannot read.
   *
   *  null AND NOT 0. A zero is a PRICE — it renders as $0 and a customer can act on it — so
   *  substituting one for "I could not understand this" would publish a number the owner never
   *  typed, which is the 801-888-8888 defect with a different field.
   *
   *  DELIBERATELY NOT parseFloat: parseFloat('50 dollars') is 50 and parseFloat('9 lives') is 9, so
   *  it invents a price out of a sentence. Letters are refused, not skimmed. */
  function parse(raw) {
    var t = String(raw == null ? "" : raw).trim();
    if (!t) return null;
    t = t.replace(/[$£€¥]/g, "").replace(/[\s\u00a0]/g, "");
    if (!t) return null;
    var hasDot = t.indexOf(".") >= 0, hasComma = t.indexOf(",") >= 0;
    if (hasDot && hasComma) {
      // Both present: whichever comes LAST is the decimal point, so "1,234.56" and "1.234,56" agree.
      var dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",";
      var grp = dec === "." ? "," : ".";
      t = t.split(grp).join("");
      if (dec === ",") t = t.replace(",", ".");
    } else if (hasDot || hasComma) {
      var ch = hasDot ? "." : ",";
      var parts = t.split(ch);
      // ONE separator with 1–2 trailing digits is a decimal point; anything else is grouping.
      // "111.222.333" has two, so it is grouping -> 111222333. "12,50" is a decimal -> 12.50.
      if (parts.length === 2 && parts[1].length <= 2) t = parts[0] + "." + parts[1];
      else t = parts.join("");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;   // anything else is REFUSED, not coerced
    var n = Number(t);
    if (!isFinite(n) || n < 0) return null;
    return n;
  }

  /** The ONE rendering. Everything that shows a service price goes through here. */
  function text(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "";
    var v = Number(n);
    return "$" + (v % 1 === 0 ? String(v) : v.toFixed(2));
  }

  W.HUBLY_PRICE = { parse: parse, text: text };
})();
