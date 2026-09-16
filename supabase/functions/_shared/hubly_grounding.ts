// hubly_grounding.ts
//
// A fact value is GROUNDED only if it appears in THIS message — the current turn's
// user text. Not the previous turn, not the transcript, not a default, not a
// plausible-looking value. This is the write-side guard: a writer refuses a value
// it cannot ground here, so a number (or price) lifted from earlier in the
// conversation can never be published without the owner restating it now.
//
// Deliberately tuned to reject the lift, not real answers:
//   - too literal ("801-888-8888" only) would reject "(801) 888-8888",
//     "801 888 8888", or a number typed in words — real answers.
//   - too loose (any digits) would let a stray number ground a different fact.
// So each fact type has its own presence test over a normalised view of the
// message, and each requires the WHOLE value to be present, as a unit.

import { phoneDigitsKey } from "./hubly_contact.ts";

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

/** Every digit in the message, INCLUDING spelled-out digit words in sequence
 *  ("eight oh one …" -> "801…"), so a number an owner typed in words still counts.
 *  A lone "oh"/"one" inside a normal word can't match: we only convert whole
 *  digit-words, and a phone needs 10 in a row to ground. */
function messageDigits(message: string): string {
  const lowered = String(message || "").toLowerCase();
  const wordsToDigits = lowered.replace(
    /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (w) => DIGIT_WORDS[w] || "",
  );
  return wordsToDigits.replace(/\D/g, "");
}

/** PHONE — grounded if the value's 10-digit key appears as a run in the message's
 *  digits. Covers "(801) 888-8888", "801 888 8888", "8018888888", "+1 801…", and
 *  the spelled-out form; rejects "add my phone number" (no digits). */
export function phoneGrounded(value: string, message: string): boolean {
  return phoneGroundedWhy(value, message).ok;
}

/** WHY IT WAS REFUSED, because "didn't save" is not an answer.
 *
 *  On 2026-09-15 an owner typed "555-0134" into a job paste and Hubly told him "The phone
 *  number didn't save, so send it again if you want it added." Sending it again would have
 *  failed identically — the number is SEVEN DIGITS and this function requires ten. We knew
 *  exactly why and said something that implied we did not, which sends the owner round a loop
 *  that cannot terminate.
 *
 *  Two refusals live here and they are not the same thing, so they do not share a sentence:
 *    too_short     the value is not a full number — the owner can fix it, and we can say how
 *    not_in_message the value is a full number that is NOT in this message — the 801-888-8888
 *                   lift, where the correct behaviour is to ask, never to hint at the number
 *                   we refused (naming it would publish the very value we declined to write).
 */
export type GroundWhy = { ok: boolean; why?: "too_short" | "not_in_message"; digits?: number };
export function phoneGroundedWhy(value: string, message: string): GroundWhy {
  const key = phoneDigitsKey(String(value || ""));
  const digits = String(value || "").replace(/\D/g, "").length;
  if (key.length < 10) return { ok: false, why: "too_short", digits };
  if (!messageDigits(message).includes(key)) return { ok: false, why: "not_in_message", digits };
  return { ok: true, digits };
}

/** PRICE — grounded if the exact figure appears as a standalone number in the
 *  message ("$150", "150", "150 dollars"), not as a fragment of another number
 *  ("1500"). Commas in the message are ignored ("1,200"). */
export function priceGrounded(price: number, message: string): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const src = String(message || "").replace(/,/g, "");
  const n = String(Math.round(price));
  return new RegExp(`(?:^|[^\\d])${n}(?:[^\\d]|$)`).test(src);
}

/** EMAIL — grounded if the address (lowercased) is present verbatim. */
export function emailGrounded(value: string, message: string): boolean {
  const v = String(value || "").trim().toLowerCase();
  if (!v || !v.includes("@")) return false;
  return String(message || "").toLowerCase().includes(v);
}

/** ADDRESS — freeform, so grounded when its street NUMBER and the MAJORITY of its
 *  word tokens are present in the message (order/formatting may differ). Rejects
 *  an address the model supplied that the owner didn't type this turn. */
