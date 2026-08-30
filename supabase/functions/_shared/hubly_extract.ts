/**
 * Facts someone literally typed must not depend on a model choosing to call a
 * function.
 *
 * WHY THIS EXISTS
 *
 * There was no extraction step. A fact reached the business record only if the
 * model happened to invoke a capability that had a field for it, on some turn.
 * When it went straight startDraft -> generateDocument -> setServices,
 * everything but the name was gone.
 *
 * Measured 2026-08-19. One message carrying a name, phone, email, street
 * address, city, state, postcode, opening hours, three service-area towns and
 * two priced services produced a record holding the name and nothing else — and
 * a page with no phone, no address, no towns, no hours and no prices. The same
 * shape of message on other runs kept the phone, because the model called
 * updateDraft those times. Non-determinism, on the most important facts a small
 * business has.
 *
 * Same lesson as the Content Value Rule: make it structural, not hopeful.
 *
 * TWO TIERS
 *
 * A. PATTERNS (this file, below). Phone, email, postcode, prices. No model, no
 *    token cost, no failure mode where it declines to run. If the characters
 *    are in the message they are on the record.
 *
 * B. A SINGLE PASS WITH A REQUIRED SCHEMA (extractRecordFacts). For the things
 *    a regex cannot honestly find — which town is the base and which are served,
 *    a street address, opening hours in prose. Every key is REQUIRED and
 *    nullable, so each field is *considered* rather than optionally mentioned;
 *    an omitted key is the failure mode this whole file exists to remove.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It never overwrites. Extraction fills blanks; corrections go through
 * updateDraft. Otherwise re-reading an old message would clobber a later
 * correction, and "I typed my new number and it went back to the old one" is a
 * worse bug than the one being fixed.
 */

import { HublyAI } from "./hubly_ai.ts";

export type ExtractedFacts = {
  phone?: string;
  email?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  address?: string;
  serviceAreaCities?: string[];
  travelRadiusMiles?: number;
  yearsInBusiness?: number;
  hours?: { weekday: number; open: string | null; close: string | null; closed: boolean }[];
  // Services are extracted in the SAME model pass as the rest of the record, so a
  // price stated in prose ("Express Wash $60") lands in the structured record from
  // the same understanding that wrote the brief — not left to a second, separately
  // remembered setServices call, and not chased by the price-line regex that only
  // matches delimiter shapes (see extractPricedServices / PRICE_LINE_RE).
  services?: PricedService[];
};

/** A service as extracted from a message — name always, price/description when the
 *  message actually states them. The regex path leaves description undefined; the
 *  model path fills it when a one-line blurb is present. */
export type PricedService = { name: string; price?: number; description?: string };

// ---------------------------------------------------------------------------
// TIER A — patterns
// ---------------------------------------------------------------------------

/**
 * North American numbers in the shapes people actually type, including the
 * "Phone 801-555-0301" form that was being dropped. Deliberately NOT a general
 * international matcher: a loose pattern picks up prices, dates and postcodes,
 * and a wrong phone number on a business's website is worse than none.
 */
const PHONE_RE = /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})(?!\d)/g;

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

/**
 * A ZIP only counts when something says it is one.
 *
 * A bare five digits is also a price, a year, a house number and a square
 * footage. "Full tear-off from $9,800" and "we have served 12000 customers"
 * both contain five consecutive digits. So the number must be preceded by a
 * two-letter state token or by the word zip/postcode — which is how people
 * write an address anyway.
 */
const ZIP_RE = /(?:\b(?:zip|postcode|postal code)\b[:\s]*|\b[A-Z]{2}\s+)(\d{5})(?:-\d{4})?\b/i;

/** US state names and abbreviations, for the "Bountiful, Utah" / "Ogden UT" forms. */
const STATES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
};

const STATE_NAMES = new Set(Object.values(STATES).map((s) => s.toLowerCase()));

/** Normalised to the form people read back to themselves: 801-555-0301. */
function normalisePhone(area: string, mid: string, last: string): string {
  return `${area}-${mid}-${last}`;
}

/**
 * Everything a pattern can find, with no model involved and no way to decline.
 *
 * Returns only what it is CONFIDENT about. A field it is unsure of is left for
 * tier B or for the owner; a wrong fact on a real business's website costs more
 * than a missing one.
 */
