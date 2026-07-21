/**
 * Hubly Runtime — Capability Confidence (Phase 7.6)
 *
 * Every capability reports confidence before / during execution.
 * Low confidence → ask clarifying questions instead of guessing.
 *
 * Example:
 *   Website  99% — enough information
 *   Pricing  62% — missing average job price → "What do you normally charge?"
 */

import type { HublyCapabilityId } from "./hubly_brain_capabilities.ts";
import { getCapability } from "./hubly_brain_capabilities.ts";
import {
  dnaCompleteness,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import {
  normalizeBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";

export type HublyCapabilityConfidence = {
  capability: HublyCapabilityId;
  /** 0–100 */
  confidence: number;
  reason: string;
  missing: string[];
  clarifyingQuestions: string[];
  /** When true, Orchestrator should pause for owner input instead of guessing */
  shouldAsk: boolean;
};

const ASK_THRESHOLD = 70;

type Req = {
  memory: ReturnType<typeof normalizeBusinessMemory>;
  dna: HublyBusinessDNA;
};

function conf(
  capability: HublyCapabilityId,
  confidence: number,
  reason: string,
  missing: string[],
  questions: string[],
): HublyCapabilityConfidence {
  const clamped = Math.max(0, Math.min(100, Math.round(confidence)));
  return {
    capability,
    confidence: clamped,
    reason,
    missing,
    clarifyingQuestions: questions,
    shouldAsk: clamped < ASK_THRESHOLD && questions.length > 0,
  };
}

function assessUnderstanding({ memory }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 40;
  if (memory.name) score += 25;
  else {
    missing.push("business_name");
    qs.push("What's the name of your business?");
  }
  if (memory.industry) score += 20;
  else {
    missing.push("industry");
    qs.push("What kind of work do you do?");
  }
  if (memory.city || memory.serviceArea?.cities?.length) score += 15;
  else {
    missing.push("location");
    qs.push("What city do you primarily serve?");
  }
  return conf(
    "understanding",
    score,
    score >= 90 ? "Enough information to understand the business." : "Need a few basics.",
    missing,
    qs,
  );
}

function assessBranding({ dna, memory }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 50;
  if (dna.brand.personality?.length || dna.personality.traits?.length) score += 25;
  else {
    missing.push("brand.personality");
    qs.push("How should customers describe your brand — professional, friendly, luxury?");
  }
  if (dna.brand.preferredTone || dna.personality.preferredTone || memory.brandVoice) score += 15;
  else {
    missing.push("brand.tone");
    qs.push("What tone should your brand use?");
  }
  if (dna.brand.salesStyle || dna.pricing.tier) score += 10;
  return conf(
    "branding",
    score,
    score >= 85 ? "Enough brand identity to proceed." : "Brand personality still thin.",
    missing,
    qs,
  );
}

function assessWebsite({ memory, dna }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 35;
  if (memory.name) score += 20;
  else {
    missing.push("business_name");
    qs.push("What's your business name for the website?");
  }
  if (memory.services?.length || dna.services.focus?.length) score += 20;
  else {
    missing.push("services");
    qs.push("Which services should be featured first?");
  }
  if (dna.brand.personality?.length || dna.personality.traits?.length || memory.brandVoice) {
    score += 15;
  } else {
    missing.push("brand.personality");
    qs.push("What personality should the site feel like?");
  }
  if (dna.customerProfile.idealCustomer) score += 10;
  if (memory.city || memory.serviceArea?.cities?.length) score += 10;
  return conf(
    "website",
    score,
    score >= 90 ? "Enough information." : "Need a bit more to build a handcrafted site.",
    missing,
    qs,
  );
}

function assessCrm({ memory }: Ctx): HublyCapabilityConfidence {
  let score = 75;
  const missing: string[] = [];
  const qs: string[] = [];
  if (!memory.name) {
    score -= 20;
    missing.push("business_name");
    qs.push("What business should this CRM belong to?");
  }
  return conf("crm", score, "CRM structure can be scaffolded from identity.", missing, qs);
}

function assessBooking({ memory, dna }: Ctx): HublyCapabilityConfidence {
  let score = 70;
  const missing: string[] = [];
  const qs: string[] = [];
  if (!(memory.services?.length || dna.services.focus?.length)) {
    score -= 25;
    missing.push("services");
    qs.push("Which services can customers book?");
  }
  return conf("booking", score, "Booking intake can be scaffolded.", missing, qs);
}

function assessPayments({ memory, dna }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 45;
  const hasPrice = memory.services?.some((s) => s.price != null && s.price !== "") ||
    !!dna.pricing.strategy || !!dna.pricing.tier;
  if (hasPrice) score += 30;
  else {
    missing.push("average_job_price");
    qs.push("What do you normally charge?");
  }
  if (dna.pricing.tier) score += 15;
  else {
    missing.push("pricing.tier");
    qs.push("Are you budget, mid-range, or premium?");
  }
  return conf(
    "payments",
    score,
    hasPrice ? "Pricing signal present." : "Missing pricing — ask before guessing.",
    missing,
    qs,
  );
}

function assessDashboard({ memory }: Ctx): HublyCapabilityConfidence {
  return conf(
    "dashboard",
    memory.name ? 88 : 60,
    "Dashboard preferences can be scaffolded.",
    memory.name ? [] : ["business_name"],
    memory.name ? [] : ["What's your business name?"],
  );
}

function assessMarketing({ dna, memory }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 40;
  if (dna.customerProfile.idealCustomer) score += 20;
  else {
    missing.push("customerProfile.idealCustomer");
    qs.push("Who is your ideal customer?");
  }
  if (dna.brand.personality?.length || dna.personality.traits?.length) score += 15;
  else {
    missing.push("brand.personality");
    qs.push("What brand personality should marketing use?");
  }
  if (dna.goals.some((g) => g.kind === "bookings" || g.kind === "increase_revenue" || g.kind === "repeat")) {
    score += 15;
  } else {
    missing.push("goals");
    qs.push("What's the #1 growth goal for marketing?");
  }
  if (memory.services?.length || dna.services.idealJobs?.length) score += 10;
  return conf("marketing", score, "Marketing needs DNA + goals for consistency.", missing, qs);
}

function assessQuotes({ memory, dna }: Ctx): HublyCapabilityConfidence {
  const missing: string[] = [];
  const qs: string[] = [];
  let score = 50;
  if (memory.services?.some((s) => s.price != null && s.price !== "")) score += 30;
  else {
    missing.push("average_job_price");
    qs.push("What do you normally charge for a typical job?");
  }
  if (dna.pricing.tier || dna.pricing.strategy) score += 15;
  return conf("quotes", score, "Quotes need pricing identity.", missing, qs);
}

function assessCoaching({ dna }: Ctx): HublyCapabilityConfidence {
  const c = dnaCompleteness(dna);
  let score = 55 + Math.round(c.score * 0.35);
  const missing: string[] = [];
  const qs: string[] = [];
  if (!dna.goals.length) {
    missing.push("goals");
    qs.push("What are you trying to achieve in the next 90 days?");
    score = Math.min(score, 65);
  }
  return conf("coaching", score, "Coaching quality tracks DNA + goals completeness.", missing, qs);
}

function assessDefault(capability: HublyCapabilityId, ctx: Ctx): HublyCapabilityConfidence {
  const c = dnaCompleteness(ctx.dna);
  const hasName = !!ctx.memory.name;
  const score = Math.round(c.score * 0.6 + (hasName ? 25 : 0));
  return conf(
    capability,
    score,
    getCapability(capability)?.description || "Capability assessment",
    c.missing.slice(0, 3),
    c.missing.slice(0, 2).map((m) => `Can you fill in ${m.replace(/\./g, " ")}?`),
  );
}

const ASSESSORS: Partial<Record<HublyCapabilityId, (ctx: Ctx) => HublyCapabilityConfidence>> = {
  understanding: assessUnderstanding,
  branding: assessBranding,
  website: assessWebsite,
  crm: assessCrm,
  booking: assessBooking,
  payments: assessPayments,
  dashboard: assessDashboard,
  marketing: assessMarketing,
  quotes: assessQuotes,
  coaching: assessCoaching,
};

export function assessCapabilityConfidence(
  capability: HublyCapabilityId,
  opts?: {
    memory?: HublyBusinessMemoryInput | null;
    dna?: HublyBusinessDNAInput | null;
  },
): HublyCapabilityConfidence {
  const ctx: Ctx = {
    memory: normalizeBusinessMemory(opts?.memory),
    dna: normalizeBusinessDNA(opts?.dna),
  };
  const fn = ASSESSORS[capability] || ((c) => assessDefault(capability, c));
  return fn(ctx);
}

export function assessPlanConfidence(
  capabilities: HublyCapabilityId[],
  opts?: {
    memory?: HublyBusinessMemoryInput | null;
    dna?: HublyBusinessDNAInput | null;
  },
): HublyCapabilityConfidence[] {
  return capabilities.map((c) => assessCapabilityConfidence(c, opts));
}

export const HublyConfidence = {
  assess: assessCapabilityConfidence,
  assessPlan: assessPlanConfidence,
  ASK_THRESHOLD,
};

export default HublyConfidence;