export function addressGrounded(value: string, message: string): boolean {
  const msg = String(message || "").toLowerCase();
  const num = (String(value || "").match(/\b\d{1,6}\b/) || [])[0];
  if (num && !new RegExp(`(?:^|[^\\d])${num}(?:[^\\d]|$)`).test(msg)) return false;
  const tokens = String(value || "").toLowerCase().match(/[a-z]{3,}/g) || [];
  if (!tokens.length) return !!num;                  // a bare number address
  const present = tokens.filter((t) => msg.includes(t)).length;
  return present >= Math.ceil(tokens.length / 2);
}

/** SERVICE — grounded if its price is in the message (the strong anchor) OR the
 *  majority of its name words are. Rejects a whole service the model lifted from
 *  an earlier turn; passes one the owner named this turn ("gutter cleaning, $150").
 *  Extraction's services always pass — they were read from this same message. */
export function serviceGrounded(name: string, price: number | undefined, message: string): boolean {
  if (typeof price === "number" && priceGrounded(price, message)) return true;
  const tokens = String(name || "").toLowerCase().match(/[a-z]{3,}/g) || [];
  if (!tokens.length) return false;
  const msg = String(message || "").toLowerCase();
  const present = tokens.filter((t) => msg.includes(t)).length;
  return present >= Math.ceil(tokens.length / 2);
}

export type SvcIn = { name: string; price?: number; description?: string };
export type SvcRow = { name: string; price?: number };
export type ServiceReconcile = {
  /** The set to WRITE (only meaningful when a real change occurred): existing
   *  entries preserved + genuinely new/changed entries that are grounded. */
  allowed: SvcIn[];
  /** New-or-changed entries the model supplied that are NOT in this message —
   *  lifted from earlier in the chat. Dropped, never written. */
  droppedLift: string[];
  /** Did anything actually change this turn (a grounded new entry or a grounded
   *  price change)? If false and something was dropped, WRITE NOTHING and ask —
   *  a replace-all with no real change would only risk the existing list. */
  changed: boolean;
  /** Existing services the model's list OMITTED and the message NAMED — a removal the
   *  owner actually asked for. Performed, and named in the reply. */
  removed: string[];
  /** Existing services the model's list omitted and the message never mentioned — an
   *  accidental deletion, refused. They are carried into `allowed` so the replace-all
   *  cannot drop them, and they are named so the owner can say "no, remove those". */
  keptBack: string[];
};

function svcKey(name: string): string {
  return String(name || "").toLowerCase().replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().replace(/[.,:;!?]+$/, "").replace(/s$/, "");
}
function samePrice(a: number | undefined, b: number | undefined): boolean {
  const na = typeof a === "number" ? a : undefined;
  const nb = typeof b === "number" ? b : undefined;
  return na === nb;
}

/** setServices is REPLACE-ALL, so filtering its list is destructive. Reconcile
 *  instead: an entry passes if it is grounded in THIS message OR it already exists
 *  on the record UNCHANGED (the model echoing state, not inventing it). A model
 *  entry that CHANGES an existing service's price without that price in the
 *  message is treated as a lift — the RECORD's value is preserved, not the
 *  model's — so a hallucinated price can never overwrite a real one. Only a
 *  genuinely new-or-changed entry needs grounding; existing services are never
 *  destroyed by the grounding check.
 *
 *  AND AN ABSENCE IS A VALUE (added 2026-09-14). Until now this walked ONLY the model's
 *  list, so a service that exists on the record and is missing from that list was not
 *  dropped as a lift and not preserved — it was simply absent from the replace-all, and it
 *  was gone. Nobody invoked a delete: the owner said "add ceramic coating", the model
 *  returned a list missing three, and three services left a live page. He would find out
 *  when a customer asked for one.
 *
 *  So the same rule the prices already get, one dimension over: **an ungrounded ABSENCE may
 *  not overwrite the record's existence, exactly as an ungrounded PRICE may not overwrite
 *  the record's price.** An omission whose service the message NAMES is a removal the owner
 *  asked for — performed, and named in the reply. An omission the message never mentions is
 *  an accident — refused, carried through, and said out loud so one sentence puts it right.
 *
 *  The tie-break is the standing one: a default that destroys work is never acceptable, even
 *  when the alternative is ambiguous. Costed both ways in docs/SERVICES_REPLACE_ALL_COST.md.
 *  The case it cannot read is "get rid of everything except mowing" — no removal is named, so
 *  everything is kept and Hubly asks. One turn, in the direction that keeps the work. */
