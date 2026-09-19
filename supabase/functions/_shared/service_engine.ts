/**
 * Service Engine — canonical service catalog for every Hubly experience.
 *
 * One Business → one catalog → Marketplace / Website / Booking / AI / Lite / Pro.
 * Do not read editorSvcs / relational services directly from new consumers.
 *
 * See docs/SERVICE_ENGINE.md
 */

import { getBusinessMeta } from "./hubly_business_meta.ts";

export type ServiceStatus = "active" | "inactive" | "archived";
export type PricingMode = "fixed" | "from" | "variable" | "quote_required";

export type ServicePaymentOverride = {
  rule: "pay_in_full" | "deposit" | "card_on_file" | "pay_after_service" | "customer_choice";
  deposit_type?: "pct" | "flat";
  deposit_val?: number;
} | null;

export type HublyAddon = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  duration_delta_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Per-service intelligence — reserved for Phase 9/10.
 * Always present as an object so we never need a breaking schema change later.
 * Empty today. Powerful tomorrow. Do not populate in Phase 6 consumers.
 */
export type ServiceAiMetadata = {
  /** Catalog addon ids customers often add with this service */
  recommended_addon_ids: string[];
  /** Other service ids frequently booked together */
  frequently_combined_service_ids: string[];
  /** Upsell hints — addon or service ids + optional copy */
  suggested_upsells: Array<{
    kind: "addon" | "service";
    id: string;
    label?: string | null;
  }>;
  preparation_instructions: string | null;
  aftercare_instructions: string | null;
  /** Human window, e.g. "2–3 hours" — not a hard booking constraint */
  estimated_completion_window: string | null;
  /** e.g. ["spring", "wedding_season"] or freeform tags */
  seasonality: string[];
  common_customer_questions: Array<{ question: string; answer: string }>;
  /** What the customer should expect from this service */
  customer_expectations: string | null;
  /**
   * Forward-compat bag for future AI fields without another schema bump.
   * Prefer named keys above when promoting a capability.
   */
  extensions: Record<string, unknown>;
};

export function emptyServiceAi(): ServiceAiMetadata {
  return {
    recommended_addon_ids: [],
    frequently_combined_service_ids: [],
    suggested_upsells: [],
    preparation_instructions: null,
    aftercare_instructions: null,
    estimated_completion_window: null,
    seasonality: [],
    common_customer_questions: [],
    customer_expectations: null,
    extensions: {},
  };
}

const KNOWN_AI_KEYS = new Set([
  "recommended_addon_ids",
  "frequently_combined_service_ids",
  "suggested_upsells",
  "preparation_instructions",
  "aftercare_instructions",
  "estimated_completion_window",
  "seasonality",
  "common_customer_questions",
  "customer_expectations",
  "extensions",
]);

export function normalizeServiceAi(raw: unknown): ServiceAiMetadata {
  if (!raw || typeof raw !== "object") return emptyServiceAi();
  const a = raw as Record<string, unknown>;
  const extensions: Record<string, unknown> =
    a.extensions && typeof a.extensions === "object" && !Array.isArray(a.extensions)
      ? { ...(a.extensions as Record<string, unknown>) }
      : {};
  // Park unknown top-level keys in extensions so future writers aren't wiped.
  for (const [k, v] of Object.entries(a)) {
    if (!KNOWN_AI_KEYS.has(k) && !(k in extensions)) extensions[k] = v;
  }
  return {
    recommended_addon_ids: Array.isArray(a.recommended_addon_ids)
      ? a.recommended_addon_ids.map(String).filter(Boolean)
      : [],
    frequently_combined_service_ids: Array.isArray(a.frequently_combined_service_ids)
      ? a.frequently_combined_service_ids.map(String).filter(Boolean)
      : [],
    suggested_upsells: Array.isArray(a.suggested_upsells)
      ? a.suggested_upsells
        .filter((u) => u && typeof u === "object")
        .map((u) => {
          const row = u as Record<string, unknown>;
          const kind = String(row.kind || "addon") === "service" ? "service" : "addon";
          return {
            kind: kind as "addon" | "service",
            id: String(row.id || "").trim(),
            label: row.label != null ? String(row.label) : null,
          };
        })
        .filter((u) => !!u.id)
      : [],
    preparation_instructions: a.preparation_instructions != null
      ? String(a.preparation_instructions)
      : null,
    aftercare_instructions: a.aftercare_instructions != null
      ? String(a.aftercare_instructions)
      : null,
    estimated_completion_window: a.estimated_completion_window != null
      ? String(a.estimated_completion_window)
      : null,
    seasonality: Array.isArray(a.seasonality) ? a.seasonality.map(String).filter(Boolean) : [],
    common_customer_questions: Array.isArray(a.common_customer_questions)
      ? a.common_customer_questions
        .filter((q) => q && typeof q === "object")
        .map((q) => {
          const row = q as Record<string, unknown>;
          return {
            question: String(row.question || "").trim(),
            answer: String(row.answer || "").trim(),
          };
        })
        .filter((q) => !!q.question)
      : [],
    customer_expectations: a.customer_expectations != null
      ? String(a.customer_expectations)
      : null,
    extensions,
  };
}

