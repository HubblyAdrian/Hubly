/**
 * Hubly Runtime — Executors (Phase 7.4/7.5)
 *
 * Orchestrator invokes capability executors.
 * Executors write through Memory SSOT / platform APIs — never the model writing DB.
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
import type { HublyCapabilityId } from "./hubly_brain_capabilities.ts";
import { getCapability } from "./hubly_brain_capabilities.ts";

export type HublyExecutorContext = {
  businessId?: string | null;
  memory?: HublyBusinessMemoryInput | null;
  supabase?: SupabaseClient | null;
  source?: "system" | "ingest" | "understanding" | "client" | "runtime";
  persist?: boolean;
  runId?: string;
};

export type HublyCapabilityResult = {
  capability: HublyCapabilityId;
  ok: boolean;
  detail: string;
  skipped?: boolean;
  effects?: Record<string, unknown>;
  memory: HublyBusinessMemory;
  rollback?: () => Promise<void> | void;
};

type CapabilityRunner = (args: {
  memory: HublyBusinessMemory;
  why?: string;
  ctx: HublyExecutorContext;
}) => Promise<Omit<HublyCapabilityResult, "capability" | "memory"> & { memory: HublyBusinessMemory }>;

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
  const allowed = ["client", "ingest", "understanding", "system"].includes(source)
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

const runUnderstanding: CapabilityRunner = async ({ memory, why }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      lastUnderstoodAt: new Date().toISOString(),
      understandingNote: why || "Structured from conversation",
    },
  });
  return { ok: true, detail: "Business facts stored in Memory", memory: next };
};

const runBranding: CapabilityRunner = async ({ memory }) => {
  const voice = memory.brandVoice || "warm, local, trustworthy";
  const next = mergeBusinessMemory(memory, {
    brandVoice: voice,
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      branding: {
        voice,
        personality: "confident local pro",
        accentHint: "#D9632D",
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Brand voice recorded in Memory",
    memory: next,
    effects: { branding: (next.extras as Record<string, unknown>)?.branding },
  };
};

const runWebsiteScaffold: CapabilityRunner = async ({ memory }) => {
  // Soft scaffold only — does NOT call Website Builder / Claude.
  const name = memory.name || "Your Business";
  const next = mergeBusinessMemory(memory, {
    currentWebsite: {
      ...(memory.currentWebsite && typeof memory.currentWebsite === "object"
        ? memory.currentWebsite
        : {}),
      published: false,
      headline: memory.currentWebsite?.headline || `${name} — built for your neighborhood`,
      heroSub: memory.currentWebsite?.heroSub ||
        "Book online. Get it done right.",
      ctaText: memory.currentWebsite?.ctaText || "Book Now",
      accentColor: memory.currentWebsite?.accentColor || "#D9632D",
    },
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      websiteScaffold: {
        mode: "memory_only",
        note: "Website Builder migration pending — Runtime recorded scaffold only",
        at: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Website scaffold in Memory (Builder migration deferred)",
    memory: next,
    effects: { currentWebsite: next.currentWebsite },
  };
};

const runCrm: CapabilityRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    currentCrm: {
      ...(memory.currentCrm && typeof memory.currentCrm === "object" ? memory.currentCrm : {}),
      pipeline: memory.currentCrm?.pipeline || "lead → booked → completed",
      customerCount: memory.currentCrm?.customerCount ?? 0,
      notes: memory.currentCrm?.notes || "CRM scaffolded via Hubly Runtime",
    },
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      crmReady: true,
      crmScaffoldedAt: new Date().toISOString(),
    },
  });
  return {
    ok: true,
    detail: "CRM structure recorded in Memory",
    memory: next,
    effects: { currentCrm: next.currentCrm },
  };
};

const runBooking: CapabilityRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      bookingFlow: {
        enabled: true,
        intake: ["name", "phone", "service", "preferred_time"],
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Booking preferences stored in Memory",
    memory: next,
    effects: { bookingFlow: (next.extras as Record<string, unknown>)?.bookingFlow },
  };
};

const runDashboard: CapabilityRunner = async ({ memory }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      dashboard: {
        views: ["today", "jobs", "customers", "money"],
        scaffoldedAt: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Dashboard preferences stored in Memory",
    memory: next,
    effects: { dashboard: (next.extras as Record<string, unknown>)?.dashboard },
  };
};

const runCoaching: CapabilityRunner = async ({ memory, why }) => {
  const next = mergeBusinessMemory(memory, {
    extras: {
      ...(memory.extras && typeof memory.extras === "object" ? memory.extras : {}),
      coach: {
        lastFocus: why || memory.onboardingPriority || "growth",
        at: new Date().toISOString(),
      },
    },
  });
  return {
    ok: true,
    detail: "Coaching focus recorded in Memory",
    memory: next,
    effects: { coach: (next.extras as Record<string, unknown>)?.coach },
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
  const cap = getCapability(capability);
  if (!cap) {
    return {
      capability,
      ok: false,
      detail: "Unknown capability",
      memory,
    };
  }
  if (!cap.executable) {
    return {
      capability,
      ok: false,
      skipped: true,
      detail: "Capability registered but not executable yet — platform migration pending",
      memory,
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
    };
  }
  const result = await runner({ memory, why, ctx });
  return { capability, ...result };
}

export const HublyExecutors = {
  executeCapability,
  persistBusinessMemory,
  runners: RUNNERS,
};

export default HublyExecutors;
