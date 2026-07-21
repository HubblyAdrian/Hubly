/**
 * Hubly Brain — Business DNA (Phase 7.6)
 *
 * PERMANENT RULE:
 *   Business Memory is factual.     → "What is true?"
 *   Business DNA is interpretive.   → "What kind of business is this?"
 *   Never combine them.
 *
 * Memory: name, city, services, prices, hours (facts).
 * DNA: personality, ideal customer, sales style, growth goals, tone (identity).
 *
 * Every planner decision reads DNA.
 * Every capability receives DNA.
 * DNA evolves over time (conversation + weekly learning).
 *
 * Website Builder / Marketing / Coach / Marketplace / Quotes / CRM must share DNA
 * so output stays consistent — no feature invents its own personality prompts.
 */

import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";

export const HUBLY_BUSINESS_DNA_VERSION = 1 as const;

export type HublyBusinessGoal = {
  id: string;
  label: string;
  /** increase_revenue | hire | expand | premium | bookings | repeat | custom */
  kind: string;
  priority?: number | null;
  status?: "active" | "achieved" | "paused" | null;
  notes?: string | null;
};

export type HublyBusinessDNA = {
  version: typeof HUBLY_BUSINESS_DNA_VERSION;
  identity: {
    mission?: string | null;
    longTermVision?: string | null;
    competitiveAdvantage?: string | null;
    preferredJobs?: string[] | null;
    avoid?: string[] | null;
  };
  brand: {
    personality?: string[] | null;
    preferredTone?: string | null;
    salesStyle?: string | null;
    voiceTraits?: string[] | null;
  };
  services: {
    focus?: string[] | null;
    idealJobs?: string[] | null;
    avoidJobs?: string[] | null;
  };
  pricing: {
    strategy?: string | null;
    tier?: "budget" | "mid" | "premium" | "luxury" | string | null;
    notes?: string | null;
  };
  customerProfile: {
    idealCustomer?: string | null;
    incomeSignal?: string | null;
    avoidCustomers?: string[] | null;
    traits?: string[] | null;
  };
  goals: HublyBusinessGoal[];
  personality: {
    traits?: string[] | null;
    preferredTone?: string | null;
  };
  operations: {
    seasonality?: string | null;
    equipment?: string[] | null;
    travelNotes?: string | null;
    operatingStyle?: string | null;
  };
  marketing: {
    style?: string | null;
    channels?: string[] | null;
    themes?: string[] | null;
  };
  growthStage?: string | null;
  /** Provenance — never store raw conversation here */
  source?: "understanding" | "client" | "weekly_learning" | "system" | null;
  updatedAt?: string | null;
};

/** Loose input — normalized; never a Memory object. */
export type HublyBusinessDNAInput = Partial<HublyBusinessDNA> & {
  goals?: Array<Partial<HublyBusinessGoal> | string> | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function asStringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) {
    if (typeof v === "string" && v.trim()) {
      return v.split(/[,;/|]/).map((x) => x.trim()).filter(Boolean);
    }
    return null;
  }
  const out = v.map((x) => asString(x)).filter(Boolean) as string[];
  return out.length ? [...new Set(out)] : null;
}

function asGoals(v: unknown): HublyBusinessGoal[] {
  if (!Array.isArray(v)) return [];
  const out: HublyBusinessGoal[] = [];
  v.forEach((item, i) => {
    if (typeof item === "string") {
      const label = asString(item);
      if (!label) return;
      out.push({
        id: `goal_${i}_${label.toLowerCase().replace(/\W+/g, "_").slice(0, 40)}`,
        label,
        kind: inferGoalKind(label),
        priority: i + 1,
        status: "active",
      });
      return;
    }
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const label = asString(o.label) || asString(o.name);
    if (!label) return;
    out.push({
      id: asString(o.id) || `goal_${i}_${label.toLowerCase().replace(/\W+/g, "_").slice(0, 40)}`,
      label,
      kind: asString(o.kind) || inferGoalKind(label),
      priority: typeof o.priority === "number" ? o.priority : i + 1,
      status: (asString(o.status) as HublyBusinessGoal["status"]) || "active",
      notes: asString(o.notes),
    });
  });
  return out;
}

