/**
 * Hubly Runtime — Executors (Phase 7.4–7.7)
 *
 * Orchestrator invokes capability executors with Memory + DNA separately.
 * Executors write through Memory SSOT / platform APIs — never the model writing DB.
 * DNA informs behavior; Memory stores facts. Never combine.
 *
 * Phase 7.7: Website capability publishes a live Instant Site from Memory + DNA.
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
import {
  buildWebsiteCopyFromMemoryDna,
  mergeWebsiteCopy,
  parseWebsiteAiJson,
  publishBusinessWebsite,
  websiteBuilderSystemPrompt,
  websitePromptBlocks,
} from "./hubly_brain_website.ts";

export type HublyExecutorContext = {
  businessId?: string | null;
  ownerId?: string | null;
  memory?: HublyBusinessMemoryInput | null;
  /** Interpretive identity — never merged into Memory */
  dna?: HublyBusinessDNAInput | null;
  supabase?: SupabaseClient | null;
  source?: "system" | "ingest" | "understanding" | "client" | "runtime";
  persist?: boolean;
  runId?: string;
  confidence?: HublyCapabilityConfidence | null;
  /** Stream sub-step progress (Orchestrator Progress Bus) */
  emitProgress?: (message: string, meta?: Record<string, unknown>) => void;
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

const runWebsite: CapabilityRunner = async ({ memory, dna, ctx }) => {
  const emit = (message: string, meta?: Record<string, unknown>) => {
    try {
      ctx.emitProgress?.(message, meta);
    } catch (_) {
      /* ignore */
    }
  };

  emit("Learning your business…", { step: "learn" });
  let copy = buildWebsiteCopyFromMemoryDna(memory, dna);
  let usedAi = false;

  // Optional AI enrichment via HublyAI — Memory + DNA only, never raw "build a website".
  try {
    const { HublyAI } = await import("./hubly_ai.ts");
    if (HublyAI.isConfigured("openai") || HublyAI.isConfigured("claude")) {
      emit("Writing homepage…", { step: "homepage" });
      const result = await HublyAI.generateWebsite({
        feature: "website_runtime",
        memory,
        dna,
        system: websiteBuilderSystemPrompt(),
        messages: [{
          role: "user",
          content: websitePromptBlocks(memory, dna),
        }],
        jsonMode: true,
        maxTokens: 2500,
      });
      const parsed = parseWebsiteAiJson(result.text);
      if (parsed) {
        copy = mergeWebsiteCopy(copy, parsed);
        usedAi = true;
      }
    } else {
      emit("Writing homepage…", { step: "homepage", mode: "dna_deterministic" });
    }
  } catch (e) {
    console.warn("website AI enrichment skipped", e);
    emit("Writing homepage…", { step: "homepage", mode: "fallback" });
  }

  emit("Generating services…", { step: "services" });

  let published: Awaited<ReturnType<typeof publishBusinessWebsite>> | null = null;
  const shouldPublish = ctx.persist !== false && !!ctx.supabase &&
    (!!ctx.businessId || !!ctx.ownerId);

  if (shouldPublish && ctx.supabase) {
    emit("Publishing…", { step: "publish" });
    published = await publishBusinessWebsite({
      supabase: ctx.supabase,
      businessId: ctx.businessId,
      ownerId: ctx.ownerId,
      memory,
      dna,
      copy,
      usedAi,
    });
  }

  const nextMem = mergeBusinessMemory(memory, {
    name: memory.name,
    services: memory.services?.length
      ? memory.services
      : (published?.serviceCatalog.services || memory.services),
    currentWebsite: {
      published: !!published,
      slug: published?.slug || memory.currentWebsite?.slug || null,
      layoutId: "classic",
      headline: copy.heroHeadline.replace(/\n/g, " "),
      heroSub: copy.heroSub,
      accentColor: copy.accentColor,
      ctaText: copy.ctaText,
    },
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      websiteRuntime: {
        mode: published ? "published" : "memory_only",
        usedAi,
        at: new Date().toISOString(),
        businessId: published?.businessId || ctx.businessId || null,
        slug: published?.slug || null,
      },
    },
  });

  return {
    ok: true,
    detail: published
      ? `Published website at /${published.slug}`
      : "Website copy ready in Memory (persist to publish)",
    memory: nextMem,
    dna,
    effects: {
      currentWebsite: nextMem.currentWebsite,
      published: !!published,
      slug: published?.slug || null,
      businessId: published?.businessId || ctx.businessId || null,
      usedAi,
      publicPath: published?.publicPath || null,
    },
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
  website: runWebsite,
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
