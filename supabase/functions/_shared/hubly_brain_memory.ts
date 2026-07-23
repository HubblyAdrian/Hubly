/**
 * Hubly Brain — Business Memory (Milestone 1 · Section 5)
 *
 * Permanent, versioned source of truth about every business.
 * Conversation history is only a small input — Memory is what Hubly remembers.
 *
 * Ownership:
 * - Experts may READ and SUGGEST updates.
 * - Hubly Brain alone COMMITS updates.
 * - No expert writes Business Memory directly.
 *
 * Memory Importance (Low / Medium / High / Critical) + confidence + source + lastVerified
 * lets Hubly know what to trust, confirm, or let fade.
 */

export const HUBLY_BUSINESS_MEMORY_VERSION = 2 as const;
export const BUSINESS_MEMORY_OWNER = "hubly_brain" as const;

export type MemoryImportance = "low" | "medium" | "high" | "critical";
export type MemorySource = "user" | "ai_inference" | "external_integration";

export type HublyMemoryFactMeta = {
  importance: MemoryImportance;
  confidence: number;
  source: MemorySource;
  lastVerified: string;
};

export type HublyMemoryChange = {
  id: string;
  at: string;
  path: string;
  previous: unknown;
  next: unknown;
  reason: string;
  expertId: string;
  importance: MemoryImportance;
  confidence: number;
  source: MemorySource;
  memoryVersion: number;
};

export type HublyMemorySuggestion = {
  path: string;
  value: unknown;
  reason: string;
  /** Suggesting expert — Brain still commits. */
  expertId: string;
  importance?: MemoryImportance;
  confidence?: number;
  source?: MemorySource;
};

export type HublyMemoryOwner = {
  name?: string | null;
  preferredName?: string | null;
  role?: string | null;
  preferredCommunicationStyle?: string | null;
};

export type HublyMemoryBusinessBlock = {
  name?: string | null;
  industry?: string | null;
  serviceArea?: string | HublyMemoryServiceArea | null;
  description?: string | null;
  yearsInBusiness?: number | string | null;
  businessGoals?: string[] | null;
  businessStage?: string | null;
};

export type HublyMemoryBrand = {
  personality?: string | null;
  tone?: string | null;
  positioning?: string | null;
  targetAudience?: string | null;
  visualDirection?: string | null;
  preferredCreativeDirection?: string | null;
};

export type HublyMemoryServicesBlock = {
  current?: string[] | null;
  removed?: string[] | null;
  planned?: string[] | null;
  recommended?: string[] | null;
};

export type HublyWebsiteVersion = {
  version: number;
  at: string;
  heroHeadline?: string | null;
  brandChanges?: string | null;
  packages?: string[] | null;
  bookingFlow?: string | null;
  reason?: string | null;
  expertId?: string | null;
};

export type HublyMemoryWebsiteHistory = {
  versions?: HublyWebsiteVersion[] | null;
  currentHeroHeadline?: string | null;
  currentPackages?: string[] | null;
  bookingFlow?: string | null;
  approvedAiChanges?: Array<{ at: string; change: string; reason: string; expertId: string }> | null;
  rejectedAiChanges?: Array<{ at: string; change: string; reason: string; expertId: string }> | null;
};

export type HublyStrategyVersion = {
  version: number;
  at: string;
  positioning?: string | null;
  homepageStrategy?: string | null;
  pricingStrategy?: string | null;
  bookingStrategy?: string | null;
  growthStrategy?: string | null;
  reason?: string | null;
  expertId?: string | null;
  confidence?: number | null;
};

export type HublyMemoryGoals = {
  business?: string[] | null;
  revenue?: string[] | null;
  growth?: string[] | null;
  personal?: string[] | null;
  futurePlans?: string[] | null;
};

export type HublyAiHistoryEntry = {
  id: string;
  at: string;
  recommendation: string;
  status: "recommended" | "approved" | "rejected" | "edited";
  reasoning: string;
  confidence: number;
  expertId: string;
  edits?: string | null;
};

