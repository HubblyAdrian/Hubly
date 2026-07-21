/**
 * Hubly Brain — Phase 7.1 Business Memory
 *
 * Permanent structured memory for a service business.
 * Every Brain request should receive this automatically — features must not
 * rebuild prompts by hand.
 *
 * Pipeline:
 *   Conversation → Business Understanding → Business Memory → Planner
 *   → Capability Registry → Executors → CRM / Website / Quotes / …
 *
 * The AI never manipulates the database directly.
 * The Planner decides; Executors invoke capabilities.
 */

export const HUBLY_BUSINESS_MEMORY_VERSION = 1 as const;

/**
 * Canonical Business Memory — single source of truth for Hubly Brain.
 * All fields optional; partial memory is valid during onboarding.
 */
export type HublyBusinessMemory = {
  version: typeof HUBLY_BUSINESS_MEMORY_VERSION;
  /** Business display name */
  name?: string | null;
  industry?: string | null;
  specialty?: string | null;
  specialties?: string[] | null;
  services?: HublyMemoryService[] | null;
  pricing?: HublyMemoryPricing | null;
  serviceArea?: HublyMemoryServiceArea | null;
  employees?: HublyMemoryEmployee[] | null;
  brandVoice?: string | Record<string, unknown> | null;
  goals?: string | string[] | null;
  currentWebsite?: HublyMemoryWebsite | null;
  currentCrm?: HublyMemoryCrm | null;
  connectedAccounts?: string[] | Record<string, boolean | string> | null;
  businessStage?: string | null;
  marketingPreferences?: string | Record<string, unknown> | null;
  seasonality?: string | Record<string, unknown> | null;
  notes?: string | null;
  previousConversations?: HublyMemoryTurn[] | null;
  /** Identity / contact */
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  workLove?: string | null;
  onboardingPriority?: string | null;
  /** Free-form extras without breaking the schema */
  extras?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

export type HublyMemoryService = {
  name: string;
  price?: string | number | null;
  dur?: string | number | null;
  desc?: string | null;
  category?: string | null;
  popular?: boolean | null;
};

export type HublyMemoryPricing = {
  visibility?: string | null;
  paymentSetting?: string | null;
  depositType?: string | null;
  depositVal?: string | number | null;
  currency?: string | null;
  notes?: string | null;
};

export type HublyMemoryServiceArea = {
  cities?: string[] | null;
  states?: string[] | null;
  radiusMiles?: number | null;
  travelsToCustomers?: boolean | null;
};

export type HublyMemoryEmployee = {
  name?: string | null;
  role?: string | null;
};

export type HublyMemoryWebsite = {
  published?: boolean | null;
  slug?: string | null;
  layoutId?: string | null;
  headline?: string | null;
  heroSub?: string | null;
  accentColor?: string | null;
  ctaText?: string | null;
};

export type HublyMemoryCrm = {
  customerCount?: number | null;
  pipeline?: string | null;
  notes?: string | null;
};

export type HublyMemoryTurn = {
  role: "user" | "assistant" | "owner" | "hubly" | string;
  content: string;
  at?: string | null;
};

/** Loose input accepted from clients / legacy shapes — normalized by `normalizeBusinessMemory`. */
export type HublyBusinessMemoryInput = Partial<HublyBusinessMemory> & {
  business?: Record<string, unknown> | null;
  website?: HublyMemoryWebsite | Record<string, unknown> | null;
  crm?: HublyMemoryCrm | Record<string, unknown> | null;
  calendar?: Record<string, unknown> | null;
  customers?: unknown[] | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function asStringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => asString(x)).filter(Boolean) as string[];
  return out.length ? out : null;
}

