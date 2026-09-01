// hubly_contact.ts
//
// The Contact & Hours block — the single home for hours, phone, email and
// address on a freeform page — plus the phone format/key pair that block (and
// extraction) share.
//
// TWO JOBS FOR A PHONE NUMBER, both needed, kept in separate functions:
//
//   - DISPLAY is the house format 888-888-8888 (ten digits, two dashes, no
//     parens, spaces or country code). Written to the page everywhere, so every
//     Hubly page states a number the same way and the block never disagrees with
//     the hero.  -> formatPhoneHouse
//   - COMPARISON is digits-only and is NEVER shown to anyone. It exists for one
//     reason: so the dedup check does not insert a second phone number because the
//     page has "(801) 555-0301" and the record has "801-555-0301".  -> phoneDigitsKey
//
// These MIRROR the client pair in public/hubly.html (phoneDigits @ ~28253,
// formatPhoneValue @ ~28260). They live in a different runtime (Deno edge vs the
// browser monolith) so they cannot literally be one function; they MUST produce
// identical output. If you change one, change the other. hubly_extract.ts's
// normalisePhone delegates here so the SERVER has exactly one implementation.

/** Digits-only comparison key: strip non-digits, drop a leading US 1, last 10.
 *  Mirrors public/hubly.html phoneDigits. Never displayed. */
export function phoneDigitsKey(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d.slice(0, 10);
}

/** House display format 888-888-8888. Mirrors public/hubly.html formatPhoneValue.
 *  Returns the best-effort format for a partial number, or "" for nothing. */
export function formatPhoneHouse(raw: string): string {
  const d = phoneDigitsKey(raw);
  if (d.length >= 7) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
  if (d.length >= 4) return d.slice(0, 3) + "-" + d.slice(3);
  return d;
}

/** ONE normalization key per fact, used on BOTH the presence check and the
 *  update — never two comparisons that happen to agree (the normServiceKey
 *  discipline). Phone -> digits key; email -> lowercase-trimmed; address ->
 *  collapsed-whitespace lowercase. */