export type HublyConnectedServices = {
  stripe?: boolean | string | null;
  googleCalendar?: boolean | string | null;
  googleBusinessProfile?: boolean | string | null;
  website?: boolean | string | null;
  marketplace?: boolean | string | null;
  crm?: boolean | string | null;
  integrations?: string[] | null;
};

export type HublyMemoryVersionSnapshot = {
  version: number;
  at: string;
  summary: string;
};

/**
 * Canonical Business Memory — single source of truth for Hubly Brain.
 * Legacy flat fields remain for older callers; Section 5 nested blocks are authoritative.
 */
export type HublyBusinessMemory = {
  /** Schema version */
  version: typeof HUBLY_BUSINESS_MEMORY_VERSION;
  /** Content version — increments on every Brain commit */
  memoryVersion: number;
  owner?: HublyMemoryOwner | null;
  business?: HublyMemoryBusinessBlock | null;
  brand?: HublyMemoryBrand | null;
  servicesBlock?: HublyMemoryServicesBlock | null;
  websiteHistory?: HublyMemoryWebsiteHistory | null;
  strategyHistory?: HublyStrategyVersion[] | null;
  goalsBlock?: HublyMemoryGoals | null;
  aiHistory?: HublyAiHistoryEntry[] | null;
  connectedServices?: HublyConnectedServices | null;
  changelog?: HublyMemoryChange[] | null;
  versionHistory?: HublyMemoryVersionSnapshot[] | null;
  /** Path → importance / confidence / source / lastVerified */
  factMeta?: Record<string, HublyMemoryFactMeta> | null;

  // ——— Legacy flat fields (kept in sync for Phase 7 callers) ———
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
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  workLove?: string | null;
  onboardingPriority?: string | null;
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

export type HublyBusinessMemoryInput = Partial<HublyBusinessMemory> & {
  business?: HublyMemoryBusinessBlock | Record<string, unknown> | null;
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

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object" || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function defaultImportance(path: string): MemoryImportance {
  if (/business\.name|owner\.name|name$/.test(path)) return "critical";
  if (/industry|positioning|targetAudience|businessStage|goals/.test(path)) return "high";
  if (/website|packages|hero|brand\.|strategy/.test(path)) return "medium";
  if (/holiday|promo|temporary|notes/.test(path)) return "low";
  return "medium";
}

function pickBusinessBag(input: HublyBusinessMemoryInput): Partial<HublyBusinessMemory> {
  const b = input.business && typeof input.business === "object" ? input.business as Record<string, unknown> : null;
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

function syncLegacyFromNested(m: HublyBusinessMemory): void {
  if (m.business?.name) m.name = m.business.name;
  if (m.business?.industry) m.industry = m.business.industry;
  if (m.business?.businessStage) m.businessStage = m.business.businessStage;
  if (m.owner?.name) m.ownerName = m.owner.name;
  if (typeof m.business?.serviceArea === "string" && m.business.serviceArea) {
    m.city = m.city || m.business.serviceArea;
  }
  if (m.brand?.tone || m.brand?.personality) {
    m.brandVoice = m.brand.tone || m.brand.personality;
  }
  if (m.goalsBlock?.business?.length) {
    m.goals = m.goalsBlock.business;
  }
  if (m.servicesBlock?.current?.length) {
    m.services = m.servicesBlock.current.map((name) => ({ name }));
  }
  if (m.websiteHistory?.currentHeroHeadline) {
    m.currentWebsite = {
      ...(m.currentWebsite || {}),
      headline: m.websiteHistory.currentHeroHeadline,
    };
  }
}

function ensureNestedFromLegacy(m: HublyBusinessMemory): void {
  m.owner = {
    name: m.owner?.name ?? m.ownerName ?? null,
    preferredName: m.owner?.preferredName ?? null,
    role: m.owner?.role ?? null,
    preferredCommunicationStyle: m.owner?.preferredCommunicationStyle ?? null,
  };
  const sa = m.business?.serviceArea ?? m.serviceArea ?? m.city ?? null;
  m.business = {
    name: m.business?.name ?? m.name ?? null,
    industry: m.business?.industry ?? m.industry ?? null,
    serviceArea: sa,
    description: m.business?.description ?? null,
    yearsInBusiness: m.business?.yearsInBusiness ?? null,
    businessGoals: m.business?.businessGoals ??
      (Array.isArray(m.goals) ? m.goals : m.goals ? [String(m.goals)] : null),
    businessStage: m.business?.businessStage ?? m.businessStage ?? null,
  };
  m.brand = {
    personality: m.brand?.personality ?? null,
    tone: m.brand?.tone ?? (typeof m.brandVoice === "string" ? m.brandVoice : null),
    positioning: m.brand?.positioning ?? null,
    targetAudience: m.brand?.targetAudience ?? null,
    visualDirection: m.brand?.visualDirection ?? null,
    preferredCreativeDirection: m.brand?.preferredCreativeDirection ?? null,
  };
  const currentServices = m.servicesBlock?.current ??
    m.services?.map((s) => s.name) ??
    null;
  m.servicesBlock = {
    current: currentServices,
    removed: m.servicesBlock?.removed ?? [],
    planned: m.servicesBlock?.planned ?? [],
    recommended: m.servicesBlock?.recommended ?? [],
  };
  m.websiteHistory = m.websiteHistory || {
    versions: [],
    currentHeroHeadline: m.currentWebsite?.headline ?? null,
    currentPackages: null,
    bookingFlow: null,
    approvedAiChanges: [],
    rejectedAiChanges: [],
  };
  m.strategyHistory = m.strategyHistory || [];
  m.goalsBlock = m.goalsBlock || {
    business: Array.isArray(m.goals) ? m.goals : m.goals ? [String(m.goals)] : [],
    revenue: [],
    growth: [],
    personal: [],
    futurePlans: [],
  };
  m.aiHistory = m.aiHistory || [];
  m.connectedServices = m.connectedServices || {
    stripe: null,
    googleCalendar: null,
    googleBusinessProfile: null,
    website: null,
    marketplace: null,
    crm: null,
    integrations: [],
  };
  m.changelog = m.changelog || [];
  m.versionHistory = m.versionHistory || [];
  m.factMeta = m.factMeta || {};
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
    memoryVersion: typeof raw.memoryVersion === "number" ? raw.memoryVersion : 0,
    owner: raw.owner && typeof raw.owner === "object" ? { ...raw.owner } : null,
    business: raw.business && typeof raw.business === "object" && !Array.isArray(raw.business)
      ? { ...(raw.business as HublyMemoryBusinessBlock) }
      : null,
    brand: raw.brand && typeof raw.brand === "object" ? { ...raw.brand } : null,
    servicesBlock: raw.servicesBlock && typeof raw.servicesBlock === "object"
      ? { ...raw.servicesBlock }
      : null,
    websiteHistory: raw.websiteHistory && typeof raw.websiteHistory === "object"
      ? deepClone(raw.websiteHistory)
      : null,
    strategyHistory: Array.isArray(raw.strategyHistory) ? deepClone(raw.strategyHistory) : null,
    goalsBlock: raw.goalsBlock && typeof raw.goalsBlock === "object" ? { ...raw.goalsBlock } : null,
    aiHistory: Array.isArray(raw.aiHistory) ? deepClone(raw.aiHistory) : null,
    connectedServices: raw.connectedServices && typeof raw.connectedServices === "object"
      ? { ...raw.connectedServices }
      : null,
    changelog: Array.isArray(raw.changelog) ? deepClone(raw.changelog) : null,
    versionHistory: Array.isArray(raw.versionHistory) ? deepClone(raw.versionHistory) : null,
    factMeta: raw.factMeta && typeof raw.factMeta === "object" ? { ...raw.factMeta } : null,
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

  if (memory.extras && !Object.keys(memory.extras).length) memory.extras = null;
  ensureNestedFromLegacy(memory);
  syncLegacyFromNested(memory);
  return memory;
}

/** Shallow+list merge — `patch` wins on defined fields. Does NOT create changelog (use commit). */
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
    if (Array.isArray(v) && v.length === 0 && key !== "changelog") continue;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) continue;
    (out as Record<string, unknown>)[key] = v;
  }
  out.updatedAt = new Date().toISOString();
  ensureNestedFromLegacy(out);
  syncLegacyFromNested(out);
  return out;
}