function asServices(v: unknown): HublyMemoryService[] | null {
  if (!Array.isArray(v)) return null;
  const out: HublyMemoryService[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const name = asString(item);
      if (name) out.push({ name });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = asString(o.name);
    if (!name) continue;
    out.push({
      name,
      price: o.price != null && o.price !== "" ? (o.price as string | number) : null,
      dur: o.dur != null && o.dur !== "" ? (o.dur as string | number) : null,
      desc: asString(o.desc),
      category: asString(o.category),
      popular: typeof o.popular === "boolean" ? o.popular : null,
    });
  }
  return out.length ? out : null;
}

function asEmployees(v: unknown): HublyMemoryEmployee[] | null {
  if (!Array.isArray(v)) return null;
  const out: HublyMemoryEmployee[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const name = asString(item);
      if (name) out.push({ name });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({ name: asString(o.name), role: asString(o.role) });
  }
  return out.length ? out : null;
}

function asTurns(v: unknown): HublyMemoryTurn[] | null {
  if (!Array.isArray(v)) return null;
  const out: HublyMemoryTurn[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const content = asString(o.content) || asString(o.text);
    if (!content) continue;
    out.push({
      role: asString(o.role) || asString(o.side) || "user",
      content: content.slice(0, 2000),
      at: asString(o.at) || asString(o.created_at),
    });
  }
  return out.length ? out.slice(-40) : null;
}

function pickBusinessBag(input: HublyBusinessMemoryInput): Partial<HublyBusinessMemory> {
  const b = input.business && typeof input.business === "object" ? input.business : null;
  if (!b) return {};
  return {
    name: asString(b.name) || asString(b.businessName),
    industry: asString(b.industry) || asString(b.businessType),
    ownerName: asString(b.ownerName),
    phone: asString(b.phone),
    email: asString(b.email),
    city: asString(b.city),
    businessStage: asString(b.businessStage) || asString(b.stage),
    brandVoice: (b.brandVoice as HublyBusinessMemory["brandVoice"]) ?? null,
    goals: (b.goals as HublyBusinessMemory["goals"]) ?? null,
  };
}

/** Normalize any partial / legacy payload into canonical Business Memory. */
export function normalizeBusinessMemory(
  input?: HublyBusinessMemoryInput | null,
): HublyBusinessMemory {
  const raw = input && typeof input === "object" ? input : {};
  const fromBusiness = pickBusinessBag(raw);
  const website = (raw.currentWebsite || raw.website || null) as HublyMemoryWebsite | null;
  const crm = (raw.currentCrm || raw.crm || null) as HublyMemoryCrm | null;

  const memory: HublyBusinessMemory = {
    version: HUBLY_BUSINESS_MEMORY_VERSION,
    name: asString(raw.name) || fromBusiness.name,
    industry: asString(raw.industry) || fromBusiness.industry,
    specialty: asString(raw.specialty),
    specialties: asStringList(raw.specialties),
    services: asServices(raw.services),
    pricing: raw.pricing && typeof raw.pricing === "object" ? { ...raw.pricing } : null,
    serviceArea: raw.serviceArea && typeof raw.serviceArea === "object"
      ? {
        cities: asStringList(raw.serviceArea.cities),
        states: asStringList(raw.serviceArea.states),
        radiusMiles: typeof raw.serviceArea.radiusMiles === "number"
          ? raw.serviceArea.radiusMiles
          : null,
        travelsToCustomers: typeof raw.serviceArea.travelsToCustomers === "boolean"
          ? raw.serviceArea.travelsToCustomers
          : null,
      }
      : null,
    employees: asEmployees(raw.employees),
    brandVoice: raw.brandVoice ?? fromBusiness.brandVoice ?? null,
    goals: raw.goals ?? fromBusiness.goals ?? null,
    currentWebsite: website && typeof website === "object" ? { ...website } : null,
    currentCrm: crm && typeof crm === "object" ? { ...crm } : null,
    connectedAccounts: raw.connectedAccounts ?? null,
    businessStage: asString(raw.businessStage) || fromBusiness.businessStage,
    marketingPreferences: raw.marketingPreferences ?? null,
    seasonality: raw.seasonality ?? null,
    notes: asString(raw.notes),
    previousConversations: asTurns(raw.previousConversations),
    ownerName: asString(raw.ownerName) || fromBusiness.ownerName,
    phone: asString(raw.phone) || fromBusiness.phone,
    email: asString(raw.email) || fromBusiness.email,
    city: asString(raw.city) || fromBusiness.city,
    workLove: asString(raw.workLove),
    onboardingPriority: asString(raw.onboardingPriority),
    extras: {
      ...(raw.extras && typeof raw.extras === "object" ? raw.extras : {}),
      ...(raw.calendar ? { calendar: raw.calendar } : {}),
      ...(raw.customers ? { customers: raw.customers } : {}),
    },
    updatedAt: asString(raw.updatedAt) || new Date().toISOString(),
  };

  // Drop empty extras
  if (memory.extras && !Object.keys(memory.extras).length) memory.extras = null;
  return memory;
}