export function extractByPattern(text: string): ExtractedFacts {
  const out: ExtractedFacts = {};
  const src = String(text || "");
  if (!src.trim()) return out;

  // Phone. Skip anything that is part of a longer digit run (an order number,
  // a licence) by requiring the match not to be flanked by digits.
  PHONE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_RE.exec(src))) {
    const before = src[m.index - 1];
    if (before && /\d/.test(before)) continue;
    // A price is not a phone number: "$8019995555" is not real, but "$189" near
    // digits could combine. Guard the obvious case.
    if (before === "$") continue;
    out.phone = normalisePhone(m[1], m[2], m[3]);
    break;                                    // the first is the business's own
  }

  EMAIL_RE.lastIndex = 0;
  const email = EMAIL_RE.exec(src);
  if (email) out.email = email[0].toLowerCase();

  const zip = ZIP_RE.exec(src);
  if (zip) out.postalCode = zip[1];

  // State, from "Bountiful, Utah" or "Ogden UT 84401". The abbreviation form
  // requires a following postcode or end-of-clause, because two capitals are
  // also initials ("Ogden UT" vs "J M Plumbing").
  const named = new RegExp(`\\b(${[...STATE_NAMES].join("|")})\\b`, "i").exec(src);
  if (named) {
    const key = named[1].toLowerCase();
    for (const [abbr, full] of Object.entries(STATES)) {
      if (full.toLowerCase() === key) { out.state = full; break; }
      void abbr;
    }
  } else {
    const abbrev = /\b([A-Z]{2})\s+\d{5}\b/.exec(src);
    if (abbrev && STATES[abbrev[1].toLowerCase()]) out.state = STATES[abbrev[1].toLowerCase()];
  }

  return out;
}

/**
 * Prices, with the thing they are the price OF.
 *
 * Not a replacement for setServices, which the model calls with structured
 * names and descriptions. This is the floor: when the model does not call it,
 * or calls it after the build, the prices someone typed are still recorded.
 *
 * GATED, deliberately conservative (2026-08-23). This floor exists only for the
 * brief; the model's setServices is the real path and handles natural phrasing
 * ("full detail is 175") reliably, so a JUNK NAME here is worse than a miss — a
 * miss the model catches, a junk name ("I charge", "a full detail and") ships. So:
 *   - Requires a currency symbol AND an unambiguous label delimiter (":", em/en
 *     dash, or a spaced hyphen) between the name and the price. This is the shape
 *     of a price LIST ("Full Detail — $175", "Interior Only: $110"), not of prose
 *     ("I charge $175 for a full detail"), which is where the junk came from.
 *   - Rejects any name carrying a first-person/verb/connective token as a backstop.
 * "Full Detail $175" (no delimiter) is intentionally MISSED — the model gets it.
 */
const PRICE_LINE_RE =
  /([A-Za-z][A-Za-z'&/ -]{2,50}?)\s*(?::|—|–|\s-\s)\s*\$\s?([\d,]+(?:\.\d{2})?)/g;
// A name is junk if it carries prose tokens no real service label contains.
const JUNK_NAME_RE = /\b(?:i|i'm|im|we|our|you|your|us|charge[sd]?|charging|cost[s]?|price[sd]?|pricing|pay|paid|for|per|is|are|was|were|do|does|offer[s]?)\b/i;

/** Does the message plausibly state a price at all? A `$N`, or "N dollars/bucks".
 *  Deliberately loose: this only decides whether a ZERO-priced extraction is worth
 *  recording as a miss, so a false positive costs one telemetry row, never a wrong
 *  answer. It is NOT used to extract anything. */
export function messageHasPriceSignal(text: string): boolean {
  const src = String(text || "");
  return /\$\s?\d/.test(src) || /\b\d{1,6}\s?(?:dollars|bucks)\b/i.test(src);
}

export function extractPricedServices(text: string): PricedService[] {
  const src = String(text || "");
  const found: PricedService[] = [];
  const seen = new Set<string>();
  PRICE_LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRICE_LINE_RE.exec(src))) {
    const name = m[1]
      .replace(/^(?:and|or|the|a|an|plus|also|with|for)\b\s*/i, "")  // drop a leading connective swept in
      .replace(/[,;:\-–—\s]+$/, "")
      .trim();
    const price = Number(m[2].replace(/,/g, ""));
    if (!name || name.length < 3 || !isFinite(price) || price <= 0) continue;
    if (JUNK_NAME_RE.test(name)) continue;              // reject prose masquerading as a name
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name, price });
    if (found.length >= 12) break;
  }
  return found;
}