export function normContactKey(fact: "phone" | "email" | "address", raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (fact === "phone") return phoneDigitsKey(s);
  if (fact === "email") return s.toLowerCase();
  return s.replace(/\s+/g, " ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Hours — STRUCTURED ONLY. settings_business_hours has no free-text column and
// extraction has no free-text field, so "by appointment"/"24-7" never reach us;
// the renderer emits day rows and nothing else, and never parses a day it was
// not given (a weekday with no row is omitted, not asserted "Closed").
// ---------------------------------------------------------------------------

export type HoursRow = { weekday: number; open: string | null; close: string | null; closed: boolean };
export type RenderedHoursLine = { label: string; value: string };

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Display order is Monday-first (a presentation choice, not a fact): Mon..Sat, Sun last.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "08:00:00" | "08:00" -> "8 AM" / "8:30 AM". Returns "" for a null/unparseable time. */
function fmtTime(t: string | null): string {
  const s = String(t || "").trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return "";
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12; if (h === 0) h = 12;
  return min ? `${h}:${String(min).padStart(2, "0")} ${ampm}` : `${h} ${ampm}`;
}

/** The value shown for one day: "8 AM – 5 PM", or "Closed". Null when the row is
 *  neither a real range nor an explicit closed (nothing to state). */
function dayValue(r: HoursRow): string | null {
  if (r.closed) return "Closed";
  const o = fmtTime(r.open), c = fmtTime(r.close);
  if (o && c) return `${o} – ${c}`;
  return null;
}

/** Group consecutive (in Mon-first display order) weekdays that share the same
 *  value into "Mon–Fri: 8 AM – 5 PM" lines. Days with no row, or a row that
 *  states nothing, are omitted. Verbatim from the record; nothing invented. */
export function renderHoursLines(rows: HoursRow[]): RenderedHoursLine[] {
  const byDay = new Map<number, string>();
  for (const r of rows) {
    if (!r || !Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6) continue;
    const v = dayValue(r);
    if (v) byDay.set(r.weekday, v);
  }
  const lines: RenderedHoursLine[] = [];
  let run: { first: number; last: number; value: string } | null = null;
  const flush = () => {
    if (!run) return;
    const label = run.first === run.last
      ? DAY_ABBR[run.first]
      : `${DAY_ABBR[run.first]}–${DAY_ABBR[run.last]}`;
    lines.push({ label, value: run.value });
    run = null;
  };
  let prevSlot = -2;
  for (let i = 0; i < DISPLAY_ORDER.length; i++) {
    const day = DISPLAY_ORDER[i];
    const v = byDay.get(day);
    if (v === undefined) { flush(); prevSlot = -2; continue; }
    if (run && run.value === v && i === prevSlot + 1) { run.last = day; }
    else { flush(); run = { first: day, last: day, value: v }; }
    prevSlot = i;
  }
  flush();
  return lines;
}

// ---------------------------------------------------------------------------
// The block. Built server-side, inserted post-build. Labels, not prose.
// ---------------------------------------------------------------------------

function escText(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Escape for text, then emit the en-dash as a CHARSET-INDEPENDENT entity. A page
 *  without a <meta charset> (some bare pages) renders a raw U+2013 byte as mojibake
 *  ("â€"") — an unreadable layout. &ndash; renders as an en-dash on any charset. */
function escHours(s: string): string {
  return escText(s).replace(/–/g, "&ndash;");
}
/** The <dl> inner rows — ONE place, used by insert, add-into-block and update. */
function hoursRowsHtml(lines: RenderedHoursLine[]): string {
  return lines.map((l) => `<div><dt>${escHours(l.label)}</dt><dd>${escHours(l.value)}</dd></div>`).join("");
}

export type ContactBlockFacts = {
  hoursLines?: RenderedHoursLine[];
  hoursNote?: string | null;   // free-text hours phrasing, verbatim (e.g. "weekends by appointment")
  phone?: string | null;   // house format already
  email?: string | null;
  address?: string | null;
};

/** Heading DERIVED from what's actually in the block — never authored copy. A
 *  mobile business has no premises to "visit", so we assert nothing about it. */
function deriveHeading(hasHours: boolean, hasContact: boolean): string {
  if (hasHours && hasContact) return "Hours & Contact";
  if (hasHours) return "Hours";
  return "Contact";
}

/** Render one hours line as a <dt>/<dd> pair inside the anchored <dl>. */
function hoursDl(lines: RenderedHoursLine[]): string {
  const rows = hoursRowsHtml(lines);
  // data-hubly-hours is a valueless anchor: it can never leak into visible text
  // (countLeakedAttrText looks for data-hubly-*="…"), and it is what a later
  // hours change reads to update THIS block in place.
  return `<dl data-hubly-hours>${rows}</dl>`;
}

/** The free-text hours note, verbatim. Its own valueless anchor so it can be
 *  detected and updated independently of the structured rows. */
function hoursNoteEl(note: string): string {
  return `<p class="hubly-ch-note" data-hubly-hours-note>${escText(note)}</p>`;
}

/** The contact rows. Each value element carries BOTH marks on purpose:
 *  data-hc value role (so applyFreeformEdit keeps every occurrence in sync and
 *  click-to-edit works) and data-hubly-<fact> (so the insert path can detect the
 *  fact is already present). */
function contactList(facts: ContactBlockFacts): string {
  const items: string[] = [];
  if (facts.phone) {
    const tel = phoneDigitsKey(facts.phone);
    items.push(`<li><a href="tel:${escAttr(tel)}" data-hc="contact.phone" data-hubly-phone>${escText(facts.phone)}</a></li>`);
  }
  if (facts.email) {
    items.push(`<li><a href="mailto:${escAttr(facts.email)}" data-hc="contact.email" data-hubly-email>${escText(facts.email)}</a></li>`);
  }
  if (facts.address) {
    items.push(`<li><address data-hc="contact.address" data-hubly-address>${escText(facts.address)}</address></li>`);
  }
  return items.length ? `<ul class="hubly-ch-list">${items.join("")}</ul>` : "";
}

/** The whole block. Returns "" when there is nothing to show. */
export function renderContactHoursBlock(facts: ContactBlockFacts): string {
  const lines = Array.isArray(facts.hoursLines) ? facts.hoursLines : [];
  const note = String(facts.hoursNote || "").trim();
  const hasHours = lines.length > 0 || !!note;
  const list = contactList(facts);
  const hasContact = list.length > 0;
  if (!hasHours && !hasContact) return "";
  const heading = deriveHeading(hasHours, hasContact);
  const inner =
    `<h2>${escText(heading)}</h2>` +
    (lines.length ? hoursDl(lines) : "") +
    (note ? hoursNoteEl(note) : "") +
    (hasContact ? list : "");
  return `<section data-hubly-contact-block>${inner}</section>`;
}

// ---------------------------------------------------------------------------
// PRESENCE (dedup) — the one job normContactKey exists for. Never insert a fact
// the page already states, however it is formatted.
// ---------------------------------------------------------------------------

/** Strip tags to compare against visible text (cheap; the page is our own render). */
function visibleText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&");
}

/** Is this fact ALREADY on the page, by its normalization key — not by literal
 *  text, so "(801) 555-0301" and "801-555-0301" count as the same phone. */
export function factOnPage(html: string, fact: "phone" | "email" | "address", value: string): boolean {
  const key = normContactKey(fact, value);
  if (!key) return true;   // nothing to add
  if (new RegExp(`data-hubly-${fact}\\b`, "i").test(html)) return true;
  if (fact === "phone") {
    // A tel: href, or any run of digits on the page whose key matches.
    const tels = html.match(/href="tel:([^"]+)"/gi) || [];
    for (const t of tels) if (phoneDigitsKey(t) === key) return true;
    const runs = visibleText(html).match(/[\d().\-\s]{7,}/g) || [];
    for (const r of runs) if (phoneDigitsKey(r) === key) return true;
    return false;
  }
  if (fact === "email") {
    const mails = html.match(/href="mailto:([^"]+)"/gi) || [];
    for (const m of mails) if (m.toLowerCase().includes(key)) return true;
    return visibleText(html).toLowerCase().includes(key);
  }
  // address — collapsed lowercase substring match on visible text.
  return visibleText(html).replace(/\s+/g, " ").toLowerCase().includes(key);
}

/** Does the page already carry a STRUCTURED hours anchor (this block's <dl>, or a
 *  model-authored container we stamped at generation)? The negative lookahead
 *  keeps data-hubly-hours-note from matching here — the note is a separate fact. */
export function hoursOnPage(html: string): boolean {
  return /data-hubly-hours(?![-a-z])/i.test(html);
}

/** Does the page already carry the free-text hours-note anchor? */
export function hoursNoteOnPage(html: string): boolean {
  return /data-hubly-hours-note\b/i.test(html);
}

const WEEKDAY_TOKEN_RE = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|weds?|thur?s?|fri|sat)\b/gi;