/** Shallow+list merge — `patch` wins on defined fields. */
export function mergeBusinessMemory(
  base?: HublyBusinessMemoryInput | null,
  patch?: HublyBusinessMemoryInput | null,
): HublyBusinessMemory {
  const a = normalizeBusinessMemory(base);
  const b = normalizeBusinessMemory(patch);
  const out: HublyBusinessMemory = { ...a, version: HUBLY_BUSINESS_MEMORY_VERSION };
  for (const key of Object.keys(b) as (keyof HublyBusinessMemory)[]) {
    if (key === "version") continue;
    const v = b[key];
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) continue;
    (out as Record<string, unknown>)[key] = v;
  }
  out.updatedAt = new Date().toISOString();
  return out;
}

/** Keys that currently hold useful context (for logs / status). */
export function businessMemoryKeys(memory?: HublyBusinessMemoryInput | null): string[] {
  const m = normalizeBusinessMemory(memory);
  return (Object.keys(m) as (keyof HublyBusinessMemory)[]).filter((k) => {
    if (k === "version" || k === "updatedAt") return false;
    const v = m[k];
    if (v == null || v === "") return false;
    if (Array.isArray(v) && !v.length) return false;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) return false;
    return true;
  });
}

/**
 * Format Business Memory for system injection.
 * Every Brain call should include this so skills share one truth.
 */
export function formatBusinessMemory(memory?: HublyBusinessMemoryInput | null): string {
  const m = normalizeBusinessMemory(memory);
  const keys = businessMemoryKeys(m);
  if (!keys.length) return "";

  const summaryLines: string[] = [];
  if (m.name) summaryLines.push(`Business: ${m.name}`);
  if (m.industry) summaryLines.push(`Industry: ${m.industry}`);
  if (m.ownerName) summaryLines.push(`Owner: ${m.ownerName}`);
  if (m.businessStage) summaryLines.push(`Stage: ${m.businessStage}`);
  if (m.onboardingPriority) summaryLines.push(`Priority: ${m.onboardingPriority}`);
  if (m.serviceArea?.cities?.length) {
    summaryLines.push(`Service area: ${m.serviceArea.cities.join(", ")}`);
  }
  if (m.services?.length) {
    summaryLines.push(
      `Services: ${m.services.slice(0, 12).map((s) => s.name).join(", ")}`,
    );
  }

  return [
    "HUBLY BUSINESS MEMORY (single source of truth — use before answering; do not invent missing facts):",
    summaryLines.length ? summaryLines.join("\n") : "(partial memory)",
    "",
    "STRUCTURED MEMORY JSON:",
    JSON.stringify(m, null, 2),
  ].join("\n");
}

export const HublyBusinessMemoryApi = {
  version: HUBLY_BUSINESS_MEMORY_VERSION,
  normalize: normalizeBusinessMemory,
  merge: mergeBusinessMemory,
  keys: businessMemoryKeys,
  format: formatBusinessMemory,
  empty(): HublyBusinessMemory {
    return normalizeBusinessMemory({});
  },
};

export default HublyBusinessMemoryApi;