/** Experts suggest — never write. Brain commits. */
export function suggestMemoryUpdate(suggestion: HublyMemorySuggestion): HublyMemorySuggestion {
  if (!suggestion?.path) throw new Error("Memory suggestion requires path");
  if (!suggestion.expertId) throw new Error("Memory suggestion requires expertId");
  return {
    ...suggestion,
    importance: suggestion.importance || defaultImportance(suggestion.path),
    confidence: typeof suggestion.confidence === "number" ? suggestion.confidence : 80,
    source: suggestion.source || "ai_inference",
  };
}

export type CommitMemoryResult = {
  memory: HublyBusinessMemory;
  changes: HublyMemoryChange[];
  committedBy: typeof BUSINESS_MEMORY_OWNER;
};

/**
 * Hubly Brain commits suggested updates.
 * Versioned + changelog + factMeta. Experts must not call this.
 */
export function commitMemoryUpdates(
  base: HublyBusinessMemoryInput | null | undefined,
  suggestions: HublyMemorySuggestion[],
  opts?: { at?: string; summary?: string },
): CommitMemoryResult {
  const memory = normalizeBusinessMemory(base);
  const at = opts?.at || new Date().toISOString();
  const changes: HublyMemoryChange[] = [];
  const root = memory as unknown as Record<string, unknown>;

  for (const raw of suggestions) {
    const s = suggestMemoryUpdate(raw);
    const previous = getPath(memory, s.path);
    if (valuesEqual(previous, s.value)) continue;

    setPath(root, s.path, s.value);
    memory.memoryVersion = (memory.memoryVersion || 0) + 1;

    const change: HublyMemoryChange = {
      id: newId("memchg"),
      at,
      path: s.path,
      previous: previous === undefined ? null : deepClone(previous),
      next: deepClone(s.value),
      reason: s.reason,
      expertId: s.expertId,
      importance: s.importance || defaultImportance(s.path),
      confidence: s.confidence ?? 80,
      source: s.source || "ai_inference",
      memoryVersion: memory.memoryVersion,
    };
    changes.push(change);
    memory.changelog = [...(memory.changelog || []), change].slice(-500);
    memory.factMeta = {
      ...(memory.factMeta || {}),
      [s.path]: {
        importance: change.importance,
        confidence: change.confidence,
        source: change.source,
        lastVerified: at,
      },
    };
  }

  if (changes.length) {
    memory.versionHistory = [
      ...(memory.versionHistory || []),
      {
        version: memory.memoryVersion,
        at,
        summary: opts?.summary ||
          changes.map((c) => `${c.path}: ${c.reason}`).join("; ").slice(0, 400),
      },
    ].slice(-200);
  }

  memory.updatedAt = at;
  ensureNestedFromLegacy(memory);
  syncLegacyFromNested(memory);
  return { memory, changes, committedBy: BUSINESS_MEMORY_OWNER };
}

