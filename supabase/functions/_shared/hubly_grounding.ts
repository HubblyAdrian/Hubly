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
  const key = phoneDigitsKey(String(value || ""));
  if (key.length < 10) return false;                 // not a full number
  return messageDigits(message).includes(key);
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
 *  destroyed by the grounding check. */
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
  return { allowed, droppedLift, changed };
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
