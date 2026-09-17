/**
 * ══ ONE CONTACT PICKER, TWO SHELLS. ══════════════════════════════════════════════════════════
 *
 * ADRIAN, 2026-09-16, on A2: "pickContactInto('customer') is ALREADY OPEN — wire to it, do not build
 * a second."
 *
 * The capability was in `public/hubly.html` and A2 is in `public/platform-home.html` — two separate
 * documents, so there is no way to call one from the other. Building a second
 * `navigator.contacts.select` call in the second shell would have been exactly the two-of-everything
 * pattern this codebase keeps paying for, so the CAPABILITY moved here and both shells load it.
 *
 * WHAT IS SHARED AND WHAT IS NOT, deliberately:
 *   · SHARED — asking the device for a contact, and turning whatever it gives back into
 *     { first, last, name, phone, email }. That is one behaviour and there must be one of it.
 *   · NOT SHARED — which fields to fill. hubly.html fills `nc-*` or `nl-*`; platform-home fills its
 *     own. One capability with two fill targets is correct; it is not duplication.
 *
 * THE PARSER IS CONSERVATIVE ON PURPOSE. It returns null rather than a half-read contact: a name with
 * no way to reach them is not a contact you can act on, and filling a form with a first name and
 * nothing else looks like it worked. Same gate as the lead list — reachable is phone OR email.
 *
 * NOTHING IS NORMALISED BEYOND WHAT THE FORM NEEDS. Digits are extracted from the phone because a
 * form field wants digits; the NAME and the EMAIL are passed through exactly as the device gave them.
 * A "corrected" name is a name nobody gave us.
 */
(function (root) {
  'use strict';

  function available() {
    try {
      return !!(root.navigator && root.navigator.contacts &&
                typeof root.navigator.contacts.select === 'function' &&
                root.window && 'ContactsManager' in root.window);
    } catch (e) { return false; }
  }

  /** Text (a pasted block, or a device contact flattened) -> a contact, or null.
   *
   *  EXTRACTED FROM THE WHOLE TEXT, NOT LINE BY LINE. The first version split on newlines and commas
   *  and treated each line as one field, which works for a pasted block and FAILS for the commonest
   *  real input: a device contact flattened onto ONE line
   *  ("Dana Reeves 18015550134 dana@example.com"). The email branch consumed the line and the phone
   *  and the name were both lost — the same shape as every closed-list-of-forms miss in this codebase,
   *  so the fix is the same: pull out the two things that HAVE a recognisable form (an address with an
   *  @, a run of 10-15 digits), and treat everything left over as the name. */
  function parse(text) {
    var raw = String(text == null ? '' : text);
    if (!raw.trim()) return null;

    var email = (raw.match(/[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}/) || [''])[0];
    var rest = email ? raw.replace(email, ' ') : raw;

    // A run of 10-15 digits, allowing the punctuation a person types. Anchored on a boundary so a
    // street number or a year cannot be mistaken for a number you can call.
    var phoneRaw = (rest.match(/(?:\+?\d[\d()\-.\s]{8,}\d)/) || [''])[0];
    var phone = phoneRaw.replace(/\D/g, '');
    if (phone.length === 11 && phone.charAt(0) === '1') phone = phone.slice(1);
    if (phone.length < 10 || phone.length > 15) { phone = ''; phoneRaw = ''; }
    if (phoneRaw) rest = rest.replace(phoneRaw, ' ');

    // WHAT IS LEFT IS THE NAME — words, not digits, not punctuation the device added.
    var name = rest.replace(/[\d]+/g, ' ')
                   .replace(/[^A-Za-z\u00C0-\u024F'\-.\s]/g, ' ')
                   .replace(/\s+/g, ' ').trim();
    var bits = name ? name.split(/\s+/) : [];
    var first = bits[0] || '';
    var last = bits.slice(1).join(' ');

    // REACHABLE OR NOTHING. A name alone is not a contact you can act on, and returning one would
    // fill a form that then looks complete.
    if (!phone && !email) return null;
    return { first: first, last: last, name: name || [first, last].filter(Boolean).join(' '),
             phone: phone, email: email };
  }

  /** Asks the device. Resolves to a parsed contact, or null when the person cancelled.
   *  Rejects only when the device said no — so a caller can tell "cancelled" from "unavailable". */
  function pick() {
    if (!available()) return Promise.reject(new Error('unavailable'));
    return root.navigator.contacts.select(['name', 'email', 'tel'], { multiple: false })
      .then(function (contacts) {
        var c = contacts && contacts[0];
        if (!c) return null;                       // cancelled — not a failure
        var one = function (v) { return (Array.isArray(v) ? v[0] : v) || ''; };
        var blob = [one(c.name), one(c.tel), one(c.email)].filter(Boolean).join('\n');
        return parse(blob) || parse([one(c.name), one(c.tel), one(c.email)].join(' '));
      });
  }

  root.HublyContactPick = { available: available, parse: parse, pick: pick };
})(typeof window !== 'undefined' ? window : this);