/** Extract owner-stated facts from a message — Brain turns these into commits. */
export function extractMemorySuggestionsFromRequest(
  request: string,
  _current?: HublyBusinessMemoryInput | null,
): HublyMemorySuggestion[] {
  const text = String(request || "").trim();
  const lower = text.toLowerCase();
  const out: HublyMemorySuggestion[] = [];
  const expertId = BUSINESS_MEMORY_OWNER;

  const startBiz = lower.match(
    /(?:i'?m\s+starting|starting|launching|building)\s+(?:a\s+|an\s+)?(.+?)(?:\s+business|\s+company)?[.!?]?\s*$/i,
  ) || lower.match(/starting\s+a\s+(.+?)\s+(?:business|company)/i);
  if (startBiz) {
    let industry = startBiz[1].replace(/\b(business|company)\b/gi, "").trim();
    if (/pressure\s*wash/i.test(text)) industry = "pressure washing";
    out.push(suggestMemoryUpdate({
      path: "business.industry",
      value: industry,
      reason: "Owner stated they are starting this kind of business",
      expertId,
      importance: "critical",
      confidence: 95,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "business.businessStage",
      value: "starting",
      reason: "Owner is starting a new business",
      expertId,
      importance: "high",
      confidence: 92,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "business.description",
      value: text,
      reason: "Owner described the business they are building",
      expertId,
      importance: "high",
      confidence: 90,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "brand.positioning",
      value: `Local ${industry} business building trust with clear packages and proof`,
      reason: "Initial positioning inferred from starting a new local service business",
      expertId,
      importance: "high",
      confidence: 70,
      source: "ai_inference",
    }));
    out.push(suggestMemoryUpdate({
      path: "brand.targetAudience",
      value: "local residential customers",
      reason: "Default audience for a new local service until owner narrows it",
      expertId,
      importance: "high",
      confidence: 65,
      source: "ai_inference",
    }));
  }

  if (/focus on commercial|commercial properties|commercial clients|b2b/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: "brand.targetAudience",
      value: "commercial properties",
      reason: "Owner asked to focus on commercial properties",
      expertId,
      importance: "high",
      confidence: 94,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "brand.positioning",
      value: "Commercial-first pressure washing for property managers and businesses",
      reason: "Positioning updated because owner shifted focus to commercial properties",
      expertId,
      importance: "high",
      confidence: 88,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "business.description",
      value: "Pressure washing business focused on commercial properties",
      reason: "Business description updated after commercial focus",
      expertId,
      importance: "high",
      confidence: 90,
      source: "user",
    }));
  }

  if (/stop offering|remove |no longer offer|don't offer|do not offer/i.test(text)) {
    const m = text.match(/(?:stop offering|remove|no longer offer|don't offer|do not offer)\s+(.+?)[.!]?$/i);
    const service = (m?.[1] || "that service").trim();
    out.push(suggestMemoryUpdate({
      path: "servicesBlock.removed",
      value: [service],
      reason: `Owner asked to stop offering ${service}`,
      expertId,
      importance: "high",
      confidence: 93,
      source: "user",
    }));
  }

  if (/recurring lawn|focus on recurring/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: "servicesBlock.planned",
      value: ["recurring lawn care"],
      reason: "Owner wants to focus on recurring lawn care",
      expertId,
      importance: "high",
      confidence: 92,
      source: "user",
    }));
  }

  if (/don'?t like luxury|no luxury|not luxury|hate luxury/i.test(text)) {
    out.push(suggestMemoryUpdate({
      path: "brand.preferredCreativeDirection",
      value: "practical and trustworthy — not luxury",
      reason: "Owner rejected luxury branding",
      expertId,
      importance: "high",
      confidence: 95,
      source: "user",
    }));
    out.push(suggestMemoryUpdate({
      path: "brand.tone",
      value: "practical and clear",
      reason: "Tone updated after owner rejected luxury branding",
      expertId,
      importance: "medium",
      confidence: 90,
      source: "user",
    }));
  }

  if (/apartment complex|target customers are/i.test(text)) {
    const m = text.match(/target customers are\s+(.+?)[.!]?$/i) ||
      text.match(/apartment complexes/i);
    const audience = m && m[1] ? m[1].trim() : "apartment complexes";
    out.push(suggestMemoryUpdate({
      path: "brand.targetAudience",
      value: /apartment/i.test(text) ? "apartment complexes" : audience,
      reason: "Owner stated target customers",
      expertId,
      importance: "high",
      confidence: 96,
      source: "user",
    }));
  }

  return out;
}