function inferGoalKind(label: string): string {
  const low = label.toLowerCase();
  if (/revenue|sales|profit|money/.test(low)) return "increase_revenue";
  if (/hire|employee|team|staff/.test(low)) return "hire";
  if (/second location|expand|fleet|new market/.test(low)) return "expand";
  if (/premium|luxury|upscale/.test(low)) return "premium";
  if (/book|ceramic|coating|customer/.test(low) && /more|increase|book/.test(low)) {
    return "bookings";
  }
  if (/repeat|retention|loyalty/.test(low)) return "repeat";
  return "custom";
}

function emptySection<T extends Record<string, unknown>>(base: T): T {
  return { ...base };
}

/** Normalize any partial DNA. Never accepts/merges Memory fields into DNA. */
export function normalizeBusinessDNA(input?: HublyBusinessDNAInput | null): HublyBusinessDNA {
  const raw = input && typeof input === "object" ? input : {};
  // Guard: if someone accidentally passed Memory-shaped data, strip factual keys.
  const stripped = { ...raw } as Record<string, unknown>;
  for (const k of [
    "name", "industry", "phone", "email", "city", "services", "currentWebsite",
    "currentCrm", "previousConversations", "ownerName",
  ]) {
    // `services` in DNA is interpretive focus — keep if object with focus/idealJobs
    if (k === "services") {
      const s = stripped.services;
      if (Array.isArray(s)) delete stripped.services; // Memory services[] is factual
      continue;
    }
    if (k in stripped && k !== "services") {
      // Only delete if it looks like Memory pollution at top level for known fact keys
      if (["name", "industry", "phone", "email", "city", "currentWebsite", "currentCrm", "previousConversations", "ownerName"].includes(k)) {
        delete stripped[k];
      }
    }
  }

  const identityIn = (stripped.identity && typeof stripped.identity === "object")
    ? stripped.identity as Record<string, unknown>
    : {};
  const brandIn = (stripped.brand && typeof stripped.brand === "object")
    ? stripped.brand as Record<string, unknown>
    : {};
  const servicesIn = (stripped.services && typeof stripped.services === "object" && !Array.isArray(stripped.services))
    ? stripped.services as Record<string, unknown>
    : {};
  const pricingIn = (stripped.pricing && typeof stripped.pricing === "object")
    ? stripped.pricing as Record<string, unknown>
    : {};
  const customerIn = (stripped.customerProfile && typeof stripped.customerProfile === "object")
    ? stripped.customerProfile as Record<string, unknown>
    : {};
  const personalityIn = (stripped.personality && typeof stripped.personality === "object")
    ? stripped.personality as Record<string, unknown>
    : {};
  const opsIn = (stripped.operations && typeof stripped.operations === "object")
    ? stripped.operations as Record<string, unknown>
    : {};
  const mktIn = (stripped.marketing && typeof stripped.marketing === "object")
    ? stripped.marketing as Record<string, unknown>
    : {};

  return {
    version: HUBLY_BUSINESS_DNA_VERSION,
    identity: emptySection({
      mission: asString(identityIn.mission),
      longTermVision: asString(identityIn.longTermVision) || asString(identityIn.vision),
      competitiveAdvantage: asString(identityIn.competitiveAdvantage),
      preferredJobs: asStringList(identityIn.preferredJobs),
      avoid: asStringList(identityIn.avoid),
    }),
    brand: emptySection({
      personality: asStringList(brandIn.personality),
      preferredTone: asString(brandIn.preferredTone) || asString(brandIn.tone),
      salesStyle: asString(brandIn.salesStyle),
      voiceTraits: asStringList(brandIn.voiceTraits),
    }),
    services: emptySection({
      focus: asStringList(servicesIn.focus),
      idealJobs: asStringList(servicesIn.idealJobs),
      avoidJobs: asStringList(servicesIn.avoidJobs),
    }),
    pricing: emptySection({
      strategy: asString(pricingIn.strategy),
      tier: asString(pricingIn.tier),
      notes: asString(pricingIn.notes),
    }),
    customerProfile: emptySection({
      idealCustomer: asString(customerIn.idealCustomer),
      incomeSignal: asString(customerIn.incomeSignal),
      avoidCustomers: asStringList(customerIn.avoidCustomers),
      traits: asStringList(customerIn.traits),
    }),
    goals: asGoals(stripped.goals),
    personality: emptySection({
      traits: asStringList(personalityIn.traits) || asStringList(brandIn.personality),
      preferredTone: asString(personalityIn.preferredTone) || asString(brandIn.preferredTone),
    }),
    operations: emptySection({
      seasonality: asString(opsIn.seasonality),
      equipment: asStringList(opsIn.equipment),
      travelNotes: asString(opsIn.travelNotes),
      operatingStyle: asString(opsIn.operatingStyle),
    }),
    marketing: emptySection({
      style: asString(mktIn.style),
      channels: asStringList(mktIn.channels),
      themes: asStringList(mktIn.themes),
    }),
    growthStage: asString(stripped.growthStage),
    source: (asString(stripped.source) as HublyBusinessDNA["source"]) || null,
    updatedAt: asString(stripped.updatedAt) || new Date().toISOString(),
  };
}