export function reconcileServices(model: SvcIn[], existing: SvcRow[], message: string): ServiceReconcile {
  const exByKey = new Map<string, SvcRow>();
  for (const e of existing) exByKey.set(svcKey(e.name), { name: e.name, price: typeof e.price === "number" ? e.price : (e.price != null ? Number(e.price) : undefined) });
  const allowed: SvcIn[] = [];
  const droppedLift: string[] = [];
  let changed = false;
  for (const s of model) {
    const key = svcKey(s.name);
    const ex = exByKey.get(key);
    if (serviceGrounded(s.name, s.price, message)) {
      allowed.push(s);                                   // stated this turn -> use the model's version
      if (!ex || !samePrice(ex.price, s.price)) changed = true;   // grounded new, or a grounded price change
    } else if (ex) {
      allowed.push({ name: ex.name, price: ex.price });  // ungrounded but EXISTS -> preserve the RECORD's value
    } else {
      droppedLift.push(s.name);                          // new AND ungrounded -> a lift
    }
  }
  // ── THE OMISSIONS ─────────────────────────────────────────────────────────────────────
  // Everything on the record the model did not send. Grounded in the message => the owner
  // named it, so it goes. Not named => it stays, and we say so.
  const sentKeys = new Set(model.map((s) => svcKey(s.name)));
  const removed: string[] = [];
  const keptBack: string[] = [];
  for (const [key, ex] of exByKey) {
    if (sentKeys.has(key)) continue;
    if (serviceGrounded(ex.name, undefined, message)) {
      removed.push(ex.name);
      changed = true;                                    // a removal IS a change; without this a
                                                         // removal-only turn would write nothing
    } else {
      keptBack.push(ex.name);
      allowed.push({ name: ex.name, price: ex.price });   // the refusal: the record survives
    }
  }
  return { allowed, droppedLift, changed, removed, keptBack };
}

/** ── TIME ──────────────────────────────────────────────────────────────────────────────
 *
 *  THE ONE FIELD ON A JOB THAT CAN SEND A PERSON TO A CUSTOMER AT THE WRONG HOUR, and until
 *  2026-09-16 it was the only field on that writer nothing checked. `updateJob` grounded the
 *  address and grounded the price and passed `scheduled_time` straight through to a raw
 *  `::time` cast. A wrong address on a record is embarrassing; a wrong time is a missed
 *  appointment, and the owner finds out from the customer.
 *
 *  UNAMBIGUOUS OR NOTHING. A time is grounded only if the message STATES it in a form that
 *  cannot mean two things. "2 PM" states 14:00. A bare "2" does not — it is 02:00 or 14:00 and
 *  the difference is twelve hours. Reading a bare hour as the convenient one is the direction
 *  that says "this is fine" and it is silent when it is wrong (Lesson 89), so it refuses.
 *
 *  12 IS THE TRAP AND IT IS HANDLED EXPLICITLY: 12 AM is 00:00 and 12 PM is 12:00, which is the
 *  one place where "add 12 for PM" gives the wrong answer twice.
 *
 *  THE ONE WIDENING, AND ITS BOUNDARY. When Hubly ITSELF put the candidate times on the floor
 *  one turn ago — "should that be at 8:00 PM or 2:00 PM?" — and the owner answers "i meant 8",
 *  he HAS stated it: the meridiem came from our own question, not from anywhere in the
 *  transcript. So a bare hour resolves against the times named in the IMMEDIATELY PRECEDING
 *  assistant message, and only when exactly one of them has that hour. It cannot reach a
 *  different job's time from three turns back, because it cannot see three turns back. Without
 *  this the walk's one correct disambiguation ("i meant 8" -> 20:00) would now be refused, and
 *  re-asking a question he just answered is its own defect.
 */
