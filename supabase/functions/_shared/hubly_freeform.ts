/**
 * Editing a freeform page.
 *
 * The whole point of the freeform format is that the HTML IS the page. So this
 * path does none of what the AST path does: no tree load, no applyPatchOps, no
 * validateHublyDocument, no renderHublyDocument. It finds the labelled elements
 * in the stored HTML, changes the text or the image source, and appends a new
 * version — exactly the same versioning as today, with the expensive middle
 * removed.
 *
 * ONE LABEL CAN MATCH SEVERAL ELEMENTS, ON PURPOSE.
 *
 * data-hc value roles (contact.phone, contact.email, business.name, …) name a
 * FACT, and a page states its phone number in the header, the contact block and
 * the footer. An owner who edits one of them means "my phone number changed",
 * not "change the third one". So every match is updated, and the caller is told
 * how many — the count is what makes the acknowledgement honest.
 *
 * Positional labels (section.3.heading) match exactly one element by
 * construction, so the same code path covers both without a special case.
 */

import { type ScannedEl, type Splice, ownText, scanHtml, spliceAll } from "./hubly_html_scan.ts";
import { HC_VALUE_ROLES, isValidHcLabel } from "./hubly_document_labels.ts";

export interface FreeformEdit {
  label: string;
  /** For a text edit. */
  text?: string;
  /** For an image edit — an already-uploaded URL. */
  src?: string;
  /**
   * The clicked element's text BEFORE the edit, sent only by click-to-edit.
   *
   * A label can match several elements, so "the owner typed this" and "this
   * value changed" are different intentions that used to arrive identically.
   * When the owner edits the words on ONE button, only that button should
   * change; when a phone number changes in the record, the number should change
   * everywhere and the words around it should not. prevText is what tells the
   * two apart: present means a specific element was targeted, absent means the
   * automatic path, which is never allowed to rewrite wording.
   */
  prevText?: string;
}

export interface FreeformEditResult {
  ok: boolean;
  html: string;
  /** How many elements carried this label and were changed. */
  changed: number;
  /** How many carried it at all (changed + already-equal). */
  matched: number;
  before: string[];
  after: string;
  /** Matches deliberately left alone because the old value was not in them. */
  skipped: string[];
  error?: "invalid_label" | "no_match" | "no_change" | "empty_text" | "bad_src";
}

/** Minimal, deliberate escaping. Text goes into an element's body, nowhere else. */
function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

/**
 * A phone number typed into the header should also change what the link dials.
 * Editing the visible text of <a href="tel:+18015552200">801-555-2200</a> and
 * leaving the href alone produces a page that SAYS the new number and DIALS the
 * old one — a silent wrong answer, and the worst possible failure for a contact
 * detail. Same for mailto.
 */
function syncedHref(el: ScannedEl, label: string, newText: string): string | null {
  if (el.name !== "a") return null;
  const href = (el.attrs.href || "").trim();
  if (label === "contact.phone" && /^tel:/i.test(href)) {
    const digits = newText.replace(/[^\d+]/g, "");
    // Only rewrite when the new text really is a phone number. "Call us today"
    // is a caption change, not a number change, and must not blank the link.
    return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : null;
  }
  if (label === "contact.email" && /^mailto:/i.test(href)) {
    const m = /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.exec(newText);
    return m ? `mailto:${m[0]}` : null;
  }
  return null;
}

