/**
 * Service Engine — canonical service catalog for every Hubly experience.
 *
 * One Business → one catalog → Marketplace / Website / Booking / AI / Lite / Pro.
 * Do not read editorSvcs / relational services directly from new consumers.
 *
 * See docs/SERVICE_ENGINE.md
 */

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
  payment?: ServicePaymentOverride;
  recommend_tag?: string | null;
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

function emptyCatalog(): ServiceCatalog {
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
    payment = {
      rule: ruleMap[ps] || "pay_after_service",
      deposit_type: String(raw.depositType || "pct") === "flat" ? "flat" : "pct",
      deposit_val: Number(raw.depositVal ?? 25) || 25,
    };
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
  const meta = (business.meta || {}) as Record<string, unknown>;
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
    quote_required: mode === "quote_required",
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
    price_cents: service.pricing.mode === "quote_required"
      ? null
      : service.pricing.price_cents,
    duration_minutes: service.duration_minutes,
    quote_required: service.pricing.mode === "quote_required",
    addon_names: addons.map((a) => a.name),
  };
}

/** Compact list for AI — only real catalog entries. Never invent. */
export function toAiSummary(business: Record<string, unknown>): {
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
  const services = listServices(business, { channel: "marketplace" }).map((s) => {
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
 * Build canonical catalog + legacy dual-write mirrors for persistence.
 * Callers write the returned meta patch onto businesses.meta.
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
  };
  meta.service_catalog = stamped;

  // Dual-write legacy editorSvcs for Hubly Pro / website until cutover
  meta.editorSvcs = stamped.services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    desc: s.description,
    price: s.pricing.price_cents != null ? s.pricing.price_cents / 100 : null,
    dur: String(Math.round((s.duration_minutes / 60) * 100) / 100),
    durationMinutes: s.duration_minutes,
    duration_minutes: s.duration_minutes,
    includes: s.includes.join("\n"),
    includesList: s.includes,
    photos: s.media.photos,
    imgUrl: s.media.photos[0] || null,
    popular: s.flags.popular,
    showPrice: s.pricing.show_price,
    pricingType: s.pricing.mode === "variable"
      ? "variable"
      : (s.pricing.mode === "quote_required" ? "quote_required" : "flat"),
    pricing_mode: s.pricing.mode,
    status: s.status,
    category: s.category,
    subcategory: s.subcategory,
    instantBook: s.flags.instant_book_eligible,
    addon_ids: s.addon_ids,
    addOns: hydrateAddons(stamped, s.addon_ids).map((a) => ({
      id: a.id,
      name: a.name,
      price: a.price_cents != null ? a.price_cents / 100 : null,
    })),
    media: s.media,
    recommendTag: s.recommend_tag,
  }));

  meta.editorAddons = stamped.addons.map((a) => ({
    id: a.id,
    name: a.name,
    desc: a.description,
    description: a.description,
    price: a.price_cents != null ? a.price_cents / 100 : null,
    active: a.active,
  }));

  // Lossy mirror kept for old readers
  meta.services = (meta.editorSvcs as Array<Record<string, unknown>>).map((s) => ({
    name: s.name,
    price: s.price,
    dur: s.dur,
    desc: s.desc,
    imgUrl: s.imgUrl,
    photos: s.photos,
    popular: s.popular,
    showPrice: s.showPrice,
    pricingType: s.pricingType,
    includes: s.includes,
    includesList: s.includesList,
  }));

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
    return migrateLegacyService(s, i, addonIdByName);
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