export type TimeWhy = {
  ok: boolean;
  why?: "unparseable" | "no_time_in_message" | "ambiguous_hour" | "not_in_message";
  /** The hour the message named without saying morning or evening — so the ask can be
   *  specific ("8 in the morning or the evening?") instead of "say that again". */
  ambiguousHour?: number;
};

/** Normalise a written time to "HH:MM", or null when it is not a time at all.
 *  Returning null matters on its own: Postgres THROWS on `'4 pm'::time`, so an unparseable
 *  value used to reach the database and blow up the call rather than be refused. */
export function normalizeTimeValue(value: string | null | undefined): string | null {
  const v = String(value == null ? "" : value).trim().toLowerCase();
  if (!v) return null;
  let m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (m) {
    let h = Number(m[1]); const mi = Number(m[2]);
    if (mi > 59) return null;
    const mer = m[3] ? m[3][0] : "";
    if (mer) {
      if (h < 1 || h > 12) return null;
      h = mer === "a" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    } else if (h > 23) return null;
    return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
  }
  m = v.match(/^(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)$/);
  if (m) {
    let h = Number(m[1]); const mer = m[2][0];
    if (h < 1 || h > 12) return null;
    h = mer === "a" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    return String(h).padStart(2, "0") + ":00";
  }
  return null;
}

/** Every time the message states UNAMBIGUOUSLY, as "HH:MM". */
export function statedTimes(message: string): Set<string> {
  const src = String(message || "").toLowerCase();
  const out = new Set<string>();
  const add = (h: number, mi: number) => { out.add(String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0")); };
  // "8 pm", "8:30pm", "8 p.m." — a meridiem settles it. 12am -> 00, 12pm -> 12.
  for (const m of src.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)/g)) {
    const h12 = Number(m[1]); if (h12 < 1 || h12 > 12) continue;
    const mi = m[2] ? Number(m[2]) : 0;
    const pm = m[3][0] === "p";
    add(pm ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12), mi);
  }
  // "20:00", "00:30" — a 24-hour clock reading. An hour of 1-12 with a colon and NO meridiem
  // is deliberately NOT read here: "9:30" is 09:30 or 21:30 and we do not get to choose.
  for (const m of src.matchAll(/\b(\d{1,2}):([0-5]\d)\b(?!\s*(?:a\.?m\.?|p\.?m\.?))/g)) {
    const h = Number(m[1]); if (!(h === 0 || (h >= 13 && h <= 23))) continue;
    add(h, Number(m[2]));
  }
  if (/\bnoon\b|\bmidday\b/.test(src)) add(12, 0);
  if (/\bmidnight\b/.test(src)) add(0, 0);
  return out;
}

/** The hours the message names WITHOUT saying morning or evening. These ground nothing on
 *  their own; they are what the widening above resolves against our own preceding question. */
export function ambiguousHours(message: string): Set<number> {
  const src = String(message || "").toLowerCase();
  const out = new Set<number>();
  for (const m of src.matchAll(/\b(\d{1,2})(?::([0-5]\d))?\b/g)) {
    const h = Number(m[1]);
    if (h < 1 || h > 12) continue;
    const after = src.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 6);
    if (/^\s*(a\.?m\.?|p\.?m\.?)/.test(after)) continue;   // settled, not ambiguous
    out.add(h);
  }
  return out;
}