export type HublyService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  status: ServiceStatus;
  duration_minutes: number;
  pricing: {
    mode: PricingMode;
    price_cents: number | null;
    variable_prices?: Record<string, number>;
    show_price: boolean;
  };
  includes: string[];
  addon_ids: string[];
  sort_order: number;
  media: {
    photos: string[];
    videos?: string[];
    before_after?: Array<{ before: string; after: string }>;
  };
  flags: {
    marketplace: boolean;
    website: boolean;
    popular: boolean;
    instant_book_eligible: boolean;
  };
  buffers?: { before_min?: number; after_min?: number };
  /**
   * THE TYPE MODEL, ON THE THING YOU SELL (see `offerType` at the foot of this file).
   * Optional and absent by default: an offer nobody has typed carries nothing, and the reader
   * derives what it can from the store the offer lives in. Values are stored AS DECLARED and are
   * NOT validated here on purpose — `offerType` is the one place that decides whether a
   * declaration is readable, and a normalizer that quietly dropped `kind:'subscription'` would
   * make "a declaration we cannot read" unreachable and turn that offer into a plain service
   * behind the owner's back.
   */
  offer?: { kind?: string; sale?: string } | null;
  payment?: ServicePaymentOverride;
  recommend_tag?: string | null;
  /**
   * Reserved AI intelligence (Phase 9/10). Always an object — never omit.
   * Phase 6 must not populate or depend on these fields.
   */
  ai: ServiceAiMetadata;
  created_at: string;
  updated_at: string;
};

export type ServiceCatalog = {
  version: 1;
  currency: "usd";
  updated_at: string;
  services: HublyService[];
  addons: HublyAddon[];
};

/** Booking / marketplace DTO (cents + minutes). */
export type BookingServiceDto = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  price_label: string | null;
  duration_minutes: number;
  includes: string[];
  add_ons: Array<{ id: string; name: string; price_cents: number | null }>;
  image_url: string | null;
  pricing_mode: PricingMode;
  quote_required: boolean;
  category: string | null;
  subcategory: string | null;
  status: ServiceStatus;
};

export type MatchServiceDto = {
  id: string;
  name: string;
  description: string | null;
  includes: string[];
  category: string | null;
  subcategory: string | null;
  price_cents: number | null;
  duration_minutes: number;
  quote_required: boolean;
  addon_names: string[];
};

export type ListChannel = "marketplace" | "website" | "all" | "owner";

function nowIso(): string {
  return new Date().toISOString();
}

function dollarsToCents(n: unknown): number | null {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

function priceLabel(cents: number | null, mode: PricingMode): string | null {
  if (mode === "quote_required") return "Quote required";
  if (cents == null) return null;
  const dollars = cents / 100;
  const formatted = `$${dollars.toFixed(cents % 100 === 0 ? 0 : 2)}`;
  return mode === "from" ? `From ${formatted}` : formatted;
}

function normalizeStatus(raw: unknown): ServiceStatus {
  const s = String(raw || "active").toLowerCase();
  if (s === "inactive" || s === "hidden" || s === "disabled") return "inactive";
  if (s === "archived" || s === "deleted") return "archived";
  return "active";
}

function normalizePricingMode(raw: unknown, priceCents: number | null): PricingMode {
  const s = String(raw || "").toLowerCase();
  if (s === "quote_required" || s === "quote" || s === "request_quote") return "quote_required";
  if (s === "from" || s === "starting" || s === "starting_at") return "from";
  if (s === "variable" || s === "vehicle") return "variable";
  if (s === "fixed" || s === "flat") return "fixed";
  if (priceCents == null) return "quote_required";
  return "fixed";
}

function parseIncludes(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.includesList) && raw.includesList.length) {
    return raw.includesList.map(String).filter(Boolean);
  }
  const list = raw.includes ?? raw.included ?? raw.includeList;
  if (Array.isArray(list)) return list.map(String).filter(Boolean);
  if (typeof list === "string" && list.trim()) {
    return list.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseDurationMinutes(raw: Record<string, unknown>): number {
  const mins = Number(raw.duration_minutes ?? raw.durationMinutes ?? raw.mins);
  if (Number.isFinite(mins) && mins > 0) return Math.round(mins);
  const hours = Number(
    raw.duration_hours ?? raw.durationHours ?? raw.hours ?? raw.dur,
  );
  if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
  const dur = String(raw.duration || raw.time || "").toLowerCase();
  const hm = dur.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hm) return Math.round(Number(hm[1]) * 60);
  const mm = dur.match(/(\d+)\s*m/);
  if (mm) return Number(mm[1]);
  return 120;
}