/** Append a versioned strategy recommendation (Brain commits). */
export function commitStrategyVersion(
  base: HublyBusinessMemoryInput | null | undefined,
  strategy: Omit<HublyStrategyVersion, "version" | "at"> & { at?: string },
): CommitMemoryResult {
  const memory = normalizeBusinessMemory(base);
  const at = strategy.at || new Date().toISOString();
  const version = (memory.strategyHistory?.length || 0) + 1;
  const entry: HublyStrategyVersion = {
    version,
    at,
    positioning: strategy.positioning ?? null,
    homepageStrategy: strategy.homepageStrategy ?? null,
    pricingStrategy: strategy.pricingStrategy ?? null,
    bookingStrategy: strategy.bookingStrategy ?? null,
    growthStrategy: strategy.growthStrategy ?? null,
    reason: strategy.reason ?? "Strategy recommendation",
    expertId: strategy.expertId || "strategy",
    confidence: strategy.confidence ?? 80,
  };
  return commitMemoryUpdates(memory, [
    suggestMemoryUpdate({
      path: "strategyHistory",
      value: [...(memory.strategyHistory || []), entry],
      reason: entry.reason || "New strategy version",
      expertId: entry.expertId || "strategy",
      importance: "high",
      confidence: entry.confidence || 80,
      source: "ai_inference",
    }),
    ...(entry.positioning
      ? [suggestMemoryUpdate({
        path: "brand.positioning",
        value: entry.positioning,
        reason: entry.reason || "Strategy positioning applied to brand",
        expertId: entry.expertId || "strategy",
        importance: "high",
        confidence: entry.confidence || 80,
        source: "ai_inference",
      })]
      : []),
  ], { at, summary: `Strategy v${version}` });
}