/** THE SOURCE SET, and why it is not just "this message".
 *
 *  Measured on the real corpus, 2026-09-16 (canyon-ridge-tree-care, seq 18-20):
 *
 *    owner  "add a job for tomorrow at 2:00 PM"
 *    Hubly  "What's the job for?"
 *    owner  "window cleaning"          <- the job is written here, at 14:00
 *
 *  HUBLY SPLIT THAT STATEMENT ITSELF. He said the time; our own question forced the service
 *  name into a separate message. A strict "it must be in THIS message" rule refuses a time the
 *  owner plainly stated, and punishes him for our follow-up question. So the source set is:
 *
 *    - this message, always
 *    - the owner's immediately PRECEDING message, but ONLY when Hubly's turn in between was a
 *      QUESTION. That is the one case where the split is ours. It cannot reach further back,
 *      and it cannot reach back at all when Hubly's last turn was a statement.
 *
 *  A bare hour ("i meant 8") additionally resolves against the times HUBLY ITSELF offered in
 *  that question — the meridiem came from our own words, not from the transcript.
 *
 *  THE LIMIT, NAMED RATHER THAN HIDDEN (Lesson 89, the false-negative surface): this checks
 *  that the VALUE came from him. It cannot check that the model assigned it to the right job
 *  or the right field. "Move the 3pm to 4pm" contains both times and no grounding rule can tell
 *  which is the new one — that is the matcher's job and the reply's read-back, not this. What
 *  this makes impossible is a time that he never said at all.
 */
export type TimeContext = {
  /** Hubly's immediately preceding message. Used ONLY to resolve a bare hour against times
   *  Hubly itself offered, and to decide whether the split below was ours. */
  priorAsk?: string;
  /** The owner's message before this one. Supplied only when `priorAsk` was a question. */
  priorOwnerSaid?: string;
};

function looksLikeQuestion(text: string): boolean {
  return /\?\s*["'\u201d\u2019)]*\s*$/.test(String(text || "").trim());
}

export function timeGroundedWhy(value: string, message: string, ctx?: TimeContext): TimeWhy {
  const want = normalizeTimeValue(value);
  if (!want) return { ok: false, why: "unparseable" };

  const here = statedTimes(message);
  if (here.has(want)) return { ok: true };

  // OUR OWN SPLIT, and only ours: the extra message counts only when we interrupted him.
  const askedInBetween = !!(ctx?.priorAsk && looksLikeQuestion(ctx.priorAsk));
  const carried = askedInBetween && ctx?.priorOwnerSaid ? statedTimes(ctx.priorOwnerSaid) : new Set<string>();
  if (carried.has(want)) return { ok: true };

  // A BARE HOUR, resolved against the times WE offered in that question — never against the
  // transcript. Exactly one of the offered times may have that hour, or it stays ambiguous.
  const hours = new Set<number>([...ambiguousHours(message), ...(askedInBetween && ctx?.priorOwnerSaid ? ambiguousHours(ctx.priorOwnerSaid) : [])]);
  if (hours.size && ctx?.priorAsk) {
    const offered = [...statedTimes(ctx.priorAsk)];
    const wantH12 = ((Number(want.slice(0, 2)) + 11) % 12) + 1;
    if (hours.has(wantH12)) {
      const sameHour = offered.filter((t) => ((Number(t.slice(0, 2)) + 11) % 12) + 1 === wantH12);
      if (sameHour.length === 1 && sameHour[0] === want) return { ok: true };
    }
  }

  if (hours.size) return { ok: false, why: "ambiguous_hour", ambiguousHour: [...hours][0] };
  if (!here.size && !carried.size) return { ok: false, why: "no_time_in_message" };
  return { ok: false, why: "not_in_message" };
}

export function timeGrounded(value: string, message: string, ctx?: TimeContext): boolean {
  return timeGroundedWhy(value, message, ctx).ok;
}

export type GroundableFact = "phone" | "email" | "address" | "price";

/** One entry point. Returns the value UNCHANGED when it is grounded in the
 *  message, or null when it is not — the writer then writes nothing for that fact
 *  and the model is told to ASK. It never returns a substitute or a suggestion. */
export function groundOrNull<T extends string | number>(
  fact: GroundableFact,
  value: T,
  message: string,
): T | null {
  const ok = fact === "phone" ? phoneGrounded(String(value), message)
    : fact === "email" ? emailGrounded(String(value), message)
    : fact === "address" ? addressGrounded(String(value), message)
    : priceGrounded(Number(value), message);
  return ok ? value : null;
}
