/**
 * Hubly Runtime — Executors (Phase 7.4–7.6)
 *
 * Orchestrator invokes capability executors with Memory + DNA separately.
 * Executors write through Memory SSOT / platform APIs — never the model writing DB.
 * DNA informs behavior; Memory stores facts. Never combine.
 *
 * Website Builder Claude migration is deferred: `website` writes a Memory scaffold only.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeBusinessMemory,
  normalizeBusinessMemory,
  type HublyBusinessMemory,
  type HublyBusinessMemoryInput,
} from "./hubly_brain_memory.ts";
import {
  evolveBusinessDNA,
  normalizeBusinessDNA,
  type HublyBusinessDNA,
  type HublyBusinessDNAInput,
} from "./hubly_brain_dna.ts";
import type { HublyCapabilityId } from "./hubly_brain_capabilities.ts";
import { getCapability } from "./hubly_brain_capabilities.ts";
import type { HublyCapabilityConfidence } from "./hubly_brain_confidence.ts";

export type HublyExecutorContext = {
  businessId?: string | null;
  memory?: HublyBusinessMemoryInput | null;
  /** Interpretive identity — never merged into Memory */
  dna?: HublyBusinessDNAInput | null;
  supabase?: SupabaseClient | null;
  source?: "system" | "ingest" | "understanding" | "client" | "runtime";
  persist?: boolean;
  runId?: string;
  confidence?: HublyCapabilityConfidence | null;
};

export type HublyCapabilityResult = {
  capability: HublyCapabilityId;
  ok: boolean;
  detail: string;
  skipped?: boolean;
  effects?: Record<string, unknown>;
  memory: HublyBusinessMemory;
  /** DNA after this capability (evolved separately from Memory) */
  dna: HublyBusinessDNA;
  confidence?: HublyCapabilityConfidence | null;
  rollback?: () => Promise<void> | void;
};

type CapabilityRunner = (args: {
  memory: HublyBusinessMemory;
  dna: HublyBusinessDNA;
  why?: string;
  ctx: HublyExecutorContext;
}) => Promise<{
  ok: boolean;
  detail: string;
  skipped?: boolean;
  effects?: Record<string, unknown>;
  memory: HublyBusinessMemory;
  dna: HublyBusinessDNA;
  rollback?: () => Promise<void> | void;
}>;

function adminOrThrow(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) throw new Error("Server isn’t configured yet.");
  return createClient(supabaseUrl, serviceKey);
}