export function applyFreeformEdit(html: string, edit: FreeformEdit): FreeformEditResult {
  const src = String(html || "");
  const fail = (error: FreeformEditResult["error"]): FreeformEditResult =>
    ({ ok: false, html: src, changed: 0, matched: 0, before: [], after: "", skipped: [], error });

  if (!isValidHcLabel(edit.label)) return fail("invalid_label");

  const isImage = typeof edit.src === "string";
  if (isImage) {
    const u = String(edit.src).trim();
    // Same shape as the AST path: an absolute http(s) URL that we produced.
    if (!/^https?:\/\//i.test(u)) return fail("bad_src");
  } else {
    if (typeof edit.text !== "string" || !edit.text.trim()) return fail("empty_text");
  }

  const scan = scanHtml(src);
  const matches = scan.all.filter((e) => e.attrs["data-hc"] === edit.label);
  if (!matches.length) return fail("no_match");

  // A value role can appear inside a longer phrase: the header says
  // "801-555-2200" and the hero button says "Call 801-555-2200". Replacing the
  // whole body of both turns the button into a bare number and quietly deletes
  // the word "Call". So find the value the matches agree on — the most common
  // exact text — and, where an element merely CONTAINS it, substitute in place.
  //
  // For a contact role the anchor must be the VALUE, not the phrase around it.
  // Using the full leaf text ("Call 801-555-4141") means the sweep below
  // searches the page for that whole phrase and never matches a bare
  // "801-555-2200" sitting in the contact block — which is precisely how the
  // page ended up stating two different numbers.
  const VALUE_IN_TEXT: Record<string, RegExp> = {
    "contact.phone": /\+?\d[\d\s().-]{7,20}\d/,
    "contact.email": /[^\s<>@]+@[^\s<>@]+\.[a-z]{2,}/i,
  };
  const canonicalOld = (() => {
    if (isImage) return null;
    const extractor = VALUE_IN_TEXT[edit.label];
    const counts = new Map<string, number>();
    for (const el of matches) {
      const t = ownText(el, src);
      if (!t) continue;
      const v = extractor ? (extractor.exec(t) || [])[0] : t;
      if (v) counts.set(v.trim(), (counts.get(v.trim()) || 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [t, n] of counts) {
      // Prefer the shortest text among equally common ones: it is the value
      // itself rather than a phrase wrapped around it.
      if (n > bestN || (n === bestN && best !== null && t.length < best.length)) { best = t; bestN = n; }
    }
    // One labelled match is enough when the role names a fact: the whole point
    // of the sweep is the UNlabelled occurrences, which are not in `matches`.
    const floor = extractor ? 1 : 2;
    return bestN >= floor ? best : null;
  })();

  // The NEW value, read out of `edit.text` with the same extractor. See the
  // note at the in-place substitution below for why this normalisation exists.
  //
  // NULL MEANS "THIS IS NOT A VALUE CHANGE". If the owner retitles a button
  // from "Start the conversation" to "Ring the bindery", the new text contains
  // no phone number, so there is no new value to substitute anywhere — only the
  // element they clicked should change. Without this, editing one button's
  // WORDS pushed those words into every other element carrying the label,
  // including the one that was correctly showing the number.
  //
  // For a label with no extractor (business.name, contact.address) the whole
  // new text IS the value, so it stands in directly.
  const canonicalNew = (() => {
    if (isImage) return null;
    const extractor = VALUE_IN_TEXT[edit.label];
    if (!extractor) return String(edit.text || "").trim() || null;
    const m = extractor.exec(String(edit.text || ""));
    return m ? m[0].trim() : null;
  })();

  const isValueRole = HC_VALUE_ROLES.has(edit.label);
  /** Elements left deliberately untouched, so the caller can say so. */
  const skipped: string[] = [];
  const edits: Splice[] = [];
  const before: string[] = [];
  let changed = 0;

  for (const el of matches) {
    if (isImage) {
      const nextSrc = String(edit.src);
      const cur = el.attrs.src || "";
      before.push(cur);
      if (cur === nextSrc) continue;
      const r = el.attrRanges["src"];
      if (r) edits.push({ start: r.start, end: r.end, text: ` src="${escapeAttr(nextSrc)}"` });
      else edits.push({ start: el.attrInsertAt, end: el.attrInsertAt, text: ` src="${escapeAttr(nextSrc)}"` });
      // srcset would keep serving the old image alongside the new one.
      const ss = el.attrRanges["srcset"];
      if (ss) edits.push({ start: ss.start, end: ss.end, text: "" });
      changed++;
    } else {
      const nextText = String(edit.text);
      const cur = ownText(el, src);
      before.push(cur);

      // A SYNC THAT CANNOT FIND WHAT IT IS REPLACING HAS NO BUSINESS GUESSING.
      //
      // This used to fall back to replacing the element's whole body whenever
      // the old value was not found in it. On a real page that turned saving an
      // EMAIL ADDRESS into this:
      //
      //   business.name  "CK"              -> "Copperwick Kilns"
      //   contact.phone  "Start a Call"    -> "801-555-7420"
      //   contact.phone  "Call Copperwick" -> "801-555-7420"
      //
      // Three buttons reduced to printing a phone number the page already
      // stated, a monogram overwritten with the full name, and none of it
      // anything the owner asked for. The automatic path is the one operation
      // that must never threaten what the owner wrote, so it now changes
      // NOTHING it cannot locate.
      let resulting: string | null = null;
      if (edit.prevText != null && cur === edit.prevText) {
        // The specific element the owner clicked. They typed these words; use
        // them verbatim, and leave every other match to the value rules below.
        resulting = nextText;
      } else if (!isValueRole) {
        // A positional label (section.3.heading) is unique by construction, so
        // there is no ambiguity about which element was meant.
        resulting = nextText;
      } else if (canonicalOld && canonicalNew && cur.includes(canonicalOld)) {
        // A value role whose old value is genuinely here, AND a real new value
        // to put in its place: swap the value and keep every word around it
        // ("Call 801-555-2200" -> "Call 801-555-8888").
        resulting = cur.split(canonicalOld).join(canonicalNew);
      }
      if (resulting === null) { skipped.push(`${edit.label}:"${cur.slice(0, 40)}"`); continue; }
      if (cur === resulting.replace(/\s+/g, " ").trim()) continue;
      edits.push({ start: el.openEnd, end: el.closeStart, text: escapeText(resulting) });
      // The owner just replaced Hubly's guess with their own words, so it is no
      // longer a guess: drop the data-hubly-guess mark. This is what makes
      // "editing a placeholder clears its mark" true structurally, and it keeps
      // the queryable placeholder count honest.
      const gr = el.attrRanges["data-hubly-guess"];
      if (gr) edits.push({ start: gr.start, end: gr.end, text: "" });
      const href = syncedHref(el, edit.label, nextText);
      if (href) {
        const hr = el.attrRanges["href"];
        if (hr) edits.push({ start: hr.start, end: hr.end, text: ` href="${escapeAttr(href)}"` });
      }
      changed++;
    }
  }

  if (!changed) {
    return { ok: false, html: src, changed: 0, matched: matches.length, before, after: isImage ? String(edit.src) : String(edit.text), skipped, error: "no_change" };
  }

  let out = spliceAll(src, edits);

  // A FACT MUST NOT SURVIVE IN TWO VERSIONS ON ONE PAGE.
  //
  // Labelled elements are leaves, because that is what the editor can click.
  // But a real generated page wrote its contact block as
  //
  //     <a href="tel:8015552200"><strong>Phone</strong><br />801-555-2200</a>
  //
  // — an <a> with an element child, so not a leaf, so never labelled, so
  // invisible to the edit above. Changing the phone number updated the two
  // "Call …" buttons and left this one alone, and the published page showed
  // two different phone numbers. Nothing reported it.
  //
  // So for VALUE roles only — the ones that name a fact rather than a place —
  // any remaining occurrence of the old value is updated too, in text and in
  // tel:/mailto: hrefs. Done as a second pass over a fresh scan so these
  // ranges cannot overlap the ones already spliced above.
  if (!isImage && canonicalOld && canonicalNew && HC_VALUE_ROLES.has(edit.label)) {
    const nextText = String(edit.text);
    const sweep: Splice[] = [];
    const rescan = scanHtml(out);
    for (const el of rescan.all) {
      for (const t of el.texts) {
        const chunk = out.slice(t.start, t.end);
        if (!chunk.includes(canonicalOld)) continue;
        sweep.push({ start: t.start, end: t.end, text: chunk.split(canonicalOld).join(escapeText(canonicalNew)) });
      }
      const href = el.attrRanges["href"];
      if (href && el.name === "a") {
        const cur = (el.attrs.href || "").trim();
        const synced = syncedHref(el, edit.label, canonicalNew);
        // Only when this link points at the OLD value — never rewrite a link
        // that was already pointing somewhere else.
        if (synced && cur.replace(/\D/g, "") === canonicalOld.replace(/\D/g, "") && cur !== synced) {
          sweep.push({ start: href.start, end: href.end, text: ` href="${escapeAttr(synced)}"` });
        }
      }
    }
    if (sweep.length) { out = spliceAll(out, sweep); changed += sweep.length; }
  }

  return {
    ok: true,
    html: out,
    changed,
    matched: matches.length,
    before,
    after: isImage ? String(edit.src) : String(edit.text),
    skipped,
  };
}

/** What to say to the owner. Quotes only the NEW value, same rule as the AST path. */
export function humanFreeformSummary(r: FreeformEditResult, label: string): string {
  const where = r.changed > 1 ? ` in ${r.changed} places` : "";
  if (label.startsWith("business.logo") || r.after.startsWith("http")) return `changed the image${where}`;
  const quoted = r.after.length > 70 ? `${r.after.slice(0, 67)}…` : r.after;
  return `changed the text${where} to "${quoted}"`;
}

/** Every label present on a stored page, for "what will you lose" in Step 5. */
export function labelsPresent(html: string): string[] {
  const out = new Set<string>();
  for (const el of scanHtml(String(html || "")).all) {
    const l = el.attrs["data-hc"];
    if (l) out.add(l);
  }
  return [...out].sort();
}

export interface LabelEntry {
  label: string;
  kind: "text" | "image";
  value: string;
}

/**
 * What the page currently says, per label. This is what makes a conversational
 * edit TARGETED: the model is shown the handles and their current contents and
 * asked which ones to change, so "make the headline punchier" becomes a change
 * to hero.headline and nothing else. It never sees the markup and so cannot
 * rewrite the page as a side effect of being asked for one sentence.
 */
export function labelInventory(html: string): LabelEntry[] {
  const src = String(html || "");
  const seen = new Map<string, LabelEntry>();
  for (const el of scanHtml(src).all) {
    const label = el.attrs["data-hc"];
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.set(label, el.name === "img"
      ? { label, kind: "image", value: el.attrs.src || "" }
      : { label, kind: "text", value: ownText(el, src) });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}