/** Deep-ish merge — patch wins on defined interpretive fields. Never merges Memory. */
export function evolveBusinessDNA(
  base?: HublyBusinessDNAInput | null,
  patch?: HublyBusinessDNAInput | null,
): HublyBusinessDNA {
  const a = normalizeBusinessDNA(base);
  const b = normalizeBusinessDNA(patch);
  const mergeObj = <T extends Record<string, unknown>>(x: T, y: T): T => {
    const out = { ...x };
    for (const key of Object.keys(y)) {
      const v = y[key];
      if (v == null) continue;
      if (Array.isArray(v) && !v.length) continue;
      if (typeof v === "string" && !v) continue;
      (out as Record<string, unknown>)[key] = v;
    }
    return out;
  };

  const goalsById = new Map<string, HublyBusinessGoal>();
  for (const g of a.goals) goalsById.set(g.id, g);
  for (const g of b.goals) goalsById.set(g.id, { ...goalsById.get(g.id), ...g });

  return normalizeBusinessDNA({
    identity: mergeObj(a.identity as Record<string, unknown>, b.identity as Record<string, unknown>),
    brand: mergeObj(a.brand as Record<string, unknown>, b.brand as Record<string, unknown>),
    services: mergeObj(a.services as Record<string, unknown>, b.services as Record<string, unknown>),
    pricing: mergeObj(a.pricing as Record<string, unknown>, b.pricing as Record<string, unknown>),
    customerProfile: mergeObj(
      a.customerProfile as Record<string, unknown>,
      b.customerProfile as Record<string, unknown>,
    ),
    goals: [...goalsById.values()],
    personality: mergeObj(
      a.personality as Record<string, unknown>,
      b.personality as Record<string, unknown>,
    ),
    operations: mergeObj(a.operations as Record<string, unknown>, b.operations as Record<string, unknown>),
    marketing: mergeObj(a.marketing as Record<string, unknown>, b.marketing as Record<string, unknown>),
    growthStage: b.growthStage || a.growthStage,
    source: b.source || a.source || "system",
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Infer interpretive DNA from Memory facts + optional conversation signals.
 * Reads Memory; writes DNA only — never mutates Memory.
 */
export function inferDNAFromMemory(
  memoryInput?: HublyBusinessMemoryInput | null,
  hints?: HublyBusinessDNAInput | null,
): HublyBusinessDNA {
  const memory = normalizeBusinessMemory(memoryInput);
  const inferred: HublyBusinessDNAInput = {
    source: "system",
    growthStage: memory.businessStage || null,
    services: {
      focus: memory.services?.slice(0, 8).map((s) => s.name) || null,
      idealJobs: memory.services?.filter((s) => s.popular).map((s) => s.name) || null,
    },
    brand: {
      preferredTone: typeof memory.brandVoice === "string" ? memory.brandVoice : null,
    },
    personality: {
      preferredTone: typeof memory.brandVoice === "string" ? memory.brandVoice : null,
    },
    operations: {
      seasonality: typeof memory.seasonality === "string" ? memory.seasonality : null,
    },
    goals: [],
  };

  if (memory.onboardingPriority === "grow") {
    inferred.goals = [
      { id: "goal_grow_revenue", label: "Increase revenue", kind: "increase_revenue", priority: 1, status: "active" },
      { id: "goal_more_bookings", label: "Book more ideal jobs", kind: "bookings", priority: 2, status: "active" },
    ];
    inferred.growthStage = inferred.growthStage || "growing";
  } else if (memory.onboardingPriority === "bookings") {
    inferred.goals = [
      { id: "goal_bookings", label: "Book more customers", kind: "bookings", priority: 1, status: "active" },
    ];
  } else if (memory.onboardingPriority === "run") {
    inferred.goals = [
      { id: "goal_ops", label: "Run operations smoothly", kind: "custom", priority: 1, status: "active" },
    ];
  }

  // Industry-informed defaults (interpretive, not facts)
  const industry = (memory.industry || "").toLowerCase();
  if (/detail|clean|hvac|lawn|pressure/.test(industry)) {
    inferred.identity = {
      competitiveAdvantage: inferred.identity?.competitiveAdvantage || "Convenience and local trust",
    };
    inferred.customerProfile = {
      idealCustomer: "Local homeowners who value quality and reliability",
    };
  }

  return evolveBusinessDNA(inferred, hints);
}

/**
 * Interpret free-form language into a DNA patch.
 * Understanding-adjacent — interpretive only. Does not write Memory facts.
 */
export function inferDNAFromConversation(
  conversation: string,
  priorDNA?: HublyBusinessDNAInput | null,
): HublyBusinessDNA {
  const low = conversation.toLowerCase();
  const patch: HublyBusinessDNAInput = { source: "understanding", goals: [] };

  const personality: string[] = [];
  if (/luxury|premium|high.?end|upscale/.test(low)) personality.push("Luxury", "Professional");
  if (/friendly|warm|neighbor/.test(low)) personality.push("Friendly");
  if (/professional|reliable|trust/.test(low)) personality.push("Professional");
  if (/fast|quick|convenient/.test(low)) personality.push("Convenient");
  if (personality.length) {
    patch.brand = { personality, salesStyle: /premium|luxury/.test(low) ? "Premium" : "Consultative" };
    patch.personality = { traits: personality, preferredTone: /friendly/.test(low) ? "Friendly" : "Professional" };
    patch.pricing = { tier: /luxury/.test(low) ? "luxury" : /premium|high.?end/.test(low) ? "premium" : null };
  }

  if (/high.?income|affluent|executives?|homeowners?/.test(low)) {
    patch.customerProfile = {
      idealCustomer: /high.?income|affluent/.test(low)
        ? "High-income homeowners"
        : "Local homeowners",
      incomeSignal: /high.?income|affluent/.test(low) ? "high" : null,
    };
  }
  if (/cheap customers|tire.?kickers|price shoppers|lowball/.test(low)) {
    patch.customerProfile = {
      ...(patch.customerProfile || {}),
      avoidCustomers: ["Cheap / price-only shoppers"],
    };
    patch.identity = { ...(patch.identity || {}), avoid: ["Cheap customers"] };
  }

  if (/hire (a |my )?(first )?employee|first hire/.test(low)) {
    (patch.goals as HublyBusinessGoal[]).push({
      id: "goal_hire_first",
      label: "Hire first employee",
      kind: "hire",
      priority: 1,
      status: "active",
    });
  }
  if (/fleet|commercial accounts|second location/.test(low)) {
    patch.identity = {
      ...(patch.identity || {}),
      longTermVision: /fleet|commercial/.test(low)
        ? "Expand into fleet accounts"
        : "Open a second location",
    };
    (patch.goals as HublyBusinessGoal[]).push({
      id: "goal_expand",
      label: /fleet|commercial/.test(low) ? "Expand into fleet accounts" : "Open second location",
      kind: "expand",
      priority: 2,
      status: "active",
    });
  }
  if (/ceramic coating/.test(low)) {
    patch.services = {
      idealJobs: ["Ceramic coatings"],
      focus: ["Ceramic coatings"],
    };
    patch.identity = {
      ...(patch.identity || {}),
      preferredJobs: ["Ceramic coatings"],
    };
  }
  if (/busy in spring|spring rush|summer peak|winter slow/.test(low)) {
    patch.operations = {
      seasonality: /spring/.test(low)
        ? "Busy in spring"
        : /summer/.test(low)
        ? "Busy in summer"
        : /winter/.test(low)
        ? "Slower in winter"
        : null,
    };
  }
  if (/convenience|come to (you|them)|mobile/.test(low)) {
    patch.identity = {
      ...(patch.identity || {}),
      competitiveAdvantage: "Convenience",
    };
  }
  if (/become premium|go premium|premium brand/.test(low)) {
    (patch.goals as HublyBusinessGoal[]).push({
      id: "goal_premium",
      label: "Become premium",
      kind: "premium",
      priority: 1,
      status: "active",
    });
    patch.pricing = { ...(patch.pricing || {}), tier: "premium", strategy: "Value-based premium" };
  }
  if (/repeat customers|retention/.test(low)) {
    (patch.goals as HublyBusinessGoal[]).push({
      id: "goal_repeat",
      label: "Increase repeat customers",
      kind: "repeat",
      priority: 2,
      status: "active",
    });
  }

  return evolveBusinessDNA(priorDNA, patch);
}

/** Format DNA for capability / model system injection (identity only — not Memory). */
export function formatBusinessDNA(dnaInput?: HublyBusinessDNAInput | null): string {
  const dna = normalizeBusinessDNA(dnaInput);
  const lines: string[] = [
    "HUBLY BUSINESS DNA (interpretive identity — how this business should behave):",
    "Memory answers what is true. DNA answers what kind of business this is. Never confuse them.",
  ];
  if (dna.brand.personality?.length) {
    lines.push(`Brand personality: ${dna.brand.personality.join(", ")}`);
  }
  if (dna.brand.preferredTone || dna.personality.preferredTone) {
    lines.push(`Preferred tone: ${dna.brand.preferredTone || dna.personality.preferredTone}`);
  }
  if (dna.brand.salesStyle) lines.push(`Sales style: ${dna.brand.salesStyle}`);
  if (dna.pricing.tier) lines.push(`Pricing tier: ${dna.pricing.tier}`);
  if (dna.customerProfile.idealCustomer) {
    lines.push(`Ideal customer: ${dna.customerProfile.idealCustomer}`);
  }
  if (dna.customerProfile.avoidCustomers?.length) {
    lines.push(`Avoid customers: ${dna.customerProfile.avoidCustomers.join(", ")}`);
  }
  if (dna.identity.competitiveAdvantage) {
    lines.push(`Competitive advantage: ${dna.identity.competitiveAdvantage}`);
  }
  if (dna.identity.longTermVision) lines.push(`Long-term vision: ${dna.identity.longTermVision}`);
  if (dna.services.idealJobs?.length) lines.push(`Ideal jobs: ${dna.services.idealJobs.join(", ")}`);
  if (dna.operations.seasonality) lines.push(`Seasonality: ${dna.operations.seasonality}`);
  if (dna.growthStage) lines.push(`Growth stage: ${dna.growthStage}`);
  if (dna.goals.length) {
    lines.push(`Goals: ${dna.goals.map((g) => g.label).join("; ")}`);
  }
  lines.push("", "STRUCTURED DNA JSON:", JSON.stringify(dna, null, 2));
  return lines.join("\n");
}

export function dnaCompleteness(dnaInput?: HublyBusinessDNAInput | null): {
  score: number;
  filled: string[];
  missing: string[];
} {
  const dna = normalizeBusinessDNA(dnaInput);
  const checks: Array<{ key: string; ok: boolean }> = [
    { key: "brand.personality", ok: !!dna.brand.personality?.length },
    { key: "brand.preferredTone", ok: !!dna.brand.preferredTone },
    { key: "brand.salesStyle", ok: !!dna.brand.salesStyle },
    { key: "pricing.tier", ok: !!dna.pricing.tier },
    { key: "customerProfile.idealCustomer", ok: !!dna.customerProfile.idealCustomer },
    { key: "identity.competitiveAdvantage", ok: !!dna.identity.competitiveAdvantage },
    { key: "identity.longTermVision", ok: !!dna.identity.longTermVision },
    { key: "services.idealJobs", ok: !!dna.services.idealJobs?.length },
    { key: "goals", ok: dna.goals.length > 0 },
    { key: "growthStage", ok: !!dna.growthStage },
    { key: "operations.seasonality", ok: !!dna.operations.seasonality },
  ];
  const filled = checks.filter((c) => c.ok).map((c) => c.key);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);
  const score = Math.round((filled.length / checks.length) * 100);
  return { score, filled, missing };
}

export const HublyBusinessDNAApi = {
  version: HUBLY_BUSINESS_DNA_VERSION,
  normalize: normalizeBusinessDNA,
  evolve: evolveBusinessDNA,
  inferFromMemory: inferDNAFromMemory,
  inferFromConversation: inferDNAFromConversation,
  format: formatBusinessDNA,
  completeness: dnaCompleteness,
  empty(): HublyBusinessDNA {
    return normalizeBusinessDNA({});
  },
};

export default HublyBusinessDNAApi;