// ---------------------------------------------------------------------------
// TIER B — one pass, required schema
// ---------------------------------------------------------------------------

/**
 * THE SCHEMA IS THE POINT.
 *
 * Every key is required and nullable. The model must decide, for each field,
 * "is this in the message or not" — rather than being free to mention the ones
 * it happened to notice. An optional schema reproduces exactly the bug this
 * file exists to fix, one layer down.
 */
const EXTRACTION_SCHEMA = `Return ONE JSON object with EXACTLY these keys. Every key is REQUIRED.
Use null (or [] for lists) when the message does not say — never omit a key, and never guess.

{
  "city":              string|null,   // the town the business is BASED in
  "state":             string|null,   // full name, e.g. "Utah"
  "address":           string|null,   // street address only, no town/state/postcode
  "postalCode":        string|null,
  "serviceAreaCities": string[],      // OTHER towns served; exclude the base city
  "travelRadiusMiles": number|null,
  "yearsInBusiness":   number|null,   // only if stated as years, not a founding date
  "hours": [                          // one entry per day MENTIONED; [] if none
    { "weekday": 0-6, "open": "HH:MM"|null, "close": "HH:MM"|null, "closed": boolean }
  ],
  "services": [                       // every service/package/product the message NAMES as something they sell; [] if none
    {
      "name":        string,          // the offering's name exactly as written, e.g. "Full Detail"
      "price":       number|null,     // the price IF stated, as a plain number (60, not "$60"); null if the message gives no price for it
      "description": string|null      // a one-line description IF the message gives one for THIS offering; null otherwise — never invent one
    }
  ]
}
Services rules: include an item ONLY if the message presents it as a distinct thing the
business sells or offers (a service, package, tier, or product). Prices arrive in every
shape — "$60", "60 dollars", "sixty", in a labelled "Prices:" list, or mid-sentence; read
the price wherever it is, but NEVER guess one that is not there (null instead). A name with
no price is still a real service — return it with price null. Do not merge two offerings,
split one, rename, or add any the message does not state.

weekday: 0=Sunday, 1=Monday ... 6=Saturday. "Monday to Friday 8am-5pm" is FIVE
entries, 1 through 5, each open "08:00" close "17:00".`;

/** Fields tier B can supply. Used to decide whether it is worth running. */
export const TIER_B_FIELDS = [
  "city", "state", "address", "postalCode",
  "serviceAreaCities", "travelRadiusMiles", "yearsInBusiness", "hours",
] as const;

function cleanString(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" ? s.slice(0, max) : undefined;
}

function cleanNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return isFinite(n) && n > 0 ? n : undefined;
}

/**
 * One extraction pass over the message.
 *
 * Cheap on purpose: json mode, a small token budget, and no conversation
 * history — this is a reading task over one message, not a reasoning task, and
 * giving it the transcript would let it "remember" facts nobody typed.
 */