/** A short heading whose text names an hours/schedule section. Two forms of the
 *  same fact undercount each other (the recurring lesson): a schedule can list
 *  weekday names OR carry none at all ("Open daily, 7am to 4pm") under an "Hours"
 *  heading. So we check BOTH signals, not just one. */
function hasHoursHeading(html: string): boolean {
  const re = /<(h[1-6]|dt|th|strong|b|p|span|div|li)\b[^>]*>([^<]{1,30})<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = m[2].trim().toLowerCase();
    if (/^(opening |business |our |store |shop )?hours\b/.test(t)) return true;
    if (/^(listed )?schedule\b/.test(t)) return true;
    if (/hours of operation/.test(t)) return true;
  }
  return false;
}

/** LOOSE dedup: does the page ALREADY present a schedule somewhere — even one the
 *  model wrote with non-time values ("Closed", "Call for hours", "By appointment")
 *  or with NO weekday names at all ("Open daily, 7am to 4pm")? Two independent
 *  signals, because each form undercounts the other: ≥3 distinct weekday names, OR
 *  a short heading that names an hours section. This exists to prevent a DUPLICATE
 *  hours block: when it's true and we can't anchor, we record a countable miss and
 *  insert nothing — a miss we can count is fine, a second hours section is not. */
export function pageHasHoursSection(html: string): boolean {
  if (hoursOnPage(html)) return true;
  if (hasHoursHeading(html)) return true;
  const vis = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").toLowerCase();
  const days = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(WEEKDAY_TOKEN_RE.source, "gi");
  while ((m = re.exec(vis))) days.add(m[1].slice(0, 3));
  return days.size >= 3;
}

// ---------------------------------------------------------------------------
// PLACEMENT — insert the block when absent, add missing facts into an existing
// block, update hours in place. Never restructures the model's content; the only
// thing it edits in place is an hours anchor's own contents.
// ---------------------------------------------------------------------------

