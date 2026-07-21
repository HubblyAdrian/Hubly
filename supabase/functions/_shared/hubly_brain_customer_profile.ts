/**
 * Hubly Customer Runtime — Customer Profile (Phase 7.8)
 *
 * Parallel to Business DNA:
 *   Business DNA     = who the business is (identity)
 *   Customer Profile = who the customer is (preferences / identity)
 *
 * Facts stay in Customer Memory. Never combine.
 */

import {
  normalizeCustomerMemory,
  type HublyCustomerMemoryInput,
} from "./hubly_brain_customer_memory.ts";

export const HUBLY_CUSTOMER_PROFILE_VERSION = 1 as const;

export type HublyCustomerProfile = {
  version: typeof HUBLY_CUSTOMER_PROFILE_VERSION;
  prefersPremium?: boolean | null;
  budgetConscious?: boolean | null;
  booksOnWeekends?: boolean | null;
  likesTextReminders?: boolean | null;
  hasPets?: boolean | null;
  repeatCustomer?: boolean | null;
  prefersMobile?: boolean | null;
  caresAboutCarefulness?: boolean | null;
  urgency?: "low" | "medium" | "high" | null;
  tone?: string | null;
  goals?: string[] | null;
  avoid?: string[] | null;
  source?: "understanding" | "client" | "system" | null;
  updatedAt?: string | null;
};

export type HublyCustomerProfileInput = Partial<HublyCustomerProfile>;

export function normalizeCustomerProfile(
  input?: HublyCustomerProfileInput | null,
): HublyCustomerProfile {
  const raw = input && typeof input === "object" ? input : {};
  return {
    version: HUBLY_CUSTOMER_PROFILE_VERSION,
    prefersPremium: typeof raw.prefersPremium === "boolean" ? raw.prefersPremium : null,
    budgetConscious: typeof raw.budgetConscious === "boolean" ? raw.budgetConscious : null,
    booksOnWeekends: typeof raw.booksOnWeekends === "boolean" ? raw.booksOnWeekends : null,
    likesTextReminders: typeof raw.likesTextReminders === "boolean" ? raw.likesTextReminders : null,
    hasPets: typeof raw.hasPets === "boolean" ? raw.hasPets : null,
    repeatCustomer: typeof raw.repeatCustomer === "boolean" ? raw.repeatCustomer : null,
    prefersMobile: typeof raw.prefersMobile === "boolean" ? raw.prefersMobile : null,
    caresAboutCarefulness: typeof raw.caresAboutCarefulness === "boolean"
      ? raw.caresAboutCarefulness
      : null,
    urgency: raw.urgency === "low" || raw.urgency === "medium" || raw.urgency === "high"
      ? raw.urgency
      : null,
    tone: raw.tone ? String(raw.tone) : null,
    goals: Array.isArray(raw.goals) ? raw.goals.map(String).filter(Boolean) : null,
    avoid: Array.isArray(raw.avoid) ? raw.avoid.map(String).filter(Boolean) : null,
    source: (raw.source as HublyCustomerProfile["source"]) || null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
  };
}

export function evolveCustomerProfile(
  base?: HublyCustomerProfileInput | null,
  patch?: HublyCustomerProfileInput | null,
): HublyCustomerProfile {
  const a = normalizeCustomerProfile(base);
  const b = normalizeCustomerProfile(patch);
  return normalizeCustomerProfile({
    ...a,
    ...Object.fromEntries(
      Object.entries(b).filter(([k, v]) => k !== "version" && v != null && v !== ""),
    ),
    updatedAt: new Date().toISOString(),
  });
}

/** Interpretive identity from conversation — not factual Memory. */
export function inferCustomerProfileFromConversation(
  conversation: string,
  prior?: HublyCustomerProfileInput | null,
  memory?: HublyCustomerMemoryInput | null,
): HublyCustomerProfile {
  const low = String(conversation || "").toLowerCase();
  const mem = normalizeCustomerMemory(memory);
  const patch: HublyCustomerProfileInput = { source: "understanding" };

  if (/premium|white.?glove|high.?end|luxury|careful|treat.*(home|house).*care/.test(low)) {
    patch.prefersPremium = true;
    patch.caresAboutCarefulness = true;
  }
  if (/cheap|affordable|budget|lowest|inexpensive/.test(low)) {
    patch.budgetConscious = true;
  }
  if (/weekend/.test(low)) patch.booksOnWeekends = true;
  if (/text|sms|message me/.test(low)) patch.likesTextReminders = true;
  if (/pet|dog|cat/.test(low) || mem.property?.hasPets) patch.hasPets = true;
  if (/mobile|come to (me|my)|at my (home|house)/.test(low)) patch.prefersMobile = true;
  if (/asap|urgent|today/.test(low) || mem.job?.urgency === "high") patch.urgency = "high";
  else if (/flexible|whenever/.test(low)) patch.urgency = "low";
  else patch.urgency = "medium";

  if (patch.prefersPremium) patch.avoid = ["Cheap / price-only providers"];
  if (patch.caresAboutCarefulness) {
    patch.goals = ["Find someone who treats my home carefully"];
  }

  return evolveCustomerProfile(prior, patch);
}

export function formatCustomerProfile(profile?: HublyCustomerProfileInput | null): string {
  const p = normalizeCustomerProfile(profile);
  return [
    "HUBLY CUSTOMER PROFILE (identity — how this customer prefers to be served):",
    "Customer Memory answers what is true. Profile answers who they are. Never combine them.",
    JSON.stringify(p, null, 2),
  ].join("\n");
}

/** Map profile → marketplace preference flags used by existing ranker. */
export function customerProfileToMatchPreferences(profile?: HublyCustomerProfileInput | null) {
  const p = normalizeCustomerProfile(profile);
  return {
    budget_conscious: !!p.budgetConscious,
    fastest_appointment: p.urgency === "high",
    premium_quality: !!p.prefersPremium || !!p.caresAboutCarefulness,
    eco_friendly: false,
    mobile_only: !!p.prefersMobile,
    weekend_preferred: !!p.booksOnWeekends,
  };
}

export const HublyCustomerProfileApi = {
  version: HUBLY_CUSTOMER_PROFILE_VERSION,
  normalize: normalizeCustomerProfile,
  evolve: evolveCustomerProfile,
  inferFromConversation: inferCustomerProfileFromConversation,
  format: formatCustomerProfile,
  toMatchPreferences: customerProfileToMatchPreferences,
};

export default HublyCustomerProfileApi;