function newId(prefix: string): string {
  try {
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function emptyCatalog(): ServiceCatalog {
  return {
    version: 1,
    currency: "usd",
    updated_at: nowIso(),
    services: [],
    addons: [],
  };
}

/** Migrate one legacy editorSvcs / services row → HublyService. */
function migrateLegacyService(
  raw: Record<string, unknown>,
  index: number,
  addonIdByName: Map<string, string>,
): HublyService {
  const ts = nowIso();
  const id = String(raw.id || `svc-${index}` || newId("svc"));
  const priceCents = dollarsToCents(raw.price ?? raw.startingPrice ?? raw.amount);
  let mode = normalizePricingMode(raw.pricingType ?? raw.pricing_mode ?? raw.mode, priceCents);
  if (String(raw.pricingType || "").toLowerCase() === "variable") mode = "variable";

  const variable: Record<string, number> = {};
  const vp = (raw.varPrices || raw.variable_prices || {}) as Record<string, unknown>;
  if (vp && typeof vp === "object") {
    for (const [k, v] of Object.entries(vp)) {
      const c = dollarsToCents(v);
      if (c != null) variable[k] = c;
    }
  }

  // Nested add-ons → ensure catalog addons exist; collect ids
  const nested = Array.isArray(raw.addOns)
    ? raw.addOns
    : (Array.isArray(raw.addons) ? raw.addons : []);
  const addon_ids: string[] = [];
  for (const a of nested as Array<Record<string, unknown>>) {
    const name = String(a.name || a.title || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    let aid = String(a.id || "").trim() || addonIdByName.get(key) || "";
    if (!aid) {
      aid = newId("addon");
      addonIdByName.set(key, aid);
    } else {
      addonIdByName.set(key, aid);
    }
    if (!addon_ids.includes(aid)) addon_ids.push(aid);
  }

  // Explicit addon_ids from canonical rows
  if (Array.isArray(raw.addon_ids)) {
    for (const id of raw.addon_ids.map(String)) {
      if (id && !addon_ids.includes(id)) addon_ids.push(id);
    }
  }

  const photos: string[] = [];
  if (Array.isArray(raw.photos)) photos.push(...raw.photos.map(String).filter(Boolean));
  if (Array.isArray(raw.photo_urls)) photos.push(...raw.photo_urls.map(String).filter(Boolean));
  const img = raw.imgUrl || raw.image || raw.image_url;
  if (img && !photos.includes(String(img))) photos.unshift(String(img));

  const mediaRaw = (raw.media && typeof raw.media === "object")
    ? raw.media as Record<string, unknown>
    : null;
  if (mediaRaw && Array.isArray(mediaRaw.photos)) {
    for (const p of mediaRaw.photos.map(String)) {
      if (p && !photos.includes(p)) photos.push(p);
    }
  }

  let payment: ServicePaymentOverride = null;
  if (raw.payment && typeof raw.payment === "object") {
    payment = raw.payment as ServicePaymentOverride;
  } else if (raw.paymentSetting) {
    const ps = String(raw.paymentSetting).toLowerCase();
    const ruleMap: Record<string, NonNullable<ServicePaymentOverride>["rule"]> = {
      full: "pay_in_full",
      pay_in_full: "pay_in_full",
      deposit: "deposit",
      later: "pay_after_service",
      choice: "customer_choice",
      card: "card_on_file",
    };
    // Only carry sub-fields the owner actually set. This used to hard-code
    // pct/25 onto every legacy conversion, which meant a package saying merely
    // "take a deposit" always claimed 25% — so it could never inherit the
    // account's own percentage, and an owner who changed their default saw
    // nothing change on those packages. An absent sub-field is the signal that
    // resolveBookingPayment should fall back (booking_engine.ts).
    payment = { rule: ruleMap[ps] || "pay_after_service" };
    if (raw.depositType === "flat" || raw.depositType === "pct") {
      payment.deposit_type = raw.depositType;
    }
    const rawDep = Number(raw.depositVal);
    if (Number.isFinite(rawDep) && rawDep > 0) payment.deposit_val = rawDep;
  }

  return {
    id,
    name: String(raw.name || raw.title || "Service").trim() || "Service",
    description: raw.description != null
      ? String(raw.description)
      : (raw.desc != null ? String(raw.desc) : null),
    category: raw.category != null ? String(raw.category) : null,
    subcategory: raw.subcategory != null ? String(raw.subcategory) : null,
    status: normalizeStatus(raw.status ?? (raw.active === false ? "inactive" : "active")),
    duration_minutes: parseDurationMinutes(raw),
    pricing: {
      mode,
      price_cents: mode === "quote_required" ? null : priceCents,
      variable_prices: Object.keys(variable).length ? variable : undefined,
      show_price: raw.showPrice !== false && mode !== "quote_required",
    },
    includes: parseIncludes(raw),
    addon_ids,
    sort_order: Number(raw.sort_order ?? index) || index,
    media: {
      photos: photos.slice(0, 24),
      videos: mediaRaw && Array.isArray(mediaRaw.videos)
        ? mediaRaw.videos.map(String).filter(Boolean)
        : [],
      before_after: mediaRaw && Array.isArray(mediaRaw.before_after)
        ? mediaRaw.before_after as Array<{ before: string; after: string }>
        : [],
    },
    flags: {
      marketplace: raw.marketplace !== false &&
        (raw.flags as { marketplace?: boolean } | undefined)?.marketplace !== false,
      website: raw.website !== false &&
        (raw.flags as { website?: boolean } | undefined)?.website !== false,
      popular: !!(raw.popular || (raw.flags as { popular?: boolean } | undefined)?.popular),
      instant_book_eligible: raw.instantBook !== false &&
        (raw.flags as { instant_book_eligible?: boolean } | undefined)
            ?.instant_book_eligible !== false,
    },
    payment,
    recommend_tag: raw.recommendTag != null ? String(raw.recommendTag) : null,
    ai: normalizeServiceAi(raw.ai),
    created_at: String(raw.created_at || ts),
    updated_at: String(raw.updated_at || ts),
  };
}

function migrateLegacyAddon(raw: Record<string, unknown>, index: number): HublyAddon {
  const ts = nowIso();
  return {
    id: String(raw.id || `addon-${index}` || newId("addon")),
    name: String(raw.name || raw.title || "Add-on").trim() || "Add-on",
    description: raw.description != null ? String(raw.description) : (raw.desc != null ? String(raw.desc) : null),
    price_cents: dollarsToCents(raw.price ?? raw.amount ?? raw.price_cents),
    duration_delta_minutes: Number(raw.duration_delta_minutes ?? raw.durationDeltaMinutes ?? 0) || 0,
    active: raw.active !== false && raw.enabled !== false,
    created_at: String(raw.created_at || ts),
    updated_at: String(raw.updated_at || ts),
  };
}

function normalizeCanonicalService(raw: Record<string, unknown>, index: number): HublyService {
  const ts = nowIso();
  const pricing = (raw.pricing && typeof raw.pricing === "object")
    ? raw.pricing as Record<string, unknown>
    : {};
  const media = (raw.media && typeof raw.media === "object")
    ? raw.media as Record<string, unknown>
    : {};
  const flags = (raw.flags && typeof raw.flags === "object")
    ? raw.flags as Record<string, unknown>
    : {};
  const mode = normalizePricingMode(
    pricing.mode ?? raw.pricing_mode,
    pricing.price_cents != null ? Number(pricing.price_cents) : null,
  );
  const priceCents = pricing.price_cents != null
    ? Math.round(Number(pricing.price_cents))
    : null;

  return {
    id: String(raw.id || `svc-${index}`),
    name: String(raw.name || "Service").trim() || "Service",
    description: raw.description != null ? String(raw.description) : null,
    category: raw.category != null ? String(raw.category) : null,
    subcategory: raw.subcategory != null ? String(raw.subcategory) : null,
    status: normalizeStatus(raw.status),
    duration_minutes: Math.max(15, Number(raw.duration_minutes) || 120),
    pricing: {
      mode,
      price_cents: mode === "quote_required" ? null : (Number.isFinite(priceCents as number) ? priceCents : null),
      variable_prices: pricing.variable_prices && typeof pricing.variable_prices === "object"
        ? pricing.variable_prices as Record<string, number>
        : undefined,
      show_price: pricing.show_price !== false && mode !== "quote_required",
    },
    includes: Array.isArray(raw.includes) ? raw.includes.map(String).filter(Boolean) : [],
    addon_ids: Array.isArray(raw.addon_ids) ? raw.addon_ids.map(String).filter(Boolean) : [],
    // THE DECLARED TYPE SURVIVES THE ROUND TRIP. This normalizer lists its fields explicitly, so
    // anything not named here is silently dropped — which is how a type stamped by the editor
    // would have vanished on the next read and the offer would have quietly become whatever its
    // store implies. Preserved verbatim, not validated: `offerType` is the one place that judges.
    offer: normalizeOfferDeclaration(raw.offer),
    sort_order: Number(raw.sort_order ?? index) || index,
    media: {
      photos: Array.isArray(media.photos) ? media.photos.map(String).filter(Boolean).slice(0, 24) : [],
      videos: Array.isArray(media.videos) ? media.videos.map(String).filter(Boolean) : [],
      before_after: Array.isArray(media.before_after)
        ? media.before_after as Array<{ before: string; after: string }>
        : [],
    },
    flags: {
      marketplace: flags.marketplace !== false,
      website: flags.website !== false,
      popular: !!flags.popular,
      instant_book_eligible: flags.instant_book_eligible !== false,
    },
    payment: (raw.payment as ServicePaymentOverride) ?? null,
    recommend_tag: raw.recommend_tag != null ? String(raw.recommend_tag) : null,
    ai: normalizeServiceAi(raw.ai),
    created_at: String(raw.created_at || ts),
    updated_at: String(raw.updated_at || ts),
  };
}

function normalizeCanonicalAddon(raw: Record<string, unknown>, index: number): HublyAddon {
  const ts = nowIso();
  const cents = raw.price_cents != null ? Math.round(Number(raw.price_cents)) : null;
  return {
    id: String(raw.id || `addon-${index}`),
    name: String(raw.name || "Add-on").trim() || "Add-on",
    description: raw.description != null ? String(raw.description) : null,
    price_cents: Number.isFinite(cents as number) ? cents : null,
    duration_delta_minutes: Number(raw.duration_delta_minutes) || 0,
    active: raw.active !== false,
    created_at: String(raw.created_at || ts),
    updated_at: String(raw.updated_at || ts),
  };
}

/**
 * Load the canonical Service Catalog for a Business.
 * Prefers meta.service_catalog; otherwise migrates legacy editorSvcs/addons in-memory.
 */
export function getCatalog(business: Record<string, unknown>): ServiceCatalog {
  const meta = getBusinessMeta(business);
  const existing = meta.service_catalog;
  if (existing && typeof existing === "object") {
    const cat = existing as ServiceCatalog;
    if (Array.isArray(cat.services) && Array.isArray(cat.addons)) {
      return {
        version: 1,
        currency: "usd",
        updated_at: cat.updated_at || nowIso(),
        services: cat.services.map((s, i) =>
          normalizeCanonicalService(s as unknown as Record<string, unknown>, i)
        ),
        addons: cat.addons.map((a, i) =>
          normalizeCanonicalAddon(a as unknown as Record<string, unknown>, i)
        ),
      };
    }
  }

  const addonIdByName = new Map<string, string>();
  const addons: HublyAddon[] = [];
  const globalAddons = Array.isArray(meta.editorAddons)
    ? meta.editorAddons as Array<Record<string, unknown>>
    : [];
  for (let i = 0; i < globalAddons.length; i++) {
    const a = migrateLegacyAddon(globalAddons[i], i);
    addons.push(a);
    addonIdByName.set(a.name.toLowerCase(), a.id);
  }

  const legacyServices = Array.isArray(meta.editorSvcs)
    ? meta.editorSvcs as Array<Record<string, unknown>>
    : (Array.isArray(meta.services) ? meta.services as Array<Record<string, unknown>> : []);

  // First pass: collect nested addons into catalog
  for (const raw of legacyServices) {
    const nested = Array.isArray(raw.addOns)
      ? raw.addOns
      : (Array.isArray(raw.addons) ? raw.addons : []);
    for (const a of nested as Array<Record<string, unknown>>) {
      const name = String(a.name || a.title || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (addonIdByName.has(key)) continue;
      const migrated = migrateLegacyAddon(
        { ...a, id: a.id || newId("addon") },
        addons.length,
      );
      addons.push(migrated);
      addonIdByName.set(key, migrated.id);
    }
  }

  const services = legacyServices.map((raw, i) =>
    migrateLegacyService(raw, i, addonIdByName)
  );

  // Ensure every referenced nested addon exists in addons[]
  for (const raw of legacyServices) {
    const nested = Array.isArray(raw.addOns)
      ? raw.addOns
      : (Array.isArray(raw.addons) ? raw.addons : []);
    for (const a of nested as Array<Record<string, unknown>>) {
      const name = String(a.name || "").trim();
      if (!name) continue;
      const id = addonIdByName.get(name.toLowerCase());
      if (!id) continue;
      if (!addons.some((x) => x.id === id)) {
        addons.push(migrateLegacyAddon({ ...a, id }, addons.length));
      }
    }
  }

  return {
    version: 1,
    currency: "usd",
    updated_at: nowIso(),
    services,
    addons,
  };
}

export function listServices(
  business: Record<string, unknown>,
  opts?: { channel?: ListChannel; includeInactive?: boolean },
): HublyService[] {
  const catalog = getCatalog(business);
  const channel = opts?.channel || "all";
  return catalog.services
    .filter((s) => {
      if (!opts?.includeInactive) {
        if (s.status !== "active") return false;
      } else if (s.status === "archived") {
        return channel === "owner";
      }
      if (channel === "marketplace") return s.flags.marketplace;
      if (channel === "website") return s.flags.website;
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getService(
  business: Record<string, unknown>,
  serviceId: string,
): HublyService | null {
  const catalog = getCatalog(business);
  const needle = String(serviceId || "").trim();
  if (!needle) return null;
  return catalog.services.find((s) => s.id === needle) ||
    catalog.services.find((s) => s.name.toLowerCase() === needle.toLowerCase()) ||
    null;
}

export function hydrateAddons(
  catalog: ServiceCatalog,
  addonIds: string[],
): HublyAddon[] {
  const byId = new Map(catalog.addons.map((a) => [a.id, a]));
  return addonIds.map((id) => byId.get(id)).filter((a): a is HublyAddon => !!a && a.active);
}

export function toBookingDto(
  business: Record<string, unknown>,
  serviceId: string,
): BookingServiceDto | null {
  const catalog = getCatalog(business);
  const service = getService(business, serviceId);
  if (!service || service.status === "archived") return null;
  const addons = hydrateAddons(catalog, service.addon_ids);
  const mode = service.pricing.mode;
  const price = service.pricing.price_cents;
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    price_cents: mode === "quote_required" ? null : price,
    price_label: priceLabel(price, mode),
    duration_minutes: service.duration_minutes,
    includes: service.includes,
    add_ons: addons.map((a) => ({
      id: a.id,
      name: a.name,
      price_cents: a.price_cents,
    })),
    image_url: service.media.photos[0] || null,
    pricing_mode: mode,
    // ══ quote_required FOLLOWS *SALE*, NOT mode — RULED BY ADRIAN, 2026-09-18 ═══════════════════
    //
    // This read `mode === "quote_required"`, which made a DECLARED sale of "quoted" invisible to the
    // booking engine: a service priced "from $95" and marked quoted came through as bookable at $95,
    // so "$95 starting — call for a quote" was expressible in the offer type and impossible in the
    // flow. offerType() already resolves sale — declared wins, structure derives as the permanent
    // fallback (a membership offer has no pricing.mode and structure is the only thing that can answer
    // for it) — so asking IT is asking the one source.
    //
    // INERT FOR EVERY EXISTING ROW: nothing writes `declared.sale` yet, so offerType falls to the same
    // structure derivation this expression used, and every service resolves exactly as it does today.
    // That is what makes it the safest possible change and why it lands before the writer.
    quote_required: offerType(service).sale === "quoted",
    category: service.category,
    subcategory: service.subcategory,
    status: service.status,
  };
}

export function listBookingServices(
  business: Record<string, unknown>,
  channel: ListChannel = "marketplace",
): BookingServiceDto[] {
  return listServices(business, { channel })
    .map((s) => toBookingDto(business, s.id))
    .filter((s): s is BookingServiceDto => !!s);
}

export function toMatchDto(
  business: Record<string, unknown>,
  service: HublyService,
): MatchServiceDto {
  const catalog = getCatalog(business);
  const addons = hydrateAddons(catalog, service.addon_ids);
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    includes: service.includes,
    category: service.category,
    subcategory: service.subcategory,
    // PRICE STILL FOLLOWS MODE, and deliberately: "quoted" means the customer asks, not that there is
    // no number. A service priced "from $95" and marked quoted keeps its 95 — that IS the feature
    // ("$95 starting — call for a quote"), and nulling the price here would throw away the half that
    // makes it useful. Only quote_required moves to sale.
    price_cents: service.pricing.mode === "quote_required"
      ? null
      : service.pricing.price_cents,
    duration_minutes: service.duration_minutes,
    quote_required: offerType(service).sale === "quoted",
    addon_names: addons.map((a) => a.name),
  };
}

/** Compact list for AI — only real catalog entries. Never invent. */
export function toAiSummary(
  business: Record<string, unknown>,
  channel: ListChannel = "marketplace",
): {
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    subcategory: string | null;
    includes: string[];
    addon_names: string[];
    price_label: string | null;
    duration_minutes: number;
    quote_required: boolean;
  }>;
  addons: Array<{ id: string; name: string; price_cents: number | null }>;
} {
  const catalog = getCatalog(business);
  const services = listServices(business, { channel }).map((s) => {
    const dto = toBookingDto(business, s.id)!;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      subcategory: s.subcategory,
      includes: s.includes,
      addon_names: dto.add_ons.map((a) => a.name),
      price_label: dto.price_label,
      duration_minutes: s.duration_minutes,
      quote_required: dto.quote_required,
    };
  });
  return {
    services,
    addons: catalog.addons.filter((a) => a.active).map((a) => ({
      id: a.id,
      name: a.name,
      price_cents: a.price_cents,
    })),
  };
}

export function snapshotService(
  business: Record<string, unknown>,
  serviceId: string,
  selectedAddonIds: string[] = [],
): Record<string, unknown> | null {
  const dto = toBookingDto(business, serviceId);
  if (!dto) return null;
  const selected = dto.add_ons.filter((a) => selectedAddonIds.includes(a.id));
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    duration_minutes: dto.duration_minutes,
    price_cents: dto.price_cents,
    pricing_mode: dto.pricing_mode,
    quote_required: dto.quote_required,
    includes: dto.includes,
    category: dto.category,
    subcategory: dto.subcategory,
    add_ons: selected,
    image_url: dto.image_url,
    snapped_at: nowIso(),
  };
}

/**
 * Build canonical catalog for persistence.
 * Phase 6 freeze: write `service_catalog` only — no dual-write to editorSvcs /
 * editorAddons / meta.services. getCatalog() still migrate-on-reads legacy
 * mirrors until a business is re-saved.
 */
export function buildCatalogWritePayload(
  catalog: ServiceCatalog,
  priorMeta?: Record<string, unknown>,
): Record<string, unknown> {
  const meta = { ...(priorMeta || {}) };
  const stamped: ServiceCatalog = {
    ...catalog,
    version: 1,
    currency: "usd",
    updated_at: nowIso(),
    // Guarantee ai is always persisted as a full object (never omitted).
    services: (catalog.services || []).map((s) => ({
      ...s,
      ai: normalizeServiceAi(s.ai),
    })),
  };
  meta.service_catalog = stamped;

  // Drop legacy mirrors on write so the catalog is the only persisted truth.
  delete meta.editorSvcs;
  delete meta.editorAddons;
  delete meta.services;

  return meta;
}

/** Replace catalog services from Lite/owner editor payload (dollars or cents tolerant). */
export function catalogFromOwnerServicesPayload(
  servicesIn: unknown[],
  priorCatalog?: ServiceCatalog | null,
): ServiceCatalog {
  const prior = priorCatalog || emptyCatalog();
  const addonIdByName = new Map(prior.addons.map((a) => [a.name.toLowerCase(), a.id]));
  const addons = [...prior.addons];
  const ts = nowIso();

  const priorById = new Map(prior.services.map((s) => [s.id, s]));

  const services = servicesIn.slice(0, 40).map((raw, i) => {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    // Ensure nested addons are registered
    const nested = Array.isArray(s.addOns)
      ? s.addOns
      : (Array.isArray(s.addons) ? s.addons : []);
    for (const a of nested as Array<Record<string, unknown>>) {
      const name = String(a.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!addonIdByName.has(key)) {
        const addon = migrateLegacyAddon({ ...a, id: a.id || newId("addon") }, addons.length);
        addons.push(addon);
        addonIdByName.set(key, addon.id);
      } else {
        // Update price on existing addon by name
        const id = addonIdByName.get(key)!;
        const idx = addons.findIndex((x) => x.id === id);
        if (idx >= 0) {
          const cents = a.price_cents != null
            ? Number(a.price_cents)
            : dollarsToCents(a.price ?? a.amount);
          addons[idx] = {
            ...addons[idx],
            name,
            price_cents: Number.isFinite(cents as number) ? cents as number : addons[idx].price_cents,
            updated_at: ts,
            active: true,
          };
        }
      }
    }
    const migrated = migrateLegacyService(s, i, addonIdByName);
    // Owner/Lite payloads do not edit ai yet — preserve prior intelligence slot.
    if (s.ai == null) {
      const priorSvc = priorById.get(migrated.id);
      migrated.ai = priorSvc ? normalizeServiceAi(priorSvc.ai) : emptyServiceAi();
    }
    return migrated;
  });

  return {
    version: 1,
    currency: "usd",
    updated_at: ts,
    services,
    addons,
  };
}

/** AI guard: does this Business offer a service matching the name? */
export function catalogHasServiceName(
  business: Record<string, unknown>,
  name: string,
): boolean {
  const needle = String(name || "").toLowerCase().trim();
  if (!needle) return false;
  return listServices(business, { channel: "marketplace" }).some((s) => {
    const n = s.name.toLowerCase();
    return n === needle || n.includes(needle) || needle.includes(n);
  });
}

// ══ THE TYPE MODEL — ON THE OFFER, AND ONE READER ═══════════════════════════════════════════
//
// SETTLED 30, established from the column names rather than assumed: `memberships` carries
// `customer_id`, `next_due_date` and `source_plan_ref` — the columns of an INSTANCE pointing at
// an OFFER — and `meta.membership_offers` sits beside `service_catalog.services`, where a
// thing-you-sell belongs. So:
//
//     OFFER : MEMBERSHIP  ::  SERVICE : JOB
//
// THEREFORE THE TYPE BELONGS ON THE THING YOU SELL, never on the instance. A job does not need to
// be told it is "bookable" — it already happened. A membership does not need to be told it is a
// membership — the plan it came from is.
//
// TWO AXES, AND THEY ARE INDEPENDENT (Adrian, 2026-09-16: the `+` "asks quote-or-booking AND
// service/membership/other"). A membership can be quoted; a one-off service can be bookable. They
// are not two values of one field, and collapsing them is how "quote" ended up meaning four
// different things in the same codebase.
//
//   kind  — WHAT IT IS:        service | membership | other
//   sale  — HOW SOMEONE GETS IT: bookable | quoted
//
// "UNTYPED MUST NOT GUESS." That rule is about the RECORD, not about the STRUCTURE. An entry in
// `service_catalog.services` is a service because of WHERE IT IS STORED — that is a structural
// fact, not an inference about the owner's intent, and refusing to read it would be the
// empty-reader defect (reporting our missing bookkeeping as his missing data). What must never be
// guessed is an offer with no home yet: the one the `+` button is about to create. That one is
// `kind: 'unknown'`, and the only correct behaviour is to ASK.
//
// So the precedence is: the record's own declaration, then the structure it lives in, then unknown.
// Never a default, and never the flattering value.

/** The declaration as stored: two optional strings, kept verbatim. Returns null when there is no
 *  declaration at all, so an untyped offer carries nothing rather than an empty object that reads
 *  as "somebody typed this". */
export function normalizeOfferDeclaration(raw: unknown): { kind?: string; sale?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind != null ? String(o.kind).trim() : "";
  const sale = o.sale != null ? String(o.sale).trim() : "";
  if (!kind && !sale) return null;
  const out: { kind?: string; sale?: string } = {};
  if (kind) out.kind = kind;
  if (sale) out.sale = sale;
  return out;
}

export type OfferKind = "service" | "membership" | "other" | "unknown";
export type OfferSale = "bookable" | "quoted" | "unknown";
/** Where the offer was read from. This is the STRUCTURE, and it is what types an undeclared
 *  offer — passed in by the caller because only the caller knows which store it opened. */
export type OfferHome = "catalog_services" | "membership_offers" | "none";

export type OfferType = {
  kind: OfferKind;
  sale: OfferSale;
  /** How each half was decided: 'declared' (the record says), 'structure' (where it lives),
   *  'unknown' (we do not know and must ask). Carried so a surface can show its reasoning and a
   *  check can assert it, exactly as hcDeriveBand carries `source` for the A/B/C bands. */
  kindFrom: "declared" | "structure" | "unknown";
  saleFrom: "declared" | "structure" | "unknown";
};

const OFFER_KINDS: OfferKind[] = ["service", "membership", "other"];

/**
 * THE PRICING MODE, FROM EITHER SHAPE — and the two shapes are named, not guessed at.
 *
 * `pricing.mode` is the canonical HublyService field. `pricingType` is the EDITOR's field, and the
 * editor's vocabulary differs: 'flat' is 'fixed', and 'quote' / 'request_quote' mean
 * 'quote_required'. That translation is not new here — `buildServiceCatalogFromEditor` in
 * public/hubly.html has always done it on the way into the catalog — but it lived only there, so a
 * reader handed a half-built editor object saw no mode at all and answered 'unknown'. One reader
 * that knows both shapes beats a mapper in front of a reader that knows one: a mapper is a second
 * place for the vocabulary to drift, and this codebase's whole problem is second places.
 */
function offerPricingMode(o: Record<string, unknown>): string {
  const pricing = (o.pricing && typeof o.pricing === "object" ? o.pricing as Record<string, unknown> : null);
  let m = String((pricing ? pricing.mode : o.pricing_mode) ?? o.pricingType ?? "").trim().toLowerCase();
  if (m === "flat") m = "fixed";
  if (m === "quote" || m === "request_quote") m = "quote_required";
  return m;
}
const HOME_KIND: Record<OfferHome, OfferKind> = {
  catalog_services: "service",
  membership_offers: "membership",
  none: "unknown",
};

/**
 * THE ONE READER. Every surface that needs to know what an offer is calls this and nothing else.
 *
 * `raw` is an offer record — a HublyService, a membership offer, or the half-built object the `+`
 * flow is holding. `home` is the store it came out of; pass "none" for something not yet saved.
 *
 * It never throws and never guesses. An answer of 'unknown' is a real answer and means ASK.
 */
export function offerType(raw: unknown, home: OfferHome = "none"): OfferType {
  const o = (raw && typeof raw === "object" ? raw as Record<string, unknown> : {});
  const declared = (o.offer && typeof o.offer === "object" ? o.offer as Record<string, unknown> : {});

  // ── KIND ────────────────────────────────────────────────────────────────────────────────
  const dk = String(declared.kind ?? "").trim().toLowerCase();
  let kind: OfferKind, kindFrom: OfferType["kindFrom"];
  if ((OFFER_KINDS as string[]).includes(dk)) { kind = dk as OfferKind; kindFrom = "declared"; }
  // A DECLARATION WE CANNOT READ IS A READ FAILURE, NOT AN ABSENT DECLARATION. An offer whose
  // record says `kind: 'subscription'` has plainly been told it is something recurring by somebody
  // — falling back to the store it sits in would render it as a bookable one-off service, which is
  // guessing the flattering answer over an explicit statement we did not understand. Same shape as
  // the A/B/C rule refusing to re-band an item the owner moved himself when the letter is
  // unreadable: when HIS word is present and broken, we say so; we do not overrule it with ours.
  else if (dk !== "") { kind = "unknown"; kindFrom = "unknown"; }
  else if (home !== "none") { kind = HOME_KIND[home]; kindFrom = "structure"; }
  else { kind = "unknown"; kindFrom = "unknown"; }

  // ── SALE ────────────────────────────────────────────────────────────────────────────────
  // `pricing.mode === 'quote_required'` IS the quoted case and has been in PricingMode since the
  // service engine was written — so this axis is not new storage, it is a name for something the
  // catalog has always recorded. An explicit `offer.sale` still wins, because a membership offer
  // has no `pricing.mode` at all and needs somewhere to say it.
  const ds = String(declared.sale ?? "").trim().toLowerCase();
  const mode = offerPricingMode(o);
  let sale: OfferSale, saleFrom: OfferType["saleFrom"];
  if (ds === "bookable" || ds === "quoted") { sale = ds as OfferSale; saleFrom = "declared"; }
  else if (ds !== "") { sale = "unknown"; saleFrom = "unknown"; }   // same refusal, other axis
  else if (mode === "quote_required") { sale = "quoted"; saleFrom = "structure"; }
  else if (mode === "fixed" || mode === "from" || mode === "variable") { sale = "bookable"; saleFrom = "structure"; }
  else { sale = "unknown"; saleFrom = "unknown"; }

  return { kind, sale, kindFrom, saleFrom };
}

/** The two questions, in the product's own words, so the `+` flow and the editor cannot word them
 *  differently. Exported as data for the same reason HC_BAND_RULE is: the copy IS the rule. */
export const OFFER_TYPE_QUESTIONS = {
  kind: {
    ask: "What are you adding?",
    options: [
      { value: "service", label: "A service", hint: "A one-off job someone pays for once." },
      { value: "membership", label: "A membership", hint: "Someone pays on a schedule and keeps getting it." },
      { value: "other", label: "Something else", hint: "A product, a fee, a package — anything you sell that isn’t either of those." },
    ],
  },
  sale: {
    ask: "How do people get it?",
    options: [
      { value: "bookable", label: "They book it", hint: "The price is the price, and they can book it themselves." },
      { value: "quoted", label: "They ask for a price", hint: "It depends on the job, so you quote it." },
    ],
  },
} as const;

/** Is this offer fully typed — i.e. can a surface act on it without asking? */
export function offerIsTyped(t: OfferType): boolean {
  return t.kind !== "unknown" && t.sale !== "unknown";
}

/** The sentence for an offer whose type we do not know. It ASKS; it never states a type.
 *  Returns null when nothing needs asking, so a caller cannot print an empty question. */
export function offerTypeAsk(t: OfferType): string | null {
  // ONE ASK AT A TIME — the standing rule, and the first version of this function broke it by
  // concatenating both questions into one line. When both halves are unknown, the KIND is asked
  // first and the other waits for his answer; two requests in one message read like two people
  // talking over each other, which is exactly what happened on 2026-08-26.
  if (t.kind === "unknown") return OFFER_TYPE_QUESTIONS.kind.ask;
  if (t.sale === "unknown") return OFFER_TYPE_QUESTIONS.sale.ask;
  return null;
}