export type ContactPlacement = {
  html: string;
  changed: boolean;
  inserted: string[];               // facts newly written to the page
  updated: string[];                // facts replaced in place in an existing anchor
  alreadyPresent: string[];         // facts skipped because the page already had them
  missed: string[];                 // facts we could not place without risking a duplicate/clobber
  via: "inserted" | "anchor" | "missed";
  leaked: number;
};

/** Count our own markers that leaked into VISIBLE text — always 0 on success. */
function countLeaked(html: string): number {
  const vis = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  return (vis.match(/data-hubly-[a-z-]+\s*=/gi) || []).length;
}

/** Where a new block goes: before the last <footer>, else before </body>, else end. */
function insertionPoint(html: string): number {
  const foot = html.toLowerCase().lastIndexOf("<footer");
  if (foot >= 0) return foot;
  const body = html.toLowerCase().lastIndexOf("</body>");
  if (body >= 0) return body;
  return html.length;
}

/** Replace the inner rows of an existing data-hubly-hours anchor with fresh ones.
 *  Function-form replacement: a time value that contained "$1" could never be
 *  read as a backreference. */
function updateHoursAnchor(html: string, lines: RenderedHoursLine[]): { html: string; changed: boolean } {
  const rows = hoursRowsHtml(lines);
  // Replace ONLY the inner rows of OUR OWN block's <dl data-hubly-hours>, in place
  // — tag and attributes untouched. Scoped to a <dl> (the shape we insert), never a
  // model-authored element, so this can only ever edit hours we wrote. Closure
  // replacement, so an hours value containing "$1" is inserted verbatim, never a
  // backreference. The (?![-a-z]) keeps data-hubly-hours-note out of this.
  const re = /(<dl\b[^>]*\bdata-hubly-hours(?![-a-z])[^>]*>)[\s\S]*?(<\/dl>)/i;
  if (!re.test(html)) return { html, changed: false };
  const out = html.replace(re, (_m, open: string, close: string) => open + rows + close);
  return { html: out, changed: out !== html };
}

/** Replace the free-text hours-note anchor's contents. Function-form: a note
 *  containing "$1" is inserted verbatim, never read as a backreference. */
function updateHoursNoteAnchor(html: string, note: string): { html: string; changed: boolean } {
  const re = /(<[a-z0-9]+\b[^>]*\bdata-hubly-hours-note\b[^>]*>)[\s\S]*?(<\/[a-z0-9]+>)/i;
  if (!re.test(html)) return { html, changed: false };
  const out = html.replace(re, (_m, open: string, close: string) => open + escText(note) + close);
  return { html: out, changed: out !== html };
}

/** Insert an hours component (a <dl> or a note <p>) into an existing block, right
 *  after its <h2> so hours sit above contact. Function-form. */
function addHoursIntoBlock(html: string, componentHtml: string): { html: string; changed: boolean } {
  // After the block's heading if it has one, else right after the <section ...>.
  const afterH2 = /(<section\b[^>]*\bdata-hubly-contact-block\b[^>]*>[\s\S]*?<\/h2>)/i;
  if (afterH2.test(html)) {
    const out = html.replace(afterH2, (_m, head: string) => head + componentHtml);
    return { html: out, changed: out !== html };
  }
  const openTag = /(<section\b[^>]*\bdata-hubly-contact-block\b[^>]*>)/i;
  const out = html.replace(openTag, (_m, open: string) => open + componentHtml);
  return { html: out, changed: out !== html };
}

/** Add missing facts' <li> rows into an existing block's contact list (or create
 *  the list if the block had hours only). Function-form throughout. */