export async function persistBusinessMemory(
  businessId: string,
  memory: HublyBusinessMemoryInput,
  opts?: {
    supabase?: SupabaseClient | null;
    source?: HublyExecutorContext["source"];
  },
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeBusinessMemory(memory);
  const client = opts?.supabase || adminOrThrow();
  const source = opts?.source === "runtime" ? "system" : (opts?.source || "system");
  const allowed = ["client", "ingest", "understanding", "system"].includes(String(source))
    ? source
    : "system";
  const { error } = await client.from("business_memories").upsert(
    {
      business_id: businessId,
      memory: normalized,
      memory_version: normalized.version,
      source: allowed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function persistBusinessDNA(
  businessId: string,
  dna: HublyBusinessDNAInput,
  opts?: {
    supabase?: SupabaseClient | null;
    source?: HublyBusinessDNA["source"];
  },
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizeBusinessDNA(dna);
  const client = opts?.supabase || adminOrThrow();
  const source = opts?.source || normalized.source || "system";
  const allowed = ["understanding", "client", "weekly_learning", "system"].includes(String(source))
    ? source
    : "system";
  const { error } = await client.from("business_dna").upsert(
    {
      business_id: businessId,
      dna: normalized,
      dna_version: normalized.version,
      source: allowed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const runUnderstanding: CapabilityRunner = async ({ memory, dna, why }) => {
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      lastUnderstoodAt: new Date().toISOString(),
      understandingNote: why || "Structured from conversation",
    },
  });
  return {
    ok: true,
    detail: "Business facts stored in Memory (DNA unchanged here)",
    memory: nextMem,
    dna,
  };
};

const runBranding: CapabilityRunner = async ({ memory, dna }) => {
  // DNA owns personality; Memory only stores a factual brandVoice string for legacy UI.
  const tone = dna.brand.preferredTone || dna.personality.preferredTone ||
    (typeof memory.brandVoice === "string" ? memory.brandVoice : null) ||
    "warm, local, trustworthy";
  const nextDna = evolveBusinessDNA(dna, {
    source: "system",
    brand: {
      preferredTone: tone,
      personality: dna.brand.personality?.length
        ? dna.brand.personality
        : ["Professional", "Friendly"],
      salesStyle: dna.brand.salesStyle ||
        (dna.pricing.tier === "premium" || dna.pricing.tier === "luxury" ? "Premium" : "Consultative"),
    },
    personality: {
      preferredTone: tone,
      traits: dna.personality.traits?.length
        ? dna.personality.traits
        : (dna.brand.personality || ["Professional", "Friendly"]),
    },
  });
  const nextMem = mergeBusinessMemory(memory, {
    brandVoice: tone,
  });
  return {
    ok: true,
    detail: "Brand identity evolved in DNA; brandVoice fact in Memory",
    memory: nextMem,
    dna: nextDna,
    effects: {
      brand: nextDna.brand,
      personality: nextDna.personality,
    },
  };
};

const runWebsiteScaffold: CapabilityRunner = async ({ memory, dna }) => {
  // Soft scaffold only — does NOT call Website Builder / Claude.
  // Copy is informed by DNA identity but stored as website facts in Memory.
  const name = memory.name || "Your Business";
  const tone = dna.brand.preferredTone || dna.personality.preferredTone || "friendly";
  const ideal = dna.customerProfile.idealCustomer;
  const advantage = dna.identity.competitiveAdvantage;
  const focus = dna.services.idealJobs?.[0] || dna.services.focus?.[0];
  const premium = dna.pricing.tier === "premium" || dna.pricing.tier === "luxury" ||
    dna.brand.salesStyle === "Premium";

  const headline = memory.currentWebsite?.headline ||
    (premium
      ? `${name} — premium ${focus || "service"} for ${ideal || "discerning clients"}`
      : `${name} — ${advantage === "Convenience" ? "we come to you" : "built for your neighborhood"}`);
  const heroSub = memory.currentWebsite?.heroSub ||
    (focus
      ? `Specializing in ${focus}. ${tone === "Friendly" ? "Glad you're here." : "Crafted with care."}`
      : "Book online. Get it done right.");

  const nextMem = mergeBusinessMemory(memory, {
    currentWebsite: {
      ...(memory.currentWebsite && typeof memory.currentWebsite === "object"
        ? memory.currentWebsite
        : {}),
      published: false,
      headline,
      heroSub,
      ctaText: memory.currentWebsite?.ctaText || (premium ? "Request a Quote" : "Book Now"),
      accentColor: memory.currentWebsite?.accentColor || "#D9632D",
    },
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      websiteScaffold: {
        mode: "memory_scaffold_dna_informed",
        note: "Website Builder migration pending — scaffold informed by DNA, facts in Memory only",
        at: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Website scaffold in Memory (DNA-informed; Builder migration deferred)",
    memory: nextMem,
    dna,
    effects: { currentWebsite: nextMem.currentWebsite },
  };
};

const runCrm: CapabilityRunner = async ({ memory, dna }) => {
  const nextMem = mergeBusinessMemory(memory, {
    currentCrm: {
      ...(memory.currentCrm && typeof memory.currentCrm === "object" ? memory.currentCrm : {}),
      pipeline: memory.currentCrm?.pipeline || "lead → booked → completed",
      customerCount: memory.currentCrm?.customerCount ?? 0,
      notes: memory.currentCrm?.notes ||
        `CRM for ${dna.customerProfile.idealCustomer || "local customers"}`,
    },
  });
  return {
    ok: true,
    detail: "CRM structure recorded in Memory",
    memory: nextMem,
    dna,
    effects: { currentCrm: nextMem.currentCrm },
  };
};

const runBooking: CapabilityRunner = async ({ memory, dna }) => {
  const intake = ["name", "phone", "service", "preferred_time"];
  if (dna.services.idealJobs?.length) intake.push("job_notes");
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      bookingFlow: {
        enabled: true,
        intake,
        featuredServices: dna.services.idealJobs || dna.services.focus || null,
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Booking preferences stored in Memory (DNA-informed intake)",
    memory: nextMem,
    dna,
    effects: { bookingFlow: (nextMem.extras as Record<string, unknown>)?.bookingFlow },
  };
};

const runDashboard: CapabilityRunner = async ({ memory, dna }) => {
  const views = ["today", "jobs", "customers", "money"];
  if (dna.goals.some((g) => g.kind === "hire")) views.push("team");
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      dashboard: {
        views,
        goalFocus: dna.goals.slice(0, 3).map((g) => g.label),
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Dashboard preferences stored in Memory",
    memory: nextMem,
    dna,
    effects: { dashboard: (nextMem.extras as Record<string, unknown>)?.dashboard },
  };
};

const runCoaching: CapabilityRunner = async ({ memory, dna, why }) => {
  const nextDna = evolveBusinessDNA(dna, {
    source: "system",
    goals: dna.goals.length
      ? dna.goals
      : [{
        id: "goal_clarify",
        label: why || "Clarify next growth move",
        kind: "custom",
        priority: 1,
        status: "active",
      }],
  });
  return {
    ok: true,
    detail: "Coaching focus recorded in DNA goals (not Memory facts)",
    memory,
    dna: nextDna,
    effects: { goals: nextDna.goals },
  };
};

const RUNNERS: Partial<Record<HublyCapabilityId, CapabilityRunner>> = {
  understanding: runUnderstanding,
  branding: runBranding,
  website: runWebsiteScaffold,
  crm: runCrm,
  booking: runBooking,
  dashboard: runDashboard,
  coaching: runCoaching,
};

export async function executeCapability(
  capability: HublyCapabilityId,
  ctx: HublyExecutorContext,
  why?: string,
): Promise<HublyCapabilityResult> {
  const memory = normalizeBusinessMemory(ctx.memory);
  const dna = normalizeBusinessDNA(ctx.dna);
  const cap = getCapability(capability);
  if (!cap) {
    return {
      capability,
      ok: false,
      detail: "Unknown capability",
      memory,
      dna,
      confidence: ctx.confidence,
    };
  }
  if (!cap.executable) {
    return {
      capability,
      ok: false,
      skipped: true,
      detail: "Capability registered but not executable yet — platform migration pending",
      memory,
      dna,
      confidence: ctx.confidence,
    };
  }
  const runner = RUNNERS[capability];
  if (!runner) {
    return {
      capability,
      ok: false,
      skipped: true,
      detail: "No executor registered for capability",
      memory,
      dna,
      confidence: ctx.confidence,
    };
  }
  const result = await runner({ memory, dna, why, ctx });
  return { capability, confidence: ctx.confidence, ...result };
}

export const HublyExecutors = {
  executeCapability,
  persistBusinessMemory,
  persistBusinessDNA,
  runners: RUNNERS,
};

export default HublyExecutors;