/** Record AI recommendation approval/rejection (Brain commits). */
export function commitAiHistoryEntry(
  base: HublyBusinessMemoryInput | null | undefined,
  entry: Omit<HublyAiHistoryEntry, "id" | "at"> & { at?: string },
): CommitMemoryResult {
  const memory = normalizeBusinessMemory(base);
  const at = entry.at || new Date().toISOString();
  const full: HublyAiHistoryEntry = {
    id: newId("aihist"),
    at,
    recommendation: entry.recommendation,
    status: entry.status,
    reasoning: entry.reasoning,
    confidence: entry.confidence,
    expertId: entry.expertId,
    edits: entry.edits ?? null,
  };
  const suggestions: HublyMemorySuggestion[] = [
    suggestMemoryUpdate({
      path: "aiHistory",
      value: [...(memory.aiHistory || []), full],
      reason: `AI ${entry.status}: ${entry.recommendation}`.slice(0, 200),
      expertId: entry.expertId,
      importance: "medium",
      confidence: entry.confidence,
      source: "ai_inference",
    }),
  ];

  if (entry.status === "approved") {
    suggestions.push(suggestMemoryUpdate({
      path: "websiteHistory.approvedAiChanges",
      value: [
        ...(memory.websiteHistory?.approvedAiChanges || []),
        { at, change: entry.recommendation, reason: entry.reasoning, expertId: entry.expertId },
      ],
      reason: "Owner/Brain approved AI change",
      expertId: entry.expertId,
      importance: "high",
      confidence: entry.confidence,
      source: "user",
    }));
  }
  if (entry.status === "rejected") {
    suggestions.push(suggestMemoryUpdate({
      path: "websiteHistory.rejectedAiChanges",
      value: [
        ...(memory.websiteHistory?.rejectedAiChanges || []),
        { at, change: entry.recommendation, reason: entry.reasoning, expertId: entry.expertId },
      ],
      reason: "Owner/Brain rejected AI change",
      expertId: entry.expertId,
      importance: "high",
      confidence: entry.confidence,
      source: "user",
    }));
  }

  return commitMemoryUpdates(memory, suggestions, { at, summary: `AI history ${entry.status}` });
}

export function isMemoryRetrievalQuestion(request: string): boolean {
  const r = String(request || "").toLowerCase();
  return /what kind of business|what business are we building|what changed|why did we (change|remove)|branding direction|what (services|goals)|working toward|approved branding|our positioning|why.*positioning/.test(r);
}

export type HublyMemoryQueryResult = {
  answer: string;
  fromMemory: true;
  usedChatHistory: false;
  paths: string[];
  changes?: HublyMemoryChange[];
  confidence: number;
};