function addIntoExistingBlock(html: string, facts: ContactBlockFacts): { html: string; changed: boolean; added: string[] } {
  const added: string[] = [];
  const rows: string[] = [];
  if (facts.phone) { const tel = phoneDigitsKey(facts.phone); rows.push(`<li><a href="tel:${escAttr(tel)}" data-hc="contact.phone" data-hubly-phone>${escText(facts.phone)}</a></li>`); added.push("phone"); }
  if (facts.email) { rows.push(`<li><a href="mailto:${escAttr(facts.email)}" data-hc="contact.email" data-hubly-email>${escText(facts.email)}</a></li>`); added.push("email"); }
  if (facts.address) { rows.push(`<li><address data-hc="contact.address" data-hubly-address>${escText(facts.address)}</address></li>`); added.push("address"); }
  if (!rows.length) return { html, changed: false, added };
  const rowsHtml = rows.join("");
  // Append into an existing list, else insert a new list before the block's close.
  const listRe = /(<ul\b[^>]*\bclass="hubly-ch-list"[^>]*>)([\s\S]*?)(<\/ul>)/i;
  if (listRe.test(html)) {
    const out = html.replace(listRe, (_m, open: string, mid: string, close: string) => open + mid + rowsHtml + close);
    return { html: out, changed: true, added };
  }
  const blockCloseRe = /(<section\b[^>]*\bdata-hubly-contact-block\b[\s\S]*?)(<\/section>)/i;
  const out = html.replace(blockCloseRe, (_m, body: string, close: string) => body + `<ul class="hubly-ch-list">${rowsHtml}</ul>` + close);
  return { html: out, changed: out !== html, added };
}

/** The whole placement over one page. Adds only facts not already present; updates
 *  hours in place when an anchor exists; inserts the block once when absent. */
export function placeContactHoursInFreeform(
  html: string,
  record: { hoursRows?: HoursRow[]; hoursNote?: string | null; phone?: string | null; email?: string | null; address?: string | null; accent?: string | null },
): ContactPlacement {
  let out = html;
  const inserted: string[] = [];
  const updated: string[] = [];
  const alreadyPresent: string[] = [];
  const missed: string[] = [];

  const lines = renderHoursLines(record.hoursRows || []);
  const note = String(record.hoursNote || "").trim();

  // NO retroactive re-recognition of a model-authored hours list. Matching one by
  // markup shape misfires (a footer list mixing address/phone/"open daily" passed
  // the guard and a rewrite destroyed the address) and, even on a hit, strips the
  // model's styling and can contradict the rest of the page. The only anchor we
  // ever update is our OWN block's <dl>. A model schedule is detected loosely
  // (pageHasHoursSection) and left alone — recorded as a countable miss, and (with
  // the owner's consent, separately) offered a rebuild. Never a silent rewrite.

  // Which contact facts are missing from the page (by normalization key)?
  const missing: ContactBlockFacts = {};
  const phone = record.phone ? formatPhoneHouse(record.phone) : "";
  if (phone) { if (factOnPage(out, "phone", phone)) alreadyPresent.push("phone"); else missing.phone = phone; }
  if (record.email) { if (factOnPage(out, "email", record.email)) alreadyPresent.push("email"); else missing.email = record.email; }
  if (record.address) { if (factOnPage(out, "address", record.address)) alreadyPresent.push("address"); else missing.address = record.address; }

  const blockExists = /data-hubly-contact-block\b/i.test(out);
  const hoursAnchorExists = hoursOnPage(out);
  const noteAnchorExists = hoursNoteOnPage(out);
  const hoursSectionExists = pageHasHoursSection(out);
  const noteAlreadyShown = !!note && visibleText(out).replace(/\s+/g, " ").toLowerCase().includes(note.toLowerCase());

  // 1. Structured hours: update an existing anchor in place; else if the page
  //    already SHOWS a schedule we can't anchor, record a miss (never duplicate).
  if (lines.length) {
    if (hoursAnchorExists) {
      const r = updateHoursAnchor(out, lines);
      out = r.html; if (r.changed) updated.push("hours"); else alreadyPresent.push("hours");
    } else if (hoursSectionExists) {
      missed.push("hours");
    }
  }
  // 1b. Hours note: update an existing note anchor in place; skip if already shown.
  if (note) {
    if (noteAnchorExists) {
      const r = updateHoursNoteAnchor(out, note);
      out = r.html; if (r.changed) updated.push("hours note"); else alreadyPresent.push("hours note");
    } else if (noteAlreadyShown) {
      alreadyPresent.push("hours note");
    }
  }

  const wantHoursInBlock = lines.length > 0 && !hoursAnchorExists && !hoursSectionExists;
  const wantNoteInBlock = !!note && !noteAnchorExists && !noteAlreadyShown;

  // 2. Into an EXISTING block: add any component it doesn't yet carry.
  if (blockExists) {
    if (wantHoursInBlock) {
      const r = addHoursIntoBlock(out, `<dl data-hubly-hours>${hoursRowsHtml(lines)}</dl>`);
      if (r.changed) { out = r.html; inserted.push("hours"); }
    }
    if (wantNoteInBlock && !/data-hubly-hours-note/i.test(out)) {
      const r = addHoursIntoBlock(out, `<p class="hubly-ch-note" data-hubly-hours-note>${escText(note)}</p>`);
      if (r.changed) { out = r.html; inserted.push("hours note"); }
    }
    if (missing.phone || missing.email || missing.address) {
      const r = addIntoExistingBlock(out, missing);
      out = r.html; inserted.push(...r.added);
    }
  }

  // 3. No block yet: insert one carrying every missing/unanchored fact.
  if (!blockExists) {
    const facts: ContactBlockFacts = { ...missing };
    if (wantHoursInBlock) facts.hoursLines = lines;
    if (wantNoteInBlock) facts.hoursNote = note;
    const block = renderContactHoursBlock(facts);
    if (block) {
      const at = insertionPoint(out);
      out = out.slice(0, at) + block + contactHoursBlockCss(record.accent || undefined) + out.slice(at);
      if (facts.phone) inserted.push("phone");
      if (facts.email) inserted.push("email");
      if (facts.address) inserted.push("address");
      if (facts.hoursLines && facts.hoursLines.length) inserted.push("hours");
      if (facts.hoursNote) inserted.push("hours note");
    }
  }

  // Whatever combination of inserts/adds ran, make the heading match the block's
  // actual contents (a contact-first block that just gained hours must stop
  // saying "Contact").
  out = rederiveContactBlockHeading(out);

  const changed = out !== html;
  const via: ContactPlacement["via"] = inserted.length ? "inserted" : (updated.length ? "anchor" : "missed");
  return { html: out, changed, inserted, updated, alreadyPresent, missed, via, leaked: countLeaked(out) };
}

