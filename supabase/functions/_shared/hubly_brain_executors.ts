/**
 * Hubly Runtime — Executors
 *
 * Orchestrator invokes capability executors with Memory + DNA separately.
 * Executors write through Memory SSOT / platform APIs — never the model writing DB.
 * DNA informs behavior; Memory stores facts. Never combine.
 *
 * Website expresses DNA. Domain suggests names. Marketplace prepares Customer Runtime.
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
import { suggestDomains } from "./hubly_brain_domain.ts";

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

const runUnderstanding: CapabilityRunner = async ({ memory, dna, why, ctx }) => {
  try {
    ctx.emitProgress?.("✓ Understanding who you are", { step: "who" });
    ctx.emitProgress?.("✓ Learning who your customers are", { step: "customers" });
  } catch (_) {
    /* ignore */
  }
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      lastUnderstoodAt: new Date().toISOString(),
      understandingNote: why || "Structured from conversation",
      idealCustomerHint: dna.customerProfile.idealCustomer || null,
    },
  });
  return {
    ok: true,
    detail: "✓ Understanding who you are",
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
    detail: "✓ Creating your brand",
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

  // Website answers DNA questions — never “build a website from a prompt.”
  let copy = buildWebsiteCopyFromMemoryDna(memory, dna);
  let usedAi = false;

  try {
    const { HublyAI } = await import("./hubly_ai.ts");
    if (HublyAI.isConfigured("openai") || HublyAI.isConfigured("claude")) {
      emit("✓ Writing your website", { step: "write", mode: "dna" });
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
      emit("✓ Writing your website", { step: "write", mode: "dna_deterministic" });
    }
  } catch (e) {
    console.warn("website AI enrichment skipped", e);
    emit("✓ Writing your website", { step: "write", mode: "fallback" });
  }

  let published: Awaited<ReturnType<typeof publishBusinessWebsite>> | null = null;
  const shouldPublish = ctx.persist !== false && !!ctx.supabase &&
    (!!ctx.businessId || !!ctx.ownerId);

  if (shouldPublish && ctx.supabase) {
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
        surfaces: [
          "homepage", "about", "services", "contact", "seo",
          "social_share", "business_schema", "booking_page", "lead_forms",
        ],
      },
    },
  });

  return {
    ok: true,
    detail: "✓ Writing your website",
    memory: nextMem,
    dna,
    effects: {
      currentWebsite: nextMem.currentWebsite,
      published: !!published,
      slug: published?.slug || null,
      businessId: published?.businessId || ctx.businessId || null,
      usedAi,
      publicPath: published?.publicPath || null,
      surfaces: published?.website
        ? Object.keys(published.website).filter((k) =>
          ["contact", "seo", "socialShare", "businessSchema", "bookingPage", "leadForms"].includes(k)
        )
        : ["homepage", "about", "services", "contact", "seo", "socialShare", "businessSchema", "bookingPage", "leadForms"],
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
      selfGrowing: true,
    },
  });
  return {
    ok: true,
    detail: "✓ Creating your CRM",
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
    detail: "✓ Building your booking system",
    memory: nextMem,
    dna,
    effects: { bookingFlow: (nextMem.extras as Record<string, unknown>)?.bookingFlow },
  };
};

const runPayments: CapabilityRunner = async ({ memory, dna }) => {
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      payments: {
        ready: true,
        provider: "stripe",
        mode: "connect_pending",
        acceptOnline: true,
        invoicing: true,
        scaffoldedAt: new Date().toISOString(),
        note: `Payments for ${dna.pricing.tier || "local"} pricing`,
      },
    },
  });
  return {
    ok: true,
    detail: "✓ Setting up payments",
    memory: nextMem,
    dna,
    effects: { payments: (nextMem.extras as Record<string, unknown>)?.payments },
  };
};

const runDashboard: CapabilityRunner = async ({ memory, dna }) => {
  const views = ["today", "timeline", "jobs", "customers", "money", "health"];
  if (dna.goals.some((g) => g.kind === "hire")) views.push("team");
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      dashboard: {
        views,
        primaryView: "timeline",
        goalFocus: dna.goals.slice(0, 3).map((g) => g.label),
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "✓ Setting up your dashboard",
    memory: nextMem,
    dna,
    effects: { dashboard: (nextMem.extras as Record<string, unknown>)?.dashboard },
  };
};

const runMarketplace: CapabilityRunner = async ({ memory, dna }) => {
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      marketplaceProfile: {
        ready: true,
        visibleToCustomerRuntime: true,
        category: memory.industry || null,
        city: memory.city || memory.serviceArea?.cities?.[0] || null,
        dnaFitEnabled: true,
        tagline: memory.currentWebsite?.headline || dna.identity.mission || null,
        idealCustomer: dna.customerProfile.idealCustomer || null,
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "✓ Preparing your marketplace profile",
    memory: nextMem,
    dna,
    effects: { marketplaceProfile: (nextMem.extras as Record<string, unknown>)?.marketplaceProfile },
  };
};

const runDomain: CapabilityRunner = async ({ memory, dna }) => {
  const domains = suggestDomains({
    businessName: memory.name,
    industry: memory.industry,
    city: memory.city || memory.serviceArea?.cities?.[0] || null,
  });
  const nextMem = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      domain: domains,
    },
  });
  return {
    ok: true,
    detail: domains.preferred
      ? `✓ Checking domain availability — ${domains.preferred}`
      : "✓ Checking domain availability",
    memory: nextMem,
    dna,
    effects: { domain: domains },
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
  payments: runPayments,
  dashboard: runDashboard,
  marketplace: runMarketplace,
  domain: runDomain,
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