export async function extractRecordFacts(
  message: string,
  businessId?: string,
): Promise<ExtractedFacts> {
  const text = String(message || "").trim();
  if (!text) return {};
  try {
    const ai = await HublyAI.chat({
      feature: "hubly-record-extract",
      system:
        "You extract facts that are literally present in a business owner's message. " +
        "You never infer, never guess, and never fill a field from world knowledge. " +
        "If the message does not say it, the value is null.\n\n" + EXTRACTION_SCHEMA,
      messages: [{ role: "user", content: text }],
      jsonMode: true,
      maxTokens: 700,
      reasoningEffort: "low",
      businessId,
    });
    const raw = JSON.parse(String(ai.text || "{}").replace(/^```json\s*|\s*```$/g, ""));
    const out: ExtractedFacts = {};

    const city = cleanString(raw.city, 80);
    if (city) out.city = city;
    const state = cleanString(raw.state, 60);
    if (state) out.state = state;
    const address = cleanString(raw.address, 160);
    if (address) out.address = address;
    const zip = cleanString(raw.postalCode, 12);
    if (zip) out.postalCode = zip;

    if (Array.isArray(raw.serviceAreaCities)) {
      const cities = raw.serviceAreaCities
        .map((c: unknown) => cleanString(c, 80))
        .filter((c: string | undefined): c is string => !!c)
        // The base city is not part of the area it serves — printing "serves
        // Bountiful" on a business based in Bountiful reads as padding.
        .filter((c: string) => !city || c.toLowerCase() !== city.toLowerCase())
        .slice(0, 12);
      if (cities.length) out.serviceAreaCities = cities;
    }

    const radius = cleanNumber(raw.travelRadiusMiles);
    if (radius && radius <= 500) out.travelRadiusMiles = Math.round(radius);
    const years = cleanNumber(raw.yearsInBusiness);
    if (years && years <= 150) out.yearsInBusiness = Math.round(years);

    if (Array.isArray(raw.hours)) {
      const hours = raw.hours
        .map((h: Record<string, unknown>) => {
          const weekday = Number(h?.weekday);
          if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
          const open = cleanString(h?.open, 5);
          const close = cleanString(h?.close, 5);
          const closed = h?.closed === true || (!open && !close);
          if (!closed && !(open && close)) return null;   // half a day is not a day
          return { weekday, open: closed ? null : open!, close: closed ? null : close!, closed };
        })
        .filter((h: { weekday: number; open: string | null; close: string | null; closed: boolean } | null): h is { weekday: number; open: string | null; close: string | null; closed: boolean } => !!h);
      // Deduplicate by weekday, last wins.
      const byDay = new Map<number, typeof hours[number]>();
      for (const h of hours) byDay.set(h.weekday, h);
      if (byDay.size) out.hours = [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
    }

    if (Array.isArray(raw.services)) {
      const seen = new Set<string>();
      const services: PricedService[] = [];
      for (const s of raw.services) {
        const name = cleanString((s as Record<string, unknown>)?.name, 80);
        if (!name) continue;                              // a nameless service is nothing to write
        const key = name.toLowerCase();
        if (seen.has(key)) continue;                      // the model occasionally repeats one
        seen.add(key);
        const price = cleanNumber((s as Record<string, unknown>)?.price);
        const description = cleanString((s as Record<string, unknown>)?.description, 200);
        const svc: PricedService = { name };
        if (price && price > 0 && price <= 1_000_000) svc.price = price;   // a price of 0 is "not stated", not free
        if (description) svc.description = description;
        services.push(svc);
        if (services.length >= 30) break;
      }
      if (services.length) out.services = services;
    }

    return out;
  } catch (e) {
    // Extraction is a floor, not a gate. If it fails the turn continues exactly
    // as it did before this file existed.
    console.error("extractRecordFacts failed (ignored):", e);
    return {};
  }
}

/** Patterns first, then the pass — patterns win, because they cannot hallucinate. */
export function mergeFacts(pattern: ExtractedFacts, pass: ExtractedFacts): ExtractedFacts {
  return { ...pass, ...pattern };
}

/** Union the regex-found priced services with the model-found ones, by normalised
 *  name. The regex is a floor (a clean "Name — $60" line it matched cannot be a
 *  hallucination); the model is the reach (it catches "Express Wash $60" and prose
 *  the regex is deliberately blind to, and it alone carries descriptions). Where both
 *  found the same name, keep a price/description from whichever has it — never drop a
 *  price one side saw. Order: regex hits first (highest confidence), then model-only. */
export function mergePricedServices(regexList: PricedService[], modelList: PricedService[]): PricedService[] {
  const byKey = new Map<string, PricedService>();
  const norm = (n: string) => n.toLowerCase().replace(/[\s\-–—]+/g, " ").replace(/s$/, "").trim();
  const add = (s: PricedService) => {
    const name = String(s?.name || "").trim();
    if (!name) return;
    const key = norm(name);
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, { ...s, name }); return; }
    // Same service seen twice — fill the blanks, never overwrite a value with a blank.
    if (prev.price === undefined && typeof s.price === "number") prev.price = s.price;
    if (!prev.description && s.description) prev.description = s.description;
  };
  for (const s of regexList) add(s);
  for (const s of modelList) add(s);
  return [...byKey.values()];
}