/** Re-derive the block's <h2> from what it ACTUALLY contains now. Needed because a
 *  block can be built contact-first (heading "Contact") and then have hours added
 *  into it — the heading has to become "Hours & Contact" or it lies. Idempotent;
 *  a no-op when there is no block. */
export function rederiveContactBlockHeading(html: string): string {
  const blockRe = /(<section\b[^>]*\bdata-hubly-contact-block\b[^>]*>)([\s\S]*?)(<\/section>)/i;
  const m = blockRe.exec(html);
  if (!m) return html;
  const inner = m[2];
  const hasHours = /data-hubly-hours(?![-a-z])/i.test(inner) || /data-hubly-hours-note\b/i.test(inner);
  const hasContact = /data-hubly-(?:phone|email|address)\b/i.test(inner);
  if (!hasHours && !hasContact) return html;
  const heading = deriveHeading(hasHours, hasContact);
  const newInner = inner.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, `<h2>${escText(heading)}</h2>`);
  if (newInner === inner) return html;
  return html.slice(0, m.index) + m[1] + newInner + m[3] + html.slice(m.index + m[0].length);
}

/** Scoped stylesheet, appended once — the ensureServicePriceCss pattern. Type is
 *  inherited (font/color: inherit) so it matches the page; palette borrows the
 *  known accent for one rule and falls back to currentColor. Self-contained so it
 *  cannot collapse a page's grid. */
export function contactHoursBlockCss(accent?: string): string {
  const a = String(accent || "").trim();
  const rule = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(a) ? a : "currentColor";
  return (
    "\n<style data-hubly-ch-css>" +
    "[data-hubly-contact-block]{max-width:960px;margin:0 auto;padding:48px 24px;" +
    `border-top:2px solid ${rule};font:inherit;color:inherit;line-height:1.5}` +
    "[data-hubly-contact-block] h2{font-size:1.5rem;margin:0 0 20px}" +
    "[data-hubly-contact-block] dl{margin:0 0 20px;padding:0;display:grid;gap:6px}" +
    "[data-hubly-contact-block] dl>div{display:flex;justify-content:space-between;gap:24px;max-width:420px}" +
    "[data-hubly-contact-block] dt{font-weight:600;margin:0}" +
    "[data-hubly-contact-block] dd{margin:0;text-align:right}" +
    "[data-hubly-contact-block] .hubly-ch-note{margin:0 0 20px;opacity:.85}" +
    "[data-hubly-contact-block] .hubly-ch-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}" +
    "[data-hubly-contact-block] .hubly-ch-list a{color:inherit;text-decoration:none}" +
    "[data-hubly-contact-block] address{font-style:normal}" +
    "</style>"
  );
}