/** Answer from Business Memory — never by searching chat logs. */
export function queryBusinessMemory(
  memoryInput: HublyBusinessMemoryInput | null | undefined,
  question: string,
): HublyMemoryQueryResult {
  const m = normalizeBusinessMemory(memoryInput);
  const q = String(question || "").toLowerCase();

  if (/what kind of business|what business are we building|who are we building/.test(q)) {
    const industry = m.business?.industry || m.industry || "your business";
    const audience = m.brand?.targetAudience || "customers you have not fully defined yet";
    const positioning = m.brand?.positioning || "still taking shape";
    const stage = m.business?.businessStage || m.businessStage || "early";
    return {
      answer:
        `We're building a ${industry} business (${stage}). ` +
        `Target audience: ${audience}. Positioning: ${positioning}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ["business.industry", "brand.targetAudience", "brand.positioning", "business.businessStage"],
      confidence: 90,
    };
  }

  if (/why did we change (our )?positioning|why.*positioning/.test(q)) {
    const posChanges = (m.changelog || [])
      .filter((c) => c.path === "brand.positioning" || c.path.includes("positioning"))
      .slice(-5);
    const latest = posChanges[posChanges.length - 1];
    if (!latest) {
      return {
        answer: "I don't have a stored positioning change yet in Business Memory.",
        fromMemory: true,
        usedChatHistory: false,
        paths: ["changelog"],
        confidence: 40,
      };
    }
    return {
      answer:
        `We changed positioning because: ${latest.reason}. ` +
        `Previous: ${JSON.stringify(latest.previous)}. Now: ${JSON.stringify(latest.next)}. ` +
        `(Recorded ${latest.at}, suggested by ${latest.expertId}, committed by Hubly Brain.)`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ["brand.positioning", "changelog"],
      changes: posChanges,
      confidence: 92,
    };
  }

  if (/what changed (this week|last month|recently)|show me what changed|memory updates/.test(q)) {
    const now = Date.now();
    const windowMs = /last month/.test(q) ? 32 * 86400000 : 8 * 86400000;
    const recent = (m.changelog || []).filter((c) => {
      const t = Date.parse(c.at);
      return Number.isFinite(t) && now - t <= windowMs;
    });
    if (!recent.length) {
      return {
        answer: "No Business Memory updates in that window yet.",
        fromMemory: true,
        usedChatHistory: false,
        paths: ["changelog"],
        confidence: 70,
      };
    }
    const lines = recent.slice(-12).map((c) =>
      `• ${c.path}: ${c.reason} (${c.at.slice(0, 10)}, ${c.expertId}, ${c.importance})`
    );
    return {
      answer: `Here's what changed in Business Memory:\n${lines.join("\n")}`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ["changelog"],
      changes: recent,
      confidence: 93,
    };
  }

  if (/branding direction|approved/.test(q)) {
    const approved = m.websiteHistory?.approvedAiChanges || [];
    const brand = m.brand;
    return {
      answer:
        `Approved branding direction: tone=${brand?.tone || "n/a"}, ` +
        `creative=${brand?.preferredCreativeDirection || "n/a"}, ` +
        `positioning=${brand?.positioning || "n/a"}. ` +
        `Approved AI changes: ${approved.length ? approved.map((a) => a.change).join("; ") : "none yet"}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ["brand", "websiteHistory.approvedAiChanges"],
      confidence: 88,
    };
  }

  if (/why did we remove|removed that package|services have we/.test(q)) {
    const removed = m.servicesBlock?.removed || [];
    const current = m.servicesBlock?.current || [];
    const remChanges = (m.changelog || []).filter((c) => c.path.includes("services"));
    return {
      answer:
        `Current services: ${current.join(", ") || "none listed"}. ` +
        `Removed: ${removed.join(", ") || "none"}. ` +
        (remChanges.length
          ? `Latest service change reason: ${remChanges[remChanges.length - 1].reason}`
          : "No service-change reasoning stored yet."),
      fromMemory: true,
      usedChatHistory: false,
      paths: ["servicesBlock", "changelog"],
      changes: remChanges.slice(-5),
      confidence: 85,
    };
  }

  if (/goals|working toward/.test(q)) {
    const g = m.goalsBlock;
    return {
      answer:
        `Business goals: ${(g?.business || []).join("; ") || "not set"}. ` +
        `Revenue: ${(g?.revenue || []).join("; ") || "not set"}. ` +
        `Growth: ${(g?.growth || []).join("; ") || "not set"}. ` +
        `Personal: ${(g?.personal || []).join("; ") || "not set"}. ` +
        `Future plans: ${(g?.futurePlans || []).join("; ") || "not set"}.`,
      fromMemory: true,
      usedChatHistory: false,
      paths: ["goalsBlock"],
      confidence: 87,
    };
  }

  return {
    answer: "I checked Business Memory but need a more specific question about the business, brand, services, goals, or recent changes.",
    fromMemory: true,
    usedChatHistory: false,
    paths: [],
    confidence: 50,
  };
}

export function businessMemoryKeys(memory?: HublyBusinessMemoryInput | null): string[] {
  const m = normalizeBusinessMemory(memory);
  return (Object.keys(m) as (keyof HublyBusinessMemory)[]).filter((k) => {
    if (k === "version" || k === "updatedAt" || k === "memoryVersion") return false;
    const v = m[k];
    if (v == null || v === "") return false;
    if (Array.isArray(v) && !v.length) return false;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) return false;
    return true;
  });
}

export function formatBusinessMemory(memory?: HublyBusinessMemoryInput | null): string {
  const m = normalizeBusinessMemory(memory);
  const keys = businessMemoryKeys(m);
  if (!keys.length) return "";

  const summaryLines: string[] = [];
  if (m.business?.name || m.name) summaryLines.push(`Business: ${m.business?.name || m.name}`);
  if (m.business?.industry || m.industry) {
    summaryLines.push(`Industry: ${m.business?.industry || m.industry}`);
  }
  if (m.owner?.name || m.ownerName) summaryLines.push(`Owner: ${m.owner?.name || m.ownerName}`);
  if (m.brand?.targetAudience) summaryLines.push(`Audience: ${m.brand.targetAudience}`);
  if (m.brand?.positioning) summaryLines.push(`Positioning: ${m.brand.positioning}`);
  if (m.business?.businessStage || m.businessStage) {
    summaryLines.push(`Stage: ${m.business?.businessStage || m.businessStage}`);
  }
  if (m.servicesBlock?.current?.length) {
    summaryLines.push(`Services: ${m.servicesBlock.current.slice(0, 12).join(", ")}`);
  }

  return [
    "HUBLY BUSINESS MEMORY (single source of truth — use before answering; do not invent missing facts):",
    summaryLines.length ? summaryLines.join("\n") : "(partial memory)",
    `memoryVersion: ${m.memoryVersion}`,
    "",
    "STRUCTURED MEMORY JSON:",
    JSON.stringify(m, null, 2),
  ].join("\n");
}

/** In-process persistence for Brain sessions / Section 5 proofs. */
const MEMORY_STORE = new Map<string, HublyBusinessMemory>();

export function persistBusinessMemoryLocal(
  businessId: string,
  memory: HublyBusinessMemoryInput,
): HublyBusinessMemory {
  const normalized = normalizeBusinessMemory(memory);
  MEMORY_STORE.set(String(businessId), deepClone(normalized));
  return deepClone(normalized);
}

export function loadBusinessMemoryLocal(businessId: string): HublyBusinessMemory | null {
  const m = MEMORY_STORE.get(String(businessId));
  return m ? deepClone(m) : null;
}

export function clearBusinessMemoryStoreForTests(): void {
  MEMORY_STORE.clear();
}

export const HublyBusinessMemoryApi = {
  version: HUBLY_BUSINESS_MEMORY_VERSION,
  owner: BUSINESS_MEMORY_OWNER,
  normalize: normalizeBusinessMemory,
  merge: mergeBusinessMemory,
  keys: businessMemoryKeys,
  format: formatBusinessMemory,
  suggest: suggestMemoryUpdate,
  commit: commitMemoryUpdates,
  extractFromRequest: extractMemorySuggestionsFromRequest,
  commitStrategy: commitStrategyVersion,
  commitAiHistory: commitAiHistoryEntry,
  query: queryBusinessMemory,
  isRetrievalQuestion: isMemoryRetrievalQuestion,
  persistLocal: persistBusinessMemoryLocal,
  loadLocal: loadBusinessMemoryLocal,
  clearStoreForTests: clearBusinessMemoryStoreForTests,
  empty(): HublyBusinessMemory {
    return normalizeBusinessMemory({});
  },
};

export default HublyBusinessMemoryApi;
